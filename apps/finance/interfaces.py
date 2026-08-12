"""
apps.finance.interfaces
=======================
Automated ledger integration layer.

This module exposes clean, side-effect-driven functions that other apps
(apps.orders, apps.catalog, etc.) call to record financial events.

The double-entry mappings follow standard retail accounting:

  SALE:
    DR  1100-AR          (Accounts Receivable — what the customer owes us)
    CR  4000-SALES       (Revenue — recognized on order creation)

  PAYMENT RECEIVED:
    DR  1000-CASH        (Cash/Bank — payment collected)
    CR  1100-AR          (Accounts Receivable — clears the receivable)

  COGS (Cost of Goods Sold):
    DR  5000-COGS        (Expense — cost of the product sold)
    CR  1200-INVENTORY   (Inventory Asset — inventory consumed)

  REFUND:
    Reversal of the above using void_transaction()
"""
from decimal import Decimal
from apps.finance.services import record_transaction, void_transaction


def record_sale(order_id: str, amount: Decimal, cogs_amount: Decimal = None) -> None:
    """
    Called by apps.orders when a new order is confirmed.
    Records both the revenue recognition and COGS entries.
    """
    # 1. Revenue Recognition: DR Accounts Receivable, CR Sales Revenue
    record_transaction(
        description=f"Sale — Order #{order_id}",
        reference_id=f"ORDER-{order_id}",
        entries_data=[
            {"account_code": "1100-AR", "debit": str(amount), "credit": "0.00", "memo": f"Order #{order_id}"},
            {"account_code": "4000-SALES", "debit": "0.00", "credit": str(amount), "memo": f"Revenue: Order #{order_id}"},
        ]
    )

    # 2. COGS: DR Cost of Goods Sold, CR Inventory (if cost provided)
    if cogs_amount and cogs_amount > 0:
        record_transaction(
            description=f"COGS — Order #{order_id}",
            reference_id=f"COGS-{order_id}",
            entries_data=[
                {"account_code": "5000-COGS", "debit": str(cogs_amount), "credit": "0.00", "memo": f"COGS: Order #{order_id}"},
                {"account_code": "1200-INVENTORY", "debit": "0.00", "credit": str(cogs_amount), "memo": f"Inventory consumed: Order #{order_id}"},
            ]
        )


def record_payment_received(order_id: str, amount: Decimal) -> None:
    """
    Called by apps.orders when a payment is confirmed.
    Clears the Accounts Receivable and moves cash to the bank account.
    """
    record_transaction(
        description=f"Payment Received — Order #{order_id}",
        reference_id=f"PAY-{order_id}",
        entries_data=[
            {"account_code": "1000-CASH", "debit": str(amount), "credit": "0.00", "memo": f"Payment: Order #{order_id}"},
            {"account_code": "1100-AR", "debit": "0.00", "credit": str(amount), "memo": f"AR cleared: Order #{order_id}"},
        ]
    )


def record_refund(original_transaction_id: int, reason: str) -> None:
    """
    Called by apps.orders when a return/refund is approved.
    Reverses the original sale transaction using the immutable void/reversal service.
    """
    void_transaction(transaction_id=original_transaction_id, reason=reason)


def record_expense(description: str, amount: Decimal, expense_account_code: str, reference_id: str = None) -> None:
    """
    Generic expense entry. Used for operational costs (shipping, ads, etc.).
    DR Expense Account, CR Cash.
    """
    record_transaction(
        description=description,
        reference_id=reference_id,
        entries_data=[
            {"account_code": expense_account_code, "debit": str(amount), "credit": "0.00"},
            {"account_code": "1000-CASH", "debit": "0.00", "credit": str(amount)},
        ]
    )


def record_sales_revenue(order_id: str, amount: Decimal, payment_method: str = "") -> int:
    """
    Called by apps.orders when a payment is received.
    Records payment received for a given order (DR 1000-CASH, CR 1100-AR).
    Returns the transaction ID.
    """
    tx = record_transaction(
        description=f"Payment Received — Order #{order_id}",
        reference_id=f"PAY-{order_id}",
        entries_data=[
            {"account_code": "1000-CASH", "debit": str(amount), "credit": "0.00", "memo": f"Payment: Order #{order_id} via {payment_method}"},
            {"account_code": "1100-AR", "debit": "0.00", "credit": str(amount), "memo": f"AR cleared: Order #{order_id}"},
        ]
    )
    return tx.id


def record_order_refund(order_id: str, amount: Decimal) -> int:
    """
    Called by apps.orders when a return/refund is approved.
    Records a return/refund of an order (DR 4000-SALES, CR 1000-CASH).
    Returns the transaction ID.
    """
    tx = record_transaction(
        description=f"Refund — Order #{order_id}",
        reference_id=f"REFUND-{order_id}",
        entries_data=[
            {"account_code": "4000-SALES", "debit": str(amount), "credit": "0.00", "memo": f"Refund: Order #{order_id}"},
            {"account_code": "1000-CASH", "debit": "0.00", "credit": str(amount), "memo": f"Refund: Order #{order_id}"},
        ]
    )
    return tx.id
