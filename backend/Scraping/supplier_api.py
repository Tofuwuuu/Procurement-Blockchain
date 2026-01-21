from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from service import search_and_save_suppliers, get_suppliers_from_db, search_suppliers_from_purchase_requests
from schema import SupplierOut, SupplierSearchRequest, PurchaseRequestSearchRequest
from security import require_canvasser

router = APIRouter(prefix="/api/supplier-search", tags=["Supplier Search"])

@router.post("/search", response_model=List[SupplierOut])
async def search_suppliers(
    request: SupplierSearchRequest,
    user=Depends(require_canvasser)
):
    """
    Search suppliers by scraping URLs and/or searching database
    Returns results from MongoDB (saved from previous searches or newly scraped)
    """
    try:
        # First, scrape and save new suppliers if URLs provided
        if request.urls and len(request.urls) > 0:
            await search_and_save_suppliers(
                urls=request.urls,
                item_description=request.item_description,
                stock_property_no=request.stock_property_no,
                unit=request.unit,
                quantity=request.quantity,
                unit_cost=request.unit_cost
            )
        
        # Retrieve from database (includes newly scraped and existing)
        results = await get_suppliers_from_db(
            item_description=request.item_description,
            supplier_name=None,  # Can add search by supplier name later
            limit=100
        )
        
        # Convert to SupplierOut format
        supplier_out = []
        for i, result in enumerate(results):
            supplier_out.append(SupplierOut(
                id=result.get("id"),
                no=i + 1,
                category=result.get("category", "General"),
                item_description=result.get("item_description", ""),
                unit_price=result.get("unit_price", 0.0),
                supplier_name=result.get("supplier_name", "Unknown"),
                address=result.get("address"),
                source=result.get("source", "Web Scraping"),
                verified=result.get("verified", False),
                url=result.get("url"),
                stock_property_no=result.get("stock_property_no"),
                unit=result.get("unit"),
                quantity=result.get("quantity"),
                unit_cost=result.get("unit_cost"),
                date_scraped=result.get("date_scraped")
            ))
        
        return supplier_out
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error searching suppliers: {str(e)}"
        )

@router.get("/results", response_model=List[SupplierOut])
async def get_saved_results(
    item_description: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50,
    user=Depends(require_canvasser)
):
    """
    Get saved supplier search results from MongoDB
    """
    try:
        results = await get_suppliers_from_db(
            item_description=item_description,
            category=category,
            limit=limit
        )
        
        supplier_out = []
        for i, result in enumerate(results):
            supplier_out.append(SupplierOut(
                id=result.get("id"),
                no=i + 1,
                category=result.get("category", "General"),
                item_description=result.get("item_description", ""),
                unit_price=result.get("unit_price", 0.0),
                supplier_name=result.get("supplier_name", "Unknown"),
                address=result.get("address"),
                source=result.get("source", "Web Scraping"),
                verified=result.get("verified", False),
                url=result.get("url"),
                stock_property_no=result.get("stock_property_no"),
                unit=result.get("unit"),
                quantity=result.get("quantity"),
                unit_cost=result.get("unit_cost"),
                date_scraped=result.get("date_scraped")
            ))
        
        return supplier_out
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving results: {str(e)}"
        )

@router.post("/search-from-purchase-requests", response_model=List[SupplierOut])
async def search_suppliers_from_purchase_requests_endpoint(
    request: PurchaseRequestSearchRequest,
    user=Depends(require_canvasser)
):
    """
    Search suppliers based on items from checked purchase requests.
    
    If no supplier URL is provided, this endpoint automatically:
    1. Identifies checked Approved Purchase Requests
    2. Extracts item descriptions from those requests
    3. Uses those descriptions as search keywords
    4. Retrieves supplier information from public web sources
    
    The retrieved data is presented as reference information only and
    requires manual validation before final supplier selection.
    """
    try:
        # Search and save suppliers from purchase request items
        results = await search_suppliers_from_purchase_requests(
            purchase_request_ids=request.purchase_request_ids,
            stock_property_no=request.stock_property_no,
            unit=request.unit,
            quantity=request.quantity,
            unit_cost=request.unit_cost
        )
        
        # Convert to SupplierOut format
        supplier_out = []
        for i, result in enumerate(results):
            supplier_out.append(SupplierOut(
                id=result.get("id"),
                no=i + 1,
                category=result.get("category", "General"),
                item_description=result.get("item_description", ""),
                unit_price=result.get("unit_price", 0.0),
                supplier_name=result.get("supplier_name", "Unknown"),
                address=result.get("address"),
                source=result.get("source", "Public Web"),
                verified=result.get("verified", False),
                url=result.get("url"),
                stock_property_no=result.get("stock_property_no"),
                unit=result.get("unit"),
                quantity=result.get("quantity"),
                unit_cost=result.get("unit_cost"),
                date_scraped=result.get("date_scraped")
            ))
        
        return supplier_out
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error searching suppliers from purchase requests: {str(e)}"
        )

