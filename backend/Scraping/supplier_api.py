from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from datetime import datetime
from service import search_and_save_suppliers, get_suppliers_from_db, search_suppliers_from_purchase_requests
from schema import SupplierOut, SupplierSearchRequest, PurchaseRequestSearchRequest, AddSuppliersToCanvassRequest
from security import require_canvasser
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_database
from bson.objectid import ObjectId

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

@router.post("/add-to-canvass")
async def add_suppliers_to_canvass(
    request: AddSuppliersToCanvassRequest,
    user=Depends(require_canvasser)
):
    """
    Add selected suppliers to a Purchase Request for canvassing.
    This endpoint saves the supplier selection to the PR document in MongoDB.
    """
    try:
        print(f"🔍 add-to-canvass request: PR ID={request.purchase_request_id}, Supplier IDs={request.supplier_ids}")
        
        db = await get_database()
        
        # Validate PR exists
        pr_collection = db.get_collection("purchase_requests")
        pr = await pr_collection.find_one({"_id": ObjectId(request.purchase_request_id)})
        
        if not pr:
            print(f"❌ PR not found: {request.purchase_request_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Purchase Request not found: {request.purchase_request_id}"
            )
        
        print(f"✅ PR found: {pr.get('pr_number')}")
        
        # Fetch supplier details from supplier_search_results
        supplier_collection = db.get_collection("supplier_search_results")
        suppliers = []
        
        for supplier_id in request.supplier_ids:
            try:
                print(f"🔍 Looking for supplier: {supplier_id}")
                supplier = await supplier_collection.find_one({"_id": ObjectId(supplier_id)})
                if supplier:
                    # Store the FULL supplier info so canvassing can use all fields later.
                    # Keep Mongo _id as supplier_id string and strip ObjectId fields.
                    supplier_data = dict(supplier)
                    supplier_data.pop("_id", None)
                    supplier_data.pop("id", None)
                    supplier_data["supplier_id"] = str(supplier.get("_id"))
                    # Normalize a few fields used by the UI
                    supplier_data["name"] = supplier.get("supplier_name") or supplier.get("name")
                    supplier_data["date_added"] = datetime.now().isoformat()
                    suppliers.append(supplier_data)
                    print(f"✅ Supplier added: {supplier_data.get('name')}")
                else:
                    print(f"⚠️ Supplier not found: {supplier_id}")
            except Exception as e:
                print(f"❌ Error processing supplier {supplier_id}: {str(e)}")
        
        print(f"📊 Total suppliers to add: {len(suppliers)}")
        
        # Add suppliers to PR
        update_result = await pr_collection.update_one(
            {"_id": ObjectId(request.purchase_request_id)},
            {
                "$set": {
                    "suppliers": suppliers,
                    "date_updated": datetime.now().isoformat()
                }
            }
        )
        
        print(f"💾 Update result: modified_count={update_result.modified_count}")
        
        if update_result.modified_count == 0:
            print(f"❌ Failed to update PR")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to add suppliers to purchase request"
            )
        
        return {
            "success": True,
            "message": f"Added {len(suppliers)} supplier(s) to purchase request",
            "purchase_request_id": request.purchase_request_id,
            "suppliers_added": len(suppliers)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error adding suppliers to canvass: {str(e)}"
        )