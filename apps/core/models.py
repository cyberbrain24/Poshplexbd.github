from django.contrib.auth.models import AbstractUser
from django.db import models
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.core.cache import cache

class User(AbstractUser):
    # Enforce role types for Poshplex administration
    ROLE_CHOICES = (
        ('admin', 'Administrator'),
        ('accountant', 'Accountant'),
        ('catalog_manager', 'Catalog Manager'),
        ('customer_service', 'Customer Service'),
        ('marketer', 'Marketer'),
        ('customer', 'Customer'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='customer')
    
    def has_module_permission(self, module_name: str, action: str) -> bool:
        """
        Check if user role has a specific module action permission.
        Superusers have all permissions.
        """
        if self.is_superuser:
            return True
            
        role_permissions = {
            'admin': {'*'},
            'accountant': {'finance.view_ledger', 'finance.record_transaction', 'core.view_settings'},
            'catalog_manager': {'catalog.view_catalog', 'catalog.edit_catalog', 'core.upload_media'},
            'customer_service': {'crm.view_customers', 'crm.edit_customers', 'orders.view_orders', 'orders.edit_orders'},
            'marketer': {'marketing.manage_campaigns', 'catalog.view_catalog'},
            'customer': set(),
        }
        
        perms = role_permissions.get(self.role, set())
        if '*' in perms:
            return True
        return f"{module_name}.{action}" in perms

class SiteSetting(models.Model):
    key = models.CharField(max_length=100, unique=True)
    value = models.JSONField(help_text="Flexible JSON structure for setting value")
    description = models.TextField(blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Invalidate cache on save
        cache_key = f"site_setting:{self.key}"
        cache.set(cache_key, self.value, timeout=3600)

    def delete(self, *args, **kwargs):
        cache_key = f"site_setting:{self.key}"
        cache.delete(cache_key)
        super().delete(*args, **kwargs)

    @classmethod
    def get_value(cls, key: str, default=None):
        cache_key = f"site_setting:{key}"
        cached_val = cache.get(cache_key)
        if cached_val is not None:
            return cached_val
            
        try:
            setting = cls.objects.get(key=key)
            cache.set(cache_key, setting.value, timeout=3600)
            return setting.value
        except cls.DoesNotExist:
            return default

class AuditLog(models.Model):
    ACTION_CHOICES = (
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
    )
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    model_name = models.CharField(max_length=100)
    model_id = models.CharField(max_length=100)
    old_values = models.JSONField(default=dict, blank=True)
    new_values = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        user_str = self.user.username if self.user else "System"
        return f"[{self.action}] {self.model_name} (ID: {self.model_id}) by {user_str} at {self.timestamp}"

class MediaAsset(models.Model):
    file = models.FileField(upload_to='media_library/%Y/%m/')
    file_name = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=100)
    file_size = models.BigIntegerField(help_text="File size in bytes")
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.file_name

class MediaUsage(models.Model):
    asset = models.ForeignKey(MediaAsset, on_delete=models.CASCADE, related_name='usages')
    
    # Generic Foreign Key to track any model referencing the media asset
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    
    usage_context = models.CharField(max_length=100, help_text="e.g. 'product_image', 'category_banner'")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('asset', 'content_type', 'object_id', 'usage_context')
