from sqladmin.authentication import AuthenticationBackend
from fastapi.requests import Request
from core.session_store import active_sessions

class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        session_id = request.cookies.get("session_id")
        if session_id and int(session_id) in active_sessions:
            request.session.update({"token": session_id})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        session_id = request.session.get("token")
        if session_id:
            active_sessions.discard(int(session_id))
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        session_id = request.session.get("token")
        return session_id is not None and int(session_id) in active_sessions

authentication_backend = AdminAuth(secret_key="your-secret-key-here")