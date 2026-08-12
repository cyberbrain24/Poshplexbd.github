from django.db import models
from django.core.exceptions import ValidationError
from decimal import Decimal

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
