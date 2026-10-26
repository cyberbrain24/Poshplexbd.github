import base64
import hashlib
from cryptography.fernet import Fernet
from django.conf import settings

def _get_fernet_key() -> bytes:
    """
    Derive a stable 32-byte Fernet key from Django SECRET_KEY or a dedicated META_ENCRYPTION_KEY.
    """
    raw_secret = getattr(settings, 'META_ENCRYPTION_KEY', settings.SECRET_KEY)
    if isinstance(raw_secret, str):
        raw_secret = raw_secret.encode('utf-8')
    digest = hashlib.sha256(raw_secret).digest()
    return base64.urlsafe_b64encode(digest)

def encrypt_token(plain_token: str) -> str:
    """
    Encrypt a plain text Meta access token into a secure base64 string.
    """
    if not plain_token:
        return ""
    fernet = Fernet(_get_fernet_key())
    return fernet.encrypt(plain_token.encode('utf-8')).decode('utf-8')

def decrypt_token(encrypted_token: str) -> str:
    """
    Decrypt a previously encrypted Meta access token back into plain text.
    """
    if not encrypted_token:
        return ""
    fernet = Fernet(_get_fernet_key())
    return fernet.decrypt(encrypted_token.encode('utf-8')).decode('utf-8')
