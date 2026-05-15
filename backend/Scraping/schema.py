from pydantic import BaseModel
from typing import Optional

class SupplierOut(BaseModel):
    id: Optional[str] = None
    no: Optional[int] = None
    category: str
    item_description: str
    unit_price: float
    supplier_name: str
    address: Optional[str] = None
    source: Optional[str] = None
    source_type: Optional[str] = None
    verified: bool = False
    is_valid_supplier: bool = False
    price_found: bool = False
    confidence: Optional[int] = None
    extraction_status: Optional[str] = None
    extraction_warning: Optional[str] = None
    url: Optional[str] = None
    stock_property_no: Optional[str] = None
    unit: Optional[str] = None
    quantity: Optional[int] = None
    unit_cost: Optional[float] = None
    date_scraped: Optional[str] = None

class SupplierSearchRequest(BaseModel):
    urls: list[str] = []
    stock_property_no: Optional[str] = None
    unit: Optional[str] = None
    item_description: Optional[str] = None
    quantity: Optional[int] = None
    unit_cost: Optional[float] = None

class PurchaseRequestSearchRequest(BaseModel):
    """Request to search suppliers based on checked purchase requests"""
    purchase_request_ids: list[str] = []  # IDs of checked purchase requests
    stock_property_no: Optional[str] = None
    unit: Optional[str] = None
    quantity: Optional[int] = None
    unit_cost: Optional[float] = None

class AddSuppliersToCanvassRequest(BaseModel):
    """Request to add selected suppliers to a purchase request for canvassing"""
    purchase_request_id: str
    supplier_ids: list[str]  # IDs of suppliers to add
