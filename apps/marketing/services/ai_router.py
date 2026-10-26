import time
import logging
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from django.utils import timezone
from django.conf import settings
from apps.marketing.models import AIProviderConfig, AIOperationRoute

logger = logging.getLogger(__name__)

DEFAULT_MODELS = {
    'OPENAI': 'gpt-4o-mini',
    'GEMINI': 'gemini-2.0-flash',
    'ANTHROPIC': 'claude-3-5-sonnet-20241022',
    'DEEPSEEK': 'deepseek-chat',
    'GROQ': 'llama-3.3-70b-versatile',
    'CUSTOM': 'gpt-4o-mini',
}

DEFAULT_BASE_URLS = {
    'OPENAI': 'https://api.openai.com/v1',
    'GEMINI': 'https://generativelanguage.googleapis.com/v1beta/openai/',
    'DEEPSEEK': 'https://api.deepseek.com',
    'GROQ': 'https://api.groq.com/openai/v1',
    'ANTHROPIC': 'https://api.anthropic.com/v1',
}

# Standard estimated cost per 1k tokens (USD)
ESTIMATED_COST_PER_1K = {
    'gpt-4o-mini': Decimal('0.00035'),
    'gpt-4o': Decimal('0.00500'),
    'gemini-2.0-flash': Decimal('0.00020'),
    'gemini-1.5-pro': Decimal('0.00250'),
    'claude-3-5-sonnet-20241022': Decimal('0.00600'),
    'claude-3-haiku-20240307': Decimal('0.00050'),
    'deepseek-chat': Decimal('0.00028'),
    'llama-3.3-70b-versatile': Decimal('0.00060'),
}


def ensure_default_operation_routes():
    """
    Ensures all 4 core Meta Engine operations are present in AIOperationRoute.
    """
    default_routes = [
        {
            'operation': 'AD_COPY',
            'model_name': 'gpt-4o-mini',
            'temperature': 0.7,
            'max_tokens': 600,
        },
        {
            'operation': 'COMPETITOR_SPY',
            'model_name': 'gpt-4o-mini',
            'temperature': 0.3,
            'max_tokens': 800,
        },
        {
            'operation': 'AGENT_BRAIN',
            'model_name': 'gpt-4o-mini',
            'temperature': 0.3,
            'max_tokens': 900,
        },
        {
            'operation': 'PRODUCT_RESEARCH',
            'model_name': 'gpt-4o-mini',
            'temperature': 0.4,
            'max_tokens': 700,
        },
        {
            'operation': 'DEFAULT',
            'model_name': 'gpt-4o-mini',
            'temperature': 0.3,
            'max_tokens': 800,
        },
    ]

    # Find first active provider if any exists
    primary_provider = AIProviderConfig.objects.filter(is_active=True).first()

    for item in default_routes:
        AIOperationRoute.objects.get_or_create(
            operation=item['operation'],
            defaults={
                'provider': primary_provider,
                'model_name': item['model_name'],
                'temperature': item['temperature'],
                'max_tokens': item['max_tokens'],
                'is_enabled': True,
            }
        )


def get_ai_route_for_operation(operation: str) -> Optional[AIOperationRoute]:
    """
    Returns the configured routing rule for a given operation.
    Falls back to 'DEFAULT' if the specific operation is not mapped.
    """
    ensure_default_operation_routes()
    route = AIOperationRoute.objects.filter(operation=operation, is_enabled=True).select_related('provider').first()
    if not route or not route.provider:
        route = AIOperationRoute.objects.filter(operation='DEFAULT', is_enabled=True).select_related('provider').first()
    return route


def test_provider_connection(provider: AIProviderConfig) -> Dict[str, Any]:
    """
    Sends a test request to verify API key validity and network latency.
    """
    start_time = time.time()
    try:
        api_key = provider.get_api_key()
        if not api_key:
            raise ValueError("No API key configured for provider.")

        provider_type = provider.provider_type
        base_url = provider.base_url or DEFAULT_BASE_URLS.get(provider_type, 'https://api.openai.com/v1')

        # Test using OpenAI client protocol (supported by OpenAI, Gemini, DeepSeek, Groq, Custom)
        if provider_type in ['OPENAI', 'GEMINI', 'DEEPSEEK', 'GROQ', 'CUSTOM']:
            from openai import OpenAI
            client = OpenAI(api_key=api_key, base_url=base_url)
            model = provider.default_model or DEFAULT_MODELS.get(provider_type, 'gpt-4o-mini')

            # Minimal ping completion
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": "Ping. Respond with 'OK'."}],
                max_tokens=5,
            )
            elapsed_ms = int((time.time() - start_time) * 1000)

            provider.last_tested_at = timezone.now()
            provider.last_test_status = 'SUCCESS'
            provider.last_latency_ms = elapsed_ms
            provider.last_error = ''
            provider.save(update_fields=['last_tested_at', 'last_test_status', 'last_latency_ms', 'last_error', 'updated_at'])

            return {
                "success": True,
                "latency_ms": elapsed_ms,
                "model": model,
                "reply": response.choices[0].message.content.strip(),
                "message": f"Successfully connected to {provider.name} in {elapsed_ms}ms"
            }

        elif provider_type == 'ANTHROPIC':
            import requests
            headers = {
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
            payload = {
                "model": provider.default_model or "claude-3-haiku-20240307",
                "max_tokens": 5,
                "messages": [{"role": "user", "content": "Ping"}]
            }
            res = requests.post("https://api.anthropic.com/v1/messages", json=payload, headers=headers, timeout=10)
            elapsed_ms = int((time.time() - start_time) * 1000)

            if res.status_code == 200:
                provider.last_tested_at = timezone.now()
                provider.last_test_status = 'SUCCESS'
                provider.last_latency_ms = elapsed_ms
                provider.last_error = ''
                provider.save(update_fields=['last_tested_at', 'last_test_status', 'last_latency_ms', 'last_error', 'updated_at'])
                return {
                    "success": True,
                    "latency_ms": elapsed_ms,
                    "message": f"Successfully connected to Anthropic in {elapsed_ms}ms"
                }
            else:
                raise ValueError(f"Anthropic returned status {res.status_code}: {res.text}")

        else:
            raise ValueError(f"Unsupported provider type: {provider_type}")

    except Exception as e:
        elapsed_ms = int((time.time() - start_time) * 1000)
        err_msg = str(e)
        logger.warning(f"Connection test failed for provider '{provider.name}': {err_msg}")

        provider.last_tested_at = timezone.now()
        provider.last_test_status = 'FAILED'
        provider.last_latency_ms = elapsed_ms
        provider.last_error = err_msg[:500]
        provider.save(update_fields=['last_tested_at', 'last_test_status', 'last_latency_ms', 'last_error', 'updated_at'])

        return {
            "success": False,
            "latency_ms": elapsed_ms,
            "error": err_msg,
            "message": f"Connection test failed: {err_msg}"
        }


def call_ai_for_operation(
    operation: str,
    messages: List[Dict[str, str]],
    json_mode: bool = False,
    override_model: Optional[str] = None,
    override_temperature: Optional[float] = None
) -> Dict[str, Any]:
    """
    Main dispatch engine: Resolves the active AI provider assigned to this operation,
    invokes the API, tracks token usage and cost, and records audit metrics.
    """
    route = get_ai_route_for_operation(operation)

    # If no provider assigned, fallback to environment key if available
    api_key = None
    base_url = 'https://api.openai.com/v1'
    provider = None
    provider_type = 'OPENAI'
    model_name = override_model or 'gpt-4o-mini'
    temp = override_temperature or 0.3
    max_tokens = 800

    if route and route.provider and route.provider.is_active:
        provider = route.provider
        api_key = provider.get_api_key()
        provider_type = provider.provider_type
        base_url = provider.base_url or DEFAULT_BASE_URLS.get(provider_type, 'https://api.openai.com/v1')
        model_name = override_model or route.model_name or provider.default_model
        temp = override_temperature if override_temperature is not None else route.temperature
        max_tokens = route.max_tokens

    if not api_key:
        api_key = getattr(settings, 'OPENAI_API_KEY', '') or getattr(settings, 'AI_ENGINE_KEY', '')

    if not api_key:
        raise ValueError(f"No active AI Provider or API Key configured for operation '{operation}'. Please configure one in Meta Engine -> API Integration.")

    # Execution via OpenAI protocol
    from openai import OpenAI
    client = OpenAI(api_key=api_key, base_url=base_url)

    kwargs: Dict[str, Any] = {
        "model": model_name,
        "messages": messages,
        "temperature": temp,
        "max_tokens": max_tokens,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    start_time = time.time()
    response = client.chat.completions.create(**kwargs)
    elapsed_ms = int((time.time() - start_time) * 1000)

    content = response.choices[0].message.content or ""
    usage = response.usage
    total_tokens = usage.total_tokens if usage else 250

    # Calculate estimated cost
    rate = ESTIMATED_COST_PER_1K.get(model_name, Decimal('0.00035'))
    cost_usd = (Decimal(str(total_tokens)) / Decimal('1000.0')) * rate

    # Update Provider & Route Statistics
    if provider:
        provider.total_calls += 1
        provider.total_tokens_used += total_tokens
        provider.total_cost_usd += cost_usd
        provider.save(update_fields=['total_calls', 'total_tokens_used', 'total_cost_usd', 'updated_at'])

    if route:
        route.total_calls += 1
        route.total_tokens_used += total_tokens
        route.total_cost_usd += cost_usd
        route.save(update_fields=['total_calls', 'total_tokens_used', 'total_cost_usd', 'updated_at'])

    return {
        "content": content,
        "model_used": model_name,
        "provider_name": provider.name if provider else "Env Fallback",
        "tokens_used": total_tokens,
        "cost_usd": float(cost_usd),
        "latency_ms": elapsed_ms,
    }
