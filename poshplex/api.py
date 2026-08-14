from ninja import NinjaAPI

api = NinjaAPI(
    title="Poshplex API",
    version="1.0.0",
    description="Modular Monolith Backend API for Poshplex Streetwear"
)

# Import module-specific routers
from apps.core.api import router as core_router
from apps.finance.api import router as finance_router
from apps.catalog.api import router as catalog_router
from apps.integration.api import router as integration_router
from apps.orders.api import router as orders_router
from apps.marketing.api import router as marketing_router
from apps.crm.api import router as crm_router
from apps.music.api import router as music_router
from apps.printing.api import router as printing_router
from apps.image_optimizer.api import router as image_optimizer_router
from apps.monitor.api import router as monitor_router

# Register routers with clear namespaces
api.add_router("/core", core_router)
api.add_router("/finance", finance_router)
api.add_router("/catalog", catalog_router)
api.add_router("/integration", integration_router)
api.add_router("/orders", orders_router)
api.add_router("/marketing", marketing_router)
api.add_router("/crm", crm_router)
api.add_router("/music", music_router)
api.add_router("/printing", printing_router)
api.add_router("/image-optimizer", image_optimizer_router)
api.add_router("/monitor", monitor_router)

from django.db import connection
from django.core.cache import cache

@api.get("/health")
def health_check(request):
    """Health check endpoint for load balancers and orchestrators."""
    status = {"status": "ok", "db": "ok", "redis": "ok"}
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:
        status["db"] = "error"
        status["status"] = "error"
        
    try:
        cache.set('health_check', 1, timeout=1)
    except Exception:
        status["redis"] = "error"
        status["status"] = "error"
        
    return status
