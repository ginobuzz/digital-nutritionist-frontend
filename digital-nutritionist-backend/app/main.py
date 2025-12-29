from sqlalchemy import text

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
