from fastapi import APIRouter, Request, Form, Depends, BackgroundTasks, Body, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime, timedelta
import jwt

from sqlalchemy.orm import Session

from db.session import get_db
from db.models import User
from core.security import get_password_hash, verify_password, generate_password_reset_token, verify_password_reset_token

from utils.email import send_reset_password_email

import logging
from api.v1.deps import get_current_user, get_current_user_optional

# JWT Configuration
JWT_SECRET = "your-secret-key-change-in-production"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24


class APIResponse(BaseModel):
    success: bool
    message: str
    
class UserMeResponse(BaseModel):
    success: bool
    user: Optional[dict] = None


def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def verify_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        return int(user_id)
    except jwt.PyJWTError:
        return None


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


@router.post("/api/login")
async def api_login(
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

    # Create JWT token since cookies don't work
    access_token_expires = timedelta(hours=JWT_EXPIRATION_HOURS)
    access_token = create_access_token(
        data={"sub": str(user.id)}, 
        expires_delta=access_token_expires
    )
    
    return JSONResponse(content={
        "success": True, 
        "message": "Login successful!",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
        }
    })


@router.post("/api/forgot-password")
async def api_forgot_password(
    email: str = Body(...),
    db: Session = Depends(get_db)
):
    logger = logging.getLogger(__name__)
    user = db.query(User).filter(User.email == email).first()
    if user:
        token = generate_password_reset_token(email)
        logger.info(f"/api/forgot-password: Reset token for {email}: {token}")
    return {"success": True, "message": "If email exists, instruction sent."}


@router.post("/api/reset-password")
def api_reset_password(
    token: str = Body(...),
    new_password: str = Body(...),
    db: Session = Depends(get_db)
):
    logger = logging.getLogger(__name__)
    email = verify_password_reset_token(token)
    if not email:
        logger.info(f"/api/reset-password: invalid token")
        return JSONResponse({"success": False, "message": "Invalid token."}, status_code=400)
    
    user = db.query(User).filter(User.email == email).first()
    if not user:
        logger.info(f"/api/reset-password: user not found for token")
        return JSONResponse({"success": False, "message": "User not found."}, status_code=404)

    hashed_pw = get_password_hash(new_password)
    user.hashed_password = hashed_pw
    db.commit()
    logger.info(f"/api/reset-password: password changed for {email}")
    return {"success": True, "message": "Password successfully changed!"}


@router.get("/api/me")
async def api_me(request: Request, db: Session = Depends(get_db)):
    # Try to get token from Authorization header first
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        user_id = verify_token(token)
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                return JSONResponse(content={
                    "success": True, 
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email
                    }
                })
    
    # Fallback to cookie (though it doesn't work)
    session_id = request.cookies.get("session_id")
    if session_id:
        try:
            user_id = int(session_id)
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                return JSONResponse(content={
                    "success": True, 
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email
                    }
                })
        except ValueError:
            pass
    
    return JSONResponse(content={"success": False, "user": None})


@router.post("/api/logout")
async def api_logout():
    return JSONResponse(content={"success": True, "message": "Logged out successfully"})

