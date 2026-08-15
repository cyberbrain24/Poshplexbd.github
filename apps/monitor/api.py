import psutil
import json
import docker
import uuid
from datetime import datetime
from ninja import Router, Schema
from django.core.cache import cache
import concurrent.futures

router = Router(tags=["System Monitor"])

class ClientErrorSchema(Schema):
    message: str
    stack_trace: str = ""
    user_agent: str = ""
    path: str = ""

@router.get("/metrics")
def get_system_metrics(request):
    """Fetch live CPU, RAM, and Disk metrics."""
    # CPU
    cpu_percent = psutil.cpu_percent(interval=None)
    cpu_count = psutil.cpu_count(logical=True)
    
    # Memory
    mem = psutil.virtual_memory()
    
    # Disk (root)
    try:
        disk = psutil.disk_usage('/')
        disk_percent = disk.percent
        disk_free = disk.free
        disk_total = disk.total
    except Exception:
        # Fallback for Windows local dev where '/' might not map properly or raise permission error
        try:
            disk = psutil.disk_usage('C:\\')
            disk_percent = disk.percent
            disk_free = disk.free
            disk_total = disk.total
        except Exception:
            disk_percent = 0
            disk_free = 0
            disk_total = 0

    return {
        "cpu": {
            "percent": cpu_percent,
            "cores": cpu_count
        },
        "memory": {
            "percent": mem.percent,
            "used_mb": round(mem.used / (1024 * 1024), 2),
            "total_mb": round(mem.total / (1024 * 1024), 2)
        },
        "disk": {
            "percent": disk_percent,
            "free_gb": round(disk_free / (1024 * 1024 * 1024), 2),
            "total_gb": round(disk_total / (1024 * 1024 * 1024), 2)
        }
    }

@router.get("/docker")
def get_docker_status(request):
    """Fetch container statuses via Docker socket."""
    try:
        # Connect to default local socket (UNIX on Linux, named pipe on Windows)
        client = docker.from_env()
        containers = client.containers.list()
        
        def fetch_container_stats(c):
            try:
                image_name = c.attrs.get('Config', {}).get('Image', 'Unknown Image')
            except Exception:
                image_name = "Unknown Image"
                
            try:
                stats = c.stats(stream=False)
                
                # RAM
                mem_usage = stats.get('memory_stats', {}).get('usage', 0)
                mem_mb = round(mem_usage / (1024 * 1024), 2)
                
                # CPU
                cpu_delta = stats.get('cpu_stats', {}).get('cpu_usage', {}).get('total_usage', 0) - stats.get('precpu_stats', {}).get('cpu_usage', {}).get('total_usage', 0)
                system_cpu_delta = stats.get('cpu_stats', {}).get('system_cpu_usage', 0) - stats.get('precpu_stats', {}).get('system_cpu_usage', 0)
                number_cpus = stats.get('cpu_stats', {}).get('online_cpus', 1)
                
                if system_cpu_delta > 0 and cpu_delta > 0:
                    cpu_percent = round((cpu_delta / system_cpu_delta) * number_cpus * 100.0, 2)
                else:
                    cpu_percent = 0.0
            except Exception:
                mem_mb = 0
                cpu_percent = 0.0
                
            return {
                "name": c.name,
                "status": c.status,
                "image": image_name,
                "id": c.short_id,
                "memory_mb": mem_mb,
                "cpu_percent": cpu_percent
            }

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            result = list(executor.map(fetch_container_stats, containers))
            
        return {"success": True, "containers": result}
    except Exception as e:
        # Usually happens in local dev if Docker Desktop isn't running
        return {"success": False, "message": str(e), "containers": []}

@router.post("/ingest-client-error")
def ingest_client_error(request, data: ClientErrorSchema):
    """Ingest a crash report from the Next.js storefront."""
    try:
        redis_client = None
        if hasattr(cache, 'client'):
            redis_client = cache.client.get_client()
        elif hasattr(cache, '_cache'):
            redis_client = cache._cache.get_client()
            
        if not redis_client:
            return {"success": False, "message": "Redis not available"}
            
        log_data = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            "level": "ERROR",
            "logger": "NextJSClient",
            "message": data.message,
            "stack_trace": data.stack_trace,
            "source": "frontend",
            "path": data.path,
            "user_agent": data.user_agent,
        }
        
        # LPUSH and LTRIM
        redis_client.lpush("poshplex_error_logs", json.dumps(log_data))
        redis_client.ltrim("poshplex_error_logs", 0, 999)
        
        return {"success": True}
    except Exception as e:
        return {"success": False, "message": str(e)}

@router.get("/logs")
def get_error_logs(request, limit: int = 100):
    """Fetch recent error logs from Redis for the Admin UI."""
    try:
        redis_client = None
        if hasattr(cache, 'client'):
            redis_client = cache.client.get_client()
        elif hasattr(cache, '_cache'):
            redis_client = cache._cache.get_client()
            
        if not redis_client:
            return []
            
        raw_logs = redis_client.lrange("poshplex_error_logs", 0, limit - 1)
        
        # Redis returns bytes in some drivers, so decode it
        logs = []
        for rl in raw_logs:
            if isinstance(rl, bytes):
                rl = rl.decode('utf-8')
            logs.append(json.loads(rl))
            
        return logs
    except Exception:
        return []
