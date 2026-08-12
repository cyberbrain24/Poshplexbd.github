from apps.marketing.models import Coupon

def validate_coupon_code(code: str) -> dict:
    """Public interface to validate coupon codes without exposing raw Coupon models."""
    try:
        coupon = Coupon.objects.get(code=code, active=True)
        return {"valid": True, "discount_percent": coupon.discount_percent}
    except Coupon.DoesNotExist:
        return {"valid": False, "discount_percent": 0}
