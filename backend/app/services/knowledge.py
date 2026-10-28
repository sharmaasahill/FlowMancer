"""
Company knowledge base (RAG).

Documents are split into overlapping chunks and stored in a local ChromaDB
collection. Embeddings use Chroma's built-in all-MiniLM-L6-v2 model (downloaded
once, ~80 MB, runs on CPU). Nothing is sent to an external service.
"""
import threading
from typing import List, Optional

from app.core.config import settings

COLLECTION = "flowmancer_knowledge"
CHUNK_SIZE = 900
CHUNK_OVERLAP = 150

_lock = threading.Lock()
_collection = None


def embedding_function():
    """Embedding function for the collection. Tests replace this with a fast fake."""
    return None  # None -> Chroma's default local model


def _get_collection():
    global _collection
    with _lock:
        if _collection is None:
            import chromadb
            from chromadb.config import Settings as ChromaSettings

            client = chromadb.PersistentClient(
                path=settings.KNOWLEDGE_PATH,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            kwargs = {"metadata": {"hnsw:space": "cosine"}}
            ef = embedding_function()
            if ef is not None:
                kwargs["embedding_function"] = ef
            _collection = client.get_or_create_collection(COLLECTION, **kwargs)
        return _collection


def reset_cache():
    global _collection
    with _lock:
        _collection = None


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """Split on paragraph boundaries where possible, falling back to hard cuts."""
    text = text.replace("\r\n", "\n").strip()
    if not text:
        return []
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: List[str] = []
    current = ""
    for para in paragraphs:
        while len(para) > size:  # very long paragraph: hard split
            if current:
                chunks.append(current)
                current = ""
            chunks.append(para[:size])
            para = para[size - overlap:]
        if len(current) + len(para) + 2 <= size:
            current = f"{current}\n\n{para}" if current else para
        else:
            if current:
                chunks.append(current)
            tail = current[-overlap:] if current else ""
            current = f"{tail}\n\n{para}".strip() if tail else para
    if current:
        chunks.append(current)
    return chunks


def add_document(doc_id: int, name: str, text: str) -> int:
    chunks = chunk_text(text)
    if not chunks:
        return 0
    _get_collection().add(
        ids=[f"{doc_id}-{i}" for i in range(len(chunks))],
        documents=chunks,
        metadatas=[{"doc_id": doc_id, "doc_name": name, "chunk": i} for i in range(len(chunks))],
    )
    return len(chunks)


def delete_document(doc_id: int):
    _get_collection().delete(where={"doc_id": doc_id})


def is_indexed(doc_id: int) -> bool:
    return bool(_get_collection().get(where={"doc_id": doc_id}, limit=1)["ids"])


def rebuild_missing() -> int:
    """
    Re-index documents whose chunks are missing from the vector store, using the text kept
    in the database. Hosts with a temporary disk (most free tiers) lose the store on every
    restart; the database is the source of truth. Returns how many documents were re-indexed.
    """
    from app.core.database import session_scope
    from app.models import KnowledgeDocument

    rebuilt = 0
    with session_scope() as db:
        docs = db.query(KnowledgeDocument).filter(KnowledgeDocument.text.isnot(None)).all()
        for doc in docs:
            if doc.text and not is_indexed(doc.id):
                doc.chunks = add_document(doc.id, doc.name, doc.text)
                rebuilt += 1
        db.commit()
    return rebuilt


def search(query: str, k: int = 4, max_distance: float = 0.75, doc_ids: Optional[List[int]] = None) -> List[dict]:
    """
    Top-k relevant chunks. Chunks beyond `max_distance` (cosine) are treated as unrelated.
    `doc_ids` limits the search to those documents (one user's library); None searches everything.
    """
    query = (query or "").strip()
    if not query or doc_ids == []:
        return []
    collection = _get_collection()
    if collection.count() == 0:
        return []
    kwargs = {"where": {"doc_id": {"$in": list(doc_ids)}}} if doc_ids is not None else {}
    res = collection.query(query_texts=[query[:2000]], n_results=min(k, collection.count()), **kwargs)
    out = []
    for text, meta, dist in zip(res["documents"][0], res["metadatas"][0], res["distances"][0]):
        if dist is not None and dist > max_distance:
            continue
        out.append({
            "doc_id": meta.get("doc_id"),
            "doc_name": meta.get("doc_name"),
            "text": text,
            "score": round(1 - float(dist), 3) if dist is not None else None,
        })
    return out


def as_prompt(snippets: List[dict]) -> Optional[str]:
    if not snippets:
        return None
    lines = ["Company knowledge base (official information; prefer it over guessing):"]
    for i, s in enumerate(snippets, 1):
        lines.append(f"[K{i}] from '{s['doc_name']}':\n{s['text']}")
    return "\n\n".join(lines)
