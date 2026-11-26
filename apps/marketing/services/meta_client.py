import time
import datetime
import logging
import requests
from decimal import Decimal
from typing import Dict, Any, Optional, List
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

def check_account_rate_limit(account_id: str, max_calls_per_hour: int = 200) -> bool:
    """
    Token bucket rate limiter for Meta Marketing API.
    Meta strictly limits API usage to 200 calls/hour per ad account.
    """
    if not account_id:
        return True
    key = f"meta_ratelimit:{account_id}"
    try:
        current_calls = cache.get(key, 0)
        if current_calls >= max_calls_per_hour:
            logger.warning(f"Rate limit exceeded for ad account {account_id}: {current_calls}/{max_calls_per_hour} calls/hr.")
            return False
        if current_calls == 0:
            cache.set(key, 1, timeout=3600)
        else:
            try:
                cache.incr(key)
            except Exception:
                cache.set(key, current_calls + 1, timeout=3600)
        return True
    except Exception as e:
        logger.warning(f"Redis cache check failed: {e}")
        return True

def get_cached_insights(account_id: str, date_range: str) -> Optional[List[Dict[str, Any]]]:
    """Retrieve cached insights using explicit key: meta_insights:{account_id}:{date_range}"""
    key = f"meta_insights:{account_id}:{date_range}"
    try:
        return cache.get(key)
    except Exception:
        return None

def set_cached_insights(account_id: str, date_range: str, data: List[Dict[str, Any]], ttl: int = 900) -> None:
    """Store insights in Redis with 15-minute (900s) TTL using key: meta_insights:{account_id}:{date_range}"""
    key = f"meta_insights:{account_id}:{date_range}"
    try:
        cache.set(key, data, timeout=ttl)
    except Exception as e:
        logger.warning(f"Failed to cache insights under {key}: {e}")

class MetaAPIError(Exception):
    def __init__(self, message: str, code: Optional[int] = None, subcode: Optional[int] = None, response_data: Optional[Dict] = None):
        super().__init__(message)
        self.code = code
        self.subcode = subcode
        self.response_data = response_data or {}

class MetaAPIClient:
    """
    Production-grade HTTP client for Meta Marketing Graph API v21.0.
    Handles token authentication, token bucket rate limiting (200 calls/hr),
    rate limit retries (error 80004 & 17), and local mock emulation.
    """
    GRAPH_API_VERSION = "v21.0"
    BASE_URL = f"https://graph.facebook.com/{GRAPH_API_VERSION}"

    def __init__(self, access_token: str, mock_mode: Optional[bool] = None, account_id: Optional[str] = None):
        self.access_token = access_token
        self.account_id = account_id
        # Enable mock mode if explicitly requested or if set in Django settings or if token is a mock token
        if mock_mode is not None:
            self.mock_mode = mock_mode
        else:
            self.mock_mode = getattr(settings, 'META_API_MOCK', False) or (access_token and access_token.startswith("mock_"))

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _execute_with_retry(self, method: str, endpoint: str, params: Optional[Dict] = None, json_data: Optional[Dict] = None, max_retries: int = 3) -> Dict[str, Any]:
        """
        Executes HTTP request against Graph API with token bucket rate limit enforcement
        and exponential backoff on rate-limit errors.
        Rate Limit Errors:
          - Code 80004: (#80004) There have been too many calls to this ad-account
          - Code 17: User request limit reached
          - Code 32: Page request limit reached
        """
        acc_id = self.account_id
        if not acc_id and "act_" in endpoint:
            for p in endpoint.split("/"):
                if p.startswith("act_"):
                    acc_id = p
                    break

        if acc_id and not self.mock_mode:
            if not check_account_rate_limit(acc_id, max_calls_per_hour=200):
                raise MetaAPIError(f"Token bucket rate limit reached (200 calls/hour) for ad account {acc_id}", code=80004)

        if self.mock_mode:
            return self._mock_response(method, endpoint, params or json_data or {})

        url = f"{self.BASE_URL}/{endpoint.lstrip('/')}"
        delay = 2.0

        for attempt in range(1, max_retries + 1):
            try:
                if method.upper() == 'GET':
                    resp = requests.get(url, headers=self._headers(), params=params, timeout=30)
                elif method.upper() == 'POST':
                    resp = requests.post(url, headers=self._headers(), json=json_data, params=params, timeout=30)
                elif method.upper() == 'DELETE':
                    resp = requests.delete(url, headers=self._headers(), params=params, timeout=30)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")

                data = resp.json()

                if resp.status_code >= 400 or "error" in data:
                    err = data.get("error", {})
                    err_code = err.get("code")
                    err_subcode = err.get("error_subcode")
                    err_msg = err.get("message", "Unknown Meta Graph API error")

                    # Rate limit error codes: 80004, 17, 32
                    if err_code in (80004, 17, 32) and attempt < max_retries:
                        logger.warning(f"Meta Graph API rate limit hit (code {err_code}). Retrying in {delay}s (Attempt {attempt}/{max_retries})...")
                        time.sleep(delay)
                        delay *= 2.5
                        continue

                    raise MetaAPIError(err_msg, code=err_code, subcode=err_subcode, response_data=data)

                return data

            except requests.RequestException as e:
                if attempt == max_retries:
                    raise MetaAPIError(f"Network error communicating with Meta Graph API: {str(e)}")
                time.sleep(delay)
                delay *= 2

        raise MetaAPIError("Exceeded max retries for Meta Graph API")

    def get(self, endpoint: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        return self._execute_with_retry('GET', endpoint, params=params)

    def post(self, endpoint: str, json_data: Optional[Dict] = None, params: Optional[Dict] = None) -> Dict[str, Any]:
        return self._execute_with_retry('POST', endpoint, params=params, json_data=json_data)

    def delete(self, endpoint: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        return self._execute_with_retry('DELETE', endpoint, params=params)

    # --------------------------------------------------------------------------
    # Mock Simulation Engine for Local Development & Testing
    # --------------------------------------------------------------------------
    def _mock_response(self, method: str, endpoint: str, payload: Dict) -> Dict[str, Any]:
        import random
        clean_ep = endpoint.lower()
        now_ts = int(time.time())

        # Campaign creation
        if "campaigns" in clean_ep and method == 'POST':
            return {"id": f"mock_meta_camp_{now_ts}_{random.randint(100, 999)}", "success": True}

        # AdSet creation
        if "adsets" in clean_ep and method == 'POST':
            return {"id": f"mock_meta_adset_{now_ts}_{random.randint(100, 999)}", "success": True}

        # AdCreative creation
        if "adcreatives" in clean_ep and method == 'POST':
            return {"id": f"mock_meta_creative_{now_ts}_{random.randint(100, 999)}", "success": True}

        # Ad creation
        if "ads" in clean_ep and method == 'POST':
            return {"id": f"mock_meta_ad_{now_ts}_{random.randint(100, 999)}", "success": True}

        # Status update or pause/resume
        if method == 'POST':
            return {"success": True}

        # Insights endpoint
        if "insights" in clean_ep:
            spend = round(random.uniform(400.0, 1800.0), 2)
            clicks = random.randint(45, 230)
            impressions = clicks * random.randint(18, 35)
            conversions = max(1, int(clicks * random.uniform(0.02, 0.08)))
            return {
                "data": [{
                    "spend": str(spend),
                    "impressions": str(impressions),
                    "clicks": str(clicks),
                    "actions": [{"action_type": "purchase", "value": str(conversions)}],
                    "cpc": str(round(spend / clicks, 2)),
                    "ctr": str(round((clicks / impressions) * 100, 2)),
                    "date_start": payload.get("since", "2026-10-01"),
                    "date_stop": payload.get("until", "2026-10-23")
                }]
            }

        return {"id": f"mock_{now_ts}", "success": True}


def send_capi_lifecycle_event(
    pixel_id: str,
    access_token: str,
    event_name: str,
    order_id: int,
    order_value: Decimal = Decimal('0.00'),
    phone: Optional[str] = None,
    email: Optional[str] = None,
    fbc: Optional[str] = None,
    fbp: Optional[str] = None,
    client_ip: Optional[str] = None,
    event_time: Optional[Any] = None,
    event_source_url: str = "https://poshplexbd.com"
) -> Dict[str, Any]:
    """
    Dispatches server-side lifecycle events (e.g. OrderConfirmed, OrderDelivered)
    to Meta Conversions API (CAPI) with SHA-256 hashed user data and audit logging.
    Enforces Meta's strict 7-day maximum age window.
    """
    import hashlib
    from django.utils import timezone
    from apps.marketing.models import MetaCapiLog

    if not pixel_id or not access_token:
        logger.info(f"Skipping CAPI lifecycle event {event_name} for #{order_id}: missing pixel_id or access_token.")
        return {"status": "skipped", "reason": "missing_credentials"}

    # Resolve real event occurrence time
    now_ts = int(time.time())
    if event_time:
        if isinstance(event_time, (datetime.datetime, timezone.datetime)):
            unix_event_time = int(event_time.timestamp())
            dt_event_time = event_time
        elif isinstance(event_time, (int, float)):
            unix_event_time = int(event_time)
            dt_event_time = timezone.datetime.fromtimestamp(unix_event_time, tz=timezone.utc)
        else:
            unix_event_time = now_ts
            dt_event_time = timezone.now()
    else:
        unix_event_time = now_ts
        dt_event_time = timezone.now()

    # Meta Hard Rule: Events older than 7 days (604,800 seconds) are rejected and fail the request
    age_seconds = now_ts - unix_event_time
    if age_seconds > 7 * 86400:
        logger.warning(f"Dropping CAPI {event_name} for Order #{order_id}: event age is {age_seconds}s (>7 days max).")
        MetaCapiLog.objects.create(
            order_id=order_id,
            event_name=event_name,
            event_id=f"posh_order_{order_id}_{event_name.lower()}",
            event_time=dt_event_time,
            status='SKIPPED_AGE',
            error_message=f"Event is {age_seconds}s old, exceeding Meta 7-day Conversions API limit."
        )
        return {"status": "skipped", "reason": "event_older_than_7_days"}

    user_data: Dict[str, Any] = {}
    if phone:
        digits = ''.join(filter(str.isdigit, str(phone)))
        if digits.startswith("0"):
            digits = "88" + digits
        elif not digits.startswith("88") and len(digits) == 10:
            digits = "880" + digits
        user_data["ph"] = [hashlib.sha256(digits.encode('utf-8')).hexdigest()]

    if email:
        clean_email = email.strip().lower()
        user_data["em"] = [hashlib.sha256(clean_email.encode('utf-8')).hexdigest()]

    if fbc:
        user_data["fbc"] = fbc.strip()
    if fbp:
        user_data["fbp"] = fbp.strip()

    # Pass client_ip_address unhashed only if it is a valid non-dummy public IP
    if client_ip:
        clean_ip = str(client_ip).strip().replace('::ffff:', '')
        if clean_ip not in ('0.0.0.0', '127.0.0.1', '1.2.3.4') and not clean_ip.startswith(('10.', '192.168.', '172.', '127.')):
            user_data["client_ip_address"] = clean_ip

    custom_event_id = f"posh_order_{order_id}_{event_name.lower()}"
    event_payload = {
        "event_name": event_name,
        "event_time": unix_event_time,
        "event_id": custom_event_id,
        "event_source_url": event_source_url,
        "action_source": "website",
        "user_data": user_data,
        "custom_data": {
            "currency": "BDT",
            "value": float(order_value),
            "order_id": str(order_id)
        }
    }

    url = f"https://graph.facebook.com/v21.0/{pixel_id}/events"
    try:
        resp = requests.post(
            url,
            params={"access_token": access_token},
            json={"data": [event_payload]},
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        data = resp.json()
        http_code = resp.status_code
        status_label = 'SUCCESS' if http_code == 200 and not data.get('error') else 'FAILED'
        err_msg = str(data.get('error', ''))

        # Audit log in MetaCapiLog
        MetaCapiLog.objects.create(
            order_id=order_id,
            event_name=event_name,
            event_id=custom_event_id,
            event_time=dt_event_time,
            status=status_label,
            http_status=http_code,
            payload=event_payload,
            response=data,
            error_message=err_msg
        )
        logger.info(f"Meta CAPI {event_name} dispatched for Order #{order_id} [{status_label}]: {data}")
        return data
    except Exception as e:
        logger.warning(f"Failed to dispatch Meta CAPI {event_name} for Order #{order_id}: {e}")
        MetaCapiLog.objects.create(
            order_id=order_id,
            event_name=event_name,
            event_id=custom_event_id,
            event_time=dt_event_time,
            status='FAILED',
            error_message=str(e)
        )
        return {"status": "error", "error": str(e)}

