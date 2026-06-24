"""
Goal router — HTTP endpoints for goal CRUD operations.
"""

import uuid

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from app.core.exceptions import UnauthorizedError
from app.core.security import verify_access_token
from app.database import AsyncSession, get_db
from app.modules.goals.service import GoalService
from app.schemas.goal import GoalCreate, GoalResponse, GoalUpdate

router = APIRouter(prefix="/goals", tags=["Goals"])
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    if not credentials:
        raise UnauthorizedError("Authorization header missing")
    try:
        return verify_access_token(credentials.credentials)
    except JWTError:
        raise UnauthorizedError("Invalid or expired access token")


@router.post(
    "",
    response_model=GoalResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new goal",
)
async def create_goal(
    payload: GoalCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> GoalResponse:
    svc = GoalService(db)
    return await svc.create(user_id, payload)


@router.get(
    "",
    response_model=list[GoalResponse],
    summary="List all goals",
)
async def list_goals(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[GoalResponse]:
    svc = GoalService(db)
    return await svc.list_all(user_id)


@router.get(
    "/{goal_id}",
    response_model=GoalResponse,
    summary="Get a goal by ID",
)
async def get_goal(
    goal_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> GoalResponse:
    svc = GoalService(db)
    return await svc.get_by_id(goal_id, user_id)


@router.put(
    "/{goal_id}",
    response_model=GoalResponse,
    summary="Update a goal",
)
async def update_goal(
    goal_id: uuid.UUID,
    payload: GoalUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> GoalResponse:
    svc = GoalService(db)
    return await svc.update(goal_id, user_id, payload)


@router.delete(
    "/{goal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a goal",
)
async def delete_goal(
    goal_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    svc = GoalService(db)
    await svc.delete(goal_id, user_id)
