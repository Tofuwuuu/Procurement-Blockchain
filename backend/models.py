from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

# Login request model
class LoginRequest(BaseModel):
    username: str
    password: str

# Login response model
class LoginResponse(BaseModel):
    success: bool
    message: str
    access_token: Optional[str] = None
    token_type: str = "bearer"
    user: Optional[dict] = None

# User response model (matching frontend User interface)
class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    position: str
    department: str
    role: str
    is_admin: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

# User model (for database)
class User(BaseModel):
    username: str
    email: Optional[str] = None
    password_hash: str
    full_name: Optional[str] = None
    role: Optional[str] = "user"
    created_at: Optional[datetime] = None
    is_active: bool = True
