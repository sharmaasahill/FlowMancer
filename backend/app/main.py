"""
FlowMancer - Main FastAPI Application
AI-Powered Multi-Agent Workflow Orchestrator
"""
import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import (approvals, assistant, auth, connections, executions, knowledge, runs, system, triggers, usage,
                     use_cases, workflows)
from app.core.config import settings
from app.core.database import init_db
from app.services import demo, inbox
from app.services import knowledge as knowledge_store
from app.services.limits import RunLimitError

log = logging.getLogger("flowmancer")


def _rebuild_knowledge():
    try:
        rebuilt = knowledge_store.rebuild_missing()
        if rebuilt:
            log.info("Re-indexed %d knowledge document(s) from the database", rebuilt)
    except Exception:
        log.warning("Could not rebuild the knowledge index", exc_info=True)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    # In the background: the embedding model may need to load, and the server should answer meanwhile
    threading.Thread(target=_rebuild_knowledge, name="knowledge-rebuild", daemon=True).start()
    inbox.start_background_polling()
    demo.start_scheduler()
    log.info("%s v%s started. Docs: /api/docs", settings.APP_NAME, settings.APP_VERSION)
    yield
    inbox.stop_background_polling()
    demo.stop_scheduler()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-Powered Multi-Agent Workflow Orchestration Platform",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],  # file name of CSV exports
)


@app.get("/")
def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/api/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy", "app": settings.APP_NAME, "version": settings.APP_VERSION}


for module in (auth, assistant, use_cases, runs, approvals, knowledge, triggers, workflows, executions, system, usage,
               connections):
    app.include_router(module.router, prefix="/api")


@app.exception_handler(RunLimitError)
async def run_limit_handler(request: Request, exc: RunLimitError):
    return JSONResponse(status_code=429, content={"detail": str(exc)})


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc) if settings.DEBUG else None},
    )
