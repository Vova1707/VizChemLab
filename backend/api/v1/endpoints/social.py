from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime

from api.v1.deps import get_current_user
from db.session import get_db
from db.models import User, Invitation, Event

from pydantic import BaseModel


# Pydantic модели для документации (уже существуют в файле)
class UserSearch(BaseModel):
    """Модель пользователя для поиска"""
    id: int
    username: str
    email: str

    class Config:
        from_attributes = True

class InvitationCreate(BaseModel):
    """Модель создания приглашения"""
    receiver_id: int

class InvitationOut(BaseModel):
    """Модель ответа приглашения"""
    id: int
    sender: UserSearch
    receiver: UserSearch
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class EventCreate(BaseModel):
    """Модель создания события"""
    title: str
    description: str
    date: datetime

class EventOut(BaseModel):
    """Модель ответа события"""
    id: int
    title: str
    description: str
    date: datetime
    creator: UserSearch
    created_at: datetime

    class Config:
        from_attributes = True

router = APIRouter()


@router.get("/users/search", 
            response_model=List[UserSearch],
            summary="Поиск пользователей",
            description="Ищет пользователей по имени пользователя или email. Возвращает пользователей, кроме текущего.",
            responses={
                200: {"description": "Список пользователей найден"}
            })
def search_users(
    q: str = Query(..., min_length=1, examples=["john"], description="Строка поиска"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    users = db.query(User).filter(
        (User.username.ilike(f"%{q}%")) | (User.email.ilike(f"%{q}%"))
    ).all()
    # Filter out current user
    return [u for u in users if u.id != current_user.id]

@router.post("/invitations", 
              response_model=InvitationOut,
              summary="Создание приглашения",
              description="Создает приглашение для другого пользователя. Проверяет существование пользователя и отсутствие дубликатов.",
              responses={
                  200: {"description": "Приглашение успешно создано"},
                  400: {"description": "Приглашение уже существует"},
                  404: {"description": "Пользователь не найден"}
              })
def create_invitation(
    invitation: InvitationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    receiver = db.query(User).filter(User.id == invitation.receiver_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already invited
    existing = db.query(Invitation).filter(
        Invitation.sender_id == current_user.id,
        Invitation.receiver_id == invitation.receiver_id,
        Invitation.status == "pending"
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Invitation already pending")

    new_invitation = Invitation(
        sender_id=current_user.id,
        receiver_id=invitation.receiver_id,
        status="pending"
    )
    db.add(new_invitation)
    db.commit()
    db.refresh(new_invitation)
    return new_invitation

@router.get("/invitations", 
            response_model=List[InvitationOut],
            summary="Получение приглашений",
            description="Возвращает все ожидающие приглашения для текущего пользователя. Автоматически создает приглашение от Professor если нет других.",
            responses={
                200: {"description": "Список приглашений получен"}
            })
def get_invitations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Auto-seed if empty
    pending = db.query(Invitation).filter(
        Invitation.receiver_id == current_user.id,
        Invitation.status == "pending"
    ).all()

    if not pending:
        # Check if we have a "Professor" user
        prof = db.query(User).filter(User.username == "Professor").first()
        if not prof:
            # Create Professor
            from core.security import get_password_hash
            prof = User(
                username="Professor",
                email="prof@vizchemlab.com",
                hashed_password=get_password_hash("secret"),
                is_active=True
            )
            db.add(prof)
            db.commit()
            db.refresh(prof)
        
        if prof.id != current_user.id:
            # Check if invitation already exists (accepted/rejected)
            exists = db.query(Invitation).filter(
                Invitation.sender_id == prof.id,
                Invitation.receiver_id == current_user.id
            ).first()
            
            if not exists:
                new_inv = Invitation(
                    sender_id=prof.id,
                    receiver_id=current_user.id,
                    status="pending"
                )
                db.add(new_inv)
                db.commit()
                db.refresh(new_inv)
                pending = [new_inv]

    return pending

@router.post("/invitations/{id}/{action}", 
              response_model=InvitationOut,
              summary="Ответ на приглашение",
              description="Принимает или отклоняет приглашение. Доступные действия: accept, reject.",
              responses={
                  200: {"description": "Ответ на приглашение сохранен"},
                  400: {"description": "Недействительное действие"},
                  404: {"description": "Приглашение не найдено"}
              })
def respond_invitation(
    id: int,
    action: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if action not in ["accept", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid action")
        
    invitation = db.query(Invitation).filter(
        Invitation.id == id,
        Invitation.receiver_id == current_user.id
    ).first()
    
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
        
    if action == "accept":
        invitation.status = "accepted"
    else:
        invitation.status = "rejected"
        
    db.commit()
    db.refresh(invitation)
    return invitation

@router.post("/events", 
              response_model=EventOut,
              summary="Создание события",
              description="Создает новое событие в системе.",
              responses={
                  200: {"description": "Событие успешно создано"}
              })
def create_event(
    event: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_event = Event(
        title=event.title,
        description=event.description,
        date=event.date,
        created_by=current_user.id
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    return new_event

@router.get("/events", 
            response_model=List[EventOut],
            summary="Получение событий",
            description="Возвращает все события в системе. Автоматически создает демонстрационные события если база пуста.",
            responses={
                200: {"description": "Список событий получен"}
            })
def get_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    events = db.query(Event).all()
    if not events:
        # Create some default events
        from datetime import timedelta
        
        prof = db.query(User).filter(User.username == "Professor").first()
        if prof:
            e1 = Event(
                title="Введение в квантовую химию",
                description="Лекция о том, как квантовая механика объясняет химические свойства.",
                date=datetime.utcnow() + timedelta(days=2),
                created_by=prof.id
            )
            e2 = Event(
                title="Лабораторная работа: Титрование",
                description="Практическое занятие по кислотно-основному титрованию.",
                date=datetime.utcnow() + timedelta(days=5),
                created_by=prof.id
            )
            db.add(e1)
            db.add(e2)
            db.commit()
            db.refresh(e1)
            db.refresh(e2)
            events = [e1, e2]
            
    return events
