from django.test import TestCase
from django.core.exceptions import ValidationError
from django.core.cache import cache
from apps.catalog.models import Category, ProductAttribute, Product, ProductVariant
from apps.catalog.services import get_cached_category_tree

class CatalogTestCase(TestCase):
    def setUp(self):
        cache.clear()
        
        # Setup category
        self.category = Category.objects.create(name="T-Shirts", slug="t-shirts")
        
        # Setup dynamic product attributes definitions
        self.attr_color = ProductAttribute.objects.create(
            name="Color",
            code="color",
            type="select",
            choices=["Black", "White", "Acid-Wash Grey"]
        )
        self.attr_weight = ProductAttribute.objects.create(
            name="Fabric Weight (GSM)",
            code="gsm",
            type="number"
        )
        self.attr_oversized = ProductAttribute.objects.create(
            name="Oversized Fit",
            code="oversized",
            type="boolean"
        )

        # Setup base product
        self.product = Product.objects.create(
            name="Poshplex Boxy Tee",
            slug="boxy-tee",
            category=self.category,
            description="Premium heavyweight boxy cut streetwear tee."
        )

    def test_valid_variant_succeeds(self):
        """Test that a variant containing valid attributes succeeds."""
        variant = ProductVariant.objects.create(
            product=self.product,
            sku="PP-TEE-BLK-L",
            price=45.00,
            attributes={
                "color": "Black",
                "gsm": 240,
                "oversized": True
            }
        )
        self.assertIsNotNone(variant.id)
        self.assertEqual(variant.attributes["color"], "Black")
        self.assertEqual(variant.attributes["gsm"], 240)

    def test_invalid_attribute_code_fails(self):
        """Test that adding an undefined attribute key raises validation error."""
        with self.assertRaises(ValidationError) as context:
            ProductVariant.objects.create(
                product=self.product,
                sku="PP-TEE-ERR-1",
                price=40.00,
                attributes={"brand": "Nike"}  # 'brand' attribute is not configured in the db
            )
        self.assertIn("is not defined in the catalog metadata", str(context.exception))

    def test_invalid_select_choice_fails(self):
        """Test that select values must match the configured attribute choices."""
        with self.assertRaises(ValidationError) as context:
            ProductVariant.objects.create(
                product=self.product,
                sku="PP-TEE-ERR-2",
                price=40.00,
                attributes={"color": "Red"}  # 'Red' is not in ['Black', 'White', 'Acid-Wash Grey']
            )
        self.assertIn("is not a valid choice", str(context.exception))

    def test_invalid_number_type_fails(self):
        """Test that values for numeric attributes are validated to be numeric."""
        with self.assertRaises(ValidationError) as context:
            ProductVariant.objects.create(
                product=self.product,
                sku="PP-TEE-ERR-3",
                price=40.00,
                attributes={"gsm": "Heavyweight"}  # expects an integer/float
            )
        self.assertIn("expects a numeric value", str(context.exception))

    def test_category_tree_caching(self):
        """Test that category tree fetches are cached and invalidated on updates."""
        # Initial read compiles and caches
        tree = get_cached_category_tree()
        self.assertEqual(len(tree), 1)
        self.assertEqual(tree[0]["name"], "T-Shirts")
        
        # Verify it exists in cache
        cached_tree = cache.get("category_tree")
        self.assertIsNotNone(cached_tree)
        
        # Create a new category - should invalidate the cache
        Category.objects.create(name="Outerwear", slug="outerwear")
        
        # Cache must be empty now
        self.assertIsNone(cache.get("category_tree"))
        
        # Fetching tree compiles again and includes the new category
        new_tree = get_cached_category_tree()
        self.assertEqual(len(new_tree), 2)
        self.assertIsNotNone(cache.get("category_tree"))
