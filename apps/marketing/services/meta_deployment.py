import logging
from typing import Dict, Any, List
from django.db import transaction
from django.utils import timezone
from apps.marketing.models import Campaign, AdSet, Creative
from apps.marketing.services.meta_client import MetaAPIClient, MetaAPIError

from decimal import Decimal

logger = logging.getLogger(__name__)

# Objective mapping from internal enum to Graph API v21.0
META_OBJECTIVE_MAP = {
    'SALES': 'OUTCOME_SALES',
    'TRAFFIC': 'OUTCOME_TRAFFIC',
    'LEAD': 'OUTCOME_LEADS',
    'AWARENESS': 'OUTCOME_AWARENESS',
}

def validate_pre_deployment(campaign: Campaign) -> None:
    """
    Hard Pre-Deployment Safety Checks (Meta Ad Spend Burn Protection):
      1. Product Stock & Active State: Never run ads for sold-out or archived products.
      2. Ad Account State: Ensure ad account is active.
      3. Max Budget Cap: budget_amount must be <= max_budget_cap (if cap set).
      4. First-Time Campaign Safety Limit: For new test campaigns in first 24h, budget <= 1000 BDT / $10.
    """
    ad_account = campaign.ad_account
    if not ad_account.is_active:
        raise ValueError(f"Pre-deploy Check Failed: Ad Account '{ad_account.name}' is deactivated.")

    # 1. Product Availability Check
    if campaign.linked_product:
        product = campaign.linked_product
        if not product.is_active:
            raise ValueError(f"Pre-deploy Check Failed: Linked product '{product.name}' is INACTIVE. Cannot deploy ads for inactive products.")
        if getattr(product, 'is_sold_out', False):
            raise ValueError(f"Pre-deploy Check Failed: Linked product '{product.name}' is SOLD OUT. Ads blocked to prevent burning ad spend on zero stock.")
        if hasattr(product, 'stock') and product.stock <= 0:
            raise ValueError(f"Pre-deploy Check Failed: Linked product '{product.name}' has 0 stock units available.")

    # 2. Hard max budget cap check
    if campaign.max_budget_cap and campaign.max_budget_cap > Decimal('0.00'):
        if campaign.budget_amount > campaign.max_budget_cap:
            raise ValueError(
                f"Pre-deploy Check Failed: Campaign budget ({campaign.budget_amount}) exceeds hard max_budget_cap ({campaign.max_budget_cap})."
            )

    # 3. First-Time Test Campaign Safety Limit ($10 USD or 1000 BDT)
    if campaign.is_first_time_test:
        currency = (ad_account.currency or 'USD').upper()
        max_test_budget = Decimal('10.00') if currency == 'USD' else (Decimal('1000.00') if currency == 'BDT' else Decimal('10.00'))
        if campaign.budget_amount > max_test_budget:
            raise ValueError(
                f"Pre-deploy Check Failed: New test campaign budget ({campaign.budget_amount} {currency}) exceeds the initial 24h safety limit of ${max_test_budget} {currency}."
            )

def deploy_campaign(campaign_id: int) -> Dict[str, Any]:
    """
    Deploys a complete Campaign -> AdSet -> AdCreative -> Ad hierarchy to Meta Graph API.
    Performs hard pre-flight validations, ensures idempotency, and rolls back on failure.
    """
    campaign = Campaign.objects.select_related('ad_account', 'linked_product').prefetch_related('adsets__creatives').get(id=campaign_id)
    ad_account = campaign.ad_account

    # Execute hard pre-deployment burn protection check
    try:
        validate_pre_deployment(campaign)
    except Exception as e:
        campaign.status = 'ERROR'
        campaign.last_error = str(e)
        campaign.save(update_fields=['status', 'last_error', 'updated_at'])
        logger.error(f"Pre-deploy validation blocked Campaign #{campaign.id}: {e}")
        raise

    token = ad_account.get_access_token()
    client = MetaAPIClient(token, account_id=ad_account.meta_account_id)
    account_prefix = ad_account.meta_account_id
    if not account_prefix.startswith("act_"):
        account_prefix = f"act_{account_prefix}"

    campaign.status = 'DEPLOYING'
    campaign.last_error = None
    campaign.save(update_fields=['status', 'last_error', 'updated_at'])

    created_meta_ids: List[Dict[str, str]] = []

    try:
        # ====================================================================
        # Step 1: Deploy / Verify Meta Campaign
        # ====================================================================
        if not campaign.meta_campaign_id:
            meta_obj = META_OBJECTIVE_MAP.get(campaign.objective, 'OUTCOME_SALES')
            camp_payload = {
                "name": campaign.name,
                "objective": meta_obj,
                "status": "PAUSED",  # Created in PAUSED state until all children are wired
                "special_ad_categories": [],
            }
            res = client.post(f"{account_prefix}/campaigns", json_data=camp_payload)
            campaign.meta_campaign_id = res["id"]
            campaign.save(update_fields=['meta_campaign_id', 'updated_at'])
            created_meta_ids.append({"type": "campaign", "id": campaign.meta_campaign_id})
            logger.info(f"Created Meta Campaign {campaign.meta_campaign_id} for local Campaign #{campaign.id}")

        # ====================================================================
        # Step 2: Deploy / Verify AdSets
        # ====================================================================
        adsets = campaign.adsets.all()
        if not adsets.exists():
            # If no AdSet exists, create a default one based on product/campaign budget
            default_adset = AdSet.objects.create(
                campaign=campaign,
                name=f"{campaign.name} - AdSet",
                targeting={
                    "age_min": 18,
                    "age_max": 45,
                    "geo_locations": {"countries": ["BD"]},
                    "publisher_platforms": ["facebook", "instagram"]
                },
                daily_budget=campaign.budget_amount,
            )
            adsets = [default_adset]

        for adset in adsets:
            if not adset.meta_adset_id:
                # Format targeting safely for Meta API v21.0
                targeting = adset.targeting or {}
                if "geo_locations" not in targeting:
                    targeting["geo_locations"] = {"countries": ["BD"]}

                # Meta accepts budgets in sub-units (e.g. cents/poisha -> 100)
                budget_amount = int((adset.daily_budget or campaign.budget_amount) * 100)

                optimization_goal = "OFFSITE_CONVERSIONS" if campaign.objective == 'SALES' else "LINK_CLICKS"

                adset_payload = {
                    "name": adset.name,
                    "campaign_id": campaign.meta_campaign_id,
                    "daily_budget": budget_amount,
                    "billing_event": "IMPRESSIONS",
                    "optimization_goal": optimization_goal,
                    "targeting": targeting,
                    "status": "ACTIVE",
                }
                res = client.post(f"{account_prefix}/adsets", json_data=adset_payload)
                adset.meta_adset_id = res["id"]
                adset.save(update_fields=['meta_adset_id', 'updated_at'])
                created_meta_ids.append({"type": "adset", "id": adset.meta_adset_id})
                logger.info(f"Created Meta AdSet {adset.meta_adset_id} for AdSet #{adset.id}")

            # ================================================================
            # Step 3: Deploy / Verify Creatives & Ads
            # ================================================================
            creatives = adset.creatives.all()
            if not creatives.exists():
                # Generate default creative from product or fallback
                img_url = ""
                headline = campaign.name
                if campaign.linked_product:
                    headline = campaign.linked_product.name
                    first_img = campaign.linked_product.images.first()
                    if first_img:
                        img_url = first_img.image.url if hasattr(first_img.image, 'url') else str(first_img.image)

                default_creative = Creative.objects.create(
                    adset=adset,
                    name=f"{campaign.name} - Default Creative",
                    headline=headline[:100],
                    primary_text="Discover the latest streetwear collection at PoshPlex. Premium fabrics, oversized cuts, engineered for Dhaka streets.",
                    call_to_action="SHOP_NOW",
                    image_url=img_url or "https://store.poshplexbd.com/logo.png"
                )
                creatives = [default_creative]

            for creative in creatives:
                # 3A: Create AdCreative on Meta
                if not creative.meta_creative_id:
                    link_url = "https://store.poshplexbd.com"
                    if campaign.linked_product:
                        link_url = f"https://store.poshplexbd.com/product/{campaign.linked_product.slug}?utm_source=facebook&utm_medium=paid&utm_campaign={campaign.id}"

                    creative_payload = {
                        "name": creative.name,
                        "object_story_spec": {
                            "page_id": ad_account.meta_account_id.replace("act_", ""),
                            "link_data": {
                                "message": creative.primary_text,
                                "link": link_url,
                                "name": creative.headline,
                                "description": creative.description or "PoshPlex Official Store",
                                "picture": creative.image_url or "https://store.poshplexbd.com/logo.png",
                                "call_to_action": {
                                    "type": creative.call_to_action,
                                    "value": {"link": link_url}
                                }
                            }
                        }
                    }
                    res = client.post(f"{account_prefix}/adcreatives", json_data=creative_payload)
                    creative.meta_creative_id = res["id"]
                    creative.save(update_fields=['meta_creative_id', 'updated_at'])
                    created_meta_ids.append({"type": "creative", "id": creative.meta_creative_id})

                # 3B: Create Ad on Meta linking AdCreative to AdSet
                if not creative.meta_ad_id:
                    ad_payload = {
                        "name": f"Ad - {creative.name}",
                        "adset_id": adset.meta_adset_id,
                        "creative": {"creative_id": creative.meta_creative_id},
                        "status": "ACTIVE",
                    }
                    res = client.post(f"{account_prefix}/ads", json_data=ad_payload)
                    creative.meta_ad_id = res["id"]
                    creative.save(update_fields=['meta_ad_id', 'updated_at'])
                    created_meta_ids.append({"type": "ad", "id": creative.meta_ad_id})

        # ====================================================================
        # Step 4: Finalize & Activate Campaign on Meta
        # ====================================================================
        client.post(f"{campaign.meta_campaign_id}", json_data={"status": "ACTIVE"})
        campaign.status = 'ACTIVE'
        campaign.save(update_fields=['status', 'updated_at'])
        logger.info(f"Campaign #{campaign.id} successfully deployed and activated on Meta!")

        return {
            "success": True,
            "campaign_id": campaign.id,
            "meta_campaign_id": campaign.meta_campaign_id,
            "nodes_created": created_meta_ids
        }

    except Exception as e:
        logger.error(f"Deployment failed for Campaign #{campaign.id}: {str(e)}", exc_info=True)
        campaign.status = 'ERROR'
        campaign.last_error = str(e)
        campaign.save(update_fields=['status', 'last_error', 'updated_at'])

        # Automatic Rollback of partial nodes
        if not client.mock_mode:
            for node in reversed(created_meta_ids):
                try:
                    client.delete(f"{node['id']}")
                    logger.info(f"Rolled back node {node['type']} {node['id']}")
                except Exception as rollback_err:
                    logger.warning(f"Rollback error for {node['id']}: {rollback_err}")

        raise e
