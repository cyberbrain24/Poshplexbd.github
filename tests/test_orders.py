from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model

from apps.crm.models import CustomerProfile
from apps.catalog.models import Category, Product, ProductVariant
from apps.finance.models import Account
from apps.orders.services import create_order, mark_order_as_paid, mark_order_as_shipped
from apps.finance.services import get_account_balance

User = get_user_model()

class OrdersWorkflowTestCase(TestCase):
    def setUp(self):
        # 1. Create standard ledger accounts needed by orders payment processing
        self.cash = Account.objects.create(name="Cash", code="1000-CASH", type="asset", pl_group="balance_sheet")
        self.revenue = Account.objects.create(name="Revenue", code="4000-REVENUE", type="revenue", pl_group="income_statement")

        # 2. Create customer user and profile
        self.user = User.objects.create_user(
            username="buyer_imran",
            email="buyer@gmail.com",
            password="customerpass123",
            role="customer"
        )
        self.profile = CustomerProfile.objects.create(
            user=self.user,
            phone="+8801700000000",
            address="Streetwear Rd, Dhaka, Bangladesh"
        )

        # 3. Create catalog product and variants
        self.category = Category.objects.create(name="Outerwear", slug="outerwear")
        self.product = Product.objects.create(name="Poshplex Coach Jacket", slug="coach-jacket", category=self.category)
        
        self.variant = ProductVariant.objects.create(
            product=self.product,
            sku="PP-JKT-BLK-M",
            price=120.00,
            attributes={}
        )

    def test_order_lifecycle(self):
        """Test placing an order, paying it, and booking delivery."""
        # --- 1. Create Order ---
        items_data = [{"sku": "PP-JKT-BLK-M", "quantity": 2}]
        order = create_order(
            user_id=self.user.id,
            items_data=items_data,
            shipping_address="Banani, Dhaka"
        )
        
        self.assertIsNotNone(order.id)
        self.assertEqual(order.status, "pending")
        self.assertEqual(order.total_amount, Decimal("240.00")) # 2 * 120.00
        self.assertEqual(order.items.count(), 1)
        self.assertEqual(order.items.first().sku, "PP-JKT-BLK-M")
        
        # --- 2. Pay Order ---
        order = mark_order_as_paid(order.id, payment_method="Cash")
        self.assertEqual(order.status, "paid")
        
        # Verify ledger balance is updated
        self.assertEqual(get_account_balance("1000-CASH"), Decimal("240.00"))
        self.assertEqual(get_account_balance("4000-REVENUE"), Decimal("240.00"))

        # --- 3. Ship Order ---
        order = mark_order_as_shipped(order.id)
        self.assertEqual(order.status, "shipped")
        self.assertTrue(order.tracking_number.startswith("MOCK-SHIP-"))
        self.assertIsNotNone(order.tracking_number)
