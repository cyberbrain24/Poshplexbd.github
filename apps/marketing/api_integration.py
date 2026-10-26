import logging
from typing import List, Optional
from ninja import Router, Schema
from ninja.errors import HttpError
from django.shortcuts import get_object_or_404
from django.db.models import Sum
from apps.marketing.models import AIProviderConfig, AIOperationRoute
from apps.marketing.services.ai_router import (
    ensure_default_operation_routes,
    test_provider_connection,
    DEFAULT_MODELS,
    DEFAULT_BASE_URLS
)
from apps.core.api import BearerAuth, enforce_permission

logger = logging.getLogger(__name__)

router = Router(tags=["Meta Engine AI & API Integration"])

# --- Schemas ---

class AIProviderCreateSchema(Schema):
    name: str
    provider_type: str  # OPENAI, GEMINI, ANTHROPIC, DEEPSEEK, GROQ, CUSTOM
    api_key: str
    base_url: Optional[str] = ""
    default_model: Optional[str] = ""
    is_active: Optional[bool] = True
    test_now: Optional[bool] = False

class AIProviderUpdateSchema(Schema):
    name: Optional[str] = None
    provider_type: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    default_model: Optional[str] = None
    is_active: Optional[bool] = None

class AIProviderResponseSchema(Schema):
    id: int
    name: str
    provider_type: str
    masked_key: str
    base_url: str
    default_model: str
    is_active: bool
    total_calls: int
    total_tokens_used: int
    total_cost_usd: float
    last_tested_at: Optional[str] = None
    last_test_status: str
    last_latency_ms: int
    last_error: str

class AIOperationRouteResponseSchema(Schema):
    id: int
    operation: str
    operation_label: str
    provider_id: Optional[int] = None
    provider_name: Optional[str] = None
    provider_type: Optional[str] = None
    model_name: str
    temperature: float
    max_tokens: int
    is_enabled: bool
    total_calls: int
    total_tokens_used: int
    total_cost_usd: float

class AIOperationRouteUpdateSchema(Schema):
    provider_id: Optional[int] = None
    model_name: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    is_enabled: Optional[bool] = None


# --- Endpoints ---

@router.get("/providers", response=List[AIProviderResponseSchema], auth=BearerAuth())
def list_providers(request):
    """Lists all configured AI API Providers with masked keys and health status."""
    enforce_permission(request, "marketing", "view")
    providers = AIProviderConfig.objects.all().order_by('-is_active', 'name')
    return [
        {
            "id": p.id,
            "name": p.name,
            "provider_type": p.provider_type,
            "masked_key": p.masked_key,
            "base_url": p.base_url or DEFAULT_BASE_URLS.get(p.provider_type, ""),
            "default_model": p.default_model,
            "is_active": p.is_active,
            "total_calls": p.total_calls,
            "total_tokens_used": p.total_tokens_used,
            "total_cost_usd": float(p.total_cost_usd),
            "last_tested_at": p.last_tested_at.strftime("%Y-%m-%d %H:%M") if p.last_tested_at else None,
            "last_test_status": p.last_test_status,
            "last_latency_ms": p.last_latency_ms,
            "last_error": p.last_error or "",
        }
        for p in providers
    ]


@router.post("/providers", response=AIProviderResponseSchema, auth=BearerAuth())
def create_provider(request, payload: AIProviderCreateSchema):
    """Registers a new AI API Provider with Fernet encrypted key."""
    enforce_permission(request, "marketing", "edit")
    
    default_model = payload.default_model or DEFAULT_MODELS.get(payload.provider_type, 'gpt-4o-mini')
    base_url = payload.base_url or DEFAULT_BASE_URLS.get(payload.provider_type, '')

    provider = AIProviderConfig(
        name=payload.name,
        provider_type=payload.provider_type,
        base_url=base_url,
        default_model=default_model,
        is_active=payload.is_active if payload.is_active is not None else True,
    )
    provider.set_api_key(payload.api_key)
    provider.save()

    # If test_now requested, ping the API
    if payload.test_now:
        test_provider_connection(provider)
        provider.refresh_from_db()

    # Automatically map to DEFAULT route if no provider is currently assigned
    ensure_default_operation_routes()
    unassigned_routes = AIOperationRoute.objects.filter(provider__isnull=True)
    if unassigned_routes.exists():
        unassigned_routes.update(provider=provider)

    return {
        "id": provider.id,
        "name": provider.name,
        "provider_type": provider.provider_type,
        "masked_key": provider.masked_key,
        "base_url": provider.base_url,
        "default_model": provider.default_model,
        "is_active": provider.is_active,
        "total_calls": provider.total_calls,
        "total_tokens_used": provider.total_tokens_used,
        "total_cost_usd": float(provider.total_cost_usd),
        "last_tested_at": provider.last_tested_at.strftime("%Y-%m-%d %H:%M") if provider.last_tested_at else None,
        "last_test_status": provider.last_test_status,
        "last_latency_ms": provider.last_latency_ms,
        "last_error": provider.last_error or "",
    }


@router.put("/providers/{provider_id}", response=AIProviderResponseSchema, auth=BearerAuth())
def update_provider(request, provider_id: int, payload: AIProviderUpdateSchema):
    """Updates AI Provider details or rotates the API key."""
    enforce_permission(request, "marketing", "edit")
    provider = get_object_or_404(AIProviderConfig, id=provider_id)

    if payload.name:
        provider.name = payload.name
    if payload.provider_type:
        provider.provider_type = payload.provider_type
    if payload.base_url is not None:
        provider.base_url = payload.base_url
    if payload.default_model:
        provider.default_model = payload.default_model
    if payload.is_active is not None:
        provider.is_active = payload.is_active
    if payload.api_key:
        provider.set_api_key(payload.api_key)

    provider.save()
    return {
        "id": provider.id,
        "name": provider.name,
        "provider_type": provider.provider_type,
        "masked_key": provider.masked_key,
        "base_url": provider.base_url,
        "default_model": provider.default_model,
        "is_active": provider.is_active,
        "total_calls": provider.total_calls,
        "total_tokens_used": provider.total_tokens_used,
        "total_cost_usd": float(provider.total_cost_usd),
        "last_tested_at": provider.last_tested_at.strftime("%Y-%m-%d %H:%M") if provider.last_tested_at else None,
        "last_test_status": provider.last_test_status,
        "last_latency_ms": provider.last_latency_ms,
        "last_error": provider.last_error or "",
    }


@router.delete("/providers/{provider_id}", auth=BearerAuth())
def delete_provider(request, provider_id: int):
    """Deletes an AI Provider configuration."""
    enforce_permission(request, "marketing", "edit")
    provider = get_object_or_404(AIProviderConfig, id=provider_id)
    provider.delete()
    return {"success": True, "message": f"Provider #{provider_id} deleted."}


@router.post("/providers/{provider_id}/test", auth=BearerAuth())
def test_provider(request, provider_id: int):
    """Tests live connection to AI Provider and returns latency in milliseconds."""
    enforce_permission(request, "marketing", "view")
    provider = get_object_or_404(AIProviderConfig, id=provider_id)
    result = test_provider_connection(provider)
    return result


@router.get("/routes", response=List[AIOperationRouteResponseSchema], auth=BearerAuth())
def list_routes(request):
    """Lists all Operation-to-Provider routing configurations."""
    enforce_permission(request, "marketing", "view")
    ensure_default_operation_routes()
    routes = AIOperationRoute.objects.all().select_related('provider').order_by('operation')
    return [
        {
            "id": r.id,
            "operation": r.operation,
            "operation_label": r.get_operation_display(),
            "provider_id": r.provider_id,
            "provider_name": r.provider.name if r.provider else "None (Fallback)",
            "provider_type": r.provider.provider_type if r.provider else "DEFAULT",
            "model_name": r.model_name,
            "temperature": r.temperature,
            "max_tokens": r.max_tokens,
            "is_enabled": r.is_enabled,
            "total_calls": r.total_calls,
            "total_tokens_used": r.total_tokens_used,
            "total_cost_usd": float(r.total_cost_usd),
        }
        for r in routes
    ]


@router.put("/routes/{operation}", response=AIOperationRouteResponseSchema, auth=BearerAuth())
def update_route(request, operation: str, payload: AIOperationRouteUpdateSchema):
    """Assigns an AI Provider and Model parameters to a specific operation."""
    enforce_permission(request, "marketing", "edit")
    ensure_default_operation_routes()
    route = get_object_or_404(AIOperationRoute, operation=operation)

    if payload.provider_id is not None:
        if payload.provider_id == 0 or payload.provider_id == -1:
            route.provider = None
        else:
            provider = get_object_or_404(AIProviderConfig, id=payload.provider_id)
            route.provider = provider
    if payload.model_name:
        route.model_name = payload.model_name
    if payload.temperature is not None:
        route.temperature = payload.temperature
    if payload.max_tokens is not None:
        route.max_tokens = payload.max_tokens
    if payload.is_enabled is not None:
        route.is_enabled = payload.is_enabled

    route.save()
    return {
        "id": route.id,
        "operation": route.operation,
        "operation_label": route.get_operation_display(),
        "provider_id": route.provider_id,
        "provider_name": route.provider.name if route.provider else "None (Fallback)",
        "provider_type": route.provider.provider_type if route.provider else "DEFAULT",
        "model_name": route.model_name,
        "temperature": route.temperature,
        "max_tokens": route.max_tokens,
        "is_enabled": route.is_enabled,
        "total_calls": route.total_calls,
        "total_tokens_used": route.total_tokens_used,
        "total_cost_usd": float(route.total_cost_usd),
    }


@router.get("/stats", auth=BearerAuth())
def get_ai_stats(request):
    """Returns global token consumption and estimated AI spend across operations."""
    enforce_permission(request, "marketing", "view")
    ensure_default_operation_routes()

    prov_agg = AIProviderConfig.objects.aggregate(
        calls=Sum('total_calls'),
        tokens=Sum('total_tokens_used'),
        cost=Sum('total_cost_usd')
    )

    total_providers = AIProviderConfig.objects.count()
    active_providers = AIProviderConfig.objects.filter(is_active=True).count()
    active_routes = AIOperationRoute.objects.filter(is_enabled=True, provider__isnull=False).count()

    return {
        "total_providers": total_providers,
        "active_providers": active_providers,
        "active_routes": active_routes,
        "total_calls": prov_agg.get('calls') or 0,
        "total_tokens_used": prov_agg.get('tokens') or 0,
        "total_cost_usd": float(prov_agg.get('cost') or 0.0),
    }
