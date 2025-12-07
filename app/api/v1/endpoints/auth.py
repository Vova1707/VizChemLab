from fastapi import APIRouter, Request, Form, Depends, BackgroundTasks, Body, Response
from fastapi.responses import RedirectResponse, HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.encoders import jsonable_encoder
from fastapi import status

from sqlalchemy.orm import Session

from passlib.context import CryptContext

from app.db.session import get_db
from app.db.models import User

from app.core.session_store import active_sessions
from app.core.security import get_password_hash, verify_password, generate_verification_token

from app.utils.email import send_verification_email, send_reset_password_email

import logging
from app.api.v1.deps import get_current_user


router = APIRouter()
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
templates = Jinja2Templates(directory="app/templates/")



@router.get("/register", response_class=HTMLResponse)
def register_page(request: Request):
    return templates.TemplateResponse("auth/register.html", {"request": request})


@router.post("/register", response_class=HTMLResponse)
async def register(
    request: Request,
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db)
):

    if db.query(User).filter(User.email == email).first():
        return templates.TemplateResponse("auth/register.html", {"request": request, "text": "Пользователь уже зарегистрирован"})

    hashed_pw = get_password_hash(password)
    user = User(username=username, email=email, hashed_password=hashed_pw)
    db.add(user)
    db.commit()
    db.refresh(user)

    token = generate_verification_token(email)
    background_tasks.add_task(send_verification_email, email, token)

    return HTMLResponse(
        content="<h2>Регистрация успешна!</h2><p>Проверьте почту для подтверждения регистрации.</p><a href='/'>← На главную</a>"
    )


@router.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse("auth/login.html", {"request": request})


@router.post("/login", response_class=HTMLResponse)
def login(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == email).first()


    if not user or not verify_password(password, user.hashed_password):
        return templates.TemplateResponse("auth/return_login.html", {"request": request, "text": "Неверный логин или пароль"})


    if not user.is_verified:
        return templates.TemplateResponse("auth/return_login.html", {"request": request, "text": "Почта не подтверждена"})


    active_sessions.add(user.id)
    response = RedirectResponse(url="/", status_code=303)
    response.set_cookie(key="session_id", value=str(user.id), httponly=True, samesite="lax")
    return response



@router.get("/verify-email", response_class=HTMLResponse)
def verify_email(token: str, db: Session = Depends(get_db)):
    from app.core.security import verify_token
    email = verify_token(token)
    if not email:
        return templates.TemplateResponse("auth/return_login.html", {"text": "Ссылка недействительна"}, status_code=400)

    user = db.query(User).filter(User.email == email).first()
    if not user:
        return templates.TemplateResponse("auth/return_login.html", {"text": "Пользователь не найден"}, status_code=404)

    if user.is_verified:
        return templates.TemplateResponse("auth/return_login.html", {"text": "Email уже подтверждён!"}, status_code=400)

    user.is_verified = True
    db.commit()

    return templates.TemplateResponse("auth/return_login.html", {"text": "Email успешно подтверждён!"})


@router.post("/logout", response_class=HTMLResponse)
def logout(request: Request):
    session_id = request.cookies.get("session_id")
    if session_id and session_id.isdigit():
        user_id = int(session_id)
        active_sessions.discard(user_id)    

    response = RedirectResponse(url="/", status_code=303)
    response.delete_cookie("session_id")
    return response




from app.core.security import generate_password_reset_token, verify_password_reset_token

@router.get("/forgot-password", response_class=HTMLResponse)
def forgot_password_page(request: Request):
    return templates.TemplateResponse("auth/forgot_password.html", {"request": request})

@router.post("/forgot-password", response_class=HTMLResponse)
async def forgot_password(
    request: Request,
    email: str = Form(...),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == email).first()
    if user:
        token = generate_password_reset_token(email)
        background_tasks.add_task(send_reset_password_email, email, token)

    return templates.TemplateResponse("auth/return_login.html", {"request": request, "text": "Письмо отправлено на почту"})



@router.get("/reset-password", response_class=HTMLResponse)
def reset_password_page(request: Request, token: str):

    email = verify_password_reset_token(token)
    if not email:
        return templates.TemplateResponse("auth/return_login.html", {"request": request, "text": "Ссылка недействительна"})
    
    return templates.TemplateResponse("auth/reset_password.html", {"request": request, "token": token})



@router.post("/reset-password", response_class=HTMLResponse)
def reset_password(
    request: Request,
    token: str = Form(...),
    new_password: str = Form(...),
    db: Session = Depends(get_db)
):
    print
    email = verify_password_reset_token(token)
    if not email:
        return templates.TemplateResponse("auth/return_login.html", {"request": request, "text": "Ссылка недействительна"})

    user = db.query(User).filter(User.email == email).first()
    if not user:
        return templates.TemplateResponse("auth/return_login.html", {"request": request, "text": "Пользователь не найден"}, status_code=404)

    hashed_pw = get_password_hash(new_password)
    user.hashed_password = hashed_pw
    db.commit()

    return templates.TemplateResponse("auth/return_login.html", {"request": request, "text": "Пароль успешно изменён!"})


@router.post("/api/register")
async def api_register(
    username: str = Body(...),
    email: str = Body(...),
    password: str = Body(...),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db)
):
    logger = logging.getLogger(__name__)
    if db.query(User).filter(User.email == email).first():
        logger.info(f"/api/register: Попытка регистрации с уже существующим email: {email}")
        return JSONResponse(status_code=400, content={"success": False, "message": "Пользователь уже зарегистрирован"})
    hashed_pw = get_password_hash(password)
    user = User(username=username, email=email, hashed_password=hashed_pw)
    db.add(user)
    db.commit()
    db.refresh(user)
    token = generate_verification_token(email)
    if background_tasks:
        background_tasks.add_task(send_verification_email, email, token)
    logger.info(f"/api/register: Успешная регистрация {email}")
    return JSONResponse(content={"success": True, "message": "Регистрация успешна! Проверьте почту."})

@router.post("/api/login")
def api_login(
    response: Response,
    email: str = Body(...),
    password: str = Body(...),
    db: Session = Depends(get_db)
):
    logger = logging.getLogger(__name__)
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        logger.info(f"/api/login: Ошибка входа для пользователя {email}")
        return JSONResponse({"success": False, "message": "Неверный email или пароль."}, status_code=401)
    if not user.is_verified:
        logger.info(f"/api/login: Почта не подтверждена для {email}")
        return JSONResponse({"success": False, "message": "Почта не подтверждена."}, status_code=403)
    active_sessions.add(user.id)
    response.set_cookie(key="session_id", value=str(user.id), httponly=True, samesite="lax")
    logger.info(f"/api/login: Вход выполнен {email}")
    return {"success": True, "message": "Вход успешен."}

@router.post("/api/forgot-password")
async def api_forgot_password(
    email: str = Body(...),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db)
):
    logger = logging.getLogger(__name__)
    user = db.query(User).filter(User.email == email).first()
    if user:
        token = generate_password_reset_token(email)
        if background_tasks:
            background_tasks.add_task(send_reset_password_email, email, token)
        logger.info(f"/api/forgot-password: Токен для {email} отправлен")
    return {"success": True, "message": "Если email существует, инструкция отправлена."}

@router.post("/api/reset-password")
def api_reset_password(
    token: str = Body(...),
    new_password: str = Body(...),
    db: Session = Depends(get_db)
):
    logger = logging.getLogger(__name__)
    email = verify_password_reset_token(token)
    if not email:
        logger.info(f"/api/reset-password: неверный токен")
        return JSONResponse({"success": False, "message": "Ссылка недействительна."}, status_code=400)
    user = db.query(User).filter(User.email == email).first()
    if not user:
        logger.info(f"/api/reset-password: пользователь не найден для токена")
        return JSONResponse({"success": False, "message": "Пользователь не найден."}, status_code=404)
    hashed_pw = get_password_hash(new_password)
    user.hashed_password = hashed_pw
    db.commit()
    logger.info(f"/api/reset-password: пароль изменён для {email}")
    return {"success": True, "message": "Пароль успешно изменён!"}

@router.get("/api/verify-email")
def api_verify_email(token: str, db: Session = Depends(get_db)):
    logger = logging.getLogger(__name__)
    from app.core.security import verify_token
    email = verify_token(token)
    if not email:
        logger.info("/api/verify-email: невалидный токен")
        return JSONResponse({"success": False, "message": "Ссылка недействительна."}, status_code=400)
    user = db.query(User).filter(User.email == email).first()
    if not user:
        logger.info("/api/verify-email: пользователь не найден")
        return JSONResponse({"success": False, "message": "Пользователь не найден."}, status_code=404)
    if user.is_verified:
        return {"success": False, "message": "Email уже подтверждён!"}
    user.is_verified = True
    db.commit()
    logger.info(f"/api/verify-email: email подтверждён для {email}")
    return {"success": True, "message": "Email успешно подтверждён!"}

@router.get("/api/me")
def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_verified": user.is_verified,
        "is_admin": user.is_admin
    }