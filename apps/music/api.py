from ninja import Router, Schema, File
from ninja.files import UploadedFile
from django.shortcuts import get_object_or_404
from django.core.files.storage import default_storage
from apps.music.models import Track, MusicConfig
from apps.core.api import BearerAuth, enforce_permission
from typing import List, Optional
import os

router = Router()


class TrackSchema(Schema):
    id: int
    title: str
    audio_url: Optional[str] = None   # Resolved URL (internal or external)
    is_active: bool
    sort_order: int
    duration_seconds: Optional[int] = None
    is_internally_hosted: bool = False


class TrackInputSchema(Schema):
    title: str
    audio_url: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0


class MusicConfigSchema(Schema):
    is_active: bool
    updated_at: Optional[str] = None


class MusicConfigUpdateSchema(Schema):
    is_active: bool


def _serialize_track(t: Track) -> dict:
    """
    Serialize a Track using its smart URL resolution properties.
    Priority: internal FileField > external URL fallback.
    """
    return {
        "id": t.id,
        "title": t.title,
        "audio_url": t.served_audio_url,
        "is_active": t.is_active,
        "sort_order": t.sort_order,
        "duration_seconds": t.duration_seconds,
        "is_internally_hosted": t.is_internally_hosted,
    }


# ── Public Storefront Endpoints ──────────────────────────────

@router.get("/config", response=MusicConfigSchema)
def get_public_music_config(request):
    """
    Public endpoint: check if storefront ambient music player is enabled by admin.
    """
    cfg = MusicConfig.get_solo()
    return {
        "is_active": cfg.is_active,
        "updated_at": cfg.updated_at.isoformat() if cfg.updated_at else None
    }


@router.get("/tracks", response=List[TrackSchema])
def get_active_tracks(request):
    """
    Public endpoint: retrieve all active tracks for the ambient music player.
    Returns empty list if the storefront music feature is deactivated.
    """
    cfg = MusicConfig.get_solo()
    if not cfg.is_active:
        return []
    tracks = Track.objects.filter(is_active=True)
    return [_serialize_track(t) for t in tracks]


# ── Admin Endpoints ─────────────────────────────────────────

@router.get("/admin/config", response=MusicConfigSchema, auth=BearerAuth())
def get_admin_music_config(request):
    """Admin: get master storefront music player switch."""
    enforce_permission(request, "music", "view")
    cfg = MusicConfig.get_solo()
    return {
        "is_active": cfg.is_active,
        "updated_at": cfg.updated_at.isoformat() if cfg.updated_at else None
    }


@router.post("/admin/config", response=MusicConfigSchema, auth=BearerAuth())
def update_admin_music_config(request, data: MusicConfigUpdateSchema):
    """Admin: toggle master storefront music player active/inactive state."""
    enforce_permission(request, "music", "edit_catalog")
    cfg = MusicConfig.get_solo()
    cfg.is_active = data.is_active
    cfg.save()
    return {
        "is_active": cfg.is_active,
        "updated_at": cfg.updated_at.isoformat() if cfg.updated_at else None
    }


@router.get("/admin/tracks", response=List[TrackSchema], auth=BearerAuth())
def admin_get_tracks(request):
    """Admin: list all tracks including inactive ones."""
    enforce_permission(request, "music", "edit_catalog")
    return [_serialize_track(t) for t in Track.objects.all()]


@router.post("/admin/tracks", response=TrackSchema, auth=BearerAuth())
def admin_create_track(request, data: TrackInputSchema):
    """Admin: add a new track (with optional external URL or after file upload)."""
    enforce_permission(request, "music", "edit_catalog")
    t = Track.objects.create(
        title=data.title,
        audio_url=data.audio_url,
        is_active=data.is_active,
        sort_order=data.sort_order,
    )
    return _serialize_track(t)


@router.put("/admin/tracks/{track_id}", response=TrackSchema, auth=BearerAuth())
def admin_update_track(request, track_id: int, data: TrackInputSchema):
    """Admin: update track metadata. Does not clear uploaded audio_file."""
    enforce_permission(request, "music", "edit_catalog")
    t = get_object_or_404(Track, id=track_id)
    t.title = data.title
    t.audio_url = data.audio_url
    t.is_active = data.is_active
    t.sort_order = data.sort_order
    t.save()
    return _serialize_track(t)


@router.delete("/admin/tracks/{track_id}", auth=BearerAuth())
def admin_delete_track(request, track_id: int):
    """Admin: remove a track and its associated files from storage."""
    enforce_permission(request, "music", "edit_catalog")
    t = get_object_or_404(Track, id=track_id)
    # Clean up stored files from MEDIA_ROOT
    if t.audio_file:
        if default_storage.exists(t.audio_file.name):
            default_storage.delete(t.audio_file.name)
    t.delete()
    return {"success": True}


# ── File Upload Endpoints ───────────────────────────────────

@router.post("/tracks/upload-audio", auth=BearerAuth())
def upload_audio_track(request, track_id: Optional[int] = None, file: UploadedFile = File(...)):
    """
    Upload an MP3/OGG file to internal Django media storage.
    Optionally attach directly to an existing Track by passing track_id.
    """
    enforce_permission(request, "music", "edit_catalog")
    import uuid
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in ('.mp3', '.ogg', '.wav', '.aac', '.m4a'):
        from ninja.errors import HttpError
        raise HttpError(400, "Unsupported audio format. Allowed: mp3, ogg, wav, aac, m4a.")

    filename = f"music/tracks/{uuid.uuid4().hex}{ext}"
    path = default_storage.save(filename, file)

    if track_id:
        t = get_object_or_404(Track, id=track_id)
        # Clean old file if present
        if t.audio_file and default_storage.exists(t.audio_file.name):
            default_storage.delete(t.audio_file.name)
        t.audio_file.name = path
        t.audio_url = None  # Clear external URL now that we have internal file
        t.save()

    return {"path": path, "url": default_storage.url(path)}
