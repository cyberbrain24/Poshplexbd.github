import os
import requests
import logging
from celery import shared_task

import re

logger = logging.getLogger(__name__)

def normalize_phone_for_steadfast(phone: str) -> str:
    """
    Strips international codes and ensures 11 digits starting with 01.
    """
    if not phone:
        return "01700000000"
    
    digits = re.sub(r'\D', '', phone)
    
    if digits.startswith('8801') and len(digits) == 13:
        digits = digits[2:]
    elif digits.startswith('008801') and len(digits) == 15:
        digits = digits[4:]
        
    if digits.startswith('01') and len(digits) == 11:
        return digits
        
    return "01700000000"

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

    raw_phone = order.shipping_phone or (order.user.crm_profile.phone if hasattr(order.user, 'crm_profile') else "")
    formatted_phone = normalize_phone_for_steadfast(raw_phone)

    payload = {
        "invoice": order.order_number,
        "recipient_name": order.shipping_name or order.user.username,
        "recipient_phone": formatted_phone,
        "recipient_address": f"District: {order.shipping_district}, Thana: {order.shipping_thana}, {order.shipping_address}",
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
                order.courier_consignment_id = cons.get("consignment_id")
                order.courier_name = "Steadfast"
                order.courier_status = cons.get("status", "in_review")
                order.status = 'review' # Shipped status
                order.save()
                
                # Log status history
                OrderStatusHistory.objects.create(
                    order=order,
                    status='review',
                    notes=f"Dispatched to Steadfast Courier. Consignment: {order.courier_consignment_id}, Tracking: {order.tracking_number}"
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

@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def generate_invoice_pdf_task(self, order_id: int):
    """
    Background task to generate a PDF invoice for an order.
    Offloads heavy I/O and CPU rendering from the web threads.
    """
    import os
    from django.conf import settings
    from apps.orders.models import Order
    from reportlab.pdfgen import canvas
    
    try:
        order = Order.objects.get(id=order_id)
        # Setup path
        invoices_dir = os.path.join(settings.MEDIA_ROOT, 'invoices')
        os.makedirs(invoices_dir, exist_ok=True)
        pdf_path = os.path.join(invoices_dir, f"{order.order_number}.pdf")
        
        # Extremely basic PDF generation for demo purposes
        c = canvas.Canvas(pdf_path)
        c.drawString(100, 750, f"Invoice for Order: {order.order_number}")
        c.drawString(100, 730, f"Customer: {order.shipping_name}")
        c.drawString(100, 710, f"Total Amount: {order.total_amount}")
        c.save()
        
        return pdf_path
    except Exception as exc:
        logger.error(f"Failed to generate PDF for order {order_id}: {exc}")
        raise self.retry(exc=exc)
