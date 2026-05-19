from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPAuthorizationCredentials

from database import get_database
from auth import verify_password, create_access_token, decode_access_token
from models import LoginRequest, LoginResponse
from routers.deps import security

import traceback

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(login_request: LoginRequest):
    """Authenticate user and return JWT token."""
    try:
        db = await get_database()
        user = await db.users.find_one({"username": login_request.username})
        if not user:
            user = await db.users.find_one({"email": login_request.username})
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid username or password")

        password_hash = user.get("password_hash") or user.get("password") or user.get("hashed_password")
        if not password_hash:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid username or password")
        if not verify_password(login_request.password, password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid username or password")
        if user.get("is_active") is False or user.get("status") == "inactive":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="User account is disabled")

        role_name = user.get("role", "employee")
        role_id = user.get("role_id")
        if role_id:
            role_doc = await db.roles.find_one(
                {"id": role_id} if isinstance(role_id, int) else {"_id": role_id}
            )
            if role_doc:
                role_name = role_doc.get("name", role_name)

        is_admin = role_name.lower() == "admin" or user.get("is_admin", False)
        user_id = user.get("id") or (str(user["_id"]) if user.get("_id") else 0)

        access_token = create_access_token(data={
            "sub": user.get("username", ""),
            "user_id": str(user_id),
            "role": role_name,
            "is_admin": is_admin,
        })

        def fmt(dt):
            if not dt:
                return None
            return dt.isoformat() if hasattr(dt, "isoformat") else str(dt)

        try:
            user_id_int = int(user_id) if str(user_id).isdigit() else hash(str(user_id)) % 2147483647
        except Exception:
            user_id_int = hash(str(user_id)) % 2147483647

        return LoginResponse(
            success=True,
            message="Login successful",
            access_token=access_token,
            token_type="bearer",
            user={
                "id": user_id_int,
                "username": user.get("username") or "",
                "full_name": user.get("full_name") or user.get("name") or "",
                "position": user.get("position") or "",
                "department": user.get("department") or "",
                "role": role_name,
                "is_admin": is_admin,
                "created_at": fmt(user.get("created_at")),
                "updated_at": fmt(user.get("updated_at")),
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Login error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"An error occurred during login: {e}")


@router.get("/me")
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Return the authenticated user's profile."""
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid or expired token")
    try:
        db = await get_database()
        user = await db.users.find_one({"username": payload.get("sub")})
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        role_name = user.get("role", "employee")
        role_id = user.get("role_id")
        if role_id:
            role_doc = await db.roles.find_one(
                {"id": role_id} if isinstance(role_id, int) else {"_id": role_id}
            )
            if role_doc:
                role_name = role_doc.get("name", role_name)

        is_admin = role_name.lower() == "admin" or user.get("is_admin", False)
        user_id = user.get("id") or (str(user["_id"]) if user.get("_id") else 0)

        def fmt(dt):
            if not dt:
                return None
            return dt.isoformat() if hasattr(dt, "isoformat") else str(dt)

        try:
            user_id_int = int(user_id) if str(user_id).isdigit() else hash(str(user_id)) % 2147483647
        except Exception:
            user_id_int = hash(str(user_id)) % 2147483647

        return {
            "id": user_id_int,
            "username": user.get("username") or "",
            "full_name": user.get("full_name") or user.get("name") or "",
            "position": user.get("position") or "",
            "department": user.get("department") or "",
            "role": role_name,
            "is_admin": is_admin,
            "created_at": fmt(user.get("created_at")),
            "updated_at": fmt(user.get("updated_at")),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"An error occurred: {e}")


@router.get("/verify")
async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and return basic user info."""
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid or expired token")
    return {
        "valid": True,
        "user": {
            "username": payload.get("sub"),
            "user_id": payload.get("user_id"),
            "role": payload.get("role"),
        },
    }
