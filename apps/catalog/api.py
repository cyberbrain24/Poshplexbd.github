from typing import List, Dict, Any, Optional
from decimal import Decimal
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from ninja import Router, Schema, File, Form
from ninja.files import UploadedFile
from ninja.errors import HttpError

from apps.catalog.models import Category, ProductAttribute, Product, ProductVariant, Brand, SizeGuideTemplate, CareInstructionsTemplate, ProductImage, Review
from apps.catalog.services import get_cached_category_tree, duplicate_product, import_products_from_csv
from apps.catalog.selectors import get_product_details
from apps.core.api import BearerAuth, enforce_permission

router = Router()

# --- Schemas ---

class CategoryTreeSchema(Schema):
    id: int
    name: str
    slug: str
    parent_id: Optional[int] = None
    is_active: Optional[bool] = True
    listing_order: int = 0
    image: Optional[str] = None
    children: List[Any] = []

class BrandSchema(Schema):
    id: int
    name: str
    slug: str
    listing_order: int = 0

class BrandInputSchema(Schema):
    name: str
    slug: str
    listing_order: int = 0

class SizeGuideTemplateSchema(Schema):
    id: int
    name: str
    headers: List[str]
    rows: List[List[str]]

class CareInstructionsTemplateSchema(Schema):
    id: int
    name: str
    instructions: str

class ProductAttributeSchema(Schema):
    id: int
    name: str
    code: str
    type: str
    choices: List[str]
    listing_order: int

class ProductAttributeCreateSchema(Schema):
    name: str
    code: str
    type: str
    choices: Optional[List[str]] = []
    listing_order: int = 0

# Variant schemas
class VariantInputSchema(Schema):
    id: Optional[int] = None
    sku: str
    purchase_price: Optional[Decimal] = None
    selling_price: Decimal
    is_active: Optional[bool] = True
    attributes: Dict[str, Any] = {}
    image_id: Optional[int] = None
    variant_image_url: Optional[str] = None

class VariantResponseSchema(Schema):
    id: int
    sku: str
    purchase_price: Optional[Decimal] = None
    selling_price: Decimal
    price: Decimal
    is_active: bool
    attributes: Dict[str, Any]
    image_id: Optional[int] = None

# Product schemas
class ProductCreateInputSchema(Schema):
    name: str
    sku: Optional[str] = None
    product_type: str = "simple"
    short_description: Optional[str] = ""
    description: Optional[str] = ""
    is_active: Optional[bool] = True
    is_featured: Optional[bool] = False
    listing_order: int = 0
    base_price: Optional[Decimal] = None
    brand_id: Optional[int] = None
    category_ids: List[int]
    size_guide_template_id: Optional[int] = None
    care_instructions_template_id: Optional[int] = None
    youtube_video_url: Optional[str] = ""
    video_autoplay: Optional[bool] = False
    video_mute: Optional[bool] = True
    variants: List[VariantInputSchema] = []
    attributes: Optional[Dict[str, Any]] = {}
    image_urls: Optional[List[str]] = None

class ImageResponseSchema(Schema):
    id: int
    url: str
    alt_text: Optional[str] = None
    is_main: bool
    color_tag: Optional[str] = None
    order: int

class ImageUpdateSchema(Schema):
    is_main: Optional[bool] = None
    order: Optional[int] = None

class ProductDetailResponseSchema(Schema):
    id: int
    name: str
    slug: str
    sku: Optional[str]
    product_type: str
    short_description: str
    description: str
    is_active: bool
    is_featured: bool
    listing_order: int
    base_price: Optional[Decimal]
    price: Optional[Decimal] = None
    brand: Optional[BrandSchema]
    categories: List[CategoryTreeSchema]
    variants: List[VariantResponseSchema]
    images: List[ImageResponseSchema]
    size_guide: Optional[Dict[str, Any]] = None
    care_instructions: Optional[str] = ""
    size_guide_template_id: Optional[int] = None
    care_instructions_template_id: Optional[int] = None
    youtube_video_url: Optional[str] = ""
    video_autoplay: bool
    video_mute: bool

class PaginatedProductsResponse(Schema):
    count: int
    results: List[ProductDetailResponseSchema]

# --- Admin API Endpoints ---

@router.get("/products", response=PaginatedProductsResponse)
def list_products(
    request, 
    search: Optional[str] = None, 
    category_id: Optional[int] = None, 
    category_slug: Optional[str] = None,
    brand_id: Optional[int] = None, 
    is_active: Optional[bool] = None,
    page: int = 1,
    limit: int = 10
):
    """List products with advanced filtering, debounced search, and pagination."""
    # Generate cache key based on query parameters
    from django.core.cache import cache
    
    cache_key = f"products_list_{search}_{category_id}_{category_slug}_{brand_id}_{is_active}_{page}_{limit}"
    cached_data = cache.get(cache_key)
    
    if cached_data:
        return cached_data
        
    qs = Product.objects.prefetch_related('variants', 'images', 'categories').select_related('brand', 'size_guide_template', 'care_instructions_template', 'category').all()
    
    # 1. Search filter (by name or variant SKU) with Fuzzy Match
    if search:
        exact_qs = qs.filter(
            Q(name__icontains=search) | 
            Q(sku__icontains=search) | 
            Q(variants__sku__icontains=search)
        )
        exact_match_ids = list(exact_qs.values_list('id', flat=True))
        
        # Fuzzy matches fallback using RediSearch (Sub-Millisecond Search)
        fuzzy_match_ids = []
        try:
            from apps.catalog.redis_models import ProductDocument
            # Use RediSearch full-text search capability
            search_results = ProductDocument.find(ProductDocument.name % search).all()
            fuzzy_match_ids = [res.product_id for res in search_results]
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"RediSearch not available or failed: {e}. Falling back to Django ORM exact search.")
            
        matched_ids = set(exact_match_ids + fuzzy_match_ids)
        qs = qs.filter(id__in=matched_ids).distinct()
        
    # 2. Combined filter (AND logic)
    if category_id:
        qs = qs.filter(categories__id=category_id)
    if category_slug:
        from apps.catalog.models import Category
        try:
            cat = Category.objects.get(slug__iexact=category_slug)
            child_ids = list(Category.objects.filter(parent=cat).values_list('id', flat=True))
            grandchild_ids = list(Category.objects.filter(parent__id__in=child_ids).values_list('id', flat=True))
            all_cat_ids = [cat.id] + child_ids + grandchild_ids
            qs = qs.filter(categories__id__in=all_cat_ids)
        except Category.DoesNotExist:
            qs = qs.none()
    if brand_id:
        qs = qs.filter(brand_id=brand_id)
    if is_active is not None:
        qs = qs.filter(is_active=is_active)
        
    # Hide products that belong to inactive categories
    qs = qs.exclude(categories__is_active=False).distinct()
        
    total_count = qs.count()
    
    # Pagination slicing
    start = (page - 1) * limit
    end = start + limit
    paginated_qs = qs.order_by('listing_order', '-created_at')[start:end]
    
    results = [get_product_details(product=p) for p in paginated_qs]
    
    response_data = {"count": total_count, "results": results}
    # Cache for 1 hour (3600 seconds)
    cache.set(cache_key, response_data, 3600)
    
    return response_data

def resolve_image_content(url_or_filename: str):
    """
    Attempts to read image bytes locally if the file is in the central media library (MediaAsset).
    Otherwise, downloads it via requests if it's a remote URL.
    Returns a tuple of (filename, file_content_bytes, asset_file) or (None, None, None).
    """
    import os
    import requests
    from apps.core.models import MediaAsset
    
    filename = os.path.basename(url_or_filename.split("?")[0])
    
    # Try by exact file_name matching
    asset = MediaAsset.objects.filter(file_name=filename).first()
    if asset and asset.file:
        return filename, None, asset.file
            
    # Try by containing file path
    if "/media/" in url_or_filename:
        rel_path = url_or_filename.split("/media/")[-1]
        asset = MediaAsset.objects.filter(file__icontains=rel_path).first()
        if asset and asset.file:
            return filename, None, asset.file

    # Fallback to HTTP download
    if url_or_filename.startswith("http"):
        try:
            resp = requests.get(url_or_filename, timeout=10)
            if resp.ok:
                return filename, resp.content, None
        except Exception:
            pass
            
    return None, None, None

@router.post("/products", response=ProductDetailResponseSchema, auth=BearerAuth())
def post_product_endpoint(request, data: ProductCreateInputSchema):
    """Create a new product with optional variants and brand relationships (Admin only)."""
    enforce_permission(request, "catalog", "edit_catalog")
    
    from django.utils.text import slugify
    slug = slugify(data.name)
    orig_slug = slug
    counter = 1
    while Product.objects.filter(slug=slug).exists():
        slug = f"{orig_slug}-{counter}"
        counter += 1
        
    try:
        print("INCOMING VARIANTS:", data.variants)
        with transaction.atomic():
            product = Product.objects.create(
                name=data.name,
                slug=slug,
                sku=data.sku or None,
                product_type=data.product_type,
                short_description=data.short_description,
                description=data.description,
                is_active=data.is_active,
                is_featured=data.is_featured,
                listing_order=data.listing_order,
                base_price=data.base_price,
                brand_id=data.brand_id,
                size_guide_template_id=data.size_guide_template_id,
                care_instructions_template_id=data.care_instructions_template_id,
                youtube_video_url=data.youtube_video_url,
                video_autoplay=data.video_autoplay,
                video_mute=data.video_mute
            )
            
            # Set categories ManyToMany
            product.categories.set(data.category_ids)
            if data.category_ids:
                product.category = Category.objects.get(id=data.category_ids[0])

            # Create variants and fetch optional image URLs
            for var in data.variants:
                v_obj = ProductVariant.objects.create(
                    product=product,
                    sku=var.sku,
                    purchase_price=var.purchase_price,
                    selling_price=var.selling_price,
                    is_active=var.is_active,
                    attributes=var.attributes,
                    image_id=var.image_id
                )

                if getattr(var, 'variant_image_url', None):
                    try:
                        from django.core.files.base import ContentFile
                        from apps.catalog.models import ProductImage
                        
                        orig_filename, content, asset_file = resolve_image_content(var.variant_image_url)
                        if asset_file or content:
                            original_filename_no_ext = os.path.splitext(orig_filename)[0]
                            existing_img = None
                            for pi in product.images.all():
                                pi_filename = os.path.basename(pi.image.name)
                                pi_filename_no_ext = os.path.splitext(pi_filename)[0]
                                if pi_filename_no_ext == original_filename_no_ext:
                                    existing_img = pi
                                    break
                            
                            if existing_img:
                                v_obj.image_id = existing_img.id
                                v_obj.save(update_fields=['image_id'])
                            else:
                                if asset_file:
                                    img_obj = ProductImage.objects.create(
                                        product=product,
                                        alt_text=f"Variant {var.sku}",
                                        is_main=False,
                                        order=99,
                                        image=asset_file
                                    )
                                else:
                                    if not orig_filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif')):
                                        orig_filename += ".jpg"
                                        
                                    img_obj = ProductImage.objects.create(
                                        product=product,
                                        alt_text=f"Variant {var.sku}",
                                        is_main=False,
                                        order=99
                                    )
                                    img_obj.image.save(orig_filename, ContentFile(content), save=True)
                                    
                                v_obj.image_id = img_obj.id
                                v_obj.save(update_fields=['image_id'])
                    except Exception:
                        pass
                
            # Handle base product image_urls download
            if getattr(data, 'image_urls', None):
                for idx, img_url in enumerate(data.image_urls):
                    if not img_url:
                        continue
                    try:
                        from django.core.files.base import ContentFile
                        from apps.catalog.models import ProductImage
                        
                        orig_filename, content, asset_file = resolve_image_content(img_url)
                        if asset_file or content:
                            original_filename_no_ext = os.path.splitext(orig_filename)[0]
                            existing_img = None
                            for pi in product.images.all():
                                pi_filename = os.path.basename(pi.image.name)
                                pi_filename_no_ext = os.path.splitext(pi_filename)[0]
                                if pi_filename_no_ext == original_filename_no_ext:
                                    existing_img = pi
                                    break
                            
                            if existing_img:
                                existing_img.is_main = (idx == 0)
                                existing_img.order = idx
                                existing_img.save(update_fields=['is_main', 'order'])
                                continue

                            if asset_file:
                                ProductImage.objects.create(
                                    product=product,
                                    alt_text=product.name,
                                    is_main=(idx == 0),
                                    order=idx,
                                    image=asset_file
                                )
                            else:
                                if not orig_filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif')):
                                    orig_filename += ".jpg"
                                
                                img_obj = ProductImage.objects.create(
                                    product=product,
                                    alt_text=product.name,
                                    is_main=(idx == 0),
                                    order=idx
                                )
                                img_obj.image.save(orig_filename, ContentFile(content), save=True)
                    except Exception:
                        pass

            # Perform product save at the end to run full validation with variants created
            product.save()
            
            from django.core.cache import cache
            if hasattr(cache, 'delete_pattern'):
                cache.delete_pattern("products_list_*")
            else:
                cache.clear()
                
            return get_product_details(product.slug)
    except ValidationError as ve:
        raise HttpError(400, ve.messages[0] if hasattr(ve, 'messages') else str(ve))
    except Exception as e:
        raise HttpError(400, str(e))

@router.put("/products/{slug}", response=ProductDetailResponseSchema, auth=BearerAuth())
def update_product_endpoint(request, slug: str, data: ProductCreateInputSchema):
    """Edit product details and variant options while preserving order histories (Admin only)."""
    enforce_permission(request, "catalog", "edit_catalog")
    if slug.isdigit():
        product = get_object_or_404(Product, id=int(slug))
    else:
        product = get_object_or_404(Product, slug=slug)
    
    try:
        with transaction.atomic():
            product.name = data.name
            product.sku = data.sku or product.sku
            product.product_type = data.product_type
            product.short_description = data.short_description
            product.description = data.description
            product.is_active = data.is_active
            product.is_featured = data.is_featured
            product.listing_order = data.listing_order
            product.base_price = data.base_price
            product.brand_id = data.brand_id
            product.size_guide_template_id = data.size_guide_template_id
            product.care_instructions_template_id = data.care_instructions_template_id
            product.youtube_video_url = data.youtube_video_url
            product.video_autoplay = data.video_autoplay
            product.video_mute = data.video_mute
            
            product.categories.set(data.category_ids)
            if data.category_ids:
                product.category = Category.objects.get(id=data.category_ids[0])
            
            # Synchronize variants
            incoming_variant_ids = []
            for var in data.variants:
                if var.id:
                    # Update existing variant
                    v_obj = get_object_or_404(ProductVariant, id=var.id, product=product)
                    v_obj.sku = var.sku
                    v_obj.purchase_price = var.purchase_price
                    v_obj.selling_price = var.selling_price
                    v_obj.is_active = var.is_active
                    v_obj.attributes = var.attributes
                    v_obj.image_id = var.image_id
                    v_obj.save()
                    incoming_variant_ids.append(v_obj.id)
                else:
                    # Create new variant
                    v_obj = ProductVariant.objects.create(
                        product=product,
                        sku=var.sku,
                        purchase_price=var.purchase_price,
                        selling_price=var.selling_price,
                        is_active=var.is_active,
                        attributes=var.attributes,
                        image_id=var.image_id
                    )
                    incoming_variant_ids.append(v_obj.id)

                if getattr(var, 'variant_image_url', None):
                    try:
                        from django.core.files.base import ContentFile
                        from apps.catalog.models import ProductImage
                        
                        filename = os.path.basename(var.variant_image_url.split("?")[0])
                        filename_no_ext = os.path.splitext(filename)[0]
                        
                        existing_img = None
                        for pi in product.images.all():
                            pi_filename = os.path.basename(pi.image.name)
                            pi_filename_no_ext = os.path.splitext(pi_filename)[0]
                            if pi_filename_no_ext == filename_no_ext:
                                existing_img = pi
                                break
                                
                        if existing_img:
                            v_obj.image_id = existing_img.id
                            v_obj.save(update_fields=['image_id'])
                        else:
                            orig_filename, content, asset_file = resolve_image_content(var.variant_image_url)
                            if asset_file or content:
                                if asset_file:
                                    img_obj = ProductImage.objects.create(
                                        product=product,
                                        alt_text=f"Variant {var.sku}",
                                        is_main=False,
                                        order=99,
                                        image=asset_file
                                    )
                                else:
                                    if not orig_filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif')):
                                        orig_filename += ".jpg"
                                        
                                    img_obj = ProductImage.objects.create(
                                        product=product,
                                        alt_text=f"Variant {var.sku}",
                                        is_main=False,
                                        order=99
                                    )
                                    img_obj.image.save(orig_filename, ContentFile(content), save=True)
                                    
                                v_obj.image_id = img_obj.id
                                v_obj.save(update_fields=['image_id'])
                    except Exception:
                        pass
                    
            # Strict clean: Hard delete any variants not in input as requested by user
            product.variants.exclude(id__in=incoming_variant_ids).delete()
            
            # Handle base product image_urls download & sync
            if getattr(data, 'image_urls', None) is not None:
                keep_image_ids = []
                for idx, img_url in enumerate(data.image_urls):
                    if not img_url:
                        continue
                    
                    filename = os.path.basename(img_url.split("?")[0])
                    filename_no_ext = os.path.splitext(filename)[0]
                    
                    existing_img = None
                    for pi in product.images.all():
                        pi_filename = os.path.basename(pi.image.name)
                        pi_filename_no_ext = os.path.splitext(pi_filename)[0]
                        if pi_filename_no_ext == filename_no_ext:
                            existing_img = pi
                            break
                            
                    if existing_img:
                        existing_img.is_main = (idx == 0)
                        existing_img.order = idx
                        existing_img.save(update_fields=['is_main', 'order'])
                        keep_image_ids.append(existing_img.id)
                        continue
                        
                    try:
                        from django.core.files.base import ContentFile
                        from apps.catalog.models import ProductImage
                        
                        orig_filename, content, asset_file = resolve_image_content(img_url)
                        if asset_file or content:
                            if asset_file:
                                img_obj = ProductImage.objects.create(
                                    product=product,
                                    alt_text=product.name,
                                    is_main=(idx == 0),
                                    order=idx,
                                    image=asset_file
                                )
                            else:
                                if not orig_filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif')):
                                    orig_filename += ".jpg"
                                
                                img_obj = ProductImage.objects.create(
                                    product=product,
                                    alt_text=product.name,
                                    is_main=(idx == 0),
                                    order=idx
                                )
                                img_obj.image.save(orig_filename, ContentFile(content), save=True)
                            
                            keep_image_ids.append(img_obj.id)
                    except Exception:
                        pass
                
                # Sync: Delete product images that are no longer in the list
                product.images.exclude(id__in=keep_image_ids).delete()

            # Save product at the end to trigger model clean check on active variants
            product.save()
            
            from django.core.cache import cache
            if hasattr(cache, 'delete_pattern'):
                cache.delete_pattern("products_list_*")
            else:
                cache.clear()
                
            return get_product_details(product.slug)
    except ValidationError as ve:
        raise HttpError(400, ve.messages[0] if hasattr(ve, 'messages') else str(ve))
    except Exception as e:
        raise HttpError(400, str(e))

@router.delete("/products/{slug}", auth=BearerAuth())
def delete_product_endpoint(request, slug: str):
    """Safely delete product checking order logs and cascading gallery storage files (Admin only)."""
    enforce_permission(request, "catalog", "edit_catalog")
    if slug.isdigit():
        product = get_object_or_404(Product, id=int(slug))
    else:
        product = get_object_or_404(Product, slug=slug)
    try:
        product.delete()
        
        from django.core.cache import cache
        if hasattr(cache, 'delete_pattern'):
            cache.delete_pattern("products_list_*")
        else:
            cache.clear()
            
        return {"success": True}
    except ValidationError as ve:
        raise HttpError(400, ve.messages[0] if hasattr(ve, 'messages') else str(ve))

@router.post("/products/{product_id}/duplicate", response=ProductDetailResponseSchema, auth=BearerAuth())
def duplicate_product_endpoint(request, product_id: int):
    """One-click duplicate product into draft Copy (Admin only)."""
    enforce_permission(request, "catalog", "edit_catalog")
    try:
        new_prod = duplicate_product(product_id)
        return get_product_details(new_prod.slug)
    except Exception as e:
        raise HttpError(400, str(e))

# CSV Import Endpoints

@router.post("/products/bulk-upload", auth=BearerAuth())
def bulk_upload_endpoint(request, file: UploadedFile = File(...)):
    """Import catalog catalog from CSV files with validation logs (Admin only)."""
    enforce_permission(request, "catalog", "edit_catalog")
    try:
        file_content = file.read().decode('utf-8')
        
        # Simple default column mapping
        column_mapping = {
            "name": "Product Name",
            "sku": "SKU",
            "product_type": "Product Type",
            "short_description": "Short Description",
            "description": "Description",
            "base_price": "Base Price",
            "category": "Category",
            "brand": "Brand",
            "variant_sku": "Variant SKU",
            "variant_price": "Variant Price",
            "variant_size": "Variant Size",
            "variant_color": "Variant Color"
        }
        
        report = import_products_from_csv(file_content, column_mapping)
        return report
    except Exception as e:
        raise HttpError(400, f"Spreadsheet import error: {str(e)}")

# Image Upload Gallery Endpoint

@router.post("/products/{product_id}/images", response=ImageResponseSchema, auth=BearerAuth())
def upload_product_image_endpoint(
    request, 
    product_id: int, 
    alt_text: Optional[str] = Form(None), 
    is_main: Optional[bool] = Form(False), 
    color_tag: Optional[str] = Form(None), 
    order: Optional[int] = Form(0),
    file: UploadedFile = File(...)
):
    """Upload product images converting automatically to optimized WebP (Admin only)."""
    enforce_permission(request, "catalog", "edit_catalog")
    product = get_object_or_404(Product, id=product_id)
    
    img = ProductImage.objects.create(
        product=product,
        image=file,
        alt_text=alt_text,
        is_main=is_main,
        color_tag=color_tag,
        order=order
    )
    url = img.image.url
    if url and not (url.startswith("http://") or url.startswith("https://")):
        base_url = os.environ.get('SITE_BASE_URL', 'http://localhost:8000')
        url = f"{base_url.rstrip('/')}{url}"
        
    from django.core.cache import cache
    if hasattr(cache, 'delete_pattern'):
        cache.delete_pattern("products_list_*")
        
    return {
        "id": img.id,
        "url": url,
        "alt_text": img.alt_text,
        "is_main": img.is_main,
        "color_tag": img.color_tag,
        "order": img.order
    }

@router.put("/products/{product_id}/images/{image_id}", response=ImageResponseSchema, auth=BearerAuth())
def update_product_image_endpoint(request, product_id: int, image_id: int, data: ImageUpdateSchema):
    """Update existing product image properties like order and is_main."""
    enforce_permission(request, "catalog", "edit_catalog")
    img = get_object_or_404(ProductImage, id=image_id, product_id=product_id)
    
    if data.is_main is not None:
        img.is_main = data.is_main
    if data.order is not None:
        img.order = data.order
        
    img.save(update_fields=['is_main', 'order'])
    
    url = img.image.url if getattr(img, 'image', None) and getattr(img.image, 'url', None) else ""
    if url and not (url.startswith("http://") or url.startswith("https://")):
        base_url = os.environ.get('SITE_BASE_URL', 'http://localhost:8000')
        url = f"{base_url.rstrip('/')}{url}"
        
    from django.core.cache import cache
    if hasattr(cache, 'delete_pattern'):
        cache.delete_pattern("products_list_*")
        
    return {
        "id": img.id,
        "url": url,
        "alt_text": img.alt_text,
        "is_main": img.is_main,
        "color_tag": img.color_tag,
        "order": img.order
    }

# Category tree endpoint
@router.get("/categories/tree", response=List[CategoryTreeSchema])
def view_category_tree(request, admin: bool = False):
    """Retrieve the cached category tree structure."""
    return get_cached_category_tree(include_inactive=admin)

# Attributes endpoints
@router.post("/attributes", response=ProductAttributeSchema, auth=BearerAuth())
def create_attribute(request, data: ProductAttributeCreateSchema):
    """Define a dynamic product attribute (Admin only)."""
    enforce_permission(request, "catalog", "edit_catalog")
    if ProductAttribute.objects.filter(code=data.code).exists():
        raise HttpError(400, f"Attribute with code '{data.code}' already exists.")
        
    attr = ProductAttribute.objects.create(
        name=data.name,
        code=data.code,
        type=data.type,
        choices=data.choices or [],
        listing_order=data.listing_order
    )
    return attr

@router.get("/attributes", response=List[ProductAttributeSchema])
def list_attributes(request):
    """List all custom attributes configurations."""
    return list(ProductAttribute.objects.all())

# Brands and Templates Helper Endpoints

@router.get("/brands", response=List[BrandSchema])
def list_brands(request):
    """List all active catalog brands."""
    return list(Brand.objects.all())

@router.post("/brands", response=BrandSchema, auth=BearerAuth())
def create_brand_endpoint(request, data: BrandInputSchema):
    """Create a new brand identifier (Admin only)."""
    enforce_permission(request, "catalog", "edit_catalog")
    brand, created = Brand.objects.get_or_create(name=data.name, defaults={"slug": data.slug, "listing_order": data.listing_order})
    if not created:
        brand.slug = data.slug
        brand.listing_order = data.listing_order
        brand.save()
    return brand

@router.get("/templates/size", response=List[SizeGuideTemplateSchema])
def list_size_templates(request):
    """List size guide content blocks templates."""
    return list(SizeGuideTemplate.objects.all())

@router.get("/templates/care", response=List[CareInstructionsTemplateSchema])
def list_care_templates(request):
    """List care instructions content blocks templates."""
    return list(CareInstructionsTemplate.objects.all())

# --- Additional CRUD Endpoints ---

class CategoryInputSchema(Schema):
    name: str
    slug: str
    parent_id: Optional[int] = None
    is_active: Optional[bool] = True
    listing_order: int = 0

@router.post("/categories", auth=BearerAuth())
def create_category(request, data: CategoryInputSchema):
    enforce_permission(request, "catalog", "edit_catalog")
    cat = Category.objects.create(
        name=data.name,
        slug=data.slug,
        parent_id=data.parent_id,
        is_active=data.is_active,
        listing_order=data.listing_order
    )
    return {"id": cat.id}

@router.put("/categories/{cat_id}", auth=BearerAuth())
def update_category(request, cat_id: int, data: CategoryInputSchema):
    enforce_permission(request, "catalog", "edit_catalog")
    cat = get_object_or_404(Category, id=cat_id)
    cat.name = data.name
    cat.slug = data.slug
    cat.parent_id = data.parent_id
    cat.is_active = data.is_active
    cat.listing_order = data.listing_order
    cat.save()
    return {"success": True}

@router.delete("/categories/{cat_id}", auth=BearerAuth())
def delete_category(request, cat_id: int):
    enforce_permission(request, "catalog", "edit_catalog")
    cat = get_object_or_404(Category, id=cat_id)
    cat.delete()
    return {"success": True}

@router.post("/categories/{cat_id}/image", auth=BearerAuth())
def upload_category_image(request, cat_id: int, file: UploadedFile = File(...)):
    enforce_permission(request, "catalog", "edit_catalog")
    cat = get_object_or_404(Category, id=cat_id)
    if cat.image:
        cat.image.delete(save=False)
    cat.image.save(file.name, file)
    from apps.catalog.services import cache
    cache.delete("category_tree")
    import os
    base_url = os.environ.get('SITE_BASE_URL', 'http://localhost:8000')
    url = cat.image.url
    if url and not (url.startswith("http://") or url.startswith("https://")):
        url = f"{base_url.rstrip('/')}{url}"
    
    return {"success": True, "url": url}


@router.put("/brands/{brand_id}", auth=BearerAuth())
def update_brand(request, brand_id: int, data: BrandInputSchema):
    enforce_permission(request, "catalog", "edit_catalog")
    brand = get_object_or_404(Brand, id=brand_id)
    brand.name = data.name
    brand.slug = data.slug
    brand.listing_order = data.listing_order
    brand.save()
    return {"success": True}

@router.delete("/brands/{brand_id}", auth=BearerAuth())
def delete_brand(request, brand_id: int):
    enforce_permission(request, "catalog", "edit_catalog")
    brand = get_object_or_404(Brand, id=brand_id)
    brand.delete()
    return {"success": True}

class SizeGuideInputSchema(Schema):
    name: str
    headers: List[str]
    rows: List[List[str]]

@router.post("/templates/size", auth=BearerAuth())
def create_size_template(request, data: SizeGuideInputSchema):
    enforce_permission(request, "catalog", "edit_catalog")
    tpl = SizeGuideTemplate.objects.create(name=data.name, headers=data.headers, rows=data.rows)
    return {"id": tpl.id}

@router.put("/templates/size/{tpl_id}", auth=BearerAuth())
def update_size_template(request, tpl_id: int, data: SizeGuideInputSchema):
    enforce_permission(request, "catalog", "edit_catalog")
    tpl = get_object_or_404(SizeGuideTemplate, id=tpl_id)
    tpl.name = data.name
    tpl.headers = data.headers
    tpl.rows = data.rows
    tpl.save()
    return {"success": True}

@router.delete("/templates/size/{tpl_id}", auth=BearerAuth())
def delete_size_template(request, tpl_id: int):
    enforce_permission(request, "catalog", "edit_catalog")
    tpl = get_object_or_404(SizeGuideTemplate, id=tpl_id)
    tpl.delete()
    return {"success": True}

class CareInputSchema(Schema):
    name: str
    instructions: str

@router.post("/templates/care", auth=BearerAuth())
def create_care_template(request, data: CareInputSchema):
    enforce_permission(request, "catalog", "edit_catalog")
    tpl = CareInstructionsTemplate.objects.create(name=data.name, instructions=data.instructions)
    return {"id": tpl.id}

@router.put("/templates/care/{tpl_id}", auth=BearerAuth())
def update_care_template(request, tpl_id: int, data: CareInputSchema):
    enforce_permission(request, "catalog", "edit_catalog")
    tpl = get_object_or_404(CareInstructionsTemplate, id=tpl_id)
    tpl.name = data.name
    tpl.instructions = data.instructions
    tpl.save()
    return {"success": True}

@router.delete("/templates/care/{tpl_id}", auth=BearerAuth())
def delete_care_template(request, tpl_id: int):
    enforce_permission(request, "catalog", "edit_catalog")
    tpl = get_object_or_404(CareInstructionsTemplate, id=tpl_id)
    tpl.delete()
    return {"success": True}

@router.put("/attributes/{attr_id}", auth=BearerAuth())
def update_attribute(request, attr_id: int, data: ProductAttributeCreateSchema):
    enforce_permission(request, "catalog", "edit_catalog")
    attr = get_object_or_404(ProductAttribute, id=attr_id)
    attr.name = data.name
    attr.code = data.code
    attr.type = data.type
    attr.choices = data.choices or []
    attr.listing_order = data.listing_order
    attr.save()
    return {"success": True}

@router.delete("/attributes/{attr_id}", auth=BearerAuth())
def delete_attribute(request, attr_id: int):
    enforce_permission(request, "catalog", "edit_catalog")
    attr = get_object_or_404(ProductAttribute, id=attr_id)
    attr.delete()
    return {"success": True}

# --- Review API Endpoints ---

class ReviewInputSchema(Schema):
    rating: int
    comment: str
    images: Optional[List[str]] = []

class ReviewResponseSchema(Schema):
    id: int
    product_id: int
    product_name: str
    product_slug: str
    username: str
    user_id: int
    customer_phone: Optional[str] = None
    rating: int
    comment: str
    images: List[str]
    is_approved: bool
    is_featured: bool
    listing_order: int
    created_at: str
    updated_at: str

class ReviewModerationSchema(Schema):
    is_approved: Optional[bool] = None
    is_featured: Optional[bool] = None
    listing_order: Optional[int] = None
    comment: Optional[str] = None
    rating: Optional[int] = None
    images: Optional[List[str]] = None

import os
from django.core.files.storage import default_storage

@router.post("/reviews/upload-photo", auth=BearerAuth())
def upload_review_photo(request, file: UploadedFile = File(...), product_id: Optional[int] = Form(None)):
    """Upload a photo for a review, optimizing to WebP format."""
    try:
        from apps.catalog.models import Product, slugify_name, get_product_folder_path
        import uuid
        
        prefix = "reviews"
        new_filename = None
        
        if product_id:
            try:
                product = Product.objects.get(id=product_id)
                prefix = get_product_folder_path(product, "product_reviews")
                base_name = slugify_name(product.name)
                # Random hex to prevent conflicts
                new_filename = f"{base_name}_review_{uuid.uuid4().hex[:6]}.webp"
            except Product.DoesNotExist:
                pass
                
        # Handle optimization and saving
        from apps.image_optimizer.services import optimize_and_save_image
        url = optimize_and_save_image(file, max_width=700, prefix=prefix, custom_filename=new_filename)
        return {"url": url}
    except Exception as e:
        import uuid
        ext = os.path.splitext(file.name)[1]
        
        if product_id and 'new_filename' in locals() and new_filename:
            # Fallback if optimization fails but we have a product
            filename = f"{prefix}/{new_filename.replace('.webp', ext)}"
        else:
            filename = f"reviews/{uuid.uuid4().hex}{ext}"
            
        path = default_storage.save(filename, file)
        url = default_storage.url(path)
        if url and not (url.startswith("http://") or url.startswith("https://")):
            base_url = os.environ.get('SITE_BASE_URL', 'http://localhost:8000')
            url = f"{base_url.rstrip('/')}{url}"
        return {"url": url}

@router.get("/products/{slug}/reviews", response=List[ReviewResponseSchema])
def get_product_reviews(request, slug: str):
    """Get approved reviews for a product."""
    if slug.isdigit():
        product = get_object_or_404(Product, id=int(slug))
    else:
        product = get_object_or_404(Product, slug=slug)
    
    reviews = product.reviews.filter(is_approved=True)
    res = []
    for r in reviews:
        res.append({
            "id": r.id,
            "product_id": r.product.id,
            "product_name": r.product.name,
            "product_slug": r.product.slug,
            "username": r.user.first_name or r.user.username,
            "user_id": r.user.id,
            "customer_phone": getattr(r.user, 'crm_profile', None) and r.user.crm_profile.phone or None,
            "rating": r.rating,
            "comment": r.comment,
            "images": r.images,
            "is_approved": r.is_approved,
            "is_featured": r.is_featured,
            "listing_order": r.listing_order,
            "created_at": r.created_at.isoformat(),
            "updated_at": r.updated_at.isoformat()
        })
    return res

@router.post("/products/{slug}/reviews", response=ReviewResponseSchema, auth=BearerAuth())
def create_or_update_review(request, slug: str, data: ReviewInputSchema):
    """Post or update a product review (One review per customer per product)."""
    if slug.isdigit():
        product = get_object_or_404(Product, id=int(slug))
    else:
        product = get_object_or_404(Product, slug=slug)
    user = request.auth
    existing_review = Review.objects.filter(product=product, user=user).first()
    if existing_review and existing_review.is_approved:
        raise HttpError(403, "Approved reviews cannot be edited.")
        
    review, created = Review.objects.update_or_create(
        product=product,
        user=user,
        defaults={
            "rating": data.rating,
            "comment": data.comment,
            "images": data.images,
            "is_approved": False # Reset approval on create/edit for moderation
        }
    )
    
    return {
        "id": review.id,
        "product_id": review.product.id,
        "product_name": review.product.name,
        "product_slug": review.product.slug,
        "username": review.user.first_name or review.user.username,
        "user_id": review.user.id,
        "customer_phone": getattr(review.user, 'crm_profile', None) and review.user.crm_profile.phone or None,
        "rating": review.rating,
        "comment": review.comment,
        "images": review.images,
        "is_approved": review.is_approved,
        "is_featured": review.is_featured,
        "listing_order": review.listing_order,
        "created_at": review.created_at.isoformat(),
        "updated_at": review.updated_at.isoformat()
    }

@router.get("/products/{slug}", response=ProductDetailResponseSchema)
def view_product_detail_endpoint(request, slug: str):
    """Get full product details including gallery and configurations."""
    try:
        return get_product_details(slug)
    except Exception as e:
        raise HttpError(404, str(e))

@router.get("/my-reviews", response=List[ReviewResponseSchema], auth=BearerAuth())
def get_my_reviews(request):
    """Get authenticated user's reviews."""
    user = request.auth
    reviews = Review.objects.filter(user=user)
    res = []
    for r in reviews:
        res.append({
            "id": r.id,
            "product_id": r.product.id,
            "product_name": r.product.name,
            "product_slug": r.product.slug,
            "username": r.user.first_name or r.user.username,
            "user_id": r.user.id,
            "customer_phone": getattr(r.user, 'crm_profile', None) and r.user.crm_profile.phone or None,
            "rating": r.rating,
            "comment": r.comment,
            "images": r.images,
            "is_approved": r.is_approved,
            "is_featured": r.is_featured,
            "listing_order": r.listing_order,
            "created_at": r.created_at.isoformat(),
            "updated_at": r.updated_at.isoformat()
        })
    return res

@router.delete("/my-reviews/{review_id}", auth=BearerAuth())
def delete_my_review(request, review_id: int):
    """Delete current user's review."""
    user = request.auth
    review = get_object_or_404(Review, id=review_id, user=user)
    if review.is_approved:
        raise HttpError(403, "Approved reviews cannot be deleted.")
    review.delete()
    return {"success": True}

@router.get("/reviews", response=List[ReviewResponseSchema])
def list_all_approved_reviews(
    request, 
    rating: Optional[int] = None, 
    min_rating: Optional[int] = None, 
    with_photos: Optional[bool] = None,
    is_featured: Optional[bool] = None
):
    """Publicly list all approved reviews with optional filters."""
    qs = Review.objects.filter(is_approved=True)
    if rating is not None:
        qs = qs.filter(rating=rating)
    if min_rating is not None:
        qs = qs.filter(rating__gte=min_rating)
    if is_featured is not None:
        qs = qs.filter(is_featured=is_featured)
    if with_photos:
        qs = qs.exclude(images=[])
        
    res = []
    for r in qs:
        res.append({
            "id": r.id,
            "product_id": r.product.id,
            "product_name": r.product.name,
            "product_slug": r.product.slug,
            "username": r.user.first_name or r.user.username,
            "user_id": r.user.id,
            "customer_phone": getattr(r.user, 'crm_profile', None) and r.user.crm_profile.phone or None,
            "rating": r.rating,
            "comment": r.comment,
            "images": r.images,
            "is_approved": r.is_approved,
            "is_featured": r.is_featured,
            "listing_order": r.listing_order,
            "created_at": r.created_at.isoformat(),
            "updated_at": r.updated_at.isoformat()
        })
    return res

# --- Admin Reviews Endpoints ---

@router.get("/admin/reviews", response=List[ReviewResponseSchema], auth=BearerAuth())
def admin_list_reviews(request, page: int = 1, limit: int = 50):
    """List all reviews for moderation (Admin only)."""
    enforce_permission(request, "catalog", "edit_catalog")
    
    start = (page - 1) * limit
    end = start + limit
    reviews = Review.objects.select_related('product', 'user').order_by('listing_order', '-created_at')[start:end]
    
    res = []
    for r in reviews:
        res.append({
            "id": r.id,
            "product_id": r.product.id,
            "product_name": r.product.name,
            "product_slug": r.product.slug,
            "username": r.user.first_name or r.user.username,
            "user_id": r.user.id,
            "customer_phone": getattr(r.user, 'crm_profile', None) and r.user.crm_profile.phone or None,
            "rating": r.rating,
            "comment": r.comment,
            "images": r.images,
            "is_approved": r.is_approved,
            "is_featured": r.is_featured,
            "listing_order": r.listing_order,
            "created_at": r.created_at.isoformat(),
            "updated_at": r.updated_at.isoformat()
        })
    return res

@router.get("/admin/reviews/analytics", auth=BearerAuth())
def admin_reviews_analytics(request):
    """Get analytics report on ratings and review volume (Admin only)."""
    enforce_permission(request, "catalog", "edit_catalog")
    from django.db.models import Avg, Count
    
    total_reviews = Review.objects.count()
    pending_reviews = Review.objects.filter(is_approved=False).count()
    approved_reviews = Review.objects.filter(is_approved=True).count()
    avg_rating = Review.objects.filter(is_approved=True).aggregate(Avg('rating'))['rating__avg'] or 0.0
    
    breakdown = {}
    for i in range(1, 6):
        breakdown[f"{i}_star"] = Review.objects.filter(rating=i).count()
        
    top_rated_qs = Review.objects.filter(is_approved=True).values('product__id', 'product__name', 'product__slug').annotate(
        avg_rating=Avg('rating'),
        review_count=Count('id')
    ).filter(review_count__gte=1).order_by('-avg_rating')[:5]
    
    top_products = []
    for tp in top_rated_qs:
        top_products.append({
            "id": tp['product__id'],
            "name": tp['product__name'],
            "slug": tp['product__slug'],
            "avg_rating": round(float(tp['avg_rating']), 1) if tp['avg_rating'] else 0.0,
            "review_count": tp['review_count']
        })
        
    return {
        "total_reviews": total_reviews,
        "pending_reviews": pending_reviews,
        "approved_reviews": approved_reviews,
        "avg_rating": round(float(avg_rating), 1),
        "rating_breakdown": breakdown,
        "top_products": top_products
    }

@router.post("/admin/reviews/{review_id}/moderate", response=ReviewResponseSchema, auth=BearerAuth())
def admin_moderate_review(request, review_id: int, data: ReviewModerationSchema):
    """Approve/unapprove, feature/unfeature, or edit review details (Admin only)."""
    enforce_permission(request, "catalog", "edit_catalog")
    review = get_object_or_404(Review, id=review_id)
    
    if data.is_approved is not None:
        review.is_approved = data.is_approved
    if data.is_featured is not None:
        review.is_featured = data.is_featured
    if data.listing_order is not None:
        review.listing_order = data.listing_order
    if data.comment is not None:
        review.comment = data.comment
    if data.rating is not None:
        review.rating = data.rating
    if data.images is not None:
        review.images = data.images
        
    review.save()
    return {
        "id": review.id,
        "product_id": review.product.id,
        "product_name": review.product.name,
        "product_slug": review.product.slug,
        "username": review.user.first_name or review.user.username,
        "user_id": review.user.id,
        "customer_phone": getattr(review.user, 'crm_profile', None) and review.user.crm_profile.phone or None,
        "rating": review.rating,
        "comment": review.comment,
        "images": review.images,
        "is_approved": review.is_approved,
        "is_featured": review.is_featured,
        "listing_order": review.listing_order,
        "created_at": review.created_at.isoformat(),
        "updated_at": review.updated_at.isoformat()
    }

@router.delete("/admin/reviews/{review_id}", auth=BearerAuth())
def admin_delete_review(request, review_id: int):
    """Delete any review (Admin only)."""
    enforce_permission(request, "catalog", "edit_catalog")
    review = get_object_or_404(Review, id=review_id)
    review.delete()
    return {"success": True}

class AdminReviewCreateSchema(Schema):
    customer_phone: str
    product_id: int
    rating: int
    comment: str
    listing_order: int = 0
    images: Optional[List[str]] = []

@router.post("/admin/reviews/create", response=ReviewResponseSchema, auth=BearerAuth())
def admin_create_review(request, data: AdminReviewCreateSchema):
    """Create a new review on behalf of a user (Admin only)."""
    enforce_permission(request, "catalog", "edit_catalog")
    
    from apps.crm.models import CustomerProfile
    
    profile = get_object_or_404(CustomerProfile, phone=data.customer_phone)
    user = profile.user
    product = get_object_or_404(Product, id=data.product_id)
    
    review = Review.objects.create(
        product=product,
        user=user,
        rating=data.rating,
        comment=data.comment,
        images=data.images,
        is_approved=True,  # Auto-approve admin created reviews
        listing_order=data.listing_order
    )
    
    return {
        "id": review.id,
        "product_id": review.product.id,
        "product_name": review.product.name,
        "product_slug": review.product.slug,
        "username": review.user.first_name or review.user.username,
        "user_id": review.user.id,
        "customer_phone": profile.phone,
        "rating": review.rating,
        "comment": review.comment,
        "images": review.images,
        "is_approved": review.is_approved,
        "is_featured": review.is_featured,
        "listing_order": review.listing_order,
        "created_at": review.created_at.isoformat(),
        "updated_at": review.updated_at.isoformat()
    }
