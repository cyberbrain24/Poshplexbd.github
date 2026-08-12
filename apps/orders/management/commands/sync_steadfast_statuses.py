import time
import logging
from django.core.management.base import BaseCommand
from apps.orders.models import Order
from apps.orders.services import sync_steadfast_status

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Synchronizes package delivery statuses from Steadfast Courier (Packzy) API for active orders.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Starting Steadfast status synchronization..."))
        
        # Find all orders that have a tracking number but are not yet completed/delivered
        active_orders = Order.objects.exclude(
            status__in=['delivered', 'cancelled', 'returned', 'rto']
        ).exclude(
            tracking_number__isnull=True
        ).exclude(
            tracking_number=''
        )
        
        total_orders = active_orders.count()
        if total_orders == 0:
            self.stdout.write(self.style.SUCCESS("No active orders require status synchronization."))
            return
            
        self.stdout.write(f"Found {total_orders} active orders to sync.")
        
        success_count = 0
        error_count = 0
        
        for order in active_orders:
            try:
                old_status = order.status
                new_status = sync_steadfast_status(order.id)
                self.stdout.write(f"Order #{order.order_number} (Tracking: {order.tracking_number}) - Status: {new_status}")
                success_count += 1
                
                # Small delay to prevent rate-limiting from the Courier API
                time.sleep(0.5)
            except Exception as e:
                logger.error(f"Error syncing order {order.id}: {str(e)}")
                self.stdout.write(self.style.ERROR(f"Error syncing order {order.order_number}: {str(e)}"))
                error_count += 1
                
        self.stdout.write(self.style.SUCCESS(f"Synchronization complete. Successfully synced: {success_count}, Errors: {error_count}"))
