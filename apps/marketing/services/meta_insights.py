import logging
from typing import Dict, Any, List
from decimal import Decimal
from apps.marketing.models import MetaAdAccount, Campaign, PerformanceSnapshot
from apps.marketing.services.meta_client import MetaAPIClient, get_cached_insights, set_cached_insights

logger = logging.getLogger(__name__)

def fetch_insights(ad_account: MetaAdAccount, since: str, until: str) -> List[Dict[str, Any]]:
    """
    Fetch performance insights from Meta Marketing API v21.0 for an Ad Account.
    Checks Redis cache first (TTL 15 mins) using key: meta_insights:{account_id}:{date_range}.
    Returns metrics broken down by Campaign level.
    """
    date_range = f"{since}_{until}"
    cached = get_cached_insights(ad_account.meta_account_id, date_range)
    if cached is not None:
        logger.debug(f"Returning cached insights for {ad_account.meta_account_id} ({date_range})")
        return cached

    token = ad_account.get_access_token()
    client = MetaAPIClient(token, account_id=ad_account.meta_account_id)
    account_prefix = ad_account.meta_account_id
    if not account_prefix.startswith("act_"):
        account_prefix = f"act_{account_prefix}"

    params = {
        "level": "campaign",
        "fields": "campaign_id,campaign_name,spend,impressions,clicks,cpc,ctr,actions",
        "time_range": f'{{"since":"{since}","until":"{until}"}}',
        "limit": 100,
    }

    res = client.get(f"{account_prefix}/insights", params=params)
    data = res.get("data", [])

    results = []
    for item in data:
        # Extract purchase conversions from actions list
        actions = item.get("actions", [])
        conversions = 0
        for act in actions:
            if act.get("action_type") in ("purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"):
                try:
                    conversions += int(act.get("value", 0))
                except (ValueError, TypeError):
                    pass

        spend_val = Decimal(str(item.get("spend", "0.00")))
        impressions_val = int(item.get("impressions", 0))
        clicks_val = int(item.get("clicks", 0))
        cpc_val = Decimal(str(item.get("cpc", "0.00"))) if clicks_val > 0 else Decimal('0.00')
        ctr_val = float(item.get("ctr", 0.0))

        results.append({
            "meta_campaign_id": item.get("campaign_id"),
            "campaign_name": item.get("campaign_name"),
            "spend": spend_val,
            "impressions": impressions_val,
            "clicks": clicks_val,
            "conversions": conversions,
            "cpc": cpc_val,
            "ctr": ctr_val,
        })

    # Cache in Redis with 15-minute TTL
    set_cached_insights(ad_account.meta_account_id, date_range, results, ttl=900)
    return results
