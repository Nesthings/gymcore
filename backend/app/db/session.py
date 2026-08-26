from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.resolved_database_url,
    pool_pre_ping=True,
    # Pool reducido: Supabase (session pooler) limita a 15 conexiones y el pool
    # comparte ese límite con otros clientes. 2+4 deja margen y evita
    # "max clients reached" bajo carga.
    pool_size=2,
    max_overflow=4,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
