import sys
import os
from typing import List, Dict, Optional
from datetime import datetime

# Add parent directory to path to import database module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_database
from scraper import scrape_supplier_from_url, search_public_suppliers, enrich_supplier_quality

async def save_suppliers_to_db(suppliers: List[Dict]) -> List[Dict]:
    """Save scraped suppliers to MongoDB"""
    try:
        db = await get_database()
        collection = db.supplier_search_results
        
        saved_suppliers = []
        for supplier in suppliers:
            # Check if supplier already exists (by supplier_name, item_description, and url)
            existing = await collection.find_one({
                "supplier_name": supplier.get("supplier_name"),
                "item_description": supplier.get("item_description"),
                "url": supplier.get("url")
            })
            
            if existing:
                # Update existing record
                supplier["date_scraped"] = datetime.now().isoformat()
                await collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": supplier}
                )
                supplier["id"] = str(existing["_id"])
                saved_suppliers.append(supplier)
            else:
                # Insert new record
                supplier["date_scraped"] = datetime.now().isoformat()
                result = await collection.insert_one(supplier)
                supplier["id"] = str(result.inserted_id)
                saved_suppliers.append(supplier)
        
        return saved_suppliers
    except Exception as e:
        print(f"Error saving suppliers to DB: {str(e)}")
        return suppliers  # Return original if save fails

async def get_suppliers_from_db(
    item_description: Optional[str] = None,
    category: Optional[str] = None,
    supplier_name: Optional[str] = None,
    limit: int = 50
) -> List[Dict]:
    """Retrieve suppliers from MongoDB"""
    try:
        db = await get_database()
        collection = db.supplier_search_results
        
        query = {}
        if item_description:
            query["item_description"] = {"$regex": item_description, "$options": "i"}
        if category:
            query["category"] = category
        if supplier_name:
            query["supplier_name"] = {"$regex": supplier_name, "$options": "i"}
        
        cursor = collection.find(query).sort("date_scraped", -1).limit(limit)
        results = await cursor.to_list(length=limit)
        
        # Convert ObjectId to string
        for result in results:
            result["id"] = str(result["_id"])
            # Add 'no' field for frontend
            result["no"] = results.index(result) + 1
            enrich_supplier_quality(result)
        
        return results
    except Exception as e:
        print(f"Error retrieving suppliers from DB: {str(e)}")
        return []

async def search_and_save_suppliers(
    urls: List[str],
    item_description: Optional[str] = None,
    stock_property_no: Optional[str] = None,
    unit: Optional[str] = None,
    quantity: Optional[int] = None,
    unit_cost: Optional[float] = None
) -> List[Dict]:
    """Scrape suppliers from URLs and save to MongoDB"""
    all_suppliers = []
    
    # Scrape from each URL
    for url in urls:
        if url.strip():
            scraped = scrape_supplier_from_url(url.strip(), item_description)
            for supplier in scraped:
                # Add additional fields from search form
                if stock_property_no:
                    supplier["stock_property_no"] = stock_property_no
                if unit:
                    supplier["unit"] = unit
                if quantity:
                    supplier["quantity"] = quantity
                if unit_cost:
                    supplier["unit_cost"] = unit_cost
            all_suppliers.extend(scraped)
    
    # If no URLs provided, use public search
    if not urls or len(urls) == 0:
        if item_description:
            public_results = search_public_suppliers(item_description)
            all_suppliers.extend(public_results)
    
    # Save to MongoDB
    if all_suppliers:
        saved_suppliers = await save_suppliers_to_db(all_suppliers)
        return saved_suppliers
    
    return all_suppliers

async def search_suppliers_from_purchase_requests(
    purchase_request_ids: List[str],
    stock_property_no: Optional[str] = None,
    unit: Optional[str] = None,
    quantity: Optional[int] = None,
    unit_cost: Optional[float] = None
) -> List[Dict]:
    """
    Extract items from checked purchase requests and search for suppliers
    based on item descriptions
    """
    try:
        db = await get_database()
        prs_collection = db.purchase_requests
        
        # Find purchase requests by IDs (convert to ObjectId if necessary)
        from bson import ObjectId
        
        object_ids = []
        for pr_id in purchase_request_ids:
            try:
                object_ids.append(ObjectId(pr_id))
            except:
                # If not a valid ObjectId, try to match by pr_number
                pass
        
        # Build query
        query = {
            "$or": [
                {"_id": {"$in": object_ids}} if object_ids else {},
                {"pr_number": {"$in": purchase_request_ids}}
            ]
        }
        # Remove empty $or conditions
        if "$or" in query:
            query["$or"] = [q for q in query["$or"] if q]
        if not query.get("$or"):
            del query["$or"]
        
        # Fetch the purchase requests
        cursor = prs_collection.find(query)
        purchase_requests = await cursor.to_list(length=None)
        
        # Extract items from purchase requests
        all_suppliers = []
        
        for pr in purchase_requests:
            items = pr.get("items", [])
            for item in items:
                item_desc = item.get("item_description", "General Item")
                
                # Search for public suppliers based on item description
                public_results = search_public_suppliers(item_desc)
                
                for supplier in public_results:
                    # Add additional fields
                    if stock_property_no:
                        supplier["stock_property_no"] = stock_property_no
                    if unit:
                        supplier["unit"] = unit
                    if quantity:
                        supplier["quantity"] = quantity
                    if unit_cost:
                        supplier["unit_cost"] = unit_cost
                    
                    # Add PR reference
                    supplier["pr_number"] = pr.get("pr_number", "")
                    supplier["purchase_request_id"] = str(pr.get("_id", ""))
                    
                all_suppliers.extend(public_results)
        
        # Save to MongoDB
        if all_suppliers:
            saved_suppliers = await save_suppliers_to_db(all_suppliers)
            return saved_suppliers
        
        return all_suppliers
        
    except Exception as e:
        print(f"Error searching suppliers from purchase requests: {str(e)}")
        return []

def get_suppliers(keyword: str, location: str):
    """Legacy synchronous function - kept for backward compatibility"""
    return search_public_suppliers(keyword, location)
