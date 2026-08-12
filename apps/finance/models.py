from django.db import models
from django.core.exceptions import ValidationError
from decimal import Decimal

from apps.core.decorators import AuditedModelMixin


class Account(AuditedModelMixin):
    """
    Chart of Accounts.
    Each account represents a ledger bucket (e.g., Cash, Revenue, Accounts Receivable).
    """
    TYPE_CHOICES = (
        ('asset', 'Asset'),
        ('liability', 'Liability'),
        ('equity', 'Equity'),
        ('revenue', 'Revenue'),
        ('expense', 'Expense'),
    )

    PL_GROUP_CHOICES = (
        ('balance_sheet', 'Balance Sheet'),
        ('income_statement', 'Income Statement'),
    )

    NORMAL_BALANCE = {
        'asset': 'debit',
        'expense': 'debit',
        'liability': 'credit',
        'equity': 'credit',
        'revenue': 'credit',
    }

    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, unique=True, db_index=True, help_text="e.g. '1000-CASH'")
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, db_index=True)
    pl_group = models.CharField(max_length=20, choices=PL_GROUP_CHOICES)
    is_active = models.BooleanField(default=True, db_index=True)
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['code']
        indexes = [
            models.Index(fields=['type', 'is_active']),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"

    @property
    def normal_balance(self) -> str:
        return self.NORMAL_BALANCE.get(self.type, 'debit')


class Transaction(AuditedModelMixin):
    """
    Journal Entry wrapper. Groups one or more Entry lines into a balanced transaction.
    Once posted, a transaction is immutable — it can only be reversed via a new transaction.
    """
    STATUS_CHOICES = (
        ('posted', 'Posted'),
        ('voided', 'Voided'),
    )

    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    description = models.CharField(max_length=255)
    reference_id = models.CharField(
        max_length=100, blank=True, null=True, db_index=True,
        help_text="Reference to order ID, invoice, return, etc."
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='posted', db_index=True)
    void_reason = models.TextField(blank=True, default="")
    voided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['status', 'timestamp']),
            models.Index(fields=['reference_id']),
        ]

    def __str__(self):
        return f"Tx-{self.id} [{self.status.upper()}] ({self.timestamp.date()}): {self.description}"

    @property
    def is_posted(self) -> bool:
        return self.status == 'posted'

    @property
    def total_debits(self) -> Decimal:
        return self.entries.aggregate(t=models.Sum('debit'))['t'] or Decimal('0.00')

    @property
    def total_credits(self) -> Decimal:
        return self.entries.aggregate(t=models.Sum('credit'))['t'] or Decimal('0.00')

    @property
    def is_balanced(self) -> bool:
        return self.total_debits == self.total_credits


class Entry(models.Model):
    """
    Individual debit or credit line within a Transaction.
    IMMUTABLE: Once saved, entries may not be modified or deleted.
    Deletion/modification is prevented at the model layer.
    """
    transaction = models.ForeignKey(
        Transaction, on_delete=models.PROTECT, related_name='entries',
        help_text="Parent transaction. Cascade delete is BLOCKED — use voids."
    )
    account = models.ForeignKey(
        Account, on_delete=models.PROTECT, related_name='entries'
    )
    debit = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    credit = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    created_at = models.DateTimeField(auto_now_add=True)
    memo = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        indexes = [
            models.Index(fields=['account', 'created_at']),
            models.Index(fields=['transaction']),
        ]

    # --------------------------
    # ENTRY-LEVEL VALIDATION
    # --------------------------
    def clean(self):
        if self.debit < 0:
            raise ValidationError("Debit amount cannot be negative.")
        if self.credit < 0:
            raise ValidationError("Credit amount cannot be negative.")
        if self.debit > 0 and self.credit > 0:
            raise ValidationError("A single ledger entry cannot have both a debit and credit value.")
        if self.debit == 0 and self.credit == 0:
            raise ValidationError("Ledger entry must have either a non-zero debit or credit amount.")

    def save(self, *args, **kwargs):
        # IMMUTABILITY GUARD: Prevent modification of existing entries
        if self.pk is not None:
            raise ValidationError(
                "IMMUTABILITY VIOLATION: Posted ledger entries cannot be modified. "
                "Create a reversing transaction instead."
            )
        self.clean()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # IMMUTABILITY GUARD: Prevent hard deletion of any entry
        raise ValidationError(
            "IMMUTABILITY VIOLATION: Posted ledger entries cannot be deleted. "
            "Void the parent transaction to reverse the effect."
        )

    def __str__(self):
        side = f"DR {self.debit}" if self.debit > 0 else f"CR {self.credit}"
        return f"{self.account.code} | {side}"


# ============================================================
# BANK RECONCILIATION MODELS
# ============================================================

class BankAccount(models.Model):
    """
    Represents a real-world bank or mobile banking account.
    Linked to a Chart of Accounts ledger account for double-entry integration.
    """
    ACCOUNT_TYPE_CHOICES = (
        ('bank', 'Bank Account'),
        ('mobile_banking', 'Mobile Banking'),
        ('cash', 'Cash in Hand'),
    )

    PROVIDER_CHOICES = (
        # Mobile Banking
        ('bkash', 'bKash'),
        ('nagad', 'Nagad'),
        ('rocket', 'Rocket'),
        ('upay', 'Upay'),
        # Banks
        ('dbbl', 'Dutch-Bangla Bank (DBBL)'),
        ('brac_bank', 'BRAC Bank'),
        ('dutch_bangla', 'Dutch Bangla'),
        ('islami_bank', 'Islami Bank'),
        ('city_bank', 'City Bank'),
        ('eastern_bank', 'Eastern Bank'),
        ('ucb', 'United Commercial Bank'),
        ('prime_bank', 'Prime Bank'),
        ('trust_bank', 'Trust Bank'),
        ('other', 'Other'),
    )

    name = models.CharField(max_length=100, help_text="e.g. 'bKash Business', 'DBBL Savings'")
    account_type = models.CharField(max_length=20, choices=ACCOUNT_TYPE_CHOICES, default='bank')
    provider = models.CharField(max_length=30, choices=PROVIDER_CHOICES, default='other')
    account_number = models.CharField(max_length=100, help_text="Bank account no. or mobile number")
    ledger_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name='bank_accounts',
        help_text="Linked Chart of Accounts entry (e.g. 1000-CASH or 1010-BKASH)"
    )
    opening_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.get_provider_display()} — {self.name} ({self.account_number})"


class BankStatement(models.Model):
    """
    A statement period for a bank account. Corresponds to one bank statement
    (e.g. monthly statement from bKash or a downloaded bank CSV).
    """
    bank_account = models.ForeignKey(
        BankAccount, on_delete=models.CASCADE, related_name='statements'
    )
    period_start = models.DateField()
    period_end = models.DateField()
    opening_balance = models.DecimalField(
        max_digits=14, decimal_places=2,
        help_text="Balance as per bank at start of period"
    )
    closing_balance = models.DecimalField(
        max_digits=14, decimal_places=2,
        help_text="Balance as per bank at end of period"
    )
    notes = models.TextField(blank=True, default='')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-period_end']
        unique_together = [('bank_account', 'period_start', 'period_end')]

    def __str__(self):
        return f"{self.bank_account.name} | {self.period_start} → {self.period_end}"

    @property
    def total_transactions(self):
        return self.transactions.count()

    @property
    def reconciled_count(self):
        return self.transactions.filter(is_reconciled=True).count()

    @property
    def unreconciled_count(self):
        return self.transactions.filter(is_reconciled=False).count()


class BankTransaction(models.Model):
    """
    An individual line item from a bank statement.
    Gets matched (reconciled) to a ledger Entry when confirmed.
    """
    TRANSACTION_TYPE_CHOICES = (
        ('credit', 'Credit (Money In)'),
        ('debit', 'Debit (Money Out)'),
    )

    statement = models.ForeignKey(
        BankStatement, on_delete=models.CASCADE, related_name='transactions'
    )
    transaction_date = models.DateField()
    description = models.CharField(max_length=255, help_text="Bank's own description/narration")
    transaction_type = models.CharField(max_length=10, choices=TRANSACTION_TYPE_CHOICES)
    amount = models.DecimalField(
        max_digits=14, decimal_places=2,
        help_text="Always positive. Use transaction_type to determine direction."
    )
    reference = models.CharField(
        max_length=100, blank=True, default='',
        help_text="Cheque no., bKash TrxID, bank ref. etc."
    )
    matched_entry = models.ForeignKey(
        Entry,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='bank_transactions',
        help_text="Set when this bank transaction is reconciled to a ledger entry."
    )
    is_reconciled = models.BooleanField(default=False, db_index=True)
    reconciled_at = models.DateTimeField(null=True, blank=True)
    reconciled_by = models.CharField(max_length=100, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-transaction_date', '-created_at']
        indexes = [
            models.Index(fields=['is_reconciled', 'statement']),
            models.Index(fields=['transaction_date']),
        ]

    def __str__(self):
        direction = "↑" if self.transaction_type == 'credit' else "↓"
        return f"{direction} {self.amount} | {self.description} ({self.transaction_date})"
