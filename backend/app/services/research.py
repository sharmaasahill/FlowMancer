"""
Real lead research: web search (DuckDuckGo, no API key) plus the company's own website.

Privacy note: when RESEARCH_ENABLED=true, the company name and email domain are sent
to DuckDuckGo, and the company website is fetched from this machine.
"""
import ipaddress
import re
import socket
from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import List, Optional
from urllib.parse import urlparse

import httpx

from app.core.config import settings

FREE_EMAIL_DOMAINS = {
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "outlook.com", "hotmail.com",
    "live.com", "msn.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com",
    "gmx.com", "yandex.com", "mail.com", "zoho.com", "rediffmail.com",
}

FETCH_TIMEOUT = 8.0
MAX_PAGE_BYTES = 1_000_000


@dataclass
class ResearchResult:
    sources: List[dict] = field(default_factory=list)  # {title, url, snippet}
    note: str = ""

    def as_prompt(self) -> str:
        if not self.sources:
            return f"No external research available. {self.note}".strip()
        lines = ["Research findings (real sources; cite the URL when you use a fact):"]
        for i, s in enumerate(self.sources, 1):
            lines.append(f"[{i}] {s['title']} - {s['url']}\n    {s['snippet']}")
        return "\n".join(lines)


class _TextExtractor(HTMLParser):
    """Collects visible text and the <title>; skips scripts/styles."""

    def __init__(self):
        super().__init__()
        self.parts: List[str] = []
        self.title = ""
        self._skip = 0
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript", "svg"):
            self._skip += 1
        elif tag == "title":
            self._in_title = True

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "svg") and self._skip:
            self._skip -= 1
        elif tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        elif not self._skip:
            text = data.strip()
            if text:
                self.parts.append(text)


def html_to_text(html: str) -> tuple[str, str]:
    """Return (title, visible text)."""
    parser = _TextExtractor()
    try:
        parser.feed(html)
    except Exception:
        pass
    text = re.sub(r"\s+", " ", " ".join(parser.parts)).strip()
    return parser.title.strip(), text


def company_domain(email: Optional[str]) -> Optional[str]:
    """Business domain from an email address, or None for free mail providers."""
    if not email or "@" not in email:
        return None
    domain = email.rsplit("@", 1)[1].strip().lower()
    if not re.fullmatch(r"[a-z0-9.-]+\.[a-z]{2,}", domain) or domain in FREE_EMAIL_DOMAINS:
        return None
    return domain


def is_public_host(host: str) -> bool:
    """True only if every address the host resolves to is public (blocks localhost/LAN fetches)."""
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            return False
    return bool(infos)


def fetch_website(domain: str) -> Optional[dict]:
    """Fetch the homepage of `domain` and return a source dict, or None."""
    for host in (domain, f"www.{domain}"):
        if not is_public_host(host):
            continue
        try:
            with httpx.Client(timeout=FETCH_TIMEOUT, follow_redirects=False,
                              headers={"User-Agent": "FlowMancer-Research/2.0"}) as client:
                url = f"https://{host}/"
                # Follow a few redirects manually so each hop is checked as public
                for _ in range(4):
                    resp = client.get(url)
                    if resp.is_redirect and "location" in resp.headers:
                        nxt = httpx.URL(url).join(resp.headers["location"])
                        if nxt.scheme not in ("http", "https") or not is_public_host(nxt.host):
                            break
                        url = str(nxt)
                        continue
                    break
                if resp.status_code != 200 or "html" not in resp.headers.get("content-type", ""):
                    continue
                title, text = html_to_text(resp.text[:MAX_PAGE_BYTES])
                if not text:
                    continue
                return {"title": title or domain, "url": url, "snippet": text[:900]}
        except httpx.HTTPError:
            continue
    return None


def _url_key(url: str) -> str:
    """Normalize a URL for de-duplication (ignore scheme, www. and trailing slash)."""
    p = urlparse(url)
    host = p.netloc.lower().removeprefix("www.")
    return f"{host}{p.path.rstrip('/')}"


def web_search(query: str, max_results: int) -> List[dict]:
    from ddgs import DDGS

    hits = DDGS().text(query, max_results=max_results) or []
    return [
        {"title": h.get("title", ""), "url": h.get("href", ""), "snippet": (h.get("body") or "")[:400]}
        for h in hits if h.get("href")
    ]


def research_lead(lead: dict) -> ResearchResult:
    """Gather real information about the lead's company."""
    if not settings.RESEARCH_ENABLED:
        return ResearchResult(note="Research is disabled (RESEARCH_ENABLED=false).")

    company = (lead.get("company") or "").strip()
    domain = company_domain(lead.get("email"))
    if not company and not domain:
        return ResearchResult(note="No company name or business email domain to research.")

    result = ResearchResult()
    seen = set()

    if domain:
        site = fetch_website(domain)
        if site:
            result.sources.append(site)
            seen.add(_url_key(site["url"]))

    query = " ".join(p for p in (f'"{company}"' if company else "", domain or "", "company") if p)
    try:
        for hit in web_search(query, settings.RESEARCH_MAX_RESULTS):
            key = _url_key(hit["url"])
            if key in seen:
                continue
            seen.add(key)
            result.sources.append(hit)
    except Exception as e:  # network down, rate limited, etc.
        result.note = f"Web search failed: {e}"

    if not result.sources and not result.note:
        result.note = "Nothing found for this company."
    return result
