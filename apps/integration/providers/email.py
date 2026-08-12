import logging
from apps.integration.providers.base import BaseEmailProvider

logger = logging.getLogger(__name__)

class MockEmailProvider(BaseEmailProvider):
    """Fallback Email logging provider for development and testing."""
    def send_email(self, to_email: str, subject: str, body: str, html_body: str = None) -> bool:
        logger.info(f"[EMAIL MOCK] Sending email to '{to_email}' | Subject: '{subject}'")
        return True

class SendGridEmailProvider(BaseEmailProvider):
    """SendGrid API integration provider."""
    def __init__(self, api_key: str = None, from_email: str = None):
        self.api_key = api_key or "MOCK_SENDGRID_KEY"
        self.from_email = from_email or "no-reply@poshplexbd.com"

    def send_email(self, to_email: str, subject: str, body: str, html_body: str = None) -> bool:
        # SendGrid API integration placeholder
        logger.info(f"[EMAIL SENDGRID] Sending email to '{to_email}' from '{self.from_email}' using key '{self.api_key[:8]}...': {subject}")
        return True
