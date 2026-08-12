from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone

class MembershipTier(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    show_on_public = models.BooleanField(default=True)
    show_member_since = models.BooleanField(default=True)
    
    objects = models.Manager()

    def __str__(self):
        return self.name

class CustomerProfile(models.Model):
    GENDER_CHOICES = (
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
        ('unspecified', 'Unspecified')
    )
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='crm_profile')
    phone = models.CharField(max_length=50, unique=True, default='', help_text="Customer identity key")
    email = models.EmailField(blank=True, null=True)
    gender = models.CharField(max_length=20, choices=GENDER_CHOICES, default='unspecified')
    birthdate = models.DateField(blank=True, null=True)
    profile_image = models.URLField(blank=True, null=True, help_text="URL to customer profile image")
    
    # Location hierarchy keys
    district = models.ForeignKey('orders.District', on_delete=models.SET_NULL, null=True, blank=True, related_name='customers')
    thana = models.ForeignKey('orders.Thana', on_delete=models.SET_NULL, null=True, blank=True, related_name='customers')
    address = models.TextField(blank=True, null=True, help_text="Detailed street address")
    
    # Membership
    membership_tier = models.ForeignKey(MembershipTier, on_delete=models.PROTECT, null=True, blank=True, related_name='customers')
    tier_assigned_at = models.DateTimeField(default=timezone.now)
    
    # Internal remarks
    internal_notes = models.TextField(blank=True, null=True)
    is_pinned = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    objects = models.Manager()

    class Meta:
        indexes = [
            models.Index(fields=['phone']),
            models.Index(fields=['user']),
        ]

    def clean(self):
        super().clean()
        if not self.phone:
            raise ValidationError("Phone number is required.")
            
    def save(self, *args, **kwargs):
        if not self.membership_tier_id:
            standard_tier = MembershipTier.objects.filter(name__iexact='Standard').first()
            if standard_tier:
                self.membership_tier = standard_tier
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Cannot delete customer with linked orders
        from django.apps import apps
        Order = apps.get_model('orders', 'Order')
        if Order.objects.filter(user=self.user).exists():
            raise ValidationError("This customer has existing orders and cannot be deleted. Soft-deactivate them instead.")

        from django.core.files.storage import default_storage
        from urllib.parse import urlparse
        from django.conf import settings
        
        if self.profile_image:
            parsed = urlparse(self.profile_image)
            path = parsed.path
            if path.startswith(settings.MEDIA_URL):
                rel_path = path[len(settings.MEDIA_URL):]
                try:
                    if default_storage.exists(rel_path):
                        default_storage.delete(rel_path)
                except Exception:
                    pass

        super().delete(*args, **kwargs)

    def __str__(self):
        return f"CRM Profile for {self.user.username} ({self.phone})"

class CRMNote(models.Model):
    customer = models.ForeignKey(CustomerProfile, on_delete=models.CASCADE, related_name='crm_notes')
    author_username = models.CharField(max_length=150)
    note = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    objects = models.Manager()

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"CRM Note by {self.author_username} for {self.customer.user.username}"
