from ninja import Router
from django.db.models import Sum
from typing import Optional
from apps.core.api import BearerAuth, enforce_permission
from apps.orders.models import Order
from django.utils.dateparse import parse_datetime, parse_date
from django.utils import timezone
from datetime import datetime, time

router = Router(auth=BearerAuth())

@router.get("/sales")
def get_sales_report(request, date_from: Optional[str] = None, date_to: Optional[str] = None):
    enforce_permission(request, "report", "view")

    qs = Order.objects.all()

    if date_from:
        parsed_dt = parse_datetime(date_from)
        if not parsed_dt:
            parsed_d = parse_date(date_from)
            if parsed_d:
                parsed_dt = timezone.make_aware(datetime.combine(parsed_d, time.min))
        if parsed_dt:
            qs = qs.filter(created_at__gte=parsed_dt)
            
    if date_to:
        parsed_dt = parse_datetime(date_to)
        if not parsed_dt:
            parsed_d = parse_date(date_to)
            if parsed_d:
                parsed_dt = timezone.make_aware(datetime.combine(parsed_d, time.max))
        if parsed_dt:
            qs = qs.filter(created_at__lte=parsed_dt)

    total_orders = qs.count()
    total_amount = qs.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
    total_products = qs.aggregate(Sum('items__quantity'))['items__quantity__sum'] or 0
    avg_order = (total_amount / total_orders) if total_orders > 0 else 0

    snapshot = {
        "orders_qty": total_orders,
        "product_qty": total_products,
        "total_amount": float(total_amount),
        "avg_order": float(avg_order),
    }

    status_keys = ["placed", "review", "pending", "hold", "approval_pending", "delivered", "returned", "cancelled"]
    status_report = {}

    for st in status_keys:
        sqs = qs.filter(status=st)
        sqty = sqs.count()
        sprod = sqs.aggregate(Sum('items__quantity'))['items__quantity__sum'] or 0
        samt = sqs.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
        
        status_report[st] = {
            "orders_qty": sqty,
            "product_qty": sprod,
            "total_amount": float(samt),
        }

    return {
        "snapshot": snapshot,
        "status_report": status_report
    }
