from passlib.context import CryptContext
from itsdangerous import URLSafeTimedSerializer
from app.core.config import settings


pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def generate_verification_token(email: str) -> str:
    
    serializer = URLSafeTimedSerializer(settings.SECRET_KEY)
    return serializer.dumps(email, salt=settings.VERIFICATION_SALT)

def verify_token(token: str, expiration: int = 3600) -> str | None:
    serializer = URLSafeTimedSerializer(settings.SECRET_KEY)
    try:
        email = serializer.loads(token, salt=settings.VERIFICATION_SALT, max_age=expiration)
        return email
    except Exception:
        return None
    
def generate_password_reset_token(email: str) -> str:
    serializer = URLSafeTimedSerializer(settings.SECRET_KEY)
    return serializer.dumps(email, salt="password-reset")


def verify_password_reset_token(token: str, expiration: int = 3600) -> str | None:
    serializer = URLSafeTimedSerializer(settings.SECRET_KEY)
    try:
        email = serializer.loads(token, salt="password-reset", max_age=expiration)
        return email
    except Exception:
        return None