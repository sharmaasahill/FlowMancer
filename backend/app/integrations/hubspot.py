"""
HubSpot CRM: create or update a contact by email.
Needs a HubSpot Service Key (or a legacy private app token) with the
crm.objects.contacts.read and crm.objects.contacts.write scopes. It is sent as a Bearer token.
"""
from typing import Optional

import httpx

UPSERT_URL = "https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert"
CHECK_URL = "https://api.hubapi.com/crm/v3/objects/contacts"
ALLOWED_PROPERTIES = {"email", "firstname", "lastname", "company", "phone", "website", "jobtitle"}


def upsert_contact(contact: dict, token: Optional[str] = None) -> dict:
    if not token:
        return {"status": "skipped", "detail": "HubSpot not connected"}
    email = (contact.get("email") or "").strip()
    if not email:
        return {"status": "error", "detail": "Contact has no email"}

    properties = {k: str(v) for k, v in contact.items() if k in ALLOWED_PROPERTIES and v}
    body = {"inputs": [{"idProperty": "email", "id": email, "properties": properties}]}
    try:
        resp = httpx.post(
            UPSERT_URL,
            json=body,
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        if resp.status_code >= 400:
            return {"status": "error", "detail": f"HubSpot {resp.status_code}: {resp.text[:300]}"}
        results = resp.json().get("results", [])
        contact_id = results[0].get("id") if results else None
        return {"status": "success", "detail": f"HubSpot contact {contact_id or email} saved", "contact_id": contact_id}
    except httpx.HTTPError as e:
        return {"status": "error", "detail": f"HubSpot error: {e}"}


def check_token(token: str) -> None:
    """Read one contact to prove the key works and has the contacts scope. Raises with a readable message."""
    try:
        resp = httpx.get(CHECK_URL, params={"limit": 1}, headers={"Authorization": f"Bearer {token}"}, timeout=15)
    except httpx.HTTPError as e:
        raise RuntimeError(f"Can't reach HubSpot: {e}") from e
    if resp.status_code == 401:
        raise RuntimeError("HubSpot rejected the key. Copy it again from Development > Keys > Service Keys.")
    if resp.status_code == 403:
        raise RuntimeError("The key works but lacks the crm.objects.contacts.read and .write scopes.")
    if resp.status_code >= 400:
        raise RuntimeError(f"HubSpot returned {resp.status_code}: {resp.text[:200]}")
