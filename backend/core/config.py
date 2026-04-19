from pydantic_settings import BaseSettings
from pydantic import PostgresDsn, EmailStr, SecretStr
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./app.db"
    SECRET_KEY: str = "your-default-secret-key"

    SMTP_HOST: str = "smtp.yandex.ru"
    SMTP_PORT: int = 465
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[SecretStr] = None

    SERVER_HOST: str = "localhost"
    SERVER_PORT: str = ":8000"

    FRONTEND_HOST: str = "localhost"
    FRONTEND_PORT: str = ":3000"

    GEMINI_API_KEY: Optional[str] = None

    GIGACHAT_CLIENT_ID: Optional[str] = None
    GIGACHAT_AUTH_KEY: Optional[SecretStr] = None
    GIGACHAT_SCOPE: str = "GIGACHAT_API_PERS"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore"
    }


settings = Settings()