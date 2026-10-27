"""
Turn uploaded files into plain text.
Supported: PDF (text-based, not scanned images), TXT, MD, CSV, JSON, HTML.
"""
import io
from pathlib import Path

from app.services.research import html_to_text

TEXT_TYPES = {".txt", ".md", ".csv", ".json", ".log"}
SUPPORTED = TEXT_TYPES | {".pdf", ".html", ".htm"}


class ExtractionError(ValueError):
    pass


def extract_text(filename: str, data: bytes) -> str:
    ext = Path(filename or "").suffix.lower()
    if ext not in SUPPORTED:
        raise ExtractionError(f"Unsupported file type '{ext or 'none'}'. Supported: {', '.join(sorted(SUPPORTED))}")

    if ext == ".pdf":
        import pdfplumber
        try:
            with pdfplumber.open(io.BytesIO(data)) as pdf:
                text = "\n\n".join((page.extract_text() or "") for page in pdf.pages[:50])
        except Exception as e:
            raise ExtractionError(f"Could not read PDF: {e}")
        if not text.strip():
            raise ExtractionError("No text found in PDF. Scanned/image PDFs need OCR, which isn't supported yet.")
        return text.strip()

    decoded = data.decode("utf-8", errors="replace")
    if ext in (".html", ".htm"):
        return html_to_text(decoded)[1]
    if not decoded.strip():
        raise ExtractionError("File is empty.")
    return decoded.strip()
