from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal
from apps.marketing.services.meta_crypto import encrypt_token, decrypt_token

# Legacy Coupon model kept in place for database compatibility
class Coupon(models.Model):
    code = models.CharField(max_length=50, unique=True)
    discount_percent = models.PositiveIntegerField()
    active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.code} ({self.discount_percent}% off)"

class PromoCode(models.Model):
    REWARD_TYPE_CHOICES = (
        ('percent', 'Percentage Discount'),
        ('fixed', 'Fixed Discount'),
        ('freeship', 'Free Delivery'),
        ('membership', 'Membership Reward'),
    )
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, null=True)
    reward_type = models.CharField(max_length=20, choices=REWARD_TYPE_CHOICES, default='percent')
    discount_value = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    
    # Membership link
    membership_tier = models.CharField(max_length=50, blank=True, null=True, help_text="e.g. VIP, Platinum")
    
    # Discount controls
    max_discount_amount = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    min_order_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    
    # Usage limits
    total_usage_limit = models.PositiveIntegerField(blank=True, null=True)
    per_customer_limit = models.PositiveIntegerField(default=1)
    usage_count = models.PositiveIntegerField(default=0)
    
    # Validity
    starts_at = models.DateTimeField(blank=True, null=True)
    expires_at = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    
    # Banners
    banner_url = models.CharField(max_length=255, blank=True, null=True)
    banner_active = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if self.code:
            self.code = self.code.upper().strip()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.usages.exists():
            raise ValidationError("This promo code has past order usages and cannot be deleted. Deactivate it instead.")
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"{self.code} ({self.reward_type})"

class PromoUsageHistory(models.Model):
    promo_code = models.ForeignKey(PromoCode, on_delete=models.PROTECT, related_name='usages')
    order_id = models.IntegerField()
    customer_phone = models.CharField(max_length=50)
    discount_applied = models.DecimalField(max_digits=10, decimal_places=2)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Promo {self.promo_code.code} used on Order #{self.order_id}"

class ComboOffer(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True, blank=True)
    items_count = models.PositiveIntegerField(default=2, help_text="Number of items required for this bundle (e.g. 2 for Duo)")
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'), help_text="Percentage discount (e.g. 10 for 10% off)")
    free_delivery = models.BooleanField(default=False, help_text="Enable free delivery for this bundle tier")
    badge = models.CharField(max_length=50, blank=True, null=True, help_text="e.g. POPULAR, MOST POPULAR, BEST VALUE")
    subtitle = models.CharField(max_length=255, blank=True, null=True, help_text="e.g. Mix & Match Any 2 Products")
    perks = models.JSONField(default=list, blank=True, help_text="List of bullet highlights")
    is_active = models.BooleanField(default=True)
    listing_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.slug and self.name:
            from django.utils.text import slugify
            base_slug = slugify(self.name)
            slug = base_slug
            counter = 1
            while ComboOffer.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.items_count} items - {self.discount_percentage}% off)"


# ============================================================================
# META ENGINE MODELS (Meta Ads Optimization & Deployment Engine)
# ============================================================================

class MetaAdAccount(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='meta_ad_accounts')
    meta_account_id = models.CharField(max_length=64, unique=True, help_text="e.g. act_1234567890")
    name = models.CharField(max_length=255)
    currency = models.CharField(max_length=10, blank=True, default='USD', help_text="Fetched from Meta Graph API (e.g. USD)")
    timezone = models.CharField(max_length=50, blank=True, default='', help_text="Fetched from Meta Graph API")
    access_token_encrypted = models.TextField(help_text="Encrypted Meta access token")
    token_expires_at = models.DateTimeField(null=True, blank=True)
    daily_spend_cap = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Global daily spend cap in account currency. 0.00 = unlimited"
    )
    is_active = models.BooleanField(default=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'marketing_meta_ad_account'
        ordering = ['-created_at']

    def set_access_token(self, plain_token: str):
        self.access_token_encrypted = encrypt_token(plain_token)

    def get_access_token(self) -> str:
        return decrypt_token(self.access_token_encrypted)

    def __str__(self):
        return f"{self.name} ({self.meta_account_id})"


class Campaign(models.Model):
    OBJECTIVE_CHOICES = (
        ('SALES', 'Outcome: Sales / Conversions'),
        ('TRAFFIC', 'Outcome: Website Traffic'),
        ('LEAD', 'Outcome: Leads'),
        ('AWARENESS', 'Outcome: Brand Awareness'),
    )
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('DEPLOYING', 'Deploying to Meta'),
        ('ACTIVE', 'Active on Meta'),
        ('PAUSED', 'Paused'),
        ('ARCHIVED', 'Archived'),
        ('ERROR', 'Deployment Error'),
    )
    BUDGET_TYPE_CHOICES = (
        ('DAILY', 'Daily Budget'),
        ('LIFETIME', 'Lifetime Budget'),
    )

    ad_account = models.ForeignKey(MetaAdAccount, on_delete=models.CASCADE, related_name='campaigns')
    name = models.CharField(max_length=255)
    objective = models.CharField(max_length=50, choices=OBJECTIVE_CHOICES, default='SALES')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    budget_type = models.CharField(max_length=20, choices=BUDGET_TYPE_CHOICES, default='DAILY')
    budget_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('20.00'))
    max_budget_cap = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Hard safety ceiling for automated scaling. 0.00 defaults to 3x budget_amount"
    )
    is_first_time_test = models.BooleanField(
        default=True,
        help_text="Safety flag for new campaigns. Restricts budget to max $10 USD for first 24h"
    )
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)
    meta_campaign_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    linked_product = models.ForeignKey(
        'catalog.Product',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='meta_campaigns',
        help_text="Read-only catalog link to promoted product"
    )
    last_error = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'marketing_campaign'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['meta_campaign_id']),
            models.Index(fields=['linked_product']),
        ]

    def __str__(self):
        return f"{self.name} [{self.status}]"


class AdSet(models.Model):
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='adsets')
    name = models.CharField(max_length=255)
    targeting = models.JSONField(
        default=dict,
        blank=True,
        help_text="Targeting matrix: age_min, age_max, genders, countries, interests, placements"
    )
    bid_strategy = models.CharField(max_length=50, default='LOWEST_COST_WITHOUT_CAP')
    daily_budget = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    meta_adset_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'marketing_adset'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} (Campaign: {self.campaign.name})"


class Creative(models.Model):
    CTA_CHOICES = (
        ('SHOP_NOW', 'Shop Now'),
        ('LEARN_MORE', 'Learn More'),
        ('SIGN_UP', 'Sign Up'),
        ('ORDER_NOW', 'Order Now'),
    )

    adset = models.ForeignKey(AdSet, on_delete=models.CASCADE, related_name='creatives')
    name = models.CharField(max_length=255)
    headline = models.CharField(max_length=255)
    primary_text = models.TextField()
    description = models.TextField(blank=True, default='')
    call_to_action = models.CharField(max_length=50, choices=CTA_CHOICES, default='SHOP_NOW')
    image_url = models.CharField(max_length=500, blank=True, default='')
    video_url = models.CharField(max_length=500, blank=True, default='')
    meta_creative_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    meta_ad_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'marketing_creative'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.headline[:30]}...)"


class PerformanceSnapshot(models.Model):
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='snapshots')
    adset = models.ForeignKey(AdSet, on_delete=models.CASCADE, null=True, blank=True, related_name='snapshots')
    snapshot_time = models.DateTimeField(db_index=True)
    spend = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    impressions = models.PositiveIntegerField(default=0)
    clicks = models.PositiveIntegerField(default=0)
    conversions = models.PositiveIntegerField(default=0)
    revenue_attributed = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    roas = models.FloatField(default=0.0)
    cpc = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    ctr = models.FloatField(default=0.0)
    reach = models.PositiveIntegerField(default=0)
    frequency = models.FloatField(default=1.0)
    cpm = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    shop_clicks = models.PositiveIntegerField(default=0)
    link_clicks = models.PositiveIntegerField(default=0)
    cost_per_link_click = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    landing_page_views = models.PositiveIntegerField(default=0)
    cost_per_landing_page = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    cost_per_result = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'marketing_performance_snapshot'
        ordering = ['-snapshot_time']
        indexes = [
            models.Index(fields=['campaign', 'snapshot_time']),
            models.Index(fields=['adset', 'snapshot_time']),
        ]

    def save(self, *args, **kwargs):
        # Auto-compute ROAS, CPC, CTR, Frequency, CPM, Cost Per Result, Cost Per Landing Page if spend/impressions/clicks exist
        spend_dec = self.spend or Decimal('0.00')
        rev_dec = self.revenue_attributed or Decimal('0.00')
        if spend_dec > 0:
            self.roas = round(float(rev_dec) / float(spend_dec), 2)
        else:
            self.roas = 0.0

        if self.clicks and self.clicks > 0:
            self.cpc = round(spend_dec / Decimal(self.clicks), 2)
        else:
            self.cpc = Decimal('0.00')

        if self.link_clicks and self.link_clicks > 0:
            self.cost_per_link_click = round(spend_dec / Decimal(self.link_clicks), 2)
        else:
            self.cost_per_link_click = self.cpc

        if self.impressions and self.impressions > 0:
            self.ctr = round((self.clicks / self.impressions) * 100, 2)
            self.cpm = round((spend_dec / Decimal(self.impressions)) * Decimal('1000.00'), 2)
        else:
            self.ctr = 0.0
            self.cpm = Decimal('0.00')

        if self.reach and self.reach > 0 and self.impressions:
            self.frequency = round(self.impressions / self.reach, 2)
        elif self.impressions:
            self.frequency = 1.0

        if self.conversions and self.conversions > 0:
            self.cost_per_result = round(spend_dec / Decimal(self.conversions), 2)
        else:
            self.cost_per_result = Decimal('0.00')

        if self.landing_page_views and self.landing_page_views > 0:
            self.cost_per_landing_page = round(spend_dec / Decimal(self.landing_page_views), 2)
        else:
            self.cost_per_landing_page = Decimal('0.00')

        super().save(*args, **kwargs)

    def __str__(self):
        return f"Snapshot {self.campaign.name} @ {self.snapshot_time} (Spend: {self.spend}, ROAS: {self.roas}x)"


class AutomationRule(models.Model):
    CONDITION_CHOICES = (
        ('ROAS_BELOW', 'ROAS Below Threshold'),
        ('ROAS_ABOVE', 'ROAS Above Threshold'),
        ('SPEND_ABOVE', 'Daily Spend Above Threshold'),
        ('CPC_ABOVE', 'Cost Per Click Above Threshold'),
    )
    ACTION_CHOICES = (
        ('PAUSE', 'Pause Campaign on Meta'),
        ('SCALE_UP_20', 'Scale Daily Budget by +20%'),
        ('SCALE_DOWN_20', 'Scale Daily Budget by -20%'),
        ('NOTIFY', 'Log Notification Only'),
    )

    campaign = models.ForeignKey(
        Campaign,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='automation_rules',
        help_text="Leave blank to apply as a global rule for all campaigns"
    )
    name = models.CharField(max_length=150)
    condition_type = models.CharField(max_length=50, choices=CONDITION_CHOICES)
    threshold_value = models.DecimalField(max_digits=10, decimal_places=2)
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    is_active = models.BooleanField(default=True)
    cooldown_hours = models.PositiveIntegerField(default=6, help_text="Hours to wait before triggering again")
    last_triggered_at = models.DateTimeField(null=True, blank=True)
    last_trigger_log = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'marketing_automation_rule'
        ordering = ['-created_at']

    def __str__(self):
        scope = self.campaign.name if self.campaign else "GLOBAL"
        return f"Rule: {self.name} [{scope}] -> {self.action}"


class OrderAttribution(models.Model):
    """
    Decoupled bridge joining apps.orders.Order with apps.marketing.Campaign
    without modifying the core Order model schema.
    """
    order_id = models.PositiveIntegerField(db_index=True)
    campaign = models.ForeignKey(Campaign, on_delete=models.SET_NULL, null=True, blank=True, related_name='attributions')
    adset = models.ForeignKey(AdSet, on_delete=models.SET_NULL, null=True, blank=True)
    creative = models.ForeignKey(Creative, on_delete=models.SET_NULL, null=True, blank=True)
    fbclid = models.CharField(max_length=255, blank=True, default='')
    utm_source = models.CharField(max_length=100, default='facebook')
    utm_medium = models.CharField(max_length=100, default='paid')
    utm_campaign = models.CharField(max_length=100, blank=True, default='', db_index=True)
    order_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'marketing_order_attribution'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['order_id']),
            models.Index(fields=['utm_campaign', 'created_at']),
        ]

    def __str__(self):
        return f"Attribution Order #{self.order_id} -> Campaign: {self.campaign_id or self.utm_campaign} (BDT {self.order_total})"


class AIGenerationLog(models.Model):
    """
    Audit log and prompt caching store for LLM copy generations.
    Stores prompt_hash, token count, and calculated USD expenditure.
    """
    product = models.ForeignKey(
        'catalog.Product',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ai_generation_logs',
        help_text="Associated product for copy generation"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ai_generation_logs'
    )
    prompt_hash = models.CharField(max_length=64, db_index=True, help_text="SHA256 of product_id + angles + brand_voice")
    model_name = models.CharField(max_length=50, default='gpt-4o-mini')
    response = models.JSONField(default=dict)
    tokens_used = models.PositiveIntegerField(default=0)
    cost_usd = models.DecimalField(max_digits=8, decimal_places=5, default=Decimal('0.00000'))
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'marketing_ai_generation_log'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['prompt_hash', 'created_at']),
            models.Index(fields=['product', 'created_at']),
        ]

    def __str__(self):
        return f"AI Log #{self.id} (Hash: {self.prompt_hash[:8]}, Cost: ${self.cost_usd})"


class AIGenerationQuota(models.Model):
    """
    Per-user daily quota limiter to prevent LLM credit burn.
    Resets daily at midnight Asia/Dhaka.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ai_quota'
    )
    daily_limit = models.PositiveIntegerField(default=20)
    used_today = models.PositiveIntegerField(default=0)
    reset_date = models.DateField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'marketing_ai_generation_quota'

    def is_quota_available(self) -> bool:
        """Checks if user has remaining quota today, with lazy date reset for Asia/Dhaka."""
        import zoneinfo
        dhaka_tz = zoneinfo.ZoneInfo("Asia/Dhaka")
        today_dhaka = timezone.now().astimezone(dhaka_tz).date()
        if self.reset_date < today_dhaka:
            self.used_today = 0
            self.reset_date = today_dhaka
            self.save(update_fields=['used_today', 'reset_date', 'updated_at'])
        return self.used_today < self.daily_limit

    def increment(self):
        self.used_today += 1
        self.save(update_fields=['used_today', 'updated_at'])

    def __str__(self):
        return f"Quota for {self.user}: {self.used_today}/{self.daily_limit}"


# ============================================================================
# Meta Agent v4 Models
# ============================================================================

class AgentConfig(models.Model):
    """
    Singleton configuration for the Autonomous Meta Media Buyer Agent.
    """
    MODE_CHOICES = (
        ('SUGGEST', 'Suggest Only (Human Approval Required)'),
        ('AUTO', 'Autonomous Execution'),
    )

    mode = models.CharField(max_length=20, choices=MODE_CHOICES, default='SUGGEST')
    agent_daily_budget = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('50.00'), help_text="Daily budget cap for agent operations (USD)")
    is_enabled = models.BooleanField(default=True)
    auto_pause_enabled = models.BooleanField(default=True, help_text="Allow emergency low ROAS pausing even in SUGGEST mode")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'marketing_agent_config'
        verbose_name = 'Agent Configuration'

    @classmethod
    def get_solo(cls):
        config, _ = cls.objects.get_or_create(id=1)
        return config

    def __str__(self):
        return f"Meta Agent Config [Mode: {self.mode}, Enabled: {self.is_enabled}, Budget: USD {self.agent_daily_budget}]"


class AgentActionLog(models.Model):
    """
    Complete audit trail of every decision and action taken by the Meta Agent.
    """
    STATUS_CHOICES = (
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
        ('NEEDS_APPROVAL', 'Needs Approval'),
        ('REJECTED', 'Rejected'),
        ('EXECUTED', 'Executed'),
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    agent_cycle_id = models.CharField(max_length=64, db_index=True, help_text="Unique ID grouping actions within a single run cycle")
    reasoning_text = models.TextField(help_text="Agent's cognitive reasoning in English + Bangla")
    tool_name = models.CharField(max_length=100, db_index=True)
    campaign = models.ForeignKey(Campaign, on_delete=models.SET_NULL, null=True, blank=True, related_name='agent_action_logs')
    action_taken = models.CharField(max_length=255)
    outcome = models.TextField(blank=True, default='')
    cost_impact = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='SUCCESS', db_index=True)
    tool_params = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'marketing_agent_action_log'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M')}] {self.tool_name} -> {self.status} ({self.action_taken[:40]})"


class AgentMemoryEntry(models.Model):
    """
    Persistent strategic knowledge and market insights synthesized by the Agent over time.
    """
    key = models.CharField(max_length=255, unique=True, db_index=True)
    value = models.JSONField(default=dict)
    importance = models.FloatField(default=1.0)
    last_used_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'marketing_agent_memory_entry'
        ordering = ['-importance', '-last_used_at']

    def __str__(self):
        return f"Memory [{self.key}] (Importance: {self.importance})"


# ============================================================================
# Meta Engine v4.1 Competitor Intelligence Models
# ============================================================================

class Competitor(models.Model):
    """
    Monitored competitor brand profile across Meta All Products, Google All Products, and Website Storefront.
    """
    CATEGORY_CHOICES = (
        ('STREETWEAR', 'Streetwear & Urban'),
        ('DROP_SHOULDER', 'Drop Shoulder T-Shirts'),
        ('HOODIE', 'Hoodies & Winterwear'),
        ('CASUAL', 'Casual Wear'),
        ('DENIM', 'Denim & Bottoms'),
        ('LUXURY', 'Premium / Luxury Fashion'),
    )

    name = models.CharField(max_length=150, unique=True, db_index=True)
    meta_page_id = models.CharField(max_length=100, blank=True, default='', db_index=True, help_text="Meta Ad Library Page ID")
    google_merchant_id = models.CharField(max_length=100, blank=True, default='', help_text="Google Merchant / Transparency ID")
    website_url = models.URLField(max_length=500, blank=True, default='')
    website_platform = models.CharField(max_length=50, default='Shopify', help_text="Detected eCommerce platform (Shopify, WooCommerce, Custom, etc.)")
    website_tech_stack = models.JSONField(default=dict, blank=True, help_text="Detected tech stack, pixels, CDNs, analytics")
    primary_category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='STREETWEAR')
    threat_score = models.IntegerField(default=0, db_index=True, help_text="Dynamic threat score 0-100 calculated from ad volume, Lindy winning ads, and engagement")
    active_meta_ads_count = models.IntegerField(default=0)
    active_google_ads_count = models.IntegerField(default=0, help_text="Active Google Search & Shopping Ads count")
    website_products_count = models.IntegerField(default=0, help_text="Total active catalog products on website")
    active_tiktok_ads_count = models.IntegerField(default=0, help_text="Legacy counter, deprecated")
    tiktok_handle = models.CharField(max_length=100, blank=True, default='', help_text="Legacy handle, deprecated")
    avg_ad_running_days = models.FloatField(default=0.0)
    winning_ads_count = models.IntegerField(default=0, help_text="Number of ads running >= 30 days")
    is_active = models.BooleanField(default=True, db_index=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'marketing_competitor'
        ordering = ['-threat_score', 'name']

    def __str__(self):
        return f"{self.name} (Threat: {self.threat_score}/100, Meta: {self.active_meta_ads_count}, Google: {self.active_google_ads_count}, Products: {self.website_products_count})"


class CompetitorAd(models.Model):
    """
    Multi-platform competitor creative record (Meta Ad Library & Catalog, Google Shopping & Search, Website).
    """
    PLATFORM_CHOICES = (
        ('META', 'Meta Ad Library & Catalog'),
        ('GOOGLE', 'Google Shopping & Search Ads'),
        ('WEBSITE', 'Website Storefront & Catalog'),
    )

    CREATIVE_TYPE_CHOICES = (
        ('IMAGE', 'Single Image'),
        ('VIDEO', 'Video / Reel'),
        ('CAROUSEL', 'Carousel'),
        ('REEL', 'Vertical Reel (9:16)'),
        ('SEARCH_TEXT', 'Google Search Text Ad'),
        ('SHOPPING_PLA', 'Google Shopping Product Listing'),
    )

    THREAT_LEVEL_CHOICES = (
        ('LOW', 'Low Threat'),
        ('MEDIUM', 'Medium Threat'),
        ('HIGH', 'High Threat'),
    )

    competitor = models.ForeignKey(Competitor, on_delete=models.CASCADE, related_name='ads')
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES, default='META', db_index=True)
    external_ad_id = models.CharField(max_length=150, db_index=True)
    ad_text = models.TextField(blank=True, default='')
    headline = models.CharField(max_length=300, blank=True, default='')
    call_to_action = models.CharField(max_length=100, blank=True, default='SHOP_NOW')
    first_seen_date = models.DateField(null=True, blank=True, db_index=True)
    last_seen_date = models.DateField(null=True, blank=True)
    days_running = models.IntegerField(default=1, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    is_winning = models.BooleanField(default=False, db_index=True, help_text="Flagged True if running >= 30 days (Lindy winning ad rule)")
    creative_type = models.CharField(max_length=30, choices=CREATIVE_TYPE_CHOICES, default='IMAGE')
    media_url = models.URLField(max_length=1000, blank=True, default='')
    thumbnail_url = models.URLField(max_length=1000, blank=True, default='')
    views_count = models.BigIntegerField(default=0)
    likes_count = models.BigIntegerField(default=0)
    shares_count = models.BigIntegerField(default=0)
    target_gender = models.CharField(max_length=30, default='ALL')
    ai_hook_analysis = models.TextField(blank=True, default='')
    ai_angle = models.CharField(max_length=100, blank=True, default='')
    ai_threat_level = models.CharField(max_length=20, choices=THREAT_LEVEL_CHOICES, default='LOW')
    raw_metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'marketing_competitor_ad'
        unique_together = ('platform', 'external_ad_id')
        ordering = ['-days_running', '-first_seen_date']

    def __str__(self):
        win_badge = " [WINNING]" if self.is_winning else ""
        return f"{self.competitor.name} ({self.platform}){win_badge}: {self.headline or self.ad_text[:30]} ({self.days_running}d)"


class CompetitorInsight(models.Model):
    """
    Strategic intelligence extracted by AI from competitor ads and market activity.
    """
    INSIGHT_TYPE_CHOICES = (
        ('WINNING_HOOK', 'Winning Hook / Angle'),
        ('CREATIVE_STYLE', 'Creative Style / Format'),
        ('PRICE_GAP', 'Price Advantage / Gap'),
        ('AUDIENCE_GAP', 'Audience / Demographic Gap'),
        ('PLACEMENT_GAP', 'Placement / Platform Gap'),
        ('TRENDING_PRODUCT', 'Trending Product Category'),
        ('GOOGLE_PRODUCT_TREND', 'Google Shopping & Search Trend'),
        ('WEBSITE_PLATFORM_INTEL', 'Website Platform & Tech Stack Intel'),
    )

    competitor = models.ForeignKey(Competitor, on_delete=models.CASCADE, null=True, blank=True, related_name='insights')
    insight_type = models.CharField(max_length=40, choices=INSIGHT_TYPE_CHOICES, db_index=True)
    title = models.CharField(max_length=255)
    description = models.TextField()
    actionable_recommendation = models.TextField(blank=True, default='')
    suggested_ad_copy = models.TextField(blank=True, default='')
    confidence_score = models.FloatField(default=0.85)
    is_dismissed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'marketing_competitor_insight'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.insight_type}] {self.title} ({int(self.confidence_score * 100)}%)"


class CompetitorSnapshot(models.Model):
    """
    Daily snapshot of competitor metrics for historical trend analysis.
    """
    competitor = models.ForeignKey(Competitor, on_delete=models.CASCADE, related_name='snapshots')
    snapshot_date = models.DateField(db_index=True)
    meta_ads_count = models.IntegerField(default=0)
    google_ads_count = models.IntegerField(default=0)
    website_products_count = models.IntegerField(default=0)
    tiktok_ads_count = models.IntegerField(default=0)
    estimated_spend_tier = models.CharField(max_length=50, default='MEDIUM')
    threat_score = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'marketing_competitor_snapshot'
        unique_together = ('competitor', 'snapshot_date')
        ordering = ['-snapshot_date']

    def __str__(self):
        return f"{self.competitor.name} Snapshot ({self.snapshot_date}): Score {self.threat_score}"


# ============================================================================
# Meta Engine AI & Multi-API Integration Models
# ============================================================================

class AIProviderConfig(models.Model):
    """
    Configured AI API provider credentials (e.g. OpenAI, Google Gemini, Anthropic, DeepSeek, Groq).
    Keys are securely encrypted using Fernet encryption.
    """
    PROVIDER_TYPE_CHOICES = (
        ('OPENAI', 'OpenAI (GPT-4o, GPT-4o-mini)'),
        ('GEMINI', 'Google Gemini (Gemini 2.0 Flash, 1.5 Pro)'),
        ('ANTHROPIC', 'Anthropic Claude (Claude 3.5 Sonnet, Haiku)'),
        ('DEEPSEEK', 'DeepSeek (DeepSeek-V3, R1)'),
        ('GROQ', 'Groq LPU (Llama 3.3 70B, Mixtral)'),
        ('CUSTOM', 'Custom OpenAI-Compatible Endpoint'),
    )

    name = models.CharField(max_length=150, unique=True, help_text="Friendly name e.g. 'OpenAI Production'")
    provider_type = models.CharField(max_length=30, choices=PROVIDER_TYPE_CHOICES, default='OPENAI')
    api_key_encrypted = models.TextField(help_text="Fernet encrypted API key")
    base_url = models.CharField(max_length=500, blank=True, default='', help_text="Custom API base URL if applicable")
    default_model = models.CharField(max_length=100, default='gpt-4o-mini')
    is_active = models.BooleanField(default=True, db_index=True)
    total_calls = models.IntegerField(default=0)
    total_tokens_used = models.BigIntegerField(default=0)
    total_cost_usd = models.DecimalField(max_digits=12, decimal_places=5, default=Decimal('0.00000'))
    last_tested_at = models.DateTimeField(null=True, blank=True)
    last_test_status = models.CharField(max_length=30, default='UNTESTED')  # SUCCESS, FAILED, UNTESTED
    last_latency_ms = models.IntegerField(default=0)
    last_error = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'marketing_ai_provider_config'
        ordering = ['name']

    def set_api_key(self, plain_key: str):
        self.api_key_encrypted = encrypt_token(plain_key)

    def get_api_key(self) -> str:
        return decrypt_token(self.api_key_encrypted)

    @property
    def masked_key(self) -> str:
        try:
            k = self.get_api_key()
            if len(k) > 10:
                return f"{k[:7]}...{k[-4:]}"
            return "******"
        except Exception:
            return "******"

    def __str__(self):
        return f"{self.name} ({self.provider_type}) - {self.last_test_status}"


class AIOperationRoute(models.Model):
    """
    Dynamic routing table mapping specific Meta Engine operations to a designated AI Provider & Model.
    """
    OPERATION_CHOICES = (
        ('AD_COPY', 'Ad Copy Generation'),
        ('COMPETITOR_SPY', 'Competitor Spy & Hook Analysis'),
        ('AGENT_BRAIN', 'Meta Agent Brain (Reasoning & Optimization)'),
        ('PRODUCT_RESEARCH', 'Product & Catalog Trend Research'),
        ('DEFAULT', 'General / Fallback AI Operations'),
    )

    operation = models.CharField(max_length=50, choices=OPERATION_CHOICES, unique=True, db_index=True)
    provider = models.ForeignKey(AIProviderConfig, on_delete=models.SET_NULL, null=True, blank=True, related_name='operation_routes')
    model_name = models.CharField(max_length=100, default='gpt-4o-mini', help_text="Specific model used for this operation")
    temperature = models.FloatField(default=0.3)
    max_tokens = models.IntegerField(default=800)
    is_enabled = models.BooleanField(default=True)
    total_calls = models.IntegerField(default=0)
    total_tokens_used = models.BigIntegerField(default=0)
    total_cost_usd = models.DecimalField(max_digits=12, decimal_places=5, default=Decimal('0.00000'))
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'marketing_ai_operation_route'
        ordering = ['operation']

    def __str__(self):
        p_name = self.provider.name if self.provider else "None (Fallback)"
        return f"Route [{self.get_operation_display()}] -> {p_name} ({self.model_name})"







