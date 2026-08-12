import logging
from apps.core.interfaces import get_setting_value
from apps.integration.providers.sms import MockSMSProvider, TwilioSMSProvider
from apps.integration.providers.email import MockEmailProvider, SendGridEmailProvider
from apps.integration.providers.courier import MockCourierProvider, DHLCourierProvider

logger = logging.getLogger(__name__)

def get_sms_provider():
    """Dynamically resolves the active SMS provider based on active site settings."""
    config = get_setting_value("integration_providers", {})
    provider_type = config.get("sms_provider", "mock").lower()
    
    if provider_type == "twilio":
        params = config.get("twilio_credentials", {})
        return TwilioSMSProvider(
            account_sid=params.get("account_sid"),
            auth_token=params.get("auth_token"),
            from_number=params.get("from_number")
        )
    return MockSMSProvider()

def get_email_provider():
    """Dynamically resolves the active Email provider based on active site settings."""
    config = get_setting_value("integration_providers", {})
    provider_type = config.get("email_provider", "mock").lower()
    
    if provider_type == "sendgrid":
        params = config.get("sendgrid_credentials", {})
        return SendGridEmailProvider(
            api_key=params.get("api_key"),
            from_email=params.get("from_email")
        )
    return MockEmailProvider()

def get_courier_provider():
    """Dynamically resolves the active Courier provider based on active site settings."""
    config = get_setting_value("integration_providers", {})
    provider_type = config.get("courier_provider", "mock").lower()
    
    if provider_type == "dhl":
        params = config.get("dhl_credentials", {})
        return DHLCourierProvider(
            api_key=params.get("api_key"),
            account_number=params.get("account_number")
        )
    return MockCourierProvider()

# --- Unified Dispatch Handlers ---

def send_sms_notification(to_number: str, message: str) -> bool:
    """Dispatches SMS via current active provider."""
    provider = get_sms_provider()
    return provider.send_sms(to_number, message)

def send_email_notification(to_email: str, subject: str, body: str, html_body: str = None) -> bool:
    """Dispatches Email via current active provider."""
    provider = get_email_provider()
    return provider.send_email(to_email, subject, body, html_body)

def book_courier_shipment(order_id: str, sender_address: dict, recipient_address: dict, packages: list) -> dict:
    """Books a courier shipment via current active provider."""
    provider = get_courier_provider()
    return provider.create_shipment(order_id, sender_address, recipient_address, packages)
