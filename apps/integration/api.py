from typing import Dict, Any, List
from ninja import Router, Schema
from ninja.errors import HttpError
from apps.integration.interfaces import send_customer_sms, send_customer_email, dispatch_shipment
from apps.core.api import BearerAuth, enforce_permission

router = Router()

class SMSInputSchema(Schema):
    to_number: str
    message: str

class EmailInputSchema(Schema):
    to_email: str
    subject: str
    body: str

class ShipmentInputSchema(Schema):
    order_id: str
    recipient_address: Dict[str, str]
    packages: List[Dict[str, Any]]

@router.post("/send-sms", auth=BearerAuth())
def send_test_sms(request, data: SMSInputSchema):
    """Trigger a test SMS dispatch (Requires admin permission)."""
    enforce_permission(request, "admin", "manage_integrations")
    success = send_customer_sms(data.to_number, data.message)
    return {"success": success}

@router.post("/send-email", auth=BearerAuth())
def send_test_email(request, data: EmailInputSchema):
    """Trigger a test email dispatch (Requires admin permission)."""
    enforce_permission(request, "admin", "manage_integrations")
    success = send_customer_email(data.to_email, data.subject, data.body)
    return {"success": success}

@router.post("/book-shipment", auth=BearerAuth())
def book_test_shipment(request, data: ShipmentInputSchema):
    """Trigger a test shipment booking with the active courier (Requires admin permission)."""
    enforce_permission(request, "admin", "manage_integrations")
    try:
        res = dispatch_shipment(data.order_id, data.recipient_address, data.packages)
        return res
    except Exception as e:
        raise HttpError(400, str(e))
