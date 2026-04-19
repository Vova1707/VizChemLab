from fastapi import APIRouter, Depends, Body, Request
from sqlalchemy.orm import Session
from db.session import get_db
from db.models import UserSession, User
from api.v1.deps import get_current_user, get_current_user_optional
import json
from datetime import datetime
from pydantic import BaseModel
from typing import Any, Dict



class SessionDataResponse(BaseModel):
    """Модель ответа с данными сессии"""
    data: Dict[str, Any]
    
class SessionStatusResponse(BaseModel):
    """Модель ответа со статусом операции"""
    status: str

router = APIRouter()

@router.get("/api/session/get",
            response_model=SessionDataResponse,
            summary="Получение данных сессии",
            description="Возвращает сохраненные данные сессии текущего пользователя. Для гостей возвращает пустые данные.",
            responses={
                200: {"description": "Данные сессии успешно получены"}
            })
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

@router.post("/api/session/set",
             response_model=SessionStatusResponse,
             summary="Сохранение данных сессии",
             description="Сохраняет данные сессии для текущего пользователя. Для гостей данные не сохраняются.",
             responses={
                 200: {"description": "Данные успешно сохранены", "content": {"application/json": {"example": {"status": "success"}}}}
             })
async def set_session_data(
    data: dict = Body(..., example={"molecule_data": {"atoms": [], "bonds": []}}, description="Данные для сохранения в сессии"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    if not current_user:
        return {"status": "guest_no_save"}
    session = db.query(UserSession).filter(UserSession.user_id == current_user.id).first()
    if session:
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
