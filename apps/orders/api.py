# pyright: reportAttributeAccessIssue=false, reportCallIssue=false, reportGeneralTypeIssues=false, reportOperatorIssue=false, reportArgumentType=false
import re
from typing import List, Any, Optional, Dict
from decimal import Decimal
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Sum, F, Q, Count
from django.utils import timezone
from datetime import timedelta
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.orders.models import Order, OrderItem, OrderStatusHistory, District, Thana, AbandonedCheckout

from apps.marketing.models import PromoCode, PromoUsageHistory
from apps.marketing.services.promo_targeting import evaluate_promo_code_for_items
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
    shipping_address: Optional[str] = ""
    shipping_district: str
    shipping_thana: str
    shipping_postal_code: Optional[str] = ""
    
    promo_code: Optional[str] = ""
    discount_amount: Optional[Decimal] = Decimal('0.00')
    shipping_cost: Optional[Decimal] = Decimal('0.00')
    customer_notes: Optional[str] = ""
    internal_notes: Optional[str] = ""
    status: Optional[str] = None
    issue_status: Optional[str] = "None"
    is_ready: Optional[bool] = False
    is_print_ready: Optional[bool] = False
    is_urgent: Optional[bool] = False
    
    # Optional payment on creation
    payment_method: Optional[str] = "COD"
    payment_status: Optional[str] = "unpaid"
    payment_reference: Optional[str] = ""
    payment_sender: Optional[str] = ""
    payment_amount: Optional[Decimal] = None
    checkout_session_token: Optional[str] = None
    
    # Customer Data & Attribution Platform parameters
    visitor_id: Optional[str] = None
    session_id: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_content: Optional[str] = None
    campaign_id: Optional[str] = None
    ad_id: Optional[str] = None
    fbc: Optional[str] = None
    fbp: Optional[str] = None

class OrderItemSchema(Schema):
    id: int
    sku: str
    product_name: Optional[str] = None
    image: Optional[str] = None
    attributes: Optional[dict] = None
    quantity: int
    fulfilled_quantity: int
    returned_quantity: int
    price: Decimal
    fulfillment_status: str
    return_reason: Optional[str] = None
    rejection_notes: Optional[str] = None

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
    courier_consignment_id: Optional[str] = None
    courier_status: Optional[str] = None
    customer_notes: Optional[str] = None
    internal_notes: Optional[str] = None
    issue_status: Optional[str] = "None"
    is_ready: Optional[bool] = False
    is_print_ready: Optional[bool] = False
    is_urgent: Optional[bool] = False
    
    # OrderPulse Analytics fields
    delay_reason: Optional[str] = None
    delay_notes: Optional[str] = None
    cancellation_reason: Optional[str] = None
    cancellation_type: Optional[str] = None
    delay_hours: Optional[int] = 0
    is_delayed: Optional[bool] = False
    
    risk_level: str
    risk_reasons: List[str]
    delivery_risk_data: Optional[Dict[str, Any]] = None
    
    items: List[OrderItemSchema]
    payments: List[PaymentSchema] = []
    returns: List[ReturnRequestSchema] = []
    status_history: List[OrderStatusHistorySchema] = []
    created_at: Any

class PaginatedOrdersResponse(Schema):
    count: int
    results: List[OrderResponseSchema]

class OrderPulseUpdateSchema(Schema):
    delay_reason: Optional[str] = None
    delay_notes: Optional[str] = None
    cancellation_reason: Optional[str] = None
    cancellation_type: Optional[str] = None
    internal_notes: Optional[str] = None

class PartialSplitItemSchema(Schema):
    item_id: int
    fulfilled_quantity: int
    returned_quantity: int
    return_reason: Optional[str] = None
    rejection_notes: Optional[str] = None

class PartialSplitInputSchema(Schema):
    items: List[PartialSplitItemSchema]
    notes: Optional[str] = None

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

def build_sku_to_details(skus: set) -> dict:
    sku_to_details = {}
    if not skus:
        return sku_to_details
        
    from apps.catalog.models import ProductVariant, Product
    
    # 1. Fetch variants
    variants = ProductVariant.objects.filter(sku__in=skus).select_related('image', 'product').prefetch_related('product__images')
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
            "attributes": v.attributes,
            "product_name": v.product.name if v.product else None
        }
        
    # 2. Fetch simple products for remaining SKUs
    remaining_skus = skus - set(sku_to_details.keys())
    if remaining_skus:
        products = Product.objects.filter(sku__in=remaining_skus).prefetch_related('images')
        for p in products:
            image_url = None
            prod_images = list(p.images.all())
            if prod_images:
                main_img = next((img for img in prod_images if img.is_main), prod_images[0])
                if main_img.image:
                    image_url = main_img.image.url
            sku_to_details[p.sku] = {
                "image": image_url,
                "attributes": {},
                "product_name": p.name
            }
            
    return sku_to_details

def compile_order_response(order: Order, sku_to_details: dict = None) -> dict:
    if sku_to_details is None:
        skus = {item.sku for item in order.items.all()}
        sku_to_details = build_sku_to_details(skus)
    items = [{
        "id": item.id,
        "sku": item.sku,
        "product_name": sku_to_details.get(item.sku, {}).get("product_name"),
        "image": sku_to_details.get(item.sku, {}).get("image"),
        "attributes": sku_to_details.get(item.sku, {}).get("attributes"),
        "quantity": item.quantity,
        "fulfilled_quantity": item.fulfilled_quantity,
        "returned_quantity": item.returned_quantity,
        "price": item.price,
        "fulfillment_status": item.fulfillment_status,
        "return_reason": getattr(item, 'return_reason', None),
        "rejection_notes": getattr(item, 'rejection_notes', None),
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

    # Calculate delay metrics - strictly for 'placed' & 'review' orders beyond 24h
    is_unshipped = order.status in ['placed', 'review']
    delay_hours = 0
    is_delayed = False
    if order.created_at and is_unshipped:
        delta = timezone.now() - order.created_at
        delay_hours = max(0, int(delta.total_seconds() // 3600))
        is_delayed = (delay_hours >= 24)

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
        "courier_consignment_id": order.courier_consignment_id,
        "courier_status": order.courier_status,
        "customer_notes": order.customer_notes,
        "internal_notes": order.internal_notes,
        "issue_status": getattr(order, 'issue_status', 'None'),
        "is_ready": getattr(order, 'is_ready', False),
        "is_print_ready": getattr(order, 'is_print_ready', False),
        "is_urgent": getattr(order, 'is_urgent', False),
        "delay_reason": getattr(order, 'delay_reason', None),
        "delay_notes": getattr(order, 'delay_notes', None),
        "cancellation_reason": getattr(order, 'cancellation_reason', None),
        "cancellation_type": getattr(order, 'cancellation_type', None),
        "delay_hours": delay_hours,
        "is_delayed": is_delayed,
        "risk_level": order.risk_level,
        "risk_reasons": order.risk_reasons or [],
        "delivery_risk_data": order.delivery_risk_data if order.status == 'placed' else None,
        "items": items,
        "payments": payments,
        "returns": returns,
        "status_history": history
    }

# --- REST Endpoints ---

@router.get("/counts", auth=BearerAuth())
def get_order_counts(request):
    """Returns the count of orders for each status."""
    enforce_permission(request, "orders", "view_orders")
    
    counts = {}
    total_all = 0
    statuses = [s[0] for s in Order.ORDER_STATUS_CHOICES]
    
    for status in statuses:
        count = Order.objects.filter(status=status).count()
        counts[status] = count
        total_all += count
        
    counts["all"] = total_all
    
    # OrderPulse: Delayed (>24h unshipped) count strictly for 'placed' and 'review'
    cutoff_24h = timezone.now() - timedelta(hours=24)
    counts["delayed"] = Order.objects.filter(
        status__in=['placed', 'review'],
        created_at__lt=cutoff_24h
    ).count()

    return counts

@router.get("/analytics/pulse", auth=BearerAuth())
def get_orderpulse_analytics(request):
    """Aggregates high-impact analytics for Hub Delays, Cancellations, and Partial Deliveries."""
    enforce_permission(request, "orders", "view_orders")
    
    now = timezone.now()
    cutoff_24h = now - timedelta(hours=24)
    cutoff_48h = now - timedelta(hours=48)
    cutoff_72h = now - timedelta(hours=72)
    
    total_orders = Order.objects.count()
    unshipped_statuses = ['placed', 'review']
    
    # 1. Hub Delayed Orders breakdown
    delayed_qs = Order.objects.filter(status__in=unshipped_statuses, created_at__lt=cutoff_24h)
    delayed_count = delayed_qs.count()
    
    # Aging buckets
    aging_24_to_48 = Order.objects.filter(status__in=unshipped_statuses, created_at__lt=cutoff_24h, created_at__gte=cutoff_48h).count()
    aging_48_to_72 = Order.objects.filter(status__in=unshipped_statuses, created_at__lt=cutoff_48h, created_at__gte=cutoff_72h).count()
    aging_over_72 = Order.objects.filter(status__in=unshipped_statuses, created_at__lt=cutoff_72h).count()
    
    delay_reasons = {}
    for row in delayed_qs.values('delay_reason').annotate(count=Count('id')).order_by('-count'):
        key = row['delay_reason'] or 'unassigned'
        delay_reasons[key] = row['count']
        
    # 2. Cancellations (Pre-dispatch vs Post-dispatch)
    cancelled_pre_qs = Order.objects.filter(status='manually_cancelled')
    cancelled_post_qs = Order.objects.filter(status__in=['cancelled', 'returned', 'rto'])
    
    cancelled_pre_count = cancelled_pre_qs.count()
    cancelled_post_count = cancelled_post_qs.count()
    
    cancellation_reasons_pre = {}
    for row in cancelled_pre_qs.values('cancellation_reason').annotate(count=Count('id')).order_by('-count'):
        key = row['cancellation_reason'] or 'unassigned'
        cancellation_reasons_pre[key] = row['count']
        
    cancellation_reasons_post = {}
    for row in cancelled_post_qs.values('cancellation_reason').annotate(count=Count('id')).order_by('-count'):
        key = row['cancellation_reason'] or 'unassigned'
        cancellation_reasons_post[key] = row['count']
        
    # 3. Partial Deliveries & SKU return analysis
    partial_qs = Order.objects.filter(status='partially_delivered')
    partial_count = partial_qs.count()
    
    returned_items_qs = OrderItem.objects.filter(
        Q(returned_quantity__gt=0) | Q(order__status__in=['returned', 'rto', 'partially_delivered'])
    )
    
    partial_return_reasons = {}
    for row in returned_items_qs.values('return_reason').annotate(count=Sum('returned_quantity')).order_by('-count'):
        key = row['return_reason'] or 'unassigned'
        partial_return_reasons[key] = row['count'] or 0
        
    # Top returned SKUs for Catalog R&D Matrix
    top_returned_skus = []
    top_skus_raw = (
        returned_items_qs.values('sku')
        .annotate(
            total_returned=Sum('returned_quantity'),
            total_qty=Sum('quantity')
        )
        .order_by('-total_qty')[:15]
    )
    
    from apps.catalog.models import ProductVariant, Product
    for row in top_skus_raw:
        sku = row['sku']
        returned_units = row['total_returned'] if row['total_returned'] and row['total_returned'] > 0 else row['total_qty']
        
        v = ProductVariant.objects.filter(sku=sku).select_related('product', 'image').first()
        prod = v.product if v else Product.objects.filter(sku=sku).first()
        prod_title = prod.name if prod else sku
        
        img = ""
        if v and v.image and v.image.image:
            img = v.image.image.url
        elif prod:
            if hasattr(prod, 'images') and prod.images.exists():
                first_img = prod.images.first()
                img = first_img.image.url if first_img and first_img.image else ""
            elif getattr(prod, 'primary_image', None):
                img = prod.primary_image
        
        primary_reason_row = (
            returned_items_qs.filter(sku=sku)
            .values('return_reason')
            .annotate(cnt=Count('id'))
            .order_by('-cnt')
            .first()
        )
        primary_reason = primary_reason_row['return_reason'] if primary_reason_row else 'unassigned'
        
        top_returned_skus.append({
            "sku": sku,
            "product_name": prod_title,
            "image": img,
            "returned_count": returned_units,
            "primary_reason": primary_reason
        })
        
    return {
        "kpi": {
            "total_orders": total_orders,
            "delayed_hub_count": delayed_count,
            "cancelled_pre_dispatch_count": cancelled_pre_count,
            "cancelled_post_dispatch_count": cancelled_post_count,
            "partially_delivered_count": partial_count
        },
        "delay_aging": {
            "24_to_48h": aging_24_to_48,
            "48_to_72h": aging_48_to_72,
            "over_72h": aging_over_72
        },
        "delay_reasons": delay_reasons,
        "cancellation_reasons_pre": cancellation_reasons_pre,
        "cancellation_reasons_post": cancellation_reasons_post,
        "partial_return_reasons": partial_return_reasons,
        "top_returned_skus": top_returned_skus
    }

@router.get("/analytics/timestamps", auth=BearerAuth())
def get_order_timestamp_analytics(
    request,
    preset: str = "lifetime",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status: Optional[str] = None,
):
    """
    Advanced Order Timestamp Analytics (Admin only).
    Analyzes 24-hour distribution, Day-of-Week shopping patterns,
    Peak Ordering Windows, Dayparts, and a 7x24 Day-by-Hour Heatmap in Asia/Dhaka time.
    """
    enforce_permission(request, "orders", "view_orders")

    import zoneinfo
    from datetime import datetime, time as dtime
    from decimal import Decimal

    dhaka_tz = zoneinfo.ZoneInfo("Asia/Dhaka")
    now_dhaka = timezone.now().astimezone(dhaka_tz)

    qs = Order.objects.all()

    if status and status.lower() != "all":
        qs = qs.filter(status=status.lower())

    # Apply date filters
    selected_preset = preset.lower() if preset else "lifetime"
    period_label = "Lifetime (All Time)"

    if selected_preset == "today":
        start_dt = now_dhaka.replace(hour=0, minute=0, second=0, microsecond=0)
        qs = qs.filter(created_at__gte=start_dt)
        period_label = "Today"
    elif selected_preset == "yesterday":
        yesterday_dhaka = now_dhaka - timedelta(days=1)
        start_dt = yesterday_dhaka.replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = yesterday_dhaka.replace(hour=23, minute=59, second=59, microsecond=999999)
        qs = qs.filter(created_at__gte=start_dt, created_at__lte=end_dt)
        period_label = "Yesterday"
    elif selected_preset == "7d":
        start_dt = now_dhaka - timedelta(days=7)
        qs = qs.filter(created_at__gte=start_dt)
        period_label = "Last 7 Days"
    elif selected_preset == "30d":
        start_dt = now_dhaka - timedelta(days=30)
        qs = qs.filter(created_at__gte=start_dt)
        period_label = "Last 30 Days"
    elif selected_preset == "this_month":
        start_dt = now_dhaka.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        qs = qs.filter(created_at__gte=start_dt)
        period_label = "This Month"
    elif selected_preset == "last_month":
        first_this_month = now_dhaka.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_day_prev_month = first_this_month - timedelta(days=1)
        start_dt = last_day_prev_month.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_dt = last_day_prev_month.replace(hour=23, minute=59, second=59, microsecond=999999)
        qs = qs.filter(created_at__gte=start_dt, created_at__lte=end_dt)
        period_label = "Last Month"
    elif selected_preset == "custom" and start_date and end_date:
        try:
            s_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            e_date = datetime.strptime(end_date, "%Y-%m-%d").date()
            start_dt = datetime.combine(s_date, dtime.min).replace(tzinfo=dhaka_tz)
            end_dt = datetime.combine(e_date, dtime.max).replace(tzinfo=dhaka_tz)
            qs = qs.filter(created_at__gte=start_dt, created_at__lte=end_dt)
            period_label = f"{start_date} to {end_date}"
        except Exception:
            pass

    orders_data = list(qs.values("id", "total_amount", "created_at", "status"))
    total_orders = len(orders_data)
    total_revenue = Decimal("0.00")

    def get_daypart(hour: int) -> str:
        if 0 <= hour < 6:
            return "Late Night"
        elif 6 <= hour < 12:
            return "Morning"
        elif 12 <= hour < 18:
            return "Afternoon"
        else:
            return "Prime Evening"

    def format_12h(hour: int) -> str:
        if hour == 0:
            return "12 AM"
        elif hour < 12:
            return f"{hour} AM"
        elif hour == 12:
            return "12 PM"
        else:
            return f"{hour - 12} PM"

    hourly_stats = []
    for h in range(24):
        hourly_stats.append({
            "hour": h,
            "label_12h": format_12h(h),
            "full_label": f"{format_12h(h)} - {format_12h((h + 1) % 24)}",
            "daypart": get_daypart(h),
            "orders": 0,
            "revenue": Decimal("0.00"),
            "aov": Decimal("0.00"),
            "share_percent": 0.0,
            "is_peak": False,
        })

    day_names = [
        ("Monday", "Mon"),
        ("Tuesday", "Tue"),
        ("Wednesday", "Wed"),
        ("Thursday", "Thu"),
        ("Friday", "Fri"),
        ("Saturday", "Sat"),
        ("Sunday", "Sun")
    ]
    day_stats = []
    for idx, (d_name, d_short) in enumerate(day_names):
        day_stats.append({
            "day_index": idx,
            "day_name": d_name,
            "day_short": d_short,
            "orders": 0,
            "revenue": Decimal("0.00"),
            "aov": Decimal("0.00"),
            "share_percent": 0.0,
            "is_busiest": False,
        })

    heatmap_matrix = [
        [{"orders": 0, "revenue": Decimal("0.00")} for _ in range(24)]
        for _ in range(7)
    ]

    status_counts = {}

    for order in orders_data:
        amt = Decimal(str(order["total_amount"] or 0))
        total_revenue += amt

        st = (order["status"] or "unknown").lower()
        status_counts[st] = status_counts.get(st, 0) + 1

        dt = order["created_at"].astimezone(dhaka_tz)
        h = dt.hour
        w = dt.weekday()

        hourly_stats[h]["orders"] += 1
        hourly_stats[h]["revenue"] += amt

        day_stats[w]["orders"] += 1
        day_stats[w]["revenue"] += amt

        heatmap_matrix[w][h]["orders"] += 1
        heatmap_matrix[w][h]["revenue"] += amt

    max_hour_orders = max([h["orders"] for h in hourly_stats]) if total_orders > 0 else 0
    max_day_orders = max([d["orders"] for d in day_stats]) if total_orders > 0 else 0
    max_matrix_cell_orders = max(
        [heatmap_matrix[w][h]["orders"] for w in range(7) for h in range(24)]
    ) if total_orders > 0 else 0

    for h in hourly_stats:
        if h["orders"] > 0:
            h["aov"] = round(h["revenue"] / h["orders"], 2)
            h["share_percent"] = round((h["orders"] / total_orders) * 100, 2) if total_orders > 0 else 0.0
        h["revenue"] = float(h["revenue"])
        h["aov"] = float(h["aov"])
        h["is_peak"] = (h["orders"] == max_hour_orders and max_hour_orders > 0)

    for d in day_stats:
        if d["orders"] > 0:
            d["aov"] = round(d["revenue"] / d["orders"], 2)
            d["share_percent"] = round((d["orders"] / total_orders) * 100, 2) if total_orders > 0 else 0.0
        d["revenue"] = float(d["revenue"])
        d["aov"] = float(d["aov"])
        d["is_busiest"] = (d["orders"] == max_day_orders and max_day_orders > 0)

    formatted_heatmap = []
    for w in range(7):
        row = []
        for h in range(24):
            c_orders = heatmap_matrix[w][h]["orders"]
            c_rev = float(heatmap_matrix[w][h]["revenue"])
            intensity = round((c_orders / max_matrix_cell_orders) * 100, 1) if max_matrix_cell_orders > 0 else 0
            row.append({
                "day_index": w,
                "day_short": day_names[w][1],
                "hour": h,
                "hour_label": format_12h(h),
                "orders": c_orders,
                "revenue": c_rev,
                "intensity": intensity
            })
        formatted_heatmap.append({
            "day_index": w,
            "day_name": day_names[w][0],
            "day_short": day_names[w][1],
            "hours": row
        })

    dayparts = [
        {"name": "Late Night (12 AM - 6 AM)", "key": "late_night", "orders": 0, "revenue": 0.0, "color": "#818cf8"},
        {"name": "Morning (6 AM - 12 PM)", "key": "morning", "orders": 0, "revenue": 0.0, "color": "#38bdf8"},
        {"name": "Afternoon (12 PM - 6 PM)", "key": "afternoon", "orders": 0, "revenue": 0.0, "color": "#f59e0b"},
        {"name": "Prime Evening (6 PM - 12 AM)", "key": "prime_evening", "orders": 0, "revenue": 0.0, "color": "#ec4899"},
    ]
    for h in hourly_stats:
        part_idx = 0 if h["hour"] < 6 else (1 if h["hour"] < 12 else (2 if h["hour"] < 18 else 3))
        dayparts[part_idx]["orders"] += h["orders"]
        dayparts[part_idx]["revenue"] += h["revenue"]

    for dp in dayparts:
        dp["share_percent"] = round((dp["orders"] / total_orders) * 100, 1) if total_orders > 0 else 0.0
        dp["revenue"] = round(dp["revenue"], 2)

    best_3h_window = {"label": "N/A", "orders": 0, "percentage": 0.0}
    if total_orders > 0:
        max_3h_sum = -1
        best_start = 0
        for i in range(24):
            three_hr_orders = hourly_stats[i]["orders"] + hourly_stats[(i + 1) % 24]["orders"] + hourly_stats[(i + 2) % 24]["orders"]
            if three_hr_orders > max_3h_sum:
                max_3h_sum = three_hr_orders
                best_start = i
        end_hr = (best_start + 3) % 24
        best_3h_window = {
            "label": f"{format_12h(best_start)} - {format_12h(end_hr)}",
            "orders": max_3h_sum,
            "percentage": round((max_3h_sum / total_orders) * 100, 1)
        }

    peak_hour_obj = next((h for h in hourly_stats if h["is_peak"]), None)
    busiest_day_obj = next((d for d in day_stats if d["is_busiest"]), None)

    return {
        "period": {
            "preset": selected_preset,
            "label": period_label,
            "timezone": "Asia/Dhaka (UTC+6)"
        },
        "kpi": {
            "total_orders": total_orders,
            "total_revenue": round(float(total_revenue), 2),
            "avg_order_value": round(float(total_revenue / total_orders), 2) if total_orders > 0 else 0.0,
            "peak_hour": peak_hour_obj,
            "busiest_day": busiest_day_obj,
            "peak_3h_window": best_3h_window
        },
        "hourly_distribution": hourly_stats,
        "day_of_week_distribution": day_stats,
        "dayparts": dayparts,
        "heatmap": formatted_heatmap,
        "status_breakdown": status_counts
    }

@router.get("/analytics/products", auth=BearerAuth())
def get_product_analytics(
    request,
    preset: str = "lifetime",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status: Optional[str] = None,
    category_id: Optional[int] = None,
):
    """
    Advanced Product Intelligence & Market Research Analytics (Admin only).
    Calculates:
    - Best-selling & top revenue-generating products
    - Most ordered & high-volume items (units sold, order frequency)
    - Variant / Size demand distribution (e.g. M vs L vs XL preferences)
    - Category sales performance & revenue shares
    - Product Return & Cancellation risk rates per item
    - Stock inventory velocity & actionable design/production decision insights
    """
    enforce_permission(request, "orders", "view_orders")

    import zoneinfo
    from datetime import datetime, time as dtime
    from decimal import Decimal
    from apps.catalog.models import Product, ProductVariant

    dhaka_tz = zoneinfo.ZoneInfo("Asia/Dhaka")
    now_dhaka = timezone.now().astimezone(dhaka_tz)

    order_qs = Order.objects.all()

    # Filter out cancelled / test orders unless explicitly requested
    if status and status.lower() != "all":
        order_qs = order_qs.filter(status=status.lower())
    else:
        # Default: exclude cancelled / manually_cancelled for sales demand metrics
        # but keep track of them for return / cancellation rate calculations
        pass

    selected_preset = preset.lower() if preset else "lifetime"
    period_label = "Lifetime (All Time)"

    if selected_preset == "today":
        start_dt = now_dhaka.replace(hour=0, minute=0, second=0, microsecond=0)
        order_qs = order_qs.filter(created_at__gte=start_dt)
        period_label = "Today"
    elif selected_preset == "yesterday":
        yesterday_dhaka = now_dhaka - timedelta(days=1)
        start_dt = yesterday_dhaka.replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = yesterday_dhaka.replace(hour=23, minute=59, second=59, microsecond=999999)
        order_qs = order_qs.filter(created_at__gte=start_dt, created_at__lte=end_dt)
        period_label = "Yesterday"
    elif selected_preset == "7d":
        start_dt = now_dhaka - timedelta(days=7)
        order_qs = order_qs.filter(created_at__gte=start_dt)
        period_label = "Last 7 Days"
    elif selected_preset == "30d":
        start_dt = now_dhaka - timedelta(days=30)
        order_qs = order_qs.filter(created_at__gte=start_dt)
        period_label = "Last 30 Days"
    elif selected_preset == "this_month":
        start_dt = now_dhaka.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        order_qs = order_qs.filter(created_at__gte=start_dt)
        period_label = "This Month"
    elif selected_preset == "last_month":
        first_this_month = now_dhaka.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_day_prev_month = first_this_month - timedelta(days=1)
        start_dt = last_day_prev_month.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_dt = last_day_prev_month.replace(hour=23, minute=59, second=59, microsecond=999999)
        order_qs = order_qs.filter(created_at__gte=start_dt, created_at__lte=end_dt)
        period_label = "Last Month"
    elif selected_preset == "custom" and start_date and end_date:
        try:
            s_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            e_date = datetime.strptime(end_date, "%Y-%m-%d").date()
            start_dt = datetime.combine(s_date, dtime.min).replace(tzinfo=dhaka_tz)
            end_dt = datetime.combine(e_date, dtime.max).replace(tzinfo=dhaka_tz)
            order_qs = order_qs.filter(created_at__gte=start_dt, created_at__lte=end_dt)
            period_label = f"{start_date} to {end_date}"
        except Exception:
            pass

    # Filter OrderItems belonging to filtered orders
    item_qs = OrderItem.objects.filter(order__in=order_qs).select_related("order")

    # Prefetch product & variant lookup tables into memory to make execution fast (O(1))
    variant_lookup = {}
    for v in ProductVariant.objects.select_related("product", "product__category").all():
        variant_lookup[v.sku] = v

    product_lookup = {}
    for p in Product.objects.select_related("category").prefetch_related("images").all():
        product_lookup[p.id] = p
        if p.sku:
            product_lookup[p.sku] = p

    # Aggregations
    product_stats = {}  # keyed by product_id or fallback SKU
    size_distribution = {}  # e.g., {'M': 42, 'L': 65, 'XL': 38}
    category_stats = {}  # keyed by category_name
    total_units_sold = 0
    total_product_revenue = Decimal("0.00")
    total_items_count = 0

    for item in item_qs:
        total_items_count += 1
        sku = item.sku
        qty = item.quantity or 0
        price = item.price or Decimal("0.00")
        line_rev = Decimal(qty) * Decimal(str(price))
        is_order_cancelled = item.order.status in ["cancelled", "manually_cancelled"]
        is_order_returned = item.order.status in ["returned", "rto"] or item.returned_quantity > 0

        # Resolve variant and product
        v = variant_lookup.get(sku)
        p = v.product if v else None
        if not p:
            # Fallback to direct product SKU or PROD-<id>
            p = product_lookup.get(sku)
            if not p and sku.startswith("PROD-"):
                try:
                    pid = int(sku.replace("PROD-", ""))
                    p = product_lookup.get(pid)
                except Exception:
                    pass

        # Category filter check
        if category_id:
            p_cat_id = (p.category_id if p else None)
            if p_cat_id != category_id:
                continue

        p_id = p.id if p else f"SKU-{sku}"
        p_name = p.name if p else f"Unknown ({sku})"
        p_slug = p.slug if p else ""
        p_cat_name = (p.category.name if (p and p.category) else "Uncategorized")
        
        # Primary image URL
        p_img = ""
        if p:
            if hasattr(p, "images") and p.images.exists():
                first_img = p.images.first()
                p_img = first_img.image.url if first_img and first_img.image else ""
            elif getattr(p, "primary_image", None):
                p_img = p.primary_image

        if p_id not in product_stats:
            product_stats[p_id] = {
                "product_id": p_id,
                "name": p_name,
                "slug": p_slug,
                "category": p_cat_name,
                "image": p_img,
                "base_price": float(p.base_price or price) if p else float(price),
                "total_units_ordered": 0,
                "total_units_delivered": 0,
                "order_count": 0,
                "revenue": Decimal("0.00"),
                "cancelled_units": 0,
                "returned_units": 0,
                "variants": {},
            }

        prod_record = product_stats[p_id]
        prod_record["total_units_ordered"] += qty
        prod_record["order_count"] += 1
        prod_record["revenue"] += line_rev

        if is_order_cancelled:
            prod_record["cancelled_units"] += qty
        elif is_order_returned:
            prod_record["returned_units"] += (item.returned_quantity or qty)
        else:
            prod_record["total_units_delivered"] += (qty - (item.returned_quantity or 0))

        if not is_order_cancelled:
            total_units_sold += qty
            total_product_revenue += line_rev

        # Extract size / variant attribute
        attrs = v.attributes if (v and isinstance(v.attributes, dict)) else {}
        size_label = attrs.get("size") or attrs.get("Size") or "Standard"
        color_label = attrs.get("color") or attrs.get("Color") or ""
        var_key = f"{size_label} - {color_label}".strip(" -") or sku

        if var_key not in prod_record["variants"]:
            prod_record["variants"][var_key] = {"sku": sku, "units": 0, "size": size_label}
        prod_record["variants"][var_key]["units"] += qty

        if not is_order_cancelled:
            size_distribution[size_label] = size_distribution.get(size_label, 0) + qty

            # Category aggregation
            if p_cat_name not in category_stats:
                category_stats[p_cat_name] = {"category": p_cat_name, "units": 0, "revenue": Decimal("0.00")}
            category_stats[p_cat_name]["units"] += qty
            category_stats[p_cat_name]["revenue"] += line_rev

    # Transform product stats to sorted list
    product_list = []
    for p_id, d in product_stats.items():
        ordered = d["total_units_ordered"]
        cancelled = d["cancelled_units"]
        returned = d["returned_units"]
        return_rate = round((returned / ordered) * 100, 1) if ordered > 0 else 0.0
        cancellation_rate = round((cancelled / ordered) * 100, 1) if ordered > 0 else 0.0
        
        # Sort internal variants
        var_list = sorted(d["variants"].values(), key=lambda x: x["units"], reverse=True)
        top_size = var_list[0]["size"] if var_list else "Standard"

        product_list.append({
            "product_id": d["product_id"],
            "name": d["name"],
            "slug": d["slug"],
            "category": d["category"],
            "image": d["image"],
            "base_price": d["base_price"],
            "total_units_ordered": ordered,
            "total_units_delivered": d["total_units_delivered"],
            "order_count": d["order_count"],
            "revenue": round(float(d["revenue"]), 2),
            "cancelled_units": cancelled,
            "returned_units": returned,
            "return_rate": return_rate,
            "cancellation_rate": cancellation_rate,
            "top_size": top_size,
            "variants": var_list,
        })

    # Sort variations
    best_sellers_by_revenue = sorted(product_list, key=lambda x: x["revenue"], reverse=True)
    most_ordered_by_units = sorted(product_list, key=lambda x: x["total_units_ordered"], reverse=True)
    highest_returned_items = sorted([p for p in product_list if p["returned_units"] > 0], key=lambda x: x["return_rate"], reverse=True)

    # Size breakdown formatted
    formatted_sizes = [
        {"size": k, "units": v, "share": round((v / total_units_sold) * 100, 1) if total_units_sold > 0 else 0.0}
        for k, v in sorted(size_distribution.items(), key=lambda x: x[1], reverse=True)
    ]

    # Category breakdown formatted
    formatted_categories = [
        {
            "category": v["category"],
            "units": v["units"],
            "revenue": round(float(v["revenue"]), 2),
            "share": round((v["units"] / total_units_sold) * 100, 1) if total_units_sold > 0 else 0.0,
        }
        for v in sorted(category_stats.values(), key=lambda x: x["revenue"], reverse=True)
    ]

    return {
        "period": {
            "preset": selected_preset,
            "label": period_label,
            "timezone": "Asia/Dhaka (UTC+6)"
        },
        "kpi": {
            "total_products_tracked": len(product_list),
            "total_units_sold": total_units_sold,
            "total_product_revenue": round(float(total_product_revenue), 2),
            "top_performer": best_sellers_by_revenue[0]["name"] if best_sellers_by_revenue else "N/A",
            "most_popular_size": formatted_sizes[0]["size"] if formatted_sizes else "N/A",
        },
        "best_sellers": best_sellers_by_revenue[:20],
        "most_ordered": most_ordered_by_units[:20],
        "high_return_alerts": highest_returned_items[:10],
        "size_distribution": formatted_sizes,
        "category_performance": formatted_categories,
        "all_products": product_list,
    }

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
            Q(shipping_phone__icontains=search) |
            Q(courier_consignment_id__icontains=search) |
            Q(tracking_number__icontains=search) |
            Q(shipping_name__icontains=search) |
            Q(user__first_name__icontains=search) |
            Q(user__last_name__icontains=search)
        ).distinct()

    if status:
        if status == "delayed":
            cutoff_24h = timezone.now() - timedelta(hours=24)
            qs = qs.filter(
                status__in=['placed', 'review'],
                created_at__lt=cutoff_24h
            )
        else:
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

    # Pagination slicing (Urgent orders prioritized at top)
    start = (page - 1) * limit
    end = start + limit
    paginated_qs = qs.order_by('-is_urgent', '-created_at')[start:end]

    # Bulk fetch images and attributes for SKUs
    all_skus = set()
    for o in paginated_qs:
        for i in o.items.all():
            all_skus.add(i.sku)
            
    sku_to_details = build_sku_to_details(all_skus)

    results = [compile_order_response(o, sku_to_details) for o in paginated_qs]
    return {"count": total_count, "results": results}


@router.get("/customers", auth=BearerAuth())
def list_customers_endpoint(request, search: Optional[str] = None):
    """Search registered customers database for manual order lookup (Admin only)."""
    enforce_permission(request, "orders", "view_orders")
    qs = User.objects.filter(role='customer')
    if search:
        qs = qs.filter(
            Q(username__icontains=search) |
            Q(email__icontains=search) |
            Q(crm_profile__phone__icontains=search)
        ).distinct()
        
    from apps.crm.models import CustomerProfile
    results = []
    for u in qs[:20]:
        profile = CustomerProfile.objects.filter(user=u).select_related('district', 'thana').first()
        district_name = profile.district.name if profile and profile.district else ""
        thana_name = profile.thana.name if profile and profile.thana else ""
        results.append({
            "id": u.id,
            "username": u.get_full_name().strip() or u.username,
            "email": u.email,
            "phone": profile.phone if profile else "",
            "district": district_name,
            "thana": thana_name,
            "district_name": district_name,
            "thana_name": thana_name,
            "address": profile.address if profile else ""
        })
    return results


@router.get("/customers/by-phone", auth=BearerAuth())
def lookup_customer_by_phone_endpoint(request, phone: str):
    """Look up an existing customer by 11-digit/full phone across CRM profiles and prior orders."""
    enforce_permission(request, "orders", "view_orders")

    raw = (phone or "").strip()
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("8801") and len(digits) >= 13:
        digits = digits[2:]
    elif digits.startswith("008801") and len(digits) >= 15:
        digits = digits[4:]

    if len(digits) < 10:
        return {"found": False}

    core_10 = digits[-10:]
    norm_11 = f"0{core_10}" if len(core_10) == 10 else digits
    variants = list({raw, digits, norm_11, f"+88{norm_11}", f"88{norm_11}"})

    from apps.crm.models import CustomerProfile
    profile = (
        CustomerProfile.objects.select_related("user", "district", "thana")
        .filter(Q(phone__in=variants) | Q(phone__endswith=core_10))
        .order_by("-created_at")
        .first()
    )
    latest_order = (
        Order.objects.select_related("user")
        .filter(Q(shipping_phone__in=variants) | Q(shipping_phone__endswith=core_10))
        .order_by("-created_at")
        .first()
    )

    if not profile and not latest_order:
        return {"found": False}

    user_obj = profile.user if profile else (latest_order.user if latest_order else None)
    full_name = ""
    if user_obj and user_obj.get_full_name().strip():
        full_name = user_obj.get_full_name().strip()
    elif latest_order and (latest_order.shipping_name or "").strip():
        full_name = latest_order.shipping_name.strip()
    elif user_obj:
        full_name = user_obj.username

    email_val = ""
    if profile and profile.email:
        email_val = profile.email
    elif user_obj and user_obj.email and not str(user_obj.email).endswith("@poshplex-guest.com"):
        email_val = user_obj.email

    district_val = (
        (profile.district.name if profile and profile.district else "")
        or (latest_order.shipping_district if latest_order else "")
        or ""
    )
    thana_val = (
        (profile.thana.name if profile and profile.thana else "")
        or (latest_order.shipping_thana if latest_order else "")
        or ""
    )
    postal_val = (latest_order.shipping_postal_code if latest_order else "") or ""
    address_val = (
        (profile.address if profile and profile.address else "")
        or (latest_order.shipping_address if latest_order else "")
        or ""
    )
    final_phone = (
        (profile.phone if profile and profile.phone else "")
        or (latest_order.shipping_phone if latest_order else "")
        or norm_11
    )

    return {
        "found": True,
        "user_id": user_obj.id if user_obj else None,
        "username": full_name,
        "name": full_name,
        "phone": final_phone,
        "email": email_val,
        "district_name": district_val,
        "thana_name": thana_val,
        "postal_code": postal_val,
        "address": address_val,
    }


class DeliveryRiskBatchInputSchema(Schema):
    phones: List[str]


@router.post("/delivery-risk/batch", auth=BearerAuth())
def get_delivery_risk_batch_endpoint(request, data: DeliveryRiskBatchInputSchema):
    """
    Check Steadfast delivery risk and fraud scores for multiple customer phone numbers
    in a single batch call. Results are cached in Redis/cache and returned as a phone-keyed map.
    """
    enforce_permission(request, "orders", "view_orders")
    from apps.orders.services import check_steadfast_delivery_risk_batch
    return check_steadfast_delivery_risk_batch(data.phones)


@router.get("/delivery-risk/{phone}", auth=BearerAuth())
def get_delivery_risk_endpoint(request, phone: str):
    """
    Check a customer's delivery risk, success ratio, cancellation ratio, and
    merchant fraud reports via Steadfast Courier API (Admin / CS only).
    """
    enforce_permission(request, "orders", "view_orders")
    from apps.orders.services import check_steadfast_delivery_risk
    return check_steadfast_delivery_risk(phone)


@router.get("/{int:order_id}", response=OrderResponseSchema, auth=BearerAuth())
def get_order_endpoint(request, order_id: int):
    """Retrieve details, payments, returns, and timeline updates of an order."""
    order = get_object_or_404(Order, id=order_id)
    user = request.auth
    
    # Customers can only see their own orders; staff can see all
    if user.role == 'customer' and order.user_id != user.id:
        raise HttpError(403, "Forbidden: You do not own this order.")
        
    return compile_order_response(order)

def normalize_bangladesh_phone(raw_phone: Optional[str]) -> str:
    """
    Normalizes any Bangladeshi mobile number into an 11-digit string starting with 01.
    Handles +88, 88, 0088 prefixes, spaces, hyphens, and inadvertent country code typos.
    """
    if not raw_phone:
        return ""
    digits = re.sub(r"\D", "", str(raw_phone))
    if digits.startswith("8801") and len(digits) >= 13:
        digits = digits[2:]
    elif digits.startswith("008801") and len(digits) >= 15:
        digits = digits[4:]
    elif digits.startswith("88") and len(digits) >= 13:
        digits = digits[2:]

    # Locate '01' followed by 9 digits matching valid operator prefixes 013-019
    idx = digits.find("01")
    if idx != -1 and len(digits) - idx >= 11:
        candidate = digits[idx:idx + 11]
        if re.match(r"^01[3-9]\d{8}$", candidate):
            return candidate

    if digits.startswith("01") and len(digits) == 11 and re.match(r"^01[3-9]\d{8}$", digits):
        return digits

    return digits

def resolve_or_create_customer(user, data: OrderCreateInputSchema, user_id_override: Optional[int] = None):
    from django.apps import apps
    import uuid
    CustomerProfile = apps.get_model('crm', 'CustomerProfile')
    
    raw_target_phone = data.shipping_phone or data.customer_phone
    if user and hasattr(user, 'crm_profile') and user.crm_profile.phone and not user.crm_profile.phone.startswith('email_'):
        raw_target_phone = raw_target_phone or user.crm_profile.phone
        
    final_phone = normalize_bangladesh_phone(raw_target_phone)
    if not final_phone and not user_id_override:
        raise ValidationError("A valid phone number is mandatory to place an order.")

    # Strict Bangladeshi Mobile format validation for consumer checkouts
    if not user_id_override:
        if not re.match(r"^01[3-9]\d{8}$", final_phone):
            raise ValidationError("Please provide a valid 11-digit Bangladeshi mobile number starting with 01 (e.g. 017XXXXXXXX).")

    # Keep both fields synchronized with normalized 11-digit phone
    data.customer_phone = final_phone
    data.shipping_phone = final_phone

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
            resolved_name = (data.customer_name or data.shipping_name or "").strip()
            if not u_id and resolved_name:
                email_val = data.customer_email or f"{uuid.uuid4().hex[:8]}@poshplex-guest.com"
                base_username = resolved_name.replace(" ", "").lower() or "guest"
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
        
    if data.shipping_district:
        from apps.orders.models import District, Thana
        dist = District.objects.filter(name__iexact=data.shipping_district).first()
        if dist:
            profile.district = dist
            if data.shipping_thana:
                thana = Thana.objects.filter(district=dist, name__iexact=data.shipping_thana).first()
                if thana:
                    profile.thana = thana

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

            # Apply explicit initial status when provided by admin (e.g. 'review', 'pending')
            if data.status and data.status in dict(Order.ORDER_STATUS_CHOICES) and data.status != order.status:
                order.status = data.status
                order.save(update_fields=['status'])
                OrderStatusHistory.objects.create(
                    order=order,
                    status=order.status,
                    admin_username=request.auth.username if getattr(request, 'auth', None) else "admin",
                    notes=f"Initial status set to {order.status} during manual order creation."
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

            # ---------------------------------------------------------
            # Secure Backend Shipping Cost Resolution
            # ---------------------------------------------------------
            # Resolve actual shipping cost based on District / Thana in DB
            # Do NOT blindly trust client-supplied data.shipping_cost.
            actual_shipping_cost = Decimal('130.00')  # Default outside Dhaka rate
            if data.shipping_district and data.shipping_thana:
                # 1. Exact match by District & Thana name
                thana_match = Thana.objects.filter(
                    district__name__iexact=data.shipping_district.strip(),
                    name__iexact=data.shipping_thana.strip(),
                    is_active=True
                ).first()
                if not thana_match:
                    # Case-insensitive or partial fallback
                    thana_match = Thana.objects.filter(
                        name__iexact=data.shipping_thana.strip(),
                        is_active=True
                    ).first()

                if thana_match and thana_match.shipping_cost is not None:
                    actual_shipping_cost = Decimal(str(thana_match.shipping_cost))
                else:
                    # District fallback
                    dist_lower = data.shipping_district.strip().lower()
                    if "dhaka city" in dist_lower:
                        actual_shipping_cost = Decimal('80.00')
                    elif "sub-urban" in dist_lower or "suburban" in dist_lower:
                        actual_shipping_cost = Decimal('110.00')
                    elif "dhaka" in dist_lower:
                        actual_shipping_cost = Decimal('80.00')
                    else:
                        actual_shipping_cost = Decimal('130.00')

            # Check if order qualifies for combo bundle free delivery (only if active combo with free_delivery exists for this item count)
            from apps.marketing.models import ComboOffer
            total_items_count = sum(int(item.quantity) for item in data.items)
            qualifies_bundle_free = ComboOffer.objects.filter(
                is_active=True,
                items_count=total_items_count,
                free_delivery=True
            ).exists()

            if qualifies_bundle_free:
                final_shipping_cost = Decimal('0.00')
            else:
                final_shipping_cost = actual_shipping_cost

            # Secure Backend Promo Calculation
            subtotal = sum(Decimal(str(item.price)) * int(item.quantity) for item in data.items)
            final_discount_amount = Decimal('0.00')
            applied_promo = None
            
            if data.promo_code:
                try:
                    promo = PromoCode.objects.get(code=data.promo_code.upper().strip(), is_active=True)
                    items_dicts = [item.dict() for item in data.items]
                    is_valid, promo_disc, _, _ = evaluate_promo_code_for_items(
                        promo=promo,
                        items=items_dicts,
                        subtotal=subtotal,
                        customer_phone=final_phone,
                        shipping_cost=final_shipping_cost
                    )
                    if is_valid:
                        final_discount_amount = promo_disc
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
                shipping_cost=final_shipping_cost,
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
                    "email": user.email if user else getattr(locals().get('resolved_user'), 'email', "")
                }
            )

            # Auto-mark AbandonedCheckout as converted if a session token was linked
            session_tok = getattr(data, 'checkout_session_token', None)
            if session_tok:
                try:
                    # When customer places the order themselves, remove or mark as converted
                    AbandonedCheckout.objects.filter(session_token=session_tok).delete()
                except Exception:
                    pass
            if final_phone:
                # Also delete any pending/recent abandoned drops for this phone so it never shows in Abandoned drops
                try:
                    AbandonedCheckout.objects.filter(
                        phone__icontains=final_phone[-10:]
                    ).delete()
                except Exception:
                    pass

            # Record Customer Data & Multi-Touch Attribution Touchpoints
            try:
                from apps.marketing.services.attribution_engine import record_order_attribution_touchpoints
                record_order_attribution_touchpoints(
                    order_id=order.id,
                    visitor_id=getattr(data, 'visitor_id', None),
                    session_id=getattr(data, 'session_id', None),
                    utm_campaign=getattr(data, 'utm_campaign', None),
                    campaign_id=getattr(data, 'campaign_id', None),
                    ad_id=getattr(data, 'ad_id', None),
                    fbc=getattr(data, 'fbc', None),
                    customer_phone=final_phone or order.shipping_phone
                )
            except Exception as attr_err:
                logger.warning(f"Attribution tracking note for Order #{order.id}: {attr_err}")
                
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

@router.patch("/{int:order_id}/pulse", response=OrderResponseSchema, auth=BearerAuth())
def update_order_pulse_endpoint(request, order_id: int, data: OrderPulseUpdateSchema):
    """Update OrderPulse operational delay blocker or cancellation root cause."""
    enforce_permission(request, "orders", "edit_orders")
    order = get_object_or_404(Order, id=order_id)
    
    update_fields = []
    log_notes = []

    if data.delay_reason is not None:
        order.delay_reason = data.delay_reason
        update_fields.append("delay_reason")
        log_notes.append(f"Delay Blocker: {data.delay_reason}")
    if data.delay_notes is not None:
        order.delay_notes = data.delay_notes
        update_fields.append("delay_notes")
        if data.delay_notes:
            log_notes.append(f"Delay Note: {data.delay_notes}")
            
    if data.cancellation_reason is not None:
        order.cancellation_reason = data.cancellation_reason
        update_fields.append("cancellation_reason")
        log_notes.append(f"Cancellation Reason: {data.cancellation_reason}")
    if data.cancellation_type is not None:
        order.cancellation_type = data.cancellation_type
        update_fields.append("cancellation_type")
        
    if data.internal_notes:
        existing = order.internal_notes or ""
        order.internal_notes = f"{existing}\n{data.internal_notes}".strip() if existing else data.internal_notes
        update_fields.append("internal_notes")
        
    if update_fields:
        order.save(update_fields=update_fields)
        if log_notes:
            admin_user = getattr(request.auth, 'username', 'Admin') if request.auth else 'Admin'
            OrderStatusHistory.objects.create(
                order=order,
                status=order.status,
                admin_username=admin_user,
                notes="; ".join(log_notes)
            )

    return compile_order_response(order)

@router.post("/{int:order_id}/partial-split", response=OrderResponseSchema, auth=BearerAuth())
def resolve_partial_delivery_endpoint(request, order_id: int, data: PartialSplitInputSchema):
    """Resolve a partially delivered order by splitting kept vs returned items with root causes."""
    enforce_permission(request, "orders", "edit_orders")
    order = get_object_or_404(Order, id=order_id)
    
    with transaction.atomic():
        total_returned_qty = 0
        total_fulfilled_qty = 0
        split_summary = []
        
        for item_data in data.items:
            item = get_object_or_404(OrderItem, id=item_data.item_id, order=order)
            item.fulfilled_quantity = item_data.fulfilled_quantity
            item.returned_quantity = item_data.returned_quantity
            item.return_reason = item_data.return_reason or ""
            item.rejection_notes = item_data.rejection_notes or ""
            
            if item_data.returned_quantity > 0 and item_data.fulfilled_quantity == 0:
                item.fulfillment_status = 'returned'
            elif item_data.fulfilled_quantity > 0 and item_data.returned_quantity == 0:
                item.fulfillment_status = 'delivered'
            else:
                item.fulfillment_status = 'delivered' # split line
                
            item.save(update_fields=['fulfilled_quantity', 'returned_quantity', 'return_reason', 'rejection_notes', 'fulfillment_status'])
            total_returned_qty += item_data.returned_quantity
            total_fulfilled_qty += item_data.fulfilled_quantity
            
            if item_data.returned_quantity > 0:
                split_summary.append(f"{item.sku} Returned ({item_data.returned_quantity}x, Reason: {item_data.return_reason or 'None'})")
            if item_data.fulfilled_quantity > 0:
                split_summary.append(f"{item.sku} Kept ({item_data.fulfilled_quantity}x)")
                
        order.status = 'partially_delivered'
        if data.notes:
            existing = order.internal_notes or ""
            order.internal_notes = f"{existing}\n[Partial Split] {data.notes}".strip() if existing else f"[Partial Split] {data.notes}"
            order.save(update_fields=['status', 'internal_notes', 'updated_at'])
        else:
            order.save(update_fields=['status', 'updated_at'])
            
        admin_user = getattr(request.auth, 'username', 'Admin') if request.auth else 'Admin'
        OrderStatusHistory.objects.create(
            order=order,
            status='partially_delivered',
            admin_username=admin_user,
            notes=f"Partial Delivery Split: {'; '.join(split_summary)}"
        )
        
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
            if getattr(data, 'status', None):
                order.status = data.status
            if getattr(data, 'payment_status', None):
                order.payment_status = data.payment_status
            if hasattr(data, 'issue_status'):
                order.issue_status = data.issue_status
            if hasattr(data, 'is_ready'):
                order.is_ready = data.is_ready
            if hasattr(data, 'is_print_ready'):
                order.is_print_ready = data.is_print_ready
            if hasattr(data, 'is_urgent') and data.is_urgent is not None:
                order.is_urgent = data.is_urgent
            
            # Sync CRM profile if it exists
            if hasattr(order.user, 'crm_profile'):
                crm = order.user.crm_profile
                crm_updated = False
                
                if data.shipping_phone and crm.phone != data.shipping_phone:
                    from apps.crm.models import CustomerProfile
                    if not CustomerProfile.objects.filter(phone=data.shipping_phone).exclude(id=crm.id).exists():
                        crm.phone = data.shipping_phone
                        crm_updated = True
                
                if data.shipping_address and crm.address != data.shipping_address:
                    crm.address = data.shipping_address
                    crm_updated = True
                    
                if data.shipping_district:
                    from apps.orders.models import District, Thana
                    dist = District.objects.filter(name__iexact=data.shipping_district).first()
                    if dist and crm.district_id != dist.id:
                        crm.district_id = dist.id
                        crm_updated = True
                    
                    if dist and data.shipping_thana:
                        thana = Thana.objects.filter(district=dist, name__iexact=data.shipping_thana).first()
                        if thana and crm.thana_id != thana.id:
                            crm.thana_id = thana.id
                            crm_updated = True
                    
                if crm_updated:
                    crm.save()
                    
                if data.shipping_name and order.user.first_name != data.shipping_name:
                    # Update the User's first_name with the new shipping name
                    order.user.first_name = data.shipping_name[:150]  # Respect max_length of first_name
                    order.user.save(update_fields=['first_name'])
            
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
            
            # Auto-trigger Urgent Parcel if updated order value exceeds 2500 BDT
            if order.total_amount > Decimal('2500.00'):
                order.is_urgent = True

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

        # Update attribution financials & trigger Meta CAPI lifecycle events
        try:
            from apps.marketing.services.attribution_engine import update_order_touchpoints_on_status_change
            from apps.marketing.tasks import send_meta_capi_lifecycle_event_task
            update_order_touchpoints_on_status_change(order.id, data.status)
            status_clean = (data.status or "").lower().strip()
            if status_clean in ['confirmed', 'processing']:
                send_meta_capi_lifecycle_event_task.delay(order.id, "OrderConfirmed")
            elif status_clean in ['delivered', 'completed']:
                send_meta_capi_lifecycle_event_task.delay(order.id, "OrderDelivered")
        except Exception as lifecycle_err:
            logger.warning(f"Lifecycle event update note for Order #{order.id}: {lifecycle_err}")

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

@router.post("/{int:order_id}/toggle-urgent", response=OrderResponseSchema, auth=BearerAuth())
def toggle_order_urgent_endpoint(request, order_id: int):
    """Toggle urgent priority status for fast fulfillment queue dispatch (Admin only)."""
    enforce_permission(request, "orders", "edit_orders")
    order = get_object_or_404(Order, id=order_id)
    order.is_urgent = not getattr(order, 'is_urgent', False)
    order.save(update_fields=['is_urgent', 'updated_at'])
    
    # Log to order status history for staff visibility
    admin_user = getattr(request.auth, 'username', 'Admin') if request.auth else 'Admin'
    status_label = "Marked as URGENT parcel for expedited fulfillment." if order.is_urgent else "Removed URGENT parcel priority flag."
    OrderStatusHistory.objects.create(
        order=order,
        status=order.status,
        admin_username=admin_user,
        notes=status_label
    )
    return compile_order_response(order)

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
        # Sync orders that have tracking number and are not delivered/cancelled/returned/manually_cancelled
        orders_to_sync = Order.objects.exclude(status__in=['delivered', 'cancelled', 'returned', 'manually_cancelled']).exclude(tracking_number__isnull=True).exclude(tracking_number='')
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
    from apps.orders.models import District
    districts = District.objects.filter(is_active=True).prefetch_related('thanas')
    
    district_list = []
    for d in districts:
        active_thanas = d.thanas.filter(is_active=True)
        thana_names = list(active_thanas.values_list('name', flat=True))
        if not thana_names:
            continue
            
        first_thana = active_thanas.first()
        cost = float(first_thana.shipping_cost) if first_thana else 120.0
        
        district_list.append({
            "name": d.name,
            "shipping_cost": cost,
            "thanas": thana_names
        })
        
    return {
        "districts": district_list
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
        if status == "delayed":
            cutoff_24h = timezone.now() - timedelta(hours=24)
            qs = qs.filter(
                status__in=['placed', 'review'],
                created_at__lt=cutoff_24h
            )
        else:
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
        qs = qs.order_by("-is_urgent", sort_by)
    else:
        qs = qs.order_by("-is_urgent", "-created_at")
        
    total_count = qs.count()
    start = (page - 1) * limit
    end = start + limit
    paginated_qs = qs[start:end]
    # Bulk fetch images and attributes for SKUs
    all_skus = set()
    for o in paginated_qs:
        for i in o.items.all():
            all_skus.add(i.sku)
            
    sku_to_details = build_sku_to_details(all_skus)

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


# ==============================================================================
# ABANDONED CHECKOUT RECOVERY MODULE ENDPOINTS
# ==============================================================================

class AbandonedCheckoutItemSchema(Schema):
    sku: str
    product_name: str
    price: Decimal
    quantity: int
    image: Optional[str] = None
    size: Optional[str] = None

class AbandonedCheckoutCaptureInput(Schema):
    session_token: str
    phone: str
    customer_name: Optional[str] = ""
    customer_email: Optional[str] = ""
    shipping_district: Optional[str] = ""
    shipping_thana: Optional[str] = ""
    shipping_address: Optional[str] = ""
    cart_items: List[AbandonedCheckoutItemSchema]
    cart_total: Decimal

class AbandonedCheckoutUpdateDetailsInput(Schema):
    customer_name: Optional[str] = None
    phone: Optional[str] = None
    customer_email: Optional[str] = None
    shipping_district: Optional[str] = None
    shipping_thana: Optional[str] = None
    shipping_address: Optional[str] = None

class AbandonedCheckoutUpdateStatusInput(Schema):
    status: str
    call_notes: Optional[str] = ""
    followup_at: Optional[Any] = None

class AbandonedCheckoutResponseSchema(Schema):
    id: int
    session_token: str
    phone: str
    customer_name: str
    customer_email: str
    shipping_district: str
    shipping_thana: str
    shipping_address: str
    cart_items: List[Any]
    cart_total: Decimal
    status: str
    call_notes: str
    last_called_at: Optional[Any] = None
    followup_at: Optional[Any] = None
    assigned_to_username: Optional[str] = None
    converted_order_id: Optional[int] = None
    converted_order_number: Optional[str] = None
    created_at: Any
    updated_at: Any

class PaginatedAbandonedResponse(Schema):
    items: List[AbandonedCheckoutResponseSchema]
    total: int
    page: int
    limit: int
    total_pages: int
    kpi: dict

def compile_abandoned_response(obj: AbandonedCheckout) -> dict:
    return {
        "id": obj.id,
        "session_token": obj.session_token,
        "phone": obj.phone,
        "customer_name": obj.customer_name or "",
        "customer_email": obj.customer_email or "",
        "shipping_district": obj.shipping_district or "",
        "shipping_thana": obj.shipping_thana or "",
        "shipping_address": obj.shipping_address or "",
        "cart_items": obj.cart_items or [],
        "cart_total": obj.cart_total,
        "status": obj.status,
        "call_notes": obj.call_notes or "",
        "last_called_at": obj.last_called_at,
        "followup_at": obj.followup_at,
        "assigned_to_username": obj.assigned_to.username if obj.assigned_to else None,
        "converted_order_id": obj.converted_order_id,
        "converted_order_number": obj.converted_order.order_number if obj.converted_order else None,
        "created_at": obj.created_at,
        "updated_at": obj.updated_at,
    }

@router.post("/abandoned/capture")
def capture_abandoned_checkout(request, data: AbandonedCheckoutCaptureInput):
    """
    Public storefront endpoint.
    Silently captures checkout contact and cart items when phone number is entered.
    Updates existing record if matching session_token or recent phone exists.
    """
    raw_phone = (data.phone or "").strip()
    # Normalize phone: extract digits, handle +88
    digits = re.sub(r'\D', '', raw_phone)
    if digits.startswith("8801") and len(digits) == 13:
        clean_phone = digits[2:]
    elif digits.startswith("008801") and len(digits) == 15:
        clean_phone = digits[4:]
    elif digits.startswith("1") and len(digits) == 10:
        clean_phone = "0" + digits
    else:
        clean_phone = digits

    if len(clean_phone) < 11 or not clean_phone.startswith("01"):
        return {"success": False, "message": "Incomplete or invalid phone number"}

    # If this phone placed an order within the last 15 minutes, skip recording
    recent_order = Order.objects.filter(
        shipping_phone__icontains=clean_phone[-10:],
        created_at__gte=timezone.now() - timedelta(minutes=15)
    ).first()
    if recent_order:
        return {"success": True, "status": "already_placed_order"}

    items_data = [item.dict() for item in data.cart_items]
    items_json = []
    for itm in items_data:
        items_json.append({
            "sku": itm.get("sku"),
            "product_name": itm.get("product_name"),
            "price": float(itm.get("price") or 0),
            "quantity": int(itm.get("quantity") or 1),
            "image": itm.get("image"),
            "size": itm.get("size")
        })

    # Update by session token if exists, otherwise create
    record, created = AbandonedCheckout.objects.get_or_create(
        session_token=data.session_token,
        defaults={
            "phone": clean_phone,
            "customer_name": (data.customer_name or "").strip(),
            "customer_email": (data.customer_email or "").strip(),
            "shipping_district": (data.shipping_district or "").strip(),
            "shipping_thana": (data.shipping_thana or "").strip(),
            "shipping_address": (data.shipping_address or "").strip(),
            "cart_items": items_json,
            "cart_total": data.cart_total,
            "status": "pending",
        }
    )

    if not created and record.status != "converted":
        record.phone = clean_phone
        if data.customer_name:
            record.customer_name = data.customer_name.strip()
        if data.customer_email:
            record.customer_email = data.customer_email.strip()
        if data.shipping_district:
            record.shipping_district = data.shipping_district.strip()
        if data.shipping_thana:
            record.shipping_thana = data.shipping_thana.strip()
        if data.shipping_address:
            record.shipping_address = data.shipping_address.strip()
        if items_json:
            record.cart_items = items_json
            record.cart_total = data.cart_total
        record.save()

    return {"success": True, "id": record.id}

@router.get("/abandoned/list", response=PaginatedAbandonedResponse, auth=BearerAuth())
def list_abandoned_checkouts(
    request,
    search: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20
):
    """
    List abandoned checkouts for tele-sales and recovery outreach (Admin only).
    """
    enforce_permission(request, "orders", "view_orders")
    # Only list actual unrecovered abandoned drops needing outreach (pending, busy, followup, declined).
    # Once converted into a real order, it belongs strictly in the Orders Queue.
    qs = AbandonedCheckout.objects.select_related('assigned_to', 'converted_order').all()

    if status and status.lower() != "all":
        status_clean = status.lower().strip()
        if status_clean == "pending":
            qs = qs.filter(status__in=["pending", "called_busy", "called_followup"])
        elif status_clean == "declined":
            qs = qs.filter(status__in=["declined", "cancelled"])
        else:
            qs = qs.filter(status=status_clean)
    else:
        qs = qs.filter(status__in=["pending", "called_busy", "called_followup"])

    if search:
        search_term = search.strip()
        qs = qs.filter(
            Q(phone__icontains=search_term) |
            Q(customer_name__icontains=search_term) |
            Q(shipping_district__icontains=search_term) |
            Q(call_notes__icontains=search_term)
        )

    # Compute high-level recovery metrics
    all_qs = AbandonedCheckout.objects.all()
    total_captured = all_qs.count()
    pending_count = all_qs.filter(status__in=["pending", "called_busy", "called_followup"]).count()
    followup_count = all_qs.filter(status="called_followup").count()
    converted_count = all_qs.filter(status="converted").count()
    declined_count = all_qs.filter(status__in=["declined", "cancelled"]).count()

    total_recoverable_value = all_qs.filter(status__in=["pending", "called_followup", "called_busy"]).aggregate(
        val=Sum('cart_total')
    )['val'] or Decimal('0.00')

    total_recovered_value = all_qs.filter(status="converted").aggregate(
        val=Sum('cart_total')
    )['val'] or Decimal('0.00')

    conversion_rate = round((converted_count / total_captured * 100), 1) if total_captured > 0 else 0.0

    kpi = {
        "total_captured": total_captured,
        "pending_count": pending_count,
        "followup_count": followup_count,
        "converted_count": converted_count,
        "declined_count": declined_count,
        "recoverable_value": float(total_recoverable_value),
        "recovered_value": float(total_recovered_value),
        "conversion_rate": conversion_rate,
    }

    total = qs.count()
    total_pages = (total + limit - 1) // limit if limit > 0 else 1
    offset = (page - 1) * limit
    paginated_items = qs.order_by('-updated_at')[offset:offset + limit]

    return {
        "items": [compile_abandoned_response(obj) for obj in paginated_items],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "kpi": kpi
    }

@router.patch("/abandoned/{int:abandoned_id}/status", response=AbandonedCheckoutResponseSchema, auth=BearerAuth())
def update_abandoned_status(request, abandoned_id: int, data: AbandonedCheckoutUpdateStatusInput):
    """
    Update tele-sales call notes, follow-up schedule, and status for an abandoned checkout.
    """
    enforce_permission(request, "orders", "edit_orders")
    record = get_object_or_404(AbandonedCheckout, id=abandoned_id)

    record.status = data.status
    if data.call_notes is not None:
        record.call_notes = data.call_notes
    record.last_called_at = timezone.now()
    if data.followup_at:
        record.followup_at = data.followup_at
    if request.auth and hasattr(request.auth, 'id'):
        record.assigned_to = request.auth

    record.save()
    return compile_abandoned_response(record)

@router.patch("/abandoned/{int:abandoned_id}/details", response=AbandonedCheckoutResponseSchema, auth=BearerAuth())
def update_abandoned_details(request, abandoned_id: int, data: AbandonedCheckoutUpdateDetailsInput):
    """
    Edit customer contact and address details on an abandoned drop record.
    """
    enforce_permission(request, "orders", "edit_orders")
    record = get_object_or_404(AbandonedCheckout, id=abandoned_id)

    if data.customer_name is not None:
        record.customer_name = data.customer_name.strip()
    if data.phone is not None:
        raw = data.phone.strip()
        digits = re.sub(r'\D', '', raw)
        if digits.startswith("8801") and len(digits) == 13:
            record.phone = digits[2:]
        elif digits.startswith("008801") and len(digits) == 15:
            record.phone = digits[4:]
        elif digits.startswith("1") and len(digits) == 10:
            record.phone = "0" + digits
        else:
            record.phone = digits or raw
    if data.customer_email is not None:
        record.customer_email = data.customer_email.strip()
    if data.shipping_district is not None:
        record.shipping_district = data.shipping_district.strip()
    if data.shipping_thana is not None:
        record.shipping_thana = data.shipping_thana.strip()
    if data.shipping_address is not None:
        record.shipping_address = data.shipping_address.strip()

    record.save()
    return compile_abandoned_response(record)

@router.post("/abandoned/{int:abandoned_id}/convert-to-order", response=OrderResponseSchema, auth=BearerAuth())
def convert_abandoned_to_order(request, abandoned_id: int):
    """
    1-Click tele-sales conversion: Creates a Cash on Delivery Order from the abandoned checkout cart.
    """
    enforce_permission(request, "orders", "edit_orders")
    record = get_object_or_404(AbandonedCheckout, id=abandoned_id)

    if record.status == "converted" and record.converted_order:
        return compile_order_response(record.converted_order)

    # Validate items
    if not record.cart_items:
        raise HttpError(400, "Abandoned checkout has no cart items to order.")

    # Validate customer mandatory fields required for checkout
    missing_fields = []
    if not (record.customer_name and record.customer_name.strip()):
        missing_fields.append("Customer Full Name")
    if not (record.phone and record.phone.strip()):
        missing_fields.append("Phone Number")
    if not (record.shipping_district and record.shipping_district.strip()):
        missing_fields.append("District")
    if not (record.shipping_thana and record.shipping_thana.strip()):
        missing_fields.append("Area (Thana)")
    if not (record.shipping_address and record.shipping_address.strip()):
        missing_fields.append("Full Delivery Address")

    if missing_fields:
        missing_str = ", ".join(missing_fields)
        raise HttpError(400, f"Customer information is missing: {missing_str}. Please click the edit icon to provide the required details before placing as COD.")

    # Validate Bangladeshi mobile phone format
    cleaned_ph = normalize_bangladesh_phone(record.phone)
    if not re.match(r"^01[3-9]\d{8}$", cleaned_ph):
        raise HttpError(400, f"Invalid phone number '{record.phone}'. Please provide a valid 11-digit Bangladeshi mobile number starting with 01 (e.g. 017XXXXXXXX).")

    items_list = []
    for itm in record.cart_items:
        items_list.append({
            "sku": itm.get("sku"),
            "quantity": int(itm.get("quantity") or 1),
            "price": Decimal(str(itm.get("price") or 0))
        })

    from apps.crm.models import CustomerProfile
    import uuid

    # Resolve customer user and CRM profile
    phone_clean = cleaned_ph
    resolved_user = None

    # Try lookup via CustomerProfile
    crm_prof = CustomerProfile.objects.filter(phone=phone_clean).select_related('user').first()
    if crm_prof and crm_prof.user:
        resolved_user = crm_prof.user
    else:
        # Try lookup by username
        user_match = User.objects.filter(username=phone_clean).first()
        if user_match:
            resolved_user = user_match
        else:
            resolved_user = User.objects.create_user(
                username=phone_clean,
                email=record.customer_email or f"{phone_clean}@poshplexbd.com",
                password=uuid.uuid4().hex,
                first_name=record.customer_name or "Customer",
                role='customer'
            )
        # Ensure CRM profile exists
        crm_prof, _ = CustomerProfile.objects.get_or_create(
            user=resolved_user,
            defaults={"phone": phone_clean, "email": record.customer_email or ""}
        )

    # Sync CustomerProfile address details if missing
    if crm_prof:
        if not crm_prof.phone:
            crm_prof.phone = phone_clean
        if record.shipping_address and not crm_prof.address:
            crm_prof.address = record.shipping_address
        if record.shipping_district:
            dist_obj = District.objects.filter(name__iexact=record.shipping_district).first()
            if dist_obj:
                crm_prof.district = dist_obj
                if record.shipping_thana:
                    thana_obj = Thana.objects.filter(district=dist_obj, name__iexact=record.shipping_thana).first()
                    if thana_obj:
                        crm_prof.thana = thana_obj
        crm_prof.save()

    # Determine default shipping cost (inside Dhaka 70, outside 120)
    dist = (record.shipping_district or "").lower()
    shipping_cost = Decimal('70.00') if 'dhaka' in dist else Decimal('120.00')

    with transaction.atomic():
        order = create_order(
            user_id=resolved_user.id,
            items_data=items_list,
            shipping_address=record.shipping_address.strip(),
            shipping_name=record.customer_name.strip(),
            shipping_phone=phone_clean,
            shipping_district=record.shipping_district.strip(),
            shipping_thana=record.shipping_thana.strip(),
            shipping_postal_code="",
            discount_amount=Decimal('0.00'),
            shipping_cost=shipping_cost,
            customer_notes="Converted from Abandoned Checkout by Tele-sales",
            internal_notes="[Abandoned Drop Recovered] " + (f"Notes: {record.call_notes}" if record.call_notes else "")
        )

        record.status = "converted"
        record.converted_order = order
        record.save(update_fields=['status', 'converted_order', 'updated_at'])

        # Log history
        OrderStatusHistory.objects.create(
            order=order,
            status=order.status,
            admin_username=request.auth.username if request.auth else "admin",
            notes=f"Order created via Abandoned Checkout Recovery (Ref #{record.id})."
        )

    return compile_order_response(order)

