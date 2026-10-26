import logging
from typing import List, Optional, Dict, Any
from ninja import Router, Schema
from django.shortcuts import get_object_or_404
from django.utils import timezone
from apps.marketing.models import Competitor, CompetitorAd, CompetitorInsight, CompetitorSnapshot
from apps.marketing.competitor.services.meta_library import MetaLibraryService
from apps.marketing.competitor.services.google_library import GoogleAdsService
from apps.marketing.competitor.services.scraper import WebsitePlatformService
from apps.marketing.competitor.services.analyzer import CompetitorAnalyzerService

logger = logging.getLogger(__name__)

router = Router(tags=["Meta Engine Competitor Intelligence"])

# Schemas
class CompetitorCreateSchema(Schema):
    name: str
    meta_page_id: Optional[str] = ""
    google_merchant_id: Optional[str] = ""
    website_url: Optional[str] = ""
    primary_category: Optional[str] = "STREETWEAR"

class CompetitorOutSchema(Schema):
    id: int
    name: str
    meta_page_id: str
    google_merchant_id: str
    website_url: str
    website_platform: str
    website_tech_stack: Dict[str, Any]
    primary_category: str
    threat_score: int
    active_meta_ads_count: int
    active_google_ads_count: int
    website_products_count: int
    avg_ad_running_days: float
    winning_ads_count: int
    is_active: bool
    last_synced_at: Optional[str] = None

class CompetitorAdOutSchema(Schema):
    id: int
    competitor_id: int
    competitor_name: str
    platform: str
    external_ad_id: str
    ad_text: str
    headline: str
    call_to_action: str
    first_seen_date: Optional[str] = None
    days_running: int
    is_active: bool
    is_winning: bool
    creative_type: str
    media_url: str
    thumbnail_url: str
    views_count: int
    likes_count: int
    shares_count: int
    ai_hook_analysis: str
    ai_angle: str
    ai_threat_level: str
    raw_metadata: Dict[str, Any]

class CompetitorInsightOutSchema(Schema):
    id: int
    competitor_name: Optional[str] = None
    insight_type: str
    title: str
    description: str
    actionable_recommendation: str
    suggested_ad_copy: str
    confidence_score: float
    created_at: str

# Endpoints
@router.get("/list", response=List[CompetitorOutSchema])
def list_competitors(request):
    """
    Returns all monitored competitors with real-time threat scores,
    active Meta & Google ad counts, and detected website platform.
    """
    qs = Competitor.objects.all().order_by('-threat_score', 'name')
    results = []
    for c in qs:
        results.append({
            "id": c.id,
            "name": c.name,
            "meta_page_id": c.meta_page_id or "",
            "google_merchant_id": c.google_merchant_id or "",
            "website_url": c.website_url or "",
            "website_platform": c.website_platform or "Shopify",
            "website_tech_stack": c.website_tech_stack or {},
            "primary_category": c.primary_category,
            "threat_score": c.threat_score,
            "active_meta_ads_count": c.active_meta_ads_count,
            "active_google_ads_count": c.active_google_ads_count,
            "website_products_count": c.website_products_count,
            "avg_ad_running_days": c.avg_ad_running_days,
            "winning_ads_count": c.winning_ads_count,
            "is_active": c.is_active,
            "last_synced_at": c.last_synced_at.isoformat() if c.last_synced_at else None,
        })
    return results

@router.post("/create", response=CompetitorOutSchema)
def create_competitor(request, payload: CompetitorCreateSchema):
    """
    Registers a new competitor and triggers initial sync across Meta, Google, and Website platforms.
    """
    competitor = Competitor.objects.create(
        name=payload.name,
        meta_page_id=payload.meta_page_id or "",
        google_merchant_id=payload.google_merchant_id or "",
        website_url=payload.website_url or "",
        primary_category=payload.primary_category or "STREETWEAR",
    )

    # Initial multi-source sync
    try:
        MetaLibraryService().sync_to_db(competitor)
        GoogleAdsService().sync_to_db(competitor)
        WebsitePlatformService().analyze_website_platform(competitor)
        WebsitePlatformService().compare_prices_and_generate_gaps(competitor)
        CompetitorAnalyzerService().calculate_threat_score(competitor)
        competitor.refresh_from_db()
    except Exception as e:
        logger.warning(f"Initial sync for {competitor.name} had error: {e}")

    return {
        "id": competitor.id,
        "name": competitor.name,
        "meta_page_id": competitor.meta_page_id,
        "google_merchant_id": competitor.google_merchant_id,
        "website_url": competitor.website_url,
        "website_platform": competitor.website_platform,
        "website_tech_stack": competitor.website_tech_stack,
        "primary_category": competitor.primary_category,
        "threat_score": competitor.threat_score,
        "active_meta_ads_count": competitor.active_meta_ads_count,
        "active_google_ads_count": competitor.active_google_ads_count,
        "website_products_count": competitor.website_products_count,
        "avg_ad_running_days": competitor.avg_ad_running_days,
        "winning_ads_count": competitor.winning_ads_count,
        "is_active": competitor.is_active,
        "last_synced_at": competitor.last_synced_at.isoformat() if competitor.last_synced_at else None,
    }

@router.get("/winning-ads", response=List[CompetitorAdOutSchema])
def get_winning_ads(request, platform: Optional[str] = None, limit: int = 50):
    """
    Returns winning Lindy ads (running >= 30 days) across Meta and Google platforms.
    """
    qs = CompetitorAd.objects.filter(is_winning=True, is_active=True).select_related('competitor')
    if platform and platform != "ALL":
        qs = qs.filter(platform=platform)

    results = []
    for ad in qs[:limit]:
        results.append({
            "id": ad.id,
            "competitor_id": ad.competitor.id,
            "competitor_name": ad.competitor.name,
            "platform": ad.platform,
            "external_ad_id": ad.external_ad_id,
            "ad_text": ad.ad_text,
            "headline": ad.headline,
            "call_to_action": ad.call_to_action,
            "first_seen_date": ad.first_seen_date.isoformat() if ad.first_seen_date else None,
            "days_running": ad.days_running,
            "is_active": ad.is_active,
            "is_winning": ad.is_winning,
            "creative_type": ad.creative_type,
            "media_url": ad.media_url,
            "thumbnail_url": ad.thumbnail_url,
            "views_count": ad.views_count,
            "likes_count": ad.likes_count,
            "shares_count": ad.shares_count,
            "ai_hook_analysis": ad.ai_hook_analysis,
            "ai_angle": ad.ai_angle,
            "ai_threat_level": ad.ai_threat_level,
            "raw_metadata": ad.raw_metadata or {},
        })
    return results

@router.get("/insights", response=List[CompetitorInsightOutSchema])
def list_insights(request, insight_type: Optional[str] = None, limit: int = 30):
    """
    Returns actionable AI competitor insights, price gaps, and platform benchmarks.
    """
    qs = CompetitorInsight.objects.filter(is_dismissed=False).select_related('competitor').order_by('-created_at')
    if insight_type and insight_type != "ALL":
        qs = qs.filter(insight_type=insight_type)

    results = []
    for i in qs[:limit]:
        results.append({
            "id": i.id,
            "competitor_name": i.competitor.name if i.competitor else "Market General",
            "insight_type": i.insight_type,
            "title": i.title,
            "description": i.description,
            "actionable_recommendation": i.actionable_recommendation,
            "suggested_ad_copy": i.suggested_ad_copy,
            "confidence_score": i.confidence_score,
            "created_at": i.created_at.strftime("%Y-%m-%d %H:%M"),
        })
    return results

@router.get("/trends")
def get_trends(request):
    """
    Returns Google Search & Shopping Trends and Bangladesh streetwear market demand signals.
    """
    google_trends = GoogleAdsService().get_google_search_trends_bd()
    market_trends = WebsitePlatformService().get_market_trends_bd()
    return {
        "google_trends": google_trends,
        "search_trends": market_trends,
    }

@router.get("/google-ads")
def get_google_ads(request):
    """
    Returns active Google Shopping PLAs and Search Ads for monitored competitors.
    """
    competitors = Competitor.objects.filter(is_active=True)
    google_svc = GoogleAdsService()
    results = []
    for comp in competitors:
        shopping_items = google_svc.get_google_shopping_products(comp)
        search_ads = CompetitorAd.objects.filter(competitor=comp, platform="GOOGLE", is_active=True)
        ads_serialized = []
        for ad in search_ads:
            ads_serialized.append({
                "headline": ad.headline,
                "text": ad.ad_text,
                "days_running": ad.days_running,
                "creative_type": ad.creative_type,
                "is_winning": ad.is_winning,
                "keywords": ad.raw_metadata.get("keywords", ""),
                "sitelinks": ad.raw_metadata.get("sitelinks", []),
            })
        results.append({
            "competitor_id": comp.id,
            "competitor_name": comp.name,
            "google_merchant_id": comp.google_merchant_id,
            "active_google_ads_count": comp.active_google_ads_count,
            "shopping_products": shopping_items,
            "search_ads": ads_serialized,
        })
    return results

@router.get("/website-analysis")
def get_website_analysis(request):
    """
    Returns deep website platform intelligence (Shopify/WooCommerce detection,
    catalog size, active discount promo codes, and tech stack).
    """
    competitors = Competitor.objects.filter(is_active=True)
    results = []
    for comp in competitors:
        results.append({
            "competitor_id": comp.id,
            "competitor_name": comp.name,
            "website_url": comp.website_url,
            "website_platform": comp.website_platform,
            "website_products_count": comp.website_products_count,
            "tech_stack": comp.website_tech_stack or {},
        })
    return results

@router.post("/{competitor_id}/sync")
def sync_single_competitor(request, competitor_id: int):
    """
    Triggers an immediate sync across Meta All Products, Google All Products,
    and Website Platform for a competitor.
    """
    competitor = get_object_or_404(Competitor, id=competitor_id)
    m = MetaLibraryService().sync_to_db(competitor)
    g = GoogleAdsService().sync_to_db(competitor)
    WebsitePlatformService().analyze_website_platform(competitor)
    WebsitePlatformService().compare_prices_and_generate_gaps(competitor)
    score = CompetitorAnalyzerService().calculate_threat_score(competitor)
    CompetitorAnalyzerService().analyze_unprocessed_ads(limit=10)
    competitor.refresh_from_db()

    return {
        "status": "success",
        "competitor_id": competitor.id,
        "name": competitor.name,
        "meta_ads_synced": m,
        "google_ads_synced": g,
        "website_products_count": competitor.website_products_count,
        "website_platform": competitor.website_platform,
        "new_threat_score": score,
    }

@router.post("/sync-all")
def sync_all_competitors(request):
    """
    Triggers immediate sync across all active competitors for Meta, Google, and Website platforms.
    """
    from apps.marketing.competitor.tasks import sync_competitor_ads
    result = sync_competitor_ads()
    return {"status": "success", "result": result}
