"""
Database Configuration and Session Management
"""
import logging
from contextlib import contextmanager

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

log = logging.getLogger("flowmancer.db")

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    # SQLite: allow use from the worker threads that run AI jobs
    connect_args={"check_same_thread": False, "timeout": 30} if _is_sqlite else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency: one session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope():
    """Session for background work outside a request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def add_missing_columns():
    """
    Tiny forward-only migration: add model columns that an existing table lacks.
    Only nullable columns are added, so existing rows stay valid. (Renames and drops
    still need a manual step.)
    """
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if table.name not in existing_tables:
                continue
            present = {c["name"] for c in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in present or not column.nullable:
                    continue
                col_type = column.type.compile(dialect=engine.dialect)
                conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {col_type}'))
                if column.index:
                    conn.execute(text(f'CREATE INDEX IF NOT EXISTS "ix_{table.name}_{column.name}" '
                                      f'ON "{table.name}" ("{column.name}")'))
                log.info("Added column %s.%s", table.name, column.name)


def init_db():
    """Create missing tables and columns."""
    import app.models  # noqa: F401  (registers models)
    Base.metadata.create_all(bind=engine)
    add_missing_columns()
