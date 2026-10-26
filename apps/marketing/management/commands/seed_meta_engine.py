from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
import datetime
from decimal import Decimal
import random

from apps.marketing.models import MetaAdAccount, Campaign, AdSet, Creative, PerformanceSnapshot, AutomationRule
from apps.catalog.models import Product

User = get_user_model()

class Command(BaseCommand):
    help = "Seed realistic Meta Engine accounts, campaigns, adsets, creatives, and snapshots for development."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("🌱 Seeding Meta Engine sample data..."))

        admin_user = User.objects.filter(is_superuser=True).first() or User.objects.filter(role='admin').first() or User.objects.first()
        if not admin_user:
            self.stdout.write(self.style.ERROR("No users found in database. Create a user first."))
            return

        # 1. Seed Ad Account
        account, _ = MetaAdAccount.objects.get_or_create(
            meta_account_id="act_poshplex_bd_01",
            defaults={
                "owner": admin_user,
                "name": "PoshPlex Official Meta Ad Account",
                "currency": "USD",
                "timezone": "Asia/Dhaka",
                "is_active": True,
            }
        )
        account.set_access_token("mock_EAAK...poshplex_access_token_demo")
        account.save()
        self.stdout.write(self.style.SUCCESS(f"✓ MetaAdAccount: {account.name}"))

        # 2. Get Products for linking
        products = list(Product.objects.filter(is_active=True)[:5])

        campaign_specs = [
            {
                "name": "FW26 Drop - Oversized Heavyweight Tee",
                "objective": "SALES",
                "status": "ACTIVE",
                "budget_type": "DAILY",
                "budget_amount": Decimal('1200.00'),
                "meta_campaign_id": "meta_camp_892019481029",
                "product": products[0] if len(products) > 0 else None,
            },
            {
                "name": "Streetwear Acid Wash Hoodie Launch",
                "objective": "SALES",
                "status": "ACTIVE",
                "budget_type": "DAILY",
                "budget_amount": Decimal('1800.00'),
                "meta_campaign_id": "meta_camp_492019481944",
                "product": products[1] if len(products) > 1 else None,
            },
            {
                "name": "Brand Awareness - Dhaka Urban Subculture",
                "objective": "AWARENESS",
                "status": "PAUSED",
                "budget_type": "DAILY",
                "budget_amount": Decimal('600.00'),
                "meta_campaign_id": "meta_camp_102938475612",
                "product": products[2] if len(products) > 2 else None,
            },
            {
                "name": "Retro Cargo Pants - Retargeting",
                "objective": "SALES",
                "status": "DRAFT",
                "budget_type": "DAILY",
                "budget_amount": Decimal('800.00'),
                "meta_campaign_id": None,
                "product": products[3] if len(products) > 3 else None,
            }
        ]

        now = timezone.now()

        for spec in campaign_specs:
            camp, _ = Campaign.objects.get_or_create(
                ad_account=account,
                name=spec["name"],
                defaults={
                    "objective": spec["objective"],
                    "status": spec["status"],
                    "budget_type": spec["budget_type"],
                    "budget_amount": spec["budget_amount"],
                    "meta_campaign_id": spec["meta_campaign_id"],
                    "linked_product": spec["product"],
                    "start_date": now - datetime.timedelta(days=14),
                }
            )

            # AdSet
            adset, _ = AdSet.objects.get_or_create(
                campaign=camp,
                name=f"{camp.name} - Open Target Dhaka",
                defaults={
                    "targeting": {
                        "age_min": 18,
                        "age_max": 35,
                        "genders": [1, 2],
                        "geo_locations": {"countries": ["BD"]},
                        "interests": ["Streetwear", "Sneakers", "Hip hop fashion"],
                        "publisher_platforms": ["facebook", "instagram"]
                    },
                    "daily_budget": camp.budget_amount,
                    "meta_adset_id": f"meta_adset_{camp.id}_001" if camp.meta_campaign_id else None,
                }
            )

            # Creative
            img_url = "https://store.poshplexbd.com/logo.png"
            if camp.linked_product and camp.linked_product.images.exists():
                first_img = camp.linked_product.images.first()
                img_url = first_img.image.url if hasattr(first_img.image, 'url') else str(first_img.image)

            Creative.objects.get_or_create(
                adset=adset,
                name=f"{camp.name} - Ad Visual",
                defaults={
                    "headline": (camp.linked_product.name if camp.linked_product else camp.name)[:60],
                    "primary_text": "Heavyweight premium cotton engineered for Dhaka street style. Drop shoulder, anti-shrink fabric. Cash on delivery nationwide.",
                    "call_to_action": "SHOP_NOW",
                    "image_url": img_url,
                    "meta_creative_id": f"meta_cr_{camp.id}_001" if camp.meta_campaign_id else None,
                    "meta_ad_id": f"meta_ad_{camp.id}_001" if camp.meta_campaign_id else None,
                }
            )

            # Seed 14 days of snapshots for ACTIVE campaigns
            if camp.status == 'ACTIVE' and not camp.snapshots.exists():
                for day in range(14, 0, -1):
                    snap_time = now - datetime.timedelta(days=day)
                    spend = Decimal(str(random.randint(600, int(camp.budget_amount))))
                    clicks = random.randint(50, 190)
                    impressions = clicks * random.randint(18, 30)
                    conversions = max(1, int(clicks * random.uniform(0.03, 0.07)))
                    rev_mult = random.uniform(2.4, 4.6)
                    revenue = round(spend * Decimal(str(rev_mult)), 2)

                    PerformanceSnapshot.objects.create(
                        campaign=camp,
                        adset=adset,
                        snapshot_time=snap_time,
                        spend=spend,
                        impressions=impressions,
                        clicks=clicks,
                        conversions=conversions,
                        revenue_attributed=revenue,
                    )

        # 3. Automation Rules
        AutomationRule.objects.get_or_create(
            name="Auto-Scale High ROAS Winners (+20%)",
            defaults={
                "campaign": None,  # Global
                "condition_type": "ROAS_ABOVE",
                "threshold_value": Decimal('3.50'),
                "action": "SCALE_UP_20",
                "is_active": True,
                "cooldown_hours": 6,
            }
        )
        AutomationRule.objects.get_or_create(
            name="Emergency Budget Cut for Low ROAS (-20%)",
            defaults={
                "campaign": None,
                "condition_type": "ROAS_BELOW",
                "threshold_value": Decimal('1.80'),
                "action": "SCALE_DOWN_20",
                "is_active": True,
                "cooldown_hours": 12,
            }
        )
        AutomationRule.objects.get_or_create(
            name="Stop High Spend Bleeders (Pause)",
            defaults={
                "campaign": None,
                "condition_type": "SPEND_ABOVE",
                "threshold_value": Decimal('2500.00'),
                "action": "PAUSE",
                "is_active": False,
                "cooldown_hours": 24,
            }
        )

        self.stdout.write(self.style.SUCCESS("✓ Meta Engine sample data seeded successfully!"))
