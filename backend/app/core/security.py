"""
Passwords and login tokens.

Passwords are hashed with scrypt (Python standard library, memory-hard).
Login tokens are signed JWTs (HS256) that carry the user id and expire.
"""
import base64
import hashlib
import hmac
import os
import secrets
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import jwt

from app.core.config import settings

_SCRYPT = {"n": 2 ** 14, "r": 8, "p": 1}
_ALGORITHM = "HS256"
_SECRET_FILE = Path(".flowmancer_secret")
_lock = threading.Lock()
_secret: Optional[str] = None


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, dklen=32, **_SCRYPT)
    return f"scrypt${_SCRYPT['n']}${_SCRYPT['r']}${_SCRYPT['p']}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt, digest = stored.split("$")
        if scheme != "scrypt":
            return False
        candidate = hashlib.scrypt(password.encode(), salt=_unb64(salt), dklen=32, n=int(n), r=int(r), p=int(p))
        return hmac.compare_digest(candidate, _unb64(digest))
    except (ValueError, TypeError):
        return False


def jwt_secret() -> str:
    """JWT_SECRET from settings, or a generated one persisted next to the database."""
    global _secret
    if settings.JWT_SECRET:
        return settings.JWT_SECRET
    with _lock:
        if _secret is None:
            if _SECRET_FILE.exists():
                _secret = _SECRET_FILE.read_text(encoding="utf-8").strip()
            if not _secret:
                _secret = secrets.token_urlsafe(48)
                _SECRET_FILE.write_text(_secret, encoding="utf-8")
        return _secret


def create_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "iat": now, "exp": now + timedelta(days=settings.ACCESS_TOKEN_DAYS)}
    return jwt.encode(payload, jwt_secret(), algorithm=_ALGORITHM)


def decode_token(token: str) -> Optional[int]:
    """User id from a valid token, or None."""
    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=[_ALGORITHM], options={"require": ["exp", "sub"]})
        return int(payload["sub"])
    except (jwt.InvalidTokenError, ValueError, KeyError):
        return None


def new_trigger_key() -> str:
    return "fmk_" + secrets.token_urlsafe(24)


class GoogleTokenError(ValueError):
    """The Google ID token is invalid, expired, or for another app."""


def verify_google_token(credential: str) -> dict:
    """
    Check a "Sign in with Google" ID token: Google's signature, expiry, issuer, and that it
    was issued for our client ID. Returns the token's claims (sub, email, email_verified, name).
    Google's public keys are fetched over HTTPS by google-auth.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise GoogleTokenError("Google sign-in is not set up on this server.")
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token

    try:
        claims = id_token.verify_oauth2_token(credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID,
                                              clock_skew_in_seconds=10)
    except ValueError as e:  # bad signature, wrong audience, expired, malformed
        raise GoogleTokenError(f"Google sign-in failed: {e}") from e
    if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise GoogleTokenError("Google sign-in failed: unexpected issuer.")
    return claims
