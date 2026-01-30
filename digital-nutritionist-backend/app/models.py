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
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None


class MealLog(MealLogBase, table=True):
    __tablename__ = "meal_logs"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True, index=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    user: "User" = Relationship(back_populates="meal_logs")


class MealLogCreate(MealLogBase):
    user_id: str
    # Optional time-of-day for UI logging; stored in `MealLog.created_at`.
    time: Optional[datetime] = None


class MealLogUpdate(SQLModel):
    date: Optional[date] = None
    user_description: Optional[str] = None
    meal_type: Optional[str] = None
    estimated_calories: Optional[int] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    # Optional time-of-day for UI updates; stored in `MealLog.created_at`.
    time: Optional[datetime] = None


class PlannedMealBase(SQLModel):
    date: date
    name: str
    calories: int
    meal_type: str
    time: datetime
    description: Optional[str] = None


class PlannedMeal(PlannedMealBase, table=True):
    __tablename__ = "planned_meals"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True, index=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    user: "User" = Relationship(back_populates="planned_meals")


class PlannedMealCreate(PlannedMealBase):
    user_id: str


class PlannedMealUpdate(SQLModel):
    date: Optional[date] = None
    name: Optional[str] = None
    calories: Optional[int] = None
    meal_type: Optional[str] = None
    time: Optional[datetime] = None
    description: Optional[str] = None


class ActivityLogBase(SQLModel):
    date: date
    name: str
    calories_burned: int
    duration: int
    type: str
    time: datetime


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
    planned_meals: list["PlannedMeal"] = Relationship(back_populates="user")
    activity_logs: list["ActivityLog"] = Relationship(back_populates="user")


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


class PlannedMealRead(PlannedMealBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ActivityLog(ActivityLogBase, table=True):
    __tablename__ = "activity_logs"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True, index=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    user: "User" = Relationship(back_populates="activity_logs")


class ActivityLogCreate(ActivityLogBase):
    user_id: str


class ActivityLogUpdate(SQLModel):
    date: Optional[date] = None
    name: Optional[str] = None
    calories_burned: Optional[int] = None
    duration: Optional[int] = None
    type: Optional[str] = None
    time: Optional[datetime] = None


class ActivityLogRead(ActivityLogBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class PaginatedWeightLogs(SQLModel):
    items: list[WeightLogRead]
