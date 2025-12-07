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

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore"
    }


settings = Settings()