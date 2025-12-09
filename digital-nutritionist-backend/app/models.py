from datetime import date
from typing import Optional
from uuid import uuid4

from sqlmodel import Field, Relationship, SQLModel


class WeightLogBase(SQLModel):
    weight: float
    date: date
    notes: Optional[str] = None


class WeightLog(WeightLogBase, table=True):
    __tablename__ = "weight_logs"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True, index=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    user: "User" = Relationship(back_populates="weight_logs")


class WeightLogCreate(WeightLogBase):
    user_id: str


class WeightLogUpdate(SQLModel):
    weight: Optional[float] = None
    date: Optional[date] = None
    notes: Optional[str] = None


class UserBase(SQLModel):
    first_name: str
    last_name: str
    height_in: Optional[float] = None
    starting_weight_lb: Optional[float] = None
    goal_weight_lb: Optional[float] = None
    goal_weight_date: Optional[date] = None
    daily_calorie_budget: Optional[int] = None


class User(UserBase, table=True):
    __tablename__ = "users"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True, index=True)
    weight_logs: list[WeightLog] = Relationship(back_populates="user")


class UserCreate(UserBase):
    pass


class UserUpdate(SQLModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    height_in: Optional[float] = None
    starting_weight_lb: Optional[float] = None
    goal_weight_lb: Optional[float] = None
    goal_weight_date: Optional[date] = None
    daily_calorie_budget: Optional[int] = None


class UserRead(UserBase):
    id: str


class WeightLogRead(WeightLogBase):
    id: str
    user_id: str


class PaginatedWeightLogs(SQLModel):
    items: list[WeightLogRead]
