from sqlalchemy import text
from sqlalchemy.engine.url import make_url

import fastapi
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import is_hosted_env, jwt_secret_key_is_configured, settings, validate_hosted_settings
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
    validate_hosted_settings()
    init_db()


@app.middleware("http")
async def payload_size_guard(request, call_next):
    content_length = request.headers.get("content-length")
    if content_length:
        size = int(content_length)
        if request.url.path.startswith("/auth/") and size > settings.auth_max_payload_bytes:
            return fastapi.responses.JSONResponse(
                status_code=fastapi.status.HTTP_413_CONTENT_TOO_LARGE,
                content={"detail": "That request is too large. Please shorten your input and try again."},
            )
        if request.url.path.startswith("/chat") and size > settings.chat_max_payload_bytes:
            return fastapi.responses.JSONResponse(
                status_code=fastapi.status.HTTP_413_CONTENT_TOO_LARGE,
                content={"detail": "That message is too large. Try shortening it or using a smaller photo."},
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

@app.get("/health/config")
def health_config_check() -> dict[str, object]:
    url = make_url(settings.database_url)
    return {
        "status": "ok",
        "hosted": is_hosted_env(),
        "app_env": settings.app_env,
        "openai_model": settings.openai_model,
        "openai_api_key_configured": bool(settings.openai_api_key),
        "database_driver": url.drivername,
        "database_host_configured": bool(url.host),
        "jwt_secret_key_configured": jwt_secret_key_is_configured(),
        "allowed_origins": settings.allowed_origins_list,
    }


app.include_router(users.router)
app.include_router(weight_logs.router)
app.include_router(meal_logs.router)
app.include_router(planned_meals.router)
app.include_router(activity_logs.router)
app.include_router(chat.router)
app.include_router(auth.router)
