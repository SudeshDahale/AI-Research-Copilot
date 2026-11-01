import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi import Response, HTTPException

from app.api.v1.auth import register, login
from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest
from app.core.security import hash_password


@pytest.mark.asyncio
async def test_register_new_user_success():
    mock_db = AsyncMock()
    mock_exec_result = MagicMock()
    mock_exec_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_exec_result

    req = RegisterRequest(
        username="alex_rivers",
        email="alex@univ.edu",
        password="secretpassword123",
        profession="Industry R&D / Engineer",
    )
    resp = Response()

    user = await register(body=req, response=resp, db=mock_db)

    assert user.name == "alex_rivers"
    assert user.email == "alex@univ.edu"
    assert user.profession == "Industry R&D / Engineer"
    assert mock_db.add.called
    assert mock_db.commit.called


@pytest.mark.asyncio
async def test_register_duplicate_conflict():
    mock_db = AsyncMock()
    mock_exec_result = MagicMock()
    mock_exec_result.scalar_one_or_none.return_value = User(
        id=uuid.uuid4(),
        email="alex@univ.edu",
        name="alex_rivers",
        hashed_password="hash",
    )
    mock_db.execute.return_value = mock_exec_result

    req = RegisterRequest(
        username="alex_rivers",
        email="alex@univ.edu",
        password="secretpassword123",
        profession="PhD / Graduate Student",
    )
    resp = Response()

    with pytest.raises(HTTPException) as exc_info:
        await register(body=req, response=resp, db=mock_db)

    assert exc_info.value.status_code == 409
    assert "already exists" in exc_info.value.detail


@pytest.mark.asyncio
async def test_login_with_username_or_email():
    hashed = hash_password("mypassword123")
    user = User(
        id=uuid.uuid4(),
        name="sarah_c",
        email="sarah@med.org",
        hashed_password=hashed,
        profession="Medical & Clinical Scientist",
    )

    mock_db = AsyncMock()
    mock_exec_result = MagicMock()
    mock_exec_result.scalar_one_or_none.return_value = user
    mock_db.execute.return_value = mock_exec_result

    resp = Response()

    # 1. Login with username
    res1 = await login(
        body=LoginRequest(username="sarah_c", password="mypassword123"),
        response=resp,
        db=mock_db,
    )
    assert res1.name == "sarah_c"
    assert res1.profession == "Medical & Clinical Scientist"

    # 2. Login with email
    res2 = await login(
        body=LoginRequest(email="sarah@med.org", password="mypassword123"),
        response=resp,
        db=mock_db,
    )
    assert res2.email == "sarah@med.org"
    assert res2.profession == "Medical & Clinical Scientist"


@pytest.mark.asyncio
async def test_login_invalid_password():
    hashed = hash_password("correctpass123")
    user = User(
        id=uuid.uuid4(),
        name="sarah_c",
        email="sarah@med.org",
        hashed_password=hashed,
    )

    mock_db = AsyncMock()
    mock_exec_result = MagicMock()
    mock_exec_result.scalar_one_or_none.return_value = user
    mock_db.execute.return_value = mock_exec_result

    resp = Response()

    with pytest.raises(HTTPException) as exc_info:
        await login(
            body=LoginRequest(username="sarah_c", password="wrongpassword"),
            response=resp,
            db=mock_db,
        )

    assert exc_info.value.status_code == 401
