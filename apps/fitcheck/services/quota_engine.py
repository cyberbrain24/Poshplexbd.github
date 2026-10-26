import logging
from typing import Tuple, Dict, Any, Optional
from django.utils import timezone
from django.core.cache import cache
from apps.fitcheck.models import FitCheckConfig, FitCheckUsage

logger = logging.getLogger(__name__)


class QuotaEngine:
    """
    Enforces gatekeeper logic:
    - 1-time guest trial tracked via device/IP fingerprint.
    - 10 checks/day for registered and authenticated users.
    """

    @classmethod
    def get_user_quota_status(cls, user, guest_fingerprint: Optional[str] = None) -> Dict[str, Any]:
        """
        Calculates remaining quota and trial eligibility for the current session.
        """
        config = FitCheckConfig.get_solo()
        today = timezone.localdate()
        today_str = today.strftime('%Y-%m-%d')

        if user and getattr(user, 'is_authenticated', False):
            # Registered User Flow
            user_id = user.id
            cache_key = f"fitcheck:quota:user:{user_id}:{today_str}"
            used_today = cache.get(cache_key)

            if used_today is None:
                usage_record = FitCheckUsage.objects.filter(user=user, usage_date=today).first()
                used_today = usage_record.count_today if usage_record else 0
                cache.set(cache_key, used_today, timeout=86400)
            else:
                used_today = int(used_today)

            daily_limit = config.user_daily_limit
            remaining = max(0, daily_limit - used_today)

            has_character = hasattr(user, 'fitcheck_character') and bool(user.fitcheck_character.face_image or user.fitcheck_character.face_image_url)

            return {
                "is_authenticated": True,
                "user_id": user_id,
                "username": user.username,
                "daily_limit": daily_limit,
                "used_today": used_today,
                "remaining_today": remaining,
                "can_generate": remaining > 0,
                "has_saved_character": has_character,
                "gatekeeper_reason": None if remaining > 0 else "Daily limit of 10 virtual fit checks reached. Resets at midnight.",
            }

        else:
            # Anonymous Guest Flow
            fp = (guest_fingerprint or "").strip()
            if not fp:
                return {
                    "is_authenticated": False,
                    "guest_trial_available": False,
                    "can_generate": False,
                    "gatekeeper_reason": "Device fingerprint missing. Please reload the page to generate your guest trial.",
                }

            cache_key = f"fitcheck:guest_trial:{fp}"
            is_consumed = cache.get(cache_key)

            if is_consumed is None:
                consumed_in_db = FitCheckUsage.objects.filter(
                    guest_fingerprint=fp, 
                    trial_consumed=True
                ).exists()
                is_consumed = consumed_in_db
                cache.set(cache_key, 1 if consumed_in_db else 0, timeout=30 * 86400)
            else:
                is_consumed = bool(int(is_consumed))

            can_gen = not is_consumed

            return {
                "is_authenticated": False,
                "guest_fingerprint": fp,
                "guest_trial_available": can_gen,
                "can_generate": can_gen,
                "daily_limit": config.guest_trial_limit,
                "used_today": 1 if is_consumed else 0,
                "remaining_today": 0 if is_consumed else 1,
                "has_saved_character": False,
                "gatekeeper_reason": None if can_gen else "Guest 1-time trial already used. Sign up free for 10 checks every day!",
            }

    @classmethod
    def consume_quota(cls, user, guest_fingerprint: Optional[str] = None) -> Tuple[bool, str]:
        """
        Validates and marks quota as consumed when an AI generation job is initiated.
        Returns (success: bool, error_message: str).
        """
        status = cls.get_user_quota_status(user, guest_fingerprint)
        if not status["can_generate"]:
            return False, status.get("gatekeeper_reason") or "Virtual fit check quota exceeded."

        today = timezone.localdate()
        today_str = today.strftime('%Y-%m-%d')

        if user and getattr(user, 'is_authenticated', False):
            user_id = user.id
            cache_key = f"fitcheck:quota:user:{user_id}:{today_str}"
            new_count = status["used_today"] + 1
            cache.set(cache_key, new_count, timeout=86400)

            usage_record, _ = FitCheckUsage.objects.get_or_create(
                user=user,
                usage_date=today,
                defaults={'count_today': 0}
            )
            usage_record.count_today = new_count
            usage_record.save(update_fields=['count_today', 'updated_at'])
            return True, ""

        else:
            fp = guest_fingerprint.strip()
            cache_key = f"fitcheck:guest_trial:{fp}"
            cache.set(cache_key, 1, timeout=30 * 86400)

            FitCheckUsage.objects.create(
                guest_fingerprint=fp,
                usage_date=today,
                count_today=1,
                trial_consumed=True
            )
            return True, ""
