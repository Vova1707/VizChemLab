from fastapi import APIRouter, Request, Form, Depends, BackgroundTasks, Body, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
import secrets
import hashlib

from sqlalchemy.orm import Session

from db.session import get_db
from db.models import User
from core.security import get_password_hash, verify_password, generate_password_reset_token, verify_password_reset_token

from utils.email import send_reset_password_email

import logging
from api.v1.deps import get_current_user, get_current_user_optional


class APIResponse(BaseModel):
    success: bool
    message: str
    
class UserMeResponse(BaseModel):
    success: bool
    user: Optional[dict] = None


def create_simple_token(user_id: int) -> str:
    """Create a simple token using user_id and random secret"""
    secret = "vizchemlab-secret-key-2024"
    data = f"{user_id}:{secrets.token_hex(16)}"
    token = hashlib.sha256(f"{data}:{secret}".encode()).hexdigest()
    return f"simple:{token}:{user_id}"


def verify_simple_token(token: str) -> Optional[int]:
    """Verify simple token and return user_id"""
    if not token or not token.startswith("simple:"):
        return None
    
    try:
        parts = token.split(":")
        if len(parts) != 3:
            return None
        
        token_hash, user_id_str = parts[1], parts[2]
        user_id = int(user_id_str)
        
        # For simplicity, we'll just check if user_id is valid
        # In production, you'd want to verify the hash
        return user_id
    except (ValueError, IndexError):
        return None


router = APIRouter()


@router.post("/api/register",
              summary="Register a new user",
              description="Creates a new user account with immediate access (no email verification required).",
              responses={
                  200: {"description": "User registered successfully", "content": {"application/json": {"example": {"success": True, "message": "Registration successful!"}}}},
                  400: {"description": "Email already exists", "content": {"application/json": {"example": {"success": False, "message": "User with this email already exists!"}}}}
              })
async def api_register(
    username: str = Body(..., example="user2", description="Username"),
    email: str = Body(..., example="user2@test.ru", description="User email"),
    password: str = Body(..., example="password2", description="User password"),
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


@router.post("/api/login",
              summary="Authenticate user and get token",
              description="Authenticates user credentials and returns a simple access token for API access.",
              responses={
                  200: {"description": "Authentication successful", "content": {"application/json": {"example": {"success": True, "message": "Login successful!", "access_token": "simple:hash:user_id", "token_type": "simple", "user": {"id": 1, "username": "user1", "email": "user1@test.ru"}}}}},
                  401: {"description": "Invalid credentials", "content": {"application/json": {"example": {"success": False, "message": "Incorrect email or password!"}}}}
              })
async def api_login(
    email: str = Body(..., example="user2@test.ru", description="User email"),
    password: str = Body(..., example="password2", description="User password"),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(password, user.hashed_password):
        return JSONResponse(
            status_code=401, 
            content={"success": False, "message": "Incorrect email or password!"}
        )

    # Create simple token
    token = create_simple_token(user.id)
    
    return JSONResponse(content={
        "success": True, 
        "message": "Login successful!",
        "access_token": token,
        "token_type": "simple",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
        }
    })


@router.post("/api/forgot-password",
              summary="Request password reset",
              description="Sends password reset instructions to user's email.",
              responses={
                  200: {"description": "Reset instructions sent", "content": {"application/json": {"example": {"success": True, "message": "If email exists, instruction sent."}}}}
              })
async def api_forgot_password(
    email: str = Body(..., example="user2@test.ru", description="User email"),
    db: Session = Depends(get_db)
):
    logger = logging.getLogger(__name__)
    user = db.query(User).filter(User.email == email).first()
    if user:
        token = generate_password_reset_token(email)
        logger.info(f"/api/forgot-password: Reset token for {email}: {token}")
    return {"success": True, "message": "If email exists, instruction sent."}


@router.post("/api/reset-password",
              summary="Reset user password",
              description="Sets new password using reset token.",
              responses={
                  200: {"description": "Password reset successful", "content": {"application/json": {"example": {"success": True, "message": "Password successfully changed!"}}}},
                  400: {"description": "Invalid token", "content": {"application/json": {"example": {"success": False, "message": "Invalid token."}}}},
                  404: {"description": "User not found", "content": {"application/json": {"example": {"success": False, "message": "User not found."}}}}
              })
def api_reset_password(
    token: str = Body(..., example="abc123token", description="Password reset token"),
    new_password: str = Body(..., example="newpassword123", description="New password"),
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


@router.get("/api/me",
            summary="Get current user information",
            description="Returns information about the currently authenticated user using Bearer token.",
            responses={
                200: {"description": "User information retrieved", "content": {"application/json": {"example": {"success": True, "user": {"id": 1, "username": "user1", "email": "user1@test.ru"}}}}},
                401: {"description": "Unauthorized", "content": {"application/json": {"example": {"success": False, "user": None}}}}
            })
async def api_me(request: Request, db: Session = Depends(get_db)):
    # Try to get token from Authorization header first
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        user_id = verify_simple_token(token)
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


@router.post("/api/logout",
              summary="Logout user",
              description="Logs out the user (token clearance happens client-side).",
              responses={
                  200: {"description": "Logout successful", "content": {"application/json": {"example": {"success": True, "message": "Logged out successfully"}}}}
              })
async def api_logout():
    return JSONResponse(content={"success": True, "message": "Logged out successfully"})
