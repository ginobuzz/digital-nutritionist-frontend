from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..deps import get_current_user
from ..db import get_session
from ..models import ActivityLog, ActivityLogCreate, ActivityLogRead, ActivityLogUpdate, User

router = APIRouter(prefix="/activity-logs", tags=["activity_logs"])


@router.post("/", response_model=ActivityLogRead, status_code=status.HTTP_201_CREATED)
def create_activity_log(*, session: Session = Depends(get_session), payload: ActivityLogCreate, current_user: User = Depends(get_current_user)):
    if payload.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    activity = ActivityLog.model_validate(payload)
    session.add(activity)
    session.commit()
    session.refresh(activity)
    return activity


@router.get("/", response_model=list[ActivityLogRead])
def list_activity_logs(
    *,
    session: Session = Depends(get_session),
    user_id: str | None = None,
    start: date | None = None,
    end: date | None = None,
    current_user: User = Depends(get_current_user),
):
    if user_id is not None and user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    query = select(ActivityLog).where(ActivityLog.user_id == current_user.id).order_by(ActivityLog.time.asc())
    if start:
        query = query.where(ActivityLog.date >= start)
    if end:
        query = query.where(ActivityLog.date <= end)
    return session.exec(query).all()


@router.get("/{activity_id}", response_model=ActivityLogRead)
def get_activity_log(*, session: Session = Depends(get_session), activity_id: str, current_user: User = Depends(get_current_user)):
    activity = session.get(ActivityLog, activity_id)
    if not activity or activity.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity log not found")
    return activity


@router.put("/{activity_id}", response_model=ActivityLogRead)
def update_activity_log(*, session: Session = Depends(get_session), activity_id: str, payload: ActivityLogUpdate, current_user: User = Depends(get_current_user)):
    activity = session.get(ActivityLog, activity_id)
    if not activity or activity.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity log not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(activity, key, value)
    activity.updated_at = datetime.utcnow()
    session.add(activity)
    session.commit()
    session.refresh(activity)
    return activity


@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity_log(*, session: Session = Depends(get_session), activity_id: str, current_user: User = Depends(get_current_user)):
    activity = session.get(ActivityLog, activity_id)
    if not activity or activity.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity log not found")
    session.delete(activity)
    session.commit()
