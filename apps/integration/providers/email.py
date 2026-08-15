import logging
from apps.integration.providers.base import BaseEmailProvider

logger = logging.getLogger(__name__)

class MockEmailProvider(BaseEmailProvider):
    """Fallback Email logging provider for development and testing."""
    def send_email(self, to_email: str, subject: str, body: str, html_body: str = None) -> bool:
        logger.info(f"[EMAIL MOCK] Sending email to '{to_email}' | Subject: '{subject}'")
        return True

from django.core.mail import get_connection, EmailMessage

class SMTPEmailProvider(BaseEmailProvider):
    """Custom SMTP Server integration provider."""
    def __init__(self, host: str = None, port: int = None, username: str = None, password: str = None, use_ssl: bool = True):
        self.host = host or "mail.poshplexbd.com"
        self.port = port or 465
        self.username = username or "support@poshplexbd.com"
        self.password = password or ""
        self.use_ssl = use_ssl

    def send_email(self, to_email: str, subject: str, body: str, html_body: str = None) -> bool:
        try:
            logger.info(f"[EMAIL SMTP] Connecting to {self.host}:{self.port} to send email to '{to_email}'")
            
            # Use SSL/TLS as requested (port 465 uses implicit SSL usually)
            use_tls = False
            use_ssl = self.use_ssl
            
            connection = get_connection(
                host=self.host,
                port=self.port,
                username=self.username,
                password=self.password,
                use_tls=use_tls,
                use_ssl=use_ssl,
                fail_silently=False,
            )
            
            email = EmailMessage(
                subject=subject,
                body=html_body or body,
                from_email=self.username,
                to=[to_email],
                connection=connection,
            )
            if html_body:
                email.content_subtype = "html"
                
            email.send()
            logger.info(f"[EMAIL SMTP] Successfully sent email to '{to_email}'")
            return True
        except Exception as e:
            logger.error(f"[EMAIL SMTP] Failed to send email to '{to_email}': {str(e)}")
            return False
