from typing import Optional, Dict, Any, List
from ninja import Schema
from decimal import Decimal


class CharacterProfileData(Schema):
    height_cm: int = 175
    body_structure: str = "athletic"
    gender_preference: str = "unisex"
    face_image_url: Optional[str] = ""
    updated_at: Optional[str] = None


class FitCheckStatusResponse(Schema):
    is_authenticated: bool
    username: Optional[str] = None
    daily_limit: int
    used_today: int
    remaining_today: int
    can_generate: bool
    guest_trial_available: Optional[bool] = None
    has_saved_character: bool
    saved_character: Optional[CharacterProfileData] = None
    gatekeeper_reason: Optional[str] = None
    is_active: bool = True


class FitCheckGeneratePayload(Schema):
    face_image_base64: Optional[str] = None
    face_image_url: Optional[str] = None
    use_saved_character: bool = False
    height_cm: int = 175
    body_structure: str = "athletic"  # slim, athletic, full_figured, plus_size
    gender_preference: str = "unisex"
    product_id: Optional[int] = None
    product_name: str = "PoshPlex Streetwear"
    product_image_url: str = ""
    guest_fingerprint: Optional[str] = None


class FitCheckJobResponse(Schema):
    job_id: str
    status: str
    progress: Optional[int] = 0
    result_image_url: Optional[str] = None
    latency_seconds: Optional[float] = None
    provider: Optional[str] = None
    error: Optional[str] = None
    message: Optional[str] = None


class FitCheckConfigSchema(Schema):
    provider: str
    api_key: str
    api_url: str
    model_id: str
    mock_mode: bool
    daily_budget_cap_usd: float
    guest_trial_limit: int
    user_daily_limit: int
    prompt_templates: Dict[str, Any]
    is_active: bool
    updated_at: Optional[str] = None


class FitCheckConfigUpdateSchema(Schema):
    provider: Optional[str] = None
    api_key: Optional[str] = None
    api_url: Optional[str] = None
    model_id: Optional[str] = None
    mock_mode: Optional[bool] = None
    daily_budget_cap_usd: Optional[float] = None
    guest_trial_limit: Optional[int] = None
    user_daily_limit: Optional[int] = None
    prompt_templates: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class FitCheckAnalyticsResponse(Schema):
    total_generations: int
    completed_generations: int
    failed_generations: int
    success_rate: float
    total_spend_usd: float
    avg_latency_seconds: float
    body_structure_breakdown: Dict[str, int]
    daily_volume: List[Dict[str, Any]]


class BodyStructureSchema(Schema):
    id: int
    code: str
    name: str
    description: str = ""
    dummy_image_url: Optional[str] = ""
    display_order: int = 0
    is_active: bool = True
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class BodyStructureCreateSchema(Schema):
    code: str
    name: str
    description: Optional[str] = ""
    display_order: Optional[int] = 0
    is_active: Optional[bool] = True
    dummy_image_base64: Optional[str] = None
    dummy_image_url: Optional[str] = None


class BodyStructureUpdateSchema(Schema):
    name: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None
    dummy_image_base64: Optional[str] = None
    dummy_image_url: Optional[str] = None

