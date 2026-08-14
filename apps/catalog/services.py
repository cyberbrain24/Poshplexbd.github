from decimal import Decimal
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.db import transaction
from apps.catalog.models import Category, Product, ProductVariant, Brand, ProductImage, ProductAttribute

def get_cached_category_tree(include_inactive: bool = False) -> list:
    """
    Retrieves the compiled nested tree structure of product categories from cache, 
    or builds it from the database if missing.
    """
    cache_key = "category_tree_all" if include_inactive else "category_tree"
    tree = cache.get(cache_key)
    
    if tree is not None:
        return tree

    if include_inactive:
        all_categories = list(Category.objects.all())
    else:
        all_categories = list(Category.objects.filter(is_active=True))
    import os
    base_url = os.environ.get('SITE_BASE_URL', 'http://localhost:8000')
    
    def get_full_url(url):
        if url and not (url.startswith("http://") or url.startswith("https://")):
            return f"{base_url.rstrip('/')}{url}"
        return url

    category_map = {cat.id: {"id": cat.id, "name": cat.name, "slug": cat.slug, "parent_id": cat.parent_id, "is_active": cat.is_active, "listing_order": cat.listing_order, "image": get_full_url(cat.image.url) if cat.image else None, "children": []} for cat in all_categories}
    roots = []
    
    for cat in all_categories:
        cat_node = category_map[cat.id]
        if cat.parent_id:
            parent_node = category_map.get(cat.parent_id)
            if parent_node:
                parent_node["children"].append(cat_node)
        else:
            roots.append(cat_node)
            
    cache.set(cache_key, roots, timeout=3600)
    return roots

def create_product(name: str, slug: str, category_id: int, description: str = "") -> Product:
    """Create a new catalog product."""
    category = Category.objects.get(id=category_id)
    product = Product.objects.create(
        name=name,
        slug=slug,
        category=category,
        description=description
    )
    product.categories.add(category)
    return product

def create_product_variant(product_id: int, sku: str, price: float, attributes: dict) -> ProductVariant:
    """Create a new product variant, which triggers dynamic JSON attribute validation."""
    product = Product.objects.get(id=product_id)
    variant = ProductVariant(
        product=product,
        sku=sku,
        selling_price=Decimal(str(price)),
        attributes=attributes
    )
    variant.save()
    return variant

@transaction.atomic
def duplicate_product(product_id: int) -> Product:
    """
    Copies all product data (info, pricing, variants, attributes, category links) 
    into a new draft with ' (Copy)' appended to the name.
    Images and SKUs are regenerated to avoid conflicts.
    """
    import uuid
    
    orig = Product.objects.get(id=product_id)
    
    # 1. Clone product instance
    new_product = Product(
        name=f"{orig.name} (Copy)",
        product_type=orig.product_type,
        short_description=orig.short_description,
        description=orig.description,
        is_active=False, # Save as inactive draft initially
        is_featured=False,
        base_price=orig.base_price,
        brand=orig.brand,
        size_guide_template=orig.size_guide_template,
        care_instructions_template=orig.care_instructions_template,
        youtube_video_url=orig.youtube_video_url,
        video_autoplay=orig.video_autoplay,
        video_mute=orig.video_mute
    )
    
    # Generate unique slug
    new_slug = f"{orig.slug}-copy"
    counter = 1
    while Product.objects.filter(slug=new_slug).exists():
        new_slug = f"{orig.slug}-copy-{counter}"
        counter += 1
    new_product.slug = new_slug
    
    # Generate new unique SKU
    new_product.sku = f"PROD-{uuid.uuid4().hex[:8].upper()}"
    new_product.save()
    
    # Copy categories ManyToMany
    new_product.categories.set(orig.categories.all())
    new_product.category = orig.category
    new_product.save()
    
    # 2. Clone product images
    image_map = {}
    for img in orig.images.all():
        new_img = ProductImage.objects.create(
            product=new_product,
            image=img.image,
            alt_text=img.alt_text,
            is_main=img.is_main,
            color_tag=img.color_tag,
            order=img.order
        )
        image_map[img.id] = new_img
        
    # 3. Clone variants
    for variant in orig.variants.all():
        new_var_sku = f"VAR-{uuid.uuid4().hex[:8].upper()}"
        
        # Link new cloned image if it was mapped in original
        new_img = None
        if variant.image_id and variant.image_id in image_map:
            new_img = image_map[variant.image_id]
            
        ProductVariant.objects.create(
            product=new_product,
            sku=new_var_sku,
            purchase_price=variant.purchase_price,
            selling_price=variant.selling_price,
            is_active=variant.is_active,
            image=new_img,
            attributes=variant.attributes
        )
        
    return new_product

def import_products_from_csv(file_content: str, column_mapping: dict) -> dict:
    """
    Import products and variants from CSV with a column-mapping step.
    Supports creating both simple and variable products.
    """
    import csv
    from io import StringIO
    from django.utils.text import slugify
    import uuid
    
    f = StringIO(file_content)
    reader = csv.DictReader(f)
    
    # Clean mappings
    mappings = {k: v for k, v in column_mapping.items() if v}
    
    imported_count = 0
    errors = []
    
    def get_mapped_val(row, field_key, default=""):
        csv_col = mappings.get(field_key)
        if csv_col and csv_col in row:
            return row[csv_col].strip()
        return default

    for row_idx, row in enumerate(reader, start=1):
        try:
            with transaction.atomic():
                name = get_mapped_val(row, "name")
                if not name:
                    raise ValidationError("Product Name is required.")
                    
                sku = get_mapped_val(row, "sku")
                p_type = get_mapped_val(row, "product_type", "simple").lower()
                if p_type not in ("simple", "variable"):
                    p_type = "simple"
                    
                short_desc = get_mapped_val(row, "short_description")
                desc = get_mapped_val(row, "description")
                
                # Base Price
                base_price_str = get_mapped_val(row, "base_price")
                base_price = None
                if base_price_str:
                    try:
                        base_price = Decimal(base_price_str)
                    except Exception:
                        pass
                
                # Category
                cat_name = get_mapped_val(row, "category")
                category = None
                if cat_name:
                    cat_slug = slugify(cat_name)
                    category, _ = Category.objects.get_or_create(
                        name=cat_name,
                        defaults={"slug": cat_slug}
                    )
                
                # Brand
                brand_name = get_mapped_val(row, "brand")
                brand = None
                if brand_name:
                    brand_slug = slugify(brand_name)
                    brand, _ = Brand.objects.get_or_create(
                        name=brand_name,
                        defaults={"slug": brand_slug}
                    )
                
                # Create base product
                prod_slug = slugify(name)
                orig_slug = prod_slug
                counter = 1
                while Product.objects.filter(slug=prod_slug).exists():
                    prod_slug = f"{orig_slug}-{counter}"
                    counter += 1
                
                product = Product.objects.create(
                    name=name,
                    slug=prod_slug,
                    sku=sku or None,
                    product_type=p_type,
                    short_description=short_desc,
                    description=desc,
                    base_price=base_price,
                    category=category,
                    brand=brand
                )
                if category:
                    product.categories.add(category)
                    
                # Create a default variant for simple products, or if variant info is provided
                var_sku = get_mapped_val(row, "variant_sku")
                var_price_str = get_mapped_val(row, "variant_price") or base_price_str
                
                if p_type == "simple":
                    var_price = Decimal(var_price_str) if var_price_str else Decimal("0.00")
                    ProductVariant.objects.create(
                        product=product,
                        sku=var_sku or f"VAR-{uuid.uuid4().hex[:8].upper()}",
                        selling_price=var_price,
                        is_active=True
                    )
                else:
                    if var_sku or var_price_str:
                        var_price = Decimal(var_price_str) if var_price_str else Decimal("0.00")
                        size = get_mapped_val(row, "variant_size")
                        color = get_mapped_val(row, "variant_color")
                        attrs = {}
                        if size:
                            attrs["size"] = size
                        if color:
                            attrs["color"] = color
                            
                        # Dynamic creation of ProductAttribute configurations
                        for k, v in attrs.items():
                            attr_def, _ = ProductAttribute.objects.get_or_create(
                                code=k,
                                defaults={"name": k.capitalize(), "type": "select", "choices": []}
                            )
                            if v not in attr_def.choices:
                                attr_def.choices.append(v)
                                attr_def.save()
                            
                        ProductVariant.objects.create(
                            product=product,
                            sku=var_sku or f"VAR-{uuid.uuid4().hex[:8].upper()}",
                            selling_price=var_price,
                            attributes=attrs,
                            is_active=True
                        )
                
                imported_count += 1
        except Exception as e:
            errors.append({"row": row_idx, "reason": str(e)})
            
    return {
        "success": len(errors) == 0,
        "imported_count": imported_count,
        "errors": errors
    }
