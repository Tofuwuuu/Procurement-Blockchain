from fastapi import FastAPI, HTTPException, Depends, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
import os

# Import local modules
from database import connect_to_mongo, close_mongo_connection, get_database
from models import (
    LoginRequest, LoginResponse, CreatePurchaseRequest, PurchaseRequestResponse, UpdatePurchaseRequest,
    CreateInspectionReport, InspectionReportResponse, CreateCustodianSlip, CustodianSlipResponse,
    PendingInspection, CreatePropertyReturnSlip, PropertyReturnSlipResponse,
    CreateWasteMaterialsReport, WasteMaterialsReportResponse
)
from auth import verify_password, create_access_token, decode_access_token
from datetime import datetime, timezone
from typing import List
import socket
import time

# Import supplier search router
import sys
import os
scraping_path = os.path.join(os.path.dirname(__file__), 'Scraping')
if scraping_path not in sys.path:
    sys.path.append(scraping_path)
from supplier_api import router as supplier_search_router

# Import blockchain client
from api.blockchain_client import get_blockchain_client

# Create FastAPI instance
app = FastAPI(
    title="Blockchain Backend API",
    description="Backend API for Blockchain application",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include supplier search router
app.include_router(supplier_search_router)

# HTTP Bearer for token authentication
security = HTTPBearer()

# Startup event - Connect to MongoDB
@app.on_event("startup")
async def startup_event():
    await connect_to_mongo()

# Shutdown event - Close MongoDB connection
@app.on_event("shutdown")
async def shutdown_event():
    await close_mongo_connection()

# Health check endpoint
@app.get("/")
async def root():
    return {"message": "Blockchain Backend API is running"}

@app.get("/health")
async def health_check():
    try:
        db = await get_database()
        # Test database connection
        await db.command('ping')
        return {
            "status": "healthy",
            "database": "connected"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        }

# Login endpoint
@app.post("/api/auth/login", response_model=LoginResponse)
async def login(login_request: LoginRequest):
    """
    Authenticate user and return JWT token
    """
    try:
        db = await get_database()
        users_collection = db.users
        roles_collection = db.roles
        
        # Find user by username (try multiple possible fields)
        user = await users_collection.find_one({"username": login_request.username})
        if not user:
            # Try email as username
            user = await users_collection.find_one({"email": login_request.username})
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )
        
        # Check password - try multiple possible password fields
        password_hash = user.get("password_hash") or user.get("password") or user.get("hashed_password")
        
        if not password_hash:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )
        
        # Verify password (handles both bcrypt hashed and plain text)
        if not verify_password(login_request.password, password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )
        
        # Check if user is active
        if user.get("is_active") is False or user.get("status") == "inactive":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is disabled"
            )
        
        # Get role information - handle role_id reference or direct role name
        role_name = user.get("role", "employee")
        role_id = user.get("role_id")
        
        if role_id:
            # Fetch role details from roles collection
            role_doc = await roles_collection.find_one({"id": role_id} if isinstance(role_id, int) else {"_id": role_id})
            if role_doc:
                role_name = role_doc.get("name", role_name)
        
        # Determine if admin based on role
        is_admin = role_name.lower() == "admin" or user.get("is_admin", False)
        
        # Get user ID - handle both numeric id and ObjectId _id
        user_id = user.get("id")
        if not user_id and user.get("_id"):
            user_id = str(user["_id"])
        
        if not user_id:
            user_id = 0  # Default fallback
        
        # Create access token
        token_data = {
            "sub": user.get("username", ""),
            "user_id": str(user_id),
            "role": role_name
        }
        access_token = create_access_token(data=token_data)
        
        # Helper function to format datetime
        def format_datetime(dt):
            if not dt:
                return None
            if hasattr(dt, 'isoformat'):
                return dt.isoformat()
            return str(dt)
        
        # Convert user_id to int if possible, otherwise use as string
        try:
            user_id_int = int(user_id) if str(user_id).isdigit() else hash(str(user_id)) % 2147483647
        except:
            user_id_int = hash(str(user_id)) % 2147483647
        
        # Prepare user data matching frontend User interface
        user_data = {
            "id": user_id_int,
            "username": user.get("username") or "",
            "full_name": user.get("full_name") or user.get("name") or "",
            "position": user.get("position") or "",
            "department": user.get("department") or "",
            "role": role_name,
            "is_admin": is_admin,
            "created_at": format_datetime(user.get("created_at")),
            "updated_at": format_datetime(user.get("updated_at"))
        }
        
        return LoginResponse(
            success=True,
            message="Login successful",
            access_token=access_token,
            token_type="bearer",
            user=user_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ Login error: {str(e)}")
        print(f"Traceback: {error_trace}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during login: {str(e)}"
        )

# Get current user endpoint (expected by frontend)
@app.get("/api/auth/me")
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Get current authenticated user information
    """
    token = credentials.credentials
    payload = decode_access_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    try:
        db = await get_database()
        users_collection = db.users
        roles_collection = db.roles
        
        # Find user by username from token
        user = await users_collection.find_one({"username": payload.get("sub")})
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get role information
        role_name = user.get("role", "employee")
        role_id = user.get("role_id")
        
        if role_id:
            role_doc = await roles_collection.find_one({"id": role_id} if isinstance(role_id, int) else {"_id": role_id})
            if role_doc:
                role_name = role_doc.get("name", role_name)
        
        is_admin = role_name.lower() == "admin" or user.get("is_admin", False)
        user_id = user.get("id")
        if not user_id and user.get("_id"):
            user_id = str(user["_id"])
        if not user_id:
            user_id = 0
        
        # Helper function to format datetime
        def format_datetime(dt):
            if not dt:
                return None
            if hasattr(dt, 'isoformat'):
                return dt.isoformat()
            return str(dt)
        
        try:
            user_id_int = int(user_id) if str(user_id).isdigit() else hash(str(user_id)) % 2147483647
        except:
            user_id_int = hash(str(user_id)) % 2147483647
        
        return {
            "id": user_id_int,
            "username": user.get("username") or "",
            "full_name": user.get("full_name") or user.get("name") or "",
            "position": user.get("position") or "",
            "department": user.get("department") or "",
            "role": role_name,
            "is_admin": is_admin,
            "created_at": format_datetime(user.get("created_at")),
            "updated_at": format_datetime(user.get("updated_at"))
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred: {str(e)}"
        )

# Verify token endpoint
@app.get("/api/auth/verify")
async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Verify JWT token and return user information
    """
    token = credentials.credentials
    payload = decode_access_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    return {
        "valid": True,
        "user": {
            "username": payload.get("sub"),
            "user_id": payload.get("user_id"),
            "role": payload.get("role")
        }
    }

# Helper function to generate PR number
async def generate_pr_number() -> str:
    """Generate a unique PR number in format PR-YYYY-XXX"""
    db = await get_database()
    counters_collection = db.counters
    year = datetime.now().year
    
    try:
        # Get or increment counter for this year
        counter = await counters_collection.find_one_and_update(
            {"_id": f"pr_{year}"},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=True
        )
        seq = counter.get("seq", 1)
        return f"PR-{year}-{str(seq).zfill(3)}"
    except Exception as e:
        print(f"Error generating PR number: {e}")
        # Fallback: use timestamp
        timestamp = int(datetime.now().timestamp())
        return f"PR-{year}-{str(timestamp % 1000).zfill(3)}"

# Helper function to generate CC reference number
async def generate_cc_reference_number() -> str:
    """Generate a unique reference number in format CCYYYY-MMDD (and -XXX if needed)."""
    db = await get_database()
    counters_collection = db.counters
    now = datetime.now()
    year = now.year
    mmdd = now.strftime("%m%d")
    base = f"CC{year}-{mmdd}"
    key = f"cc_{year}_{mmdd}"

    try:
        counter = await counters_collection.find_one_and_update(
            {"_id": key},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=True
        )
        seq = int(counter.get("seq", 1))
        # First one of the day matches exactly what you asked: CC2025-0120
        if seq <= 1:
            return base
        # Subsequent ones get a suffix to avoid duplicates
        return f"{base}-{str(seq).zfill(3)}"
    except Exception as e:
        print(f"Error generating CC reference number: {e}")
        return base

# Create Purchase Request endpoint
@app.post("/api/purchase-requests", response_model=PurchaseRequestResponse)
async def create_purchase_request(
    request: CreatePurchaseRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create a new purchase request"""
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        db = await get_database()
        purchase_requests_collection = db.purchase_requests
        users_collection = db.users
        
        # Get user information
        user = await users_collection.find_one({"username": payload.get("sub")})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_id = str(user.get("_id")) if user.get("_id") else str(user.get("id", ""))
        requested_by = user.get("full_name") or user.get("username") or request.entity_name
        
        # Generate PR number
        pr_number = await generate_pr_number()
        
        # Calculate total amount
        total_amount = sum(item.total_cost for item in request.items)
        
        # Create purchase request document
        pr_doc = {
            "pr_number": pr_number,
            "ref_number": None,
            "entity_name": request.entity_name,
            "fund_cluster": request.fund_cluster or "",
            "office_section": request.office_section,
            "responsibility_center_code": request.responsibility_center_code or "",
            "date": request.date,
            "remark": request.remark or "",
            "status": "Pending",
            "requested_by": requested_by,
            "requested_by_id": user_id,
            "items": [item.dict() for item in request.items],
            "total_amount": total_amount,
            "date_created": datetime.now(timezone.utc).isoformat(),
            "date_updated": None
        }
        
        # Insert purchase request
        print(f"💾 Saving purchase request to MongoDB: {pr_doc}")
        result = await purchase_requests_collection.insert_one(pr_doc)
        
        if result.inserted_id:
            pr_doc["id"] = str(result.inserted_id)
            print(f"✅ Purchase request saved successfully with ID: {result.inserted_id}")
            return PurchaseRequestResponse(**pr_doc)
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create purchase request"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ Create purchase request error: {str(e)}")
        print(f"Traceback: {error_trace}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred: {str(e)}"
        )

# Get all Purchase Requests endpoint
# Note: This route must come before the /{pr_id} route to avoid path conflicts
@app.get("/api/purchase-requests", response_model=List[PurchaseRequestResponse])
async def get_purchase_requests(
    user_only: bool = Query(False),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get all purchase requests, optionally filtered by current user"""
    try:
        print(f"📥 GET /api/purchase-requests called with user_only={user_only}")
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            print("❌ Invalid token")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        print(f"✅ Token validated for user: {payload.get('sub')}")
        db = await get_database()
        purchase_requests_collection = db.purchase_requests
        
        # Build query
        query = {}
        if user_only:
            users_collection = db.users
            user = await users_collection.find_one({"username": payload.get("sub")})
            if user:
                user_id = str(user.get("_id")) if user.get("_id") else str(user.get("id", ""))
                query["requested_by_id"] = user_id
                print(f"🔍 Filtering by user_id: {user_id}")
            else:
                print(f"⚠️ User not found: {payload.get('sub')}")
        
        print(f"📊 MongoDB query: {query}")
        # Fetch purchase requests
        cursor = purchase_requests_collection.find(query).sort("date_created", -1)
        requests = await cursor.to_list(length=None)
        print(f"✅ Found {len(requests)} purchase requests")
        
        # Convert to response format
        result = []
        for req in requests:
            req["id"] = str(req["_id"])
            result.append(PurchaseRequestResponse(**req))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ Get purchase requests error: {str(e)}")
        print(f"Traceback: {error_trace}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred: {str(e)}"
        )

# Get single Purchase Request endpoint
@app.get("/api/purchase-requests/{pr_id}", response_model=PurchaseRequestResponse)
async def get_purchase_request(
    pr_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get a specific purchase request by ID"""
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        db = await get_database()
        purchase_requests_collection = db.purchase_requests
        
        from bson import ObjectId
        try:
            pr = await purchase_requests_collection.find_one({"_id": ObjectId(pr_id)})
        except:
            # Try by PR number if ObjectId fails
            pr = await purchase_requests_collection.find_one({"pr_number": pr_id})
        
        if not pr:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Purchase request not found"
            )
        
        pr["id"] = str(pr["_id"])
        return PurchaseRequestResponse(**pr)
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ Get purchase request error: {str(e)}")
        print(f"Traceback: {error_trace}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred: {str(e)}"
        )

# Update Purchase Request endpoint
@app.put("/api/purchase-requests/{pr_id}", response_model=PurchaseRequestResponse)
async def update_purchase_request(
    pr_id: str,
    update_data: UpdatePurchaseRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Update a purchase request (e.g., change status to Approved)"""
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        db = await get_database()
        purchase_requests_collection = db.purchase_requests
        
        from bson import ObjectId
        # Try to find by ObjectId first
        try:
            pr = await purchase_requests_collection.find_one({"_id": ObjectId(pr_id)})
            pr_filter = {"_id": ObjectId(pr_id)}
        except:
            # Try by PR number if ObjectId fails
            pr = await purchase_requests_collection.find_one({"pr_number": pr_id})
            pr_filter = {"pr_number": pr_id}
        
        if not pr:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Purchase request not found"
            )
        
        # Build update document with only provided fields
        update_doc = {}
        if update_data.entity_name is not None:
            update_doc["entity_name"] = update_data.entity_name
        if update_data.fund_cluster is not None:
            update_doc["fund_cluster"] = update_data.fund_cluster
        if update_data.office_section is not None:
            update_doc["office_section"] = update_data.office_section
        if update_data.responsibility_center_code is not None:
            update_doc["responsibility_center_code"] = update_data.responsibility_center_code
        if update_data.date is not None:
            update_doc["date"] = update_data.date
        if update_data.remark is not None:
            update_doc["remark"] = update_data.remark
        if update_data.ref_number is not None:
            update_doc["ref_number"] = update_data.ref_number
        if update_data.status is not None:
            update_doc["status"] = update_data.status
        if update_data.items is not None:
            update_doc["items"] = [item.dict() for item in update_data.items]
            # Recalculate total amount if items changed
            update_doc["total_amount"] = sum(item.total_cost for item in update_data.items)
        if getattr(update_data, "suppliers", None) is not None:
            update_doc["suppliers"] = [s.dict() for s in update_data.suppliers] if update_data.suppliers else []
        if getattr(update_data, "selected_supplier_ids", None) is not None:
            update_doc["selected_supplier_ids"] = update_data.selected_supplier_ids or []
        if getattr(update_data, "canvass_submitted_at", None) is not None:
            update_doc["canvass_submitted_at"] = update_data.canvass_submitted_at

        # If canvasser approves, generate CC ref number if missing
        new_status = update_doc.get("status")
        if new_status and str(new_status).lower() == "approved":
            existing_ref = pr.get("ref_number")
            if not existing_ref and "ref_number" not in update_doc:
                update_doc["ref_number"] = await generate_cc_reference_number()
        
        # If status is "Completed", save to pending_inspections database for inspector
        if new_status and str(new_status).lower() == "completed":
            pending_inspections_collection = db.pending_inspections
            
            # Get supplier information
            supplier_name = pr.get("entity_name", "N/A")
            supplier_id = None
            supplier_address = ""
            supplier_contact = ""
            supplier_phone = ""
            supplier_bir_tin = ""
            
            if pr.get("suppliers") and pr.get("selected_supplier_ids"):
                selected_supplier = next(
                    (s for s in pr.get("suppliers", []) 
                     if s.get("supplier_id") in pr.get("selected_supplier_ids", [])),
                    None
                )
                if selected_supplier:
                    supplier_name = selected_supplier.get("name", supplier_name)
                    supplier_id = selected_supplier.get("supplier_id")
                    supplier_address = selected_supplier.get("address", "")
                    supplier_contact = selected_supplier.get("contact_person", "")
                    supplier_phone = selected_supplier.get("phone", "")
            
            # Check if pending inspection record already exists
            existing_inspection = await pending_inspections_collection.find_one({"po_number": pr.get("pr_number")})
            if not existing_inspection:
                # Create pending inspection document with all purchase order details
                pending_inspection_doc = {
                    "po_number": pr.get("pr_number"),
                    "pr_number": pr.get("pr_number"),
                    "ref_number": pr.get("ref_number"),
                    "supplier_name": supplier_name,
                    "supplier_id": supplier_id,
                    "supplier_address": supplier_address,
                    "supplier_contact": supplier_contact,
                    "supplier_phone": supplier_phone,
                    "supplier_bir_tin": supplier_bir_tin,
                    "delivery_address": pr.get("office_section", ""),
                    "total_amount": pr.get("total_amount", 0),
                    "items_count": len(pr.get("items", [])),
                    "items": pr.get("items", []),
                    "notes": pr.get("remark", ""),
                    "requested_by": pr.get("requested_by", ""),
                    "date_created": pr.get("date_created"),
                    "date_updated": datetime.now(timezone.utc).isoformat(),
                    "status": "Pending Inspection",
                    "confirmed_at": datetime.now(timezone.utc).isoformat()
                }
                
                # Insert into pending_inspections database
                await pending_inspections_collection.insert_one(pending_inspection_doc)
                print(f"✅ Saved confirmed purchase order {pr.get('pr_number')} to pending_inspections database")
        
        # Always update date_updated timestamp
        update_doc["date_updated"] = datetime.now(timezone.utc).isoformat()
        
        # Perform the update
        print(f"💾 Updating purchase request {pr_id} with: {update_doc}")
        result = await purchase_requests_collection.update_one(
            pr_filter,
            {"$set": update_doc}
        )
        
        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Purchase request not found"
            )
        
        # Fetch the updated document
        updated_pr = await purchase_requests_collection.find_one(pr_filter)
        if not updated_pr:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve updated purchase request"
            )
        
        # Ensure all required fields are present for PurchaseRequestResponse
        updated_pr["id"] = str(updated_pr["_id"])
        
        # Required fields - use updated values if available, otherwise fall back to original
        if "pr_number" not in updated_pr:
            updated_pr["pr_number"] = pr.get("pr_number", "")
        if "entity_name" not in updated_pr:
            updated_pr["entity_name"] = pr.get("entity_name", "")
        if "office_section" not in updated_pr:
            updated_pr["office_section"] = pr.get("office_section", "")
        if "date" not in updated_pr:
            updated_pr["date"] = pr.get("date", "")
        if "status" not in updated_pr:
            updated_pr["status"] = pr.get("status", "Pending")
        if "requested_by" not in updated_pr:
            updated_pr["requested_by"] = pr.get("requested_by", "")
        if "items" not in updated_pr or not updated_pr.get("items"):
            updated_pr["items"] = pr.get("items", [])
        # Ensure items is a list (not None)
        if not isinstance(updated_pr.get("items"), list):
            updated_pr["items"] = []
        if "total_amount" not in updated_pr:
            updated_pr["total_amount"] = pr.get("total_amount", 0)
        if "date_created" not in updated_pr:
            updated_pr["date_created"] = pr.get("date_created", datetime.now(timezone.utc).isoformat())
        
        # Optional fields with defaults
        updated_pr.setdefault("ref_number", None)
        updated_pr.setdefault("fund_cluster", "")
        updated_pr.setdefault("responsibility_center_code", "")
        updated_pr.setdefault("remark", "")
        updated_pr.setdefault("requested_by_id", None)
        updated_pr.setdefault("date_updated", datetime.now(timezone.utc).isoformat())
        updated_pr.setdefault("suppliers", None)
        updated_pr.setdefault("selected_supplier_ids", None)
        updated_pr.setdefault("canvass_submitted_at", None)
        
        print(f"✅ Purchase request updated successfully: {updated_pr.get('pr_number')} - Status: {updated_pr.get('status')}")
        print(f"📋 Document keys: {list(updated_pr.keys())}")
        print(f"📦 Items count: {len(updated_pr.get('items', []))}")
        
        try:
            response = PurchaseRequestResponse(**updated_pr)
            return response
        except Exception as validation_error:
            print(f"❌ Validation error creating PurchaseRequestResponse: {str(validation_error)}")
            print(f"Error type: {type(validation_error).__name__}")
            print(f"Document keys: {list(updated_pr.keys())}")
            print(f"Document sample: {str(updated_pr)[:500]}")
            # Try to identify which field is causing the issue
            if hasattr(validation_error, 'errors'):
                print(f"Validation errors: {validation_error.errors()}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Validation error: {str(validation_error)}"
            )
        
    except HTTPException as he:
        print(f"❌ HTTPException in update_purchase_request: {he.status_code} - {he.detail}")
        raise he
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ Update purchase request error: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        print(f"Traceback: {error_trace}")
        # Raise HTTPException to maintain response_model consistency
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred: {str(e)}"
        )

# Test endpoint to verify purchase requests collection exists
@app.get("/api/test-purchase-requests")
async def test_purchase_requests_endpoint():
    """Test endpoint to verify MongoDB connection and purchase_requests collection"""
    try:
        db = await get_database()
        purchase_requests_collection = db.purchase_requests
        
        # Count documents
        count = await purchase_requests_collection.count_documents({})
        
        return {
            "message": "Purchase requests collection accessible",
            "collection": "purchase_requests",
            "document_count": count,
            "database": db.name
        }
    except Exception as e:
        return {
            "error": str(e),
            "message": "Failed to access purchase_requests collection"
        }

# Example API endpoint
@app.get("/api/test")
async def test_endpoint():
    return {"message": "API is working correctly"}

# ===== CONNECTIONS / NETWORK STATUS =====

def _tcp_check(host: str, port: int, timeout_seconds: float = 1.5) -> dict:
    """Attempt a TCP connect and measure latency."""
    start = time.time()
    try:
        with socket.create_connection((host, port), timeout=timeout_seconds):
            latency_ms = int((time.time() - start) * 1000)
            return {"ok": True, "latency_ms": latency_ms, "error": None}
    except Exception as e:
        latency_ms = int((time.time() - start) * 1000)
        return {"ok": False, "latency_ms": latency_ms, "error": str(e)}


@app.get("/api/connections")
async def get_connections_status(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Quick connectivity status for Fabric endpoints.

    This does NOT verify channel membership, just network reachability.
    """
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    # Defaults match your docker-compose-fabric.yml
    orderer_host = os.getenv("FABRIC_ORDERER_HOST", "orderer.example.com")
    orderer_port = int(os.getenv("FABRIC_ORDERER_PORT", "7050"))

    peer0_host = os.getenv("FABRIC_PEER0_HOST", "peer0.org1.example.com")
    peer0_port = int(os.getenv("FABRIC_PEER0_PORT", "7051"))

    peer1_host = os.getenv("FABRIC_PEER1_HOST", "peer1.org1.example.com")
    peer1_port = int(os.getenv("FABRIC_PEER1_PORT", "8051"))

    checks = [
        {"name": "orderer", "host": orderer_host, "port": orderer_port},
        {"name": "peer0", "host": peer0_host, "port": peer0_port},
        {"name": "peer1", "host": peer1_host, "port": peer1_port},
    ]

    results = []
    for c in checks:
        r = _tcp_check(c["host"], c["port"])
        results.append({
            "name": c["name"],
            "host": c["host"],
            "port": c["port"],
            "connected": r["ok"],
            "latency_ms": r["latency_ms"],
            "error": r["error"],
        })

    return {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "targets": results
    }

# ===== PENDING INSPECTIONS DATABASE =====

# Get all pending inspections (for inspector)
@app.get("/api/inspections")
async def get_inspections(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Fetch all pending inspections from pending_inspections collection"""
    try:
        # Verify authentication
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid or expired token"}
            )
        
        # Get database connection
        db = await get_database()
        pending_inspections_collection = db.pending_inspections
        
        # Fetch all documents from pending_inspections collection
        print(f"🔍 Fetching from pending_inspections collection...")
        cursor = pending_inspections_collection.find({}).sort("date_created", -1)
        inspections = await cursor.to_list(length=None)
        
        print(f"📊 Found {len(inspections)} documents in pending_inspections")
        
        # Convert MongoDB documents to JSON-serializable format
        result = []
        for doc in inspections:
            # Create a new dict to avoid modifying the original
            doc_dict = dict(doc)
            # Convert ObjectId to string
            doc_dict["id"] = str(doc_dict.get("_id", ""))
            # Remove _id to avoid serialization issues
            doc_dict.pop("_id", None)
            result.append(doc_dict)
        
        print(f"✅ Returning {len(result)} pending inspections")
        return JSONResponse(content=result, status_code=status.HTTP_200_OK)
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ Error fetching pending inspections: {str(e)}")
        print(f"Traceback: {error_trace}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": f"An error occurred: {str(e)}"}
        )

# Get single inspection by PO number
@app.get("/api/inspections/{po_number}")
async def get_inspection(
    po_number: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        db = await get_database()
        inspection_collection = db.pending_inspections
        
        inspection = await inspection_collection.find_one({"po_number": po_number})
        
        if not inspection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inspection not found"
            )
        
        inspection["id"] = str(inspection["_id"])
        return inspection
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred: {str(e)}"
        )

# Check if purchase order is already confirmed (in pending_inspections database)
@app.get("/api/inspections/check/{po_number}")
async def check_inspection_status(
    po_number: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Check if a purchase order exists in pending_inspections collection"""
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        db = await get_database()
        pending_inspections_collection = db.pending_inspections
        
        inspection = await pending_inspections_collection.find_one({"po_number": po_number})
        
        return {
            "exists": inspection is not None,
            "status": inspection.get("status") if inspection else None,
            "confirmed_at": inspection.get("confirmed_at") if inspection else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred: {str(e)}"
        )

# ===== INSPECTION REPORTS =====

# Create Inspection Report endpoint
@app.post("/api/inspection-reports", response_model=InspectionReportResponse)
async def create_inspection_report(
    report: CreateInspectionReport,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        db = await get_database()
        inspection_reports_collection = db.inspection_reports
        custodian_slips_collection = db.custodian_slips
        
        # Generate inspection report ID
        counter = await db.counters.find_one_and_update(
            {"_id": "inspection_report_id"},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=True
        )
        report_id = str(counter.get("seq", 1)) if counter else "1"
        
        # Create inspection report document
        report_doc = {
            "po_number": report.po_number,
            "inspection_date": report.inspection_date,
            "inspected_by": report.inspected_by,
            "items": [item.dict() for item in report.items],
            "overall_remarks": report.overall_remarks or "",
            "status": report.status,
            "date_created": datetime.now(timezone.utc).isoformat(),
            "date_updated": None
        }
        
        # Insert inspection report
        result = await inspection_reports_collection.insert_one(report_doc)
        inspection_report_id = str(result.inserted_id)
        report_doc["id"] = inspection_report_id
        
        # Record inspection on blockchain (immutable, timestamped, locked)
        try:
            blockchain_client = get_blockchain_client()
            blockchain_result = blockchain_client.record_inspection(
                inspection_id=inspection_report_id,
                po_number=report.po_number,
                inspection_date=report.inspection_date,
                inspected_by=report.inspected_by,
                status=report.status,
                items=[item.dict() for item in report.items],
                overall_remarks=report.overall_remarks or ""
            )
            
            if blockchain_result["success"]:
                # Update MongoDB document with blockchain transaction ID
                await inspection_reports_collection.update_one(
                    {"_id": result.inserted_id},
                    {"$set": {
                        "blockchain_tx_id": blockchain_result.get("tx_id"),
                        "blockchain_timestamp": blockchain_result.get("timestamp"),
                        "blockchain_recorded": True,
                        # keep Mongo doc aligned with chaincode "locked" behavior
                        "islocked": True
                    }}
                )
                print(f"✅ Inspection {inspection_report_id} recorded on blockchain: {blockchain_result.get('tx_id')}")
            else:
                print(f"⚠️ Failed to record inspection on blockchain: {blockchain_result.get('error')}")
                # Continue anyway - MongoDB record is saved
        except Exception as blockchain_error:
            print(f"⚠️ Blockchain recording error (continuing with MongoDB save): {str(blockchain_error)}")
            # Continue anyway - MongoDB record is saved
        
        # Update pending_inspections database - mark as inspected
        pending_inspections_collection = db.pending_inspections
        await pending_inspections_collection.update_one(
            {"po_number": report.po_number},
            {"$set": {
                "status": f"Inspected - {report.status}",
                "inspection_report_id": inspection_report_id,
                "inspected_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        print(f"✅ Updated inspection status for {report.po_number} in pending_inspections database")
        
        # If status is "Accepted", save to inspected collection and record on blockchain
        if report.status.lower() == "accepted":
            inspected_collection = db.inspected
            
            # Create inspected document
            inspected_doc = {
                "po_number": report.po_number,
                "inspection_date": report.inspection_date,
                "inspected_by": report.inspected_by,
                "items": [item.dict() for item in report.items],
                "overall_remarks": report.overall_remarks or "",
                "status": report.status,
                "date_created": datetime.now(timezone.utc).isoformat(),
                "date_updated": None,
                "inspection_report_id": inspection_report_id
            }
            
            # Insert or update inspected record
            inspected_result = await inspected_collection.update_one(
                {"po_number": report.po_number},
                {"$set": inspected_doc},
                upsert=True
            )
            
            # Get the inspected document ID for blockchain
            inspected_record = await inspected_collection.find_one({"po_number": report.po_number})
            inspected_id = str(inspected_record["_id"])
            
            # Record to blockchain using inspected collection ID
            try:
                blockchain_result = blockchain_client.record_inspection(
                    inspection_id=inspected_id,
                    po_number=report.po_number,
                    inspection_date=report.inspection_date,
                    inspected_by=report.inspected_by,
                    status=report.status,
                    items=[item.dict() for item in report.items],
                    overall_remarks=report.overall_remarks or ""
                )
                
                if blockchain_result.get("success"):
                    # Update inspected collection with blockchain info
                    await inspected_collection.update_one(
                        {"_id": inspected_record["_id"]},
                        {"$set": {
                            "blockchain_tx_id": blockchain_result.get("tx_id"),
                            "blockchain_timestamp": blockchain_result.get("timestamp"),
                            "blockchain_recorded": True,
                            "islocked": True
                        }}
                    )
                    print(f"✅ Accepted inspection {inspected_id} recorded on blockchain: {blockchain_result.get('tx_id')}")
                else:
                    print(f"⚠️ Failed to record accepted inspection on blockchain: {blockchain_result.get('error')}")
            except Exception as blockchain_error:
                print(f"⚠️ Blockchain recording error for accepted inspection: {str(blockchain_error)}")
            
            # Automatically create custodian slip
            # Generate slip number
            slip_counter = await db.counters.find_one_and_update(
                {"_id": "custodian_slip_id"},
                {"$inc": {"seq": 1}},
                upsert=True,
                return_document=True
            )
            slip_seq = slip_counter.get("seq", 1) if slip_counter else 1
            slip_number = f"ICS-{datetime.now().strftime('%Y%m%d')}-{str(slip_seq).zfill(4)}"
            
            # Convert inspection items to custodian slip items (only accepted items)
            slip_items = []
            for item in report.items:
                if item.condition.lower() == "good" and item.quantity_received > 0:
                    slip_items.append({
                        "item_description": item.item_description,
                        "property_number": None,
                        "quantity": item.quantity_received,
                        "unit": item.unit,
                        "unit_value": item.unit_price,
                        "total_value": item.unit_price * item.quantity_received,
                        "condition": item.condition,
                        "remarks": item.remarks or ""
                    })
            
            # Only create slip if there are accepted items
            if slip_items:
                # Get supplier info from purchase request
                purchase_requests_collection = db.purchase_requests
                pr = await purchase_requests_collection.find_one({"pr_number": report.po_number})
                received_from = "N/A"
                if pr:
                    # Try to get supplier name from selected suppliers
                    if pr.get("suppliers") and pr.get("selected_supplier_ids"):
                        selected_supplier = next(
                            (s for s in pr.get("suppliers", []) 
                             if s.get("supplier_id") in pr.get("selected_supplier_ids", [])),
                            None
                        )
                        if selected_supplier:
                            received_from = selected_supplier.get("name", pr.get("entity_name", "N/A"))
                        else:
                            received_from = pr.get("entity_name", "N/A")
                    else:
                        received_from = pr.get("entity_name", "N/A")
                
                # Create custodian slip document
                slip_doc = {
                    "slip_number": slip_number,
                    "date": report.inspection_date,
                    "received_from": received_from,
                    "received_by": report.inspected_by,
                    "items": slip_items,
                    "remarks": f"Auto-generated from Inspection Report {inspection_report_id}. {report.overall_remarks or ''}",
                    "status": "Submitted",
                    "inspection_report_id": inspection_report_id,
                    "date_created": datetime.now(timezone.utc).isoformat(),
                    "date_updated": None
                }
                
                # Insert custodian slip
                slip_result = await custodian_slips_collection.insert_one(slip_doc)
                print(f"✅ Auto-created custodian slip {slip_number} from inspection report {inspection_report_id}")
        
        return InspectionReportResponse(**report_doc)
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ Create inspection report error: {str(e)}")
        print(f"Traceback: {error_trace}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred: {str(e)}"
        )

# Get all Inspection Reports endpoint
@app.get("/api/inspection-reports", response_model=List[InspectionReportResponse])
async def get_inspection_reports(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        db = await get_database()
        inspection_reports_collection = db.inspection_reports
        
        cursor = inspection_reports_collection.find({}).sort("date_created", -1)
        reports = await cursor.to_list(length=None)
        
        result = []
        for report in reports:
            report["id"] = str(report["_id"])
            result.append(InspectionReportResponse(**report))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred: {str(e)}"
        )

# ===== INSPECTED COLLECTION =====

# Create Inspected Record endpoint
@app.post("/api/inspected", response_model=dict)
async def create_inspected(
    report: CreateInspectionReport,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        db = await get_database()
        inspected_collection = db.inspected
        
        # Create inspected document
        inspected_doc = {
            "po_number": report.po_number,
            "inspection_date": report.inspection_date,
            "inspected_by": report.inspected_by,
            "items": [item.dict() for item in report.items],
            "overall_remarks": report.overall_remarks or "",
            "status": report.status,
            "date_created": datetime.now(timezone.utc).isoformat(),
            "date_updated": None
        }
        
        # Insert or update inspected record
        result = await inspected_collection.update_one(
            {"po_number": report.po_number},
            {"$set": inspected_doc},
            upsert=True
        )

        # After MongoDB write, invoke chaincode so this DB event is recorded immutably.
        # We use the inspected document _id as the blockchain inspectionId for stable mapping.
        try:
            inspected_record = await inspected_collection.find_one({"po_number": report.po_number})
            inspected_id = str(inspected_record["_id"]) if inspected_record and inspected_record.get("_id") else None
            if inspected_id:
                blockchain_client = get_blockchain_client()
                blockchain_result = blockchain_client.record_inspection(
                    inspection_id=inspected_id,
                    po_number=report.po_number,
                    inspection_date=report.inspection_date,
                    inspected_by=report.inspected_by,
                    status=report.status,
                    items=[item.dict() for item in report.items],
                    overall_remarks=report.overall_remarks or ""
                )
                if blockchain_result.get("success"):
                    await inspected_collection.update_one(
                        {"_id": inspected_record["_id"]},
                        {"$set": {
                            "blockchain_tx_id": blockchain_result.get("tx_id"),
                            "blockchain_timestamp": blockchain_result.get("timestamp"),
                            "blockchain_recorded": True,
                            "islocked": True
                        }}
                    )
                    print(f"✅ Inspected record {inspected_id} recorded on blockchain")
                else:
                    print(f"⚠️ Failed to record inspected record on blockchain: {blockchain_result.get('error')}")
        except Exception as blockchain_error:
            print(f"⚠️ Blockchain recording error for /api/inspected: {str(blockchain_error)}")
        
        return {
            "ok": True,
            "message": f"Record saved to Inspected collection for {report.po_number}",
            "po_number": report.po_number
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred: {str(e)}"
        )

# Get Inspected Records endpoint
@app.get("/api/inspected", response_model=List[dict])
async def get_inspected(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        db = await get_database()
        inspected_collection = db.inspected
        
        cursor = inspected_collection.find({}).sort("date_created", -1)
        records = await cursor.to_list(length=None)
        
        result = []
        for record in records:
            # Convert BSON ObjectId to string for serialization
            record["id"] = str(record.pop("_id", ""))
            result.append(record)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred: {str(e)}"
        )

# ===== CUSTODIAN SLIPS =====

# Create Custodian Slip endpoint
@app.post("/api/custodian-slips", response_model=CustodianSlipResponse)
async def create_custodian_slip(
    slip: CreateCustodianSlip,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        db = await get_database()
        custodian_slips_collection = db.custodian_slips
        
        # Create custodian slip document
        slip_doc = {
            "slip_number": slip.slip_number,
            "date": slip.date,
            "received_from": slip.received_from,
            "received_by": slip.received_by,
            "items": [item.dict() for item in slip.items],
            "remarks": slip.remarks or "",
            "status": slip.status,
            "inspection_report_id": slip.inspection_report_id,
            "date_created": datetime.now(timezone.utc).isoformat(),
            "date_updated": None
        }
        
        # Insert custodian slip
        result = await custodian_slips_collection.insert_one(slip_doc)
        slip_doc["id"] = str(result.inserted_id)
        
        return CustodianSlipResponse(**slip_doc)
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ Create custodian slip error: {str(e)}")
        print(f"Traceback: {error_trace}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred: {str(e)}"
        )

# Get all Custodian Slips endpoint
@app.get("/api/custodian-slips", response_model=List[CustodianSlipResponse])
async def get_custodian_slips(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        db = await get_database()
        custodian_slips_collection = db.custodian_slips
        
        cursor = custodian_slips_collection.find({}).sort("date_created", -1)
        slips = await cursor.to_list(length=None)
        
        result = []
        for slip in slips:
            slip["id"] = str(slip["_id"])
            result.append(CustodianSlipResponse(**slip))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred: {str(e)}"
        )

# ===== INVENTORY TRANSFER REPORTS =====
@app.post("/api/inventory-transfer-reports")
async def create_inventory_transfer_report(
    transfer_data: dict,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create a new inventory transfer report"""
    try:
        # Verify token
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        db = await get_database()
        collection = db.inventory_transfer_reports
        
        # Prepare document
        doc = {
            "itr_no": transfer_data.get("itr_no", ""),
            "entity_name": transfer_data.get("entity_name", ""),
            "fund_cluster": transfer_data.get("fund_cluster", ""),
            "transfer_type": transfer_data.get("transfer_type", ""),
            "transfer_type_others": transfer_data.get("transfer_type_others", ""),
            "items": transfer_data.get("items", []),
            "reason_for_transfer": transfer_data.get("reason_for_transfer", ""),
            "approved_by": transfer_data.get("approved_by", ""),
            "released_issued_by": transfer_data.get("released_issued_by", ""),
            "received_by": transfer_data.get("received_by", ""),
            "date": transfer_data.get("date", ""),
            "status": transfer_data.get("status", "Draft"),
            "created_by": payload.get("sub", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Insert document
        result = await collection.insert_one(doc)
        
        return {
            "id": str(result.inserted_id),
            "itr_no": doc["itr_no"],
            "message": "Inventory Transfer Report created successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating transfer report: {str(e)}"
        )

@app.get("/api/inventory-transfer-reports")
async def get_inventory_transfer_reports(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get all inventory transfer reports"""
    try:
        # Verify token
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        db = await get_database()
        collection = db.inventory_transfer_reports
        
        # Fetch all reports
        cursor = collection.find({}).sort("created_at", -1)
        reports = await cursor.to_list(length=None)
        
        # Convert ObjectId and datetime to string for JSON serialization
        result = []
        for report in reports:
            try:
                # Convert _id to string
                if "_id" in report:
                    report["id"] = str(report["_id"])
                    del report["_id"]
                
                # Convert datetime strings (they should already be ISO format from creation)
                # This ensures all fields are JSON serializable
                result.append(report)
            except Exception as e:
                print(f"Error processing report: {str(e)}")
                continue
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in GET /api/inventory-transfer-reports: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching transfer reports: {str(e)}"
        )

@app.get("/api/inventory-transfer-reports/{itr_id}")
async def get_inventory_transfer_report(
    itr_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get a specific inventory transfer report"""
    try:
        # Verify token
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        from bson import ObjectId
        db = await get_database()
        collection = db.inventory_transfer_reports
        
        # Fetch report
        try:
            report = await collection.find_one({"_id": ObjectId(itr_id)})
        except:
            report = None
        
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transfer report not found"
            )
        
        # Convert ObjectId to string
        if "_id" in report:
            report["id"] = str(report["_id"])
            del report["_id"]
        
        return report
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in GET /api/inventory-transfer-reports/{{id}}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching transfer report: {str(e)}"
        )

# ===== PROPERTY TRANSFER REPORTS =====
@app.post("/api/property-transfer-reports")
async def create_property_transfer_report(
    transfer_data: dict,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create a new property transfer report"""
    try:
        # Verify token
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        db = await get_database()
        collection = db.property_transfer_reports
        
        # Prepare document
        doc = {
            "itr_no": transfer_data.get("itr_no", ""),
            "entity_name": transfer_data.get("entity_name", ""),
            "fund_cluster": transfer_data.get("fund_cluster", ""),
            "transfer_type": transfer_data.get("transfer_type", ""),
            "transfer_type_others": transfer_data.get("transfer_type_others", ""),
            "items": transfer_data.get("items", []),
            "reason_for_transfer": transfer_data.get("reason_for_transfer", ""),
            "approved_by": transfer_data.get("approved_by", ""),
            "released_issued_by": transfer_data.get("released_issued_by", ""),
            "received_by": transfer_data.get("received_by", ""),
            "date": transfer_data.get("date", ""),
            "status": transfer_data.get("status", "Draft"),
            "created_by": payload.get("sub", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Insert document
        result = await collection.insert_one(doc)
        
        return {
            "id": str(result.inserted_id),
            "itr_no": doc["itr_no"],
            "message": "Property Transfer Report created successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating transfer report: {str(e)}"
        )

@app.get("/api/property-transfer-reports")
async def get_property_transfer_reports(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get all property transfer reports"""
    try:
        # Verify token
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        db = await get_database()
        collection = db.property_transfer_reports
        
        # Fetch all reports
        cursor = collection.find({}).sort("created_at", -1)
        reports = await cursor.to_list(length=None)
        
        # Convert ObjectId and datetime to string for JSON serialization
        result = []
        for report in reports:
            try:
                # Convert _id to string
                if "_id" in report:
                    report["id"] = str(report["_id"])
                    del report["_id"]
                
                # Convert datetime strings (they should already be ISO format from creation)
                # This ensures all fields are JSON serializable
                result.append(report)
            except Exception as e:
                print(f"Error processing report: {str(e)}")
                continue
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in GET /api/property-transfer-reports: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching transfer reports: {str(e)}"
        )

@app.get("/api/property-transfer-reports/{ptr_id}")
async def get_property_transfer_report(
    ptr_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get a specific property transfer report"""
    try:
        # Verify token
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        from bson import ObjectId
        db = await get_database()
        collection = db.property_transfer_reports
        
        # Fetch report
        try:
            report = await collection.find_one({"_id": ObjectId(ptr_id)})
        except:
            report = None
        
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transfer report not found"
            )
        
        # Convert ObjectId to string
        if "_id" in report:
            report["id"] = str(report["_id"])
            del report["_id"]
        
        return report
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in GET /api/property-transfer-reports/{{id}}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching transfer report: {str(e)}"
        )

# ===== PROPERTY RETURN SLIPS =====
@app.post("/api/property-return-slips", response_model=PropertyReturnSlipResponse)
async def create_property_return_slip(
    slip_data: CreatePropertyReturnSlip,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create a new property return slip"""
    try:
        # Verify token
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        print(f"✅ Received property return slip data: {slip_data}")
        
        db = await get_database()
        collection = db.property_return_slips
        
        # Prepare the document
        slip_doc = {
            "prs_no": slip_data.prs_no,
            "entity_name": slip_data.entity_name,
            "return_type": slip_data.return_type,
            "return_type_others": slip_data.return_type_others or "",
            "items": [item.dict() for item in slip_data.items],
            "returned_by": slip_data.returned_by,
            "returned_by_designation": slip_data.returned_by_designation or "",
            "returned_by_office": slip_data.returned_by_office or "",
            "returned_date": slip_data.returned_date,
            "received_by": slip_data.received_by,
            "noted_by": slip_data.noted_by,
            "status": slip_data.status,
            "date_created": datetime.now(timezone.utc).isoformat(),
            "date_updated": datetime.now(timezone.utc).isoformat()
        }
        
        # Insert document
        result = await collection.insert_one(slip_doc)
        slip_doc["id"] = str(result.inserted_id)
        
        # Remove MongoDB _id field if present
        if "_id" in slip_doc:
            del slip_doc["_id"]
        
        return slip_doc
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in POST /api/property-return-slips: {str(e)}")
        import traceback
        print(f"Full error traceback:\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating property return slip: {str(e)}"
        )

@app.get("/api/property-return-slips", response_model=list)
async def get_property_return_slips(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get all property return slips"""
    try:
        # Verify token
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        db = await get_database()
        collection = db.property_return_slips
        
        # Fetch all slips
        slips = await collection.find().to_list(None)
        
        # Convert ObjectId to string
        for slip in slips:
            if "_id" in slip:
                slip["id"] = str(slip["_id"])
                del slip["_id"]
        
        return slips
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in GET /api/property-return-slips: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching property return slips: {str(e)}"
        )

@app.get("/api/property-return-slips/{slip_id}")
async def get_property_return_slip(
    slip_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get a specific property return slip"""
    try:
        # Verify token
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        from bson import ObjectId
        db = await get_database()
        collection = db.property_return_slips
        
        # Fetch slip
        try:
            slip = await collection.find_one({"_id": ObjectId(slip_id)})
        except:
            slip = None
        
        if not slip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Property return slip not found"
            )
        
        # Convert ObjectId to string
        if "_id" in slip:
            slip["id"] = str(slip["_id"])
            del slip["_id"]
        
        return slip
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in GET /api/property-return-slips/{{id}}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching property return slip: {str(e)}"
        )

# ===== WASTE MATERIALS REPORTS =====
@app.post("/api/waste-materials-reports", response_model=WasteMaterialsReportResponse)
async def create_waste_materials_report(
    report_data: CreateWasteMaterialsReport,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create a new waste materials report"""
    try:
        # Verify token
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        print(f"✅ Received waste materials report data: {report_data}")
        
        db = await get_database()
        collection = db.waste_materials_reports
        
        # Prepare the document
        report_doc = {
            "report_number": report_data.report_number,
            "agency": report_data.agency,
            "place_of_storage": report_data.place_of_storage,
            "report_date": report_data.report_date,
            "certified_by": report_data.certified_by,
            "certified_by_designation": report_data.certified_by_designation or "",
            "approved_by": report_data.approved_by,
            "approved_by_designation": report_data.approved_by_designation or "",
            "property_inspector": report_data.property_inspector or "",
            "witness_to_disposition": report_data.witness_to_disposition or "",
            "items": [item.dict() for item in report_data.items],
            "total_amount": report_data.total_amount,
            "status": report_data.status,
            "date_created": datetime.now(timezone.utc).isoformat(),
            "date_updated": datetime.now(timezone.utc).isoformat()
        }
        
        # Insert document
        result = await collection.insert_one(report_doc)
        report_doc["id"] = str(result.inserted_id)
        
        # Remove MongoDB _id field if present
        if "_id" in report_doc:
            del report_doc["_id"]
        
        return report_doc
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in POST /api/waste-materials-reports: {str(e)}")
        import traceback
        print(f"Full error traceback:\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating waste materials report: {str(e)}"
        )

@app.get("/api/waste-materials-reports", response_model=list)
async def get_waste_materials_reports(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get all waste materials reports"""
    try:
        # Verify token
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        db = await get_database()
        collection = db.waste_materials_reports
        
        # Fetch all reports
        reports = await collection.find().to_list(None)
        
        # Convert ObjectId to string
        for report in reports:
            if "_id" in report:
                report["id"] = str(report["_id"])
                del report["_id"]
        
        return reports
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in GET /api/waste-materials-reports: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching waste materials reports: {str(e)}"
        )

@app.get("/api/waste-materials-reports/{id}", response_model=WasteMaterialsReportResponse)
async def get_waste_materials_report(
    id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get a specific waste materials report"""
    try:
        # Verify token
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        db = await get_database()
        collection = db.waste_materials_reports
        
        # Fetch report
        from bson.objectid import ObjectId
        report = await collection.find_one({"_id": ObjectId(id)})
        
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Waste materials report not found"
            )
        
        report["id"] = str(report["_id"])
        del report["_id"]
        
        return report
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in GET /api/waste-materials-reports/{{id}}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching waste materials report: {str(e)}"
        )

# ===== BLOCKCHAIN INSPECTION RECORDS =====

@app.get("/api/blockchain/inspections")
async def get_blockchain_inspections(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Return all Accepted records from the `inspected` collection, with blockchain sync metadata.

    IMPORTANT: This endpoint is intentionally fast and does NOT attempt to sync to blockchain
    (sync can be slow / time out). Use POST /api/blockchain/inspections/sync for syncing.
    """
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        db = await get_database()
        inspected_collection = db.inspected
        
        # Get all accepted inspections from the inspected collection
        cursor = inspected_collection.find({
            "status": "Accepted"
        }).sort("date_created", -1)
        reports = await cursor.to_list(length=None)
        
        result = []
        from bson.objectid import ObjectId
        
        for report in reports:
            # Convert ObjectId to string and create clean response dict
            report_id = str(report["_id"])
            
            # Create clean dict without ObjectId to avoid serialization issues
            islocked = report.get("islocked", False) or report.get("isLocked", False)
            blockchain_recorded = report.get("blockchain_recorded", False)
            
            clean_report = {
                "id": report_id,
                "po_number": report.get("po_number", ""),
                "inspection_date": report.get("inspection_date", ""),
                "inspected_by": report.get("inspected_by", ""),
                "status": report.get("status", "Accepted"),
                "items": report.get("items", []),
                "overall_remarks": report.get("overall_remarks", ""),
                "date_created": report.get("date_created", ""),
                "date_updated": report.get("date_updated"),
                "blockchain_tx_id": report.get("blockchain_tx_id"),
                "blockchain_timestamp": report.get("blockchain_timestamp"),
                "blockchain_recorded": blockchain_recorded,
                "islocked": islocked,
                # Populate blockchain_data for frontend compatibility
                "blockchain_data": {
                    "inspectionId": report_id,
                    "timestamp": report.get("blockchain_timestamp") or report.get("date_created", ""),
                    "locked": islocked,
                    "txId": report.get("blockchain_tx_id") or "pending"
                } if blockchain_recorded else None
            }

            result.append(clean_report)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching blockchain inspections: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching blockchain inspections: {str(e)}"
        )

@app.get("/api/blockchain/inspections/{inspection_id}")
async def get_blockchain_inspection(
    inspection_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get a specific inspection record from blockchain"""
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        blockchain_client = get_blockchain_client()
        result = blockchain_client.get_inspection(inspection_id)
        
        if result["success"]:
            return result["data"]
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result.get("error", "Inspection not found on blockchain")
            )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching blockchain inspection: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching blockchain inspection: {str(e)}"
        )

@app.get("/api/blockchain/inspections/po/{po_number}")
async def get_blockchain_inspections_by_po(
    po_number: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get inspection records by PO number from blockchain"""
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        blockchain_client = get_blockchain_client()
        result = blockchain_client.get_inspection_by_po(po_number)
        
        if result["success"]:
            return result["data"]
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result.get("error", "Inspections not found on blockchain")
            )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching blockchain inspections by PO: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching blockchain inspections: {str(e)}"
        )

@app.get("/api/blockchain/inspections/{inspection_id}/verify")
async def verify_blockchain_inspection(
    inspection_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Verify the integrity of an inspection record on blockchain"""
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        # If this inspected record was never synced, don't try blockchain
        db = await get_database()
        inspected_collection = db.inspected
        from bson.objectid import ObjectId
        try:
            inspected_doc = await inspected_collection.find_one({"_id": ObjectId(inspection_id)})
        except Exception:
            inspected_doc = None

        if inspected_doc and not inspected_doc.get("blockchain_recorded"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This record is not synced to blockchain yet. Sync it first."
            )

        blockchain_client = get_blockchain_client()
        result = blockchain_client.verify_inspection(inspection_id)
        
        if result["success"]:
            return result["data"]
        else:
            err = (result.get("error") or "").lower()
            # Connection / timeout -> service unavailable
            if "deadline" in err or "failed to connect" in err or "connection" in err:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Blockchain network is unreachable right now. Please try again later."
                )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result.get("error", "Inspection not found on blockchain")
            )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error verifying blockchain inspection: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error verifying blockchain inspection: {str(e)}"
        )

@app.post("/api/blockchain/inspections/sync")
async def sync_inspections_to_blockchain(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Manually sync all inspected records to blockchain"""
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        blockchain_client = get_blockchain_client()
        db = await get_database()
        inspected_collection = db.inspected
        
        # Get all accepted inspections that haven't been synced
        cursor = inspected_collection.find({
            "status": "Accepted",
            "$or": [
                {"blockchain_recorded": {"$ne": True}},
                {"blockchain_recorded": None},
                {"blockchain_tx_id": {"$exists": False}}
            ]
        }).sort("date_created", -1)
        reports = await cursor.to_list(length=None)
        
        synced_count = 0
        failed_count = 0
        results = []
        
        for report in reports:
            report_id = str(report["_id"])
            try:
                print(f"🔄 Syncing inspection {report_id} (PO: {report.get('po_number')}) to blockchain...")
                blockchain_result = blockchain_client.record_inspection(
                    inspection_id=report_id,
                    po_number=report.get("po_number", ""),
                    inspection_date=report.get("inspection_date", ""),
                    inspected_by=report.get("inspected_by", ""),
                    status=report.get("status", "Accepted"),
                    items=report.get("items", []),
                    overall_remarks=report.get("overall_remarks", "")
                )
                
                if blockchain_result.get("success"):
                    # Update MongoDB record with blockchain info
                    from bson.objectid import ObjectId
                    await inspected_collection.update_one(
                        {"_id": ObjectId(report_id)},
                        {"$set": {
                            "blockchain_tx_id": blockchain_result.get("tx_id"),
                            "blockchain_timestamp": blockchain_result.get("timestamp"),
                            "blockchain_recorded": True,
                            "islocked": True
                        }}
                    )
                    synced_count += 1
                    results.append({
                        "inspection_id": report_id,
                        "po_number": report.get("po_number"),
                        "status": "success",
                        "tx_id": blockchain_result.get("tx_id")
                    })
                    print(f"✅ Synced inspection {report_id} to blockchain")
                else:
                    failed_count += 1
                    results.append({
                        "inspection_id": report_id,
                        "po_number": report.get("po_number"),
                        "status": "failed",
                        "error": blockchain_result.get("error")
                    })
                    print(f"❌ Failed to sync inspection {report_id}: {blockchain_result.get('error')}")
            except Exception as sync_error:
                failed_count += 1
                results.append({
                    "inspection_id": report_id,
                    "po_number": report.get("po_number"),
                    "status": "error",
                    "error": str(sync_error)
                })
                print(f"❌ Error syncing inspection {report_id}: {str(sync_error)}")
        
        return {
            "success": True,
            "message": f"Sync completed: {synced_count} synced, {failed_count} failed",
            "synced_count": synced_count,
            "failed_count": failed_count,
            "total": len(reports),
            "results": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error syncing inspections to blockchain: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error syncing inspections: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3003)
