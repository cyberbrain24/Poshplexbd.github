"""
Meta Agent Tool Suite (apps.marketing.agent.tools).
All tools strictly wrap existing v3 services and models.
"""
import logging
from decimal import Decimal
from typing import Dict, Any, List, Optional
from django.utils import timezone
import datetime
from django.db.models import Sum, Avg, Count, F
from django.conf import settings

from apps.marketing.models import Campaign, PerformanceSnapshot, MetaAdAccount, OrderAttribution
from apps.marketing.services.attribution import calculate_campaign_attributed_revenue
from apps.marketing.services.ai_engine import generate_ad_copy
from apps.marketing.services.meta_deployment import deploy_campaign, validate_pre_deployment
from apps.marketing.services.meta_client import MetaAPIClient
from apps.catalog.models import Product

logger = logging.getLogger(__name__)


def get_campaign_performance(campaign_id: Optional[int] = None, days: int = 7) -> List[Dict[str, Any]]:
    """
    Returns PerformanceSnapshot + OrderAttribution joined data.
    """
    now = timezone.now()
    since_dt = now - datetime.timedelta(days=days)

    qs = Campaign.objects.all().select_related('ad_account', 'linked_product')
    if campaign_id:
        qs = qs.filter(id=campaign_id)
    else:
        qs = qs.filter(status__in=['ACTIVE', 'PAUSED'])

    results = []
    for c in qs:
        # Snapshots aggregation
        snaps = PerformanceSnapshot.objects.filter(campaign=c, snapshot_time__gte=since_dt)
        agg = snaps.aggregate(
            total_spend=Sum('spend'),
            total_impressions=Sum('impressions'),
            total_clicks=Sum('clicks'),
            total_conversions=Sum('conversions'),
            avg_cpc=Avg('cpc'),
            avg_ctr=Avg('ctr')
        )

        spend = agg['total_spend'] or Decimal('0.00')
        impressions = agg['total_impressions'] or 0
        clicks = agg['total_clicks'] or 0
        conversions = agg['total_conversions'] or 0

        # Attributed revenue calculation from storefront Orders
        attributed_rev = calculate_campaign_attributed_revenue(c, since=since_dt, until=now)
        roas = round(float(attributed_rev / spend), 2) if spend > 0 else 0.0

        # CTR trend calculation (fatigue detection over last 3 days)
        last_3d = now - datetime.timedelta(days=3)
        recent_ctr = PerformanceSnapshot.objects.filter(
            campaign=c, snapshot_time__gte=last_3d
        ).aggregate(avg_ctr=Avg('ctr'))['avg_ctr'] or 0.0

        results.append({
            "campaign_id": c.id,
            "name": c.name,
            "status": c.status,
            "objective": c.objective,
            "budget_amount": float(c.budget_amount),
            "max_budget_cap": float(c.max_budget_cap) if c.max_budget_cap else float(c.budget_amount * 3),
            "linked_product_id": c.linked_product_id,
            "linked_product_name": c.linked_product.name if c.linked_product else None,
            "product_is_sold_out": getattr(c.linked_product, 'is_sold_out', False) if c.linked_product else False,
            "spend_window": float(spend),
            "revenue_window": float(attributed_rev),
            "roas": roas,
            "impressions": impressions,
            "clicks": clicks,
            "conversions": conversions,
            "avg_cpc": round(float(agg['avg_cpc'] or 0), 2),
            "avg_ctr": round(float(agg['avg_ctr'] or 0), 2),
            "recent_3d_ctr": round(float(recent_ctr), 2),
            "is_fatigued": recent_ctr < (agg['avg_ctr'] or 0.0) * 0.7 if (agg['avg_ctr'] or 0.0) > 0 else False
        })

    return results


def analyze_product_trend(days: int = 7) -> List[Dict[str, Any]]:
    """
    Returns top 5 products by orders in the last 7 days from apps.catalog + apps.orders.
    Helps determine whether an advertised product is trending, high-velocity, or out-of-stock.
    """
    try:
        from apps.orders.models import OrderItem
        now = timezone.now()
        since_dt = now - datetime.timedelta(days=days)

        # Aggregate order items by SKU
        item_stats = (
            OrderItem.objects.filter(order__created_at__gte=since_dt)
            .values('sku')
            .annotate(
                units_sold=Sum('quantity'),
                revenue_generated=Sum(F('quantity') * F('price'))
            )
            .order_by('-units_sold')[:10]
        )

        trending = []
        for item in item_stats:
            sku = item['sku']
            prod = Product.objects.filter(sku=sku).first()
            if not prod:
                # Try matching by variant or partial SKU
                prod = Product.objects.filter(variants__sku=sku).first()

            if prod:
                img_url = ""
                first_img = prod.images.first()
                if first_img and first_img.image:
                    img_url = first_img.image.url

                trending.append({
                    "product_id": prod.id,
                    "name": prod.name,
                    "sku": sku,
                    "units_sold_last_7d": item['units_sold'],
                    "revenue_last_7d": float(item['revenue_generated'] or 0),
                    "base_price": float(prod.base_price or 0),
                    "is_sold_out": getattr(prod, 'is_sold_out', False),
                    "is_active": prod.is_active,
                    "image_url": img_url,
                })

            if len(trending) >= 5:
                break

        # Fallback if no recent orders: return top 5 featured/active products from catalog
        if not trending:
            active_prods = Product.objects.filter(is_active=True, is_sold_out=False)[:5]
            for p in active_prods:
                img_url = ""
                first_img = p.images.first()
                if first_img and first_img.image:
                    img_url = first_img.image.url
                trending.append({
                    "product_id": p.id,
                    "name": p.name,
                    "sku": p.sku or f"SKU-{p.id}",
                    "units_sold_last_7d": 0,
                    "revenue_last_7d": 0.0,
                    "base_price": float(p.base_price or 0),
                    "is_sold_out": False,
                    "is_active": True,
                    "image_url": img_url,
                })

        return trending
    except Exception as e:
        logger.error(f"Error in analyze_product_trend: {e}")
        return []


def analyze_competitor_ads(keyword: str = "streetwear") -> Dict[str, Any]:
    """
    Mock for v4.1: Returns synthetic competitor intelligence for Bangladeshi streetwear market.
    """
    return {
        "keyword": keyword,
        "market": "Bangladesh (Dhaka, Chittagong, Sylhet)",
        "competitor_brands_analyzed": ["Fabrilife", "Sailor", "Richman", "Klothe", "Artisan"],
        "top_creative_hooks": [
            "240+ GSM Heavyweight Combed Compact Cotton",
            "Acid Wash Vintage Drop Shoulder Silhouette",
            "Cash on Delivery Nationwide / 24-hr Express Inside Dhaka",
            "Buy 2 Get 10% Off Combo Streetwear Bundle"
        ],
        "dominant_placements": ["Instagram Reels (9:16)", "Facebook Feed (4:5)"],
        "price_sweet_spot_bdt": "890 - 1,450 BDT",
        "market_sentiment": "High demand for heavyweight aesthetic oversized drops; high sensitivity to fast COD delivery."
    }


def generate_copy(product_id: int, angle: str = "hype") -> Dict[str, Any]:
    """
    Calls apps.marketing.services.ai_engine with prompt_hash deduplication and Redis caching.
    """
    return generate_ad_copy(
        product_id=product_id,
        angle=angle,
        batch_all_angles=False,
        premium_rewrite=False
    )


def create_campaign_from_product(product_id: int, budget: float = 1000.0, objective: str = "OUTCOME_SALES") -> Dict[str, Any]:
    """
    Creates a new campaign from an active catalog product and triggers deployment with safety checks.
    """
    product = Product.objects.filter(id=product_id).first()
    if not product:
        return {"success": False, "error": f"Product #{product_id} not found."}

    if getattr(product, 'is_sold_out', False) or not product.is_active:
        return {"success": False, "error": f"Product '{product.name}' is out-of-stock or inactive. Cannot run ads."}

    ad_account = MetaAdAccount.objects.filter(is_active=True).first()
    if not ad_account:
        return {"success": False, "error": "No active Meta Ad Account connected."}

    # Generate ad creative copy via AI engine
    copy_data = generate_ad_copy(product_id=product.id, angle="hype")
    headline = copy_data.get("headlines", [f"{product.name} | Limited Drop"])[0]
    primary_text = copy_data.get("primary_texts", ["Engineered heavyweight streetwear. COD nationwide."])[0]

    img_url = ""
    first_img = product.images.first()
    if first_img and first_img.image:
        img_url = first_img.image.url

    # Create Campaign
    clean_budget = Decimal(str(min(budget, 1000.0)))  # Respect first-time test safety cap
    max_cap = Decimal(str(budget * 3))

    campaign = Campaign.objects.create(
        ad_account=ad_account,
        linked_product=product,
        name=f"[Agent] {product.name} - Autopilot Drop",
        objective=objective,
        budget_type="DAILY",
        budget_amount=clean_budget,
        max_budget_cap=max_cap,
        is_first_time_test=True,
        status="DRAFT"
    )

    # Pre-deployment gate check
    valid, err_msg = validate_pre_deployment(campaign)
    if not valid:
        campaign.status = "ERROR"
        campaign.last_error = err_msg
        campaign.save(update_fields=['status', 'last_error'])
        return {"success": False, "error": err_msg}

    # Deploy
    deploy_res = deploy_campaign(campaign.id)
    return {
        "success": deploy_res.get("success", False),
        "campaign_id": campaign.id,
        "campaign_name": campaign.name,
        "daily_budget": float(clean_budget),
        "meta_campaign_id": campaign.meta_campaign_id,
        "error": deploy_res.get("error")
    }


def pause_campaign(campaign_id: int, reason: str = "Automated low ROAS or burn protection pause") -> Dict[str, Any]:
    """
    Halts campaign delivery on Meta API and updates local database state to PAUSED.
    """
    camp = Campaign.objects.filter(id=campaign_id).select_related('ad_account').first()
    if not camp:
        return {"success": False, "error": f"Campaign #{campaign_id} not found."}

    if camp.status == 'PAUSED':
        return {"success": True, "message": f"Campaign '{camp.name}' is already paused."}

    try:
        if camp.meta_campaign_id and camp.ad_account:
            token = camp.ad_account.get_access_token()
            client = MetaAPIClient(token, account_id=camp.ad_account.meta_account_id)
            client.post(camp.meta_campaign_id, json_data={"status": "PAUSED"})

        camp.status = 'PAUSED'
        camp.last_error = f"[Agent] {reason} at {timezone.now().strftime('%Y-%m-%d %H:%M')}"
        camp.save(update_fields=['status', 'last_error', 'updated_at'])

        logger.info(f"Agent paused campaign #{camp.id}: {reason}")
        return {"success": True, "campaign_id": camp.id, "name": camp.name, "status": "PAUSED"}
    except Exception as e:
        logger.error(f"Error pausing campaign #{campaign_id}: {e}")
        return {"success": False, "error": str(e)}


def scale_campaign(campaign_id: int, percent: int = 20) -> Dict[str, Any]:
    """
    Scales campaign budget, enforcing 24h cooldown and max_budget_cap ceiling.
    """
    camp = Campaign.objects.filter(id=campaign_id).select_related('ad_account').first()
    if not camp:
        return {"success": False, "error": f"Campaign #{campaign_id} not found."}

    if camp.status != 'ACTIVE':
        return {"success": False, "error": f"Cannot scale non-active campaign (current status: {camp.status})."}

    # Cooldown Check: only allow 1 scale action per 24 hours
    from apps.marketing.models import AutomationRule
    now = timezone.now()
    scale_rules = AutomationRule.objects.filter(campaign=camp, action='SCALE_UP_20')
    for r in scale_rules:
        if r.last_triggered_at and (now - r.last_triggered_at).total_seconds() < 24 * 3600:
            cooldown_left = 24 - int((now - r.last_triggered_at).total_seconds() / 3600)
            return {
                "success": False,
                "error": f"Scale cooldown active for '{camp.name}'. Must wait {cooldown_left}h before next scale."
            }

    # Ceiling Check
    old_budget = camp.budget_amount
    cap = camp.max_budget_cap if (camp.max_budget_cap and camp.max_budget_cap > Decimal('0.00')) else (old_budget * Decimal('3.00'))

    if old_budget >= cap:
        return {
            "success": False,
            "error": f"Campaign '{camp.name}' has already reached its safety budget ceiling (Cap: ${cap} USD)."
        }

    factor = Decimal(str(1 + (percent / 100.0)))
    proposed_budget = round(old_budget * factor, 2)
    new_budget = min(proposed_budget, cap)

    try:
        if camp.meta_campaign_id and camp.ad_account:
            token = camp.ad_account.get_access_token()
            client = MetaAPIClient(token, account_id=camp.ad_account.meta_account_id)
            for adset in camp.adsets.all():
                if adset.meta_adset_id:
                    client.post(adset.meta_adset_id, json_data={"daily_budget": int(new_budget * 100)})
                    adset.daily_budget = new_budget
                    adset.save(update_fields=['daily_budget', 'updated_at'])

        camp.budget_amount = new_budget
        camp.save(update_fields=['budget_amount', 'updated_at'])

        # Update last triggered on scale rules
        scale_rules.update(last_triggered_at=now)

        currency = (camp.ad_account.currency if camp.ad_account else 'USD') or 'USD'
        msg = f"Scaled budget +{percent}%: {currency} {old_budget} -> {currency} {new_budget} (Cap: {currency} {cap})"
        logger.info(f"Agent scaled campaign #{camp.id}: {msg}")
        return {
            "success": True,
            "campaign_id": camp.id,
            "old_budget": float(old_budget),
            "new_budget": float(new_budget),
            "cap": float(cap),
            "message": msg
        }
    except Exception as e:
        logger.error(f"Error scaling campaign #{campaign_id}: {e}")
        return {"success": False, "error": str(e)}


def create_lookalike_audience(campaign_id: int) -> Dict[str, Any]:
    """
    Mock for v4: Simulates creating a 1% lookalike audience from top customers in Bangladesh.
    """
    camp = Campaign.objects.filter(id=campaign_id).first()
    camp_name = camp.name if camp else f"Campaign #{campaign_id}"
    audience_id = f"custom_aud_{int(timezone.now().timestamp())}"
    return {
        "success": True,
        "audience_id": audience_id,
        "audience_name": f"PoshPlex BD 1% Lookalike (Top 20% LTV Customers) - {camp_name}",
        "country": "BD",
        "ratio": "1%",
        "estimated_size": "450,000 - 550,000 users",
        "message": "Lookalike audience configured and mapped to target Bangladesh streetwear buyers."
    }


def notify_admin(message: str, level: str = "INFO") -> Dict[str, Any]:
    """
    Dispatches notifications for the admin panel and system monitor.
    """
    prefix = f"[AGENT {level.upper()}]"
    if level.upper() == "CRITICAL" or level.upper() == "ERROR":
        logger.error(f"{prefix} {message}")
    elif level.upper() == "WARNING":
        logger.warning(f"{prefix} {message}")
    else:
        logger.info(f"{prefix} {message}")

    return {
        "success": True,
        "timestamp": timezone.now().isoformat(),
        "level": level.upper(),
        "message": message
    }


# ============================================================================
# Meta Engine v4.1 Competitor Intelligence Tools
# ============================================================================

def get_competitor_winning_ads(competitor_name: Optional[str] = None, category: Optional[str] = None, limit: int = 5) -> Dict[str, Any]:
    """
    Returns competitor ads that have run for >= 30 days (Lindy rule),
    proving long-term profitability in the Bangladesh market.
    """
    from apps.marketing.models import CompetitorAd
    qs = CompetitorAd.objects.filter(is_winning=True, is_active=True).select_related('competitor')
    if competitor_name:
        qs = qs.filter(competitor__name__icontains=competitor_name)
    if category:
        qs = qs.filter(competitor__primary_category__iexact=category)

    winning_ads = []
    for ad in qs.order_by('-days_running')[:limit]:
        winning_ads.append({
            "competitor": ad.competitor.name,
            "platform": ad.platform,
            "days_running": ad.days_running,
            "headline": ad.headline,
            "ad_text_sample": ad.ad_text[:120],
            "ai_hook": ad.ai_hook_analysis or "Problem/Solution street fit hook",
            "ai_angle": ad.ai_angle or "Streetwear Durability",
            "likes": ad.likes_count,
            "views": ad.views_count,
        })

    return {
        "success": True,
        "count": len(winning_ads),
        "winning_ads": winning_ads
    }


def get_competitor_gaps(category: Optional[str] = None) -> Dict[str, Any]:
    """
    Returns actionable price gaps (>10% cheaper PoshPlex items) and creative placement gaps.
    """
    from apps.marketing.models import CompetitorInsight
    qs = CompetitorInsight.objects.filter(insight_type__in=['PRICE_GAP', 'CREATIVE_STYLE', 'AUDIENCE_GAP'], is_dismissed=False)
    
    gaps = []
    for item in qs[:6]:
        gaps.append({
            "type": item.insight_type,
            "competitor": item.competitor.name if item.competitor else "Market",
            "title": item.title,
            "recommendation": item.actionable_recommendation,
            "counter_copy": item.suggested_ad_copy,
            "confidence": item.confidence_score,
        })

    return {
        "success": True,
        "gaps_count": len(gaps),
        "gaps": gaps
    }


def get_competitor_threat_report() -> Dict[str, Any]:
    """
    Returns competitor threat leaderboard, calculated from ad volume, Lindy ads, and TikTok engagement.
    """
    from apps.marketing.models import Competitor
    competitors = Competitor.objects.filter(is_active=True).order_by('-threat_score')
    
    summary = []
    for c in competitors[:5]:
        summary.append({
            "name": c.name,
            "threat_score": c.threat_score,
            "threat_level": "HIGH" if c.threat_score >= 70 else ("MEDIUM" if c.threat_score >= 40 else "LOW"),
            "active_meta_ads": c.active_meta_ads_count,
            "active_tiktok_ads": c.active_tiktok_ads_count,
            "winning_ads": c.winning_ads_count,
            "avg_running_days": c.avg_ad_running_days,
        })

    return {
        "success": True,
        "total_monitored": competitors.count(),
        "high_threat_count": competitors.filter(threat_score__gte=70).count(),
        "leaderboard": summary
    }


def get_tiktok_trends(category: Optional[str] = None) -> Dict[str, Any]:
    """
    Returns trending TikTok streetwear sounds and formats for adapting into Meta Reels.
    """
    from apps.marketing.competitor.services.tiktok_library import TikTokLibraryService
    trends = TikTokLibraryService().get_trending_streetwear_sounds()
    return {
        "success": True,
        "trends_count": len(trends),
        "trending_sounds": trends
    }

