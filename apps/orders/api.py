# pyright: reportAttributeAccessIssue=false, reportCallIssue=false, reportGeneralTypeIssues=false, reportOperatorIssue=false, reportArgumentType=false
from typing import List, Any, Optional
from decimal import Decimal
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Sum, F, Q
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.orders.models import Order, OrderItem, OrderStatusHistory

from apps.marketing.models import PromoCode, PromoUsageHistory
from apps.orders.services import (
    create_order, record_order_payment, process_return,
)
from apps.core.api import BearerAuth, enforce_permission
from apps.catalog.interfaces import get_variant_details_by_sku


router = Router()
User = get_user_model()

# --- Schemas ---

class OrderItemInputSchema(Schema):
    sku: str
    quantity: int
    price: Optional[Decimal] = None # Override price

class OrderCreateInputSchema(Schema):
    user_id: Optional[int] = None
    customer_name: Optional[str] = ""
    customer_phone: Optional[str] = ""
    customer_email: Optional[str] = ""
    customer_gender: Optional[str] = "unspecified"
    customer_birthdate: Optional[str] = None
    
    items: List[OrderItemInputSchema]
    shipping_name: Optional[str] = ""
    shipping_phone: Optional[str] = ""
    shipping_address: str
    shipping_district: str
    shipping_thana: str
    shipping_postal_code: Optional[str] = ""
    
    promo_code: Optional[str] = ""
    discount_amount: Optional[Decimal] = Decimal('0.00')
    shipping_cost: Optional[Decimal] = Decimal('0.00')
    customer_notes: Optional[str] = ""
    internal_notes: Optional[str] = ""
    issue_status: Optional[str] = "None"
    is_ready: Optional[bool] = False
    
    # Optional payment on creation
    payment_method: Optional[str] = "COD"
    payment_status: Optional[str] = "unpaid"
    payment_reference: Optional[str] = ""
    payment_sender: Optional[str] = ""
    payment_amount: Optional[Decimal] = None

class OrderItemSchema(Schema):
    id: int
    sku: str
    image: Optional[str] = None
    attributes: Optional[dict] = None
    quantity: int
    fulfilled_quantity: int
    returned_quantity: int
    price: Decimal
    fulfillment_status: str

class PaymentSchema(Schema):
    id: int
    amount: Decimal
    method: str
    reference_number: Optional[str] = None
    sender_number: Optional[str] = None
    status: str
    created_at: Any

class ReturnRequestSchema(Schema):
    id: int
    sku: str
    quantity: int
    reason: str
    status: str
    created_at: Any

class OrderStatusHistorySchema(Schema):
    id: int
    status: str
    admin_username: Optional[str] = None
    timestamp: Any
    notes: Optional[str] = None

class OrderResponseSchema(Schema):
    id: int
    created_at: Any
    order_number: Optional[str]
    user_id: int
    customer_name: str
    customer_phone: str
    total_amount: Decimal
    subtotal: Decimal
    discount_amount: Decimal
    shipping_cost: Decimal
    tax_amount: Decimal
    status: str
    payment_status: str
    
    shipping_name: Optional[str]
    shipping_phone: Optional[str]
    shipping_address: str
    shipping_district: Optional[str]
    shipping_thana: Optional[str]
    shipping_postal_code: Optional[str]
    
    tracking_number: Optional[str] = None
    courier_status: Optional[str] = None
    customer_notes: Optional[str] = None
    internal_notes: Optional[str] = None
    issue_status: Optional[str] = "None"
    is_ready: Optional[bool] = False
    
    risk_level: str
    risk_reasons: List[str]
    
    items: List[OrderItemSchema]
    payments: List[PaymentSchema] = []
    returns: List[ReturnRequestSchema] = []
    status_history: List[OrderStatusHistorySchema] = []
    created_at: Any

class PaginatedOrdersResponse(Schema):
    count: int
    results: List[OrderResponseSchema]

class RecordPaymentInputSchema(Schema):
    amount: Decimal
    method: str
    reference_number: Optional[str] = ""
    sender_number: Optional[str] = ""

class ProcessReturnInputSchema(Schema):
    sku: str
    quantity: int
    reason: str

class OrderStatusUpdateSchema(Schema):
    status: str
    notes: Optional[str] = ""

class OrderNotesUpdateSchema(Schema):
    internal_notes: Optional[str] = ""

# --- Helper Functions ---

def compile_order_response(order: Order, sku_to_details: dict = None) -> dict:
    if sku_to_details is None:
        sku_to_details = {}
    items = [{
        "id": item.id,
        "sku": item.sku,
        "image": sku_to_details.get(item.sku, {}).get("image"),
        "attributes": sku_to_details.get(item.sku, {}).get("attributes"),
        "quantity": item.quantity,
        "fulfilled_quantity": item.fulfilled_quantity,
        "returned_quantity": item.returned_quantity,
        "price": item.price,
        "fulfillment_status": item.fulfillment_status
    } for item in order.items.all()]

    payments = [{
        "id": p.id,
        "amount": p.amount,
        "method": p.method,
        "reference_number": p.reference_number,
        "sender_number": p.sender_number,
        "status": p.status,
        "created_at": p.created_at
    } for p in order.payments.all()]

    returns = [{
        "id": r.id,
        "sku": r.sku,
        "quantity": r.quantity,
        "reason": r.reason,
        "status": r.status,
        "created_at": r.created_at
    } for r in order.returns.all()]

    history = [{
        "id": h.id,
        "status": h.status,
        "admin_username": h.admin_username,
        "timestamp": h.timestamp,
        "notes": h.notes
    } for h in order.status_history.all()]

    return {
        "id": order.id,
        "created_at": order.created_at,
        "order_number": order.order_number,
        "user_id": order.user_id,
        "customer_name": order.user.username,
        "customer_phone": order.user.crm_profile.phone if hasattr(order.user, 'crm_profile') else "",
        "total_amount": order.total_amount,
        "subtotal": order.subtotal,
        "discount_amount": order.discount_amount,
        "shipping_cost": order.shipping_cost,
        "tax_amount": order.tax_amount,
        "status": order.status,
        "payment_status": order.payment_status,
        "shipping_name": order.shipping_name,
        "shipping_phone": order.shipping_phone,
        "shipping_address": order.shipping_address,
        "shipping_district": order.shipping_district,
        "shipping_thana": order.shipping_thana,
        "shipping_postal_code": order.shipping_postal_code,
        "tracking_number": order.tracking_number,
        "courier_status": order.courier_status,
        "customer_notes": order.customer_notes,
        "internal_notes": order.internal_notes,
        "issue_status": getattr(order, 'issue_status', 'None'),
        "is_ready": getattr(order, 'is_ready', False),
        "risk_level": order.risk_level,
        "risk_reasons": order.risk_reasons or [],
        "items": items,
        "payments": payments,
        "returns": returns,
        "status_history": history,
        "created_at": order.created_at
    }

# --- REST Endpoints ---

@router.get("/counts", auth=BearerAuth())
def get_order_counts(request):
    """Returns the count of orders for each status."""
    enforce_permission(request, "orders", "view_orders")
    
    counts = {}
    total_all = 0
    statuses = [s[0] for s in Order.ORDER_STATUS_CHOICES]
    
    # Query all counts in one go for efficiency if possible, or just iterate
    for status in statuses:
        count = Order.objects.filter(status=status).count()
        counts[status] = count
        total_all += count
        
    counts["all"] = total_all
    return counts

@router.get("", response=PaginatedOrdersResponse, auth=BearerAuth())
def list_orders(
    request,
    search: Optional[str] = None,
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    courier: Optional[str] = None,
    payment_method: Optional[str] = None,
    page: int = 1,
    limit: int = 10
):
    """List orders with advanced filtering, search, and pagination (Admin only)."""
    enforce_permission(request, "orders", "view_orders")
    qs = Order.objects.prefetch_related('items', 'payments', 'returns', 'status_history').select_related('user').all()

    if search:
        qs = qs.filter(
            Q(order_number__icontains=search) |
            Q(user__username__icontains=search) |
            Q(shipping_phone__icontains=search)
        ).distinct()

    if status:
        qs = qs.filter(status=status)
    if payment_status:
        qs = qs.filter(payment_status=payment_status)
    if payment_method:
        qs = qs.filter(payments__method__icontains=payment_method)
    if courier:
        if courier == "steadfast":
            qs = qs.filter(tracking_number__isnull=False).exclude(tracking_number="")
        else:
            qs = qs.filter(tracking_number__icontains=courier)

    total_count = qs.count()

    # Pagination slicing
    start = (page - 1) * limit
    end = start + limit
    paginated_qs = qs.order_by('-created_at')[start:end]

    # Bulk fetch images and attributes for SKUs
    all_skus = set()
    for o in paginated_qs:
        for i in o.items.all():
            all_skus.add(i.sku)
            
    sku_to_details = {}
    if all_skus:
        from apps.catalog.models import ProductVariant
        variants = ProductVariant.objects.filter(sku__in=all_skus).select_related('image', 'product').prefetch_related('product__images')
        for v in variants:
            image_url = None
            if v.image and v.image.image:
                image_url = v.image.image.url
            else:
                prod_images = list(v.product.images.all())
                if prod_images:
                    main_img = next((img for img in prod_images if img.is_main), prod_images[0])
                    if main_img.image:
                        image_url = main_img.image.url
                        
            sku_to_details[v.sku] = {
                "image": image_url,
                "attributes": v.attributes
            }

    results = [compile_order_response(o, sku_to_details) for o in paginated_qs]
    return {"count": total_count, "results": results}


@router.get("/customers", auth=BearerAuth())
def list_customers_endpoint(request, search: Optional[str] = None):
    """Search registered customers database for manual order lookup (Admin only)."""
    enforce_permission(request, "orders", "view_orders")
    qs = User.objects.filter(role='customer')
    if search:
        qs = qs.filter(Q(username__icontains=search) | Q(email__icontains=search))
        
    from apps.crm.models import CustomerProfile
    results = []
    for u in qs[:20]:
        profile = CustomerProfile.objects.filter(user=u).first()
        results.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "phone": profile.phone if profile else "",
            "district": profile.district.name if profile and profile.district else "",
            "thana": profile.thana.name if profile and profile.thana else "",
            "address": profile.address if profile else ""
        })
    return results


@router.get("/{int:order_id}", response=OrderResponseSchema, auth=BearerAuth())
def get_order_endpoint(request, order_id: int):
    """Retrieve details, payments, returns, and timeline updates of an order."""
    order = get_object_or_404(Order, id=order_id)
    user = request.auth
    
    # Customers can only see their own orders; staff can see all
    if user.role == 'customer' and order.user_id != user.id:
        raise HttpError(403, "Forbidden: You do not own this order.")
        
    return compile_order_response(order)

def resolve_or_create_customer(user, data: OrderCreateInputSchema, user_id_override: Optional[int] = None):
    from django.apps import apps
    import uuid
    CustomerProfile = apps.get_model('crm', 'CustomerProfile')
    
    final_phone = data.shipping_phone or data.customer_phone
    if user and hasattr(user, 'crm_profile') and user.crm_profile.phone and not user.crm_profile.phone.startswith('email_'):
        final_phone = final_phone or user.crm_profile.phone
        
    if not final_phone and not user_id_override:
        raise ValidationError("A valid phone number is mandatory to place an order.")

    u_id = user_id_override or (user.id if user else None)
    resolved_user = user
    
    # If admin provided a specific user_id, just fetch it
    if u_id:
        resolved_user = User.objects.filter(id=u_id).first()
        if not resolved_user:
            raise ValidationError("Provided customer does not exist.")
            
    if not u_id:
        # 1. Match by phone
        existing_profile = CustomerProfile.objects.filter(phone=final_phone).first()
        if existing_profile:
            resolved_user = existing_profile.user
            u_id = resolved_user.id
        else:
            # 2. Match by email
            if data.customer_email:
                resolved_user = User.objects.filter(email=data.customer_email).first()
                if resolved_user:
                    u_id = resolved_user.id
            
            # 3. Create new user
            if not u_id and data.customer_name:
                email_val = data.customer_email or f"{uuid.uuid4().hex[:8]}@poshplex-guest.com"
                base_username = data.customer_name.replace(" ", "").lower() or "guest"
                username_val = base_username
                if User.objects.filter(username=username_val).exists():
                    username_val = f"{base_username}_{uuid.uuid4().hex[:4]}"
                    
                resolved_user = User.objects.create_user(
                    username=username_val,
                    email=email_val,
                    password=uuid.uuid4().hex,
                    role='customer'
                )
                u_id = resolved_user.id

    if not u_id:
        raise ValidationError("Please provide customer lookup or create a new customer.")
        
    # Sync Profile
    profile, _ = CustomerProfile.objects.get_or_create(user=resolved_user)
    
    if final_phone and (not profile.phone or profile.phone.startswith('email_')):
        profile.phone = final_phone
    elif data.customer_phone and not profile.phone.startswith('email_'):
        profile.phone = data.customer_phone
            
    if data.shipping_address:
        profile.address = data.shipping_address
    if data.customer_gender and data.customer_gender != "unspecified":
        profile.gender = data.customer_gender
    if data.customer_birthdate:
        profile.birthdate = data.customer_birthdate
    profile.save()
    
    return u_id, final_phone

@router.post("", response=OrderResponseSchema, auth=BearerAuth())
def post_order_endpoint(request, data: OrderCreateInputSchema):
    """Place a new sales order manually on behalf of a customer (Admin/CS only)."""
    enforce_permission(request, "orders", "edit_orders")
    
    try:
        with transaction.atomic():
            u_id, final_phone = resolve_or_create_customer(None, data, user_id_override=data.user_id)

            items_list = [item.dict() for item in data.items]

            order = create_order(
                user_id=u_id,
                items_data=items_list,
                shipping_address=data.shipping_address,
                shipping_name=data.shipping_name,
                shipping_phone=data.shipping_phone,
                shipping_district=data.shipping_district,
                shipping_thana=data.shipping_thana,
                shipping_postal_code=data.shipping_postal_code,
                discount_amount=data.discount_amount,
                shipping_cost=data.shipping_cost,
                customer_notes=data.customer_notes,
                internal_notes=data.internal_notes
            )
            
            # If a promo code was provided manually by the admin, track its usage.
            if data.promo_code:
                try:
                    promo = PromoCode.objects.get(code=data.promo_code.upper().strip(), is_active=True)
                    PromoUsageHistory.objects.create(
                        promo_code=promo,
                        order_id=order.id,
                        customer_phone=data.customer_phone or "",
                        discount_applied=data.discount_amount
                    )
                    PromoCode.objects.filter(id=promo.id).update(usage_count=F('usage_count') + 1)
                except PromoCode.DoesNotExist:
                    pass # Silently ignore invalid promo codes in admin manual entry
            
            # Handle initial payment (partial or full)
            if data.payment_amount is not None and data.payment_amount > 0:
                record_order_payment(
                    order_id=order.id,
                    amount=data.payment_amount,
                    method=data.payment_method or "Cash",
                    reference_number=data.payment_reference,
                    sender_number=data.payment_sender
                )
            elif data.payment_status == 'paid' and order.total_amount > 0:
                record_order_payment(
                    order_id=order.id,
                    amount=order.total_amount,
                    method=data.payment_method or "Cash",
                    reference_number=data.payment_reference,
                    sender_number=data.payment_sender
                )
                
            return compile_order_response(order)
            
    except ValidationError as ve:
        raise HttpError(400, ve.messages[0] if hasattr(ve, 'messages') else str(ve))
    except Exception as e:
        raise HttpError(400, str(e))

@router.post("/checkout", response=OrderResponseSchema)
def customer_checkout_endpoint(request, data: OrderCreateInputSchema):
    """Public customer checkout endpoint to place their own orders."""
    user = request.user if request.user.is_authenticated else None
    
    try:
        with transaction.atomic():
            u_id, final_phone = resolve_or_create_customer(user, data)

            items_list = [item.dict() for item in data.items]

            # Secure Backend Promo Calculation
            subtotal = sum(Decimal(str(item.price)) * int(item.quantity) for item in data.items)
            final_discount_amount = Decimal('0.00')
            applied_promo = None
            
            if data.promo_code:
                try:
                    promo = PromoCode.objects.get(code=data.promo_code.upper().strip(), is_active=True)
                    from django.utils import timezone
                    now = timezone.now()
                    is_valid = True
                    
                    if promo.starts_at and now < promo.starts_at: is_valid = False
                    if promo.expires_at and now > promo.expires_at: is_valid = False
                    if subtotal < promo.min_order_amount: is_valid = False
                    if promo.total_usage_limit and promo.usage_count >= promo.total_usage_limit: is_valid = False
                    
                    # Check customer limit
                    if final_phone:
                        usage_count = PromoUsageHistory.objects.filter(promo_code=promo, customer_phone=final_phone).count()
                        if usage_count >= promo.per_customer_limit: is_valid = False
                        
                    if is_valid:
                        if promo.reward_type == 'percent':
                            final_discount_amount = subtotal * (promo.discount_value / Decimal('100.00'))
                            if promo.max_discount_amount and final_discount_amount > promo.max_discount_amount:
                                final_discount_amount = promo.max_discount_amount
                        elif promo.reward_type == 'fixed':
                            final_discount_amount = promo.discount_value
                        elif promo.reward_type == 'freeship':
                            final_discount_amount = data.shipping_cost
                        applied_promo = promo
                except PromoCode.DoesNotExist:
                    pass

            order = create_order(
                user_id=u_id,
                items_data=items_list,
                shipping_address=data.shipping_address,
                shipping_name=data.shipping_name or data.customer_name,
                shipping_phone=data.shipping_phone or data.customer_phone,
                shipping_district=data.shipping_district,
                shipping_thana=data.shipping_thana,
                shipping_postal_code=data.shipping_postal_code,
                discount_amount=final_discount_amount,
                shipping_cost=data.shipping_cost,
                customer_notes=data.customer_notes,
                internal_notes=data.internal_notes
            )
            
            # Save promo usage history
            if applied_promo:
                PromoUsageHistory.objects.create(
                    promo_code=applied_promo,
                    order_id=order.id,
                    customer_phone=final_phone or "",
                    discount_applied=final_discount_amount
                )
                PromoCode.objects.filter(id=applied_promo.id).update(usage_count=F('usage_count') + 1)
            
            # Handle initial payment (partial or full)
            if data.payment_amount is not None and data.payment_amount > 0:
                record_order_payment(
                    order_id=order.id,
                    amount=data.payment_amount,
                    method=data.payment_method or "Cash",
                    reference_number=data.payment_reference,
                    sender_number=data.payment_sender
                )
            elif data.payment_status == 'paid' and order.total_amount > 0:
                record_order_payment(
                    order_id=order.id,
                    amount=order.total_amount,
                    method=data.payment_method or "Cash",
                    reference_number=data.payment_reference,
                    sender_number=data.payment_sender
                )
                
            # Dispatch automated notification
            from apps.core.tasks import send_automated_notification
            send_automated_notification.delay(
                event_type="order",
                context={
                    "username": order.shipping_name,
                    "order_id": order.order_number,
                    "total_amount": str(order.total_amount),
                    "phone": order.shipping_phone,
                    "email": user.email if user else (existing_user.email if 'existing_user' in locals() and existing_user else "")
                }
            )
                
            return compile_order_response(order)
            
    except ValidationError as ve:
        raise HttpError(400, ve.messages[0] if hasattr(ve, 'messages') else str(ve))
    except Exception as e:
        raise HttpError(400, str(e))

@router.patch("/{int:order_id}/notes", response=OrderResponseSchema, auth=BearerAuth())
def update_order_notes_endpoint(request, order_id: int, data: OrderNotesUpdateSchema):
    """Quickly update order internal notes (call notes)."""
    enforce_permission(request, "orders", "edit_orders")
    order = get_object_or_404(Order, id=order_id)
    order.internal_notes = data.internal_notes
    order.save(update_fields=["internal_notes"])
    return compile_order_response(order)

@router.put("/{int:order_id}", response=OrderResponseSchema, auth=BearerAuth())
def update_order_endpoint(request, order_id: int, data: OrderCreateInputSchema):
    """Edit order recipient details, shipping address, or line items (Admin only)."""
    enforce_permission(request, "orders", "edit_orders")
    order = get_object_or_404(Order, id=order_id)
    
    try:
        with transaction.atomic():
            order.shipping_name = data.shipping_name or order.shipping_name
            order.shipping_phone = data.shipping_phone or order.shipping_phone
            order.shipping_address = data.shipping_address
            order.shipping_district = data.shipping_district or order.shipping_district
            order.shipping_thana = data.shipping_thana or order.shipping_thana
            order.shipping_postal_code = data.shipping_postal_code or order.shipping_postal_code
            order.discount_amount = data.discount_amount
            order.shipping_cost = data.shipping_cost
            order.customer_notes = data.customer_notes
            order.internal_notes = data.internal_notes
            if hasattr(data, 'issue_status'):
                order.issue_status = data.issue_status
            if hasattr(data, 'is_ready'):
                order.is_ready = data.is_ready
            
            # Recalculate subtotal
            subtotal = Decimal('0.00')
            order.items.all().delete()
            for item in data.items:
                catalog_info = get_variant_details_by_sku(item.sku)
                if not catalog_info:
                    raise ValidationError(f"Product variant SKU '{item.sku}' not found.")
                
                unit_price = item.price if item.price is not None else Decimal(str(catalog_info["price"]))
                line_total = unit_price * item.quantity
                subtotal += line_total
                
                OrderItem.objects.create(
                    order=order,
                    sku=item.sku,
                    quantity=item.quantity,
                    price=unit_price
                )
                
            order.subtotal = subtotal
            order.total_amount = max(Decimal('0.00'), subtotal + order.shipping_cost - order.discount_amount)
            
            # Log edit action in history
            OrderStatusHistory.objects.create(
                order=order,
                status=order.status,
                admin_username=request.auth.username,
                notes="Order lines or shipping coordinates edited manually."
            )
            order.save()
            return compile_order_response(order)
            
    except ValidationError as ve:
        raise HttpError(400, ve.messages[0] if hasattr(ve, 'messages') else str(ve))
    except Exception as e:
        raise HttpError(400, str(e))

@router.delete("/{int:order_id}", auth=BearerAuth())
def delete_order_endpoint(request, order_id: int):
    """Delete order with cascading cleanups across payments and history logs (Admin only)."""
    enforce_permission(request, "orders", "edit_orders")
    order = get_object_or_404(Order, id=order_id)
    try:
        # Payments delete triggers ledger entry reversals automatically
        order.delete()
        return {"success": True}
    except Exception as e:
        raise HttpError(400, str(e))

# Action Routes

@router.put("/{int:order_id}/status", response=OrderResponseSchema, auth=BearerAuth())
def update_order_status(request, order_id: int, data: OrderStatusUpdateSchema):
    """Manually update an order's status and add a note."""
    enforce_permission(request, "orders", "edit_orders")
    order = get_object_or_404(Order, id=order_id)
    try:
        old_status = order.status
        order.status = data.status
        order.save(update_fields=['status'])
        
        OrderStatusHistory.objects.create(
            order=order,
            status=order.status,
            admin_username=request.auth.username,
            notes=data.notes or f"Status changed manually from {old_status} to {data.status}."
        )
        return compile_order_response(order)
    except Exception as e:
        raise HttpError(400, str(e))

@router.post("/{int:order_id}/payments", response=OrderResponseSchema, auth=BearerAuth())
def record_payment_endpoint(request, order_id: int, data: RecordPaymentInputSchema):
    """Record manual payment allocations against orders, posting entries to ledger (Admin only)."""
    enforce_permission(request, "orders", "edit_orders")
    try:
        record_order_payment(
            order_id=order_id,
            amount=data.amount,
            method=data.method,
            reference_number=data.reference_number,
            sender_number=data.sender_number
        )
        order = Order.objects.get(id=order_id)
        
        # Log payment timeline history
        OrderStatusHistory.objects.create(
            order=order,
            status=order.status,
            admin_username=request.auth.username,
            notes=f"Recorded payment of ${data.amount} via {data.method}."
        )
        return compile_order_response(order)
    except Exception as e:
        raise HttpError(400, str(e))

@router.post("/{int:order_id}/ship", response=OrderResponseSchema, auth=BearerAuth())
def ship_order_endpoint(request, order_id: int):
    """Pushes consignment details to Steadfast Courier and stores tracking numbers (Admin only)."""
    enforce_permission(request, "orders", "edit_orders")
    try:
        from apps.orders.tasks import dispatch_order_to_steadfast_task
        # Run synchronously so the frontend gets the tracking number immediately
        dispatch_order_to_steadfast_task(order_id)
        order = Order.objects.get(id=order_id)
        return compile_order_response(order)
    except Exception as e:
        raise HttpError(400, str(e))

@router.delete("/{int:order_id}/ship", response=OrderResponseSchema, auth=BearerAuth())
def remove_shipment_endpoint(request, order_id: int):
    """Removes the Steadfast Courier consignment locally and reverts order status."""
    enforce_permission(request, "orders", "edit_orders")
    try:
        order = Order.objects.get(id=order_id)
        order.tracking_number = None
        order.courier_consignment_id = None
        order.courier_name = None
        order.courier_status = None
        order.status = 'placed'
        order.save()
        OrderStatusHistory.objects.create(
            order=order,
            status='placed',
            admin_username=request.auth.username,
            notes="Courier consignment deleted locally. Reverted to Placed status."
        )
        return compile_order_response(order)
    except Exception as e:
        raise HttpError(400, str(e))

@router.post("/{int:order_id}/sync-courier", response=OrderResponseSchema, auth=BearerAuth())
def sync_courier_endpoint(request, order_id: int):
    """Enqueues a Steadfast status sync in the background (non-blocking)."""
    enforce_permission(request, "orders", "edit_orders")
    try:
        from apps.orders.tasks import sync_steadfast_status_task
        sync_steadfast_status_task.delay(order_id)
        order = Order.objects.get(id=order_id)
        return compile_order_response(order)
    except Exception as e:
        raise HttpError(400, str(e))

@router.post("/sync-couriers", auth=BearerAuth())
def sync_all_couriers_endpoint(request):
    """Enqueues sync for all shipped/pending orders."""
    enforce_permission(request, "orders", "edit_orders")
    try:
        from apps.orders.tasks import sync_steadfast_status_task
        # Sync orders that have tracking number and are not delivered/cancelled/returned
        orders_to_sync = Order.objects.exclude(status__in=['delivered', 'cancelled', 'returned']).exclude(tracking_number__isnull=True).exclude(tracking_number='')
        for o in orders_to_sync:
            sync_steadfast_status_task.delay(o.id)
        return {"success": True, "count": orders_to_sync.count()}
    except Exception as e:
        raise HttpError(400, str(e))

@router.post("/bulk-sync-courier", auth=BearerAuth())
def bulk_sync_courier_endpoint(request, order_ids: List[int]):
    """Sync delivery status in bulk for multiple orders (Admin only)."""
    enforce_permission(request, "orders", "edit_orders")
    updated_count = 0
    skipped_count = 0
    failed_count = 0
    errors = []
    
    from apps.orders.services import sync_steadfast_status
    
    for o_id in order_ids:
        try:
            order = Order.objects.get(id=o_id)
            old_status = order.status
            new_status = sync_steadfast_status(o_id)
            
            # Since sync_steadfast_status updates the object in-place,
            # we consider it updated if the status changed.
            # (Note: it could also change payment_status, so if they want strictly status changes:)
            # Actually, sync_steadfast_status saves to DB, so we reload to check.
            order.refresh_from_db()
            if old_status != order.status:
                updated_count += 1
            else:
                skipped_count += 1
        except Exception as e:
            failed_count += 1
            errors.append({"order_id": o_id, "error": str(e)})
            
    return {
        "success": True,
        "updated": updated_count,
        "skipped": skipped_count,
        "failed": failed_count,
        "errors": errors
    }

@router.post("/{int:order_id}/returns", response=OrderResponseSchema, auth=BearerAuth())
def process_return_endpoint(request, order_id: int, data: ProcessReturnInputSchema):
    """Creates a return entry for specific items, refunding matching ledger entries (Admin only)."""
    enforce_permission(request, "orders", "edit_orders")
    try:
        process_return(
            order_id=order_id,
            sku=data.sku,
            quantity=data.quantity,
            reason=data.reason
        )
        order = Order.objects.get(id=order_id)
        OrderStatusHistory.objects.create(
            order=order,
            status=order.status,
            admin_username=request.auth.username,
            notes=f"Processed return request for {data.sku} x {data.quantity}."
        )
        return compile_order_response(order)
    except ValidationError as ve:
        raise HttpError(400, ve.messages[0] if hasattr(ve, 'messages') else str(ve))
    except Exception as e:
        raise HttpError(400, str(e))

# Location Metadata Endpoint

@router.get("/shipping-locations/rates")
def list_shipping_locations_rates(request):
    """Returns the district-thana location tree with corresponding delivery rates."""
    return {
        "districts": [
            {
                "name": "Dhaka",
                "shipping_cost": 120,
                "thanas": ["Banani", "Gulshan", "Dhanmondi", "Uttara", "Mirpur"]
            },
            {
                "name": "Chittagong",
                "shipping_cost": 240,
                "thanas": ["Panchlaish", "Double Mooring", "Halishahar", "Nasirabad"]
            },
            {
                "name": "Sylhet",
                "shipping_cost": 240,
                "thanas": ["Zindabazar", "Ambarkhana", "Uposhahar"]
            }
        ]
    }

# --- Payment Method & COD Approval API Endpoints ---
from apps.finance.models import BankAccount
from apps.orders.services import reconcile_cod_payment

class PaymentMethodResponseSchema(Schema):
    id: int
    name: str
    type: str
    instructions: Optional[str] = None
    account_details: dict
    is_active: bool
    sort_order: int

class CODApprovalInputSchema(Schema):
    amount_collected: Decimal
    notes: Optional[str] = ""

@router.get("/fulfillment/queue", response=PaginatedOrdersResponse, auth=BearerAuth())
def list_fulfillment_queue(
    request,
    search: Optional[str] = None,
    status: Optional[str] = None,
    courier: Optional[str] = None,
    payment_method: Optional[str] = None,
    sort_by: Optional[str] = "-created_at",
    page: int = 1,
    limit: int = 10
):
    """List orders in the active processing queue (excluding Delivered, Cancelled, Returned, RTO)"""
    enforce_permission(request, "orders", "view_orders")
    
    active_statuses = ['placed', 'review', 'pending', 'approval_pending']
    qs = Order.objects.filter(status__in=active_statuses).prefetch_related('items', 'payments', 'returns', 'status_history').select_related('user')
    
    if status:
        qs = qs.filter(status=status)
    if search:
        qs = qs.filter(
            Q(order_number__icontains=search) |
            Q(user__username__icontains=search) |
            Q(shipping_phone__icontains=search)
        ).distinct()
    if payment_method:
        qs = qs.filter(payments__method__icontains=payment_method)
    if courier:
        if courier == "steadfast":
            qs = qs.filter(tracking_number__isnull=False).exclude(tracking_number="")
        else:
            qs = qs.filter(tracking_number__icontains=courier)
            
    if sort_by in ["created_at", "-created_at", "total_amount", "-total_amount"]:
        qs = qs.order_by(sort_by)
    else:
        qs = qs.order_by("-created_at")
        
    total_count = qs.count()
    start = (page - 1) * limit
    end = start + limit
    paginated_qs = qs[start:end]
    # Bulk fetch images and attributes for SKUs
    all_skus = set()
    for o in paginated_qs:
        for i in o.items.all():
            all_skus.add(i.sku)
            
    sku_to_details = {}
    if all_skus:
        from apps.catalog.models import ProductVariant
        variants = ProductVariant.objects.filter(sku__in=all_skus).select_related('image', 'product').prefetch_related('product__images')
        for v in variants:
            image_url = None
            if v.image and v.image.image:
                image_url = v.image.image.url
            else:
                prod_images = list(v.product.images.all())
                if prod_images:
                    main_img = next((img for img in prod_images if img.is_main), prod_images[0])
                    if main_img.image:
                        image_url = main_img.image.url
                        
            sku_to_details[v.sku] = {
                "image": image_url,
                "attributes": v.attributes
            }

    results = [compile_order_response(o, sku_to_details) for o in paginated_qs]
    return {"count": total_count, "results": results}

@router.post("/{int:order_id}/cod-approve", response=OrderResponseSchema, auth=BearerAuth())
def cod_approve_endpoint(request, order_id: int, data: CODApprovalInputSchema):
    """Approves COD collection and updates status, syncing with the ledger (Admin only)."""
    enforce_permission(request, "orders", "edit_orders")
    try:
        order = reconcile_cod_payment(
            order_id=order_id,
            amount_collected=data.amount_collected,
            approver_username=request.auth.username,
            notes=data.notes
        )
        return compile_order_response(order)
    except Exception as e:
        raise HttpError(400, str(e))

@router.get("/payments/methods", response=List[PaymentMethodResponseSchema])
def list_public_payment_methods(request):
    """Public list of active payment options for Checkout page."""
    # We map BankAccounts to what the storefront expects for checkout
    methods = BankAccount.objects.filter(is_active=True).order_by('id')
    
    mapped_methods = []
    for m in methods:
        # Map internal bank account types to storefront types (cod, mobile, bank)
        mapped_type = "bank"
        if m.account_type == "mobile_banking":
            mapped_type = "mobile"
        elif m.account_type == "cash":
            mapped_type = "cod"
            
        mapped_methods.append({
            "id": m.id,
            "name": m.name,
            "type": mapped_type,
            "instructions": m.notes or "",
            "account_details": {
                "provider": m.provider,
                "account_number": m.account_number
            },
            "is_active": m.is_active,
            "sort_order": m.id
        })
    return mapped_methods

# --- Districts & Thanas CRUD Endpoints ---
from apps.orders.models import District, Thana

class DistrictInputSchema(Schema):
    name: str
    is_active: Optional[bool] = True

class DistrictResponseSchema(Schema):
    id: int
    name: str
    is_active: bool

class ThanaInputSchema(Schema):
    district_id: int
    name: str
    shipping_cost: Decimal
    is_active: Optional[bool] = True

class ThanaResponseSchema(Schema):
    id: int
    district_id: int
    district_name: str
    name: str
    shipping_cost: Decimal
    is_active: bool

@router.get("/locations/districts", response=List[DistrictResponseSchema])
def list_districts(request):
    """List all districts (Divisions)."""
    return list(District.objects.all().order_by('name'))

@router.post("/locations/districts", response=DistrictResponseSchema, auth=BearerAuth())
def create_district(request, data: DistrictInputSchema):
    """Create a new shipping district (Admin only)."""
    enforce_permission(request, "orders", "edit_orders")
    try:
        dist = District.objects.create(name=data.name, is_active=data.is_active)
        return dist
    except Exception as e:
        raise HttpError(400, str(e))

@router.put("/locations/districts/{int:district_id}", response=DistrictResponseSchema, auth=BearerAuth())
def update_district(request, district_id: int, data: DistrictInputSchema):
    """Update details of a district (Admin only)."""
    enforce_permission(request, "orders", "edit_orders")
    dist = get_object_or_404(District, id=district_id)
    try:
        dist.name = data.name
        dist.is_active = data.is_active
        dist.save()
        return dist
    except Exception as e:
        raise HttpError(400, str(e))

@router.delete("/locations/districts/{int:district_id}", auth=BearerAuth())
def delete_district(request, district_id: int):
    """Delete a district. Referential protected (Admin only)."""
    enforce_permission(request, "orders", "edit_orders")
    dist = get_object_or_404(District, id=district_id)
    try:
        dist.delete()
        return {"success": True}
    except ValidationError as ve:
        raise HttpError(400, str(ve))
    except Exception as e:
        raise HttpError(400, str(e))

@router.get("/locations/thanas", response=List[ThanaResponseSchema])
def list_thanas(request, district_id: Optional[int] = None):
    """List thanas with optional district filter."""
    qs = Thana.objects.select_related('district').all().order_by('name')
    if district_id:
        qs = qs.filter(district_id=district_id)
    
    return [{
        "id": t.id,
        "district_id": t.district_id,
        "district_name": t.district.name,
        "name": t.name,
        "shipping_cost": t.shipping_cost,
        "is_active": t.is_active
    } for t in qs]

@router.post("/locations/thanas", response=ThanaResponseSchema, auth=BearerAuth())
def create_thana(request, data: ThanaInputSchema):
    """Create a new delivery thana/upazila (Admin only)."""
    enforce_permission(request, "orders", "edit_orders")
    dist = get_object_or_404(District, id=data.district_id)
    try:
        t = Thana.objects.create(
            district=dist,
            name=data.name,
            shipping_cost=data.shipping_cost,
            is_active=data.is_active
        )
        return {
            "id": t.id,
            "district_id": t.district_id,
            "district_name": t.district.name,
            "name": t.name,
            "shipping_cost": t.shipping_cost,
            "is_active": t.is_active
        }
    except Exception as e:
        raise HttpError(400, str(e))

@router.put("/locations/thanas/{int:thana_id}", response=ThanaResponseSchema, auth=BearerAuth())
def update_thana(request, thana_id: int, data: ThanaInputSchema):
    """Update thana details (Admin only)."""
    enforce_permission(request, "orders", "edit_orders")
    t = get_object_or_404(Thana, id=thana_id)
    dist = get_object_or_404(District, id=data.district_id)
    try:
        t.district = dist
        t.name = data.name
        t.shipping_cost = data.shipping_cost
        t.is_active = data.is_active
        t.save()
        return {
            "id": t.id,
            "district_id": t.district_id,
            "district_name": t.district.name,
            "name": t.name,
            "shipping_cost": t.shipping_cost,
            "is_active": t.is_active
        }
    except Exception as e:
        raise HttpError(400, str(e))

@router.delete("/locations/thanas/{int:thana_id}", auth=BearerAuth())
def delete_thana(request, thana_id: int):
    """Delete a thana. Checked for attached customers/orders (Admin only)."""
    enforce_permission(request, "orders", "edit_orders")
    t = get_object_or_404(Thana, id=thana_id)
    try:
        t.delete()
        return {"success": True}
    except ValidationError as ve:
        raise HttpError(400, str(ve))
    except Exception as e:
        raise HttpError(400, str(e))





@router.get("/my-orders", response=List[OrderResponseSchema], auth=BearerAuth())
def get_my_orders(request):
    """Retrieve all orders placed by the authenticated customer."""
    user = request.auth
    qs = Order.objects.filter(user=user).prefetch_related('items', 'payments', 'returns', 'status_history')
    return [compile_order_response(o) for o in qs.order_by('-created_at')]
