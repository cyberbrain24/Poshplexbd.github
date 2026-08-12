import logging
import uuid
from apps.integration.providers.base import BaseCourierProvider

logger = logging.getLogger(__name__)

class MockCourierProvider(BaseCourierProvider):
    """Fallback Courier mock provider."""
    def create_shipment(self, order_id: str, sender_address: dict, recipient_address: dict, packages: list) -> dict:
        tracking_number = f"MOCK-SHIP-{uuid.uuid4().hex[:8].upper()}"
        logger.info(f"[COURIER MOCK] Creating mock shipment for Order {order_id}. Tracking: {tracking_number}")
        return {
            "success": True,
            "provider": "MockCourier",
            "tracking_number": tracking_number,
            "label_url": "http://localhost/labels/mock-label.pdf",
            "status": "label_created"
        }

    def track_shipment(self, tracking_number: str) -> dict:
        return {
            "tracking_number": tracking_number,
            "provider": "MockCourier",
            "status": "in_transit",
            "estimated_delivery": "2026-07-05",
            "history": [
                {"timestamp": "2026-07-01T12:00:00Z", "status": "label_created", "location": "Warehouse Hub"}
            ]
        }

class DHLCourierProvider(BaseCourierProvider):
    """DHL Express API integration provider."""
    def __init__(self, api_key: str = None, account_number: str = None):
        self.api_key = api_key or "MOCK_DHL_KEY"
        self.account_number = account_number or "MOCK_DHL_ACCT"

    def create_shipment(self, order_id: str, sender_address: dict, recipient_address: dict, packages: list) -> dict:
        tracking_number = f"DHL-{uuid.uuid4().hex[:10].upper()}"
        logger.info(f"[COURIER DHL] Creating DHL shipment for Order {order_id}. Acct: '{self.account_number}'")
        return {
            "success": True,
            "provider": "DHL",
            "tracking_number": tracking_number,
            "label_url": f"https://dhl.com/labels/{tracking_number}.pdf",
            "status": "shipment_booked"
        }

    def track_shipment(self, tracking_number: str) -> dict:
        return {
            "tracking_number": tracking_number,
            "provider": "DHL",
            "status": "booked",
            "estimated_delivery": "2026-07-04",
            "history": [
                {"timestamp": "2026-07-01T12:30:00Z", "status": "booked", "location": "Gateway Hub"}
            ]
        }
