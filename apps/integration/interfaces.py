from apps.integration.services import send_sms_notification, send_email_notification, book_courier_shipment

def send_customer_sms(to_number: str, message: str) -> bool:
    """Public interface to send SMS to a customer."""
    return send_sms_notification(to_number, message)

def send_customer_email(to_email: str, subject: str, body: str, html_body: str = None) -> bool:
    """Public interface to send an email to a customer."""
    return send_email_notification(to_email, subject, body, html_body)

def dispatch_shipment(order_id: str, recipient_address: dict, packages: list) -> dict:
    """Public interface to book shipment with courier."""
    # Standard Poshplex warehouse source address
    sender_address = {
        "company": "Poshplex Warehouse",
        "street": "123 Streetwear Ave",
        "city": "Dhaka",
        "country": "Bangladesh"
    }
    return book_courier_shipment(order_id, sender_address, recipient_address, packages)
