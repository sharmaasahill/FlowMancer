"""
HubSpot CRM: create or update a contact by email.
Needs a HubSpot Service Key (or a legacy private app token) with the
crm.objects.contacts.read and crm.objects.contacts.write scopes. It is sent as a Bearer token.
"""
import httpx
from app.core.config import settings

UPSERT_URL = "https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert"
ALLOWED_PROPERTIES = {"email", "firstname", "lastname", "company", "phone", "website", "jobtitle"}


def upsert_contact(contact: dict) -> dict:
    token = settings.HUBSPOT_ACCESS_TOKEN
    if not token:
        return {"status": "skipped", "detail": "HUBSPOT_ACCESS_TOKEN not configured"}
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
