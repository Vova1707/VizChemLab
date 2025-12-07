from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings

# Создаём движок (engine)
# Для SQLite важно указать connect_args={"check_same_thread": False}
connect_args = {}
if str(settings.DATABASE_URL).startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    str(settings.DATABASE_URL),
    connect_args=connect_args,
    echo=True
)

# Создаём фабрику сессий
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Зависимость для FastAPI — получение сессии БД
def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()