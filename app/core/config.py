from pydantic_settings import BaseSettings
from pydantic import PostgresDsn, EmailStr, SecretStr
from typing import Optional

class Settings(BaseSettings):
    # База данных
    DATABASE_URL: PostgresDsn
    SECRET_KEY: str = "your-default-secret-key"

    # SMTP
    SMTP_HOST: str = "smtp.yandex.ru"
    SMTP_PORT: int = 465
    SMTP_USER: EmailStr
    SMTP_PASSWORD: SecretStr

    # Клиент
    SERVER_HOST: str = "localhost"
    SERVER_PORT: str = ":8000"

    # Frontend
    FRONTEND_HOST: str = "localhost"
    FRONTEND_PORT: str = ":3000"

    # Соль для токенов
    VERIFICATION_SALT: str = "email-verification-salt"
    
    # Google Gemini API
    GEMINI_API_KEY: Optional[str] = None

    # GigaChat API
    GIGACHAT_CLIENT_ID: Optional[str] = "019cd259-c72e-75cb-84b9-b0588a762d74"
    GIGACHAT_AUTH_KEY: Optional[str] = "MDE5Y2QyNTktYzcyZS03NWNiLTg0YjktYjA1ODhhNzYyZDc0OjhhZTg0NWY0LTdmZDEtNGIxYy05YTYxLTc4Mzg5YTJjMWIyNA=="
    GIGACHAT_SCOPE: str = "GIGACHAT_API_PERS"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore"
    }


settings = Settings()