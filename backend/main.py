from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from datetime import datetime

from api.v1.endpoints import auth, pages, visualizator, simiulator, simiulator_visualizator, sessions, social

from db.base import Base
from db.session import engine

from sqladmin import Admin
from admin.views import UserAdmin
from admin.auth import authentication_backend
from core.config import settings


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="VizChemLab API",
        version="1.0.0",
        routes=app.routes,
    )
    
    # Add security schemes for simple token authentication
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "simple",
            "description": "Simple Bearer token for authentication. Format: 'simple:<hash>:<user_id>'"
        }
    }
    
    # Add examples for requests
    openapi_schema["components"]["examples"] = {
        "UserRegistration": {
            "summary": "User Registration Example",
            "value": {
                "username": "chem_student",
                "email": "student@example.com",
                "password": "secure_password123"
            }
        },
        "UserLogin": {
            "summary": "User Login Example",
            "value": {
                "email": "student@example.com",
                "password": "secure_password123"
            }
        },
        "TokenResponse": {
            "summary": "Login Response with Token",
            "value": {
                "success": True,
                "message": "Login successful!",
                "access_token": "simple:a19792005fa58fb5ecad08ea391cab16a6c9a1aa173408bd358f99e0af060367:1",
                "token_type": "simple",
                "user": {
                    "id": 1,
                    "username": "user1",
                    "email": "user1@test.ru"
                }
            }
        },
        "ChemicalFormula": {
            "summary": "Chemical Formula Example",
            "value": "H2O"
        },
        "ChemicalReaction": {
            "summary": "Chemical Reaction Example",
            "value": "H2 + O2"
        }
    }
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app = FastAPI(
    title="VizChemLab API",
    description="Educational chemistry visualization and simulation platform\n\n## Authentication System\n\n**Type**: Simple Token-Based Authentication\n\n### Authentication Process:\n1. **Registration**: POST /api/register - creates user with hashed password\n2. **Login**: POST /api/login - returns access_token\n3. **Authentication**: Add `Authorization: Bearer <token>` header to requests\n4. **Logout**: POST /api/logout - clears token (client-side)\n\n### Token Format:\n```\nsimple:<hash>:<user_id>\nExample: simple:a19792005fa58fb5ecad08ea391cab16a6c9a1aa173408bd358f99e0af060367:1\n```\n\n### Security:\n- **Password hashing**: bcrypt (sha256_crypt)\n- **Token storage**: localStorage (client-side)\n- **Token verification**: server-side hash validation\n- **No email verification**: immediate access\n- **Password recovery**: email-based reset tokens\n\n### Usage Examples:\n```bash\n# Login\ncurl -X POST \"http://localhost:8000/api/login\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"email\": \"user@example.com\", \"password\": \"password\"}'\n\n# Use token in requests\ncurl -X GET \"http://localhost:8000/api/me\" \\\n  -H \"Authorization: Bearer simple:<token_hash>:<user_id>\"\n```",
    version="1.0.0",
    docs_url="/doc",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

@app.get("/health")
async def health_check():
    """Health check endpoint for deployment monitoring"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://localhost:80", "http://127.0.0.1", "http://127.0.0.1:80"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.openapi = custom_openapi

Base.metadata.create_all(bind=engine)



import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    stream=sys.stdout
)


admin = Admin(
    app,
    engine,
    authentication_backend=authentication_backend,
    title="Админка"
)
admin.add_view(UserAdmin)

app.include_router(auth.router, tags=["Аутентификация"])
app.include_router(pages.router, tags=["Страницы"])
app.include_router(visualizator.router, tags=["Визуализатор"])
app.include_router(simiulator.router, tags=["Симулятор"])
app.include_router(simiulator_visualizator.router, tags=["Симулятор с визуализацией"])
app.include_router(sessions.router, tags=["Сессии"])
app.include_router(social.router, prefix="/api", tags=["Социальные функции"])

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=str(settings.SERVER_HOST), port=int(settings.SERVER_PORT), access_log=True)