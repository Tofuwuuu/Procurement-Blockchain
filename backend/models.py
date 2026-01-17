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

# User model (for database)
class User(BaseModel):
    username: str
    email: Optional[str] = None
    password_hash: str
    full_name: Optional[str] = None
    role: Optional[str] = "user"
    created_at: Optional[datetime] = None
    is_active: bool = True
