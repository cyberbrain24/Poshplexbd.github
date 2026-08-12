from django.shortcuts import get_object_or_404
from apps.orders.models import Order

def get_order_status(order_id: int) -> str:
    """Public interface to lookup the status of an order."""
    order = get_object_or_404(Order, id=order_id)
    return order.status
