import sys
import os
from typing import List, Dict, Optional
from datetime import datetime

# Add parent directory to path to import database module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_database
from scraper import scrape_supplier_from_url, search_public_suppliers

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

def get_suppliers(keyword: str, location: str):
    """Legacy synchronous function - kept for backward compatibility"""
    return search_public_suppliers(keyword, location)
