import uuid
import base64
import logging
from decimal import Decimal
from typing import List, Optional, Dict, Any
from django.db.models import Count, Avg, Sum
from django.utils import timezone
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from ninja import Router, Query, Header, errors

from apps.core.api import BearerAuth, decode_jwt_token, User, enforce_permission
from apps.fitcheck.models import FitCheckConfig, FitCheckUsage, FitCheckLog, UserCharacterProfile, BodyStructure
from apps.fitcheck.schemas import (
    FitCheckStatusResponse,
    FitCheckGeneratePayload,
    FitCheckJobResponse,
    CharacterProfileData,
    FitCheckConfigSchema,
    FitCheckConfigUpdateSchema,
    FitCheckAnalyticsResponse,
    BodyStructureSchema,
    BodyStructureCreateSchema,
    BodyStructureUpdateSchema,
)
from apps.fitcheck.services.quota_engine import QuotaEngine
from apps.fitcheck.services.tryon_service import TryOnService
from apps.fitcheck.tasks import generate_fit_check_task

logger = logging.getLogger(__name__)
router = Router(tags=["AI Virtual Fit Check"])


def get_user_from_request(request) -> Optional[User]:
    """Helper to safely extract user from Authorization header if present."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        try:
            payload = decode_jwt_token(token)
            if payload.get("type") == "access":
                return User.objects.filter(id=payload.get("user_id")).first()
        except Exception:
            return None
    return None


# =============================================================================
# Customer & Guest Facing Endpoints
# =============================================================================

@router.get("/config/public")
def get_public_fit_check_config(request):
    """
    Lightweight public endpoint for storefront to check if AI Fit Check is active.
    """
    config = FitCheckConfig.get_solo()
    return {"is_active": config.is_active}


@router.get("/status", response=FitCheckStatusResponse)
def get_fit_check_status(
    request,
    fingerprint: Optional[str] = Query(None, description="Guest device/IP fingerprint")
):
    """
    Returns quota availability, trial status, and character model state
    for both anonymous guests and registered customers.
    """
    user = get_user_from_request(request)
    fp = fingerprint or request.headers.get("x-fingerprint", "")
    quota = QuotaEngine.get_user_quota_status(user, guest_fingerprint=fp)
    config = FitCheckConfig.get_solo()

    saved_char_data = None
    if user and hasattr(user, 'fitcheck_character'):
        char = user.fitcheck_character
        face_url = char.face_image.url if char.face_image else (char.face_image_url or "")
        saved_char_data = CharacterProfileData(
            height_cm=char.height_cm,
            body_structure=char.body_structure,
            gender_preference=char.gender_preference,
            face_image_url=face_url,
            updated_at=char.updated_at.isoformat() if char.updated_at else None
        )

    is_active = config.is_active
    can_generate = is_active and quota["can_generate"]
    gatekeeper_reason = quota.get("gatekeeper_reason")
    if not is_active:
        gatekeeper_reason = "AI Virtual Fit Check is currently inactive on the storefront"

    return FitCheckStatusResponse(
        is_authenticated=quota["is_authenticated"],
        username=quota.get("username"),
        daily_limit=quota["daily_limit"],
        used_today=quota["used_today"],
        remaining_today=quota["remaining_today"],
        can_generate=can_generate,
        guest_trial_available=quota.get("guest_trial_available"),
        has_saved_character=bool(saved_char_data and (saved_char_data.face_image_url)),
        saved_character=saved_char_data,
        gatekeeper_reason=gatekeeper_reason,
        is_active=is_active
    )


@router.post("/generate", response=FitCheckJobResponse)
def generate_fit_check(request, payload: FitCheckGeneratePayload):
    """
    Initiates an AI Virtual Fit Check generation job.
    Enforces gatekeeper limits (1 trial for guests, 10/day for registered users),
    stores character profile for registered users, and enqueues async processing.
    """
    config = FitCheckConfig.get_solo()
    if not config.is_active:
        raise errors.HttpError(403, "AI Virtual Fit Check is currently inactive on the storefront.")

    user = get_user_from_request(request)
    fp = payload.guest_fingerprint or request.headers.get("x-fingerprint", "")

    # 1. Gatekeeper Quota Check & Consumption
    allowed, error_msg = QuotaEngine.consume_quota(user, fp)
    if not allowed:
        raise errors.HttpError(429 if user else 403, error_msg)

    # 2. Determine Face Source
    face_source = payload.face_image_url or payload.face_image_base64 or ""

    if user:
        char_profile, _ = UserCharacterProfile.objects.get_or_create(user=user)
        # If user elected to use saved profile or sent empty face
        if payload.use_saved_character or not face_source:
            if char_profile.face_image:
                face_source = char_profile.face_image.url
            elif char_profile.face_image_url:
                face_source = char_profile.face_image_url

        # If user uploaded a new face photo, save it to their persistent character profile
        elif payload.face_image_base64:
            try:
                b64_content = payload.face_image_base64
                if "," in b64_content:
                    b64_content = b64_content.split(",", 1)[1]
                img_data = base64.b64decode(b64_content)
                file_name = f"fitcheck/faces/user_{user.id}_{uuid.uuid4().hex[:8]}.jpg"
                saved_path = default_storage.save(file_name, ContentFile(img_data))
                char_profile.face_image = saved_path
                char_profile.face_image_url = default_storage.url(saved_path)
                face_source = char_profile.face_image_url
            except Exception as e:
                logger.warning(f"Failed to persist face image to profile: {e}")

        # Update profile metrics
        char_profile.height_cm = payload.height_cm
        char_profile.body_structure = payload.body_structure
        char_profile.gender_preference = payload.gender_preference
        char_profile.save()

    # 3. Create Audit Log Record
    job_id = uuid.uuid4()
    config = FitCheckConfig.get_solo()

    log_entry = FitCheckLog.objects.create(
        job_id=job_id,
        user=user,
        guest_fingerprint=fp if not user else None,
        product_id=payload.product_id,
        product_name=payload.product_name,
        product_image_url=payload.product_image_url,
        face_image_url=str(face_source)[:500] if face_source else "",
        status='queued',
        body_metrics={
            "height_cm": payload.height_cm,
            "body_structure": payload.body_structure,
            "gender_preference": payload.gender_preference
        },
        provider_used=config.provider
    )

    # Cache initial queued status
    cache.set(f"fitcheck:job:{job_id}", {
        "status": "queued",
        "progress": 10,
        "message": "AI generation job queued in Celery pipeline"
    }, timeout=3600)

    # 4. Enqueue to Celery worker (with synchronous fallback if Celery is not active)
    task_payload = {
        "face_image": face_source,
        "product_image_url": payload.product_image_url,
        "height_cm": payload.height_cm,
        "body_structure": payload.body_structure,
        "gender_preference": payload.gender_preference,
        "product_name": payload.product_name
    }

    try:
        generate_fit_check_task.delay(str(job_id), task_payload)
    except Exception as celery_err:
        logger.warning(f"[Celery] Worker dispatch failed ({celery_err}). Running synchronously.")
        # Synchronous fallback execution ensures local dev and tests complete immediately
        try:
            result = TryOnService.execute_try_on(
                job_id=str(job_id),
                face_source=face_source,
                product_image_url=payload.product_image_url,
                height_cm=payload.height_cm,
                body_structure=payload.body_structure,
                gender_preference=payload.gender_preference,
                product_name=payload.product_name
            )
            log_entry.status = 'completed'
            log_entry.result_image_url = result.get("result_image_url", "")
            log_entry.latency_seconds = result.get("latency_seconds", 0.0)
            log_entry.estimated_cost_usd = result.get("cost_usd", Decimal("0.0"))
            log_entry.provider_used = result.get("provider", "mock_sandbox")
            log_entry.save()

            cache.set(f"fitcheck:job:{job_id}", {
                "status": "completed",
                "progress": 100,
                "result_image_url": log_entry.result_image_url,
                "latency_seconds": log_entry.latency_seconds,
                "provider": log_entry.provider_used
            }, timeout=7200)

            return FitCheckJobResponse(
                job_id=str(job_id),
                status="completed",
                progress=100,
                result_image_url=log_entry.result_image_url,
                latency_seconds=log_entry.latency_seconds,
                provider=log_entry.provider_used,
                message="AI try-on generated successfully"
            )
        except Exception as sync_err:
            log_entry.status = 'failed'
            log_entry.error_message = str(sync_err)
            log_entry.save()
            raise errors.HttpError(500, f"AI generation failed: {sync_err}")

    return FitCheckJobResponse(
        job_id=str(job_id),
        status="queued",
        progress=15,
        message="AI Fit Check queued for processing"
    )


@router.get("/job/{job_id}", response=FitCheckJobResponse)
def get_fit_check_job(request, job_id: str):
    """
    Sub-millisecond status polling endpoint for background Celery generation jobs.
    Reads from Redis cache first, falling back to database.
    """
    cache_key = f"fitcheck:job:{job_id}"
    cached = cache.get(cache_key)
    if cached and isinstance(cached, dict):
        return FitCheckJobResponse(
            job_id=job_id,
            status=cached.get("status", "processing"),
            progress=cached.get("progress", 50),
            result_image_url=cached.get("result_image_url"),
            latency_seconds=cached.get("latency_seconds"),
            provider=cached.get("provider"),
            error=cached.get("error"),
            message=cached.get("message")
        )

    # Database lookup
    log_entry = FitCheckLog.objects.filter(job_id=job_id).first()
    if not log_entry:
        raise errors.HttpError(404, "Job not found")

    return FitCheckJobResponse(
        job_id=str(log_entry.job_id),
        status=log_entry.status,
        progress=100 if log_entry.status == 'completed' else (10 if log_entry.status == 'queued' else 50),
        result_image_url=log_entry.result_image_url,
        latency_seconds=log_entry.latency_seconds,
        provider=log_entry.provider_used,
        error=log_entry.error_message
    )


# =============================================================================
# Registered Customer Character Profile Management
# =============================================================================

@router.get("/profile", auth=BearerAuth(), response=CharacterProfileData)
def get_user_character_profile(request):
    """Fetches the authenticated customer's saved character model profile."""
    user = request.auth
    profile, _ = UserCharacterProfile.objects.get_or_create(user=user)
    face_url = profile.face_image.url if profile.face_image else (profile.face_image_url or "")
    return CharacterProfileData(
        height_cm=profile.height_cm,
        body_structure=profile.body_structure,
        gender_preference=profile.gender_preference,
        face_image_url=face_url,
        updated_at=profile.updated_at.isoformat() if profile.updated_at else None
    )


@router.put("/profile", auth=BearerAuth(), response=CharacterProfileData)
def update_user_character_profile(request, payload: Dict[str, Any]):
    """Updates the customer's permanent character profile and metrics."""
    user = request.auth
    profile, _ = UserCharacterProfile.objects.get_or_create(user=user)

    if "height_cm" in payload:
        profile.height_cm = int(payload["height_cm"])
    if "body_structure" in payload:
        profile.body_structure = str(payload["body_structure"])
    if "gender_preference" in payload:
        profile.gender_preference = str(payload["gender_preference"])

    # If base64 face provided
    face_b64 = payload.get("face_image_base64")
    if face_b64:
        try:
            if "," in face_b64:
                face_b64 = face_b64.split(",", 1)[1]
            img_data = base64.b64decode(face_b64)
            file_name = f"fitcheck/faces/user_{user.id}_{uuid.uuid4().hex[:8]}.jpg"
            saved_path = default_storage.save(file_name, ContentFile(img_data))
            profile.face_image = saved_path
            profile.face_image_url = default_storage.url(saved_path)
        except Exception as e:
            logger.warning(f"Failed to update profile face image: {e}")

    profile.save()
    face_url = profile.face_image.url if profile.face_image else (profile.face_image_url or "")
    return CharacterProfileData(
        height_cm=profile.height_cm,
        body_structure=profile.body_structure,
        gender_preference=profile.gender_preference,
        face_image_url=face_url,
        updated_at=profile.updated_at.isoformat()
    )


# =============================================================================
# Admin Panel Control & Configuration Endpoints
# =============================================================================

@router.get("/admin/config", auth=BearerAuth(), response=FitCheckConfigSchema)
def get_fit_check_config(request):
    """Retrieves AI Virtual Fit Check system configuration and API settings."""
    enforce_permission(request, "fitcheck", "view")
    config = FitCheckConfig.get_solo()

    # Mask API key for security
    masked_key = ""
    if config.api_key:
        masked_key = f"{config.api_key[:4]}••••••••{config.api_key[-4:]}" if len(config.api_key) > 8 else "••••••••"

    return FitCheckConfigSchema(
        provider=config.provider,
        api_key=masked_key,
        api_url=config.api_url,
        model_id=config.model_id,
        mock_mode=config.mock_mode,
        daily_budget_cap_usd=float(config.daily_budget_cap_usd),
        guest_trial_limit=config.guest_trial_limit,
        user_daily_limit=config.user_daily_limit,
        prompt_templates=config.prompt_templates or {},
        is_active=config.is_active,
        updated_at=config.updated_at.isoformat() if config.updated_at else None
    )


@router.post("/admin/config", auth=BearerAuth(), response=FitCheckConfigSchema)
def update_fit_check_config(request, payload: FitCheckConfigUpdateSchema):
    """Updates AI provider configuration, API keys, and sandbox modes."""
    enforce_permission(request, "fitcheck", "edit")
    config = FitCheckConfig.get_solo()

    if payload.provider is not None:
        config.provider = payload.provider
    if payload.api_key is not None and not payload.api_key.startswith("••••") and "••••" not in payload.api_key:
        config.api_key = payload.api_key
    if payload.api_url is not None:
        config.api_url = payload.api_url
    if payload.model_id is not None:
        config.model_id = payload.model_id
    if payload.mock_mode is not None:
        config.mock_mode = payload.mock_mode
    if payload.daily_budget_cap_usd is not None:
        config.daily_budget_cap_usd = Decimal(str(payload.daily_budget_cap_usd))
    if payload.guest_trial_limit is not None:
        config.guest_trial_limit = payload.guest_trial_limit
    if payload.user_daily_limit is not None:
        config.user_daily_limit = payload.user_daily_limit
    if payload.prompt_templates is not None:
        config.prompt_templates = payload.prompt_templates
    if payload.is_active is not None:
        config.is_active = payload.is_active

    config.save()
    return get_fit_check_config(request)


@router.get("/admin/analytics", auth=BearerAuth(), response=FitCheckAnalyticsResponse)
def get_fit_check_analytics(request):
    """Returns analytics for AI try-on volume, body structure preferences, and spend."""
    enforce_permission(request, "fitcheck", "view")

    logs = FitCheckLog.objects.all()
    total = logs.count()
    completed = logs.filter(status='completed').count()
    failed = logs.filter(status='failed').count()
    success_rate = round((completed / total * 100), 1) if total > 0 else 100.0

    spend_data = logs.aggregate(
        total_spend=Sum('estimated_cost_usd'),
        avg_latency=Avg('latency_seconds')
    )

    # Body structure breakdown
    body_counts = {"slim": 0, "athletic": 0, "full_figured": 0, "plus_size": 0}
    for log in logs.order_by('-created_at')[:200]:
        metrics = log.body_metrics or {}
        bs = metrics.get("body_structure", "athletic")
        if bs in body_counts:
            body_counts[bs] += 1
        else:
            body_counts["athletic"] += 1

    # Daily volume over last 7 days
    daily_volume = []
    now = timezone.now().date()
    for i in range(6, -1, -1):
        day = now - timezone.timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        count = FitCheckLog.objects.filter(created_at__date=day).count()
        daily_volume.append({"date": day_str, "count": count})

    return FitCheckAnalyticsResponse(
        total_generations=total,
        completed_generations=completed,
        failed_generations=failed,
        success_rate=success_rate,
        total_spend_usd=float(spend_data.get('total_spend') or 0.0),
        avg_latency_seconds=round(float(spend_data.get('avg_latency') or 0.0), 2),
        body_structure_breakdown=body_counts,
        daily_volume=daily_volume
    )


@router.get("/admin/logs", auth=BearerAuth())
def get_fit_check_logs(
    request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None)
):
    """Returns paginated audit logs of fit check generations."""
    enforce_permission(request, "fitcheck", "view")
    qs = FitCheckLog.objects.all().select_related('user')

    if status:
        qs = qs.filter(status=status)

    total_count = qs.count()
    start = (page - 1) * page_size
    end = start + page_size
    items = qs[start:end]

    results = []
    for item in items:
        results.append({
            "id": str(item.job_id),
            "user": item.user.username if item.user else "Guest",
            "is_guest": item.user is None,
            "guest_fingerprint": item.guest_fingerprint,
            "product_name": item.product_name,
            "product_image_url": item.product_image_url,
            "result_image_url": item.result_image_url,
            "status": item.status,
            "latency_seconds": item.latency_seconds,
            "estimated_cost_usd": float(item.estimated_cost_usd),
            "body_metrics": item.body_metrics,
            "provider_used": item.provider_used,
            "error_message": item.error_message,
            "created_at": item.created_at.isoformat()
        })

    return {
        "items": results,
        "total": total_count,
        "page": page,
        "page_size": page_size
    }


# =============================================================================
# Body Structure & Character Dummy Model Management
# =============================================================================

def serialize_body_structure(structure: BodyStructure) -> BodyStructureSchema:
    img_url = ""
    if structure.dummy_image:
        try:
            img_url = structure.dummy_image.url
        except Exception:
            img_url = structure.dummy_image_url or ""
    else:
        img_url = structure.dummy_image_url or ""

    return BodyStructureSchema(
        id=structure.id,
        code=structure.code,
        name=structure.name,
        description=structure.description or "",
        dummy_image_url=img_url,
        display_order=structure.display_order,
        is_active=structure.is_active,
        created_at=structure.created_at.isoformat() if structure.created_at else None,
        updated_at=structure.updated_at.isoformat() if structure.updated_at else None,
    )


@router.get("/body-structures", response=List[BodyStructureSchema])
def list_active_body_structures(request):
    """
    Public storefront endpoint returning all active body structures
    ordered by display_order. Seeds defaults if none exist.
    """
    if not BodyStructure.objects.exists():
        BodyStructure.seed_defaults()
    structures = BodyStructure.objects.filter(is_active=True).order_by('display_order', 'id')
    return [serialize_body_structure(s) for s in structures]


@router.get("/admin/body-structures", auth=BearerAuth(), response=List[BodyStructureSchema])
def list_admin_body_structures(request):
    """
    Admin endpoint returning all body structures (active & inactive)
    for customization, ordering, and dummy character uploads.
    """
    enforce_permission(request, "fitcheck", "view")
    if not BodyStructure.objects.exists():
        BodyStructure.seed_defaults()
    structures = BodyStructure.objects.all().order_by('display_order', 'id')
    return [serialize_body_structure(s) for s in structures]


@router.post("/admin/body-structures", auth=BearerAuth(), response=BodyStructureSchema)
def create_body_structure(request, payload: BodyStructureCreateSchema):
    """
    Creates a new Body Structure with optional custom dummy image.
    """
    enforce_permission(request, "fitcheck", "edit")
    code = payload.code.strip().lower().replace(" ", "_")
    if BodyStructure.objects.filter(code=code).exists():
        raise errors.HttpError(400, f"Body structure with code '{code}' already exists.")

    structure = BodyStructure.objects.create(
        code=code,
        name=payload.name,
        description=payload.description or "",
        display_order=payload.display_order or 0,
        is_active=payload.is_active if payload.is_active is not None else True,
        dummy_image_url=payload.dummy_image_url or ""
    )

    if payload.dummy_image_base64:
        try:
            b64_content = payload.dummy_image_base64
            if "," in b64_content:
                b64_content = b64_content.split(",", 1)[1]
            img_data = base64.b64decode(b64_content)
            file_name = f"fitcheck/structures/{structure.code}_{uuid.uuid4().hex[:6]}.png"
            saved_path = default_storage.save(file_name, ContentFile(img_data))
            structure.dummy_image = saved_path
            structure.dummy_image_url = default_storage.url(saved_path)
            structure.save()
        except Exception as e:
            logger.warning(f"Failed to save dummy image for structure {code}: {e}")

    return serialize_body_structure(structure)


@router.put("/admin/body-structures/{structure_id}", auth=BearerAuth(), response=BodyStructureSchema)
def update_body_structure(request, structure_id: int, payload: BodyStructureUpdateSchema):
    """
    Updates Body Structure name, descriptor info, ordering, active state,
    and handles uploading or updating the dummy character model image.
    """
    enforce_permission(request, "fitcheck", "edit")
    structure = BodyStructure.objects.filter(id=structure_id).first()
    if not structure:
        raise errors.HttpError(404, "Body structure not found.")

    if payload.name is not None:
        structure.name = payload.name
    if payload.description is not None:
        structure.description = payload.description
    if payload.display_order is not None:
        structure.display_order = payload.display_order
    if payload.is_active is not None:
        structure.is_active = payload.is_active
    if payload.dummy_image_url is not None:
        structure.dummy_image_url = payload.dummy_image_url

    if payload.dummy_image_base64:
        try:
            b64_content = payload.dummy_image_base64
            if "," in b64_content:
                b64_content = b64_content.split(",", 1)[1]
            img_data = base64.b64decode(b64_content)
            file_name = f"fitcheck/structures/{structure.code}_{uuid.uuid4().hex[:6]}.png"
            saved_path = default_storage.save(file_name, ContentFile(img_data))
            structure.dummy_image = saved_path
            structure.dummy_image_url = default_storage.url(saved_path)
        except Exception as e:
            logger.warning(f"Failed to update dummy image for structure {structure.code}: {e}")

    structure.save()
    return serialize_body_structure(structure)


@router.delete("/admin/body-structures/{structure_id}", auth=BearerAuth())
def delete_body_structure(request, structure_id: int):
    """Deletes a Body Structure."""
    enforce_permission(request, "fitcheck", "edit")
    structure = BodyStructure.objects.filter(id=structure_id).first()
    if not structure:
        raise errors.HttpError(404, "Body structure not found.")
    structure.delete()
    return {"success": True, "message": "Body structure deleted successfully."}

