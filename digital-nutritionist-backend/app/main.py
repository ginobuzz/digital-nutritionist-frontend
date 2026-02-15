from sqlalchemy import text

import fastapi
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import engine, init_db
from .routers import activity_logs, auth, chat, meal_logs, planned_meals, users, weight_logs

app = FastAPI(title="Digital Nutritionist Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.middleware("http")
async def payload_size_guard(request, call_next):
    content_length = request.headers.get("content-length")
    if content_length:
        size = int(content_length)
        if request.url.path.startswith("/auth/") and size > settings.auth_max_payload_bytes:
            return fastapi.responses.JSONResponse(
                status_code=fastapi.status.HTTP_413_CONTENT_TOO_LARGE,
                content={"detail": "Auth payload too large"},
            )
        if request.url.path.startswith("/chat") and size > settings.chat_max_payload_bytes:
            return fastapi.responses.JSONResponse(
                status_code=fastapi.status.HTTP_413_CONTENT_TOO_LARGE,
                content={"detail": "Chat payload too large"},
            )
    return await call_next(request)



@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/db")
def health_db_check() -> dict[str, str]:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok"}


app.include_router(users.router)
app.include_router(weight_logs.router)
app.include_router(meal_logs.router)
app.include_router(planned_meals.router)
app.include_router(activity_logs.router)
app.include_router(chat.router)
app.include_router(auth.router)
