from django.core.management.base import BaseCommand
from apps.marketing.models import Competitor
from apps.marketing.competitor.services.meta_library import MetaLibraryService
from apps.marketing.competitor.services.google_library import GoogleAdsService
from apps.marketing.competitor.services.scraper import WebsitePlatformService
from apps.marketing.competitor.services.analyzer import CompetitorAnalyzerService

class Command(BaseCommand):
    help = "Seed initial Bangladesh streetwear competitors for Meta Engine (Meta, Google & Website Platform Analysis)"

    def handle(self, *args, **options):
        self.stdout.write("Seeding competitor profiles for Meta & Google intelligence...")

        competitors_data = [
            {
                "name": "Fabrilife",
                "meta_page_id": "fabrilife.official",
                "google_merchant_id": "fabrilife-bd-merchant",
                "website_url": "https://fabrilife.com",
                "primary_category": "STREETWEAR",
            },
            {
                "name": "Sailor",
                "meta_page_id": "sailorclothing",
                "google_merchant_id": "sailor-clothing-bd",
                "website_url": "https://sailor.clothing",
                "primary_category": "CASUAL",
            },
            {
                "name": "Klothe",
                "meta_page_id": "klotheofficial",
                "google_merchant_id": "klothe-street-bd",
                "website_url": "https://klothe.com.bd",
                "primary_category": "DROP_SHOULDER",
            },
            {
                "name": "Richman",
                "meta_page_id": "richmanbd",
                "google_merchant_id": "richman-bd",
                "website_url": "https://richmanbd.com",
                "primary_category": "CASUAL",
            },
        ]

        meta_svc = MetaLibraryService()
        google_svc = GoogleAdsService()
        website_svc = WebsitePlatformService()
        analyzer_svc = CompetitorAnalyzerService()

        for data in competitors_data:
            comp, created = Competitor.objects.get_or_create(
                name=data["name"],
                defaults=data
            )
            # Update fields if existed
            if not created:
                comp.google_merchant_id = data.get("google_merchant_id", "")
                comp.website_url = data.get("website_url", "")
                comp.save()

            self.stdout.write(f"{'Created' if created else 'Found'} competitor: {comp.name}")

            # Sync ads and run platform analyzer
            m_count = meta_svc.sync_to_db(comp)
            g_count = google_svc.sync_to_db(comp)
            website_svc.analyze_website_platform(comp)
            website_svc.compare_prices_and_generate_gaps(comp)
            score = analyzer_svc.calculate_threat_score(comp)
            self.stdout.write(
                f"  -> Synced {m_count} Meta ads, {g_count} Google ads. "
                f"Website Platform: {comp.website_platform} ({comp.website_products_count} products). "
                f"Threat Score: {score}/100"
            )

        analyzer_svc.analyze_unprocessed_ads(limit=25)
        self.stdout.write(self.style.SUCCESS("Successfully seeded all competitors with Meta, Google & Website Platform intelligence!"))
