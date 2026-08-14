import logging
from apps.integration.providers.base import BaseSMSProvider
import requests

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

class BulkSMSBDProvider(BaseSMSProvider):
    """BulkSMSBD Gateway implementation."""
    def __init__(self, api_key: str = None, sender_id: str = None):
        self.api_key = api_key or "JC59LubvFuo7pxEOMHL9"
        self.sender_id = "09617" # Hardcoded for OTP Non-Mask route as requested
        self.base_url = "http://bulksmsbd.net/api/smsapi"

    def send_sms(self, to_number: str, message: str) -> bool:
        try:
            params = {
                "api_key": self.api_key,
                "senderid": self.sender_id,
                "number": to_number,
                "message": message,
                "type": "text"
            }
            response = requests.get(self.base_url, params=params, timeout=10)
            
            # 202 is the successful submission code for BulkSMSBD
            if response.status_code == 200 and "202" in response.text:
                logger.info(f"[SMS BULKSMSBD] Successfully sent to {to_number}")
                return True
            else:
                logger.error(f"[SMS BULKSMSBD] Failed to send SMS to {to_number}. Response: {response.text}")
                return False
        except Exception as e:
            logger.error(f"[SMS BULKSMSBD] Exception while sending SMS: {str(e)}")
            return False
