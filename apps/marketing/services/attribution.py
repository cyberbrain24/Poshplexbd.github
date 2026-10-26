import logging
from decimal import Decimal
from django.db.models import Sum
from apps.marketing.models import Campaign, OrderAttribution

logger = logging.getLogger(__name__)

def calculate_campaign_attributed_revenue(campaign: Campaign, since=None, until=None) -> Decimal:
    """
    Calculate the total attributed revenue for a campaign from OrderAttribution records.
    Cross-checks orders without mutating the apps.orders schema.
    """
    qs = OrderAttribution.objects.filter(campaign=campaign)
    if since:
        qs = qs.filter(created_at__gte=since)
    if until:
        qs = qs.filter(created_at__lte=until)

    agg = qs.aggregate(total_rev=Sum('order_total'))
    revenue = agg.get('total_rev') or Decimal('0.00')

    # Also check if any unlinked attributions match utm_campaign == str(campaign.id)
    unlinked = OrderAttribution.objects.filter(campaign__isnull=True, utm_campaign=str(campaign.id))
    if since:
        unlinked = unlinked.filter(created_at__gte=since)
    if until:
        unlinked = unlinked.filter(created_at__lte=until)

    unlinked_rev = unlinked.aggregate(total_rev=Sum('order_total')).get('total_rev') or Decimal('0.00')

    # Automatically link the unlinked attributions to this campaign for future queries
    if unlinked.exists():
        unlinked.update(campaign=campaign)

    return Decimal(str(revenue + unlinked_rev))

def record_order_attribution(order_id: int, utm_campaign: str = "", fbclid: str = "", order_total: Decimal = Decimal('0.00')) -> OrderAttribution:
    """
    Record an attribution touchpoint when a customer completes checkout with UTM/Meta tags.
    """
    campaign = None
    if utm_campaign:
        try:
            # Check if utm_campaign is a numeric Campaign ID
            if utm_campaign.isdigit():
                campaign = Campaign.objects.filter(id=int(utm_campaign)).first()
            if not campaign:
                campaign = Campaign.objects.filter(name__iexact=utm_campaign).first()
        except Exception:
            pass

    attribution, _ = OrderAttribution.objects.get_or_create(
        order_id=order_id,
        defaults={
            "campaign": campaign,
            "fbclid": fbclid or "",
            "utm_campaign": utm_campaign or "",
            "order_total": order_total,
        }
    )
    return attribution
