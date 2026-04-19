from fastapi import APIRouter, Request, Form, Depends, BackgroundTasks, Body, Response
from fastapi.responses import JSONResponse
from starlette.responses import Response as StarletteResponse
from pydantic import BaseModel, EmailStr, Field
from typing import Optional

from sqlalchemy.orm import Session

from db.session import get_db
from db.models import User
from core.security import get_password_hash, verify_password, generate_password_reset_token, verify_password_reset_token

from utils.email import send_reset_password_email

import logging
from api.v1.deps import get_current_user, get_current_user_optional


class RegisterRequest(BaseModel):
    username: str = Field(..., example="user2", description="Имя пользователя")
    email: EmailStr = Field(..., example="user2@test.ru", description="Email пользователя")
    password: str = Field(..., example="password2", description="Пароль пользователя")
    
class LoginRequest(BaseModel):
    email: EmailStr = Field(..., example="user2@test.ru", description="Email пользователя")
    password: str = Field(..., example="password2", description="Пароль пользователя")
    
class ForgotPasswordRequest(BaseModel):
    username: str = Field(..., example="user2", description="Имя пользователя")
    email: EmailStr = Field(..., example="user2@test.ru", description="Email пользователя")
    
class ResetPasswordRequest(BaseModel):
    token: str = Field(..., example="abc123token", description="Токен сброса пароля")
    new_password: str = Field(..., example="newpassword123", description="Новый пароль")
    
class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    
    class Config:
        from_attributes = True

class APIResponse(BaseModel):
    success: bool
    message: str
    
class UserMeResponse(BaseModel):
    success: bool
    user: Optional[UserResponse] = None


router = APIRouter()


@router.post("/api/register")
async def api_register(
    username: str = Body(...),
    email: str = Body(...),
    password: str = Body(...),
    db: Session = Depends(get_db)
):
    if db.query(User).filter(User.email == email).first():
        return JSONResponse(
            status_code=400, 
            content={"success": False, "message": "User with this email already exists!"}
        )
    
    hashed_pw = get_password_hash(password)
    new_user = User(username=username, email=email, hashed_password=hashed_pw)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return JSONResponse(content={"success": True, "message": "Registration successful!"})

@router.get("/api/test-cookie")
async def test_cookie():
    response = JSONResponse(content={"success": True, "message": "Cookie test"})
    response.set_cookie(
        key="test_cookie", 
        value="test_value", 
        httponly=True, 
        samesite="lax", 
        path="/"
    )
    return response

@router.post("/api/login",
              response_model=APIResponse,
              summary="Вход пользователя в систему",
              description="Аутентифицирует пользователя и устанавливает JWT токен.",
              responses={
                  200: {"description": "Успешный вход", "content": {"application/json": {"example": {"success": True, "message": "Вы вошли!"}}}},
                  401: {"description": "Неверные учетные данные", "content": {"application/json": {"example": {"success": False, "message": "Неправильная почта или пароль!"}}}},
                  403: {"description": "Email не подтвержден", "content": {"application/json": {"example": {"success": False, "message": "Почта не подтверждена! Проверьте входящие сообщения."}}}}
              })
async def api_login(
    response: Response,
    email: str = Body(...),
    password: str = Body(...),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(password, user.hashed_password):
        return JSONResponse(
            status_code=401, 
            content={"success": False, "message": "Incorrect email or password!"}
        )

    # Use original working approach
    res = JSONResponse(content={"success": True, "message": "Login successful!"})
    res.set_cookie(
        key="session_id", 
        value=str(user.id), 
        httponly=True, 
        samesite="lax", 
        path="/"
    )
    
    return res

@router.post("/api/forgot-password",
              response_model=APIResponse,
              summary="Запрос восстановления пароля",
              description="Отправляет письмо с инструкциями по восстановлению пароля. Требует имя пользователя и email.",
              responses={
                  200: {"description": "Запрос обработан", "content": {"application/json": {"example": {"success": True, "message": "Если данные верны, инструкция отправлена на email."}}}}
              })
async def api_forgot_password(
    username: str = Body(..., example="user2", description="Username"),
    email: str = Body(..., example="user2@test.ru", description="User email"),
    db: Session = Depends(get_db)
):
    logger = logging.getLogger(__name__)
    user = db.query(User).filter(User.username == username, User.email == email).first()
    if user:
        token = generate_password_reset_token(email)
        # For development, just log the token
        logger.info(f"/api/forgot-password: Reset token for {email}: {token}")
        # TODO: In production, send email with the token
    return {"success": True, "message": "If data is correct, instruction sent to email."}

@router.post("/api/reset-password",
              response_model=APIResponse,
              summary="Сброс пароля",
              description="Устанавливает новый пароль для пользователя с использованием токена восстановления.",
              responses={
                  200: {"description": "Пароль успешно изменен", "content": {"application/json": {"example": {"success": True, "message": "Пароль успешно изменён!"}}}},
                  400: {"description": "Недействительный токен", "content": {"application/json": {"example": {"success": False, "message": "Ссылка недействительна."}}}},
                  404: {"description": "Пользователь не найден", "content": {"application/json": {"example": {"success": False, "message": "Пользователь не найден."}}}}
              })
def api_reset_password(
    token: str = Body(..., example="abc123token", description="Токен восстановления пароля"),
    new_password: str = Body(..., example="newpassword123", description="Новый пароль"),
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

@router.get("/api/me",
            response_model=UserMeResponse,
            summary="Get current user information",
            description="Returns information about the current authenticated user. Checks session cookie.",
            responses={
                200: {"description": "User information", "content": {"application/json": {"example": {"success": True, "user": {"id": 1, "username": "user2", "email": "user2@test.ru"}}}}}
            })
async def api_me(request: Request, db: Session = Depends(get_db)):
    # Get session_id from cookie
    session_id = request.cookies.get("session_id")
    if not session_id:
        return JSONResponse(content={"success": False, "user": None})
    
    try:
        user_id = int(session_id)
    except ValueError:
        return JSONResponse(content={"success": False, "user": None})
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return JSONResponse(content={"success": False, "user": None})
    
    return JSONResponse(content={
        "success": True, 
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
        }
    })

@router.post("/api/logout",
              response_model=APIResponse,
              summary="Выход пользователя",
              description="Завершает сессию пользователя и удаляет cookie.",
              responses={
                  200: {"description": "Выход выполнен", "content": {"application/json": {"example": {"success": True, "message": "Вы вышли из аккаунта"}}}}
              })
async def api_logout():
    res = JSONResponse(content={"success": True, "message": "Вы вышли из аккаунта"})
    res.delete_cookie("session_id", path="/")
    return res
