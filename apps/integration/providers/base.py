from abc import ABC, abstractmethod

class BaseSMSProvider(ABC):
    """Abstract Base Class for SMS communication integrations."""
    
    @abstractmethod
    def send_sms(self, to_number: str, message: str) -> bool:
        """Send an SMS to a recipient. Returns True if successful, False otherwise."""

class BaseEmailProvider(ABC):
    """Abstract Base Class for Email communication integrations."""
    
    @abstractmethod
    def send_email(self, to_email: str, subject: str, body: str, html_body: str = None) -> bool:
        """Send an Email to a recipient. Returns True if successful, False otherwise."""

class BaseCourierProvider(ABC):
    """Abstract Base Class for Courier and shipping integrations."""
    
    @abstractmethod
    def create_shipment(self, order_id: str, sender_address: dict, recipient_address: dict, packages: list) -> dict:
        """Create a new shipment. Returns a dict containing tracking info and courier response."""
        
    @abstractmethod
    def track_shipment(self, tracking_number: str) -> dict:
        """Get current tracking status. Returns a standardized tracking dict."""
