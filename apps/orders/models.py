from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from decimal import Decimal
from apps.core.decorators import AuditedModelMixin

class Order(AuditedModelMixin):
    ORDER_STATUS_CHOICES = (
        ('placed', 'Order Placed'),
        ('review', 'In Review'),
        ('pending', 'Pending'),
        ('hold', 'Hold'),
        ('approval_pending', 'Approval Pending'),
        ('delivered', 'Delivered'),
        ('partially_delivered', 'Partially Delivered'),
        ('cancelled', 'Cancelled'),
        ('returned', 'Returned'),
        ('rto', 'RTO'),
    )
    
    PAYMENT_STATUS_CHOICES = (
        ('unpaid', 'Unpaid'),
        ('pending_verification', 'Pending Verification'),
        ('paid', 'Paid'),
        ('partially_paid', 'Partially Paid'),
        ('refunded', 'Refunded'),
        ('partially_refunded', 'Partially Refunded'),
        ('failed', 'Failed'),
    )
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='orders')
    order_number = models.CharField(max_length=50, unique=True, blank=True, null=True)
    
    # Financial breakdown
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    shipping_cost = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    
    status = models.CharField(max_length=30, choices=ORDER_STATUS_CHOICES, default='placed')
    payment_status = models.CharField(max_length=30, choices=PAYMENT_STATUS_CHOICES, default='unpaid')
    
    # Recipient details
    shipping_name = models.CharField(max_length=255, blank=True, null=True)
    shipping_phone = models.CharField(max_length=50, blank=True, null=True)
    shipping_address = models.TextField()
    shipping_district = models.CharField(max_length=100, blank=True, null=True)
    shipping_thana = models.CharField(max_length=100, blank=True, null=True)
    shipping_postal_code = models.CharField(max_length=20, blank=True, null=True)
    
    # Courier fields
    tracking_number = models.CharField(max_length=100, blank=True, null=True)
    courier_status = models.CharField(max_length=100, blank=True, null=True)
    courier_consignment_id = models.CharField(max_length=100, blank=True, null=True)
    courier_name = models.CharField(max_length=50, blank=True, null=True)
    delivered_at = models.DateTimeField(blank=True, null=True)
    
    # Notes & Issues
    customer_notes = models.TextField(blank=True, null=True)
    internal_notes = models.TextField(blank=True, null=True)
    issue_status = models.CharField(max_length=100, default='None', blank=True, null=True)
    is_ready = models.BooleanField(default=False)
    is_print_ready = models.BooleanField(default=False)
    
    # Risk flags
    risk_level = models.CharField(max_length=20, default='low')
    risk_reasons = models.JSONField(default=list, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['status', 'payment_status']),
            models.Index(fields=['order_number']),
        ]

    def save(self, *args, **kwargs):
        # Auto-generate custom PO invoice code
        is_new = self.id is None
        super().save(*args, **kwargs)
        if is_new and not self.order_number:
            self.order_number = f"PO-{1000 + self.id}"
            self.save(update_fields=['order_number'])

    def __str__(self):
        return f"Order {self.order_number or self.id} (Status: {self.status}, Total: {self.total_amount})"

class OrderItem(models.Model):
    FULFILLMENT_STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('reserved', 'Reserved'),
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered'),
        ('out_of_stock', 'Out of Stock'),
        ('returned', 'Returned'),
        ('damaged', 'Damaged'),
        ('cancelled', 'Cancelled'),
    )
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    sku = models.CharField(max_length=100, help_text="Variant SKU copy to preserve decoupling")
    quantity = models.PositiveIntegerField(default=1)
    fulfilled_quantity = models.PositiveIntegerField(default=0)
    returned_quantity = models.PositiveIntegerField(default=0)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    fulfillment_status = models.CharField(max_length=30, choices=FULFILLMENT_STATUS_CHOICES, default='pending')

    class Meta:
        indexes = [
            models.Index(fields=['sku']),
            models.Index(fields=['fulfillment_status']),
        ]

    def __str__(self):
        return f"{self.quantity} x {self.sku} (Order {self.order.id})"

class OrderStatusHistory(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='status_history')
    status = models.CharField(max_length=50)
    admin_username = models.CharField(max_length=150, blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-timestamp']

class Payment(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=50)
    reference_number = models.CharField(max_length=100, blank=True, null=True)
    sender_number = models.CharField(max_length=50, blank=True, null=True)
    status = models.CharField(max_length=50, default='paid')
    created_at = models.DateTimeField(auto_now_add=True)
    ledger_entry_id = models.IntegerField(blank=True, null=True)

    def delete(self, *args, **kwargs):
        # Reverse and balance accounting entries
        if self.ledger_entry_id:
            try:
                from django.apps import apps
                Transaction = apps.get_model('finance', 'Transaction')
                Transaction.objects.filter(id=self.ledger_entry_id).delete()
            except Exception:
                pass
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"Payment of {self.amount} ({self.method}) for Order {self.order.id}"

class ReturnRequest(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='returns')
    sku = models.CharField(max_length=100)
    quantity = models.PositiveIntegerField(default=1)
    reason = models.TextField()
    status = models.CharField(max_length=30, default='pending') # pending, approved, rejected
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Return Request {self.sku} x {self.quantity} (Status: {self.status})"


class CODApprovalLog(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='cod_approvals')
    amount_collected = models.DecimalField(max_digits=10, decimal_places=2)
    approver_username = models.CharField(max_length=150)
    approved_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"COD Approval {self.amount_collected} for Order {self.order.id}"

class District(models.Model):
    name = models.CharField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def delete(self, *args, **kwargs):
        if self.thanas.exists():
            raise ValidationError("Cannot delete district with active thanas.")
        from django.apps import apps
        CustomerProfile = apps.get_model('crm', 'CustomerProfile')
        if CustomerProfile.objects.filter(district=self).exists():
            raise ValidationError("Cannot delete district with attached CRM profiles.")
        super().delete(*args, **kwargs)

    def __str__(self):
        return self.name

class Thana(models.Model):
    district = models.ForeignKey(District, on_delete=models.CASCADE, related_name='thanas')
    name = models.CharField(max_length=100)
    shipping_cost = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('120.00'))
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('district', 'name')
        ordering = ['name']

    def delete(self, *args, **kwargs):
        from django.apps import apps
        CustomerProfile = apps.get_model('crm', 'CustomerProfile')
        if CustomerProfile.objects.filter(thana=self).exists():
            raise ValidationError("Cannot delete thana with attached CRM profiles.")
        from apps.orders.models import Order
        if Order.objects.filter(shipping_thana=self.name).exists():
            raise ValidationError("Cannot delete thana with attached orders.")
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.district.name})"

class DraftCart(models.Model):
    """
    High-churn data store for anonymous user carts.
    Will be converted to an UNLOGGED table in PostgreSQL via migrations to disable WAL,
    making inserts/updates extremely fast.
    """
    token = models.CharField(max_length=64, unique=True, db_index=True)
    cart_data = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"DraftCart {self.token}"
