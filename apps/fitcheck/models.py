import uuid
from decimal import Decimal
from django.db import models
from django.conf import settings
from django.utils import timezone


class FitCheckConfig(models.Model):
    """
    Singleton configuration for AI Virtual Fit Check engine.
    Holds API credentials, provider configurations, and prompt parameters.
    """
    PROVIDER_CHOICES = [
        ('mock_sandbox', 'Mock Sandbox (Zero-Cost Local Blending)'),
        ('fashn', 'Fashn.ai Try-On API'),
        ('fal', 'Fal.ai Virtual Try-On (IDM-VTON)'),
        ('replicate', 'Replicate (Kwai-Kolors / IDM-VTON)'),
    ]

    provider = models.CharField(max_length=40, choices=PROVIDER_CHOICES, default='mock_sandbox')
    api_key = models.CharField(max_length=500, blank=True, default='', help_text="Third-party AI API key (stored securely)")
    api_url = models.CharField(max_length=500, blank=True, default='', help_text="Custom endpoint URL if using self-hosted or proxy")
    model_id = models.CharField(max_length=100, default='idm-vton-v1', help_text="Target AI model identifier")
    mock_mode = models.BooleanField(
        default=True, 
        help_text="If enabled, uses local high-speed PIL blending without consuming external API credits"
    )
    daily_budget_cap_usd = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=Decimal('50.00'), 
        help_text="Maximum allowed external AI API spend per day in USD"
    )
    guest_trial_limit = models.PositiveIntegerField(
        default=1, 
        help_text="Number of free trials allowed for anonymous visitors"
    )
    user_daily_limit = models.PositiveIntegerField(
        default=10, 
        help_text="Daily fit check quota for registered and authenticated customers"
    )
    prompt_templates = models.JSONField(
        default=dict, 
        blank=True,
        help_text="Prompt modifiers customized per body structure and streetwear aesthetics"
    )
    is_active = models.BooleanField(default=True, help_text="Master switch to enable/disable virtual try-on engine")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Fit Check Configuration'
        verbose_name_plural = 'Fit Check Configuration'

    @classmethod
    def get_solo(cls):
        config, _ = cls.objects.get_or_create(id=1)
        return config

    def __str__(self):
        return f"FitCheckConfig (Provider: {self.provider}, Mock: {self.mock_mode})"


class UserCharacterProfile(models.Model):
    """
    Stores and links the registered customer's permanent AI character representation
    and body metrics to their account for persistent retrieval and future edits.
    """
    BODY_STRUCTURE_CHOICES = [
        ('slim', 'Slim'),
        ('athletic', 'Athletic / Average'),
        ('full_figured', 'Full-Figured'),
        ('plus_size', 'Plus-Size'),
    ]

    GENDER_CHOICES = [
        ('unisex', 'Unisex'),
        ('male', 'Male'),
        ('female', 'Female'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='fitcheck_character'
    )
    face_image = models.ImageField(
        upload_to='fitcheck/faces/',
        blank=True,
        null=True,
        help_text="Customer front-facing portrait photo"
    )
    face_image_url = models.TextField(
        blank=True,
        default='',
        help_text="Cached public CDN / Cloudflare R2 URL of face image"
    )
    height_cm = models.PositiveIntegerField(
        default=175,
        help_text="Customer height in centimeters (e.g. 175cm / ~5ft 9in)"
    )
    body_structure = models.CharField(
        max_length=30,
        choices=BODY_STRUCTURE_CHOICES,
        default='athletic',
        help_text="Target body silhouette category"
    )
    gender_preference = models.CharField(
        max_length=20,
        choices=GENDER_CHOICES,
        default='unisex'
    )
    generation_seed = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Fixed seed for character visual consistency across clothing try-ons"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Customer AI Character Profile'
        verbose_name_plural = 'Customer AI Character Profiles'

    def __str__(self):
        return f"CharacterProfile for {self.user.username} ({self.body_structure}, {self.height_cm}cm)"


class FitCheckUsage(models.Model):
    """
    Tracks guest device/IP fingerprints and registered user IDs for daily quotas and trial limits.
    """
    guest_fingerprint = models.CharField(max_length=128, blank=True, null=True, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='fitcheck_usages'
    )
    usage_date = models.DateField(default=timezone.now, db_index=True)
    count_today = models.PositiveIntegerField(default=0)
    trial_consumed = models.BooleanField(
        default=False,
        help_text="Flag indicating whether 1-time guest trial has been spent"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Fit Check Usage & Quota'
        verbose_name_plural = 'Fit Check Usages & Quotas'
        indexes = [
            models.Index(fields=['guest_fingerprint', 'trial_consumed']),
            models.Index(fields=['user', 'usage_date']),
        ]

    def __str__(self):
        if self.user:
            return f"User {self.user.username} - {self.usage_date}: {self.count_today} checks"
        return f"Guest {self.guest_fingerprint} - Trial Consumed: {self.trial_consumed}"


class FitCheckLog(models.Model):
    """
    Audit log of each AI fit check generation. Records input metrics, latency, cost, and results.
    """
    STATUS_CHOICES = [
        ('queued', 'Queued'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    job_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='fitcheck_logs'
    )
    guest_fingerprint = models.CharField(max_length=128, blank=True, null=True, db_index=True)
    product_id = models.IntegerField(null=True, blank=True)
    product_name = models.CharField(max_length=255, default='PoshPlex Apparel')
    product_image_url = models.TextField(blank=True, default='')
    face_image_url = models.TextField(blank=True, default='')
    result_image_url = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='queued', db_index=True)
    error_message = models.TextField(blank=True, default='')
    latency_seconds = models.FloatField(default=0.0)
    estimated_cost_usd = models.DecimalField(max_digits=6, decimal_places=4, default=Decimal('0.0000'))
    body_metrics = models.JSONField(default=dict, blank=True)
    provider_used = models.CharField(max_length=50, default='mock_sandbox')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'Fit Check Generation Log'
        verbose_name_plural = 'Fit Check Generation Logs'
        ordering = ['-created_at']

    def __str__(self):
        return f"FitCheckLog {self.job_id} ({self.status}) - {self.product_name}"


class BodyStructure(models.Model):
    """
    Configurable Body Structure models with custom dummy character images.
    Allows admin to upload custom mannequin/character reference photos on white background.
    """
    code = models.CharField(max_length=50, unique=True, help_text="Unique code e.g. 'slim', 'athletic', 'full_figured', 'plus_size'")
    name = models.CharField(max_length=100, help_text="Display title e.g. 'Athletic / Average'")
    description = models.TextField(blank=True, default='', help_text="Description or fit info displayed to customers")
    dummy_image = models.ImageField(upload_to='fitcheck/structures/', blank=True, null=True, help_text="Dummy character photo on white background")
    dummy_image_url = models.TextField(blank=True, default='', help_text="Cached public CDN / Cloudflare R2 URL")
    display_order = models.PositiveIntegerField(default=0, help_text="Order in storefront cards")
    is_active = models.BooleanField(default=True, help_text="Whether this structure is active and visible")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Body Structure'
        verbose_name_plural = 'Body Structures'
        ordering = ['display_order', 'id']

    def __str__(self):
        return f"{self.name} ({self.code})"

    @classmethod
    def seed_defaults(cls):
        defaults = [
            {
                "code": "slim",
                "name": "Slim",
                "description": "Slender build with lean torso and tailored drape",
                "display_order": 1
            },
            {
                "code": "athletic",
                "name": "Athletic / Average",
                "description": "Balanced streetwear silhouette with broad shoulders",
                "display_order": 2
            },
            {
                "code": "full_figured",
                "name": "Full-Figured",
                "description": "Curvaceous silhouette with fuller chest and hips",
                "display_order": 3
            },
            {
                "code": "plus_size",
                "name": "Plus-Size",
                "description": "Generous, relaxed silhouette with oversized streetwear drape",
                "display_order": 4
            }
        ]
        for item in defaults:
            cls.objects.get_or_create(code=item["code"], defaults=item)

