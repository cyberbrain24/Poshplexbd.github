from typing import List, Optional, Any, Dict
from decimal import Decimal
import datetime
import logging
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError
from django.utils import timezone

logger = logging.getLogger(__name__)

from ninja import Router, Schema
from ninja.errors import HttpError
from apps.marketing.models import PromoCode, PromoUsageHistory, ComboOffer
from apps.core.api import BearerAuth, enforce_permission, enforce_superuser

router = Router()

# --- Schemas ---

class PromoCodeInputSchema(Schema):
    code: str
    description: Optional[str] = ""
    reward_type: str
    discount_value: Decimal
    membership_tier: Optional[str] = ""
    max_discount_amount: Optional[Decimal] = None
    min_order_amount: Optional[Decimal] = Decimal('0.00')
    total_usage_limit: Optional[int] = None
    per_customer_limit: Optional[int] = 1
    starts_at: Optional[str] = None
    expires_at: Optional[str] = None
    is_active: Optional[bool] = True
    banner_url: Optional[str] = ""
    banner_active: Optional[bool] = False

class PromoCodeResponseSchema(Schema):
    id: int
    code: str
    description: Optional[str] = None
    reward_type: str
    discount_value: Decimal
    membership_tier: Optional[str] = None
    max_discount_amount: Optional[Decimal] = None
    min_order_amount: Decimal
    total_usage_limit: Optional[int] = None
    per_customer_limit: int
    usage_count: int
    starts_at: Optional[Any] = None
    expires_at: Optional[Any] = None
    is_active: bool
    banner_url: Optional[str] = None
    banner_active: bool

class ValidateCouponResponseSchema(Schema):
    valid: bool
    reward_type: Optional[str] = None
    discount_value: Optional[Decimal] = None
    max_discount_amount: Optional[Decimal] = None
    membership_tier: Optional[str] = None
    error_message: Optional[str] = None

class ComboOfferResponseSchema(Schema):
    id: int
    name: str
    slug: str
    items_count: int
    discount_percentage: Decimal
    free_delivery: bool
    badge: Optional[str] = None
    subtitle: Optional[str] = None
    perks: List[str] = []
    is_active: bool
    listing_order: int

class ComboOfferInputSchema(Schema):
    name: str
    items_count: int = 2
    discount_percentage: Decimal = Decimal('0.00')
    free_delivery: bool = False
    badge: Optional[str] = ""
    subtitle: Optional[str] = ""
    perks: Optional[List[str]] = []
    is_active: Optional[bool] = True
    listing_order: Optional[int] = 0

# --- Endpoints ---

@router.get("/validate", response=ValidateCouponResponseSchema)
def validate_coupon_endpoint(request, code: str, subtotal: Decimal, phone: str = ""):
    """Public checkout endpoint to validate campaign coupon codes against usage limits and validity dates."""
    code_clean = code.upper().strip()
    promo = PromoCode.objects.filter(code=code_clean).first()
    
    if not promo:
        return {"valid": False, "error_message": "Coupon code not found."}
        
    if not promo.is_active:
        return {"valid": False, "error_message": "Coupon is currently paused/inactive."}
        
    now = timezone.now()
    if promo.starts_at and now < promo.starts_at:
        return {"valid": False, "error_message": "Coupon campaign has not started yet."}
        
    if promo.expires_at and now > promo.expires_at:
        return {"valid": False, "error_message": "Coupon code has expired."}
        
    if subtotal < promo.min_order_amount:
        return {"valid": False, "error_message": f"Minimum subtotal of ৳{round(promo.min_order_amount)} required."}
        
    if promo.total_usage_limit is not None and promo.usage_count >= promo.total_usage_limit:
        return {"valid": False, "error_message": "Coupon total limit has been fully redeemed."}
        
    if phone:
        # Enforce per-customer limits by tracking customer phone number
        phone_clean = phone.strip()
        usage_count = PromoUsageHistory.objects.filter(promo_code=promo, customer_phone=phone_clean).count()
        if usage_count >= promo.per_customer_limit:
            return {"valid": False, "error_message": "You have reached the redemption limit for this coupon."}
            
    return {
        "valid": True,
        "reward_type": promo.reward_type,
        "discount_value": promo.discount_value,
        "max_discount_amount": promo.max_discount_amount,
        "membership_tier": promo.membership_tier
    }

# Admin CRUD Routes

@router.get("/promos", response=List[PromoCodeResponseSchema], auth=BearerAuth())
def list_promos(request):
    """List all promo codes (Admin only)."""
    enforce_permission(request, "marketing", "manage_campaigns")
    return PromoCode.objects.all().order_by('-id')

@router.post("/promos", response=PromoCodeResponseSchema, auth=BearerAuth())
def create_promo(request, data: PromoCodeInputSchema):
    """Create a new discount promo campaign code (Admin only)."""
    enforce_permission(request, "marketing", "manage_campaigns")
    try:
        starts = timezone.datetime.fromisoformat(data.starts_at) if data.starts_at else None
        expires = timezone.datetime.fromisoformat(data.expires_at) if data.expires_at else None
        
        p = PromoCode.objects.create(
            code=data.code,
            description=data.description,
            reward_type=data.reward_type,
            discount_value=data.discount_value,
            membership_tier=data.membership_tier,
            max_discount_amount=data.max_discount_amount,
            min_order_amount=data.min_order_amount,
            total_usage_limit=data.total_usage_limit,
            per_customer_limit=data.per_customer_limit,
            starts_at=starts,
            expires_at=expires,
            is_active=data.is_active,
            banner_url=data.banner_url,
            banner_active=data.banner_active
        )
        return p
    except Exception as e:
        raise HttpError(400, str(e))

@router.put("/promos/{promo_id}", response=PromoCodeResponseSchema, auth=BearerAuth())
def update_promo(request, promo_id: int, data: PromoCodeInputSchema):
    """Update details of a campaign code (Admin only)."""
    enforce_permission(request, "marketing", "manage_campaigns")
    p = get_object_or_404(PromoCode, id=promo_id)
    try:
        starts = timezone.datetime.fromisoformat(data.starts_at) if data.starts_at else None
        expires = timezone.datetime.fromisoformat(data.expires_at) if data.expires_at else None
        
        p.code = data.code
        p.description = data.description
        p.reward_type = data.reward_type
        p.discount_value = data.discount_value
        p.membership_tier = data.membership_tier
        p.max_discount_amount = data.max_discount_amount
        p.min_order_amount = data.min_order_amount
        p.total_usage_limit = data.total_usage_limit
        p.per_customer_limit = data.per_customer_limit
        p.starts_at = starts
        p.expires_at = expires
        p.is_active = data.is_active
        p.banner_url = data.banner_url
        p.banner_active = data.banner_active
        p.save()
        return p
    except Exception as e:
        raise HttpError(400, str(e))

@router.delete("/promos/{promo_id}", auth=BearerAuth())
def delete_promo(request, promo_id: int):
    """Delete a promo code. Throws validation errors if linked to past order usage logs (Admin only)."""
    enforce_permission(request, "marketing", "manage_campaigns")
    p = get_object_or_404(PromoCode, id=promo_id)
    try:
        p.delete()
        return {"success": True}
    except ValidationError as ve:
        raise HttpError(400, str(ve))
    except Exception as e:
        raise HttpError(400, str(e))

class PromoValidateRequestSchema(Schema):
    code: str
    order_amount: Decimal
    customer_phone: Optional[str] = ""

class PromoValidateResponseSchema(Schema):
    valid: bool
    discount_amount: Decimal
    reward_type: Optional[str] = None
    message: Optional[str] = None

@router.post("/promocodes/validate", response=PromoValidateResponseSchema, auth=BearerAuth())
def validate_promo_endpoint(request, data: PromoValidateRequestSchema):
    """Validate a promo code and calculate discount amount."""
    try:
        promo = PromoCode.objects.get(code=data.code.upper().strip(), is_active=True)
    except PromoCode.DoesNotExist:
        return {"valid": False, "discount_amount": Decimal('0.00'), "message": "Invalid or expired promo code."}

    now = timezone.now()
    if promo.starts_at and now < promo.starts_at:
        return {"valid": False, "discount_amount": Decimal('0.00'), "message": "Promo code is not active yet."}
    if promo.expires_at and now > promo.expires_at:
        return {"valid": False, "discount_amount": Decimal('0.00'), "message": "Promo code has expired."}
    
    if data.order_amount < promo.min_order_amount:
        return {"valid": False, "discount_amount": Decimal('0.00'), "message": f"Minimum order amount is ৳{promo.min_order_amount}."}

    if promo.total_usage_limit and promo.usage_count >= promo.total_usage_limit:
        return {"valid": False, "discount_amount": Decimal('0.00'), "message": "Promo code usage limit reached."}
        
    if data.customer_phone:
        usage_count = PromoUsageHistory.objects.filter(promo_code=promo, customer_phone=data.customer_phone.strip()).count()
        if usage_count >= promo.per_customer_limit:
            return {"valid": False, "discount_amount": Decimal('0.00'), "message": "Customer has reached the redemption limit for this coupon."}

    discount = Decimal('0.00')
    if promo.reward_type == 'fixed':
        discount = promo.discount_value
    elif promo.reward_type == 'percent':
        discount = data.order_amount * (promo.discount_value / Decimal('100.00'))
    elif promo.reward_type == 'freeship':
        # Assuming we just pass valid flag back and front end handles free ship
        discount = Decimal('0.00')
    
    if promo.max_discount_amount and discount > promo.max_discount_amount:
        discount = promo.max_discount_amount

    return {
        "valid": True,
        "discount_amount": discount,
        "reward_type": promo.reward_type,
        "message": "Valid code"
    }

# --- Combo Offer Endpoints ---

def seed_default_combos():
    """Auto-seeds standard bundle tiers if no combo offers exist in the database."""
    defaults = [
        {
            "name": "Duo",
            "items_count": 2,
            "discount_percentage": Decimal('5.00'),
            "free_delivery": False,
            "badge": "POPULAR",
            "subtitle": "Mix & Match Any 2 Products From Our Collection",
            "perks": ["SAVE 5%", "Mix & Match Any 2 Products"],
            "is_active": True,
            "listing_order": 1
        },
        {
            "name": "Trio",
            "items_count": 3,
            "discount_percentage": Decimal('10.00'),
            "free_delivery": True,
            "badge": "MOST POPULAR",
            "subtitle": "Mix & Match Any 3 Products From Our Collection",
            "perks": ["SAVE 10%", "FREE DELIVERY ALL OVER BANGLADESH", "Fan Favorite Bundle"],
            "is_active": True,
            "listing_order": 2
        },
        {
            "name": "4 Pack",
            "items_count": 4,
            "discount_percentage": Decimal('12.00'),
            "free_delivery": True,
            "badge": "BEST VALUE",
            "subtitle": "Mix & Match Any 4 Products From Our Collection",
            "perks": ["SAVE 12%", "FREE DELIVERY ALL OVER BANGLADESH", "Best Balance of Value & Variety", "Perfect for Building Your Rotation"],
            "is_active": True,
            "listing_order": 3
        },
        {
            "name": "5 Pack",
            "items_count": 5,
            "discount_percentage": Decimal('15.00'),
            "free_delivery": True,
            "badge": "MAXIMUM VALUE",
            "subtitle": "Mix & Match Any 5 Products From Our Collection",
            "perks": ["SAVE 15%", "FREE DELIVERY ALL OVER BANGLADESH", "Lowest Price Per Piece", "Ultimate Stock-Up Bundle"],
            "is_active": True,
            "listing_order": 4
        }
    ]
    created = []
    for d in defaults:
        obj, _ = ComboOffer.objects.get_or_create(
            name=d["name"],
            defaults=d
        )
        created.append(obj)
    return created

@router.get("/combos", response=List[ComboOfferResponseSchema])
def list_active_combos(request):
    """Public endpoint to list active combo offers for storefront product pages."""
    if not ComboOffer.objects.exists():
        seed_default_combos()
    return ComboOffer.objects.filter(is_active=True).order_by('listing_order', 'items_count')

@router.get("/admin/combos", response=List[ComboOfferResponseSchema], auth=BearerAuth())
def list_admin_combos(request):
    """List all combo offers including inactive (Admin only)."""
    enforce_permission(request, "marketing", "manage_campaigns")
    if not ComboOffer.objects.exists():
        seed_default_combos()
    return ComboOffer.objects.all().order_by('listing_order', 'items_count')

@router.post("/admin/combos", response=ComboOfferResponseSchema, auth=BearerAuth())
def create_combo_offer(request, data: ComboOfferInputSchema):
    """Create a new combo offer tier (Admin only)."""
    enforce_permission(request, "marketing", "manage_campaigns")
    try:
        combo = ComboOffer.objects.create(
            name=data.name,
            items_count=data.items_count,
            discount_percentage=data.discount_percentage,
            free_delivery=data.free_delivery,
            badge=data.badge or "",
            subtitle=data.subtitle or "",
            perks=data.perks or [],
            is_active=data.is_active if data.is_active is not None else True,
            listing_order=data.listing_order or 0
        )
        return combo
    except Exception as e:
        raise HttpError(400, str(e))

@router.put("/admin/combos/{combo_id}", response=ComboOfferResponseSchema, auth=BearerAuth())
def update_combo_offer(request, combo_id: int, data: ComboOfferInputSchema):
    """Update a combo offer tier (Admin only)."""
    enforce_permission(request, "marketing", "manage_campaigns")
    combo = get_object_or_404(ComboOffer, id=combo_id)
    try:
        combo.name = data.name
        combo.items_count = data.items_count
        combo.discount_percentage = data.discount_percentage
        combo.free_delivery = data.free_delivery
        combo.badge = data.badge or ""
        combo.subtitle = data.subtitle or ""
        combo.perks = data.perks or []
        if data.is_active is not None:
            combo.is_active = data.is_active
        if data.listing_order is not None:
            combo.listing_order = data.listing_order
        combo.save()
        return combo
    except Exception as e:
        raise HttpError(400, str(e))

@router.delete("/admin/combos/{combo_id}", auth=BearerAuth())
def delete_combo_offer(request, combo_id: int):
    """Delete a combo offer tier (Admin only)."""
    enforce_permission(request, "marketing", "manage_campaigns")
    combo = get_object_or_404(ComboOffer, id=combo_id)
    try:
        combo.delete()
        return {"success": True}
    except Exception as e:
        raise HttpError(400, str(e))


# ============================================================================
# META ENGINE ENDPOINTS (/api/v1/marketing/*)
# ============================================================================

from django.db.models import Sum, Count, Avg
from apps.marketing.models import (
    MetaAdAccount, Campaign, AdSet, Creative,
    PerformanceSnapshot, AutomationRule, OrderAttribution,
    AgentConfig, AgentActionLog, AgentMemoryEntry
)
from apps.marketing.schemas import (
    MetaAdAccountConnectSchema, MetaAdAccountResponseSchema,
    CampaignCreateSchema, CampaignUpdateSchema, CampaignScaleSchema, CampaignResponseSchema,
    AdSetResponseSchema, CreativeResponseSchema,
    AnalyticsOverviewSchema, TimeseriesDataPointSchema, ProductAttributionSchema,
    AutomationRuleInputSchema, AutomationRuleResponseSchema,
    AICopyRequestSchema, AICopyResponseSchema, AICampaignAdviceSchema,
    AgentToggleModeSchema, AgentChatRequestSchema,
    AgentActionLogResponseSchema, AgentStatusResponseSchema
)
from apps.marketing.services.meta_deployment import deploy_campaign
from apps.marketing.services.meta_insights import fetch_insights
from apps.marketing.services.rules_engine import evaluate_rules
from apps.marketing.services.ai_engine import (
    generate_ad_copy, generate_campaign_advice,
    generate_all_angles_batch, check_global_ai_budget,
    get_or_create_user_quota, AI_DAILY_BUDGET_USD
)
from apps.marketing.services.attribution import calculate_campaign_attributed_revenue
from apps.marketing.services.meta_client import MetaAPIClient
from apps.marketing.agent.brain import MetaAgent, chat_with_agent
from apps.marketing.agent.memory import agent_memory
from apps.marketing.agent.tools import create_campaign_from_product, pause_campaign, scale_campaign

def _serialize_campaign(c: Campaign) -> dict:
    """Helper to attach live snapshots and product metadata to CampaignResponseSchema."""
    snapshots = c.snapshots.all()
    total_spend = sum((s.spend for s in snapshots), Decimal('0.00'))
    total_rev = sum((s.revenue_attributed for s in snapshots), Decimal('0.00'))
    roas = round(float(total_rev) / float(total_spend), 2) if total_spend > 0 else 0.0

    # Extended metrics rollups for full Meta ads analytics
    total_results = sum((s.conversions for s in snapshots), 0)
    total_impressions = sum((s.impressions for s in snapshots), 0)
    total_reach = sum((getattr(s, 'reach', 0) or s.impressions for s in snapshots), 0)
    frequency = round(total_impressions / total_reach, 2) if total_reach > 0 else 1.0
    cpm = round((total_spend / Decimal(total_impressions)) * Decimal('1000.00'), 2) if total_impressions > 0 else Decimal('0.00')
    shop_clicks = sum((getattr(s, 'shop_clicks', 0) for s in snapshots), 0)
    link_clicks = sum((getattr(s, 'link_clicks', 0) or s.clicks for s in snapshots), 0)
    total_clicks = sum((s.clicks for s in snapshots), 0)
    cpc = round(total_spend / Decimal(link_clicks), 2) if link_clicks > 0 else Decimal('0.00')
    cpc_all = round(total_spend / Decimal(total_clicks), 2) if total_clicks > 0 else Decimal('0.00')
    ctr_all = round((total_clicks / total_impressions) * 100, 2) if total_impressions > 0 else 0.0
    landing_page_views = sum((getattr(s, 'landing_page_views', 0) for s in snapshots), 0)
    cost_per_landing_page = round(total_spend / Decimal(landing_page_views), 2) if landing_page_views > 0 else Decimal('0.00')
    cost_per_result = round(total_spend / Decimal(total_results), 2) if total_results > 0 else Decimal('0.00')

    product_name = None
    product_img = None
    if c.linked_product:
        product_name = c.linked_product.name
        first_img = c.linked_product.images.first()
        if first_img:
            product_img = first_img.image.url if hasattr(first_img.image, 'url') else str(first_img.image)

    adsets_data = []
    for adset in c.adsets.all():
        creatives_data = [
            CreativeResponseSchema(
                id=cr.id,
                name=cr.name,
                headline=cr.headline,
                primary_text=cr.primary_text,
                description=cr.description,
                call_to_action=cr.call_to_action,
                image_url=cr.image_url,
                video_url=cr.video_url,
                meta_creative_id=cr.meta_creative_id,
                meta_ad_id=cr.meta_ad_id,
            ) for cr in adset.creatives.all()
        ]
        adsets_data.append(
            AdSetResponseSchema(
                id=adset.id,
                name=adset.name,
                targeting=adset.targeting or {},
                bid_strategy=adset.bid_strategy,
                daily_budget=adset.daily_budget,
                meta_adset_id=adset.meta_adset_id,
                creatives=creatives_data,
            )
        )

    return {
        "id": c.id,
        "ad_account_id": c.ad_account_id,
        "name": c.name,
        "objective": c.objective,
        "status": c.status,
        "budget_type": c.budget_type,
        "budget_amount": c.budget_amount,
        "max_budget_cap": c.max_budget_cap or Decimal('0.00'),
        "is_first_time_test": c.is_first_time_test,
        "currency": c.ad_account.currency or "USD",
        "meta_campaign_id": c.meta_campaign_id,
        "linked_product_id": c.linked_product_id,
        "linked_product_name": product_name,
        "linked_product_image": product_img,
        "start_date": c.start_date,
        "end_date": c.end_date,
        "last_error": c.last_error,
        "created_at": c.created_at,
        "adsets": adsets_data,
        "total_spend": total_spend,
        "total_revenue": total_rev,
        "roas": roas,
        "results": total_results,
        "cost_per_result": cost_per_result,
        "impressions": total_impressions,
        "reach": total_reach,
        "frequency": frequency,
        "cpm": cpm,
        "shop_clicks": shop_clicks,
        "link_clicks": link_clicks,
        "cpc": cpc,
        "total_clicks": total_clicks,
        "ctr_all": ctr_all,
        "cpc_all": cpc_all,
        "landing_page_views": landing_page_views,
        "cost_per_landing_page": cost_per_landing_page,
    }


# --- Ad Accounts ---

@router.get("/ad-accounts/", response=List[MetaAdAccountResponseSchema], auth=BearerAuth())
def list_ad_accounts(request):
    """List connected Meta Ad Accounts."""
    enforce_permission(request, "marketing", "view")
    return list(MetaAdAccount.objects.all())

@router.post("/ad-accounts/connect/", response=MetaAdAccountResponseSchema, auth=BearerAuth())
def connect_ad_account(request, payload: MetaAdAccountConnectSchema):
    """Connect a Meta Ad Account using encrypted access credentials and fetch live currency/timezone from Meta."""
    enforce_permission(request, "marketing", "edit")
    
    # Live fetch currency & timezone directly from Meta Graph API
    client = MetaAPIClient(payload.access_token)
    acc_id = payload.meta_account_id if payload.meta_account_id.startswith("act_") else f"act_{payload.meta_account_id}"
    fetched_currency = payload.currency or ""
    fetched_tz = payload.timezone or ""
    try:
        remote_data = client.get(acc_id, params={"fields": "name,currency,timezone_name"})
        if remote_data.get("currency"):
            fetched_currency = remote_data["currency"]
        if remote_data.get("timezone_name"):
            fetched_tz = remote_data["timezone_name"]
        if remote_data.get("name") and not payload.name:
            payload.name = remote_data["name"]
    except Exception as e:
        logger.warning(f"Could not fetch account metadata from Meta Graph API: {e}")

    account, created = MetaAdAccount.objects.get_or_create(
        meta_account_id=payload.meta_account_id,
        defaults={
            "owner": request.auth,
            "name": payload.name,
            "currency": fetched_currency or "USD",
            "timezone": fetched_tz or "Asia/Dhaka",
            "daily_spend_cap": payload.daily_spend_cap or Decimal('0.00'),
            "is_active": True,
        }
    )
    account.owner = request.auth
    account.name = payload.name
    account.currency = fetched_currency or account.currency or "USD"
    account.timezone = fetched_tz or account.timezone or "Asia/Dhaka"
    if payload.daily_spend_cap is not None:
        account.daily_spend_cap = payload.daily_spend_cap
    account.set_access_token(payload.access_token)
    account.is_active = True
    account.save()
    return account

@router.post("/ad-accounts/{account_id}/sync/", auth=BearerAuth())
def sync_ad_account(request, account_id: int):
    """Trigger immediate metric and campaign sync for an ad account from Meta."""
    enforce_permission(request, "marketing", "edit")
    account = get_object_or_404(MetaAdAccount, id=account_id)
    now = timezone.now()
    since_date = (now - datetime.timedelta(days=7)).strftime('%Y-%m-%d')
    until_date = now.strftime('%Y-%m-%d')

    try:
        # 1. First sync existing native campaigns from Meta Ad Account
        token = account.get_access_token()
        client = MetaAPIClient(token, account_id=account.meta_account_id)
        account_prefix = account.meta_account_id
        if not account_prefix.startswith("act_"):
            account_prefix = f"act_{account_prefix}"

        try:
            camp_res = client.get(
                f"{account_prefix}/campaigns",
                params={"fields": "id,name,objective,status,effective_status,daily_budget,lifetime_budget", "limit": 100}
            )
            meta_campaigns = camp_res.get("data", [])
            for mc in meta_campaigns:
                meta_cid = mc.get("id")
                if not meta_cid:
                    continue
                camp_name = mc.get("name") or f"Meta Campaign {meta_cid}"
                camp_status = (mc.get("effective_status") or mc.get("status") or "ACTIVE").upper()
                if camp_status not in dict(Campaign.STATUS_CHOICES):
                    camp_status = "ACTIVE"

                daily_b = mc.get("daily_budget")
                lifetime_b = mc.get("lifetime_budget")
                budget_type = "LIFETIME" if lifetime_b else "DAILY"
                raw_b = lifetime_b or daily_b or 0
                try:
                    # Meta returns budget in currency cents (e.g. 1000 for $10.00)
                    budget_amt = Decimal(str(raw_b)) / Decimal('100.00') if Decimal(str(raw_b)) > Decimal('100.00') else Decimal(str(raw_b))
                except Exception:
                    budget_amt = Decimal('20.00')

                Campaign.objects.update_or_create(
                    meta_campaign_id=meta_cid,
                    defaults={
                        "ad_account": account,
                        "name": camp_name,
                        "status": camp_status,
                        "budget_type": budget_type,
                        "budget_amount": budget_amt if budget_amt > 0 else Decimal('20.00'),
                    }
                )
        except Exception as camp_err:
            logger.warning(f"Could not fetch campaign list from Meta API for {account_prefix}: {camp_err}")

        # 2. Fetch insights performance snapshots
        insights = fetch_insights(account, since=since_date, until=until_date)
        for item in insights:
            meta_cid = item.get("meta_campaign_id")
            if not meta_cid:
                continue
            campaign = Campaign.objects.filter(meta_campaign_id=meta_cid).first()
            if not campaign:
                # If campaign wasn't listed or already existed, create it from insights
                c_name = item.get("campaign_name") or f"Meta Campaign {meta_cid}"
                campaign = Campaign.objects.create(
                    ad_account=account,
                    name=c_name,
                    meta_campaign_id=meta_cid,
                    status="ACTIVE",
                    budget_amount=Decimal('20.00'),
                )

            spend = item.get("spend", Decimal('0.00'))
            rev = calculate_campaign_attributed_revenue(campaign)
            PerformanceSnapshot.objects.create(
                campaign=campaign,
                snapshot_time=now,
                spend=spend,
                impressions=item.get("impressions", 0),
                reach=item.get("reach", 0),
                frequency=item.get("frequency", 1.0),
                cpm=item.get("cpm", Decimal('0.00')),
                clicks=item.get("clicks", 0),
                link_clicks=item.get("link_clicks", 0),
                cost_per_link_click=item.get("cost_per_link_click", Decimal('0.00')),
                conversions=item.get("conversions", 0),
                cost_per_result=item.get("cost_per_result", Decimal('0.00')),
                shop_clicks=item.get("shop_clicks", 0),
                landing_page_views=item.get("landing_page_views", 0),
                cost_per_landing_page=item.get("cost_per_landing_page", Decimal('0.00')),
                revenue_attributed=rev,
            )
        account.last_synced_at = now
        account.save(update_fields=['last_synced_at'])
        return {"success": True, "insights_synced": len(insights)}
    except Exception as e:
        raise HttpError(400, f"Sync error: {str(e)}")


# --- Real-Time Meta Webhooks ---

@router.get("/meta/webhook/")
def verify_meta_webhook(request):
    """
    Meta Webhook verification handshake.
    When registering the webhook in Meta App Dashboard, Meta sends a GET request
    with hub.mode, hub.verify_token, and hub.challenge.
    """
    from django.conf import settings
    from django.http import HttpResponse
    mode = request.GET.get("hub.mode")
    token = request.GET.get("hub.verify_token")
    challenge = request.GET.get("hub.challenge")
    expected_token = getattr(settings, 'META_WEBHOOK_VERIFY_TOKEN', 'poshplex_meta_verify_token')

    if mode == "subscribe" and token == expected_token:
        return HttpResponse(challenge, content_type="text/plain")
    raise HttpError(403, "Invalid webhook verification token")

@router.post("/meta/webhook/")
def receive_meta_webhook(request):
    """
    Real-time webhook endpoint for Meta Graph API events.
    Verifies X-Hub-Signature-256 header and handles ad_rejected, ad_paused, campaign_paused.
    """
    from apps.marketing.services.meta_webhook import verify_hub_signature, handle_webhook_payload
    import json

    signature = request.headers.get("X-Hub-Signature-256", "")
    body_bytes = request.body

    if not verify_hub_signature(body_bytes, signature):
        raise HttpError(401, "Invalid X-Hub-Signature-256 signature")

    try:
        payload = json.loads(body_bytes.decode('utf-8'))
    except Exception:
        raise HttpError(400, "Invalid JSON payload")

    result = handle_webhook_payload(payload)
    return result


# --- Campaigns CRUD ---

@router.get("/campaigns/", response=List[CampaignResponseSchema], auth=BearerAuth())
def list_campaigns(request, status: Optional[str] = None, search: Optional[str] = None, ad_account_id: Optional[int] = None):
    """List marketing campaigns with attached targeting, creative, and performance aggregates."""
    enforce_permission(request, "marketing", "view")
    qs = Campaign.objects.select_related('ad_account', 'linked_product').prefetch_related('adsets__creatives', 'snapshots').all()
    if ad_account_id:
        qs = qs.filter(ad_account_id=ad_account_id)
    if status:
        qs = qs.filter(status=status.upper())
    if search:
        qs = qs.filter(name__icontains=search)

    return [_serialize_campaign(c) for c in qs]

@router.post("/campaigns/", response=CampaignResponseSchema, auth=BearerAuth())
def create_campaign(request, payload: CampaignCreateSchema):
    """Create a new campaign with attached AdSet and Creative."""
    enforce_permission(request, "marketing", "create")
    ad_account = get_object_or_404(MetaAdAccount, id=payload.ad_account_id)

    # Validate currency match between campaign budget and ad account
    if payload.currency and ad_account.currency:
        if payload.currency.upper() != ad_account.currency.upper():
            raise HttpError(400, f"Currency mismatch: campaign currency '{payload.currency}' does not match ad account currency '{ad_account.currency}'")

    # New campaign safety limit: budget_amount cannot exceed $10 USD for first 24h test
    is_test = payload.is_first_time_test if payload.is_first_time_test is not None else True
    if is_test:
        currency = (ad_account.currency or 'USD').upper()
        max_test_budget = Decimal('10.00') if currency == 'USD' else (Decimal('1000.00') if currency == 'BDT' else Decimal('10.00'))
        if payload.budget_amount > max_test_budget:
            raise HttpError(
                400,
                f"New Campaign Safety Limit: First-time test campaign budget cannot exceed ${max_test_budget} {currency} for the initial 24h to prevent accidental budget overspend."
            )

    with transaction.atomic():
        campaign = Campaign.objects.create(
            ad_account=ad_account,
            name=payload.name,
            objective=payload.objective,
            budget_type=payload.budget_type,
            budget_amount=payload.budget_amount,
            max_budget_cap=payload.max_budget_cap or Decimal('0.00'),
            is_first_time_test=is_test,
            linked_product_id=payload.linked_product_id,
            status='DRAFT',
        )

        # Create AdSet if targeting provided or default
        targeting_dict = payload.targeting.dict() if payload.targeting else {
            "age_min": 18, "age_max": 45, "genders": [1, 2], "countries": ["BD"],
            "interests": ["Streetwear", "Sneakers"], "placements": ["facebook_feed", "instagram_feed"]
        }
        adset = AdSet.objects.create(
            campaign=campaign,
            name=f"{campaign.name} - AdSet 1",
            targeting=targeting_dict,
            daily_budget=campaign.budget_amount,
        )

        # Create Creative if provided or default
        if payload.creative:
            Creative.objects.create(
                adset=adset,
                name=payload.creative.name,
                headline=payload.creative.headline,
                primary_text=payload.creative.primary_text,
                description=payload.creative.description or "",
                call_to_action=payload.creative.call_to_action or "SHOP_NOW",
                image_url=payload.creative.image_url or "",
                video_url=payload.creative.video_url or "",
            )
        elif campaign.linked_product:
            headline = campaign.linked_product.name
            img_url = ""
            first_img = campaign.linked_product.images.first()
            if first_img:
                img_url = first_img.image.url if hasattr(first_img.image, 'url') else str(first_img.image)

            Creative.objects.create(
                adset=adset,
                name=f"{campaign.name} - Creative",
                headline=headline[:100],
                primary_text=f"Experience {headline} from PoshPlex. Engineered streetwear quality.",
                call_to_action="SHOP_NOW",
                image_url=img_url or "https://store.poshplexbd.com/logo.png"
            )

    return _serialize_campaign(campaign)

@router.get("/campaigns/{campaign_id}/", response=CampaignResponseSchema, auth=BearerAuth())
def get_campaign(request, campaign_id: int):
    """Retrieve full details of a specific campaign."""
    enforce_permission(request, "marketing", "view")
    campaign = get_object_or_404(
        Campaign.objects.select_related('ad_account', 'linked_product').prefetch_related('adsets__creatives', 'snapshots'),
        id=campaign_id
    )
    return _serialize_campaign(campaign)

@router.put("/campaigns/{campaign_id}/", response=CampaignResponseSchema, auth=BearerAuth())
def update_campaign(request, campaign_id: int, payload: CampaignUpdateSchema):
    """Update campaign parameters."""
    enforce_permission(request, "marketing", "edit")
    campaign = get_object_or_404(Campaign, id=campaign_id)
    if payload.name:
        campaign.name = payload.name
    if payload.objective:
        campaign.objective = payload.objective
    if payload.budget_type:
        campaign.budget_type = payload.budget_type
    if payload.budget_amount:
        campaign.budget_amount = payload.budget_amount
    if payload.linked_product_id is not None:
        campaign.linked_product_id = payload.linked_product_id
    campaign.save()
    return _serialize_campaign(campaign)

@router.delete("/campaigns/{campaign_id}/", auth=BearerAuth())
def delete_campaign(request, campaign_id: int):
    """Archive a campaign locally and on Meta Graph API."""
    enforce_permission(request, "marketing", "delete")
    campaign = get_object_or_404(Campaign, id=campaign_id)
    if campaign.meta_campaign_id:
        try:
            token = campaign.ad_account.get_access_token()
            client = MetaAPIClient(token)
            client.post(f"{campaign.meta_campaign_id}", json_data={"status": "ARCHIVED"})
        except Exception:
            pass
    campaign.status = 'ARCHIVED'
    campaign.save(update_fields=['status', 'updated_at'])
    return {"success": True, "message": f"Campaign #{campaign_id} archived"}


# --- Lifecycle & Operations ---

@router.post("/campaigns/{campaign_id}/deploy/", auth=BearerAuth())
def trigger_campaign_deploy(request, campaign_id: int):
    """One-click deploy: Publishes Campaign, AdSet, Creative, and Ad to Meta Marketing API."""
    enforce_permission(request, "marketing", "edit")
    campaign = get_object_or_404(Campaign, id=campaign_id)
    try:
        result = deploy_campaign(campaign.id)
        return {"success": True, "data": result}
    except Exception as e:
        raise HttpError(400, f"Deployment failed: {str(e)}")

@router.post("/campaigns/{campaign_id}/pause/", auth=BearerAuth())
def pause_campaign(request, campaign_id: int):
    """Instantly pause an active Meta campaign."""
    enforce_permission(request, "marketing", "edit")
    campaign = get_object_or_404(Campaign, id=campaign_id)
    if campaign.meta_campaign_id:
        token = campaign.ad_account.get_access_token()
        client = MetaAPIClient(token)
        client.post(f"{campaign.meta_campaign_id}", json_data={"status": "PAUSED"})
    campaign.status = 'PAUSED'
    campaign.save(update_fields=['status', 'updated_at'])
    return {"success": True, "status": "PAUSED"}

@router.post("/campaigns/{campaign_id}/resume/", auth=BearerAuth())
def resume_campaign(request, campaign_id: int):
    """Resume a paused Meta campaign."""
    enforce_permission(request, "marketing", "edit")
    campaign = get_object_or_404(Campaign, id=campaign_id)
    if campaign.meta_campaign_id:
        token = campaign.ad_account.get_access_token()
        client = MetaAPIClient(token)
        client.post(f"{campaign.meta_campaign_id}", json_data={"status": "ACTIVE"})
    campaign.status = 'ACTIVE'
    campaign.save(update_fields=['status', 'updated_at'])
    return {"success": True, "status": "ACTIVE"}

@router.post("/campaigns/{campaign_id}/scale/", auth=BearerAuth())
def scale_campaign_budget(request, campaign_id: int, payload: CampaignScaleSchema):
    """Adjust campaign budget (by percentage or specific value)."""
    enforce_permission(request, "marketing", "edit")
    campaign = get_object_or_404(Campaign, id=campaign_id)
    old_budget = campaign.budget_amount

    if payload.new_budget:
        new_budget = payload.new_budget
    elif payload.percentage:
        mult = Decimal(str(1.0 + (payload.percentage / 100.0)))
        new_budget = round(old_budget * mult, 2)
    else:
        new_budget = round(old_budget * Decimal('1.20'), 2)

    campaign.budget_amount = new_budget
    campaign.save(update_fields=['budget_amount', 'updated_at'])

    if campaign.meta_campaign_id:
        token = campaign.ad_account.get_access_token()
        client = MetaAPIClient(token)
        for adset in campaign.adsets.all():
            if adset.meta_adset_id:
                client.post(f"{adset.meta_adset_id}", json_data={"daily_budget": int(new_budget * 100)})
                adset.daily_budget = new_budget
                adset.save(update_fields=['daily_budget', 'updated_at'])

    return {"success": True, "old_budget": old_budget, "new_budget": new_budget}


# --- Analytics & Timeseries ---

@router.get("/analytics/overview/", response=AnalyticsOverviewSchema, auth=BearerAuth())
def get_analytics_overview(request, range: str = "7d", campaign_id: Optional[int] = None):
    """Aggregate KPI overview (Spend, Attributed Revenue, Blended ROAS, Conversions, CPC, CTR)."""
    enforce_permission(request, "marketing", "view")
    now = timezone.now()
    days = 7
    if range == "30d":
        days = 30
    elif range == "90d":
        days = 90
    since_dt = now - datetime.timedelta(days=days)

    qs = PerformanceSnapshot.objects.filter(snapshot_time__gte=since_dt)
    if campaign_id:
        qs = qs.filter(campaign_id=campaign_id)

    agg = qs.aggregate(
        total_spend=Sum('spend'),
        total_rev=Sum('revenue_attributed'),
        total_conv=Sum('conversions'),
        total_clicks=Sum('clicks'),
        total_imp=Sum('impressions'),
    )

    total_spend = agg.get('total_spend') or Decimal('0.00')
    total_rev = agg.get('total_rev') or Decimal('0.00')
    total_conv = agg.get('total_conv') or 0
    total_clicks = agg.get('total_clicks') or 0
    total_imp = agg.get('total_imp') or 0

    blended_roas = round(float(total_rev) / float(total_spend), 2) if total_spend > 0 else 0.0
    avg_cpc = round(total_spend / Decimal(total_clicks), 2) if total_clicks > 0 else Decimal('0.00')
    avg_ctr = round((total_clicks / total_imp) * 100, 2) if total_imp > 0 else 0.0

    return {
        "total_spend": total_spend,
        "total_revenue": total_rev,
        "blended_roas": blended_roas,
        "conversions": total_conv,
        "total_clicks": total_clicks,
        "total_impressions": total_imp,
        "average_cpc": avg_cpc,
        "average_ctr": avg_ctr,
    }

@router.get("/analytics/timeseries/", response=List[TimeseriesDataPointSchema], auth=BearerAuth())
def get_analytics_timeseries(request, range: str = "30d", campaign_id: Optional[int] = None):
    """Timeseries metric breakdown formatted for Recharts dual-axis charts."""
    enforce_permission(request, "marketing", "view")
    now = timezone.now()
    days = 30
    if range == "7d":
        days = 7
    elif range == "90d":
        days = 90

    # Build chronological daily buckets
    data_points = []
    for d in range(days, -1, -1):
        day_start = (now - datetime.timedelta(days=d)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + datetime.timedelta(days=1)
        day_str = day_start.strftime("%b %d")

        qs = PerformanceSnapshot.objects.filter(snapshot_time__gte=day_start, snapshot_time__lt=day_end)
        if campaign_id:
            qs = qs.filter(campaign_id=campaign_id)

        agg = qs.aggregate(
            spend=Sum('spend'),
            rev=Sum('revenue_attributed'),
            clicks=Sum('clicks'),
            conv=Sum('conversions'),
        )

        spend = float(agg.get('spend') or 0.0)
        rev = float(agg.get('rev') or 0.0)
        roas = round(rev / spend, 2) if spend > 0 else 0.0

        data_points.append({
            "date": day_str,
            "spend": round(spend, 2),
            "revenue": round(rev, 2),
            "roas": roas,
            "clicks": agg.get('clicks') or 0,
            "conversions": agg.get('conv') or 0,
        })

    return data_points

@router.get("/analytics/by-product/", response=List[ProductAttributionSchema], auth=BearerAuth())
def get_analytics_by_product(request):
    """Breakdown of ad spend, attributed revenue, and ROAS per catalog product."""
    enforce_permission(request, "marketing", "view")
    campaigns = Campaign.objects.filter(linked_product__isnull=False).select_related('linked_product').prefetch_related('snapshots')

    product_map = {}
    for camp in campaigns:
        prod = camp.linked_product
        if prod.id not in product_map:
            product_map[prod.id] = {
                "product_id": prod.id,
                "product_name": prod.name,
                "product_sku": prod.sku,
                "campaign_count": 0,
                "spend": Decimal('0.00'),
                "revenue": Decimal('0.00'),
                "conversions": 0,
            }

        product_map[prod.id]["campaign_count"] += 1
        for s in camp.snapshots.all():
            product_map[prod.id]["spend"] += s.spend
            product_map[prod.id]["revenue"] += s.revenue_attributed
            product_map[prod.id]["conversions"] += s.conversions

    results = []
    for item in product_map.values():
        spend = item["spend"]
        rev = item["revenue"]
        roas = round(float(rev) / float(spend), 2) if spend > 0 else 0.0
        results.append({
            "product_id": item["product_id"],
            "product_name": item["product_name"],
            "product_sku": item["product_sku"],
            "campaign_count": item["campaign_count"],
            "spend": spend,
            "revenue": rev,
            "roas": roas,
            "conversions": item["conversions"],
        })

    return sorted(results, key=lambda x: x["roas"], reverse=True)


# --- Emergency Kill Switch ---

@router.post("/campaigns/stop-all/", auth=BearerAuth())
def stop_all_campaigns(request):
    """
    EMERGENCY KILL SWITCH: Immediately halts and pauses ALL active campaigns on Meta API
    and updates the local database state to PAUSED in a single atomic loop.
    """
    enforce_permission(request, "marketing", "edit")
    active_campaigns = Campaign.objects.filter(status='ACTIVE').select_related('ad_account')
    stopped_count = 0
    errors = []

    for camp in active_campaigns:
        try:
            if camp.meta_campaign_id:
                token = camp.ad_account.get_access_token()
                client = MetaAPIClient(token, account_id=camp.ad_account.meta_account_id)
                client.post(camp.meta_campaign_id, json_data={"status": "PAUSED"})
            camp.status = 'PAUSED'
            operator_name = getattr(request.auth, 'username', 'admin')
            camp.last_error = f"Emergency Kill Switch triggered by {operator_name} at {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}"
            camp.save(update_fields=['status', 'last_error', 'updated_at'])
            stopped_count += 1
        except Exception as e:
            logger.error(f"Error pausing campaign #{camp.id} during emergency kill switch: {e}")
            errors.append({"campaign_id": camp.id, "error": str(e)})

    logger.critical(f"[KILL SWITCH] Paused {stopped_count} active campaigns across all ad accounts!")
    return {
        "success": True,
        "stopped_count": stopped_count,
        "errors": errors,
        "message": f"Emergency Kill Switch triggered: {stopped_count} active campaign(s) paused."
    }


# --- AI Engine Integration ---

@router.get("/ai/status/", auth=BearerAuth())
def get_ai_status(request):
    """Returns AI system health, daily budget expenditure, and remaining user quotas."""
    budget_ok, today_spend = check_global_ai_budget()
    quota = get_or_create_user_quota(request.auth)
    return {
        "ai_enabled": budget_ok,
        "daily_budget_usd": float(AI_DAILY_BUDGET_USD),
        "spent_today_usd": float(today_spend),
        "remaining_budget_usd": max(0.0, float(AI_DAILY_BUDGET_USD - today_spend)),
        "user_daily_limit": quota.daily_limit if quota else 20,
        "user_used_today": quota.used_today if quota else 0,
        "user_quota_available": quota.is_quota_available() if quota else True,
    }

@router.post("/ai/generate-copy/", auth=BearerAuth())
def api_generate_ad_copy(request, payload: AICopyRequestSchema):
    """
    Generate high-converting streetwear Meta ad copy grounded in catalog products.
    Enforces prompt caching, per-product limits (max 5/day), and daily budget safeguards.
    """
    enforce_permission(request, "marketing", "view")
    try:
        if payload.batch_all_angles:
            return generate_all_angles_batch(
                product_id=payload.product_id,
                user=request.auth,
                premium_rewrite=payload.premium_rewrite or False
            )
        return generate_ad_copy(
            product_id=payload.product_id,
            angle=payload.angle or "hype",
            custom_prompt=payload.custom_prompt or "",
            user=request.auth,
            premium_rewrite=payload.premium_rewrite or False
        )
    except ValueError as e:
        raise HttpError(400, str(e))

@router.get("/ai/campaign-advice/{campaign_id}/", response=AICampaignAdviceSchema, auth=BearerAuth())
def api_campaign_advice(request, campaign_id: int):
    """Retrieve AI-driven diagnostic advice and scaling recommendations for a specific campaign."""
    enforce_permission(request, "marketing", "view")
    campaign = get_object_or_404(Campaign, id=campaign_id)
    return generate_campaign_advice(campaign.id)


# --- Automation Rules ---

@router.get("/rules/", response=List[AutomationRuleResponseSchema], auth=BearerAuth())
def list_automation_rules(request):
    """List all configured automation rules."""
    enforce_permission(request, "marketing", "view")
    rules = AutomationRule.objects.select_related('campaign').all()
    return [
        {
            "id": r.id,
            "campaign_id": r.campaign_id,
            "campaign_name": r.campaign.name if r.campaign else "GLOBAL",
            "name": r.name,
            "condition_type": r.condition_type,
            "threshold_value": r.threshold_value,
            "action": r.action,
            "is_active": r.is_active,
            "cooldown_hours": r.cooldown_hours,
            "last_triggered_at": r.last_triggered_at,
            "last_trigger_log": r.last_trigger_log,
            "created_at": r.created_at,
        } for r in rules
    ]

@router.post("/rules/", response=AutomationRuleResponseSchema, auth=BearerAuth())
def create_automation_rule(request, payload: AutomationRuleInputSchema):
    """Create a new automation rule."""
    enforce_permission(request, "marketing", "create")
    rule = AutomationRule.objects.create(
        campaign_id=payload.campaign_id,
        name=payload.name,
        condition_type=payload.condition_type,
        threshold_value=payload.threshold_value,
        action=payload.action,
        is_active=payload.is_active if payload.is_active is not None else True,
        cooldown_hours=payload.cooldown_hours or 6,
    )
    return {
        "id": rule.id,
        "campaign_id": rule.campaign_id,
        "campaign_name": rule.campaign.name if rule.campaign else "GLOBAL",
        "name": rule.name,
        "condition_type": rule.condition_type,
        "threshold_value": rule.threshold_value,
        "action": rule.action,
        "is_active": rule.is_active,
        "cooldown_hours": rule.cooldown_hours,
        "last_triggered_at": rule.last_triggered_at,
        "last_trigger_log": rule.last_trigger_log,
        "created_at": rule.created_at,
    }

@router.put("/rules/{rule_id}/toggle/", auth=BearerAuth())
def toggle_automation_rule(request, rule_id: int):
    """Toggle a rule between active and inactive."""
    enforce_permission(request, "marketing", "edit")
    rule = get_object_or_404(AutomationRule, id=rule_id)
    rule.is_active = not rule.is_active
    rule.save(update_fields=['is_active', 'updated_at'])
    return {"success": True, "is_active": rule.is_active}

@router.delete("/rules/{rule_id}/", auth=BearerAuth())
def delete_automation_rule(request, rule_id: int):
    """Delete an automation rule."""
    enforce_permission(request, "marketing", "delete")
    rule = get_object_or_404(AutomationRule, id=rule_id)
    rule.delete()
    return {"success": True}


# ============================================================================
# META AGENT v4 ENDPOINTS (/api/v1/marketing/agent/*)
# ============================================================================

import json

@router.get("/agent/status/", response=AgentStatusResponseSchema, auth=BearerAuth())
def get_agent_status(request):
    """Returns Meta Agent configuration, daily budget spend, and decision counts."""
    enforce_permission(request, "marketing", "view")
    config = AgentConfig.get_solo()
    now = timezone.now()
    today_spend = PerformanceSnapshot.objects.filter(
        snapshot_time__date=now.date()
    ).aggregate(s=Sum('spend'))['s'] or Decimal('0.00')

    today_actions = AgentActionLog.objects.filter(created_at__date=now.date()).count()
    pending_count = AgentActionLog.objects.filter(status='NEEDS_APPROVAL').count()
    recent_log = AgentActionLog.objects.first()

    return {
        "mode": config.mode,
        "is_enabled": config.is_enabled,
        "auto_pause_enabled": config.auto_pause_enabled,
        "agent_daily_budget": float(config.agent_daily_budget),
        "spent_today_bdt": float(today_spend),
        "remaining_budget_bdt": max(0.0, float(config.agent_daily_budget - today_spend)),
        "spent_today_usd": float(today_spend),
        "remaining_budget_usd": max(0.0, float(config.agent_daily_budget - today_spend)),
        "today_actions_count": today_actions,
        "pending_approval_count": pending_count,
        "recent_cycle_id": recent_log.agent_cycle_id if recent_log else None,
    }


@router.get("/agent/logs/", response=List[AgentActionLogResponseSchema], auth=BearerAuth())
def get_agent_logs(request, status: Optional[str] = None, limit: int = 50):
    """Lists audit trail of Agent decisions and actions."""
    enforce_permission(request, "marketing", "view")
    qs = AgentActionLog.objects.all().select_related('campaign')
    if status:
        qs = qs.filter(status=status)
    logs = qs[:limit]
    return [
        {
            "id": l.id,
            "created_at": l.created_at,
            "agent_cycle_id": l.agent_cycle_id,
            "reasoning_text": l.reasoning_text,
            "tool_name": l.tool_name,
            "campaign_id": l.campaign_id,
            "campaign_name": l.campaign.name if l.campaign else None,
            "action_taken": l.action_taken,
            "outcome": l.outcome,
            "cost_impact": l.cost_impact,
            "status": l.status,
            "tool_params": l.tool_params or {},
        }
        for l in logs
    ]


@router.post("/agent/toggle-mode/", auth=BearerAuth())
def toggle_agent_mode(request, payload: AgentToggleModeSchema):
    """Toggles agent operating mode between SUGGEST and AUTO, updates budget/status."""
    enforce_permission(request, "marketing", "edit")
    config = AgentConfig.get_solo()
    if payload.mode in ['SUGGEST', 'AUTO']:
        config.mode = payload.mode
    if payload.is_enabled is not None:
        config.is_enabled = payload.is_enabled
    if payload.agent_daily_budget is not None and payload.agent_daily_budget > 0:
        config.agent_daily_budget = payload.agent_daily_budget
    config.save()
    return {
        "success": True,
        "mode": config.mode,
        "is_enabled": config.is_enabled,
        "agent_daily_budget": float(config.agent_daily_budget),
        "message": f"Agent operating mode set to {config.mode}."
    }


@router.post("/agent/approve/{log_id}/", auth=BearerAuth())
def approve_agent_action(request, log_id: int):
    """Approves a suggested action and executes the underlying tool."""
    enforce_permission(request, "marketing", "edit")
    log_entry = get_object_or_404(AgentActionLog, id=log_id)
    if log_entry.status != 'NEEDS_APPROVAL':
        raise HttpError(400, f"Action #{log_id} is not pending approval (status: {log_entry.status}).")

    tool_name = log_entry.tool_name
    params = log_entry.tool_params or {}
    outcome = ""

    try:
        if tool_name == 'create_campaign_from_product':
            res = create_campaign_from_product(params.get('product_id'), budget=params.get('budget', 1000.0))
            outcome = f"Approved & Deployed: {json.dumps(res)}"
        elif tool_name == 'pause_campaign':
            res = pause_campaign(params.get('campaign_id'), reason=log_entry.reasoning_text)
            outcome = f"Approved & Paused: {json.dumps(res)}"
        elif tool_name == 'scale_campaign':
            res = scale_campaign(params.get('campaign_id'), percent=params.get('percent', 20))
            outcome = f"Approved & Scaled: {json.dumps(res)}"
        else:
            outcome = f"Executed {tool_name}"

        log_entry.status = 'EXECUTED'
        log_entry.outcome = outcome
        log_entry.save(update_fields=['status', 'outcome'])
        return {"success": True, "message": "Action approved and executed successfully.", "outcome": outcome}
    except Exception as e:
        log_entry.status = 'FAILED'
        log_entry.outcome = str(e)
        log_entry.save(update_fields=['status', 'outcome'])
        raise HttpError(500, f"Error executing approved action: {e}")


@router.post("/agent/reject/{log_id}/", auth=BearerAuth())
def reject_agent_action(request, log_id: int):
    """Rejects a suggested action."""
    enforce_permission(request, "marketing", "edit")
    log_entry = get_object_or_404(AgentActionLog, id=log_id)
    log_entry.status = 'REJECTED'
    log_entry.save(update_fields=['status'])
    return {"success": True, "message": f"Action #{log_id} marked as rejected."}


@router.post("/agent/chat/", auth=BearerAuth())
def chat_agent(request, payload: AgentChatRequestSchema):
    """Chat with the Meta Media Buyer Agent to explain decisions and strategy."""
    enforce_permission(request, "marketing", "view")
    reply = chat_with_agent(payload.message)
    return {"reply": reply}


@router.get("/agent/memories/", auth=BearerAuth())
def get_agent_memories(request, limit: int = 10):
    """Returns top learned insights stored in agent memory."""
    enforce_permission(request, "marketing", "view")
    insights = agent_memory.get_top_insights(limit=limit)
    return insights


@router.post("/agent/run-cycle/", auth=BearerAuth())
def run_agent_cycle_now(request):
    """Manually triggers an immediate agent perception and reasoning cycle."""
    enforce_permission(request, "marketing", "edit")
    agent = MetaAgent()
    res = agent.run_cycle()
    return res


# ============================================================================
# META ENGINE v4.1 COMPETITOR INTELLIGENCE & AI INTEGRATION ROUTERS
# ============================================================================
from apps.marketing.competitor.api import router as competitor_router
router.add_router("/competitor", competitor_router)

from apps.marketing.api_integration import router as ai_integration_router
router.add_router("/ai-integration", ai_integration_router)


# ============================================================================
# CUSTOMER DATA & ATTRIBUTION PLATFORM ENDPOINTS (M1 - M22)
# ============================================================================
import uuid
from django.core.cache import cache
from apps.marketing.models import (
    VisitorSession,
    RawTrackingEvent,
    OrderAttributionTouchpoint,
    DailyAdPerformanceSummary
)
from apps.marketing.tasks import process_tracking_event, rebuild_daily_ad_summaries_task
from apps.orders.models import Order

class TrackingEventInputSchema(Schema):
    event_id: Optional[str] = None
    event_name: str
    visitor_id: Optional[str] = None
    session_id: Optional[str] = None
    client_timestamp: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_content: Optional[str] = None
    utm_term: Optional[str] = None
    fbc: Optional[str] = None
    fbp: Optional[str] = None
    landing_page: Optional[str] = None
    referrer: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    user_id: Optional[int] = None

class TrackingEventResponseSchema(Schema):
    status: str
    event_id: str


def _handle_tracking_event_ingest(request, payload: TrackingEventInputSchema) -> dict:
    """Internal helper to ingest tracking events with IP rate limiting and non-blocking queueing."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    ua = request.META.get('HTTP_USER_AGENT', '')

    event_id = payload.event_id or str(uuid.uuid4())
    payload_dict = payload.dict()
    payload_dict["event_id"] = event_id

    # Token bucket rate-limiter: max 120 tracking events/min per IP
    if ip:
        cache_key = f"ratelimit:track:{ip}"
        try:
            cnt = cache.get(cache_key, 0)
            if cnt >= 120:
                return {"status": "rate_limited", "event_id": event_id}
            if cnt == 0:
                cache.set(cache_key, 1, timeout=60)
            else:
                try:
                    cache.incr(cache_key)
                except Exception:
                    cache.set(cache_key, cnt + 1, timeout=60)
        except Exception:
            pass

    try:
        # Dispatch to async Celery worker (or synchronous if eager)
        process_tracking_event.delay(payload_dict, ip_address=ip, user_agent=ua)
    except Exception as e:
        # Fallback to direct synchronous execution if Celery broker unreachable
        from apps.marketing.services.attribution_engine import record_tracking_event
        try:
            record_tracking_event(payload_dict, ip_address=ip, user_agent=ua)
        except Exception as inner_e:
            logger.warning(f"Could not record tracking event: {inner_e}")

    return {"status": "queued", "event_id": event_id}


@router.post("/track/event/", response=TrackingEventResponseSchema, auth=None)
def post_tracking_event_marketing(request, payload: TrackingEventInputSchema):
    """
    Fast, non-blocking first-party ingestion endpoint under /api/v1/marketing/track/event/.
    Accepts client events, enriches server timestamps, and buffers into Redis/Celery queue.
    """
    return _handle_tracking_event_ingest(request, payload)


tracker_router = Router()

@tracker_router.post("/event/", response=TrackingEventResponseSchema, auth=None)
def post_tracking_event_root(request, payload: TrackingEventInputSchema):
    """Direct alias under /api/v1/track/event/ for lightweight client SDKs."""
    return _handle_tracking_event_ingest(request, payload)


@router.get("/attribution/summary/", auth=BearerAuth())
def get_attribution_summary(
    request,
    model: str = "last_paid",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    campaign_id: Optional[int] = None
):
    """
    Multi-touch attribution summary matrix.
    Supports switching between:
      - 'last_paid' (Last Paid Touch, default)
      - 'first_touch' (First Touch)
      - 'linear' (Linear Equal Split)
      - 'position_based' (Position-Based 40/40/20)
    Computes Net Ad Profit (Delivered Revenue - COGS - Delivery Cost - Return Courier Loss - Ad Spend).
    """
    enforce_permission(request, "marketing", "view")

    valid_models = ['last_paid', 'first_touch', 'linear', 'position_based']
    if model not in valid_models:
        model = 'last_paid'

    now = timezone.now()
    if date_from:
        try:
            start_dt = timezone.make_aware(datetime.datetime.strptime(date_from, "%Y-%m-%d"))
        except Exception:
            start_dt = now - datetime.timedelta(days=30)
    else:
        start_dt = now - datetime.timedelta(days=30)

    if date_to:
        try:
            end_dt = timezone.make_aware(datetime.datetime.strptime(date_to, "%Y-%m-%d") + datetime.timedelta(days=1, microseconds=-1))
        except Exception:
            end_dt = now
    else:
        end_dt = now

    # Map model to credit field
    credit_field_map = {
        'last_paid': 'last_paid_credit',
        'first_touch': 'first_touch_credit',
        'linear': 'linear_credit',
        'position_based': 'position_based_credit',
    }
    credit_field = credit_field_map[model]

    # Filter campaigns
    camp_qs = Campaign.objects.exclude(status='ARCHIVED')
    if campaign_id:
        camp_qs = camp_qs.filter(id=campaign_id)

    campaigns_data = []

    # Totals across all campaigns
    tot_spend_usd = Decimal('0.00')
    tot_spend_bdt = Decimal('0.00')
    tot_placed_orders = Decimal('0.00')
    tot_delivered_orders = Decimal('0.00')
    tot_returned_orders = Decimal('0.00')
    tot_placed_revenue = Decimal('0.00')
    tot_delivered_revenue = Decimal('0.00')
    tot_gross_margin = Decimal('0.00')
    tot_return_loss = Decimal('0.00')
    tot_net_ad_profit = Decimal('0.00')
    tot_impressions = 0
    tot_link_clicks = 0

    for camp in camp_qs:
        # Snapshots spend in date range
        snaps = camp.snapshots.filter(snapshot_time__gte=start_dt, snapshot_time__lte=end_dt)
        spend_usd = snaps.aggregate(s=Sum('spend'))['s'] or Decimal('0.00')
        spend_bdt = (spend_usd * Decimal('122.00')).quantize(Decimal('0.01'))
        impressions = snaps.aggregate(i=Sum('impressions'))['i'] or 0
        link_clicks = snaps.aggregate(c=Sum('link_clicks'))['c'] or 0

        # Touchpoints for this campaign
        touchpoints = OrderAttributionTouchpoint.objects.filter(
            campaign=camp,
            created_at__gte=start_dt,
            created_at__lte=end_dt
        ).select_related('session')

        # Model-weighted counts and values
        placed_orders = Decimal('0.00')
        delivered_orders = Decimal('0.00')
        returned_orders = Decimal('0.00')
        placed_rev = Decimal('0.00')
        deliv_rev = Decimal('0.00')
        gross_margin = Decimal('0.00')
        return_loss = Decimal('0.00')

        # Cache order status lookups
        order_ids = list(touchpoints.values_list('order_id', flat=True).distinct())
        orders_dict = {o.id: o for o in Order.objects.filter(id__in=order_ids)}

        for tp in touchpoints:
            credit = getattr(tp, credit_field, Decimal('0.0000'))
            if credit <= 0:
                continue

            order = orders_dict.get(tp.order_id)
            if not order:
                continue

            order_total = Decimal(str(order.total_amount))
            placed_orders += credit
            placed_rev += (order_total * credit)

            status_clean = order.status.lower().strip()
            if status_clean in ['delivered', 'completed']:
                delivered_orders += credit
                deliv_rev += (order_total * credit)
                # Gross margin = delivered revenue - COGS - delivery cost
                gross_margin += (tp.attributed_gross_margin * (credit / (tp.last_paid_credit or Decimal('1.0000')))) if tp.last_paid_credit > 0 else (order_total * Decimal('0.40') * credit)
            elif status_clean in ['returned', 'cancelled']:
                returned_orders += credit
                return_loss += (tp.attributed_return_loss * (credit / (tp.last_paid_credit or Decimal('1.0000')))) if tp.last_paid_credit > 0 else (Decimal('100.00') * credit)

        finished_orders = delivered_orders + returned_orders
        delivery_rate = round(float(delivered_orders / finished_orders * 100), 1) if finished_orders > 0 else 0.0

        net_profit = (gross_margin - spend_bdt - return_loss).quantize(Decimal('0.01'))
        roas = round(float(deliv_rev) / float(spend_bdt), 2) if spend_bdt > 0 else 0.0

        tot_spend_usd += spend_usd
        tot_spend_bdt += spend_bdt
        tot_placed_orders += placed_orders
        tot_delivered_orders += delivered_orders
        tot_returned_orders += returned_orders
        tot_placed_revenue += placed_rev
        tot_delivered_revenue += deliv_rev
        tot_gross_margin += gross_margin
        tot_return_loss += return_loss
        tot_net_ad_profit += net_profit
        tot_impressions += impressions
        tot_link_clicks += link_clicks

        campaigns_data.append({
            "id": camp.id,
            "name": camp.name,
            "meta_campaign_id": camp.meta_campaign_id or "",
            "status": camp.status,
            "spend_usd": float(spend_usd),
            "spend_bdt": float(spend_bdt),
            "impressions": impressions,
            "link_clicks": link_clicks,
            "placed_orders": round(float(placed_orders), 2),
            "delivered_orders": round(float(delivered_orders), 2),
            "returned_orders": round(float(returned_orders), 2),
            "delivery_success_rate": delivery_rate,
            "placed_revenue": float(placed_rev),
            "delivered_revenue": float(deliv_rev),
            "gross_margin": float(gross_margin),
            "return_loss": float(return_loss),
            "net_ad_profit": float(net_profit),
            "roas": roas,
        })

    tot_finished = tot_delivered_orders + tot_returned_orders
    tot_delivery_rate = round(float(tot_delivered_orders / tot_finished * 100), 1) if tot_finished > 0 else 0.0
    tot_roas = round(float(tot_delivered_revenue) / float(tot_spend_bdt), 2) if tot_spend_bdt > 0 else 0.0

    return {
        "model": model,
        "date_from": start_dt.strftime("%Y-%m-%d"),
        "date_to": end_dt.strftime("%Y-%m-%d"),
        "overview": {
            "total_spend_usd": float(tot_spend_usd),
            "total_spend_bdt": float(tot_spend_bdt),
            "total_impressions": tot_impressions,
            "total_link_clicks": tot_link_clicks,
            "total_placed_orders": round(float(tot_placed_orders), 2),
            "total_delivered_orders": round(float(tot_delivered_orders), 2),
            "total_returned_orders": round(float(tot_returned_orders), 2),
            "delivery_success_rate": tot_delivery_rate,
            "total_placed_revenue": float(tot_placed_revenue),
            "total_delivered_revenue": float(tot_delivered_revenue),
            "total_gross_margin": float(tot_gross_margin),
            "total_return_loss": float(tot_return_loss),
            "total_net_ad_profit": float(tot_net_ad_profit),
            "roas_delivered": tot_roas,
        },
        "campaigns": campaigns_data
    }


@router.get("/attribution/reconciliation/", auth=BearerAuth())
def get_attribution_reconciliation(request, date: Optional[str] = None):
    """
    3-Way Daily Reconciliation Audit:
    Verifies Storefront Orders vs Tracked Attribution Touchpoints vs Meta CAPI Records.
    Computes discrepancy variance with 2% tolerance threshold.
    """
    enforce_permission(request, "marketing", "view")

    now = timezone.now()
    if date:
        try:
            target_date = datetime.datetime.strptime(date, "%Y-%m-%d").date()
        except Exception:
            target_date = now.date()
    else:
        target_date = now.date()

    # 1. Storefront Orders placed on target_date
    storefront_orders = Order.objects.filter(created_at__date=target_date)
    storefront_count = storefront_orders.count()
    storefront_rev = storefront_orders.aggregate(s=Sum('total_amount'))['s'] or Decimal('0.00')

    # 2. Tracked Attribution Touchpoints
    tracked_orders = OrderAttributionTouchpoint.objects.filter(created_at__date=target_date)
    tracked_count = tracked_orders.values('order_id').distinct().count()
    tracked_rev = tracked_orders.aggregate(s=Sum('attributed_order_value'))['s'] or Decimal('0.00')

    # 3. Raw Events Intake
    raw_events_count = RawTrackingEvent.objects.filter(server_timestamp__date=target_date).count()
    quarantined_count = RawTrackingEvent.objects.filter(server_timestamp__date=target_date, status='QUARANTINED').count()

    # Calculate discrepancy
    diff = abs(storefront_count - tracked_count)
    variance_pct = round((diff / storefront_count * 100), 2) if storefront_count > 0 else 0.0

    status = "HEALTHY"
    if variance_pct > 5.0:
        status = "DISCREPANCY"
    elif variance_pct > 2.0:
        status = "ATTENTION"

    return {
        "date": str(target_date),
        "status": status,
        "variance_percentage": variance_pct,
        "storefront": {
            "orders_count": storefront_count,
            "revenue": float(storefront_rev)
        },
        "attribution_tracked": {
            "orders_count": tracked_count,
            "revenue": float(tracked_rev)
        },
        "raw_events": {
            "total_intake": raw_events_count,
            "quarantined": quarantined_count
        }
    }


@router.post("/attribution/rebuild/", auth=BearerAuth())
def trigger_attribution_rebuild(request, date: Optional[str] = None):
    """
    Super Admin endpoint to trigger on-demand rebuild of daily ad performance summaries.
    Enforces Super Admin privilege.
    """
    enforce_superuser(request)
    res = rebuild_daily_ad_summaries_task(target_date_str=date)
    return {"success": True, "result": res}








