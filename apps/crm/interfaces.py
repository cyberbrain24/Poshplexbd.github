from django.shortcuts import get_object_or_404
from apps.crm.models import CustomerProfile

def get_customer_contact_info(user_id: int) -> dict:
    """
    Public interface to get customer phone and address contact info.
    """
    profile = get_object_or_404(CustomerProfile, user_id=user_id)
    return {
        "user_id": profile.user_id,
        "username": profile.user.username,
        "email": profile.user.email,
        "phone": profile.phone,
        "address": profile.address
    }
