from typing import List, Dict, Any, Optional
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.conf import settings as django_settings
from django.db.models import Q
from ninja import Router, Schema, File
from ninja.files import UploadedFile
import os
import jwt
import datetime
from ninja.security import HttpBearer
from ninja.errors import HttpError

from apps.core.models import SiteSetting, AuditLog, MediaAsset

router = Router()
User = get_user_model()

# --- JWT Configuration ---
JWT_SECRET = getattr(django_settings, 'JWT_SECRET_KEY', django_settings.SECRET_KEY)
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_MINUTES = getattr(django_settings, 'JWT_EXPIRATION_MINUTES', 15)
JWT_REFRESH_EXPIRATION_DAYS = getattr(django_settings, 'JWT_REFRESH_EXPIRATION_DAYS', 7)

def set_refresh_cookie(response: HttpResponse, token: str):
    response.set_cookie(
        'refresh_token',
        token,
        httponly=True,
        samesite='Lax',
        secure=False,
        max_age=JWT_REFRESH_EXPIRATION_DAYS * 24 * 3600
    )

def generate_jwt_token(user) -> dict:
    """Generate a signed JWT token pair for an authenticated user."""
    access_payload = {
        'user_id': user.id,
        'username': user.username,
        'role': user.role,
        'type': 'access',
        'exp': datetime.datetime.utcnow() + datetime.timedelta(minutes=JWT_EXPIRATION_MINUTES),
        'iat': datetime.datetime.utcnow(),
    }
    refresh_payload = {
        'user_id': user.id,
        'type': 'refresh',
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=JWT_REFRESH_EXPIRATION_DAYS),
        'iat': datetime.datetime.utcnow(),
    }
    return {
        'access_token': jwt.encode(access_payload, JWT_SECRET, algorithm=JWT_ALGORITHM),
        'refresh_token': jwt.encode(refresh_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    }

def decode_jwt_token(token: str) -> dict:
    """Decode and validate a JWT token. Raises on invalid/expired."""
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

# --- Authentication & RBAC Dependencies ---

class BearerAuth(HttpBearer):
    def authenticate(self, request, token):
        """
        Authenticate requests using signed JWT tokens.
        Decodes the token, verifies the signature and expiry,
        and returns the associated User object.
        """
        try:
            payload = decode_jwt_token(token)
            if payload.get('type') != 'access':
                return None
            user = User.objects.get(id=payload['user_id'])
            return user
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, User.DoesNotExist):
            return None

def enforce_permission(request, module_name: str, action: str):
    """
    Utility function to check user role permissions on administrative routes.
    """
    user = request.auth
    if not user:
        raise HttpError(401, "Unauthorized: User context required.")
        
    # Dynamically enforce REST actions based on HTTP methods.
    # This prevents users with only "view" privileges from being blocked on GET routes
    # that mistakenly check for "edit_catalog" or "manage_campaigns".
    method = getattr(request, 'method', '').upper()
    if method == 'GET':
        action = 'view'
    elif method == 'POST':
        action = 'create'
    elif method in ('PUT', 'PATCH'):
        action = 'edit'
    elif method == 'DELETE':
        action = 'delete'
        
    if not user.has_module_permission(module_name, action):
        raise HttpError(403, f"Forbidden: Insufficient privileges for action {module_name}.{action}")

# --- Schemas ---

class LoginSchema(Schema):
    username: str
    password: str

class RegisterSchema(Schema):
    username: str
    password: str
    email: Optional[str] = ""
    role: Optional[str] = "customer"

class CustomerLoginSchema(Schema):
    phone_or_email: str
    password: str

class CustomerRegisterSchema(Schema):
    full_name: str
    phone_or_email: str
    birthdate: Optional[str] = None
    password: str

class TokenResponseSchema(Schema):
    access_token: str
    user: Dict[str, Any]

class RefreshTokenResponseSchema(Schema):
    access_token: str

class UserSchema(Schema):
    id: int
    username: str
    email: str
    role: str

class SiteSettingSchema(Schema):
    key: str
    value: Dict[str, Any]
    description: Optional[str] = None

class SiteSettingInputSchema(Schema):
    key: str
    value: Dict[str, Any]
    description: Optional[str] = None

class AuditLogSchema(Schema):
    id: int
    user: Optional[UserSchema] = None
    action: str
    model_name: str
    model_id: str
    old_values: Dict[str, Any]
    new_values: Dict[str, Any]
    timestamp: str

class UnifiedMediaSchema(Schema):
    id: str
    file_name: str
    mime_type: str
    file_size: int
    url: str
    created_at: str
    usage: str = ""
    link_type: str = "local"
    alt_text: str = ""
    model_type: str = "MediaAsset"

# --- Auth Endpoints ---

@router.post("/login", response=TokenResponseSchema)
def login(request, data: LoginSchema, response: HttpResponse):
    """Authenticate with username + password and receive a signed JWT token."""
    try:
        user = User.objects.get(username=data.username)
    except User.DoesNotExist:
        raise HttpError(401, "Invalid username or password.")

    if not user.check_password(data.password):
        raise HttpError(401, "Invalid username or password.")

    user_data = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
    }
    
    # Add permissions matrix if they are staff
    if hasattr(user, 'staff_profile') and user.staff_profile and user.staff_profile.role:
        user_data['role_name'] = user.staff_profile.role.name
        user_data['permissions'] = user.staff_profile.role.permissions
    elif user.is_superuser:
        user_data['permissions'] = {'superuser': True}

    tokens = generate_jwt_token(user)
    set_refresh_cookie(response, tokens['refresh_token'])
    return {
        "access_token": tokens['access_token'],
        "user": user_data
    }

@router.post("/register", response=TokenResponseSchema)
def register(request, data: RegisterSchema, response: HttpResponse):
    """Register a new user account and receive a JWT token."""
    if User.objects.filter(username=data.username).exists():
        raise HttpError(400, f"Username '{data.username}' is already taken.")

    user = User.objects.create_user(
        username=data.username,
        password=data.password,
        email=data.email or "",
        role=data.role or "customer",
    )

    tokens = generate_jwt_token(user)
    set_refresh_cookie(response, tokens['refresh_token'])
    return {
        "access_token": tokens['access_token'],
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
        }
    }

def check_otp_rate_limit(request):
    """Enforces 3 OTP requests per 30 minutes per IP address."""
    from django.core.cache import cache
    
    # Try to get the real IP if behind a proxy like Nginx
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR', 'unknown')
        
    cache_key = f"otp_rate_limit_{ip}"
    attempts = cache.get(cache_key, 0)
    
    if attempts >= 3:
        raise HttpError(429, "Too many OTP requests from this IP. Please try again after 30 minutes.")
        
    # Increment attempts and set 30-min expiry if it's the first attempt
    if attempts == 0:
        cache.set(cache_key, 1, timeout=1800) # 30 mins
    else:
        cache.incr(cache_key)

class RequestOtpSchema(Schema):
    identifier: str

class ResetPasswordSchema(Schema):
    identifier: str
    otp: str
    new_password: str

class SocialLoginSchema(Schema):
    provider: str
    token: str

@router.post("/social-login", response=TokenResponseSchema)
def social_login(request, data: SocialLoginSchema, response: HttpResponse):
    """Authenticate or register via Google/Facebook OAuth token."""
    from apps.core.models import Setting
    from apps.crm.models import CustomerProfile
    import requests
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    import uuid
    from django.db import transaction

    # Fetch configured IDs
    settings_obj = Setting.objects.filter(key="social_auth").first()
    if not settings_obj or not settings_obj.value:
        raise HttpError(500, "Social login is not configured on the server.")
        
    google_client_id = settings_obj.value.get("google_client_id", "")
    facebook_app_id = settings_obj.value.get("facebook_app_id", "")

    email = None
    full_name = None

    try:
        if data.provider == "google":
            if not google_client_id:
                raise HttpError(500, "Google login is disabled.")
            idinfo = id_token.verify_oauth2_token(data.token, google_requests.Request(), google_client_id)
            email = idinfo.get("email")
            full_name = idinfo.get("name", "Google User")
            
        elif data.provider == "facebook":
            if not facebook_app_id:
                raise HttpError(500, "Facebook login is disabled.")
            fb_res = requests.get(f"https://graph.facebook.com/me?fields=id,name,email&access_token={data.token}")
            if not fb_res.ok:
                raise HttpError(401, "Invalid Facebook token.")
            fb_data = fb_res.json()
            email = fb_data.get("email")
            full_name = fb_data.get("name", "Facebook User")
        else:
            raise HttpError(400, "Unsupported provider.")
            
        if not email:
            raise HttpError(400, "Could not extract email from social provider.")

        # Create or Get user
        with transaction.atomic():
            user = User.objects.filter(email=email).first()
            if not user:
                user = User.objects.create_user(
                    username=f"social_{uuid.uuid4().hex[:8]}",
                    first_name=full_name,
                    email=email,
                    password=uuid.uuid4().hex,
                    role="customer",
                )
                
            # Ensure CRM profile exists
            dummy_phone = f"email_{uuid.uuid4().hex[:8]}"
            CustomerProfile.objects.get_or_create(
                user=user,
                defaults={
                    "phone": dummy_phone,
                    "email": email,
                    "gender": "unspecified",
                    "membership_tier_id": 1
                }
            )

        tokens = generate_jwt_token(user)
        set_refresh_cookie(response, tokens['refresh_token'])
        
        return {
            "access_token": tokens['access_token'],
            "user": {
                "id": user.id,
                "username": user.first_name or user.username,
                "email": user.email,
                "role": user.role,
            }
        }
    except ValueError as e:
        raise HttpError(401, f"Token verification failed: {e}")
    except Exception as e:
        raise HttpError(400, str(e))



@router.post("/customer-login", response=TokenResponseSchema)
def customer_login(request, data: CustomerLoginSchema, response: HttpResponse):
    """Authenticate storefront customer via phone or email and password."""
    from apps.crm.models import CustomerProfile
    
    if "@" in data.phone_or_email:
        user = User.objects.filter(email=data.phone_or_email).first()
        if not user or not user.check_password(data.password):
            raise HttpError(401, "Invalid email or password.")
    else:
        profile = CustomerProfile.objects.filter(phone=data.phone_or_email).select_related('user').first()
        if not profile or not profile.user.check_password(data.password):
            raise HttpError(401, "Invalid phone number or password.")
        user = profile.user

    tokens = generate_jwt_token(user)
    set_refresh_cookie(response, tokens['refresh_token'])
    return {
        "access_token": tokens['access_token'],
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
        }
    }

@router.post("/customer-register", response=TokenResponseSchema)
def customer_register(request, data: CustomerRegisterSchema, response: HttpResponse):
    """Register storefront customer and automatically setup profile."""
    from apps.crm.models import CustomerProfile
    from django.db import transaction
    
    is_email = "@" in data.phone_or_email
    
    if is_email:
        if User.objects.filter(email=data.phone_or_email).exists():
            raise HttpError(400, "Email is already registered.")
    else:
        if CustomerProfile.objects.filter(phone=data.phone_or_email).exists():
            raise HttpError(400, "Phone number is already registered.")
            
    try:
        with transaction.atomic():
            import uuid
            from django.utils import timezone
            
            user = User.objects.create_user(
                username=f"cust_{uuid.uuid4().hex[:8]}",
                first_name=data.full_name,
                email=data.phone_or_email if is_email else "",
                password=data.password,
                role="customer",
            )
            
            bdate = timezone.datetime.strptime(data.birthdate, "%Y-%m-%d").date() if data.birthdate else None
            
            CustomerProfile.objects.create(
                user=user,
                phone=f"email_{uuid.uuid4().hex[:8]}" if is_email else data.phone_or_email,
                email=data.phone_or_email if is_email else "",
                gender='unspecified',
                birthdate=bdate,
                membership_tier_id=1
            )
            
            tokens = generate_jwt_token(user)
            set_refresh_cookie(response, tokens['refresh_token'])
            
            # Dispatch automated notification
            from apps.core.tasks import send_automated_notification
            send_automated_notification.delay(
                event_type="account",
                context={
                    "username": data.full_name,
                    "email": user.email,
                    "phone": "" if is_email else data.phone_or_email
                }
            )
            
            return {
                "access_token": tokens['access_token'],
                "user": {
                    "id": user.id,
                    "username": data.full_name, # Return their entered full name
                    "email": user.email,
                    "role": user.role,
                }
            }
    except Exception as e:
        raise HttpError(400, str(e))

@router.post("/customer-forgot-password/request-otp")
def request_otp(request, data: RequestOtpSchema):
    from apps.crm.models import CustomerProfile
    from django.core.cache import cache
    import random
    from apps.integration.tasks import send_customer_sms_task, send_customer_email_task
    
    check_otp_rate_limit(request)
    
    is_email = "@" in data.identifier
    
    if is_email:
        profile = CustomerProfile.objects.filter(user__email=data.identifier).first()
    else:
        profile = CustomerProfile.objects.filter(phone=data.identifier).first()
        
    if not profile:
        raise HttpError(404, "Account with this identifier not found.")
        
    otp = str(random.randint(100000, 999999))
    cache.set(f"otp_{data.identifier}", otp, timeout=180) # 3 minutes expiry
    
    # Send the OTP via Email or SMS using Celery
    if is_email:
        email_body = f"Your Poshplex OTP is {otp}. It expires in 3 minutes."
        send_customer_email_task.delay(data.identifier, "Poshplex Password Reset OTP", email_body)
    else:
        otp_message = f"Your Poshplex OTP is {otp}"
        send_customer_sms_task.delay(data.identifier, otp_message)
    
    return {"success": True, "message": "OTP sent successfully."}

@router.post("/customer-forgot-password/reset")
def reset_password(request, data: ResetPasswordSchema):
    from apps.crm.models import CustomerProfile
    from django.core.cache import cache
    
    cached_otp = cache.get(f"otp_{data.identifier}")
    if not cached_otp or cached_otp != data.otp:
        raise HttpError(400, "Invalid or expired OTP.")
        
    is_email = "@" in data.identifier
    if is_email:
        profile = CustomerProfile.objects.filter(user__email=data.identifier).select_related('user').first()
    else:
        profile = CustomerProfile.objects.filter(phone=data.identifier).select_related('user').first()
        
    if not profile:
        raise HttpError(404, "Account not found.")
        
    user = profile.user
    user.set_password(data.new_password)
    user.save()
    
    cache.delete(f"otp_{data.identifier}")
    return {"success": True, "message": "Password reset successfully."}

class ChangePasswordSchema(Schema):
    current_password: str
    new_password: str

@router.post("/change-password", auth=BearerAuth())
def change_password(request, data: ChangePasswordSchema):
    user = request.auth
    if not user.check_password(data.current_password):
        raise HttpError(400, "Incorrect current password.")
    user.set_password(data.new_password)
    user.save()
    return {"success": True}

@router.post("/refresh", response=RefreshTokenResponseSchema)
def refresh_token(request, response: HttpResponse):
    """Exchange a valid refresh token cookie for a new access token and refresh token."""
    refresh_token = request.COOKIES.get('refresh_token')
    if not refresh_token:
        raise HttpError(401, "No refresh token provided.")
        
    try:
        payload = decode_jwt_token(refresh_token)
        if payload.get('type') != 'refresh':
            raise HttpError(401, "Invalid token type.")
        user = User.objects.get(id=payload['user_id'])
    except jwt.ExpiredSignatureError:
        raise HttpError(401, "Refresh token expired. Please login again.")
    except jwt.InvalidTokenError:
        raise HttpError(401, "Invalid refresh token.")
    except User.DoesNotExist:
        raise HttpError(401, "User not found.")

    tokens = generate_jwt_token(user)
    set_refresh_cookie(response, tokens['refresh_token'])
    return {
        "access_token": tokens['access_token']
    }

@router.post("/logout")
def logout(request, response: HttpResponse):
    """Logout and clear refresh token cookie."""
    response.delete_cookie('refresh_token')
    return {"success": True}

# --- Protected Endpoints ---

@router.get("/me", auth=BearerAuth())
def get_me(request):
    """Get profile of current authenticated user, including permissions."""
    user = request.auth
    user_data = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
    }
    if hasattr(user, 'staff_profile') and user.staff_profile and user.staff_profile.role:
        user_data['role_name'] = user.staff_profile.role.name
        user_data['permissions'] = user.staff_profile.role.permissions
    elif user.is_superuser:
        user_data['permissions'] = {'superuser': True}
    return user_data

@router.get("/settings", response=List[SiteSettingSchema], auth=BearerAuth())
def list_settings(request):
    """List all site settings (Requires authentication)."""
    return list(SiteSetting.objects.all())

@router.get("/settings/{key}", response=SiteSettingSchema)
def get_setting(request, key: str):
    """Retrieve value of a specific setting key (Publicly accessible)."""
    val = SiteSetting.get_value(key)
    if val is None:
        return {"key": key, "value": {}}
    
    # Redact sensitive fields for public endpoint
    redacted_val = dict(val)
    if key == "social_auth":
        redacted_val.pop("google_client_secret", None)
        redacted_val.pop("facebook_client_secret", None)
        
    return {"key": key, "value": redacted_val, "description": SiteSetting.objects.get(key=key).description}

@router.get("/settings-admin/{key}", response=SiteSettingSchema, auth=BearerAuth())
def get_admin_setting(request, key: str):
    """Retrieve value of a specific setting key including secrets (Requires admin permission)."""
    enforce_permission(request, "core", "edit_settings")
    val = SiteSetting.get_value(key)
    if val is None:
        return {"key": key, "value": {}}
    return SiteSetting.objects.get(key=key)

@router.post("/settings", response=SiteSettingSchema, auth=BearerAuth())
def save_setting(request, data: SiteSettingInputSchema):
    """Create or update a site setting (Requires admin permission)."""
    enforce_permission(request, "core", "edit_settings")
    
    # If the setting is social_auth and the payload is missing secrets, 
    # preserve the existing secrets so they aren't overwritten by the redacted frontend view.
    new_value = dict(data.value)
    if data.key == "social_auth":
        existing = SiteSetting.get_value(data.key) or {}
        if "google_client_secret" not in new_value and "google_client_secret" in existing:
            new_value["google_client_secret"] = existing["google_client_secret"]
        if "facebook_client_secret" not in new_value and "facebook_client_secret" in existing:
            new_value["facebook_client_secret"] = existing["facebook_client_secret"]

    setting, created = SiteSetting.objects.update_or_create(
        key=data.key,
        defaults={"value": new_value, "description": data.description}
    )
    return setting

@router.get("/audit-logs", response=List[AuditLogSchema], auth=BearerAuth())
def get_audit_logs(request, page: int = 1, limit: int = 50):
    """Retrieve audit logs with pagination (Requires admin permission)."""
    enforce_permission(request, "admin", "view_audit")
    start = (page - 1) * limit
    end = start + limit
    logs = AuditLog.objects.select_related('user').all()[start:end]
    # format timestamp to string
    res = []
    for log in logs:
        res.append({
            "id": log.id,
            "user": log.user,
            "action": log.action,
            "model_name": log.model_name,
            "model_id": log.model_id,
            "old_values": log.old_values,
            "new_values": log.new_values,
            "timestamp": log.timestamp.isoformat()
        })
    return res

@router.get("/media", response=List[UnifiedMediaSchema], auth=BearerAuth())
def list_media(request):
    """List all media assets unified."""
    enforce_permission(request, "media", "view")
    
    from apps.catalog.models import ProductImage, Category, Product
    base_url = os.environ.get('SITE_BASE_URL', 'http://localhost:8000').rstrip('/')
    
    res = []
    
    # 1. Central Media Assets
    assets = MediaAsset.objects.all().order_by('-created_at')
    for asset in assets:
        url = asset.file.url if asset.file else ""
        if url and not (url.startswith("http://") or url.startswith("https://")):
            url = f"{base_url}{url}"
            
        res.append({
            "id": f"asset_{asset.id}",
            "file_name": asset.file_name,
            "mime_type": asset.mime_type,
            "file_size": asset.file_size,
            "url": url,
            "created_at": asset.created_at.isoformat(),
            "usage": "Central Library",
            "link_type": "local",
            "alt_text": asset.alt_text or "",
            "model_type": "MediaAsset"
        })
        
    # 2. Product Images
    p_images = ProductImage.objects.select_related('product').all().order_by('-id')
    for img in p_images:
        url = img.image.url if img.image else ""
        if url and not (url.startswith("http://") or url.startswith("https://")):
            url = f"{base_url}{url}"
            
        file_name = os.path.basename(img.image.name) if img.image else f"product_{img.product.id}_image"
        size = img.image.size if img.image else 0
        
        res.append({
            "id": f"productimage_{img.id}",
            "file_name": file_name,
            "mime_type": "image/webp", # Mostly webp based on our save logic
            "file_size": size,
            "url": url,
            "created_at": img.product.created_at.isoformat() if img.product else "",
            "usage": f"Product: {img.product.name}",
            "link_type": "local",
            "alt_text": img.alt_text or "",
            "model_type": "ProductImage"
        })
        
    # 3. Category Images
    cats = Category.objects.exclude(image="").exclude(image__isnull=True).order_by('-id')
    for cat in cats:
        url = cat.image.url if cat.image else ""
        if url and not (url.startswith("http://") or url.startswith("https://")):
            url = f"{base_url}{url}"
            
        file_name = os.path.basename(cat.image.name) if cat.image else f"category_{cat.id}_image"
        size = cat.image.size if cat.image else 0
        
        res.append({
            "id": f"category_{cat.id}",
            "file_name": file_name,
            "mime_type": "image/webp",
            "file_size": size,
            "url": url,
            "created_at": "",
            "usage": f"Category: {cat.name}",
            "link_type": "local",
            "alt_text": cat.image_alt_text or "",
            "model_type": "Category"
        })
        
    # 4. Product Videos (YouTube)
    products = Product.objects.exclude(youtube_video_url="").exclude(youtube_video_url__isnull=True).order_by('-created_at')
    for prod in products:
        res.append({
            "id": f"video_{prod.id}",
            "file_name": "YouTube Video",
            "mime_type": "video/youtube",
            "file_size": 0,
            "url": prod.youtube_video_url,
            "created_at": prod.created_at.isoformat(),
            "usage": f"Product Video: {prod.name}",
            "link_type": "outside",
            "alt_text": "YouTube Video embed",
            "model_type": "ProductVideo"
        })

    return res

@router.post("/media", response=UnifiedMediaSchema, auth=BearerAuth())
def upload_media(request, file: UploadedFile = File(...)):
    """Upload asset into the central media library."""
    enforce_permission(request, "media", "create")
    
    mime_type = file.content_type or 'application/octet-stream'
    if file.name.lower().endswith('.webp'):
        mime_type = 'image/webp'
    elif file.name.lower().endswith(('.jpg', '.jpeg')):
        mime_type = 'image/jpeg'
    elif file.name.lower().endswith('.png'):
        mime_type = 'image/png'
    elif file.name.lower().endswith('.gif'):
        mime_type = 'image/gif'
    elif file.name.lower().endswith('.svg'):
        mime_type = 'image/svg+xml'

    existing_asset = MediaAsset.objects.filter(file_name=file.name).first()
    if existing_asset:
        if existing_asset.mime_type == 'application/octet-stream' and mime_type != 'application/octet-stream':
            existing_asset.mime_type = mime_type
            existing_asset.save()
            
        url = existing_asset.file.url if existing_asset.file else ""
        if url and not (url.startswith("http://") or url.startswith("https://")):
            base_url = os.environ.get('SITE_BASE_URL', 'http://localhost:8000')
            url = f"{base_url.rstrip('/')}{url}"
        return {
            "id": f"asset_{existing_asset.id}",
            "file_name": existing_asset.file_name,
            "mime_type": existing_asset.mime_type,
            "file_size": existing_asset.file_size,
            "url": url,
            "created_at": existing_asset.created_at.isoformat(),
            "usage": "Central Library",
            "link_type": "local",
            "alt_text": existing_asset.alt_text or "",
            "model_type": "MediaAsset"
        }

    asset = MediaAsset.objects.create(
        file=file,
        file_name=file.name,
        mime_type=mime_type,
        file_size=file.size,
        uploaded_by=request.auth
    )
    url = asset.file.url if asset.file else ""
    if url and not (url.startswith("http://") or url.startswith("https://")):
        base_url = os.environ.get('SITE_BASE_URL', 'http://localhost:8000')
        url = f"{base_url.rstrip('/')}{url}"
    return {
        "id": f"asset_{asset.id}",
        "file_name": asset.file_name,
        "mime_type": asset.mime_type,
        "file_size": asset.file_size,
        "url": url,
        "created_at": asset.created_at.isoformat(),
        "usage": "Central Library",
        "link_type": "local",
        "alt_text": asset.alt_text or "",
        "model_type": "MediaAsset"
    }

class UpdateMediaSeoSchema(Schema):
    alt_text: str

@router.patch("/media/{unified_id}/seo", auth=BearerAuth())
def update_media_seo(request, unified_id: str, data: UpdateMediaSeoSchema):
    """Update SEO alt text for any media type."""
    enforce_permission(request, "media", "edit")
    from apps.catalog.models import ProductImage, Category
    
    if unified_id.startswith("asset_"):
        asset_id = int(unified_id.replace("asset_", ""))
        asset = get_object_or_404(MediaAsset, id=asset_id)
        asset.alt_text = data.alt_text
        asset.save()
    elif unified_id.startswith("productimage_"):
        img_id = int(unified_id.replace("productimage_", ""))
        img = get_object_or_404(ProductImage, id=img_id)
        img.alt_text = data.alt_text
        img.save()
    elif unified_id.startswith("category_"):
        cat_id = int(unified_id.replace("category_", ""))
        cat = get_object_or_404(Category, id=cat_id)
        cat.image_alt_text = data.alt_text
        cat.save()
    else:
        raise HttpError(400, "Cannot update SEO for this media type.")
        
    return {"success": True}

@router.delete("/media/{unified_id}", auth=BearerAuth())
def delete_media(request, unified_id: str):
    """Delete a media asset."""
    enforce_permission(request, "media", "delete")
    
    if not unified_id.startswith("asset_"):
        raise HttpError(400, "This media belongs to a specific catalog item. Please delete it from the Catalog module.")
        
    asset_id = int(unified_id.replace("asset_", ""))
    asset = get_object_or_404(MediaAsset, id=asset_id)
    
    # Check for active references before deleting
    url = asset.file.url if asset.file else ""
    usages = []
    if url:
        from apps.catalog.models import Product, Category
        for p in Product.objects.filter(Q(description__icontains=url) | Q(short_description__icontains=url)):
            usages.append(f"Product: {p.name}")
            
    if usages:
        raise HttpError(409, {"detail": "Asset currently in use", "usages": usages})
        
    if asset.file:
        try:
            asset.file.delete(save=False)
        except:
            pass
    asset.delete()
    return {"success": True}

# --- Roles and Staff Endpoints ---
class RoleSchema(Schema):
    id: int
    name: str
    description: Optional[str] = None
    permissions: Dict[str, Any]
    created_at: Any

class RoleInputSchema(Schema):
    name: str
    description: Optional[str] = None
    permissions: Dict[str, Any]

class StaffProfileSchema(Schema):
    id: int
    user_id: int
    username: str
    role_id: Optional[int]
    role_name: Optional[str]
    internal_notes: Optional[str] = None
    created_at: Any

class StaffProfileInputSchema(Schema):
    name: str
    username: str
    password: Optional[str] = None
    role_id: Optional[int] = None
    internal_notes: Optional[str] = None

from apps.core.models import Role, StaffProfile

@router.get("/roles", response=List[RoleSchema], auth=BearerAuth())
def list_roles(request):
    enforce_permission(request, "core", "view")
    return list(Role.objects.all())

@router.post("/roles", response=RoleSchema, auth=BearerAuth())
def create_role(request, data: RoleInputSchema):
    enforce_permission(request, "core", "edit")
    role = Role.objects.create(**data.dict())
    return role

@router.put("/roles/{role_id}", response=RoleSchema, auth=BearerAuth())
def update_role(request, role_id: int, data: RoleInputSchema):
    enforce_permission(request, "core", "edit")
    role = get_object_or_404(Role, id=role_id)
    for key, value in data.dict().items():
        setattr(role, key, value)
    role.save()
    return role

@router.delete("/roles/{role_id}", auth=BearerAuth())
def delete_role(request, role_id: int):
    enforce_permission(request, "core", "edit")
    role = get_object_or_404(Role, id=role_id)
    if role.staff_members.exists():
        raise HttpError(400, "Cannot delete role assigned to active staff.")
    role.delete()
    return {"success": True}

def compile_staff_response(staff: StaffProfile):
    return {
        "id": staff.id,
        "user_id": staff.user.id,
        "username": staff.user.username,
        "role_id": staff.role.id if staff.role else None,
        "role_name": staff.role.name if staff.role else None,
        "internal_notes": staff.internal_notes,
        "created_at": staff.created_at
    }

@router.get("/staff", response=List[StaffProfileSchema], auth=BearerAuth())
def list_staff(request):
    enforce_permission(request, "core", "view")
    return [compile_staff_response(s) for s in StaffProfile.objects.all()]

@router.post("/staff", response=StaffProfileSchema, auth=BearerAuth())
def create_staff(request, data: StaffProfileInputSchema):
    enforce_permission(request, "core", "edit")
    if User.objects.filter(username=data.username).exists():
        raise HttpError(400, "Username already exists")
    
    from django.db import transaction
    with transaction.atomic():
        user = User.objects.create_user(
            username=data.username,
            first_name=data.name,
            password=data.password,
            role="admin"  # Staff marker
        )
        staff = StaffProfile.objects.create(
            user=user,
            role_id=data.role_id,
            internal_notes=data.internal_notes
        )
    return compile_staff_response(staff)

@router.put("/staff/{staff_id}", response=StaffProfileSchema, auth=BearerAuth())
def update_staff(request, staff_id: int, data: StaffProfileInputSchema):
    enforce_permission(request, "core", "edit")
    staff = get_object_or_404(StaffProfile, id=staff_id)
    
    from django.db import transaction
    with transaction.atomic():
        staff.user.first_name = data.name
        if data.password:
            staff.user.set_password(data.password)
        staff.user.save()
        
        staff.role_id = data.role_id
        staff.internal_notes = data.internal_notes
        staff.save()
        
    return compile_staff_response(staff)

@router.delete("/staff/{staff_id}", auth=BearerAuth())
def delete_staff(request, staff_id: int):
    enforce_permission(request, "core", "edit")
    staff = get_object_or_404(StaffProfile, id=staff_id)
    if staff.user == request.auth:
        raise HttpError(400, "Cannot delete yourself.")
    staff.user.delete()
    return {"success": True}
