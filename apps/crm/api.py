from typing import List, Optional, Any
from decimal import Decimal
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q, Sum, Avg, Count
from django.utils import timezone
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.crm.models import CustomerProfile, MembershipTier, CRMNote
# Removed cross-module imports
# from apps.orders.models import Order, District, Thana
# from apps.core.models import AuditLog
from apps.core.api import BearerAuth, enforce_permission

router = Router()
User = get_user_model()

# --- Schemas ---

class MembershipTierInputSchema(Schema):
    name: str
    description: Optional[str] = ""
    is_active: Optional[bool] = True
    show_on_public: Optional[bool] = True
    show_member_since: Optional[bool] = True

class MembershipTierResponseSchema(Schema):
    id: int
    name: str
    description: Optional[str] = None
    is_active: bool
    show_on_public: bool
    show_member_since: bool

class CustomerCreateInputSchema(Schema):
    name: str
    username: Optional[str] = ""
    phone: str
    email: Optional[str] = ""
    gender: Optional[str] = "unspecified"
    birthdate: Optional[str] = None # format YYYY-MM-DD
    district_id: Optional[int] = None
    thana_id: Optional[int] = None
    address: Optional[str] = ""
    membership_tier_id: Optional[int] = None
    internal_notes: Optional[str] = ""
    is_active: Optional[bool] = True

class CRMNoteInputSchema(Schema):
    note: str

class CRMNoteResponseSchema(Schema):
    id: int
    author_username: str
    note: str
    created_at: Any

class CustomerResponseSchema(Schema):
    id: int
    username: str
    user_username: str
    phone: str
    email: Optional[str] = None
    gender: str
    birthdate: Optional[Any] = None
    profile_image: Optional[str] = None
    district_id: Optional[int] = None
    district_name: Optional[str] = None
    thana_id: Optional[int] = None
    thana_name: Optional[str] = None
    address: Optional[str] = None
    membership_tier_id: Optional[int] = None
    membership_tier_name: Optional[str] = None
    internal_notes: Optional[str] = None
    is_active: bool
    total_orders: int
    lifetime_spend: Decimal
    created_at: Any

class CustomerDetailResponseSchema(Schema):
    profile: CustomerResponseSchema
    kpis: dict
    risk_profile: dict
    notes: List[CRMNoteResponseSchema]
    orders: List[dict]

# --- Endpoints ---

# Membership Tiers CRUD

@router.get("/tiers", response=List[MembershipTierResponseSchema])
def list_tiers(request):
    """List all membership tiers."""
    return list(MembershipTier.objects.all())

@router.post("/tiers", response=MembershipTierResponseSchema, auth=BearerAuth())
def create_tier(request, data: MembershipTierInputSchema):
    """Create a new membership tier (Admin only)."""
    enforce_permission(request, "crm", "edit_customers")
    try:
        tier = MembershipTier.objects.create(**data.dict())
        return tier
    except Exception as e:
        raise HttpError(400, str(e))

@router.put("/tiers/{tier_id}", response=MembershipTierResponseSchema, auth=BearerAuth())
def update_tier(request, tier_id: int, data: MembershipTierInputSchema):
    """Update details of a membership tier (Admin only)."""
    enforce_permission(request, "crm", "edit_customers")
    tier = get_object_or_404(MembershipTier, id=tier_id)
    try:
        for k, v in data.dict().items():
            setattr(tier, k, v)
        tier.save()
        return tier
    except Exception as e:
        raise HttpError(400, str(e))

@router.delete("/tiers/{tier_id}", auth=BearerAuth())
def delete_tier(request, tier_id: int):
    """Delete a membership tier (Admin only)."""
    enforce_permission(request, "crm", "edit_customers")
    tier = get_object_or_404(MembershipTier, id=tier_id)
    try:
        tier.delete()
        return {"success": True}
    except Exception as e:
        from django.db.models import ProtectedError
        if isinstance(e, ProtectedError):
            raise HttpError(400, "Cannot delete this tier because there are customers assigned to it.")
        raise HttpError(400, str(e))


# Customers Main Directory CRUD

def compile_customer_response(profile: CustomerProfile) -> dict:
    from django.apps import apps
    Order = apps.get_model('orders', 'Order')
    orders_qs = Order.objects.filter(user=profile.user)
    total_orders = orders_qs.count()
    
    # Standard USD to BDT pricing values conversion
    spend_val = orders_qs.filter(payment_status='paid').aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
    
    return {
        "id": profile.id,
        "username": profile.user.first_name or profile.user.username,
        "user_username": profile.user.username,
        "phone": profile.phone,
        "email": profile.email or profile.user.email,
        "gender": profile.gender,
        "birthdate": profile.birthdate,
        "profile_image": profile.profile_image,
        "district_id": profile.district_id,
        "district_name": profile.district.name if profile.district else None,
        "thana_id": profile.thana_id,
        "thana_name": profile.thana.name if profile.thana else None,
        "address": profile.address,
        "membership_tier_id": profile.membership_tier_id,
        "membership_tier_name": profile.membership_tier.name if profile.membership_tier else None,
        "internal_notes": profile.internal_notes,
        "is_active": profile.is_active,
        "total_orders": total_orders,
        "lifetime_spend": spend_val,
        "created_at": profile.created_at
    }

@router.get("/customers/me", response=CustomerResponseSchema, auth=BearerAuth())
def get_my_customer_profile(request):
    """Retrieve full CRM profile for the logged in storefront customer."""
    profile = CustomerProfile.objects.filter(user=request.auth).first()
    if not profile:
        raise HttpError(404, "Customer profile not found.")
    return compile_customer_response(profile)


class AddressUpdateInputSchema(Schema):
    address: str
    district_id: int
    thana_id: int


@router.put("/customers/me/address", response=CustomerResponseSchema, auth=BearerAuth())
def update_my_customer_address(request, data: AddressUpdateInputSchema):
    """Update shipping address details for the logged-in customer profile."""
    profile = CustomerProfile.objects.filter(user=request.auth).first()
    if not profile:
        raise HttpError(404, "Customer profile not found.")
    
    profile.address = data.address
    profile.district_id = data.district_id
    profile.thana_id = data.thana_id
    profile.save()
    return compile_customer_response(profile)


class CustomerProfileUpdateSchema(Schema):
    full_name: str
    gender: Optional[str] = "unspecified"
    birthdate: Optional[str] = None # format YYYY-MM-DD
    address: Optional[str] = ""
    district_id: Optional[int] = None
    thana_id: Optional[int] = None


@router.put("/customers/me/profile", response=CustomerResponseSchema, auth=BearerAuth())
def update_my_customer_profile(request, data: CustomerProfileUpdateSchema):
    """Update profile and address details for the logged-in customer."""
    profile = CustomerProfile.objects.filter(user=request.auth).first()
    if not profile:
        raise HttpError(404, "Customer profile not found.")
    
    from django.db import transaction
    from django.utils import timezone
    
    with transaction.atomic():
        user = profile.user
        user.first_name = data.full_name
        user.save()
        
        profile.gender = data.gender
        if data.birthdate:
            profile.birthdate = timezone.datetime.strptime(data.birthdate, "%Y-%m-%d").date()
        else:
            profile.birthdate = None
            
        profile.address = data.address
        profile.district_id = data.district_id
        profile.thana_id = data.thana_id
        profile.save()
        
    return compile_customer_response(profile)

import os
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from ninja import File
from ninja.files import UploadedFile

@router.post("/customers/me/upload-profile-image", auth=BearerAuth())
def upload_profile_image(request, file: UploadedFile = File(...)):
    """Upload and optimize a profile image (resize to 400px width, WEBP)."""
    profile = CustomerProfile.objects.filter(user=request.auth).first()
    if not profile:
        raise HttpError(404, "Customer profile not found.")
        
    try:
        from apps.image_optimizer.services import optimize_and_save_image
        
        url = optimize_and_save_image(file, max_width=400, prefix="profiles")
        
        profile.profile_image = url
        profile.save()
        
        return {"url": url}
    except Exception as e:
        raise HttpError(400, f"Error processing image: {str(e)}")

@router.get("/customers", response=List[CustomerResponseSchema], auth=BearerAuth())
def list_customers(
    request,
    search: Optional[str] = None,
    tier_id: Optional[int] = None,
    district_id: Optional[int] = None,
    gender: Optional[str] = None
):
    """List all customers directory with search and advanced filters (Admin only)."""
    enforce_permission(request, "crm", "view_customers")
    qs = CustomerProfile.objects.select_related('user', 'membership_tier', 'district', 'thana').all()
    
    if search:
        qs = qs.filter(
            Q(phone__icontains=search) |
            Q(user__username__icontains=search) |
            Q(email__icontains=search)
        ).distinct()
        
    if tier_id:
        qs = qs.filter(membership_tier_id=tier_id)
    if district_id:
        qs = qs.filter(district_id=district_id)
    if gender:
        qs = qs.filter(gender=gender)
        
    return [compile_customer_response(c) for c in qs.order_by('-created_at')]

@router.post("/customers", response=CustomerResponseSchema, auth=BearerAuth())
def create_customer(request, data: CustomerCreateInputSchema):
    """Create a new CRM customer profile manually, registers a shadow user account (Admin only)."""
    enforce_permission(request, "crm", "edit_customers")
    
    # Enforce phone number uniqueness across system
    if CustomerProfile.objects.filter(phone=data.phone).exists():
        raise HttpError(400, f"Customer with phone number {data.phone} already exists.")
        
    try:
        with transaction.atomic():
            import uuid
            # Create core shadow user
            email_val = data.email or f"{uuid.uuid4().hex[:6]}@poshplex-shadow.com"
            username_val = data.username or data.name
            first_name_val = data.name if data.username else ""
            user = User.objects.create_user(
                username=username_val,
                first_name=first_name_val,
                email=email_val,
                password=uuid.uuid4().hex,
                role='customer'
            )
            
            bdate = timezone.datetime.strptime(data.birthdate, "%Y-%m-%d").date() if data.birthdate else None
            
            profile = CustomerProfile.objects.create(
                user=user,
                phone=data.phone,
                email=data.email,
                gender=data.gender,
                birthdate=bdate,
                district_id=data.district_id,
                thana_id=data.thana_id,
                address=data.address,
                membership_tier_id=data.membership_tier_id,
                internal_notes=data.internal_notes,
                is_active=data.is_active
            )
            return compile_customer_response(profile)
    except Exception as e:
        raise HttpError(400, str(e))

@router.put("/customers/{customer_id}", response=CustomerResponseSchema, auth=BearerAuth())
def update_customer(request, customer_id: int, data: CustomerCreateInputSchema):
    """Edit coordinates of a customer profile (Admin only)."""
    enforce_permission(request, "crm", "edit_customers")
    profile = get_object_or_404(CustomerProfile, id=customer_id)
    
    # Prevent phone collisions
    if data.phone != profile.phone and CustomerProfile.objects.filter(phone=data.phone).exclude(id=customer_id).exists():
        raise HttpError(400, f"Phone number {data.phone} is already attached to another profile.")
        
    try:
        with transaction.atomic():
            profile.phone = data.phone
            profile.email = data.email
            profile.gender = data.gender
            profile.birthdate = timezone.datetime.strptime(data.birthdate, "%Y-%m-%d").date() if data.birthdate else None
            profile.district_id = data.district_id
            profile.thana_id = data.thana_id
            profile.address = data.address
            profile.membership_tier_id = data.membership_tier_id
            profile.internal_notes = data.internal_notes
            profile.is_active = data.is_active
            profile.save()
            
            # Sync user fields
            profile.user.first_name = data.name
            profile.user.email = data.email
            profile.user.save()
                
            return compile_customer_response(profile)
    except Exception as e:
        raise HttpError(400, str(e))

@router.delete("/customers/{customer_id}", auth=BearerAuth())
def delete_customer(request, customer_id: int):
    """Soft delete or delete customer. Safety protected if customer has linked orders history (Admin only)."""
    enforce_permission(request, "crm", "edit_customers")
    profile = get_object_or_404(CustomerProfile, id=customer_id)
    try:
        profile.delete()
        return {"success": True}
    except ValidationError as ve:
        raise HttpError(400, str(ve))
    except Exception as e:
        raise HttpError(400, str(e))

# Detailed customer view & analytics

@router.get("/customers/{customer_id}/detail", response=CustomerDetailResponseSchema, auth=BearerAuth())
def get_customer_detail(request, customer_id: int):
    """Fetch profile KPIs, cancel/RTO risk profiles, timelines logs, and complete order history (Admin only)."""
    enforce_permission(request, "crm", "view_customers")
    profile = get_object_or_404(CustomerProfile, id=customer_id)
    
    from django.apps import apps
    Order = apps.get_model('orders', 'Order')
    orders_qs = Order.objects.filter(user=profile.user).order_by('-created_at')
    total_orders = orders_qs.count()
    
    # Calculate KPIs
    lifetime_spend = orders_qs.filter(payment_status='paid').aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
    avg_order_value = orders_qs.aggregate(avg=Avg('total_amount'))['avg'] or Decimal('0.00')
    last_order = orders_qs.first()
    last_order_date = last_order.created_at if last_order else None
    
    kpis = {
        "total_orders": total_orders,
        "lifetime_spend": lifetime_spend,
        "average_order_value": avg_order_value,
        "last_order_date": last_order_date
    }
    
    # Calculate Risk profile
    cancelled = orders_qs.filter(status='cancelled').count()
    rto = orders_qs.filter(status='rto').count()
    delivered = orders_qs.filter(status='delivered').count()
    
    cancellation_rate = (cancelled / total_orders * 100) if total_orders > 0 else 0
    
    # COD reliability score (delivered vs cancelled+rto)
    total_cod_attempts = delivered + cancelled + rto
    cod_reliability = (delivered / total_cod_attempts * 100) if total_cod_attempts > 0 else 100
    
    risk_profile = {
        "cancellation_rate": cancellation_rate,
        "rto_count": rto,
        "cod_reliability_score": cod_reliability
    }
    
    # Compile notes
    notes = [{
        "id": n.id,
        "author_username": n.author_username,
        "note": n.note,
        "created_at": n.created_at
    } for n in profile.crm_notes.all()]
    
    # Compile orders checklist
    orders_list = [{
        "id": o.id,
        "order_number": o.order_number,
        "total_amount": o.total_amount,
        "status": o.status,
        "payment_status": o.payment_status,
        "created_at": o.created_at
    } for o in orders_qs]
    
    return {
        "profile": compile_customer_response(profile),
        "kpis": kpis,
        "risk_profile": risk_profile,
        "notes": notes,
        "orders": orders_list
    }

# Admin Notes timeline posting

@router.post("/customers/{customer_id}/notes", response=CRMNoteResponseSchema, auth=BearerAuth())
def post_crm_note(request, customer_id: int, data: CRMNoteInputSchema):
    """Add administrative remarks/notes about a customer behavior (Admin only)."""
    enforce_permission(request, "crm", "edit_customers")
    profile = get_object_or_404(CustomerProfile, id=customer_id)
    
    note = CRMNote.objects.create(
        customer=profile,
        author_username=request.auth.username,
        note=data.note
    )
    return {
        "id": note.id,
        "author_username": note.author_username,
        "note": note.note,
        "created_at": note.created_at
    }

# Impersonation session

@router.post("/customers/{customer_id}/impersonate", auth=BearerAuth())
def impersonate_customer(request, customer_id: int):
    """Impersonate a customer secure session. Action is logged inside audits (Admin only)."""
    enforce_permission(request, "admin", "view_audit")
    profile = get_object_or_404(CustomerProfile, id=customer_id)
    
    # Audit log
    from django.apps import apps
    AuditLog = apps.get_model('core', 'AuditLog')
    AuditLog.objects.create(
        user=request.auth,
        action="CREATE",
        model_name="CustomerProfile",
        model_id=str(profile.id),
        old_values={},
        new_values={"impersonation": f"Admin {request.auth.username} logged as customer {profile.user.username}"}
    )
    
    # Generate a valid JWT token for the impersonated user
    from apps.core.api import generate_jwt_token
    token = generate_jwt_token(profile.user)

    return {
        "success": True,
        "impersonated_username": profile.user.username,
        "token": token,
        "expires_in_minutes": 15
    }

class PublicMemberSchema(Schema):
    username: str
    tier_name: str
    show_member_since: bool
    tier_assigned_at: Optional[Any] = None

@router.get("/public-members", response=List[PublicMemberSchema])
def list_public_members(request, tier_id: Optional[int] = None):
    """Public membership directory list (no auth required)."""
    qs = CustomerProfile.objects.filter(membership_tier__show_on_public=True, is_active=True).select_related('user', 'membership_tier')
    if tier_id:
        qs = qs.filter(membership_tier_id=tier_id)
        
    return [{
        "username": c.user.username,
        "tier_name": c.membership_tier.name,
        "show_member_since": c.membership_tier.show_member_since,
        "tier_assigned_at": c.tier_assigned_at
    } for c in qs]
