from decimal import Decimal
from django.db.models import Sum, Q
from apps.finance.models import Account, Entry
import datetime


def get_ledger_summary() -> dict:
    """
    Computes balances for all active accounts grouped by type.
    Excludes entries from voided transactions.
    Used for the Balance Sheet and P&L dashboard widgets.
    """
    accounts = Account.objects.filter(is_active=True)
    summary = {
        "asset": Decimal("0.00"),
        "liability": Decimal("0.00"),
        "equity": Decimal("0.00"),
        "revenue": Decimal("0.00"),
        "expense": Decimal("0.00"),
    }

    for account in accounts:
        agg = Entry.objects.filter(
            account=account,
            transaction__status='posted'
        ).aggregate(
            debits=Sum('debit'),
            credits=Sum('credit')
        )
        debits = agg.get('debits') or Decimal('0.00')
        credits = agg.get('credits') or Decimal('0.00')

        if account.type in ('asset', 'expense'):
            balance = debits - credits
        else:
            balance = credits - debits

        summary[account.type] = summary.get(account.type, Decimal("0.00")) + balance

    summary["net_income"] = summary["revenue"] - summary["expense"]
    return summary


def get_trial_balance() -> list[dict]:
    """
    Generates a Trial Balance: a full list of all accounts with their
    debit and credit totals, and a running balance.
    
    The sum of all debit balances must equal the sum of all credit balances.
    Returns account rows ordered by account code.
    """
    accounts = Account.objects.filter(is_active=True).order_by('code')
    rows = []

    for account in accounts:
        agg = Entry.objects.filter(
            account=account,
            transaction__status='posted'
        ).aggregate(
            total_debit=Sum('debit'),
            total_credit=Sum('credit')
        )
        total_debit = agg.get('total_debit') or Decimal('0.00')
        total_credit = agg.get('total_credit') or Decimal('0.00')

        if account.type in ('asset', 'expense'):
            balance = total_debit - total_credit
            debit_balance = balance if balance >= 0 else Decimal('0.00')
            credit_balance = Decimal('0.00')
        else:
            balance = total_credit - total_debit
            credit_balance = balance if balance >= 0 else Decimal('0.00')
            debit_balance = Decimal('0.00')

        rows.append({
            "account_code": account.code,
            "account_name": account.name,
            "account_type": account.type,
            "total_debit": total_debit,
            "total_credit": total_credit,
            "debit_balance": debit_balance,
            "credit_balance": credit_balance,
        })

    return rows


def get_pl_statement(
    start_date: datetime.date = None,
    end_date: datetime.date = None
) -> dict:
    """
    Generates a detailed Profit & Loss statement for a given date range.
    Defaults to the current calendar month if no range is provided.
    """
    if not start_date:
        today = datetime.date.today()
        start_date = today.replace(day=1)
    if not end_date:
        end_date = datetime.date.today()

    date_filter = Q(
        transaction__status='posted',
        transaction__timestamp__date__gte=start_date,
        transaction__timestamp__date__lte=end_date
    )

    revenue_accounts = Account.objects.filter(type='revenue', is_active=True)
    expense_accounts = Account.objects.filter(type='expense', is_active=True)

    revenue_lines = []
    total_revenue = Decimal('0.00')
    for acc in revenue_accounts:
        agg = Entry.objects.filter(date_filter, account=acc).aggregate(
            d=Sum('debit'), c=Sum('credit')
        )
        balance = (agg['c'] or Decimal('0.00')) - (agg['d'] or Decimal('0.00'))
        revenue_lines.append({"account": acc.name, "code": acc.code, "amount": balance})
        total_revenue += balance

    expense_lines = []
    total_expenses = Decimal('0.00')
    for acc in expense_accounts:
        agg = Entry.objects.filter(date_filter, account=acc).aggregate(
            d=Sum('debit'), c=Sum('credit')
        )
        balance = (agg['d'] or Decimal('0.00')) - (agg['c'] or Decimal('0.00'))
        expense_lines.append({"account": acc.name, "code": acc.code, "amount": balance})
        total_expenses += balance

    return {
        "period_start": str(start_date),
        "period_end": str(end_date),
        "revenue_lines": revenue_lines,
        "expense_lines": expense_lines,
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "gross_profit": total_revenue - total_expenses,
        "net_income": total_revenue - total_expenses,
    }


# ============================================================
# BALANCE SHEET
# ============================================================

def get_balance_sheet(as_of_date: datetime.date = None) -> dict:
    """
    Generates a full Balance Sheet (Assets = Liabilities + Equity) as of a given date.
    Defaults to today if no date is provided.

    Structure:
        Assets:
            - Current Assets  (asset accounts)
        Liabilities:
            - Current Liabilities (liability accounts)
        Equity:
            - Owner's Equity + Retained Earnings (equity + net income)
    """
    if not as_of_date:
        as_of_date = datetime.date.today()

    date_filter = Q(
        transaction__status='posted',
        transaction__timestamp__date__lte=as_of_date
    )

    accounts = Account.objects.filter(is_active=True).order_by('code')

    assets = []
    liabilities = []
    equity = []
    total_assets = Decimal('0.00')
    total_liabilities = Decimal('0.00')
    total_equity = Decimal('0.00')
    total_revenue = Decimal('0.00')
    total_expenses = Decimal('0.00')

    for acc in accounts:
        agg = Entry.objects.filter(date_filter, account=acc).aggregate(
            d=Sum('debit'), c=Sum('credit')
        )
        debits = agg['d'] or Decimal('0.00')
        credits = agg['c'] or Decimal('0.00')

        if acc.type in ('asset', 'expense'):
            balance = debits - credits
        else:
            balance = credits - debits

        row = {"code": acc.code, "name": acc.name, "balance": balance}

        if acc.type == 'asset':
            assets.append(row)
            total_assets += balance
        elif acc.type == 'liability':
            liabilities.append(row)
            total_liabilities += balance
        elif acc.type == 'equity':
            equity.append(row)
            total_equity += balance
        elif acc.type == 'revenue':
            total_revenue += balance
        elif acc.type == 'expense':
            total_expenses += balance

    net_income = total_revenue - total_expenses
    retained_earnings = net_income  # Simplified: net income flows into equity

    return {
        "as_of_date": str(as_of_date),
        "assets": {
            "lines": assets,
            "total": total_assets,
        },
        "liabilities": {
            "lines": liabilities,
            "total": total_liabilities,
        },
        "equity": {
            "lines": equity,
            "retained_earnings": retained_earnings,
            "total": total_equity + retained_earnings,
        },
        "total_liabilities_and_equity": total_liabilities + total_equity + retained_earnings,
        "is_balanced": abs(total_assets - (total_liabilities + total_equity + retained_earnings)) < Decimal('0.01'),
    }


# ============================================================
# ACCOUNTS RECEIVABLE AGING
# ============================================================

def get_ar_aging() -> dict:
    """
    Generates an AR Aging report showing outstanding order balances bucketed by age.

    Buckets: Current (0-30d), 31-60d, 61-90d, 90d+

    Reads directly from the Order model — unpaid or partially paid orders
    are treated as outstanding receivables.
    """
    from apps.orders.models import Order
    import datetime

    today = datetime.date.today()

    # Only consider orders with outstanding balances
    open_orders = Order.objects.filter(
        payment_status__in=['unpaid', 'partially_paid', 'pending_verification']
    ).select_related('user').prefetch_related('payments')

    buckets = {
        'current_0_30': [],
        'days_31_60': [],
        'days_61_90': [],
        'days_91_plus': [],
    }

    totals = {
        'current_0_30': Decimal('0.00'),
        'days_31_60': Decimal('0.00'),
        'days_61_90': Decimal('0.00'),
        'days_91_plus': Decimal('0.00'),
        'grand_total': Decimal('0.00'),
    }

    for order in open_orders:
        paid = sum(p.amount for p in order.payments.filter(status='paid'))
        outstanding = order.total_amount - paid
        if outstanding <= Decimal('0.00'):
            continue

        age_days = (today - order.created_at.date()).days
        row = {
            "order_number": order.order_number or str(order.id),
            "customer": order.shipping_name or "N/A",
            "order_date": str(order.created_at.date()),
            "age_days": age_days,
            "total_amount": order.total_amount,
            "paid_amount": paid,
            "outstanding": outstanding,
        }

        if age_days <= 30:
            buckets['current_0_30'].append(row)
            totals['current_0_30'] += outstanding
        elif age_days <= 60:
            buckets['days_31_60'].append(row)
            totals['days_31_60'] += outstanding
        elif age_days <= 90:
            buckets['days_61_90'].append(row)
            totals['days_61_90'] += outstanding
        else:
            buckets['days_91_plus'].append(row)
            totals['days_91_plus'] += outstanding

        totals['grand_total'] += outstanding

    return {
        "as_of_date": str(today),
        "buckets": buckets,
        "totals": totals,
        "summary": {
            "total_open_orders": len(open_orders),
            "total_outstanding": totals['grand_total'],
        }
    }


# ============================================================
# CASH FLOW STATEMENT
# ============================================================

def get_cash_flow_statement(
    start_date: datetime.date = None,
    end_date: datetime.date = None
) -> dict:
    """
    Generates a Cash Flow Statement for a given period.
    Defaults to the current month.

    Sections:
      Operating:  Cash from/to sales, expenses, and day-to-day operations
      Investing:  Cash from/to asset purchases (account type=asset, non-cash)
      Financing:  Cash from/to equity injections, loans (liability/equity accounts)

    Logic: Tracks movement of cash by looking at all entries
    where the counterpart account determines the flow category.
    """
    if not start_date:
        today = datetime.date.today()
        start_date = today.replace(day=1)
    if not end_date:
        end_date = datetime.date.today()

    date_filter = Q(
        transaction__status='posted',
        transaction__timestamp__date__gte=start_date,
        transaction__timestamp__date__lte=end_date
    )

    # --- OPERATING: Revenue & Expense accounts ---
    revenue_accs = Account.objects.filter(type='revenue', is_active=True)
    expense_accs = Account.objects.filter(type='expense', is_active=True)

    operating_inflows = []
    operating_outflows = []
    total_operating_in = Decimal('0.00')
    total_operating_out = Decimal('0.00')

    for acc in revenue_accs:
        agg = Entry.objects.filter(date_filter, account=acc).aggregate(
            d=Sum('debit'), c=Sum('credit')
        )
        net = (agg['c'] or Decimal('0.00')) - (agg['d'] or Decimal('0.00'))
        if net > 0:
            operating_inflows.append({"account": acc.name, "code": acc.code, "amount": net})
            total_operating_in += net

    for acc in expense_accs:
        agg = Entry.objects.filter(date_filter, account=acc).aggregate(
            d=Sum('debit'), c=Sum('credit')
        )
        net = (agg['d'] or Decimal('0.00')) - (agg['c'] or Decimal('0.00'))
        if net > 0:
            operating_outflows.append({"account": acc.name, "code": acc.code, "amount": net})
            total_operating_out += net

    net_operating = total_operating_in - total_operating_out

    # --- INVESTING: Non-cash Asset accounts (e.g. equipment, property) ---
    # We identify these as asset accounts that are NOT cash/AR/inventory
    cash_like_codes = ['1000-CASH', '1100-AR', '1200-INVENTORY']
    investing_accs = Account.objects.filter(
        type='asset', is_active=True
    ).exclude(code__in=cash_like_codes)

    investing_lines = []
    total_investing = Decimal('0.00')

    for acc in investing_accs:
        agg = Entry.objects.filter(date_filter, account=acc).aggregate(
            d=Sum('debit'), c=Sum('credit')
        )
        # Increase in asset = cash used (outflow), decrease = cash received (inflow)
        net = (agg['d'] or Decimal('0.00')) - (agg['c'] or Decimal('0.00'))
        if net != 0:
            investing_lines.append({
                "account": acc.name,
                "code": acc.code,
                "amount": -net,  # Negative = purchase (outflow)
            })
            total_investing += (-net)

    # --- FINANCING: Liability and Equity accounts (loans, equity injections) ---
    financing_accs = Account.objects.filter(type__in=['liability', 'equity'], is_active=True)

    financing_lines = []
    total_financing = Decimal('0.00')

    for acc in financing_accs:
        agg = Entry.objects.filter(date_filter, account=acc).aggregate(
            d=Sum('debit'), c=Sum('credit')
        )
        # Increase in liability/equity = cash received (inflow)
        net = (agg['c'] or Decimal('0.00')) - (agg['d'] or Decimal('0.00'))
        if net != 0:
            financing_lines.append({
                "account": acc.name,
                "code": acc.code,
                "amount": net,
            })
            total_financing += net

    net_change = net_operating + total_investing + total_financing

    return {
        "period_start": str(start_date),
        "period_end": str(end_date),
        "operating": {
            "inflows": operating_inflows,
            "outflows": operating_outflows,
            "total_inflows": total_operating_in,
            "total_outflows": total_operating_out,
            "net": net_operating,
        },
        "investing": {
            "lines": investing_lines,
            "net": total_investing,
        },
        "financing": {
            "lines": financing_lines,
            "net": total_financing,
        },
        "net_cash_change": net_change,
    }
