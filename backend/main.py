from fastapi import FastAPI, HTTPException, Depends, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
import os

# Import local modules
from database import connect_to_mongo, close_mongo_connection, get_database
from models import LoginRequest, LoginResponse, CreatePurchaseRequest, PurchaseRequestResponse
from auth import verify_password, create_access_token, decode_access_token
from datetime import datetime, timezone
from typing import List

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3003)
