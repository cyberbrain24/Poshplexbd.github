from django.db import models
from django.core.exceptions import ValidationError
from django.core.cache import cache
from django.conf import settings

class Category(models.Model):
    objects = models.Manager()
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)
    image = models.FileField(upload_to='category_images/', null=True, blank=True)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
    is_active = models.BooleanField(default=True)
    listing_order = models.IntegerField(default=0, help_text="Used for manual display ordering (lower numbers appear first).")

    class Meta:
        ordering = ['listing_order', 'id']
        indexes = [
            models.Index(fields=['slug']),
        ]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        cache.delete("category_tree")
        cache.delete("category_tree_all")

    def delete(self, *args, **kwargs):
        if self.products.exists() or self.multi_products.exists():
            raise ValidationError("This category cannot be deleted because it is linked to active products.")
        
        # Cleanup image file
        if self.image:
            try:
                self.image.delete(save=False)
            except Exception:
                pass
                
        super().delete(*args, **kwargs)
        cache.delete("category_tree")
        cache.delete("category_tree_all")

    def __str__(self):
        return self.name

class Brand(models.Model):
    objects = models.Manager()
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)
    listing_order = models.IntegerField(default=0, help_text="Used for manual display ordering (lower numbers appear first).")

    class Meta:
        ordering = ['listing_order', 'id']

    def delete(self, *args, **kwargs):
        if self.products.exists():
            raise ValidationError("This brand cannot be deleted because it is linked to active products.")
        super().delete(*args, **kwargs)

    def __str__(self):
        return self.name

class ProductAttribute(models.Model):
    objects = models.Manager()
    TYPE_CHOICES = (
        ('text', 'Text'),
        ('number', 'Number'),
        ('boolean', 'Boolean'),
        ('select', 'Select'),
    )
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, unique=True, help_text="e.g. 'color' or 'fabric_weight'")
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    choices = models.JSONField(default=list, blank=True, help_text="List of choices if type is 'select'")
    listing_order = models.IntegerField(default=0, help_text="Used for manual display ordering (lower numbers appear first).")

    class Meta:
        ordering = ['listing_order', 'id']

    def delete(self, *args, **kwargs):
        from apps.catalog.models import ProductVariant
        if ProductVariant.objects.filter(attributes__has_key=self.code).exists():
            raise ValidationError("This attribute cannot be deleted because it is used by product variants.")
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.type})"

class SizeGuideTemplate(models.Model):
    objects = models.Manager()
    name = models.CharField(max_length=100)
    headers = models.JSONField(default=list, help_text="e.g. ['Size', 'Chest', 'Length']")
    rows = models.JSONField(default=list, help_text="e.g. [['S', '44', '26'], ['M', '46', '27']]")

    def __str__(self):
        return self.name

class CareInstructionsTemplate(models.Model):
    objects = models.Manager()
    name = models.CharField(max_length=100)
    instructions = models.TextField()

    def __str__(self):
        return self.name

class Product(models.Model):
    objects = models.Manager()
    PRODUCT_TYPE_CHOICES = (
        ('simple', 'Simple'),
        ('variable', 'Variable'),
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    sku = models.CharField(max_length=100, unique=True, blank=True, null=True)
    product_type = models.CharField(max_length=20, choices=PRODUCT_TYPE_CHOICES, default='simple')
    short_description = models.TextField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    base_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    
    # Category links
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    categories = models.ManyToManyField(Category, related_name='multi_products', blank=True)
    brand = models.ForeignKey(Brand, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    
    # Templates
    size_guide_template = models.ForeignKey(SizeGuideTemplate, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    care_instructions_template = models.ForeignKey(CareInstructionsTemplate, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    
    # Video configurations
    youtube_video_url = models.CharField(max_length=255, blank=True, null=True)
    video_autoplay = models.BooleanField(default=False)
    video_mute = models.BooleanField(default=True)
    
    listing_order = models.IntegerField(default=0, help_text="Used for manual display ordering (lower numbers appear first).")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['listing_order', '-created_at']
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['is_active', 'is_featured']),
            models.Index(fields=['category', 'brand']),
        ]

    def clean(self):
        super().clean()
        if not self.name:
            raise ValidationError("Product name is required.")
        
        # Unique SKU checks across products and variants
        if self.sku:
            if Product.objects.filter(sku=self.sku).exclude(pk=self.pk).exists() or ProductVariant.objects.filter(sku=self.sku).exists():
                raise ValidationError(f"SKU '{self.sku}' is already taken.")
            
        if self.base_price is not None and self.base_price < 0:
            raise ValidationError("Base price cannot be negative.")
            
        if self.product_type == 'variable' and self.is_active:
            if self.pk:
                if not self.variants.filter(is_active=True).exists():
                    raise ValidationError("Variable products must have at least one active variant to be saved as Active.")

    def save(self, *args, **kwargs):
        # Auto-generate SKU if blank
        if not self.sku and self.name:
            import uuid
            self.sku = f"PROD-{uuid.uuid4().hex[:8].upper()}"
        
        # Base price roll-up logic for variables
        if self.product_type == 'variable' and self.base_price is None and self.pk:
            active_variants = self.variants.filter(is_active=True)
            if active_variants.exists():
                from django.db.models import Min
                min_price = active_variants.aggregate(min_price=Min('selling_price'))['min_price']
                if min_price is not None:
                    self.base_price = min_price

        self.full_clean()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Blocking orders check
        skus_to_check = [self.sku] if self.sku else []
        if self.pk:
            skus_to_check.extend(self.variants.values_list('sku', flat=True))
            
        from django.apps import apps
        OrderItem = apps.get_model('orders', 'OrderItem')
        if OrderItem.objects.filter(sku__in=skus_to_check).exists():
            raise ValidationError("This product cannot be deleted because it appears in past orders.")
            
        # Cascades cleanup
        for img in self.images.all():
            img.delete()
            
        super().delete(*args, **kwargs)

    def __str__(self):
        return self.name

class ProductImage(models.Model):
    objects = models.Manager()
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image = models.FileField(upload_to='product_images/')
    alt_text = models.CharField(max_length=255, blank=True, null=True)
    is_main = models.BooleanField(default=False)
    color_tag = models.CharField(max_length=100, blank=True, null=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', '-id']

    def save(self, *args, **kwargs):
        # Image optimization and WebP conversion
        if self.image:
            from io import BytesIO
            from django.core.files.base import ContentFile
            import os

            try:
                from PIL import Image
                img = Image.open(self.image)
                if img.format != 'WEBP':
                    buffer = BytesIO()
                    img.convert('RGB').save(buffer, format='WEBP', quality=85)
                    name = os.path.splitext(self.image.name)[0] + '.webp'
                    self.image.save(name, ContentFile(buffer.getvalue()), save=False)
            except Exception:
                pass

        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Cleanup files to prevent orphaned storage records
        if self.image:
            try:
                self.image.delete(save=False)
            except Exception:
                pass
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"Image for {self.product.name} (Main: {self.is_main})"

class ProductVariant(models.Model):
    objects = models.Manager()
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variants')
    sku = models.CharField(max_length=100, unique=True)
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    selling_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, help_text="Synced legacy price field")
    is_active = models.BooleanField(default=True)
    image = models.ForeignKey(ProductImage, on_delete=models.SET_NULL, null=True, blank=True, related_name='variants')
    attributes = models.JSONField(default=dict, blank=True, help_text="Mapped attributes. e.g. {'size': 'L', 'color': 'black'}")

    class Meta:
        indexes = [
            models.Index(fields=['sku']),
            models.Index(fields=['product', 'is_active']),
        ]

    def clean(self):
        super().clean()
        if not isinstance(self.attributes, dict):
            raise ValidationError("Attributes must be a dictionary.")

        # Duplicate prevention check
        if self.product_id:
            duplicates = ProductVariant.objects.filter(product=self.product, attributes=self.attributes).exclude(pk=self.pk)
            if duplicates.exists():
                raise ValidationError("A variant with this combination of attributes already exists for this product.")
                
        if self.selling_price < 0:
            raise ValidationError("Selling price cannot be negative.")
        if self.purchase_price is not None and self.purchase_price < 0:
            raise ValidationError("Purchase price cannot be negative.")
            
        # Unique SKU checking across products and variants
        if self.sku:
            if Product.objects.filter(sku=self.sku).exists() or ProductVariant.objects.filter(sku=self.sku).exclude(pk=self.pk).exists():
                raise ValidationError(f"SKU '{self.sku}' is already taken.")

        # Dynamic validation
        for attr_code, attr_value in self.attributes.items():
            try:
                attr_def = ProductAttribute.objects.get(code=attr_code)
            except ProductAttribute.DoesNotExist:
                raise ValidationError(f"Attribute with code '{attr_code}' is not defined.")

            if attr_def.type == 'number':
                if not isinstance(attr_value, (int, float)) and not str(attr_value).replace('.', '', 1).isdigit():
                    raise ValidationError(f"Attribute '{attr_code}' expects a numeric value.")
            elif attr_def.type == 'boolean':
                if not isinstance(attr_value, bool) and str(attr_value).lower() not in ('true', 'false'):
                    raise ValidationError(f"Attribute '{attr_code}' expects a boolean value.")
            elif attr_def.type == 'select':
                if attr_value not in attr_def.choices:
                    raise ValidationError(f"Attribute '{attr_code}' value '{attr_value}' is not a valid choice.")

    def save(self, *args, **kwargs):
        # Keep legacy price field synced
        self.price = self.selling_price
        self.full_clean()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        from django.apps import apps
        OrderItem = apps.get_model('orders', 'OrderItem')
        if OrderItem.objects.filter(sku=self.sku).exists():
            raise ValidationError("This variant cannot be deleted because it is referenced in past orders.")
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"{self.product.name} ({self.sku})"

class Review(models.Model):
    objects = models.Manager()
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews')
    rating = models.PositiveSmallIntegerField(default=5)
    comment = models.TextField()
    images = models.JSONField(default=list, blank=True) # List of image URLs
    is_approved = models.BooleanField(default=False)
    is_featured = models.BooleanField(default=False)
    listing_order = models.IntegerField(default=0, help_text="Used for manual display ordering (lower numbers appear first).")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('product', 'user')
        ordering = ['listing_order', '-created_at']

    def clean(self):
        super().clean()
        if not (1 <= self.rating <= 5):
            raise ValidationError("Rating must be between 1 and 5.")

    def delete(self, *args, **kwargs):
        from django.core.files.storage import default_storage
        from urllib.parse import urlparse
        from django.conf import settings
        
        if self.images:
            for url in self.images:
                if url:
                    parsed = urlparse(url)
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
        return f"{self.user.username}'s Review on {self.product.name} ({self.rating} stars)"


# ─────────────────────────────────────────────────────────────────────────────
# ProductEmbedding — Screenshot-to-Order pipeline: semantic search sidecar
# Stores a pre-computed vector embedding for each product's text description.
# Additive table. The existing Product model is NOT modified.
# Phase 1: stores embedding as JSONField (plain list of floats, no extension needed).
# Phase 3 upgrade path: swap JSONField for pgvector VectorField via a single migration.
# ─────────────────────────────────────────────────────────────────────────────

class ProductEmbedding(models.Model):
    """
    Sidecar table that stores a pre-computed text-embedding vector for each active product.
    
    Populated / refreshed by a nightly Celery Beat task (catalog.tasks.refresh_product_embeddings).
    Used by CatalogMatchService to execute semantic similarity search when the Vision LLM
    returns a product description that does not exactly match a product name in the catalog.
    
    Embedding source text format (concatenated at embed-time):
        "{product.name} {product.short_description} {category.name} {colors} {sizes}"
    
    This format maximises visual-to-text alignment for clothing items.
    """

    objects = models.Manager()

    product = models.OneToOneField(
        "catalog.Product",
        on_delete=models.CASCADE,
        related_name="embedding",
        help_text="The product this embedding vector belongs to.",
    )
    # Phase 1: stored as a plain JSON list of floats (e.g. 1536-dim for text-embedding-3-small).
    # Phase 3 upgrade: replace with pgvector.django.VectorField(dimensions=1536)
    vector = models.JSONField(
        default=list,
        help_text="Float array — the semantic embedding vector for this product.",
    )
    model_name = models.CharField(
        max_length=100,
        default="text-embedding-3-small",
        help_text="The embedding model used to generate this vector. Track for version invalidation.",
    )
    source_text = models.TextField(
        blank=True,
        help_text="The exact text that was embedded. Stored for debugging and re-embed detection.",
    )
    embedded_at = models.DateTimeField(auto_now=True, help_text="Timestamp of last embedding refresh.")

    class Meta:
        verbose_name = "Product Embedding"
        verbose_name_plural = "Product Embeddings"

    def __str__(self):
        return f"Embedding for [{self.product.sku}] {self.product.name} (dim={len(self.vector)})"


