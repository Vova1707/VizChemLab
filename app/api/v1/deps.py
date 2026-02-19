from fastapi import Depends, Request, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import User


def get_current_user(request: Request, db: Session = Depends(get_db)):
    session_id = request.cookies.get("session_id")
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user_id = int(session_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid session")
    
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
    user = db.query(User).filter(User.id == user_id).first()
    return user