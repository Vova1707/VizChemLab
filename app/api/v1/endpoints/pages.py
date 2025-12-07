from fastapi import APIRouter, Request, Depends, Body
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import User
from app.core.session_store import active_sessions
from app.core.config import settings
import httpx
import logging
import json

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")
logger = logging.getLogger(__name__)


def get_optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    session_id = request.cookies.get("session_id")
    if not session_id:
        return None
    try:
        user_id = int(session_id)
    except (ValueError, TypeError):
        return None
    if user_id not in active_sessions:
        return None
    return db.query(User).filter(User.id == user_id).first()


@router.get("/")
def index(request: Request, user: User | None = Depends(get_optional_user)):
    return templates.TemplateResponse("index.html", {"request": request, "user": user})


@router.get("/register")
def register_page(request: Request, user: User | None = Depends(get_optional_user)):
    if user:
        return RedirectResponse(url="/", status_code=303)
    return templates.TemplateResponse("auth/register.html", {"request": request, "user": user})



@router.get("/profile")
def profile_page(request: Request, user: User = Depends(get_optional_user)):
    return templates.TemplateResponse("profile.html", {"request": request, "user": user})