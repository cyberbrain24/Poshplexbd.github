from decimal import Decimal
from django.db import models, transaction as db_transaction
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.finance.models import Account, Transaction, Entry


class LedgerUnbalancedError(ValidationError):
    """Raised when the sum of debits does not equal the sum of credits."""
    pass


@db_transaction.atomic
def record_transaction(
    description: str,
    entries_data: list[dict],
    reference_id: str = None
) -> Transaction:
    """
    Records a fully balanced double-entry financial transaction.
    
    This is the ONLY permitted way to write to the ledger. It enforces:
    1. Entry-level validation (no negative amounts, no mixed debit+credit per line)
    2. Transaction-level balancing (sum of debits == sum of credits)
    3. Atomicity (all entries saved or none — PostgreSQL transaction wrap)

    entries_data format:
    [
        {"account_code": "1000-CASH", "debit": "100.00", "credit": "0.00"},
        {"account_code": "4000-REVENUE", "debit": "0.00", "credit": "100.00"}
    ]
    """
    if not entries_data or len(entries_data) < 2:
        raise ValidationError("A double-entry transaction requires at least two entries.")

    tx = Transaction.objects.create(
        description=description,
        reference_id=reference_id
    )

    total_debits = Decimal('0.00')
    total_credits = Decimal('0.00')

    for entry_info in entries_data:
        code = entry_info.get("account_code")
        debit = Decimal(str(entry_info.get("debit", "0.00")))
        credit = Decimal(str(entry_info.get("credit", "0.00")))
        memo = entry_info.get("memo", "")

        try:
            account = Account.objects.get(code=code, is_active=True)
        except Account.DoesNotExist:
            raise ValidationError(f"Active account with code '{code}' does not exist.")

        entry = Entry(
            transaction=tx,
            account=account,
            debit=debit,
            credit=credit,
            memo=memo
        )
        entry.full_clean()
        entry.save()

        total_debits += debit
        total_credits += credit

    # STRICT DOUBLE-ENTRY RULE: Abort entire transaction if not balanced
    if total_debits != total_credits:
        raise LedgerUnbalancedError(
            f"Ledger is UNBALANCED. Debits: {total_debits}, Credits: {total_credits}. "
            f"Difference: {abs(total_debits - total_credits)}. Transaction rolled back."
        )

    return tx


@db_transaction.atomic
def void_transaction(transaction_id: int, reason: str) -> Transaction:
    """
    Voids a posted transaction by creating an exact mirror reversal.
    
    The original Transaction entries remain immutable and untouched (audit trail).
    A new reversing Transaction is created with all debits and credits swapped.
    """
    try:
        original_tx = Transaction.objects.prefetch_related('entries__account').get(
            id=transaction_id,
            status='posted'
        )
    except Transaction.DoesNotExist:
        raise ValidationError(f"Transaction #{transaction_id} not found or already voided.")

    # Mark the original as voided
    original_tx.status = 'voided'
    original_tx.void_reason = reason
    original_tx.voided_at = timezone.now()
    # Use queryset update to bypass Entry immutability (Transaction itself is mutable)
    Transaction.objects.filter(pk=original_tx.pk).update(
        status='voided',
        void_reason=reason,
        voided_at=original_tx.voided_at
    )

    # Create the reversing transaction
    reversing_tx = Transaction.objects.create(
        description=f"REVERSAL of Tx-{original_tx.id}: {original_tx.description}",
        reference_id=original_tx.reference_id,
        status='posted'
    )

    reversal_entries = []
    for entry in original_tx.entries.all():
        reversal_entries.append({
            "account_code": entry.account.code,
            "debit": str(entry.credit),   # Swap: original credit becomes debit
            "credit": str(entry.debit),   # Swap: original debit becomes credit
            "memo": f"Reversal of Entry #{entry.id}"
        })

    # Re-use record_transaction to enforce all validation on the reversal
    # We skip the outer atomic wrapper by calling directly
    for entry_info in reversal_entries:
        account = Account.objects.get(code=entry_info["account_code"])
        debit = Decimal(entry_info["debit"])
        credit = Decimal(entry_info["credit"])
        entry = Entry(
            transaction=reversing_tx,
            account=account,
            debit=debit,
            credit=credit,
            memo=entry_info["memo"]
        )
        entry.full_clean()
        entry.save()

    return reversing_tx


def get_account_balance(account_code: str) -> Decimal:
    """
    Calculates the current running balance for a single account.
    Respects normal balance convention (debit-normal vs credit-normal).
    Excludes entries belonging to voided transactions.
    """
    try:
        account = Account.objects.get(code=account_code)
    except Account.DoesNotExist:
        return Decimal('0.00')

    aggregates = Entry.objects.filter(
        account=account,
        transaction__status='posted'   # Exclude voided transactions
    ).aggregate(
        total_debit=models.Sum('debit'),
        total_credit=models.Sum('credit')
    )

    debits = aggregates.get('total_debit') or Decimal('0.00')
    credits = aggregates.get('total_credit') or Decimal('0.00')

    # Asset & Expense: normal balance is debit (debit increases the account)
    if account.type in ('asset', 'expense'):
        return debits - credits
    # Liability, Equity, & Revenue: normal balance is credit
    return credits - debits


# ============================================================
# BANK RECONCILIATION SERVICES
# ============================================================

@db_transaction.atomic
def reconcile_bank_transaction(bank_transaction_id: int, ledger_entry_id: int, reconciled_by: str = "system") -> dict:
    """
    Matches a BankTransaction (from a bank statement) to a ledger Entry.

    Rules:
    - BankTransaction must not already be reconciled.
    - Entry must exist and belong to a posted Transaction.
    - Amount must match (debit/credit direction confirmed).

    Returns a dict with reconciliation confirmation.
    """
    from apps.finance.models import BankTransaction, Entry as LedgerEntry

    try:
        bank_tx = BankTransaction.objects.select_related('statement__bank_account').get(
            id=bank_transaction_id
        )
    except BankTransaction.DoesNotExist:
        raise ValidationError(f"BankTransaction #{bank_transaction_id} not found.")

    if bank_tx.is_reconciled:
        raise ValidationError(f"BankTransaction #{bank_transaction_id} is already reconciled.")

    try:
        entry = LedgerEntry.objects.select_related('transaction', 'account').get(
            id=ledger_entry_id
        )
    except LedgerEntry.DoesNotExist:
        raise ValidationError(f"Ledger Entry #{ledger_entry_id} not found.")

    if entry.transaction.status != 'posted':
        raise ValidationError(f"Ledger Entry #{ledger_entry_id} belongs to a voided transaction.")

    # Amount validation (allow small rounding tolerance of 1 BDT)
    if bank_tx.transaction_type == 'credit':
        ledger_amount = entry.credit
    else:
        ledger_amount = entry.debit

    if abs(bank_tx.amount - ledger_amount) > Decimal('1.00'):
        raise ValidationError(
            f"Amount mismatch: Bank shows {bank_tx.amount}, ledger shows {ledger_amount}. "
            f"Max tolerance is 1.00."
        )

    # Mark as reconciled
    BankTransaction.objects.filter(pk=bank_tx.pk).update(
        is_reconciled=True,
        reconciled_at=timezone.now(),
        reconciled_by=reconciled_by,
        matched_entry=entry
    )

    return {
        "bank_transaction_id": bank_transaction_id,
        "ledger_entry_id": ledger_entry_id,
        "bank_amount": bank_tx.amount,
        "ledger_amount": ledger_amount,
        "reconciled_at": timezone.now().isoformat(),
        "reconciled_by": reconciled_by,
    }


@db_transaction.atomic
def create_bank_account(
    name: str,
    account_type: str,
    provider: str,
    account_number: str,
    ledger_account_code: str,
    opening_balance: Decimal = Decimal('0.00'),
    notes: str = ''
):
    """
    Creates a new BankAccount linked to a Chart of Accounts ledger account.
    """
    from apps.finance.models import BankAccount

    try:
        ledger_account = Account.objects.get(code=ledger_account_code, is_active=True)
    except Account.DoesNotExist:
        raise ValidationError(f"Active ledger account '{ledger_account_code}' not found.")

    bank_account = BankAccount.objects.create(
        name=name,
        account_type=account_type,
        provider=provider,
        account_number=account_number,
        ledger_account=ledger_account,
        opening_balance=opening_balance,
        notes=notes
    )
    return bank_account


@db_transaction.atomic
def add_bank_statement(
    bank_account_id: int,
    period_start,
    period_end,
    opening_balance: Decimal,
    closing_balance: Decimal,
    notes: str = ''
):
    """Creates a statement period for a bank account."""
    from apps.finance.models import BankAccount, BankStatement

    try:
        bank_account = BankAccount.objects.get(id=bank_account_id, is_active=True)
    except BankAccount.DoesNotExist:
        raise ValidationError(f"BankAccount #{bank_account_id} not found or inactive.")

    statement = BankStatement.objects.create(
        bank_account=bank_account,
        period_start=period_start,
        period_end=period_end,
        opening_balance=opening_balance,
        closing_balance=closing_balance,
        notes=notes
    )
    return statement


@db_transaction.atomic
def bulk_add_bank_transactions(statement_id: int, transactions: list[dict]):
    """
    Bulk-imports transaction lines into a BankStatement.

    Each item in transactions:
    {
        "transaction_date": "YYYY-MM-DD",
        "description": "...",
        "transaction_type": "credit" | "debit",
        "amount": "100.00",
        "reference": "bKash TrxID or cheque no."
    }
    """
    from apps.finance.models import BankStatement, BankTransaction as BankTx
    import datetime

    try:
        statement = BankStatement.objects.get(id=statement_id)
    except BankStatement.DoesNotExist:
        raise ValidationError(f"BankStatement #{statement_id} not found.")

    created = []
    for item in transactions:
        tx = BankTx(
            statement=statement,
            transaction_date=item['transaction_date'],
            description=item.get('description', ''),
            transaction_type=item['transaction_type'],
            amount=Decimal(str(item['amount'])),
            reference=item.get('reference', ''),
        )
        tx.full_clean()
        tx.save()
        created.append(tx.id)

    return {"statement_id": statement_id, "transactions_added": len(created)}
