import logging
import uuid
import datetime
from decimal import Decimal
from typing import Optional, Dict, Any, List
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum, Count, Q, F

from apps.marketing.models import (
    Campaign,
    MetaAdAccount,
    VisitorSession,
    RawTrackingEvent,
    OrderAttributionTouchpoint,
    DailyAdPerformanceSummary,
    PerformanceSnapshot,
)
from apps.orders.models import Order, OrderItem
from apps.marketing.models import (
    Campaign,
    MetaAdAccount,
    VisitorSession,
    RawTrackingEvent,
    OrderAttributionTouchpoint,
    DailyAdPerformanceSummary,
    PerformanceSnapshot,
    IdentityLink,
    MetaCapiLog,
)
from apps.orders.models import Order, OrderItem
from apps.crm.models import CustomerProfile

logger = logging.getLogger(__name__)


def detect_bot_or_crawler(user_agent: str) -> bool:
    """Detects automated web crawlers, bots, or headless test clients."""
    if not user_agent:
        return False
    ua = user_agent.lower()
    bot_signatures = [
        'bot', 'crawl', 'spider', 'slurp', 'facebookexternalhit',
        'meta-externalagent', 'headless', 'python-requests',
        'curl', 'wget', 'lighthouse', 'bytespider', 'semrush'
    ]
    return any(sig in ua for sig in bot_signatures)


def classify_channel(
    utm_source: str = "",
    utm_medium: str = "",
    utm_campaign: str = "",
    campaign_id: str = "",
    adset_id: str = "",
    ad_id: str = "",
    fbc: str = "",
    fbclid: str = "",
    referrer: str = ""
) -> str:
    """
    Classifies a visitor session into one of 7 standardized channels:
    PAID_META, OTHER_PAID, MESSAGING, ORGANIC_SOCIAL, ORGANIC_SEARCH, REFERRAL, DIRECT.

    STRICT SOURCE SEPARATION RULES:
    1. Paid Meta requires explicit ad_id / campaign_id OR utm_medium in ['paid', 'cpc', 'cpm', 'paidsocial', 'ads', 'ppc'].
    2. fbc / fbclid alone WITHOUT paid parameters is classified as ORGANIC_SOCIAL, because
       ordinary Facebook organic posts and shares append fbclid via link shims.
    3. Direct navigations never overwrite an existing known paid or organic touchpoint
       inside the attribution window (Last Non-Direct attribution principle).
    """
    src = (utm_source or "").lower().strip()
    med = (utm_medium or "").lower().strip()
    ref = (referrer or "").lower().strip()
    fbc_clean = (fbc or "").strip()
    fbclid_clean = (fbclid or "").strip()
    cid = (campaign_id or "").strip()
    aid = (ad_id or "").strip()

    is_paid_medium = med in ['paid', 'cpc', 'cpm', 'paidsocial', 'ads', 'ppc']
    has_meta_ad_ids = bool(cid or aid)

    # 1. Paid Meta Ads: Requires ad_id/campaign_id OR (Meta source + paid medium)
    if has_meta_ad_ids:
        return 'PAID_META'
    if src in ['facebook', 'fb', 'instagram', 'ig', 'meta', 'an'] and is_paid_medium:
        return 'PAID_META'

    # 2. Other Paid Ads (Google, TikTok, etc.)
    if is_paid_medium or src in ['google_ads', 'tiktok_ads']:
        return 'OTHER_PAID'

    # 3. Direct Messaging Channels (WhatsApp, Messenger, Telegram)
    if src in ['whatsapp', 'messenger', 'telegram', 'viber', 'direct_chat'] or med in ['chat', 'messaging']:
        return 'MESSAGING'

    # 4. Organic Social (Note: fbclid/fbc alone falls here!)
    social_domains = ['facebook.com', 'instagram.com', 'tiktok.com', 'pinterest.com', 'linkedin.com', 'youtube.com']
    if any(domain in ref for domain in social_domains) or src in ['facebook', 'instagram', 'tiktok', 'social'] or fbc_clean or fbclid_clean or "fbclid" in ref:
        return 'ORGANIC_SOCIAL'

    # 5. Organic Search
    search_domains = ['google.', 'bing.', 'duckduckgo.', 'yahoo.', 'ecosia.']
    if any(domain in ref for domain in search_domains) or med in ['organic', 'search']:
        return 'ORGANIC_SEARCH'

    # 6. Referral
    if ref and not any(d in ref for d in ['poshplexbd.com', 'localhost', '127.0.0.1']):
        return 'REFERRAL'

    # 7. Direct / None
    return 'DIRECT'


def link_session_to_customer(session: VisitorSession, phone: str = "", email: str = "", user_id: Optional[int] = None, source: str = "checkout") -> Optional[CustomerProfile]:
    """
    M6: Resolves customer identity from phone/email/user, links to VisitorSession,
    and records an IdentityLink mapping visitor_id <-> CustomerProfile.
    Attribution joins on this table to trace cross-device and multi-session customer journeys.
    """
    profile = None
    if user_id:
        profile = CustomerProfile.objects.filter(user_id=user_id).first()

    clean_phone = ""
    if not profile and phone:
        # Match by last 10 digits to normalize Bangladeshi prefixes (e.g. 017... or +88017...)
        clean_phone = ''.join(filter(str.isdigit, str(phone)))
        if len(clean_phone) >= 10:
            profile = CustomerProfile.objects.filter(phone__icontains=clean_phone[-10:]).first()

    if not profile and email:
        profile = CustomerProfile.objects.filter(email__iexact=email.strip()).first()

    if profile:
        session.customer = profile
        session.save(update_fields=['customer'])

        # Record IdentityLink table (M6 in Phase 1)
        IdentityLink.objects.get_or_create(
            visitor_id=session.visitor_id,
            customer=profile,
            defaults={
                "phone": clean_phone or getattr(profile, 'phone', '') or '',
                "email": email or getattr(profile, 'email', '') or '',
                "source": source,
                "confidence_score": 100
            }
        )
        # Also retroactively link previous sessions from this visitor
        VisitorSession.objects.filter(visitor_id=session.visitor_id, customer__isnull=True).update(customer=profile)

    return profile


def record_tracking_event(event_data: Dict[str, Any], ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> RawTrackingEvent:
    """
    Core intake processor: Validates schema, registers/updates VisitorSession,
    records IdentityLink, flags bots/staff, and writes append-only RawTrackingEvent.
    """
    event_id = event_data.get("event_id") or str(uuid.uuid4())
    event_name = (event_data.get("event_name") or "page_view").strip()
    visitor_id = (event_data.get("visitor_id") or "").strip()
    session_id = (event_data.get("session_id") or "").strip()

    # Fallback IDs if client missed them
    if not visitor_id:
        visitor_id = str(uuid.uuid4())
    if not session_id:
        session_id = str(uuid.uuid4())

    utm_source = str(event_data.get("utm_source") or "").strip()
    utm_medium = str(event_data.get("utm_medium") or "").strip()
    utm_campaign = str(event_data.get("utm_campaign") or "").strip()
    utm_content = str(event_data.get("utm_content") or "").strip()
    utm_term = str(event_data.get("utm_term") or "").strip()

    # Granular Ad IDs captured at landing
    meta_campaign_id = str(event_data.get("campaign_id") or event_data.get("meta_campaign_id") or "").strip()
    meta_adset_id = str(event_data.get("adset_id") or event_data.get("meta_adset_id") or "").strip()
    meta_ad_id = str(event_data.get("ad_id") or event_data.get("meta_ad_id") or "").strip()
    ad_name = str(event_data.get("ad_name") or utm_content or "").strip()

    fbc = str(event_data.get("fbc") or "").strip()
    fbp = str(event_data.get("fbp") or "").strip()
    landing_page = str(event_data.get("landing_page") or "")[:500]
    referrer = str(event_data.get("referrer") or "")[:500]

    ua_str = user_agent or ""
    is_bot = detect_bot_or_crawler(ua_str)
    is_internal = bool(event_data.get("is_internal") or "internal_test" in landing_page or (ip_address and ip_address.startswith("10.")))

    # Validate Schema
    quarantine_reason = ""
    status = "PROCESSED"
    if not event_name or len(event_name) > 100:
        status = "QUARANTINED"
        quarantine_reason = "Missing or excessively long event_name"

    # Resolve Campaign FK if utm_campaign or meta_campaign_id is provided
    campaign = None
    target_camp_id = meta_campaign_id or utm_campaign
    if target_camp_id:
        if target_camp_id.isdigit():
            campaign = Campaign.objects.filter(id=int(target_camp_id)).first()
        if not campaign:
            campaign = Campaign.objects.filter(meta_campaign_id=target_camp_id).first()
        if not campaign and utm_campaign:
            campaign = Campaign.objects.filter(name__iexact=utm_campaign).first()

    channel = classify_channel(
        utm_source=utm_source,
        utm_medium=utm_medium,
        utm_campaign=utm_campaign,
        campaign_id=meta_campaign_id,
        adset_id=meta_adset_id,
        ad_id=meta_ad_id,
        fbc=fbc,
        fbclid=event_data.get("fbclid", ""),
        referrer=referrer
    )

    # Last Non-Direct Rule: A direct visit NEVER replaces a known paid or organic source inside the 30-day window
    if channel == 'DIRECT':
        prior_session = VisitorSession.objects.filter(
            visitor_id=visitor_id,
            started_at__gte=timezone.now() - datetime.timedelta(days=30)
        ).exclude(channel_source='DIRECT').order_by('-started_at').first()

        if prior_session:
            channel = prior_session.channel_source
            campaign = prior_session.campaign
            if not meta_campaign_id: meta_campaign_id = prior_session.meta_campaign_id
            if not meta_adset_id: meta_adset_id = prior_session.meta_adset_id
            if not meta_ad_id: meta_ad_id = prior_session.meta_ad_id
            if not ad_name: ad_name = prior_session.ad_name
            if not utm_campaign: utm_campaign = prior_session.utm_campaign
            if not utm_source: utm_source = prior_session.utm_source

    # Find or create VisitorSession
    session = VisitorSession.objects.filter(session_id=session_id).first()
    if not session:
        session = VisitorSession.objects.create(
            visitor_id=visitor_id,
            session_id=session_id,
            channel_source=channel,
            campaign=campaign,
            utm_source=utm_source[:100],
            utm_medium=utm_medium[:100],
            utm_campaign=utm_campaign[:150],
            utm_content=utm_content[:150],
            utm_term=utm_term[:150],
            meta_campaign_id=meta_campaign_id[:100],
            meta_adset_id=meta_adset_id[:100],
            meta_ad_id=meta_ad_id[:100],
            ad_name=ad_name[:255],
            fbc=fbc[:255],
            fbp=fbp[:255],
            landing_page=landing_page,
            referrer=referrer,
            ip_address=ip_address,
            user_agent=ua_str,
            is_engaged=event_name in ['add_to_cart', 'initiate_checkout', 'purchase'],
            is_internal=is_internal,
            is_bot=is_bot,
            quality_score=0 if is_bot else (90 if is_internal else 100)
        )
    else:
        # Update session touchpoint details if newly acquired tags exist
        updated = False
        if not session.campaign and campaign:
            session.campaign = campaign
            updated = True
        if not session.meta_campaign_id and meta_campaign_id:
            session.meta_campaign_id = meta_campaign_id[:100]
            updated = True
        if not session.meta_ad_id and meta_ad_id:
            session.meta_ad_id = meta_ad_id[:100]
            updated = True
        if not session.fbc and fbc:
            session.fbc = fbc[:255]
            updated = True
        if not session.fbp and fbp:
            session.fbp = fbp[:255]
            updated = True
        if event_name in ['add_to_cart', 'initiate_checkout', 'purchase'] and not session.is_engaged:
            session.is_engaged = True
            updated = True
        if updated:
            session.save()

    # Identity Resolution: Link customer if phone/email/user in payload
    payload = event_data.get("payload") or {}
    phone_candidate = payload.get("phone") or event_data.get("phone")
    email_candidate = payload.get("email") or event_data.get("email")
    user_id_candidate = payload.get("user_id") or event_data.get("user_id")
    if phone_candidate or email_candidate or user_id_candidate:
        link_session_to_customer(session, phone=phone_candidate, email=email_candidate, user_id=user_id_candidate, source=event_name)

    # Save append-only raw tracking event
    client_ts = None
    if event_data.get("client_timestamp"):
        try:
            client_ts = timezone.datetime.fromisoformat(str(event_data["client_timestamp"]))
        except Exception:
            client_ts = None

    raw_event, _ = RawTrackingEvent.objects.get_or_create(
        event_id=event_id,
        defaults={
            "event_name": event_name,
            "session": session,
            "visitor_id": visitor_id,
            "payload": payload,
            "status": status,
            "quarantine_reason": quarantine_reason,
            "is_internal": is_internal,
            "is_bot": is_bot,
            "client_timestamp": client_ts
        }
    )
    return raw_event


def calculate_order_product_cogs(order: Order) -> Decimal:
    """
    Computes total Cost of Goods Sold (purchase price) for all items in an order.
    Looks up ProductVariant.purchase_price or Product.purchase_price.
    """
    from apps.catalog.models import ProductVariant, Product
    total_cogs = Decimal('0.00')

    for item in order.items.all():
        qty = Decimal(str(item.quantity))
        item_cost = None

        if item.sku:
            variant = ProductVariant.objects.filter(sku=item.sku).select_related('product').first()
            if variant:
                item_cost = variant.purchase_price or variant.product.purchase_price

        if item_cost is None:
            # Fallback estimation: standard 40% COGS of selling price
            item_cost = Decimal(str(item.price)) * Decimal('0.40')

        total_cogs += (Decimal(str(item_cost)) * qty)

    return total_cogs.quantize(Decimal('0.01'))


def calculate_courier_costs(order: Order) -> Dict[str, Decimal]:
    """
    Computes courier delivery cost and estimated return courier loss.
    Standard Dhaka: 80 BDT delivery. Outside Dhaka: 130 BDT delivery.
    Courier return loss: standard 50% return shipping penalty if returned.
    """
    dist = (order.shipping_district or "").lower()
    if "dhaka" in dist and "sub" not in dist:
        delivery_cost = Decimal('80.00')
        return_cost = Decimal('60.00')
    else:
        delivery_cost = Decimal('130.00')
        return_cost = Decimal('100.00')

    return {
        "delivery_cost": delivery_cost,
        "return_cost": return_cost
    }


def record_order_attribution_touchpoints(
    order_id: int,
    visitor_id: Optional[str] = None,
    session_id: Optional[str] = None,
    utm_campaign: Optional[str] = None,
    campaign_id: Optional[str] = None,
    ad_id: Optional[str] = None,
    fbc: Optional[str] = None,
    customer_phone: Optional[str] = None,
    attribution_window_days: int = 30
) -> List[OrderAttributionTouchpoint]:
    """
    Computes and stores multi-touch attribution credits for an order across:
    1. Last Paid Touch (Default)
    2. First Touch
    3. Linear (Equal Split)
    4. Position-Based (40/40/20)
    
    Also attaches financial metrics: Attributed Revenue, Gross Margin, and Courier Costs.
    """
    order = Order.objects.filter(id=order_id).first()
    if not order:
        logger.warning(f"Order #{order_id} not found for attribution calculation.")
        return []

    order_total = Decimal(str(order.total_amount))
    product_cogs = calculate_order_product_cogs(order)
    courier_rates = calculate_courier_costs(order)
    delivery_courier_cost = courier_rates["delivery_cost"]
    return_courier_loss = courier_rates["return_cost"]

    # Gross Margin before ad spend
    order_gross_margin = max(Decimal('0.00'), order_total - product_cogs - delivery_courier_cost)

    now = timezone.now()
    window_start = now - datetime.timedelta(days=attribution_window_days)

    # 1. Identity Resolution (M6): Collect all visitor_ids stitched to this customer
    linked_visitor_ids = set()
    if visitor_id:
        linked_visitor_ids.add(visitor_id)

    if customer_phone:
        clean_p = ''.join(filter(str.isdigit, str(customer_phone)))
        if len(clean_p) >= 10:
            # Link current visitor/session to customer profile
            if session_id or visitor_id:
                s_curr = None
                if session_id:
                    s_curr = VisitorSession.objects.filter(session_id=session_id).first()
                if not s_curr and visitor_id:
                    s_curr = VisitorSession.objects.filter(visitor_id=visitor_id).order_by('-started_at').first()
                if s_curr:
                    link_session_to_customer(s_curr, phone=clean_p, source="checkout")

            links = IdentityLink.objects.filter(customer__phone__icontains=clean_p[-10:])
            for l in links:
                linked_visitor_ids.add(l.visitor_id)

    # Find candidate sessions, excluding bot traffic (M8)
    sessions_query = VisitorSession.objects.filter(started_at__gte=window_start).exclude(is_bot=True)
    candidates = []

    # Match by linked visitor_ids
    if linked_visitor_ids:
        v_sessions = list(sessions_query.filter(visitor_id__in=linked_visitor_ids).order_by('started_at'))
        candidates.extend(v_sessions)

    # Match by customer profile directly (phone match)
    if customer_phone:
        clean_p = ''.join(filter(str.isdigit, str(customer_phone)))
        if len(clean_p) >= 10:
            c_sessions = list(sessions_query.filter(customer__phone__icontains=clean_p[-10:]).order_by('started_at'))
            for s in c_sessions:
                if s not in candidates:
                    candidates.append(s)

    # Match by active session_id
    if session_id:
        s_obj = sessions_query.filter(session_id=session_id).first()
        if s_obj and s_obj not in candidates:
            candidates.append(s_obj)

    # Sort candidates chronologically
    candidates = sorted(candidates, key=lambda s: s.started_at)

    # If no candidate sessions exist, attempt to resolve campaign from order/params and create a direct session
    fallback_campaign = None
    if campaign_id:
        if str(campaign_id).isdigit():
            fallback_campaign = Campaign.objects.filter(id=int(campaign_id)).exclude(status='ARCHIVED').first()
        if not fallback_campaign:
            fallback_campaign = Campaign.objects.filter(meta_campaign_id=str(campaign_id)).exclude(status='ARCHIVED').first()

    if not fallback_campaign and utm_campaign:
        if utm_campaign.isdigit():
            fallback_campaign = Campaign.objects.filter(id=int(utm_campaign)).exclude(status='ARCHIVED').first()
        if not fallback_campaign:
            fallback_campaign = Campaign.objects.filter(meta_campaign_id=utm_campaign).exclude(status='ARCHIVED').first()
        if not fallback_campaign:
            fallback_campaign = Campaign.objects.filter(name__iexact=utm_campaign).exclude(status='ARCHIVED').first()

    if not candidates:
        # Create a synthetic fallback session
        # Strict Rule 3: Paid Meta requires ad_id, campaign_id, or fallback_campaign. fbc alone = ORGANIC_SOCIAL.
        is_paid = bool(campaign_id or ad_id or fallback_campaign)
        channel_source = 'PAID_META' if is_paid else ('ORGANIC_SOCIAL' if fbc else 'DIRECT')
        fallback_session = VisitorSession.objects.create(
            visitor_id=visitor_id or str(uuid.uuid4()),
            session_id=session_id or str(uuid.uuid4()),
            channel_source=channel_source,
            campaign=fallback_campaign,
            meta_campaign_id=campaign_id or (fallback_campaign.meta_campaign_id if fallback_campaign else ""),
            meta_ad_id=ad_id or "",
            utm_campaign=utm_campaign or "",
            fbc=fbc or "",
            is_engaged=True
        )
        candidates = [fallback_session]

    touchpoints_count = len(candidates)

    # 2. Compute Credits for each model
    # Model A: Last Paid Touch
    paid_candidates = [s for s in candidates if s.channel_source in ['PAID_META', 'OTHER_PAID'] or s.campaign]
    last_paid_session = paid_candidates[-1] if paid_candidates else candidates[-1]

    # Model B: First Touch
    first_session = candidates[0]

    # Model C: Linear
    linear_share = Decimal('1.0000') / Decimal(str(touchpoints_count))

    # Model D: Position-Based (40% first, 40% last, 20% middle)
    pos_shares: Dict[int, Decimal] = {}
    if touchpoints_count == 1:
        pos_shares[candidates[0].id] = Decimal('1.0000')
    elif touchpoints_count == 2:
        pos_shares[candidates[0].id] = Decimal('0.5000')
        pos_shares[candidates[1].id] = Decimal('0.5000')
    else:
        first_id = candidates[0].id
        last_id = candidates[-1].id
        middle_count = touchpoints_count - 2
        middle_share = Decimal('0.2000') / Decimal(str(middle_count))
        pos_shares[first_id] = Decimal('0.4000')
        pos_shares[last_id] = Decimal('0.4000')
        for mid_s in candidates[1:-1]:
            pos_shares[mid_s.id] = middle_share

    # 3. Create or update OrderAttributionTouchpoint records
    created_touchpoints = []
    # Clear any previous touchpoints for this order to make idempotent
    OrderAttributionTouchpoint.objects.filter(order_id=order_id).delete()

    is_delivered = order.status in ['delivered', 'completed']
    is_returned = order.status in ['returned', 'cancelled']

    for s in candidates:
        lpt_credit = Decimal('1.0000') if s.id == last_paid_session.id else Decimal('0.0000')
        ft_credit = Decimal('1.0000') if s.id == first_session.id else Decimal('0.0000')
        lin_credit = linear_share
        pos_credit = pos_shares.get(s.id, Decimal('0.0000'))

        # By default, financial attribution values reflect Last Paid Touch credit
        tp_credit = lpt_credit

        touchpoint = OrderAttributionTouchpoint.objects.create(
            order_id=order_id,
            session=s,
            campaign=s.campaign or fallback_campaign,
            last_paid_credit=lpt_credit,
            first_touch_credit=ft_credit,
            linear_credit=lin_credit,
            position_based_credit=pos_credit,
            attributed_order_value=(order_total * tp_credit).quantize(Decimal('0.01')),
            attributed_delivered_revenue=(order_total * tp_credit).quantize(Decimal('0.01')) if is_delivered else Decimal('0.00'),
            attributed_gross_margin=(order_gross_margin * tp_credit).quantize(Decimal('0.01')) if is_delivered else Decimal('0.00'),
            attributed_return_loss=(return_courier_loss * tp_credit).quantize(Decimal('0.01')) if is_returned else Decimal('0.00')
        )
        created_touchpoints.append(touchpoint)

    logger.info(f"Generated {len(created_touchpoints)} attribution touchpoints for Order #{order_id}.")
    return created_touchpoints


def update_order_touchpoints_on_status_change(order_id: int, new_status: str):
    """
    Updates financial values on touchpoints when order lifecycle status changes
    (e.g. from CONFIRMED -> DELIVERED or RETURNED).
    """
    order = Order.objects.filter(id=order_id).first()
    if not order:
        return

    touchpoints = OrderAttributionTouchpoint.objects.filter(order_id=order_id)
    if not touchpoints.exists():
        # If no touchpoints were recorded at checkout, calculate now
        record_order_attribution_touchpoints(order_id=order_id, customer_phone=order.shipping_phone)
        touchpoints = OrderAttributionTouchpoint.objects.filter(order_id=order_id)

    order_total = Decimal(str(order.total_amount))
    product_cogs = calculate_order_product_cogs(order)
    courier_rates = calculate_courier_costs(order)
    delivery_courier_cost = courier_rates["delivery_cost"]
    return_courier_loss = courier_rates["return_cost"]
    order_gross_margin = max(Decimal('0.00'), order_total - product_cogs - delivery_courier_cost)

    new_status_lower = new_status.lower().strip()
    is_delivered = new_status_lower in ['delivered', 'completed']
    is_returned = new_status_lower in ['returned', 'cancelled']

    for tp in touchpoints:
        credit = tp.last_paid_credit
        tp.attributed_delivered_revenue = (order_total * credit).quantize(Decimal('0.01')) if is_delivered else Decimal('0.00')
        tp.attributed_gross_margin = (order_gross_margin * credit).quantize(Decimal('0.01')) if is_delivered else Decimal('0.00')
        tp.attributed_return_loss = (return_courier_loss * credit).quantize(Decimal('0.01')) if is_returned else Decimal('0.00')
        tp.save(update_fields=['attributed_delivered_revenue', 'attributed_gross_margin', 'attributed_return_loss'])


def rebuild_daily_ad_performance_summary(target_date: Optional[datetime.date] = None):
    """
    Rolls up daily campaign performance joining Meta ad spend with delivered orders,
    courier delivery expenses, product COGS, and true Net Ad Profit.
    """
    if not target_date:
        target_date = timezone.now().date()

    campaigns = Campaign.objects.exclude(status='ARCHIVED')
    summaries_created = 0

    for campaign in campaigns:
        # 1. Fetch latest snapshot performance metrics for target_date
        snapshots = PerformanceSnapshot.objects.filter(
            campaign=campaign,
            snapshot_time__date=target_date
        ).order_by('-snapshot_time')

        latest_snap = snapshots.first()
        spend_usd = latest_snap.spend if latest_snap else Decimal('0.00')
        impressions = latest_snap.impressions if latest_snap else 0
        clicks = latest_snap.clicks if latest_snap else 0
        link_clicks = latest_snap.link_clicks if latest_snap else 0

        # USD to BDT standard conversion rate (approx 122 BDT / USD)
        spend_bdt = (spend_usd * Decimal('122.00')).quantize(Decimal('0.01'))

        # 2. Aggregate Touchpoints for this campaign on target_date
        touchpoints = OrderAttributionTouchpoint.objects.filter(
            campaign=campaign,
            created_at__date=target_date
        )

        orders_placed = touchpoints.values('order_id').distinct().count()
        placed_rev = touchpoints.aggregate(total=Sum('attributed_order_value'))['total'] or Decimal('0.00')
        deliv_rev = touchpoints.aggregate(total=Sum('attributed_delivered_revenue'))['total'] or Decimal('0.00')
        gross_margin = touchpoints.aggregate(total=Sum('attributed_gross_margin'))['total'] or Decimal('0.00')
        return_loss = touchpoints.aggregate(total=Sum('attributed_return_loss'))['total'] or Decimal('0.00')

        # Count delivered & returned orders
        order_ids = list(touchpoints.values_list('order_id', flat=True))
        orders_delivered = Order.objects.filter(id__in=order_ids, status__in=['delivered', 'completed']).count()
        orders_returned = Order.objects.filter(id__in=order_ids, status__in=['returned', 'cancelled']).count()
        orders_confirmed = Order.objects.filter(id__in=order_ids).exclude(status__in=['pending', 'draft']).count()

        finished_count = orders_delivered + orders_returned
        delivery_rate = (Decimal(str(orders_delivered)) / Decimal(str(finished_count)) * Decimal('100.00')).quantize(Decimal('0.01')) if finished_count > 0 else Decimal('0.00')

        # Net Ad Profit = Gross Margin - Ad Spend - Return Courier Loss
        net_ad_profit = (gross_margin - spend_bdt - return_loss).quantize(Decimal('0.01'))
        roas_delivered = (deliv_rev / spend_bdt).quantize(Decimal('0.02')) if spend_bdt > 0 else Decimal('0.00')

        DailyAdPerformanceSummary.objects.update_or_create(
            date=target_date,
            campaign=campaign,
            defaults={
                "ad_account": campaign.ad_account,
                "spend_bdt": spend_bdt,
                "spend_usd": spend_usd,
                "impressions": impressions,
                "clicks": clicks,
                "link_clicks": link_clicks,
                "orders_placed": orders_placed,
                "orders_confirmed": orders_confirmed,
                "orders_delivered": orders_delivered,
                "orders_returned": orders_returned,
                "delivery_success_rate": delivery_rate,
                "placed_revenue": placed_rev,
                "delivered_revenue": deliv_rev,
                "gross_margin": gross_margin,
                "return_courier_loss": return_loss,
                "net_ad_profit": net_ad_profit,
                "roas_delivered": roas_delivered,
            }
        )
        summaries_created += 1

    logger.info(f"rebuild_daily_ad_performance_summary completed: {summaries_created} records updated for {target_date}.")
    return summaries_created
