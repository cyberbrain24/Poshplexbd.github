from django.db import models
from django.conf import settings


class Track(models.Model):
    """
    Ambient music track for the Poshplex storefront player.

    Storage strategy (priority order):
      1. audio_file  — Internal Django FileField (served from MEDIA_ROOT/music/tracks/)
      2. audio_url   — Fallback external URL (used only until migrate_audio command runs)

    The `served_audio_url` property transparently handles this priority,
    so the storefront API always receives a clean, working URL regardless of
    which storage backend is active.
    """
    title = models.CharField(max_length=255)

    # --- Internal storage (preferred) ---
    audio_file = models.FileField(
        upload_to='music/tracks/',
        blank=True,
        null=True,
        help_text="Upload MP3/OGG file. This takes priority over audio_url when set."
    )

    # --- External fallback (deprecated after migrate_audio) ---
    audio_url = models.URLField(
        max_length=500,
        blank=True,
        null=True,
        help_text="External audio URL. Used only as fallback when audio_file is not set."
    )

    is_active = models.BooleanField(default=True, db_index=True)
    sort_order = models.PositiveIntegerField(default=0, db_index=True)
    duration_seconds = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Track duration in seconds (auto-populated by migrate_audio command)."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return self.title

    # ─────────────────────────────────────────────────────────
    # SMART URL RESOLUTION
    # Always returns a working URL regardless of storage backend.
    # ─────────────────────────────────────────────────────────

    @property
    def served_audio_url(self) -> str | None:
        """
        Returns the best available audio URL.
        Priority: internal FileField → external URL fallback
        """
        if self.audio_file:
            # Build an absolute URL using MEDIA_URL from settings
            media_url = getattr(settings, 'MEDIA_URL', '/media/')
            # Strip trailing slash from domain, add full path
            base = media_url.rstrip('/')
            return f"{base}/{self.audio_file.name}"
        return self.audio_url or None

    @property
    def is_internally_hosted(self) -> bool:
        """True when the track is fully migrated to internal storage."""
        return bool(self.audio_file)
