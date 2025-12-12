from datetime import date, datetime
from typing import Optional
from uuid import uuid4

from pydantic import ConfigDict
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


class MealLogBase(SQLModel):
    date: date
    user_description: str
    meal_type: Optional[str] = None
    estimated_calories: Optional[int] = None


class MealLog(MealLogBase, table=True):
    __tablename__ = "meal_logs"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True, index=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    user: "User" = Relationship(back_populates="meal_logs")


class MealLogCreate(MealLogBase):
    user_id: str


class MealLogUpdate(SQLModel):
    date: Optional[date] = None
    user_description: Optional[str] = None
    meal_type: Optional[str] = None
    estimated_calories: Optional[int] = None


class UserBase(SQLModel):
    email: str = Field(index=True, unique=True)
    first_name: str
    last_name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    activity_level: Optional[str] = None
    height_in: Optional[float] = None
    starting_weight_lb: Optional[float] = None
    goal_weight_lb: Optional[float] = None
    goal_weight_date: Optional[date] = None
    daily_calorie_budget: Optional[int] = None


class User(UserBase, table=True):
    __tablename__ = "users"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True, index=True)
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    weight_logs: list[WeightLog] = Relationship(back_populates="user")
    meal_logs: list["MealLog"] = Relationship(back_populates="user")


class UserCreate(UserBase):
    password: str


class UserUpdate(SQLModel):
    email: Optional[str] = None
    password: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    activity_level: Optional[str] = None
    height_in: Optional[float] = None
    starting_weight_lb: Optional[float] = None
    goal_weight_lb: Optional[float] = None
    goal_weight_date: Optional[date] = None
    daily_calorie_budget: Optional[int] = None


class UserRead(UserBase):
    id: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class WeightLogRead(WeightLogBase):
    id: str
    user_id: str
    model_config = ConfigDict(from_attributes=True)


class MealLogRead(MealLogBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class PaginatedWeightLogs(SQLModel):
    items: list[WeightLogRead]
