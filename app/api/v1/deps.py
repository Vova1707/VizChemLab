from fastapi import Depends, Request, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.db.models import User
from app.core.session_store import active_sessions


def get_current_user(request: Request, db: Session = Depends(get_db)):
    session_id = request.cookies.get("session_id")
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user_id = int(session_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Проверяем пользователя напрямую в БД
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user


def get_current_user_optional(request: Request, db: Session = Depends(get_db)):
    session_id = request.cookies.get("session_id")
    if not session_id:
        return None
    try:
        user_id = int(session_id)
    except ValueError:
        return None
    
    # Проверяем пользователя напрямую в БД
    user = db.query(User).filter(User.id == user_id).first()
    return user