import os
import uuid
from io import BytesIO
from PIL import Image
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

def optimize_and_save_image(file, max_width: int, prefix: str, custom_filename: str = None) -> str:
    """
    Optimizes an uploaded image by resizing it to a maximum width (maintaining aspect ratio),
    converting it to WebP, and saving it to default_storage.
    
    Args:
        file: The uploaded file object.
        max_width: The maximum allowed width in pixels.
        prefix: The folder prefix for saving (e.g., 'profiles', 'reviews').
        custom_filename: Optional filename to use instead of uuid.
        
    Returns:
        The fully qualified URL to the saved image.
    """
    img = Image.open(file)
    
    # Resize if width exceeds max_width
    if img.width > max_width:
        ratio = max_width / float(img.width)
        new_height = int(float(img.height) * float(ratio))
        img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
        
    buffer = BytesIO()
    img.convert('RGB').save(buffer, format='WEBP', quality=85)
    
    if custom_filename:
        filename = f"{prefix}/{custom_filename}"
    else:
        filename = f"{prefix}/{uuid.uuid4().hex}.webp"
    
    path = default_storage.save(filename, ContentFile(buffer.getvalue()))
    url = default_storage.url(path)
    
    if url and not (url.startswith("http://") or url.startswith("https://")):
        base_url = os.environ.get('SITE_BASE_URL', 'http://localhost:8000')
        url = f"{base_url.rstrip('/')}{url}"
        
    return url
