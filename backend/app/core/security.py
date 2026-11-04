"""
Passwords and login tokens.

Passwords are hashed with scrypt (Python standard library, memory-hard).
Login tokens are signed JWTs (HS256) that carry the user id and expire.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import httpx
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


# ---------- secrets at rest (integration credentials) ----------
def _fernet():
    from cryptography.fernet import Fernet

    key = hashlib.sha256(("flowmancer-connections:" + jwt_secret()).encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt(data: dict) -> str:
    """Encrypt a small dict (Fernet: AES + HMAC). The key is derived from JWT_SECRET."""
    return _fernet().encrypt(json.dumps(data).encode()).decode()


def decrypt(token: str) -> Optional[dict]:
    """The dict from encrypt(), or None if it can't be read (e.g. JWT_SECRET changed)."""
    from cryptography.fernet import InvalidToken

    try:
        return json.loads(_fernet().decrypt(token.encode()))
    except (InvalidToken, ValueError, TypeError):
        return None


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


GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


def verify_google_access_token(access_token: str) -> dict:
    """
    Check an access token from Google's sign-in popup (used by FlowMancer's own styled button).
    Google must confirm the token is valid, unexpired and was issued to *our* client ID, so a token
    obtained by another app can't be replayed here. Then the account's id, email and name are read
    from Google. Returns claims in the same shape as an ID token, for accounts.google_sign_in().
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise GoogleTokenError("Google sign-in is not set up on this server.")
    unreachable = "Google sign-in failed: could not reach Google. Please try again."
    unexpected = "Google sign-in failed: unexpected response from Google."

    # 1. Is the token real, unexpired, and ours? (Checked before the token is used for anything.)
    try:
        info_resp = httpx.get(GOOGLE_TOKENINFO_URL, params={"access_token": access_token}, timeout=10)
    except httpx.HTTPError as e:
        raise GoogleTokenError(unreachable) from e
    if info_resp.status_code != 200:
        raise GoogleTokenError("Google sign-in failed: the token is invalid or has expired.")
    try:
        info = info_resp.json()
        expires_in = int(info.get("expires_in") or 0)
    except (ValueError, TypeError) as e:
        raise GoogleTokenError(unexpected) from e
    if info.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise GoogleTokenError("Google sign-in failed: the token was issued to a different app.")
    if expires_in <= 0:
        raise GoogleTokenError("Google sign-in failed: the token has expired.")

    # 2. Who is it?
    try:
        user_resp = httpx.get(GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}, timeout=10)
    except httpx.HTTPError as e:
        raise GoogleTokenError(unreachable) from e
    if user_resp.status_code != 200:
        raise GoogleTokenError("Google sign-in failed: the token is invalid or has expired.")
    try:
        user = user_resp.json()
    except ValueError as e:
        raise GoogleTokenError(unexpected) from e
    if not user.get("sub") or user.get("sub") != info.get("sub"):
        raise GoogleTokenError("Google sign-in failed: the account details don't match.")
    verified = user.get("email_verified", info.get("email_verified"))
    return {
        "sub": user["sub"],
        "email": user.get("email") or info.get("email"),
        "email_verified": verified is True or str(verified).lower() == "true",
        "name": user.get("name"),
    }
