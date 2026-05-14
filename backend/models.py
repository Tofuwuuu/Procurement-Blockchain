from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
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

# Supplier entry saved onto a PR for canvassing
class CanvassSupplier(BaseModel):
    supplier_id: Optional[str] = None
    name: Optional[str] = None
    address: Optional[str] = None
    unit_price: Optional[float] = None
    item_description: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    source: Optional[str] = None
    date_added: Optional[str] = None

class SupplierCreate(BaseModel):
    name: str
    address: str
    province: Optional[str] = ""
    contact_person: str
    phone: str
    email: Optional[str] = None
    bir_tin: str
    is_active: bool = True

class SupplierResponse(SupplierCreate):
    id: int
    created_at: str
    updated_at: str

class ProductSummary(BaseModel):
    id: int
    name: str
    description: Optional[str] = ""
    unit: str
    unit_price: float
    category: Optional[str] = ""
    is_active: bool = True

class PurchaseOrderItem(BaseModel):
    id: Optional[int] = None
    product_id: Optional[int] = None
    product: Optional[ProductSummary] = None
    quantity: int
    unit_price: float
    total_price: Optional[float] = None

class CreatePurchaseOrder(BaseModel):
    pr_id: Optional[str] = None
    pr_number: Optional[str] = None
    supplier_id: Optional[int] = None
    delivery_address: Optional[str] = ""
    notes: Optional[str] = ""
    items: Optional[List[PurchaseOrderItem]] = None

class UpdatePurchaseOrder(BaseModel):
    supplier_id: Optional[int] = None
    delivery_address: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    items: Optional[List[PurchaseOrderItem]] = None

class PurchaseOrderResponse(BaseModel):
    id: int
    po_number: str
    pr_number: Optional[str] = None
    supplier_id: int
    supplier: SupplierResponse
    delivery_address: str
    notes: Optional[str] = ""
    status: str
    total_amount: float
    date_created: str
    date_updated: str
    items: List[PurchaseOrderItem]

class CreateAbstractOfCanvass(BaseModel):
    pr_id: Optional[str] = None
    pr_number: Optional[str] = None
    selected_supplier_id: str
    remarks: Optional[str] = ""

class AbstractOfCanvassResponse(BaseModel):
    id: str
    pr_number: str
    selected_supplier_id: str
    selected_supplier: Optional[CanvassSupplier] = None
    suppliers: List[CanvassSupplier]
    total_amount: float
    status: str
    remarks: Optional[str] = ""
    awarded_by: Optional[str] = None
    date_created: str
    date_updated: Optional[str] = None

class AuditLogResponse(BaseModel):
    id: str
    user_id: int = 0
    username: str
    action: str
    entity: str
    table_name: str
    record_id: str
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    old_values: Optional[str] = None
    new_values: Optional[str] = None
    ip_address: Optional[str] = ""
    user_agent: Optional[str] = ""
    created_at: str

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
    suppliers: Optional[List[CanvassSupplier]] = None
    selected_supplier_ids: Optional[List[str]] = None
    canvass_submitted_at: Optional[str] = None

# Inspection Item model
class InspectionItem(BaseModel):
    item_description: str
    quantity_ordered: int
    quantity_received: int
    unit: str
    unit_price: float
    condition: str  # 'Good' | 'Defective' | 'Damaged'
    remarks: Optional[str] = ""

# Inspection Report model (for creating)
class CreateInspectionReport(BaseModel):
    po_number: str
    inspection_date: str
    inspected_by: str
    items: List[InspectionItem]
    overall_remarks: Optional[str] = ""
    status: str  # 'Accepted' | 'Partial' | 'Rejected'

# Inspection Report model (for response)
class InspectionReportResponse(BaseModel):
    id: str
    po_number: str
    inspection_date: str
    inspected_by: str
    items: List[InspectionItem]
    overall_remarks: str
    status: str
    date_created: str
    date_updated: Optional[str] = None

# Custodian Slip Item model
class CustodianSlipItem(BaseModel):
    item_description: str
    property_number: Optional[str] = None
    quantity: int
    unit: str
    unit_value: float
    total_value: float
    condition: str
    remarks: Optional[str] = ""

# Custodian Slip model (for creating)
class CreateCustodianSlip(BaseModel):
    slip_number: str
    date: str
    received_from: str
    received_by: str
    items: List[CustodianSlipItem]
    remarks: Optional[str] = ""
    status: str = "Submitted"
    inspection_report_id: Optional[str] = None  # Link to inspection report

# Custodian Slip model (for response)
class CustodianSlipResponse(BaseModel):
    id: str
    slip_number: str
    date: str
    received_from: str
    received_by: str
    items: List[CustodianSlipItem]
    remarks: str
    status: str
    inspection_report_id: Optional[str] = None
    date_created: str
    date_updated: Optional[str] = None

# Pending Inspection model (for orders waiting to be inspected)
class PendingInspection(BaseModel):
    id: str
    po_number: str
    pr_number: str
    supplier_name: str
    supplier_id: Optional[str] = None
    date_created: str
    date_updated: Optional[str] = None
    total_amount: float
    items: List[PurchaseRequestItem]
    status: str = "Pending Inspection"

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
    suppliers: Optional[List[CanvassSupplier]] = None
    selected_supplier_ids: Optional[List[str]] = None
    canvass_submitted_at: Optional[str] = None

# Property Return Slip Item model
class PropertyReturnSlipItem(BaseModel):
    date_acquired: str
    property_number: str
    quantity: int
    unit: str
    item_description: str
    amount: float
    remarks: Optional[str] = ""

# Property Return Slip model (for creating)
class CreatePropertyReturnSlip(BaseModel):
    prs_no: str
    entity_name: str
    return_type: str
    return_type_others: Optional[str] = None
    items: List[PropertyReturnSlipItem]
    returned_by: str
    returned_by_designation: Optional[str] = None
    returned_by_office: Optional[str] = None
    returned_date: str
    received_by: str
    noted_by: str
    status: str = "Submitted"

# Property Return Slip model (for response)
class PropertyReturnSlipResponse(BaseModel):
    id: str
    prs_no: str
    entity_name: str
    return_type: str
    return_type_others: Optional[str] = None
    items: List[PropertyReturnSlipItem]
    returned_by: str
    returned_by_designation: Optional[str] = None
    returned_by_office: Optional[str] = None
    returned_date: str
    received_by: str
    noted_by: str
    status: str
    date_created: str
    date_updated: Optional[str] = None

# Waste Materials Report Item model
class WasteItem(BaseModel):
    item_description: str
    quantity: int
    unit: str
    or_number: str
    or_amount: float
    disposal_method: str
    remarks: Optional[str] = ""

# Waste Materials Report model (for creating)
class CreateWasteMaterialsReport(BaseModel):
    report_number: str
    agency: str
    place_of_storage: str
    report_date: str
    certified_by: str
    certified_by_designation: Optional[str] = None
    approved_by: str
    approved_by_designation: Optional[str] = None
    property_inspector: Optional[str] = None
    witness_to_disposition: Optional[str] = None
    items: List[WasteItem]
    total_amount: float
    status: str = "Draft"

# Waste Materials Report model (for response)
class WasteMaterialsReportResponse(BaseModel):
    id: str
    report_number: str
    agency: str
    place_of_storage: str
    report_date: str
    certified_by: str
    certified_by_designation: Optional[str] = None
    approved_by: str
    approved_by_designation: Optional[str] = None
    property_inspector: Optional[str] = None
    witness_to_disposition: Optional[str] = None
    items: List[WasteItem]
    total_amount: float
    status: str
    date_created: str
    date_updated: Optional[str] = None

# Inspection Item model
class InspectionItem(BaseModel):
    item_description: str
    quantity_ordered: int
    quantity_received: int
    unit: str
    unit_price: float
    condition: str  # 'Good' | 'Defective' | 'Damaged'
    remarks: Optional[str] = ""

# Inspection Report model (for creating)
class CreateInspectionReport(BaseModel):
    po_number: str
    inspection_date: str
    inspected_by: str
    items: List[InspectionItem]
    overall_remarks: Optional[str] = ""
    status: str  # 'Accepted' | 'Partial' | 'Rejected'

# Inspection Report model (for response)
class InspectionReportResponse(BaseModel):
    id: str
    po_number: str
    inspection_date: str
    inspected_by: str
    items: List[InspectionItem]
    overall_remarks: str
    status: str
    date_created: str
    date_updated: Optional[str] = None

# Custodian Slip Item model
class CustodianSlipItem(BaseModel):
    item_description: str
    property_number: Optional[str] = None
    quantity: int
    unit: str
    unit_value: float
    total_value: float
    condition: str
    remarks: Optional[str] = ""

# Custodian Slip model (for creating)
class CreateCustodianSlip(BaseModel):
    slip_number: str
    date: str
    received_from: str
    received_by: str
    items: List[CustodianSlipItem]
    remarks: Optional[str] = ""
    status: str = "Submitted"
    inspection_report_id: Optional[str] = None  # Link to inspection report

# Custodian Slip model (for response)
class CustodianSlipResponse(BaseModel):
    id: str
    slip_number: str
    date: str
    received_from: str
    received_by: str
    items: List[CustodianSlipItem]
    remarks: str
    status: str
    inspection_report_id: Optional[str] = None
    date_created: str
    date_updated: Optional[str] = None

# Pending Inspection model (for orders waiting to be inspected)
class PendingInspection(BaseModel):
    id: str
    po_number: str
    pr_number: str
    supplier_name: str
    supplier_id: Optional[str] = None
    date_created: str
    date_updated: Optional[str] = None
    total_amount: float
    items: List[PurchaseRequestItem]
    status: str = "Pending Inspection"
