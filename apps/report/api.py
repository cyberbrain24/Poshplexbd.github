from ninja import Router, Schema
from django.db.models import Sum, Subquery, OuterRef, F, DecimalField, ExpressionWrapper
from django.db.models.functions import Coalesce
from typing import Optional
from decimal import Decimal
import logging
from apps.core.api import BearerAuth, enforce_permission
from apps.orders.models import Order, OrderItem
from apps.catalog.models import ProductVariant, Product
from apps.core.models import SiteSetting
from apps.marketing.models import MetaAdAccount, PerformanceSnapshot
from apps.marketing.services.meta_insights import fetch_insights
from django.utils.dateparse import parse_datetime, parse_date
from django.utils import timezone
from datetime import datetime, time, timedelta

logger = logging.getLogger(__name__)

router = Router(auth=BearerAuth())

class FixedExpenseInputSchema(Schema):
    amount: float

class UsdRateInputSchema(Schema):
    rate: float

@router.get("/sales")
def get_sales_report(
    request, 
    date_from: Optional[str] = None, 
    date_to: Optional[str] = None,
    preset: Optional[str] = None
):
    enforce_permission(request, "report", "view")

    import zoneinfo
    dhaka_tz = zoneinfo.ZoneInfo("Asia/Dhaka")
    now_dhaka = timezone.now().astimezone(dhaka_tz)

    qs = Order.objects.all()

    # Resolve date boundaries for Meta Insights spend sync
    # default to today in Asia/Dhaka
    meta_since = str(now_dhaka.date())
    meta_until = str(now_dhaka.date())

    # Prioritize server-side timezone-accurate preset (Asia/Dhaka)
    if preset:
        preset_clean = preset.strip().lower()
        if preset_clean == "today":
            start_dt = now_dhaka.replace(hour=0, minute=0, second=0, microsecond=0)
            qs = qs.filter(created_at__gte=start_dt)
            meta_since = str(now_dhaka.date())
            meta_until = str(now_dhaka.date())
        elif preset_clean == "yesterday":
            yesterday_dhaka = now_dhaka - timedelta(days=1)
            start_dt = yesterday_dhaka.replace(hour=0, minute=0, second=0, microsecond=0)
            end_dt = yesterday_dhaka.replace(hour=23, minute=59, second=59, microsecond=999999)
            qs = qs.filter(created_at__gte=start_dt, created_at__lte=end_dt)
            meta_since = str(yesterday_dhaka.date())
            meta_until = str(yesterday_dhaka.date())
        elif preset_clean == "day_before_yesterday":
            day_before = now_dhaka - timedelta(days=2)
            start_dt = day_before.replace(hour=0, minute=0, second=0, microsecond=0)
            end_dt = day_before.replace(hour=23, minute=59, second=59, microsecond=999999)
            qs = qs.filter(created_at__gte=start_dt, created_at__lte=end_dt)
            meta_since = str(day_before.date())
            meta_until = str(day_before.date())
        elif preset_clean in ["today_yesterday", "today_and_yesterday"]:
            y_dhaka = now_dhaka - timedelta(days=1)
            start_dt = y_dhaka.replace(hour=0, minute=0, second=0, microsecond=0)
            qs = qs.filter(created_at__gte=start_dt)
            meta_since = str(y_dhaka.date())
            meta_until = str(now_dhaka.date())
        elif preset_clean == "7_days":
            start_dt = now_dhaka - timedelta(days=7)
            qs = qs.filter(created_at__gte=start_dt)
            meta_since = str((now_dhaka - timedelta(days=7)).date())
            meta_until = str(now_dhaka.date())
        elif preset_clean == "1_month":
            start_dt = now_dhaka - timedelta(days=30)
            qs = qs.filter(created_at__gte=start_dt)
            meta_since = str((now_dhaka - timedelta(days=30)).date())
            meta_until = str(now_dhaka.date())
    else:
        # Fallback to date_from / date_to if custom range
        if date_from:
            parsed_dt = parse_datetime(date_from)
            if not parsed_dt:
                parsed_d = parse_date(date_from)
                if parsed_d:
                    parsed_dt = timezone.make_aware(datetime.combine(parsed_d, time.min), dhaka_tz)
                    meta_since = str(parsed_d)
            else:
                meta_since = str(parsed_dt.date())
            if parsed_dt:
                qs = qs.filter(created_at__gte=parsed_dt)
                
        if date_to:
            parsed_dt = parse_datetime(date_to)
            if not parsed_dt:
                parsed_d = parse_date(date_to)
                if parsed_d:
                    parsed_dt = timezone.make_aware(datetime.combine(parsed_d, time.max), dhaka_tz)
                    meta_until = str(parsed_d)
            else:
                meta_until = str(parsed_dt.date())
            if parsed_dt:
                qs = qs.filter(created_at__lte=parsed_dt)

    total_orders = qs.count()
    total_amount = qs.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
    total_products = qs.aggregate(Sum('items__quantity'))['items__quantity__sum'] or 0
    avg_order = (total_amount / total_orders) if total_orders > 0 else 0

    # Calculate global fixed expense
    setting_exp, _ = SiteSetting.objects.get_or_create(
        key="reports_fixed_expense",
        defaults={"value": {"amount": 0}, "description": "Global fixed expense for profit calculation"}
    )
    fixed_expense = float(setting_exp.value.get("amount", 0))

    # Retrieve or initialize USD to BDT exchange rate setting
    setting_rate, _ = SiteSetting.objects.get_or_create(
        key="reports_usd_to_bdt_rate",
        defaults={"value": {"rate": 122.0}, "description": "USD to BDT conversion rate for ad spend calculations"}
    )
    usd_to_bdt_rate = float(setting_rate.value.get("rate", 122.0))

    # Live Meta Ads Spend calculation across all active Meta ad accounts
    meta_ads_spend_usd = Decimal('0.00')
    accounts_to_query = MetaAdAccount.objects.filter(is_active=True)
    for acc in accounts_to_query:
        try:
            raw_insights = fetch_insights(acc, meta_since, meta_until)
            for item in raw_insights:
                s_val = item.get("spend")
                if s_val is not None:
                    meta_ads_spend_usd += Decimal(str(s_val))
        except Exception as e:
            logger.warning(f"Failed to fetch Meta insights for account {acc.name} ({meta_since} to {meta_until}): {e}")

    meta_ads_spend_bdt = float((meta_ads_spend_usd * Decimal(str(usd_to_bdt_rate))).quantize(Decimal('0.01')))

    snapshot = {
        "orders_qty": total_orders,
        "product_qty": total_products,
        "total_amount": float(total_amount),
        "avg_order": float(avg_order),
        "fixed_expense": fixed_expense,
        "usd_to_bdt_rate": usd_to_bdt_rate,
        "meta_ads_spend_usd": float(meta_ads_spend_usd),
        "meta_ads_spend_bdt": meta_ads_spend_bdt,
        "date_since": meta_since,
        "date_until": meta_until,
    }

    status_keys = ["placed", "review", "pending", "hold", "approval_pending", "delivered", "returned", "cancelled", "manually_cancelled"]
    status_report = {}

    for st in status_keys:
        sqs = qs.filter(status=st)
        sqty = sqs.count()
        sprod = sqs.aggregate(Sum('items__quantity'))['items__quantity__sum'] or 0
        samt = sqs.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
        
        # Calculate product costing for this specific status
        scost = OrderItem.objects.filter(order__in=sqs).annotate(
            unit_cost=Coalesce(
                Subquery(
                    ProductVariant.objects.filter(sku=OuterRef('sku')).values('purchase_price')[:1],
                    output_field=DecimalField()
                ),
                Subquery(
                    Product.objects.filter(sku=OuterRef('sku')).values('purchase_price')[:1],
                    output_field=DecimalField()
                ),
                0,
                output_field=DecimalField()
            )
        ).aggregate(
            total_cost=Sum(
                ExpressionWrapper(F('quantity') * F('unit_cost'), output_field=DecimalField())
            )
        )['total_cost'] or 0
        
        status_report[st] = {
            "orders_qty": sqty,
            "product_qty": sprod,
            "total_amount": float(samt),
            "product_costing": float(scost),
        }

    return {
        "snapshot": snapshot,
        "status_report": status_report
    }

@router.post("/settings/fixed-expense")
def update_fixed_expense(request, payload: FixedExpenseInputSchema):
    enforce_permission(request, "report", "view")
    setting, _ = SiteSetting.objects.get_or_create(
        key="reports_fixed_expense",
        defaults={"value": {"amount": 0}, "description": "Global fixed expense for profit calculation"}
    )
    setting.value = {"amount": payload.amount}
    setting.save()
    return {"success": True, "amount": payload.amount}

@router.post("/settings/usd-rate")
def update_usd_rate(request, payload: UsdRateInputSchema):
    enforce_permission(request, "report", "view")
    setting, _ = SiteSetting.objects.get_or_create(
        key="reports_usd_to_bdt_rate",
        defaults={"value": {"rate": 122.0}, "description": "USD to BDT conversion rate for ad spend calculations"}
    )
    setting.value = {"rate": payload.rate}
    setting.save()
    return {"success": True, "rate": payload.rate}
