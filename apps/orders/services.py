from decimal import Decimal
from django.db import transaction, models
from django.core.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model

from apps.orders.models import Order, OrderItem, OrderStatusHistory, Payment, ReturnRequest
from apps.catalog.interfaces import get_variant_details_by_sku
from apps.finance.interfaces import record_sales_revenue, record_order_refund
from apps.crm.interfaces import get_customer_contact_info

User = get_user_model()

def calculate_order_risk(order: Order) -> tuple[str, list[str]]:
    """
    Evaluates order attributes to calculate risk score level:
    - Mismatched phone numbers
    - High value COD (> $800)
    - Repeat cancellation (2+ cancelled orders)
    """
    reasons = []
    level = 'low'
    
    user_phone = getattr(order.user, 'phone', None)
    if user_phone and order.shipping_phone and user_phone != order.shipping_phone:
        reasons.append("Phone mismatch: User profile phone differs from shipping phone.")
        
    # Check if COD
    is_cod = not order.payments.filter(status='paid').exists()
    if is_cod and order.total_amount > Decimal('800.00'):
        reasons.append("High value Cash on Delivery (COD) order (> $800).")
        
    cancelled_count = Order.objects.filter(user=order.user, status='cancelled').count()
    if cancelled_count >= 2:
        reasons.append(f"User profile has {cancelled_count} past cancelled orders.")
        
    if len(reasons) >= 2:
        level = 'high'
    elif len(reasons) == 1:
        level = 'medium'
        
    return level, reasons

@transaction.atomic
def create_order(
    user_id: int, 
    items_data: list[dict], 
    shipping_address: str,
    shipping_name: str = "",
    shipping_phone: str = "",
    shipping_district: str = "",
    shipping_thana: str = "",
    shipping_postal_code: str = "",
    discount_amount: Decimal = Decimal('0.00'),
    shipping_cost: Decimal = Decimal('0.00'),
    customer_notes: str = "",
    internal_notes: str = ""
) -> Order:
    """
    Creates an order, resolves pricing via Catalog interfaces, and saves line items.
    """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        raise ValidationError(f"User with ID {user_id} does not exist.")

    if not items_data:
        raise ValidationError("An order must contain at least one item.")

    order = Order.objects.create(
        user=user,
        shipping_address=shipping_address,
        shipping_name=shipping_name or user.username,
        shipping_phone=shipping_phone or getattr(user, 'phone', ''),
        shipping_district=shipping_district,
        shipping_thana=shipping_thana,
        shipping_postal_code=shipping_postal_code,
        discount_amount=discount_amount,
        shipping_cost=shipping_cost,
        customer_notes=customer_notes,
        internal_notes=internal_notes,
        status='placed',
        payment_status='unpaid'
    )

    subtotal = Decimal('0.00')

    for item in items_data:
        sku = item.get("sku")
        quantity = int(item.get("quantity", 1))
        
        # Resolve pricing
        catalog_info = get_variant_details_by_sku(sku)
        if not catalog_info:
            raise ValidationError(f"Product variant SKU '{sku}' is not available in the catalog.")
            
        # Admin can override price; otherwise default to catalog price
        override_price = item.get("price")
        unit_price = Decimal(str(override_price)) if override_price is not None else Decimal(str(catalog_info["price"]))
        
        line_total = unit_price * quantity
        subtotal += line_total
        
        OrderItem.objects.create(
            order=order,
            sku=sku,
            quantity=quantity,
            price=unit_price,
            fulfillment_status='pending'
        )

    order.subtotal = subtotal
    # grand_total = subtotal + shipping - discount
    order.total_amount = max(Decimal('0.00'), subtotal + shipping_cost - discount_amount)
    
    # Calculate Risk Flags
    risk_level, risk_reasons = calculate_order_risk(order)
    order.risk_level = risk_level
    order.risk_reasons = risk_reasons
    
    order.save()

    # Log initial status history
    OrderStatusHistory.objects.create(
        order=order,
        status='placed',
        notes="Order placed in workflow."
    )

    # Fire initial placed notification asynchronously
    try:
        contact = get_customer_contact_info(user.id)
        sms_msg = f"Your Poshplex order #{order.order_number} for {order.total_amount} has been placed successfully."
        from apps.integration.tasks import send_customer_sms_task
        send_customer_sms_task.delay(contact.get("phone", ""), sms_msg)
    except Exception:
        pass

    return order

@transaction.atomic
def record_order_payment(
    order_id: int, 
    amount: Decimal, 
    method: str, 
    reference_number: str = None, 
    sender_number: str = None
) -> Payment:
    """
    Records a payment against an order and posts a double-entry ledger entry.
    """
    order = Order.objects.get(id=order_id)
    
    payment = Payment.objects.create(
        order=order,
        amount=amount,
        method=method,
        reference_number=reference_number,
        sender_number=sender_number,
        status='paid'
    )
    
    # Post ledger transaction
    try:
        tx_id = record_sales_revenue(
            order_id=str(order.id),
            amount=amount,
            payment_method=method
        )
        payment.ledger_entry_id = tx_id
        payment.save()
    except Exception:
        pass
        
    # Re-calculate totals and update payment_status
    total_paid = order.payments.filter(status='paid').aggregate(total=models.Sum('amount'))['total'] or Decimal('0.00')
    if total_paid >= order.total_amount:
        order.payment_status = 'paid'
        # Auto advance status to Review or Pending once paid if still placed
        if order.status == 'placed':
            order.status = 'review'
    elif total_paid > 0:
        order.payment_status = 'partially_paid'
    else:
        order.payment_status = 'unpaid'
    order.save()
    
    return payment

@transaction.atomic
def process_return(order_id: int, sku: str, quantity: int, reason: str) -> ReturnRequest:
    """
    Creates a return request, updates item-level returned quantities, and posts refund.
    """
    order = Order.objects.get(id=order_id)
    item = get_object_or_404(OrderItem, order=order, sku=sku)
    
    if item.returned_quantity + quantity > item.quantity:
        raise ValidationError(f"Cannot return more than purchased. Purchased: {item.quantity}, Already Returned: {item.returned_quantity}")
        
    ret = ReturnRequest.objects.create(
        order=order,
        sku=sku,
        quantity=quantity,
        reason=reason,
        status='approved'
    )
    
    # Update item fulfillment
    item.returned_quantity += quantity
    if item.returned_quantity == item.quantity:
        item.fulfillment_status = 'returned'
    item.save()
    
    # Calculate refund total amount
    refund_val = item.price * quantity
    
    # Log refund in ledger
    try:
        record_order_refund(order_id=str(order.id), amount=refund_val)
    except Exception:
        pass
        
    # Set order status to returned if all items returned
    total_items = order.items.aggregate(total=models.Sum('quantity'))['total'] or 0
    total_returned = order.items.aggregate(total=models.Sum('returned_quantity'))['total'] or 0
    if total_returned >= total_items:
        order.status = 'returned'
        order.payment_status = 'refunded'
    order.save()
    
    return ret



def sync_steadfast_status(order_id: int) -> str:
    """
    Syncs Steadfast delivery status, updating database states and audit timeline.
    """
    import requests
    order = Order.objects.get(id=order_id)
    if not order.tracking_number:
        return "pending"
        
    if order.tracking_number.startswith("ST-"):
        # Mock status auto-advance to Delivered
        order.courier_status = "delivered"
        order.status = "delivered"
        order.payment_status = "paid"
        order.save()
        return "delivered"
        
    headers = {
        "Api-Key": os.environ.get("STEADFAST_API_KEY", ""),
        "Secret-Key": os.environ.get("STEADFAST_SECRET_KEY", ""),
        "Content-Type": "application/json"
    }
    
    try:
        res = requests.get(
            f"https://portal.packzy.com/api/v1/status_by_trackingcode/{order.tracking_number}",
            headers=headers,
            timeout=10
        )
        if res.status_code == 200:
            data = res.json()
            if "delivery_status" in data:
                status = data["delivery_status"]
                order.courier_status = status
                
                # Check status changes mappings
                if status == "delivered":
                    order.status = "delivered"
                    order.payment_status = "paid"
                    OrderStatusHistory.objects.create(order=order, status="delivered", notes="Delivered by Steadfast.")
                elif status == "cancelled":
                    order.status = "cancelled"
                    OrderStatusHistory.objects.create(order=order, status="cancelled", notes="Cancelled by Steadfast.")
                elif status == "returned":
                    order.status = "returned"
                    OrderStatusHistory.objects.create(order=order, status="returned", notes="Returned to sender by Steadfast.")
                
                order.save()
                return status
    except Exception:
        pass
        
    return order.courier_status or "pending"



@transaction.atomic
def reconcile_cod_payment(order_id: int, amount_collected: Decimal, approver_username: str, notes: str = None) -> Order:
    """
    Approves COD collections, records a payment flow, and resolves ledger balances.
    """
    from apps.orders.models import CODApprovalLog
    order = Order.objects.get(id=order_id)
    
    # 1. Record payment entry (which will automatically sync with double-entry Ledger)
    record_order_payment(
        order_id=order.id,
        amount=amount_collected,
        method="COD",
        reference_number=f"COD-APP-{order.order_number}",
        sender_number="courier"
    )
    
    # 2. Log COD approval log
    CODApprovalLog.objects.create(
        order=order,
        amount_collected=amount_collected,
        approver_username=approver_username,
        notes=notes
    )
    
    # 3. Mark order as Delivered and Paid
    order.status = 'delivered'
    order.payment_status = 'paid'
    order.save()
    
    # 4. Log status timeline history
    OrderStatusHistory.objects.create(
        order=order,
        status='delivered',
        admin_username=approver_username,
        notes=f"COD Amount of ${amount_collected} approved and reconciled. Order marked as Delivered."
    )
    
    return order
