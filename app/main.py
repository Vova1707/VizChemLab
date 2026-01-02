from fastapi import FastAPI

from fastapi.staticfiles import StaticFiles

from app.api.v1.endpoints import auth, pages, visualizator, simiulator, simiulator_visualizator, sessions

from app.db.base import Base
from app.db.session import engine

from sqladmin import Admin
from app.admin.views import UserAdmin
from app.admin.auth import authentication_backend
from app.core.config import settings


app = FastAPI(title="FastAPI Template")
app.mount("/static", StaticFiles(directory="app/templates/static"), name="static")
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

app.include_router(auth.router)
app.include_router(pages.router)
app.include_router(visualizator.router)
app.include_router(simiulator.router)
app.include_router(simiulator_visualizator.router)
app.include_router(sessions.router)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=str(settings.SERVER_HOST), port=int(settings.SERVER_PORT), access_log=True)