from typing import List, Optional, Tuple, Any
from decimal import Decimal
from django.utils import timezone
from apps.marketing.models import PromoCode, PromoUsageHistory
from apps.catalog.interfaces import get_variant_details_by_sku
from apps.catalog.models import Category

def get_category_descendant_ids(category_ids: List[int]) -> set:
    """
    Given a list of category IDs, returns a set containing those category IDs
    plus all descendant (child/sub-child) category IDs.
    """
    if not category_ids:
        return set()
    
    result_ids = set(category_ids)
    current_ids = set(category_ids)
    
    while current_ids:
        children_ids = set(
            Category.objects.filter(parent_id__in=current_ids).values_list('id', flat=True)
        )
        new_ids = children_ids - result_ids
        if not new_ids:
            break
        result_ids.update(new_ids)
        current_ids = new_ids
        
    return result_ids

def evaluate_promo_code_for_items(
    promo: PromoCode,
    items: List[dict],
    subtotal: Decimal,
    customer_phone: str = "",
    shipping_cost: Decimal = Decimal('0.00')
) -> Tuple[bool, Decimal, Optional[str]]:
    """
    Evaluates whether a promo code is applicable to the provided items/subtotal.
    Returns:
        (is_valid: bool, discount_amount: Decimal, error_message: Optional[str])
    
    Item dictionary can have:
      - sku: str
      - quantity: int
      - price: Decimal or number
      - product_id: Optional[int]
    """
    if not promo.is_active:
        return False, Decimal('0.00'), "Promo code is currently paused/inactive."

    now = timezone.now()
    if promo.starts_at and now < promo.starts_at:
        return False, Decimal('0.00'), "Promo code campaign has not started yet."
    if promo.expires_at and now > promo.expires_at:
        return False, Decimal('0.00'), "Promo code has expired."

    if subtotal < promo.min_order_amount:
        return False, Decimal('0.00'), f"Minimum subtotal of ৳{round(promo.min_order_amount)} required."

    if promo.total_usage_limit is not None and promo.usage_count >= promo.total_usage_limit:
        return False, Decimal('0.00'), "Promo code total limit has been fully redeemed."

    if customer_phone:
        phone_clean = customer_phone.strip()
        usage_count = PromoUsageHistory.objects.filter(promo_code=promo, customer_phone=phone_clean).count()
        if usage_count >= promo.per_customer_limit:
            return False, Decimal('0.00'), "You have reached the redemption limit for this promo code."

    # Free shipping promo
    if promo.reward_type == 'freeship':
        return True, shipping_cost, None

    # Membership tier grant
    if promo.reward_type == 'membership':
        return True, Decimal('0.00'), None

    # Check category & product targeting restrictions
    if not promo.pk:
        applicable_cat_ids = []
        included_prod_ids = set()
        excluded_prod_ids = set()
    else:
        applicable_cat_ids = list(promo.applicable_categories.values_list('id', flat=True))
        included_prod_ids = set(promo.included_products.values_list('id', flat=True))
        excluded_prod_ids = set(promo.excluded_products.values_list('id', flat=True))

    has_category_rule = len(applicable_cat_ids) > 0
    has_include_rule = len(included_prod_ids) > 0
    has_exclude_rule = len(excluded_prod_ids) > 0

    # Expand applicable categories to include all children/subcategories
    allowed_category_ids = get_category_descendant_ids(applicable_cat_ids) if has_category_rule else set()

    # If items list is empty, fallback to basic cart validation
    if not items:
        # If there are specific product/category restrictions but no items passed, we cannot verify eligibility
        if has_category_rule or has_include_rule or has_exclude_rule:
            return False, Decimal('0.00'), "Item details required to validate this targeted promo code."
        
        # Unrestricted promo code
        if promo.reward_type == 'percent':
            discount = subtotal * (promo.discount_value / Decimal('100.00'))
            if promo.max_discount_amount and discount > promo.max_discount_amount:
                discount = promo.max_discount_amount
            return True, round(discount, 2), None
        elif promo.reward_type == 'fixed':
            discount = min(promo.discount_value, subtotal)
            return True, round(discount, 2), None

    # Calculate eligible subtotal by checking each item
    eligible_subtotal = Decimal('0.00')
    found_any_matching = False

    for item in items:
        sku = item.get("sku")
        qty = int(item.get("quantity") or 1)
        
        # Resolve item price
        item_price = Decimal(str(item.get("price") or 0))
        
        # Get product and category info
        product_id = item.get("product_id")
        category_ids = set(item.get("category_ids") or [])
        
        if not product_id or not category_ids:
            catalog_info = get_variant_details_by_sku(sku)
            if catalog_info:
                if not product_id:
                    product_id = catalog_info.get("product_id")
                if not category_ids:
                    category_ids = set(catalog_info.get("category_ids") or [])
                if item_price <= Decimal('0.00'):
                    item_price = Decimal(str(catalog_info.get("price") or 0))

        # Check exclusion rule first (Strict Exclusion)
        if has_exclude_rule and product_id and product_id in excluded_prod_ids:
            continue

        # Check inclusion rule
        item_is_eligible = True
        if has_include_rule and (not product_id or product_id not in included_prod_ids):
            item_is_eligible = False

        # Check category rule
        if has_category_rule:
            if not category_ids or not (category_ids & allowed_category_ids):
                item_is_eligible = False

        # If eligible, add to eligible_subtotal
        if item_is_eligible:
            found_any_matching = True
            eligible_subtotal += (item_price * qty)

    if (has_category_rule or has_include_rule or has_exclude_rule) and not found_any_matching:
        return False, Decimal('0.00'), "This promo code is not applicable to the items in your cart."

    if eligible_subtotal <= Decimal('0.00'):
        return False, Decimal('0.00'), "This promo code is not applicable to the items in your cart."

    # Compute discount on eligible subtotal
    if promo.reward_type == 'percent':
        discount = eligible_subtotal * (promo.discount_value / Decimal('100.00'))
        if promo.max_discount_amount and discount > promo.max_discount_amount:
            discount = promo.max_discount_amount
        return True, round(discount, 2), None
    elif promo.reward_type == 'fixed':
        discount = min(promo.discount_value, eligible_subtotal)
        return True, round(discount, 2), None

    return True, Decimal('0.00'), None
