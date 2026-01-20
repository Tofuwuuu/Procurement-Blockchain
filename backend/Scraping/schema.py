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
    verified: bool = False
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
