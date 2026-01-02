from fastapi import APIRouter, Depends, Body, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import UserSession, User
from app.api.v1.deps import get_current_user, get_current_user_optional
import json
from datetime import datetime

router = APIRouter()

@router.get("/api/session/get")
async def get_session_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    if not current_user:
        return {"data": {}}
    session = db.query(UserSession).filter(UserSession.user_id == current_user.id).first()
    if not session:
        return {"data": {}}
    try:
        data = json.loads(session.data)
    except:
        data = {}
    return {"data": data}

@router.post("/api/session/set")
async def set_session_data(
    data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    if not current_user:
        return {"status": "guest_no_save"}
    session = db.query(UserSession).filter(UserSession.user_id == current_user.id).first()
    if session:
        # Merge existing data with new data
        try:
            existing_data = json.loads(session.data)
        except:
            existing_data = {}
        
        existing_data.update(data)
        session.data = json.dumps(existing_data)
        session.updated_at = datetime.utcnow()
    else:
        session = UserSession(
            user_id=current_user.id,
            data=json.dumps(data)
        )
        db.add(session)
    
    db.commit()
    return {"status": "success"}
