import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'poshplex.settings')
django.setup()

from django.db.models import Subquery, OuterRef, F, DecimalField, ExpressionWrapper, Sum
from apps.orders.models import OrderItem, Order
from apps.catalog.models import ProductVariant
from apps.core.models import SiteSetting

qs = Order.objects.all()

costing_sum = OrderItem.objects.filter(order__in=qs).annotate(
    unit_cost=Subquery(
        ProductVariant.objects.filter(sku=OuterRef('sku')).values('purchase_price')[:1]
    )
).aggregate(
    total_cost=Sum(
        ExpressionWrapper(F('quantity') * F('unit_cost'), output_field=DecimalField())
    )
)['total_cost'] or 0

print(f"Total Costing: {costing_sum}")

setting, created = SiteSetting.objects.get_or_create(
    key="reports_fixed_expense",
    defaults={"value": {"amount": 0}, "description": "Global fixed expense for profit calculation"}
)
print(f"Fixed Expense: {setting.value.get('amount', 0)}")
