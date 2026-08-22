from typing import List, Optional, Any
from decimal import Decimal
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError
from django.utils import timezone

from ninja import Router, Schema
from ninja.errors import HttpError
from apps.marketing.models import PromoCode, PromoUsageHistory
from apps.core.api import BearerAuth, enforce_permission

router = Router()

# --- Schemas ---

class PromoCodeInputSchema(Schema):
    code: str
    description: Optional[str] = ""
    reward_type: str
    discount_value: Decimal
    membership_tier: Optional[str] = ""
    max_discount_amount: Optional[Decimal] = None
    min_order_amount: Optional[Decimal] = Decimal('0.00')
    total_usage_limit: Optional[int] = None
    per_customer_limit: Optional[int] = 1
    starts_at: Optional[str] = None
    expires_at: Optional[str] = None
    is_active: Optional[bool] = True
    banner_url: Optional[str] = ""
    banner_active: Optional[bool] = False

class PromoCodeResponseSchema(Schema):
    id: int
    code: str
    description: Optional[str] = None
    reward_type: str
    discount_value: Decimal
    membership_tier: Optional[str] = None
    max_discount_amount: Optional[Decimal] = None
    min_order_amount: Decimal
    total_usage_limit: Optional[int] = None
    per_customer_limit: int
    usage_count: int
    starts_at: Optional[Any] = None
    expires_at: Optional[Any] = None
    is_active: bool
    banner_url: Optional[str] = None
    banner_active: bool

class ValidateCouponResponseSchema(Schema):
    valid: bool
    reward_type: Optional[str] = None
    discount_value: Optional[Decimal] = None
    max_discount_amount: Optional[Decimal] = None
    membership_tier: Optional[str] = None
    error_message: Optional[str] = None

# --- Endpoints ---

@router.get("/validate", response=ValidateCouponResponseSchema)
def validate_coupon_endpoint(request, code: str, subtotal: Decimal, phone: str = ""):
    """Public checkout endpoint to validate campaign coupon codes against usage limits and validity dates."""
    code_clean = code.upper().strip()
    promo = PromoCode.objects.filter(code=code_clean).first()
    
    if not promo:
        return {"valid": False, "error_message": "Coupon code not found."}
        
    if not promo.is_active:
        return {"valid": False, "error_message": "Coupon is currently paused/inactive."}
        
    now = timezone.now()
    if promo.starts_at and now < promo.starts_at:
        return {"valid": False, "error_message": "Coupon campaign has not started yet."}
        
    if promo.expires_at and now > promo.expires_at:
        return {"valid": False, "error_message": "Coupon code has expired."}
        
    if subtotal < promo.min_order_amount:
        return {"valid": False, "error_message": f"Minimum subtotal of ৳{round(promo.min_order_amount)} required."}
        
    if promo.total_usage_limit is not None and promo.usage_count >= promo.total_usage_limit:
        return {"valid": False, "error_message": "Coupon total limit has been fully redeemed."}
        
    if phone:
        # Enforce per-customer limits by tracking customer phone number
        phone_clean = phone.strip()
        usage_count = PromoUsageHistory.objects.filter(promo_code=promo, customer_phone=phone_clean).count()
        if usage_count >= promo.per_customer_limit:
            return {"valid": False, "error_message": "You have reached the redemption limit for this coupon."}
            
    return {
        "valid": True,
        "reward_type": promo.reward_type,
        "discount_value": promo.discount_value,
        "max_discount_amount": promo.max_discount_amount,
        "membership_tier": promo.membership_tier
    }

# Admin CRUD Routes

@router.get("/promos", response=List[PromoCodeResponseSchema], auth=BearerAuth())
def list_promos(request):
    """List all promo codes (Admin only)."""
    enforce_permission(request, "marketing", "manage_campaigns")
    return PromoCode.objects.all().order_by('-id')

@router.post("/promos", response=PromoCodeResponseSchema, auth=BearerAuth())
def create_promo(request, data: PromoCodeInputSchema):
    """Create a new discount promo campaign code (Admin only)."""
    enforce_permission(request, "marketing", "manage_campaigns")
    try:
        starts = timezone.datetime.fromisoformat(data.starts_at) if data.starts_at else None
        expires = timezone.datetime.fromisoformat(data.expires_at) if data.expires_at else None
        
        p = PromoCode.objects.create(
            code=data.code,
            description=data.description,
            reward_type=data.reward_type,
            discount_value=data.discount_value,
            membership_tier=data.membership_tier,
            max_discount_amount=data.max_discount_amount,
            min_order_amount=data.min_order_amount,
            total_usage_limit=data.total_usage_limit,
            per_customer_limit=data.per_customer_limit,
            starts_at=starts,
            expires_at=expires,
            is_active=data.is_active,
            banner_url=data.banner_url,
            banner_active=data.banner_active
        )
        return p
    except Exception as e:
        raise HttpError(400, str(e))

@router.put("/promos/{promo_id}", response=PromoCodeResponseSchema, auth=BearerAuth())
def update_promo(request, promo_id: int, data: PromoCodeInputSchema):
    """Update details of a campaign code (Admin only)."""
    enforce_permission(request, "marketing", "manage_campaigns")
    p = get_object_or_404(PromoCode, id=promo_id)
    try:
        starts = timezone.datetime.fromisoformat(data.starts_at) if data.starts_at else None
        expires = timezone.datetime.fromisoformat(data.expires_at) if data.expires_at else None
        
        p.code = data.code
        p.description = data.description
        p.reward_type = data.reward_type
        p.discount_value = data.discount_value
        p.membership_tier = data.membership_tier
        p.max_discount_amount = data.max_discount_amount
        p.min_order_amount = data.min_order_amount
        p.total_usage_limit = data.total_usage_limit
        p.per_customer_limit = data.per_customer_limit
        p.starts_at = starts
        p.expires_at = expires
        p.is_active = data.is_active
        p.banner_url = data.banner_url
        p.banner_active = data.banner_active
        p.save()
        return p
    except Exception as e:
        raise HttpError(400, str(e))

@router.delete("/promos/{promo_id}", auth=BearerAuth())
def delete_promo(request, promo_id: int):
    """Delete a promo code. Throws validation errors if linked to past order usage logs (Admin only)."""
    enforce_permission(request, "marketing", "manage_campaigns")
    p = get_object_or_404(PromoCode, id=promo_id)
    try:
        p.delete()
        return {"success": True}
    except ValidationError as ve:
        raise HttpError(400, str(ve))
    except Exception as e:
        raise HttpError(400, str(e))

class PromoValidateRequestSchema(Schema):
    code: str
    order_amount: Decimal
    customer_phone: Optional[str] = ""

class PromoValidateResponseSchema(Schema):
    valid: bool
    discount_amount: Decimal
    reward_type: Optional[str] = None
    message: Optional[str] = None

@router.post("/promocodes/validate", response=PromoValidateResponseSchema, auth=BearerAuth())
def validate_promo_endpoint(request, data: PromoValidateRequestSchema):
    """Validate a promo code and calculate discount amount."""
    try:
        promo = PromoCode.objects.get(code=data.code.upper().strip(), is_active=True)
    except PromoCode.DoesNotExist:
        return {"valid": False, "discount_amount": Decimal('0.00'), "message": "Invalid or expired promo code."}

    now = timezone.now()
    if promo.starts_at and now < promo.starts_at:
        return {"valid": False, "discount_amount": Decimal('0.00'), "message": "Promo code is not active yet."}
    if promo.expires_at and now > promo.expires_at:
        return {"valid": False, "discount_amount": Decimal('0.00'), "message": "Promo code has expired."}
    
    if data.order_amount < promo.min_order_amount:
        return {"valid": False, "discount_amount": Decimal('0.00'), "message": f"Minimum order amount is ৳{promo.min_order_amount}."}

    if promo.total_usage_limit and promo.usage_count >= promo.total_usage_limit:
        return {"valid": False, "discount_amount": Decimal('0.00'), "message": "Promo code usage limit reached."}
        
    if data.customer_phone:
        usage_count = PromoUsageHistory.objects.filter(promo_code=promo, customer_phone=data.customer_phone.strip()).count()
        if usage_count >= promo.per_customer_limit:
            return {"valid": False, "discount_amount": Decimal('0.00'), "message": "Customer has reached the redemption limit for this coupon."}

    discount = Decimal('0.00')
    if promo.reward_type == 'fixed':
        discount = promo.discount_value
    elif promo.reward_type == 'percent':
        discount = data.order_amount * (promo.discount_value / Decimal('100.00'))
    elif promo.reward_type == 'freeship':
        # Assuming we just pass valid flag back and front end handles free ship
        discount = Decimal('0.00')
    
    if promo.max_discount_amount and discount > promo.max_discount_amount:
        discount = promo.max_discount_amount

    return {
        "valid": True,
        "discount_amount": discount,
        "reward_type": promo.reward_type,
        "message": "Valid code"
    }
