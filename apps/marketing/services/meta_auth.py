import urllib.parse
import requests
from typing import Dict, Any, Tuple
from django.utils import timezone
import datetime

GRAPH_API_VERSION = "v21.0"
META_OAUTH_DIALOG_URL = f"https://www.facebook.com/{GRAPH_API_VERSION}/dialog/oauth"
META_OAUTH_ACCESS_TOKEN_URL = f"https://graph.facebook.com/{GRAPH_API_VERSION}/oauth/access_token"

def get_auth_url(client_id: str, redirect_uri: str, state: str = "") -> str:
    """
    Generate the Meta OAuth 2.0 login URL for authorizing the Marketing API.
    Permissions requested: ads_management, ads_read, business_management
    """
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "state": state,
        "scope": "ads_management,ads_read,business_management",
        "response_type": "code",
    }
    return f"{META_OAUTH_DIALOG_URL}?{urllib.parse.urlencode(params)}"

def exchange_code_for_token(code: str, client_id: str, client_secret: str, redirect_uri: str) -> Dict[str, Any]:
    """
    Exchange the authorization code returned by Meta for a short-lived user access token.
    """
    params = {
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "code": code,
    }
    resp = requests.get(META_OAUTH_ACCESS_TOKEN_URL, params=params, timeout=20)
    data = resp.json()
    if resp.status_code >= 400 or "error" in data:
        error_msg = data.get("error", {}).get("message", "Failed to exchange OAuth code")
        raise ValueError(error_msg)
    return data

def get_long_lived_token(short_token: str, client_id: str, client_secret: str) -> Tuple[str, datetime.datetime]:
    """
    Exchange a short-lived token (valid for ~2 hours) for a long-lived 60-day token.
    Returns (long_lived_access_token, expiration_datetime).
    """
    params = {
        "grant_type": "fb_exchange_token",
        "client_id": client_id,
        "client_secret": client_secret,
        "fb_exchange_token": short_token,
    }
    resp = requests.get(META_OAUTH_ACCESS_TOKEN_URL, params=params, timeout=20)
    data = resp.json()
    if resp.status_code >= 400 or "error" in data:
        error_msg = data.get("error", {}).get("message", "Failed to get long-lived token")
        raise ValueError(error_msg)

    token = data["access_token"]
    expires_in_seconds = data.get("expires_in", 60 * 24 * 3600)  # default 60 days
    expires_at = timezone.now() + datetime.timedelta(seconds=expires_in_seconds)
    return token, expires_at

def refresh_long_lived_token(current_token: str, client_id: str = "", client_secret: str = "") -> Tuple[str, datetime.datetime]:
    """
    Refreshes an expiring long-lived token via Meta Graph API fb_exchange_token endpoint.
    Meta allows refreshing a long-lived user token as long as it hasn't expired yet.
    Returns (refreshed_access_token, new_expiration_datetime).
    """
    from django.conf import settings
    c_id = client_id or getattr(settings, 'META_APP_ID', '')
    c_sec = client_secret or getattr(settings, 'META_APP_SECRET', '')

    # Support Mock mode
    if getattr(settings, 'META_API_MOCK', False) or (current_token and current_token.startswith("mock_")) or not c_sec:
        new_expires_at = timezone.now() + datetime.timedelta(days=60)
        return f"{current_token}_refreshed", new_expires_at

    params = {
        "grant_type": "fb_exchange_token",
        "client_id": c_id,
        "client_secret": c_sec,
        "fb_exchange_token": current_token,
    }
    resp = requests.get(META_OAUTH_ACCESS_TOKEN_URL, params=params, timeout=25)
    data = resp.json()
    if resp.status_code >= 400 or "error" in data:
        error_msg = data.get("error", {}).get("message", "Failed to refresh long-lived token")
        raise ValueError(error_msg)

    new_token = data["access_token"]
    expires_in_seconds = data.get("expires_in", 60 * 24 * 3600)
    new_expires_at = timezone.now() + datetime.timedelta(seconds=expires_in_seconds)
    return new_token, new_expires_at

