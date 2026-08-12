from typing import List, Optional
from decimal import Decimal
import datetime

from ninja import Router, Schema
from ninja.errors import HttpError
from django.shortcuts import get_object_or_404

from apps.finance.models import Account, Transaction, Entry, BankAccount, BankStatement, BankTransaction
from apps.finance.services import (
    record_transaction, void_transaction, get_account_balance,
    reconcile_bank_transaction, create_bank_account, add_bank_statement, bulk_add_bank_transactions
)
from apps.finance.selectors import (
    get_ledger_summary, get_trial_balance, get_pl_statement,
    get_balance_sheet, get_ar_aging, get_cash_flow_statement
)
from apps.core.api import BearerAuth, enforce_permission

router = Router()

# ============================================================
# SCHEMAS — EXISTING
# ============================================================

class AccountSchema(Schema):
    id: int
    name: str
    code: str
    type: str
    pl_group: str
    is_active: bool
    description: str

class AccountCreateSchema(Schema):
    name: str
    code: str
    type: str
    pl_group: str
    description: str = ""

class AccountBalanceSchema(Schema):
    code: str
    name: str
    type: str
    balance: Decimal

class EntryInputSchema(Schema):
    account_code: str
    debit: Decimal
    credit: Decimal
    memo: str = ""

class TransactionCreateSchema(Schema):
    description: str
    reference_id: Optional[str] = None
    entries: List[EntryInputSchema]

class VoidTransactionSchema(Schema):
    reason: str

class EntryOutputSchema(Schema):
    id: int
    account_code: str
    account_name: str
    debit: Decimal
    credit: Decimal
    memo: str

class TransactionDetailSchema(Schema):
    id: int
    timestamp: str
    description: str
    reference_id: Optional[str] = None
    status: str
    void_reason: str
    total_debits: Decimal
    total_credits: Decimal
    is_balanced: bool
    entries: List[EntryOutputSchema]

class TransactionSchema(Schema):
    id: int
    timestamp: str
    description: str
    reference_id: Optional[str] = None
    status: str

class LedgerSummarySchema(Schema):
    asset: Decimal
    liability: Decimal
    equity: Decimal
    revenue: Decimal
    expense: Decimal
    net_income: Decimal

class TrialBalanceRowSchema(Schema):
    account_code: str
    account_name: str
    account_type: str
    total_debit: Decimal
    total_credit: Decimal
    debit_balance: Decimal
    credit_balance: Decimal

class PLLineSchema(Schema):
    account: str
    code: str
    amount: Decimal

class PLStatementSchema(Schema):
    period_start: str
    period_end: str
    revenue_lines: List[PLLineSchema]
    expense_lines: List[PLLineSchema]
    total_revenue: Decimal
    total_expenses: Decimal
    gross_profit: Decimal
    net_income: Decimal

# ============================================================
# SCHEMAS — BALANCE SHEET
# ============================================================

class BalanceSheetLineSchema(Schema):
    code: str
    name: str
    balance: Decimal

class BalanceSheetSectionSchema(Schema):
    lines: List[BalanceSheetLineSchema]
    total: Decimal

class BalanceSheetEquitySchema(Schema):
    lines: List[BalanceSheetLineSchema]
    retained_earnings: Decimal
    total: Decimal

class BalanceSheetSchema(Schema):
    as_of_date: str
    assets: BalanceSheetSectionSchema
    liabilities: BalanceSheetSectionSchema
    equity: BalanceSheetEquitySchema
    total_liabilities_and_equity: Decimal
    is_balanced: bool

# ============================================================
# SCHEMAS — AR AGING
# ============================================================

class ARAgingRowSchema(Schema):
    order_number: str
    customer: str
    order_date: str
    age_days: int
    total_amount: Decimal
    paid_amount: Decimal
    outstanding: Decimal

class ARAgingBucketsSchema(Schema):
    current_0_30: List[ARAgingRowSchema]
    days_31_60: List[ARAgingRowSchema]
    days_61_90: List[ARAgingRowSchema]
    days_91_plus: List[ARAgingRowSchema]

class ARAgingTotalsSchema(Schema):
    current_0_30: Decimal
    days_31_60: Decimal
    days_61_90: Decimal
    days_91_plus: Decimal
    grand_total: Decimal

class ARAgingSummarySchema(Schema):
    total_open_orders: int
    total_outstanding: Decimal

class ARAgingSchema(Schema):
    as_of_date: str
    buckets: ARAgingBucketsSchema
    totals: ARAgingTotalsSchema
    summary: ARAgingSummarySchema

# ============================================================
# SCHEMAS — CASH FLOW
# ============================================================

class CashFlowLineSchema(Schema):
    account: str
    code: str
    amount: Decimal

class CashFlowOperatingSchema(Schema):
    inflows: List[CashFlowLineSchema]
    outflows: List[CashFlowLineSchema]
    total_inflows: Decimal
    total_outflows: Decimal
    net: Decimal

class CashFlowSectionSchema(Schema):
    lines: List[CashFlowLineSchema]
    net: Decimal

class CashFlowSchema(Schema):
    period_start: str
    period_end: str
    operating: CashFlowOperatingSchema
    investing: CashFlowSectionSchema
    financing: CashFlowSectionSchema
    net_cash_change: Decimal

# ============================================================
# SCHEMAS — BANK RECONCILIATION
# ============================================================

class BankAccountCreateSchema(Schema):
    name: str
    account_type: str  # bank | mobile_banking | cash
    provider: str
    account_number: str
    ledger_account_code: str
    opening_balance: Decimal = Decimal('0.00')
    notes: str = ''

class BankAccountUpdateSchema(Schema):
    name: Optional[str] = None
    account_type: Optional[str] = None
    provider: Optional[str] = None
    account_number: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class BankAccountSchema(Schema):
    id: int
    name: str
    account_type: str
    provider: str
    account_number: str
    ledger_account_code: str
    ledger_account_name: str
    opening_balance: Decimal
    is_active: bool
    notes: str

class BankStatementCreateSchema(Schema):
    period_start: datetime.date
    period_end: datetime.date
    opening_balance: Decimal
    closing_balance: Decimal
    notes: str = ''

class BankStatementSchema(Schema):
    id: int
    bank_account_id: int
    bank_account_name: str
    period_start: str
    period_end: str
    opening_balance: Decimal
    closing_balance: Decimal
    total_transactions: int
    reconciled_count: int
    unreconciled_count: int
    notes: str

class BankTransactionInputSchema(Schema):
    transaction_date: datetime.date
    description: str
    transaction_type: str  # credit | debit
    amount: Decimal
    reference: str = ''

class BankTransactionBulkSchema(Schema):
    transactions: List[BankTransactionInputSchema]

class BankTransactionSchema(Schema):
    id: int
    transaction_date: str
    description: str
    transaction_type: str
    amount: Decimal
    reference: str
    is_reconciled: bool
    matched_entry_id: Optional[int]
    reconciled_at: Optional[str]
    reconciled_by: str

class ReconcileSchema(Schema):
    bank_transaction_id: int
    ledger_entry_id: int

class ReconciliationStatusSchema(Schema):
    bank_account_id: int
    bank_account_name: str
    total: int
    reconciled: int
    unreconciled: int
    unreconciled_transactions: List[BankTransactionSchema]


# ============================================================
# EXISTING CHART OF ACCOUNTS ENDPOINTS
# ============================================================

@router.get("/accounts", response=List[AccountSchema], auth=BearerAuth())
def list_accounts(request, type: Optional[str] = None, is_active: Optional[bool] = None):
    """List all Chart of Accounts with optional type and active filters."""
    enforce_permission(request, "finance", "view_ledger")
    qs = Account.objects.all().order_by('code')
    if type:
        qs = qs.filter(type=type)
    if is_active is not None:
        qs = qs.filter(is_active=is_active)
    return list(qs)

@router.post("/accounts", response=AccountSchema, auth=BearerAuth())
def create_account(request, data: AccountCreateSchema):
    """Create a new ledger account in the Chart of Accounts."""
    enforce_permission(request, "finance", "record_transaction")
    if Account.objects.filter(code=data.code).exists():
        raise HttpError(400, f"Account with code '{data.code}' already exists.")
    account = Account.objects.create(**data.dict())
    return account

@router.get("/accounts/{code}/balance", response=AccountBalanceSchema, auth=BearerAuth())
def get_account_balance_view(request, code: str):
    """Get the current running balance for a single account."""
    enforce_permission(request, "finance", "view_ledger")
    account = get_object_or_404(Account, code=code)
    balance = get_account_balance(code)
    return {"code": account.code, "name": account.name, "type": account.type, "balance": balance}

# ============================================================
# EXISTING TRANSACTION ENDPOINTS
# ============================================================

@router.post("/transactions", response=TransactionSchema, auth=BearerAuth())
def post_transaction(request, data: TransactionCreateSchema):
    """Post a new balanced double-entry transaction to the ledger."""
    enforce_permission(request, "finance", "record_transaction")
    entries_list = [e.dict() for e in data.entries]
    try:
        tx = record_transaction(
            description=data.description,
            entries_data=entries_list,
            reference_id=data.reference_id
        )
        return {
            "id": tx.id,
            "timestamp": tx.timestamp.isoformat(),
            "description": tx.description,
            "reference_id": tx.reference_id,
            "status": tx.status
        }
    except Exception as e:
        raise HttpError(400, str(e))

@router.get("/transactions", response=List[TransactionSchema], auth=BearerAuth())
def list_transactions(request, reference_id: Optional[str] = None, status: Optional[str] = None):
    """Paginated list of transactions with optional filters."""
    enforce_permission(request, "finance", "view_ledger")
    qs = Transaction.objects.order_by('-timestamp')
    if reference_id:
        qs = qs.filter(reference_id=reference_id)
    if status:
        qs = qs.filter(status=status)
    return [
        {"id": t.id, "timestamp": t.timestamp.isoformat(),
         "description": t.description, "reference_id": t.reference_id, "status": t.status}
        for t in qs[:200]
    ]

@router.get("/transactions/{tx_id}", response=TransactionDetailSchema, auth=BearerAuth())
def get_transaction_detail(request, tx_id: int):
    """Get a full transaction detail with all debit/credit entry lines."""
    enforce_permission(request, "finance", "view_ledger")
    tx = get_object_or_404(Transaction.objects.prefetch_related('entries__account'), id=tx_id)
    entries = [
        {
            "id": e.id,
            "account_code": e.account.code,
            "account_name": e.account.name,
            "debit": e.debit,
            "credit": e.credit,
            "memo": e.memo
        }
        for e in tx.entries.all()
    ]
    return {
        "id": tx.id,
        "timestamp": tx.timestamp.isoformat(),
        "description": tx.description,
        "reference_id": tx.reference_id,
        "status": tx.status,
        "void_reason": tx.void_reason,
        "total_debits": tx.total_debits,
        "total_credits": tx.total_credits,
        "is_balanced": tx.is_balanced,
        "entries": entries
    }

@router.post("/transactions/{tx_id}/void", response=TransactionSchema, auth=BearerAuth())
def void_transaction_view(request, tx_id: int, data: VoidTransactionSchema):
    """Void a posted transaction by creating an exact mirror reversal."""
    enforce_permission(request, "finance", "record_transaction")
    try:
        reversal = void_transaction(transaction_id=tx_id, reason=data.reason)
        return {
            "id": reversal.id,
            "timestamp": reversal.timestamp.isoformat(),
            "description": reversal.description,
            "reference_id": reversal.reference_id,
            "status": reversal.status
        }
    except Exception as e:
        raise HttpError(400, str(e))

# ============================================================
# EXISTING REPORTING ENDPOINTS
# ============================================================

@router.get("/summary", response=LedgerSummarySchema, auth=BearerAuth())
def get_summary(request):
    """Ledger summary grouped by account type for the dashboard Balance Sheet widget."""
    enforce_permission(request, "finance", "view_ledger")
    return get_ledger_summary()

@router.get("/trial-balance", response=List[TrialBalanceRowSchema], auth=BearerAuth())
def get_trial_balance_view(request):
    """Generate a full Trial Balance report."""
    enforce_permission(request, "finance", "view_ledger")
    return get_trial_balance()

@router.get("/pl-statement", response=PLStatementSchema, auth=BearerAuth())
def get_pl_statement_view(
    request,
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None
):
    """Generate a Profit & Loss statement for a given date range."""
    enforce_permission(request, "finance", "view_ledger")
    return get_pl_statement(start_date=start_date, end_date=end_date)

# ============================================================
# NEW — BALANCE SHEET
# ============================================================

@router.get("/balance-sheet", response=BalanceSheetSchema, auth=BearerAuth())
def get_balance_sheet_view(request, as_of: Optional[datetime.date] = None):
    """
    Generate a full Balance Sheet (Assets = Liabilities + Equity).
    Optionally pass ?as_of=YYYY-MM-DD to get a historical snapshot.
    Defaults to today.
    """
    enforce_permission(request, "finance", "view_ledger")
    return get_balance_sheet(as_of_date=as_of)

# ============================================================
# NEW — ACCOUNTS RECEIVABLE AGING
# ============================================================

@router.get("/ar-aging", response=ARAgingSchema, auth=BearerAuth())
def get_ar_aging_view(request):
    """
    Generate an AR Aging report showing outstanding order balances
    bucketed by age: Current (0-30d), 31-60d, 61-90d, 90d+.
    """
    enforce_permission(request, "finance", "view_ledger")
    return get_ar_aging()

# ============================================================
# NEW — CASH FLOW STATEMENT
# ============================================================

@router.get("/cash-flow", response=CashFlowSchema, auth=BearerAuth())
def get_cash_flow_view(
    request,
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None
):
    """
    Generate a Cash Flow Statement for a given period.
    Sections: Operating, Investing, Financing.
    Defaults to current calendar month.
    """
    enforce_permission(request, "finance", "view_ledger")
    return get_cash_flow_statement(start_date=start_date, end_date=end_date)

# ============================================================
# NEW — BANK RECONCILIATION
# ============================================================

@router.get("/bank-accounts", response=List[BankAccountSchema], auth=BearerAuth())
def list_bank_accounts(request, is_active: Optional[bool] = None):
    """List all registered bank/mobile banking accounts."""
    enforce_permission(request, "finance", "view_ledger")
    qs = BankAccount.objects.select_related('ledger_account').order_by('name')
    if is_active is not None:
        qs = qs.filter(is_active=is_active)
    result = []
    for ba in qs:
        result.append({
            "id": ba.id,
            "name": ba.name,
            "account_type": ba.account_type,
            "provider": ba.provider,
            "account_number": ba.account_number,
            "ledger_account_code": ba.ledger_account.code,
            "ledger_account_name": ba.ledger_account.name,
            "opening_balance": ba.opening_balance,
            "is_active": ba.is_active,
            "notes": ba.notes,
        })
    return result

@router.post("/bank-accounts", response=BankAccountSchema, auth=BearerAuth())
def create_bank_account_view(request, data: BankAccountCreateSchema):
    """Register a new bank or mobile banking account."""
    enforce_permission(request, "finance", "record_transaction")
    try:
        ba = create_bank_account(
            name=data.name,
            account_type=data.account_type,
            provider=data.provider,
            account_number=data.account_number,
            ledger_account_code=data.ledger_account_code,
            opening_balance=data.opening_balance,
            notes=data.notes
        )
        return {
            "id": ba.id,
            "name": ba.name,
            "account_type": ba.account_type,
            "provider": ba.provider,
            "account_number": ba.account_number,
            "ledger_account_code": ba.ledger_account.code,
            "ledger_account_name": ba.ledger_account.name,
            "opening_balance": ba.opening_balance,
            "is_active": ba.is_active,
            "notes": ba.notes,
        }
    except Exception as e:
        raise HttpError(400, str(e))

@router.put("/bank-accounts/{bank_account_id}", response=BankAccountSchema, auth=BearerAuth())
def update_bank_account_view(request, bank_account_id: int, data: BankAccountUpdateSchema):
    """Update an existing bank or mobile banking account."""
    enforce_permission(request, "finance", "record_transaction")
    try:
        ba = get_object_or_404(BankAccount, id=bank_account_id)
        
        if data.name is not None:
            ba.name = data.name
        if data.account_type is not None:
            ba.account_type = data.account_type
        if data.provider is not None:
            ba.provider = data.provider
        if data.account_number is not None:
            ba.account_number = data.account_number
        if data.notes is not None:
            ba.notes = data.notes
        if data.is_active is not None:
            ba.is_active = data.is_active
            
        ba.save()
        
        return {
            "id": ba.id,
            "name": ba.name,
            "account_type": ba.account_type,
            "provider": ba.provider,
            "account_number": ba.account_number,
            "ledger_account_code": ba.ledger_account.code,
            "ledger_account_name": ba.ledger_account.name,
            "opening_balance": ba.opening_balance,
            "is_active": ba.is_active,
            "notes": ba.notes,
        }
    except Exception as e:
        raise HttpError(400, str(e))

@router.get("/bank-accounts/{bank_account_id}/statements", response=List[BankStatementSchema], auth=BearerAuth())
def list_statements(request, bank_account_id: int):
    """List all statement periods for a given bank account."""
    enforce_permission(request, "finance", "view_ledger")
    qs = BankStatement.objects.filter(
        bank_account_id=bank_account_id
    ).select_related('bank_account').order_by('-period_end')
    result = []
    for s in qs:
        result.append({
            "id": s.id,
            "bank_account_id": s.bank_account_id,
            "bank_account_name": s.bank_account.name,
            "period_start": str(s.period_start),
            "period_end": str(s.period_end),
            "opening_balance": s.opening_balance,
            "closing_balance": s.closing_balance,
            "total_transactions": s.total_transactions,
            "reconciled_count": s.reconciled_count,
            "unreconciled_count": s.unreconciled_count,
            "notes": s.notes,
        })
    return result

@router.post("/bank-accounts/{bank_account_id}/statements", response=BankStatementSchema, auth=BearerAuth())
def create_statement(request, bank_account_id: int, data: BankStatementCreateSchema):
    """Create a new statement period for a bank account."""
    enforce_permission(request, "finance", "record_transaction")
    try:
        s = add_bank_statement(
            bank_account_id=bank_account_id,
            period_start=data.period_start,
            period_end=data.period_end,
            opening_balance=data.opening_balance,
            closing_balance=data.closing_balance,
            notes=data.notes
        )
        return {
            "id": s.id,
            "bank_account_id": s.bank_account_id,
            "bank_account_name": s.bank_account.name,
            "period_start": str(s.period_start),
            "period_end": str(s.period_end),
            "opening_balance": s.opening_balance,
            "closing_balance": s.closing_balance,
            "total_transactions": 0,
            "reconciled_count": 0,
            "unreconciled_count": 0,
            "notes": s.notes,
        }
    except Exception as e:
        raise HttpError(400, str(e))

@router.get("/bank-accounts/{bank_account_id}/statements/{statement_id}/transactions", response=List[BankTransactionSchema], auth=BearerAuth())
def list_bank_transactions(request, bank_account_id: int, statement_id: int, is_reconciled: Optional[bool] = None):
    """List all transaction lines for a statement. Filter by ?is_reconciled=true/false."""
    enforce_permission(request, "finance", "view_ledger")
    qs = BankTransaction.objects.filter(
        statement_id=statement_id,
        statement__bank_account_id=bank_account_id
    ).select_related('matched_entry').order_by('-transaction_date')
    if is_reconciled is not None:
        qs = qs.filter(is_reconciled=is_reconciled)
    result = []
    for tx in qs:
        result.append({
            "id": tx.id,
            "transaction_date": str(tx.transaction_date),
            "description": tx.description,
            "transaction_type": tx.transaction_type,
            "amount": tx.amount,
            "reference": tx.reference,
            "is_reconciled": tx.is_reconciled,
            "matched_entry_id": tx.matched_entry_id,
            "reconciled_at": tx.reconciled_at.isoformat() if tx.reconciled_at else None,
            "reconciled_by": tx.reconciled_by,
        })
    return result

@router.post("/bank-accounts/{bank_account_id}/statements/{statement_id}/transactions/bulk", auth=BearerAuth())
def bulk_import_transactions(request, bank_account_id: int, statement_id: int, data: BankTransactionBulkSchema):
    """
    Bulk import transaction lines from a bank statement.
    Pass a list of transactions with date, description, type, amount, and reference.
    """
    enforce_permission(request, "finance", "record_transaction")
    try:
        transactions_raw = [t.dict() for t in data.transactions]
        result = bulk_add_bank_transactions(
            statement_id=statement_id,
            transactions=transactions_raw
        )
        return result
    except Exception as e:
        raise HttpError(400, str(e))

@router.post("/reconcile", auth=BearerAuth())
def reconcile(request, data: ReconcileSchema):
    """
    Match a bank statement transaction to a ledger entry.
    Both must have matching amounts (within 1.00 BDT tolerance).
    """
    enforce_permission(request, "finance", "record_transaction")
    try:
        username = getattr(request.auth, 'username', 'admin')
        result = reconcile_bank_transaction(
            bank_transaction_id=data.bank_transaction_id,
            ledger_entry_id=data.ledger_entry_id,
            reconciled_by=username
        )
        return result
    except Exception as e:
        raise HttpError(400, str(e))

@router.get("/bank-accounts/{bank_account_id}/reconciliation-status", response=ReconciliationStatusSchema, auth=BearerAuth())
def get_reconciliation_status(request, bank_account_id: int):
    """
    Get a quick reconciliation status overview for a bank account.
    Shows total, reconciled, and unreconciled transactions across ALL statements.
    """
    enforce_permission(request, "finance", "view_ledger")
    ba = get_object_or_404(BankAccount.objects.select_related('ledger_account'), id=bank_account_id)

    all_txs = BankTransaction.objects.filter(
        statement__bank_account=ba
    ).select_related('matched_entry').order_by('-transaction_date')

    reconciled = all_txs.filter(is_reconciled=True).count()
    total = all_txs.count()
    unreconciled_qs = all_txs.filter(is_reconciled=False)

    unreconciled_list = []
    for tx in unreconciled_qs[:100]:  # Cap at 100
        unreconciled_list.append({
            "id": tx.id,
            "transaction_date": str(tx.transaction_date),
            "description": tx.description,
            "transaction_type": tx.transaction_type,
            "amount": tx.amount,
            "reference": tx.reference,
            "is_reconciled": tx.is_reconciled,
            "matched_entry_id": tx.matched_entry_id,
            "reconciled_at": tx.reconciled_at.isoformat() if tx.reconciled_at else None,
            "reconciled_by": tx.reconciled_by,
        })

    return {
        "bank_account_id": ba.id,
        "bank_account_name": ba.name,
        "total": total,
        "reconciled": reconciled,
        "unreconciled": total - reconciled,
        "unreconciled_transactions": unreconciled_list,
    }


# --------------------------
# SCHEMAS
# --------------------------

class AccountSchema(Schema):
    id: int
    name: str
    code: str
    type: str
    pl_group: str
    is_active: bool
    description: str

class AccountCreateSchema(Schema):
    name: str
    code: str
    type: str
    pl_group: str
    description: str = ""

class AccountBalanceSchema(Schema):
    code: str
    name: str
    type: str
    balance: Decimal

class EntryInputSchema(Schema):
    account_code: str
    debit: Decimal
    credit: Decimal
    memo: str = ""

class TransactionCreateSchema(Schema):
    description: str
    reference_id: Optional[str] = None
    entries: List[EntryInputSchema]

class VoidTransactionSchema(Schema):
    reason: str

class EntryOutputSchema(Schema):
    id: int
    account_code: str
    account_name: str
    debit: Decimal
    credit: Decimal
    memo: str

class TransactionDetailSchema(Schema):
    id: int
    timestamp: str
    description: str
    reference_id: Optional[str] = None
    status: str
    void_reason: str
    total_debits: Decimal
    total_credits: Decimal
    is_balanced: bool
    entries: List[EntryOutputSchema]

class TransactionSchema(Schema):
    id: int
    timestamp: str
    description: str
    reference_id: Optional[str] = None
    status: str

class LedgerSummarySchema(Schema):
    asset: Decimal
    liability: Decimal
    equity: Decimal
    revenue: Decimal
    expense: Decimal
    net_income: Decimal

class TrialBalanceRowSchema(Schema):
    account_code: str
    account_name: str
    account_type: str
    total_debit: Decimal
    total_credit: Decimal
    debit_balance: Decimal
    credit_balance: Decimal

class PLLineSchema(Schema):
    account: str
    code: str
    amount: Decimal

class PLStatementSchema(Schema):
    period_start: str
    period_end: str
    revenue_lines: List[PLLineSchema]
    expense_lines: List[PLLineSchema]
    total_revenue: Decimal
    total_expenses: Decimal
    gross_profit: Decimal
    net_income: Decimal

# --------------------------
# CHART OF ACCOUNTS ENDPOINTS
# --------------------------

@router.get("/accounts", response=List[AccountSchema], auth=BearerAuth())
def list_accounts(request, type: Optional[str] = None, is_active: Optional[bool] = None):
    """List all Chart of Accounts with optional type and active filters."""
    enforce_permission(request, "finance", "view_ledger")
    qs = Account.objects.all().order_by('code')
    if type:
        qs = qs.filter(type=type)
    if is_active is not None:
        qs = qs.filter(is_active=is_active)
    return list(qs)

@router.post("/accounts", response=AccountSchema, auth=BearerAuth())
def create_account(request, data: AccountCreateSchema):
    """Create a new ledger account in the Chart of Accounts."""
    enforce_permission(request, "finance", "record_transaction")
    if Account.objects.filter(code=data.code).exists():
        raise HttpError(400, f"Account with code '{data.code}' already exists.")
    account = Account.objects.create(**data.dict())
    return account

@router.get("/accounts/{code}/balance", response=AccountBalanceSchema, auth=BearerAuth())
def get_account_balance_view(request, code: str):
    """Get the current running balance for a single account."""
    enforce_permission(request, "finance", "view_ledger")
    account = get_object_or_404(Account, code=code)
    balance = get_account_balance(code)
    return {"code": account.code, "name": account.name, "type": account.type, "balance": balance}

# --------------------------
# TRANSACTION / JOURNAL ENTRY ENDPOINTS
# --------------------------

@router.post("/transactions", response=TransactionSchema, auth=BearerAuth())
def post_transaction(request, data: TransactionCreateSchema):
    """
    Post a new balanced double-entry transaction to the ledger.
    Returns HTTP 400 if the ledger is unbalanced.
    """
    enforce_permission(request, "finance", "record_transaction")
    entries_list = [e.dict() for e in data.entries]
    try:
        tx = record_transaction(
            description=data.description,
            entries_data=entries_list,
            reference_id=data.reference_id
        )
        return {
            "id": tx.id,
            "timestamp": tx.timestamp.isoformat(),
            "description": tx.description,
            "reference_id": tx.reference_id,
            "status": tx.status
        }
    except Exception as e:
        raise HttpError(400, str(e))

@router.get("/transactions", response=List[TransactionSchema], auth=BearerAuth())
def list_transactions(request, reference_id: Optional[str] = None, status: Optional[str] = None):
    """Paginated list of transactions with optional filters."""
    enforce_permission(request, "finance", "view_ledger")
    qs = Transaction.objects.order_by('-timestamp')
    if reference_id:
        qs = qs.filter(reference_id=reference_id)
    if status:
        qs = qs.filter(status=status)
    return [
        {"id": t.id, "timestamp": t.timestamp.isoformat(),
         "description": t.description, "reference_id": t.reference_id, "status": t.status}
        for t in qs[:200]
    ]

@router.get("/transactions/{tx_id}", response=TransactionDetailSchema, auth=BearerAuth())
def get_transaction_detail(request, tx_id: int):
    """Get a full transaction detail with all debit/credit entry lines."""
    enforce_permission(request, "finance", "view_ledger")
    tx = get_object_or_404(Transaction.objects.prefetch_related('entries__account'), id=tx_id)
    entries = [
        {
            "id": e.id,
            "account_code": e.account.code,
            "account_name": e.account.name,
            "debit": e.debit,
            "credit": e.credit,
            "memo": e.memo
        }
        for e in tx.entries.all()
    ]
    return {
        "id": tx.id,
        "timestamp": tx.timestamp.isoformat(),
        "description": tx.description,
        "reference_id": tx.reference_id,
        "status": tx.status,
        "void_reason": tx.void_reason,
        "total_debits": tx.total_debits,
        "total_credits": tx.total_credits,
        "is_balanced": tx.is_balanced,
        "entries": entries
    }

@router.post("/transactions/{tx_id}/void", response=TransactionSchema, auth=BearerAuth())
def void_transaction_view(request, tx_id: int, data: VoidTransactionSchema):
    """
    Void a posted transaction by creating an exact mirror reversal.
    The original entries remain immutable — the audit trail is preserved.
    """
    enforce_permission(request, "finance", "record_transaction")
    try:
        reversal = void_transaction(transaction_id=tx_id, reason=data.reason)
        return {
            "id": reversal.id,
            "timestamp": reversal.timestamp.isoformat(),
            "description": reversal.description,
            "reference_id": reversal.reference_id,
            "status": reversal.status
        }
    except Exception as e:
        raise HttpError(400, str(e))

# --------------------------
# ANALYTICS / REPORTING ENDPOINTS
# --------------------------

@router.get("/summary", response=LedgerSummarySchema, auth=BearerAuth())
def get_summary(request):
    """Get ledger summary grouped by account type for the dashboard Balance Sheet widget."""
    enforce_permission(request, "finance", "view_ledger")
    return get_ledger_summary()

@router.get("/trial-balance", response=List[TrialBalanceRowSchema], auth=BearerAuth())
def get_trial_balance_view(request):
    """
    Generate a full Trial Balance report.
    The sum of all debit balances must equal the sum of all credit balances.
    """
    enforce_permission(request, "finance", "view_ledger")
    return get_trial_balance()

@router.get("/pl-statement", response=PLStatementSchema, auth=BearerAuth())
def get_pl_statement_view(
    request,
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None
):
    """
    Generate a Profit & Loss statement for a given date range.
    Defaults to the current calendar month.
    """
    enforce_permission(request, "finance", "view_ledger")
    return get_pl_statement(start_date=start_date, end_date=end_date)
