from pydantic import BaseModel, EmailStr
from typing import Optional, List
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

# Purchase Request Item model
class PurchaseRequestItem(BaseModel):
    unit: str
    item_description: str
    quantity: int
    unit_cost: float
    total_cost: float

# Purchase Request model (for creating)
class CreatePurchaseRequest(BaseModel):
    entity_name: str
    fund_cluster: Optional[str] = ""
    office_section: str
    responsibility_center_code: Optional[str] = ""
    date: str
    remark: Optional[str] = ""
    items: List[PurchaseRequestItem]

# Purchase Request model (for updating)
class UpdatePurchaseRequest(BaseModel):
    entity_name: Optional[str] = None
    fund_cluster: Optional[str] = None
    office_section: Optional[str] = None
    responsibility_center_code: Optional[str] = None
    date: Optional[str] = None
    remark: Optional[str] = None
    ref_number: Optional[str] = None
    status: Optional[str] = None
    items: Optional[List[PurchaseRequestItem]] = None

# Purchase Request model (for response)
class PurchaseRequestResponse(BaseModel):
    id: str
    pr_number: str
    ref_number: Optional[str] = None
    entity_name: str
    fund_cluster: Optional[str] = ""
    office_section: str
    responsibility_center_code: Optional[str] = ""
    date: str
    remark: Optional[str] = ""
    status: str
    requested_by: str
    requested_by_id: Optional[str] = None
    items: List[PurchaseRequestItem]
    total_amount: float
    date_created: str
    date_updated: Optional[str] = None
