import os
import requests
import logging
from celery import shared_task
from django.db import transaction

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def dispatch_order_to_steadfast_task(self, order_id: int):
    """
    Background task to dispatch order to Steadfast API.
    Retries up to 3 times (5 minutes apart) if API is offline.
    """
    from apps.orders.models import Order, OrderStatusHistory
    
    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        logger.error(f"Order {order_id} not found for Steadfast dispatch.")
        return

    cod_amount = float(order.total_amount)
    if order.payment_status == 'paid':
        cod_amount = 0.0

    payload = {
        "invoice": order.order_number,
        "recipient_name": order.shipping_name or order.user.username,
        "recipient_phone": order.shipping_phone or "01700000000",
        "recipient_address": order.shipping_address,
        "cod_amount": cod_amount,
        "note": order.customer_notes or "Delivery from Poshplex"
    }

    headers = {
        "Api-Key": os.environ.get("STEADFAST_API_KEY", ""),
        "Secret-Key": os.environ.get("STEADFAST_SECRET_KEY", ""),
        "Content-Type": "application/json"
    }

    try:
        res = requests.post(
            "https://portal.packzy.com/api/v1/create_order",
            json=payload,
            headers=headers,
            timeout=10
        )
        if res.status_code == 200:
            data = res.json()
            if data.get("status") == 200 and "consignment" in data:
                cons = data["consignment"]
                order.tracking_number = cons.get("tracking_code")
                order.courier_status = cons.get("status", "pending")
                order.status = 'approval_pending' # Shipped status
                order.save()
                
                # Log status history
                OrderStatusHistory.objects.create(
                    order=order,
                    status='approval_pending',
                    notes=f"Dispatched to Steadfast Courier via Celery. Consignment: {order.tracking_number}"
                )
                return True
            else:
                raise Exception(data.get("message", "API response error"))
        else:
            raise Exception(f"HTTP Error {res.status_code}")
    except Exception as exc:
        logger.error(f"Steadfast API failure for order {order_id}. Retrying... Error: {exc}")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2, default_retry_delay=120)
def sync_steadfast_status_task(self, order_id: int):
    """
    Background task to sync Steadfast delivery status.
    Runs asynchronously so the admin API never blocks on external HTTP calls.
    """
    from apps.orders.services import sync_steadfast_status
    try:
        return sync_steadfast_status(order_id)
    except Exception as exc:
        logger.error(f"Steadfast sync failure for order {order_id}. Retrying... Error: {exc}")
        raise self.retry(exc=exc)
