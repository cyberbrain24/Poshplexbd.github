"""
Hybrid Agent Memory Engine (PostgreSQL Persistent Storage + Redis Fast Read Cache).
"""
import json
import logging
from typing import Dict, Any, List, Optional
from django.utils import timezone
from django.core.cache import cache
import redis
from django.conf import settings
from apps.marketing.models import AgentMemoryEntry

logger = logging.getLogger(__name__)

REDIS_MEMORY_PREFIX = "agent_memory:"
REDIS_TOP_INSIGHTS_KEY = "agent_memory:top_insights"
DEFAULT_MEMORY_TTL = 7 * 86400  # 7 days


class AgentMemoryManager:
    """
    Manages long-term structured knowledge and insights for the Meta Media Buyer Agent.
    Synchronizes across Postgres relational database and Redis RAM cache.
    """

    def __init__(self):
        try:
            redis_url = getattr(settings, 'CELERY_BROKER_URL', '') or getattr(settings, 'REDIS_URL', 'redis://127.0.0.1:6379/1')
            if not (isinstance(redis_url, str) and (redis_url.startswith("redis://") or redis_url.startswith("rediss://"))):
                redis_url = 'redis://127.0.0.1:6379/1'
            self.redis_client = redis.Redis.from_url(redis_url, socket_timeout=2)
            self.redis_client.ping()
        except Exception as e:
            logger.info(f"Direct Redis unavailable for AgentMemory ({e}). Utilizing Django DB persistence.")
            self.redis_client = None

    def save_memory(self, key: str, value: Any, importance: float = 1.0) -> AgentMemoryEntry:
        """
        Saves or updates a strategic learning entry in Postgres and refreshes Redis cache.
        """
        normalized_key = key.strip().lower()
        json_val = value if isinstance(value, dict) else {"data": value}

        entry, created = AgentMemoryEntry.objects.update_or_create(
            key=normalized_key,
            defaults={
                'value': json_val,
                'importance': float(importance),
            }
        )

        # Write to Redis
        try:
            if self.redis_client:
                cache_key = f"{REDIS_MEMORY_PREFIX}{normalized_key}"
                self.redis_client.setex(cache_key, DEFAULT_MEMORY_TTL, json.dumps(json_val))
                # Invalidate top insights list cache
                self.redis_client.delete(REDIS_TOP_INSIGHTS_KEY)
        except Exception as e:
            logger.debug(f"Redis memory write error for key '{key}': {e}")

        logger.info(f"Agent memory saved: [{normalized_key}] (Importance: {importance})")
        return entry

    def get_memory(self, key: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves a memory entry, querying Redis first, falling back to PostgreSQL.
        """
        normalized_key = key.strip().lower()

        # Try Redis
        try:
            if self.redis_client:
                cache_key = f"{REDIS_MEMORY_PREFIX}{normalized_key}"
                cached = self.redis_client.get(cache_key)
                if cached:
                    return json.loads(cached.decode('utf-8'))
        except Exception:
            pass

        # Try Postgres
        try:
            entry = AgentMemoryEntry.objects.filter(key=normalized_key).first()
            if entry:
                entry.save(update_fields=['last_used_at'])
                return entry.value
        except Exception as e:
            logger.error(f"Error reading memory for key '{key}': {e}")

        return None

    def get_top_insights(self, limit: int = 8) -> List[Dict[str, Any]]:
        """
        Returns highest-importance memory entries for LLM system prompt injection and UI cards.
        """
        # Try Redis cached list
        try:
            if self.redis_client:
                cached = self.redis_client.get(REDIS_TOP_INSIGHTS_KEY)
                if cached:
                    return json.loads(cached.decode('utf-8'))
        except Exception:
            pass

        try:
            entries = AgentMemoryEntry.objects.order_by('-importance', '-last_used_at')[:limit]
            results = [
                {
                    "id": e.id,
                    "key": e.key,
                    "value": e.value,
                    "importance": e.importance,
                    "last_used_at": e.last_used_at.isoformat() if e.last_used_at else None
                }
                for e in entries
            ]

            if self.redis_client and results:
                try:
                    self.redis_client.setex(REDIS_TOP_INSIGHTS_KEY, 3600, json.dumps(results))
                except Exception:
                    pass

            return results
        except Exception as e:
            logger.error(f"Error fetching top insights: {e}")
            return []

    def format_memories_for_prompt(self, limit: int = 6) -> str:
        """Formats active learnings into a bulleted string for the reasoning prompt."""
        insights = self.get_top_insights(limit=limit)
        if not insights:
            return "No previous memory stored. Operating with clean baseline."

        lines = []
        for item in insights:
            val_str = item["value"].get("insight") or item["value"].get("data") or json.dumps(item["value"])
            lines.append(f"- [{item['key']}]: {val_str}")
        return "\n".join(lines)


# Singleton instance
agent_memory = AgentMemoryManager()
