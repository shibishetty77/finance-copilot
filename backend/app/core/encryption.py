"""
Field-level encryption for sensitive values (e.g. user API keys).

Uses Fernet symmetric encryption with a key derived from ENCRYPTION_KEY
(or SECRET_KEY as fallback). Supports future key rotation by storing a
key version prefix alongside ciphertext.
"""

import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings
from app.core.exceptions import AppException

logger = logging.getLogger(__name__)

_KEY_VERSION = "v1"


class EncryptionError(AppException):
    """Raised when encryption or decryption fails."""

    def __init__(self, message: str = "Encryption operation failed") -> None:
        super().__init__(message=message, code="ENCRYPTION_ERROR", status_code=500)


def _derive_fernet_key(material: str) -> bytes:
    """Derive a URL-safe 32-byte Fernet key from arbitrary secret material."""
    digest = hashlib.sha256(material.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _get_fernet() -> Fernet:
    key_material = settings.ENCRYPTION_KEY or settings.SECRET_KEY
    if not key_material:
        raise EncryptionError("No encryption key configured")
    return Fernet(_derive_fernet_key(key_material))


def encrypt_value(plaintext: str) -> str:
    """Encrypt a plaintext string. Returns versioned ciphertext."""
    if not plaintext:
        return ""
    token = _get_fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")
    return f"{_KEY_VERSION}:{token}"


def decrypt_value(ciphertext: str) -> str:
    """Decrypt a versioned ciphertext string."""
    if not ciphertext:
        return ""
    if ":" in ciphertext:
        version, token = ciphertext.split(":", 1)
        if version != _KEY_VERSION:
            logger.warning("Unknown encryption key version: %s", version)
    else:
        token = ciphertext
    try:
        return _get_fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise EncryptionError("Failed to decrypt value — key may have rotated") from exc


def mask_api_key(key: str | None) -> str | None:
    """Return a masked representation safe for API responses."""
    if not key:
        return None
    if len(key) <= 8:
        return "****"
    return f"{key[:4]}...{key[-4:]}"
