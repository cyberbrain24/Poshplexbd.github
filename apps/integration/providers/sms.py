import logging
from apps.integration.providers.base import BaseSMSProvider

logger = logging.getLogger(__name__)

class MockSMSProvider(BaseSMSProvider):
    """Fallback SMS logging provider for development and local testing."""
    def send_sms(self, to_number: str, message: str) -> bool:
        logger.info(f"[SMS MOCK] Outbox send to '{to_number}': {message}")
        return True

class TwilioSMSProvider(BaseSMSProvider):
    """Twilio SMS Gateway implementation."""
    def __init__(self, account_sid: str = None, auth_token: str = None, from_number: str = None):
        self.account_sid = account_sid or "MOCK_TWILIO_SID"
        self.auth_token = auth_token or "MOCK_TWILIO_TOKEN"
        self.from_number = from_number or "+15005550006"

    def send_sms(self, to_number: str, message: str) -> bool:
        # Twilio API integration placeholder (safely logs execution)
        logger.info(f"[SMS TWILIO] Twilio API call to '{to_number}' using SID '{self.account_sid}': {message}")
        return True
