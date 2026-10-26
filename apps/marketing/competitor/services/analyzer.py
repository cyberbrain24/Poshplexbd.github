import json
import logging
from datetime import date
from typing import Dict, Any, List, Optional
from django.utils import timezone
from apps.marketing.models import Competitor, CompetitorAd, CompetitorInsight, CompetitorSnapshot

logger = logging.getLogger(__name__)

class CompetitorAnalyzerService:
    """
    Multi-source competitor intelligence analyzer.
    Calculates threat scores, evaluates winning Lindy ads, and extracts hooks using AI.
    """

    def calculate_threat_score(self, competitor: Competitor) -> int:
        """
        Threat Score Formula:
        Threat = (meta_ads * 2.0) + (google_ads * 2.5) + (website_products * 0.05) + (avg_days * 0.5) + (winning_ads * 10.0) + (total_views / 15000.0)
        Capped at 100.
        """
        meta_ads = competitor.active_meta_ads_count
        google_ads = competitor.active_google_ads_count
        website_products = competitor.website_products_count
        avg_days = competitor.avg_ad_running_days
        winning_ads = competitor.winning_ads_count

        # Total views across active Meta & Google ads
        active_ads = CompetitorAd.objects.filter(competitor=competitor, is_active=True)
        total_views = sum(a.views_count for a in active_ads)

        score = (meta_ads * 2.0) + (google_ads * 2.5) + (website_products * 0.05) + (avg_days * 0.5) + (winning_ads * 10.0) + (total_views / 15000.0)
        final_score = int(min(100, max(0, round(score))))

        competitor.threat_score = final_score
        competitor.save(update_fields=['threat_score', 'updated_at'])

        # Record daily snapshot
        today = date.today()
        spend_tier = "AGGRESSIVE" if final_score >= 75 else ("HIGH" if final_score >= 50 else ("MEDIUM" if final_score >= 30 else "LOW"))
        CompetitorSnapshot.objects.update_or_create(
            competitor=competitor,
            snapshot_date=today,
            defaults={
                "meta_ads_count": meta_ads,
                "google_ads_count": google_ads,
                "website_products_count": website_products,
                "estimated_spend_tier": spend_tier,
                "threat_score": final_score,
            }
        )

        return final_score

    def analyze_unprocessed_ads(self, limit: int = 15) -> int:
        """
        Finds ads running >= 7 days without AI hook analysis and analyzes them in batches of 5.
        """
        unprocessed = CompetitorAd.objects.filter(
            days_running__gte=7,
            ai_hook_analysis="",
            is_active=True
        ).select_related('competitor')[:limit]

        if not unprocessed.exists():
            return 0

        analyzed_count = 0
        batch = []
        for ad in unprocessed:
            batch.append(ad)
            if len(batch) >= 5:
                self._process_ad_batch(batch)
                analyzed_count += len(batch)
                batch = []

        if batch:
            self._process_ad_batch(batch)
            analyzed_count += len(batch)

        return analyzed_count

    def _process_ad_batch(self, ads: List[CompetitorAd]):
        """
        Processes a batch of up to 5 ads using AI reasoning or heuristic synthesis.
        """
        for ad in ads:
            hook, angle, threat = self._synthesize_ad_intelligence(ad)
            ad.ai_hook_analysis = hook
            ad.ai_angle = angle
            ad.ai_threat_level = threat
            ad.save(update_fields=['ai_hook_analysis', 'ai_angle', 'ai_threat_level', 'updated_at'])

            # If ad is winning (>= 30 days), create a WINNING_HOOK insight
            if ad.is_winning:
                CompetitorInsight.objects.update_or_create(
                    competitor=ad.competitor,
                    insight_type="WINNING_HOOK",
                    title=f"Winning Creative ({ad.days_running} Days): {ad.competitor.name}",
                    defaults={
                        "description": f"Ad has been running profitably on {ad.platform} for {ad.days_running} days. Headline: '{ad.headline}'.",
                        "actionable_recommendation": f"Adopt this proven hook structure: {hook}",
                        "suggested_ad_copy": f"Counter with PoshPlex angle: {ad.ad_text[:120]}... Engineered with premium 240 GSM combed cotton.",
                        "confidence_score": 0.90,
                    }
                )

    def _synthesize_ad_intelligence(self, ad: CompetitorAd) -> tuple[str, str, str]:
        """
        Synthesizes the hook angle and threat level based on copy patterns, duration, and metrics.
        """
        text = (ad.headline + " " + ad.ad_text).lower()
        days = ad.days_running

        if "sale" in text or "off" in text or "code" in text or "%" in text:
            angle = "Urgency & Price Discount"
            hook = "Direct price-drop hook emphasizing immediate savings and fast cash on delivery."
        elif "gsm" in text or "cotton" in text or "fabric" in text or "wash" in text:
            angle = "Fabric Quality & Durability"
            hook = "Material superiority hook showing close-up texture, collar ribbing, and anti-shrinkage."
        elif "viral" in text or "oversized" in text or "drop shoulder" in text or "aesthetic" in text:
            angle = "Streetwear Trend & Silhouette"
            hook = "Style comparison / OOTD hook highlighting boxy structure and street fit."
        else:
            angle = "Lifestyle & Brand Identity"
            hook = "Identity-based hook associating the apparel with modern Dhaka urban culture."

        threat = "HIGH" if (days >= 30 or ad.views_count > 100000) else ("MEDIUM" if days >= 14 else "LOW")
        return hook, angle, threat
