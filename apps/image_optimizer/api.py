from ninja import Router, Form, File
from ninja.files import UploadedFile
from ninja.errors import HttpError
from typing import Optional
from apps.core.api import BearerAuth, enforce_permission
from apps.image_optimizer.services import optimize_and_save_image

router = Router()

@router.post("/upload", auth=BearerAuth())
def manual_upload_and_optimize(
    request, 
    file: UploadedFile = File(...),
    max_width: int = Form(1000),
    prefix: str = Form("optimized_uploads")
):
    """
    Manually upload and optimize an image. (Admin only)
    """
    # Enforce admin permission for arbitrary image uploads
    enforce_permission(request, "core", "is_admin")
    
    try:
        url = optimize_and_save_image(file, max_width=max_width, prefix=prefix)
        return {"success": True, "url": url}
    except Exception as e:
        raise HttpError(400, f"Failed to optimize image: {str(e)}")
