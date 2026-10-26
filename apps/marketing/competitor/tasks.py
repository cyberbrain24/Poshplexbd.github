import logging
from celery import shared_task
from django.utils import timezone
from apps.marketing.models import Competitor, CompetitorAd, CompetitorInsight, AgentMemoryEntry
from apps.marketing.competitor.services.meta_library import MetaLibraryService
from apps.marketing.competitor.services.google_library import GoogleAdsService
from apps.marketing.competitor.services.scraper import WebsitePlatformService
from apps.marketing.competitor.services.analyzer import CompetitorAnalyzerService

logger = logging.getLogger(__name__)

@shared_task(name="sync_competitor_ads")
def sync_competitor_ads(competitor_id=None):
    """
    Ingests Meta All Products and Google All Products ads for competitors,
    analyzes website platform and price gaps, and updates dynamic threat scores.
    """
    logger.info("Starting competitor multi-source sync task (Meta, Google, Website)...")
    meta_service = MetaLibraryService()
    google_service = GoogleAdsService()
    website_service = WebsitePlatformService()
    analyzer_service = CompetitorAnalyzerService()

    qs = Competitor.objects.filter(is_active=True)
    if competitor_id:
        qs = qs.filter(id=competitor_id)

    total_synced = 0
    for competitor in qs:
        try:
            m_count = meta_service.sync_to_db(competitor)
            g_count = google_service.sync_to_db(competitor)
            website_service.analyze_website_platform(competitor)
            website_service.compare_prices_and_generate_gaps(competitor)
            analyzer_service.calculate_threat_score(competitor)
            total_synced += (m_count + g_count)
            logger.info(
                f"Synced {competitor.name}: {m_count} Meta ads, {g_count} Google ads, "
                f"{competitor.website_products_count} website products ({competitor.website_platform}). Score: {competitor.threat_score}"
            )
        except Exception as e:
            logger.error(f"Failed syncing competitor {competitor.name}: {e}")

    # Trigger batch analysis for new ads running >= 7 days
    analyzed = analyzer_service.analyze_unprocessed_ads(limit=25)
    logger.info(f"Competitor sync completed. Total ads: {total_synced}, Analyzed: {analyzed}")
    return {"total_synced": total_synced, "analyzed": analyzed}

@shared_task(name="analyze_new_competitor_ads")
def analyze_new_competitor_ads():
    """
    Autonomous task to analyze newly matured competitor ads (running >= 7 days).
    """
    analyzer = CompetitorAnalyzerService()
    count = analyzer.analyze_unprocessed_ads(limit=25)
    return {"analyzed_count": count}

@shared_task(name="sync_google_trends")
def sync_google_trends():
    """
    Daily task to refresh Google Shopping & Search trends in Bangladesh.
    """
    google_service = GoogleAdsService()
    trends = google_service.get_google_search_trends_bd()
    return {"trends_count": len(trends)}

@shared_task(name="generate_weekly_competitor_report")
def generate_weekly_competitor_report():
    """
    Weekly Monday 09:00 AM strategic debrief on competitor moves.
    Stores intelligence into AgentMemoryEntry for the Meta Agent brain.
    """
    competitors = Competitor.objects.filter(is_active=True)
    total_winning = CompetitorAd.objects.filter(is_winning=True, is_active=True).count()
    high_threat = competitors.filter(threat_score__gte=70).count()

    summary_payload = {
        "report_date": timezone.now().date().isoformat(),
        "monitored_competitors_count": competitors.count(),
        "high_threat_competitors_count": high_threat,
        "active_winning_ads_count": total_winning,
        "top_threats": list(competitors.order_by('-threat_score')[:3].values(
            'name', 'threat_score', 'active_meta_ads_count', 'active_google_ads_count', 'website_products_count', 'website_platform'
        )),
    }

    AgentMemoryEntry.objects.update_or_create(
        key="weekly_competitor_intelligence_brief",
        defaults={
            "value": summary_payload,
            "importance": 1.4,
        }
    )
    logger.info(f"Saved weekly competitor briefing to AgentMemoryEntry: {summary_payload}")
    return summary_payload
