"""Settings that are often pasted into a hosting dashboard by hand."""
import pytest

from app.core.config import Settings

VERCEL = "https://flowmancer.vercel.app"


@pytest.mark.parametrize("raw, expected", [
    (f'["{VERCEL}"]', [VERCEL]),
    (VERCEL, [VERCEL]),
    (f"{VERCEL}/", [VERCEL]),                       # trailing slash never matches a browser Origin
    (f"[{VERCEL}]", [VERCEL]),                      # brackets without quotes
    (f"\u201c{VERCEL}\u201d", [VERCEL]),            # smart quotes from a document
    (f"{VERCEL}, http://localhost:3000", [VERCEL, "http://localhost:3000"]),
    (f'["{VERCEL}/", "http://localhost:3000"]', [VERCEL, "http://localhost:3000"]),
])
def test_cors_origins_accepts_common_formats(monkeypatch, raw, expected):
    monkeypatch.setenv("CORS_ORIGINS", raw)
    assert Settings().CORS_ORIGINS == expected


@pytest.mark.parametrize("raw", ["postgres://u:p@h/db?sslmode=require", "postgresql://u:p@h/db"])
def test_hosted_postgres_urls_use_the_installed_driver(monkeypatch, raw):
    monkeypatch.setenv("DATABASE_URL", raw)
    assert Settings().DATABASE_URL.startswith("postgresql+psycopg2://u:p@h/db")
