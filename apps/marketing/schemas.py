from typing import List, Optional, Dict, Any
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator
from ninja import Schema

# ============================================================================
# AD ACCOUNT SCHEMAS
# ============================================================================

class MetaAdAccountConnectSchema(Schema):
    meta_account_id: str = Field(..., description="e.g. act_1234567890")
    name: str
    access_token: str
    currency: Optional[str] = "USD"
    timezone: Optional[str] = "Asia/Dhaka"
    daily_spend_cap: Optional[Decimal] = Decimal('0.00')

class MetaAdAccountResponseSchema(Schema):
    id: int
    meta_account_id: str
    name: str
    currency: str
    timezone: str
    daily_spend_cap: Decimal = Decimal('0.00')
    is_active: bool
    last_synced_at: Optional[Any] = None
    created_at: Any


# ============================================================================
# CREATIVE & ADSET INPUT/OUTPUT SCHEMAS
# ============================================================================

class TargetingSchema(Schema):
    age_min: int = Field(18, ge=13, le=65)
    age_max: int = Field(45, ge=13, le=65)
    genders: List[int] = [1, 2]  # 1=Male, 2=Female
    countries: List[str] = ["BD"]
    interests: List[str] = []
    placements: List[str] = ["facebook_feed", "instagram_feed"]

    @field_validator('age_max')
    @classmethod
    def validate_age_range(cls, v, info):
        age_min = info.data.get('age_min', 18)
        if v < age_min:
            raise ValueError('age_max must be greater than or equal to age_min')
        return v

class CreativeInputSchema(Schema):
    name: str
    headline: str
    primary_text: str
    description: Optional[str] = ""
    call_to_action: Optional[str] = "SHOP_NOW"
    image_url: Optional[str] = ""
    video_url: Optional[str] = ""

    @field_validator('headline')
    @classmethod
    def validate_headline_length(cls, v: str) -> str:
        if len(v) > 40:
            raise ValueError(f"Headline exceeds Meta limit of 40 characters (got {len(v)} chars): '{v}'")
        return v

    @field_validator('primary_text')
    @classmethod
    def validate_primary_text_length(cls, v: str) -> str:
        if len(v) > 125:
            raise ValueError(f"Primary text exceeds 125 characters optimal feed limit (got {len(v)} chars)")
        return v

class CreativeResponseSchema(Schema):
    id: int
    name: str
    headline: str
    primary_text: str
    description: Optional[str] = None
    call_to_action: str
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    meta_creative_id: Optional[str] = None
    meta_ad_id: Optional[str] = None

class AdSetInputSchema(Schema):
    name: str
    targeting: TargetingSchema
    daily_budget: Optional[Decimal] = None
    bid_strategy: Optional[str] = "LOWEST_COST_WITHOUT_CAP"
    creatives: List[CreativeInputSchema] = []

class AdSetResponseSchema(Schema):
    id: int
    name: str
    targeting: Dict[str, Any]
    bid_strategy: str
    daily_budget: Optional[Decimal] = None
    meta_adset_id: Optional[str] = None
    creatives: List[CreativeResponseSchema] = []


# ============================================================================
# CAMPAIGN SCHEMAS
# ============================================================================

class CampaignCreateSchema(Schema):
    ad_account_id: int
    name: str
    objective: str = "SALES"
    budget_type: str = "DAILY"
    budget_amount: Decimal = Field(..., gt=0)
    max_budget_cap: Optional[Decimal] = Decimal('0.00')
    currency: Optional[str] = None
    is_first_time_test: Optional[bool] = True
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    linked_product_id: Optional[int] = None
    targeting: Optional[TargetingSchema] = None
    creative: Optional[CreativeInputSchema] = None

class CampaignUpdateSchema(Schema):
    name: Optional[str] = None
    objective: Optional[str] = None
    budget_type: Optional[str] = None
    budget_amount: Optional[Decimal] = Field(None, gt=0)
    max_budget_cap: Optional[Decimal] = None
    is_first_time_test: Optional[bool] = None
    linked_product_id: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class CampaignScaleSchema(Schema):
    percentage: Optional[float] = 20.0
    new_budget: Optional[Decimal] = None

class CampaignResponseSchema(Schema):
    id: int
    ad_account_id: int
    name: str
    objective: str
    status: str
    budget_type: str
    budget_amount: Decimal
    max_budget_cap: Decimal = Decimal('0.00')
    is_first_time_test: bool = True
    currency: str = "USD"
    meta_campaign_id: Optional[str] = None
    linked_product_id: Optional[int] = None
    linked_product_name: Optional[str] = None
    linked_product_image: Optional[str] = None
    start_date: Optional[Any] = None
    end_date: Optional[Any] = None
    last_error: Optional[str] = None
    created_at: Any
    adsets: List[AdSetResponseSchema] = []
    # Realtime analytics rollup
    total_spend: Decimal = Decimal('0.00')
    total_revenue: Decimal = Decimal('0.00')
    roas: float = 0.0


# ============================================================================
# ANALYTICS & TIME SERIES SCHEMAS
# ============================================================================

class AnalyticsOverviewSchema(Schema):
    total_spend: Decimal
    total_revenue: Decimal
    blended_roas: float
    conversions: int
    total_clicks: int
    total_impressions: int
    average_cpc: Decimal
    average_ctr: float

class TimeseriesDataPointSchema(Schema):
    date: str
    spend: float
    revenue: float
    roas: float
    clicks: int
    conversions: int

class ProductAttributionSchema(Schema):
    product_id: int
    product_name: str
    product_sku: Optional[str] = None
    campaign_count: int
    spend: Decimal
    revenue: Decimal
    roas: float
    conversions: int


# ============================================================================
# AUTOMATION RULES SCHEMAS
# ============================================================================

class AutomationRuleInputSchema(Schema):
    campaign_id: Optional[int] = None
    name: str
    condition_type: str
    threshold_value: Decimal
    action: str
    is_active: Optional[bool] = True
    cooldown_hours: Optional[int] = 6

class AutomationRuleResponseSchema(Schema):
    id: int
    campaign_id: Optional[int] = None
    campaign_name: Optional[str] = None
    name: str
    condition_type: str
    threshold_value: Decimal
    action: str
    is_active: bool
    cooldown_hours: int
    last_triggered_at: Optional[Any] = None
    last_trigger_log: Optional[str] = None
    created_at: Any


# ============================================================================
# AI ASSISTANT SCHEMAS
# ============================================================================

class AICopyRequestSchema(Schema):
    product_id: Optional[int] = None
    angle: Optional[str] = "hype"
    custom_prompt: Optional[str] = ""
    premium_rewrite: Optional[bool] = False
    batch_all_angles: Optional[bool] = False

class AICopyResponseSchema(Schema):
    angle: str
    product_name: str
    headlines: List[str]
    primary_texts: List[str]
    description: str
    call_to_action: str
    recommended_targeting: Dict[str, Any]

    @field_validator('headlines')
    @classmethod
    def validate_headlines(cls, v: List[str]) -> List[str]:
        validated = []
        for h in v:
            if len(h) > 40:
                validated.append(h[:37].strip() + "...")
            else:
                validated.append(h)
        return validated

    @field_validator('primary_texts')
    @classmethod
    def validate_primary_texts(cls, v: List[str]) -> List[str]:
        validated = []
        for p in v:
            if len(p) > 125:
                validated.append(p[:122].strip() + "...")
            else:
                validated.append(p)
        return validated

class AICampaignAdviceSchema(Schema):
    status: str
    health_score: int
    summary: str
    recommendations: List[str]
    metrics_summary: Optional[Dict[str, Any]] = None


# ============================================================================
# META AGENT v4 SCHEMAS
# ============================================================================

class AgentToggleModeSchema(Schema):
    mode: str = "SUGGEST"  # SUGGEST or AUTO
    is_enabled: Optional[bool] = None
    agent_daily_budget: Optional[Decimal] = None

class AgentChatRequestSchema(Schema):
    message: str

class AgentActionLogResponseSchema(Schema):
    id: int
    created_at: Any
    agent_cycle_id: str
    reasoning_text: str
    tool_name: str
    campaign_id: Optional[int] = None
    campaign_name: Optional[str] = None
    action_taken: str
    outcome: str
    cost_impact: Decimal
    status: str
    tool_params: Dict[str, Any] = {}

class AgentStatusResponseSchema(Schema):
    mode: str
    is_enabled: bool
    auto_pause_enabled: bool
    agent_daily_budget: float
    spent_today_bdt: float = 0.0
    remaining_budget_bdt: float = 0.0
    spent_today_usd: float = 0.0
    remaining_budget_usd: float = 0.0
    today_actions_count: int
    pending_approval_count: int
    recent_cycle_id: Optional[str] = None

