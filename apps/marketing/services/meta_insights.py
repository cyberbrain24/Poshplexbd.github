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
        "fields": "campaign_id,campaign_name,spend,impressions,reach,frequency,cpm,inline_link_clicks,cost_per_inline_link_click,clicks,ctr,cpc,actions,cost_per_action_type",
        "time_range": f'{{"since":"{since}","until":"{until}"}}',
        "limit": 100,
    }

    res = client.get(f"{account_prefix}/insights", params=params)
    data = res.get("data", [])

    results = []
    for item in data:
        actions = item.get("actions", [])
        cost_per_actions = item.get("cost_per_action_type", [])

        conversions = 0
        landing_page_views = 0
        shop_clicks = 0

        for act in actions:
            act_type = act.get("action_type", "")
            try:
                act_val = int(act.get("value", 0))
            except (ValueError, TypeError):
                act_val = 0

            if act_type in ("purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"):
                conversions += act_val
            elif act_type == "landing_page_view":
                landing_page_views += act_val
            elif act_type in ("onsite_conversion.post_save", "commerce_merchant_settings", "view_content", "onsite_conversion.messaging_user_initiated"):
                shop_clicks += act_val

        spend_val = Decimal(str(item.get("spend", "0.00")))
        impressions_val = int(item.get("impressions", 0))
        reach_val = int(item.get("reach", 0)) or impressions_val
        freq_val = float(item.get("frequency", 1.0)) if item.get("frequency") else (round(impressions_val / reach_val, 2) if reach_val > 0 else 1.0)
        
        cpm_val = Decimal(str(item.get("cpm", "0.00"))) if item.get("cpm") else (
            round((spend_val / Decimal(impressions_val)) * Decimal('1000.00'), 2) if impressions_val > 0 else Decimal('0.00')
        )

        clicks_val = int(item.get("clicks", 0)) # Total clicks
        link_clicks_val = int(item.get("inline_link_clicks", 0))
        if link_clicks_val == 0 and clicks_val > 0:
            link_clicks_val = clicks_val

        cpc_link_val = Decimal(str(item.get("cost_per_inline_link_click", "0.00"))) if item.get("cost_per_inline_link_click") else (
            round(spend_val / Decimal(link_clicks_val), 2) if link_clicks_val > 0 else Decimal('0.00')
        )
        cpc_all_val = Decimal(str(item.get("cpc", "0.00"))) if item.get("cpc") else (
            round(spend_val / Decimal(clicks_val), 2) if clicks_val > 0 else Decimal('0.00')
        )
        ctr_val = float(item.get("ctr", 0.0))

        # Parse cost_per_action_type
        cost_per_result_val = Decimal('0.00')
        cost_per_lp_val = Decimal('0.00')
        for cpa in cost_per_actions:
            cpa_type = cpa.get("action_type", "")
            if cpa_type in ("purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"):
                try:
                    cost_per_result_val = Decimal(str(cpa.get("value", "0.00")))
                except Exception:
                    pass
            elif cpa_type == "landing_page_view":
                try:
                    cost_per_lp_val = Decimal(str(cpa.get("value", "0.00")))
                except Exception:
                    pass

        if cost_per_result_val == Decimal('0.00') and conversions > 0:
            cost_per_result_val = round(spend_val / Decimal(conversions), 2)
        if cost_per_lp_val == Decimal('0.00') and landing_page_views > 0:
            cost_per_lp_val = round(spend_val / Decimal(landing_page_views), 2)

        results.append({
            "meta_campaign_id": item.get("campaign_id"),
            "campaign_name": item.get("campaign_name"),
            "spend": spend_val,
            "impressions": impressions_val,
            "reach": reach_val,
            "frequency": freq_val,
            "cpm": cpm_val,
            "clicks": clicks_val, # total clicks
            "link_clicks": link_clicks_val,
            "cost_per_link_click": cpc_link_val,
            "cpc": cpc_all_val,
            "ctr": ctr_val,
            "conversions": conversions,
            "cost_per_result": cost_per_result_val,
            "shop_clicks": shop_clicks,
            "landing_page_views": landing_page_views,
            "cost_per_landing_page": cost_per_lp_val,
        })

    # Cache in Redis with 15-minute TTL
    set_cached_insights(ad_account.meta_account_id, date_range, results, ttl=900)
    return results
