from fastapi import FastAPI, HTTPException, Depends, status, Query, Request
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
    CreateWasteMaterialsReport, WasteMaterialsReportResponse,
    SupplierCreate, SupplierResponse, CreatePurchaseOrder, UpdatePurchaseOrder, PurchaseOrderResponse,
    CreateAbstractOfCanvass, AbstractOfCanvassResponse,
    CreateDeliveryReceipt, UpdateDeliveryReceipt, DeliveryReceiptResponse,
    CreateInvoice, UpdateInvoice, InvoiceResponse,
    CreatePayment, UpdatePayment, PaymentResponse, DisbursementVoucherResponse
)
from auth import verify_password, create_access_token, decode_access_token
from workflow_config import ApprovalMatrix, ApprovalStage, PRStatus, WorkflowTransitions
from datetime import datetime, timezone
from typing import List
import socket
import time

from Connection.Connector import register_client_ping, get_active_clients

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

@app.middleware("http")
async def audit_workflow_status_changes(request: Request, call_next):
    response = await call_next(request)
    audit_entry = getattr(request.state, "workflow_status_change", None)

    if audit_entry and 200 <= response.status_code < 400:
        try:
            db = await get_database()
            now = datetime.now(timezone.utc).isoformat()
            audit_doc = {
                "username": audit_entry.get("username", "unknown"),
                "user_id": audit_entry.get("user_id", 0),
                "action": audit_entry.get("action", "status_change"),
                "entity": audit_entry.get("entity"),
                "table_name": audit_entry.get("entity"),
                "record_id": str(audit_entry.get("record_id", "")),
                "old_status": audit_entry.get("old_status"),
                "new_status": audit_entry.get("new_status"),
                "old_values": audit_entry.get("old_status"),
                "new_values": audit_entry.get("new_status"),
                "ip_address": request.client.host if request.client else "",
                "user_agent": request.headers.get("user-agent", ""),
                "created_at": now,
                "timestamp": now
            }
            await db.audit_logs.insert_one(audit_doc)
        except Exception as audit_error:
            print(f"Audit log write failed: {audit_error}")

    return response

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

@app.get("/api/stats")
async def get_dashboard_stats(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Return real dashboard summary data for the frontend dashboard.
    """
    token = credentials.credentials
    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    def format_datetime(value):
        if not value:
            return datetime.now(timezone.utc).isoformat()
        if hasattr(value, "isoformat"):
            return value.isoformat()
        return str(value)

    def get_supplier_name(pr):
        selected_supplier_ids = pr.get("selected_supplier_ids") or []
        suppliers = pr.get("suppliers") or []
        if selected_supplier_ids and suppliers:
            selected_supplier = next(
                (supplier for supplier in suppliers if supplier.get("supplier_id") in selected_supplier_ids),
                None
            )
            if selected_supplier:
                return selected_supplier.get("name") or selected_supplier.get("supplier_name") or "N/A"
        if suppliers:
            first_supplier = suppliers[0]
            return first_supplier.get("name") or first_supplier.get("supplier_name") or "N/A"
        return pr.get("entity_name") or pr.get("requested_by") or "N/A"

    try:
        db = await get_database()
        purchase_requests_collection = db.purchase_requests
        purchase_orders_collection = db.purchase_orders

        order_count = await purchase_orders_collection.count_documents({})
        if order_count > 0:
            pending_orders = await purchase_orders_collection.count_documents({"status": {"$in": ["Draft", "Pending"]}})
            approved_orders = await purchase_orders_collection.count_documents({"status": "Approved"})
        else:
            pending_orders = await purchase_requests_collection.count_documents({"status": "Pending"})
            approved_orders = await purchase_requests_collection.count_documents({"status": "Approved"})

        low_inventory = 0
        try:
            low_inventory = await db.inventory.count_documents({"quantity": {"$lte": 10}})
        except Exception:
            low_inventory = 0

        recent_orders = []
        if order_count > 0:
            recent_po_docs = await purchase_orders_collection.find({}).sort("date_created", -1).limit(5).to_list(length=5)
            for order in recent_po_docs:
                normalized_order = normalize_purchase_order_response(order)
                recent_orders.append({
                    "id": normalized_order["id"],
                    "po_number": normalized_order["po_number"],
                    "supplier": {"name": normalized_order["supplier"]["name"]},
                    "date_created": normalized_order["date_created"],
                    "status": normalized_order["status"],
                    "total_amount": normalized_order["total_amount"]
                })
        else:
            recent_purchase_requests = await (
                purchase_requests_collection
                .find({})
                .sort("date_created", -1)
                .limit(5)
                .to_list(length=5)
            )

            for index, pr in enumerate(recent_purchase_requests, start=1):
                pr_number = pr.get("pr_number") or str(pr.get("_id"))
                recent_orders.append({
                    "id": index,
                    "po_number": pr_number,
                    "supplier": {
                        "name": get_supplier_name(pr)
                    },
                    "date_created": format_datetime(pr.get("date_created") or pr.get("date")),
                    "status": pr.get("status") or "Pending",
                    "total_amount": pr.get("total_amount") or 0
                })

        return {
            "pending_orders": pending_orders,
            "approved_orders": approved_orders,
            "low_inventory": low_inventory,
            "recent_orders": recent_orders
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Dashboard stats error: {str(e)}")
        print(f"Traceback: {error_trace}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while loading dashboard stats: {str(e)}"
        )

async def get_authenticated_user_context(credentials: HTTPAuthorizationCredentials):
    token = credentials.credentials
    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    db = await get_database()
    user = await db.users.find_one({"username": payload.get("sub")})
    user_id = 0
    role_name = payload.get("role") or "employee"
    if user:
        raw_user_id = user.get("id") or user.get("_id") or payload.get("sub")
        try:
            user_id = int(raw_user_id)
        except Exception:
            user_id = abs(hash(str(raw_user_id))) % 2147483647
        role_name = user.get("role") or role_name
        role_id = user.get("role_id")
        if role_id:
            role_doc = await db.roles.find_one({"id": role_id} if isinstance(role_id, int) else {"_id": role_id})
            if role_doc:
                role_name = role_doc.get("name", role_name)

    return {
        "payload": payload,
        "username": payload.get("sub") or "unknown",
        "user_id": user_id,
        "role": str(role_name or "employee").lower(),
        "user": user
    }

def mark_status_change_audit(request: Request, user_context: dict, entity: str, record_id: str, old_status: Optional[str], new_status: Optional[str]):
    if new_status is None or old_status == new_status:
        return
    request.state.workflow_status_change = {
        "username": user_context.get("username", "unknown"),
        "user_id": user_context.get("user_id", 0),
        "action": "status_change",
        "entity": entity,
        "record_id": record_id,
        "old_status": old_status,
        "new_status": new_status
    }

def role_allowed(user_context: dict, allowed_roles: List[str]) -> bool:
    role = str(user_context.get("role", "")).lower()
    return role in [allowed.lower() for allowed in allowed_roles]

def require_role(user_context: dict, allowed_roles: List[str], action: str):
    if not role_allowed(user_context, allowed_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{action} requires one of these roles: {', '.join(allowed_roles)}"
        )

def require_department_head_approval(user_context: dict):
    allowed = list({
        *WorkflowTransitions.CAN_REJECT,
        "department_head",
        "department head",
        "head",
        "supervisor"
    })
    require_role(user_context, allowed, "Purchase request approval")

def require_management_approval(user_context: dict):
    require_role(user_context, ["admin", "management", "manager", "validator"], "Purchase order approval")

def require_finance_approval(user_context: dict):
    require_role(user_context, ["admin", "finance"], "Payment approval")

def apply_pr_transition(pr: dict, requested_status: str, user_context: dict) -> dict:
    current_status = pr.get("status") or PRStatus.DRAFT.value
    target_status = requested_status
    normalized_current = current_status.lower()
    normalized_target = target_status.lower()
    update_doc = {
        "status": target_status,
        "workflow_action": normalized_target,
        "workflow_updated_by": user_context.get("username")
    }

    if normalized_target == "submitted":
        if normalized_current not in {"draft", "returned"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only Draft or Returned PRs can be submitted")
        if not WorkflowTransitions.can_user_submit(user_context.get("role", "")):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not allowed to submit purchase requests")
        required_stages = [stage.value for stage in ApprovalMatrix.get_required_stages(pr.get("total_amount", 0), pr.get("office_section"))]
        update_doc.update({
            "approval_required_stages": required_stages,
            "approval_current_stage": ApprovalStage.SUPERVISOR.value if required_stages else None,
            "approval_history": pr.get("approval_history", []) + [{
                "action": "Submitted",
                "by": user_context.get("username"),
                "at": datetime.now(timezone.utc).isoformat()
            }]
        })
        return update_doc

    if normalized_target == "approved":
        if normalized_current not in {"submitted", "under review"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only Submitted or Under Review PRs can be approved")
        require_department_head_approval(user_context)
        current_stage = pr.get("approval_current_stage") or ApprovalStage.SUPERVISOR.value
        if not WorkflowTransitions.can_user_approve_at_stage(user_context.get("role", ""), ApprovalStage.SUPERVISOR):
            allowed_department_roles = {"department_head", "department head", "head", "supervisor", "admin"}
            if user_context.get("role", "") not in allowed_department_roles:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Current approval stage requires department head approval")
        update_doc.update({
            "approval_current_stage": None,
            "approval_completed_at": datetime.now(timezone.utc).isoformat(),
            "approval_history": pr.get("approval_history", []) + [{
                "action": "Approved",
                "stage": current_stage,
                "by": user_context.get("username"),
                "at": datetime.now(timezone.utc).isoformat()
            }]
        })
        return update_doc

    if normalized_target == "rejected":
        if normalized_current not in {"submitted", "under review", "approved"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only submitted, under review, or approved PRs can be rejected")
        if not WorkflowTransitions.can_user_reject(user_context.get("role", "")):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not allowed to reject purchase requests")
        update_doc["approval_history"] = pr.get("approval_history", []) + [{
            "action": "Rejected",
            "by": user_context.get("username"),
            "at": datetime.now(timezone.utc).isoformat()
        }]
        return update_doc

    if normalized_target == "returned":
        if normalized_current not in {"submitted", "under review", "rejected"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only submitted, under review, or rejected PRs can be returned")
        if not WorkflowTransitions.can_user_reject(user_context.get("role", "")):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not allowed to return purchase requests")
        update_doc["approval_history"] = pr.get("approval_history", []) + [{
            "action": "Returned",
            "by": user_context.get("username"),
            "at": datetime.now(timezone.utc).isoformat()
        }]
        return update_doc

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid PR transition. Allowed transitions are Draft -> Submitted -> Approved, plus Rejected or Returned from review states."
    )

async def generate_sequential_number(collection, field_name: str, prefix: str) -> str:
    year = datetime.now(timezone.utc).year
    pattern_prefix = f"{prefix}-{year}-"
    cursor = collection.find({field_name: {"$regex": f"^{pattern_prefix}"}}).sort(field_name, -1).limit(1)
    docs = await cursor.to_list(length=1)
    next_number = 1
    if docs:
        last_value = docs[0].get(field_name, "")
        try:
            next_number = int(str(last_value).split("-")[-1]) + 1
        except Exception:
            next_number = 1
    return f"{pattern_prefix}{next_number:03d}"

async def get_next_numeric_id(collection) -> int:
    cursor = collection.find({"id": {"$exists": True}}).sort("id", -1).limit(1)
    docs = await cursor.to_list(length=1)
    return int(docs[0].get("id", 0)) + 1 if docs else 1

def normalize_supplier_response(supplier: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    supplier_id = supplier.get("id") or supplier.get("supplier_id") or 0
    try:
        supplier_id = int(supplier_id)
    except Exception:
        supplier_id = abs(hash(str(supplier_id))) % 2147483647
    return {
        "id": supplier_id,
        "name": supplier.get("name") or supplier.get("supplier_name") or "N/A",
        "address": supplier.get("address") or "",
        "province": supplier.get("province") or "",
        "contact_person": supplier.get("contact_person") or "",
        "phone": supplier.get("phone") or "",
        "email": supplier.get("email"),
        "bir_tin": supplier.get("bir_tin") or "",
        "is_active": supplier.get("is_active", True),
        "created_at": supplier.get("created_at") or now,
        "updated_at": supplier.get("updated_at") or supplier.get("created_at") or now
    }

def normalize_purchase_order_response(order: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    order_id = order.get("id") or 0
    try:
        order_id = int(order_id)
    except Exception:
        order_id = abs(hash(str(order_id))) % 2147483647
    supplier = normalize_supplier_response(order.get("supplier") or {})
    items = []
    for index, item in enumerate(order.get("items") or [], start=1):
        product = item.get("product") or {}
        product_id = item.get("product_id") or product.get("id") or index
        try:
            product_id = int(product_id)
        except Exception:
            product_id = index
        quantity = item.get("quantity") or 0
        unit_price = item.get("unit_price") or product.get("unit_price") or 0
        items.append({
            "id": item.get("id") or index,
            "product_id": product_id,
            "product": {
                "id": product_id,
                "name": product.get("name") or item.get("item_description") or "Unknown Item",
                "description": product.get("description") or "",
                "unit": product.get("unit") or item.get("unit") or "pcs",
                "unit_price": unit_price,
                "category": product.get("category") or "",
                "is_active": product.get("is_active", True)
            },
            "quantity": quantity,
            "unit_price": unit_price,
            "total_price": item.get("total_price") if item.get("total_price") is not None else quantity * unit_price
        })
    return {
        "id": order_id,
        "po_number": order.get("po_number") or "",
        "pr_number": order.get("pr_number"),
        "supplier_id": supplier["id"],
        "supplier": supplier,
        "delivery_address": order.get("delivery_address") or "",
        "notes": order.get("notes") or "",
        "status": order.get("status") or "Draft",
        "total_amount": order.get("total_amount") or sum(item["total_price"] for item in items),
        "date_created": order.get("date_created") or now,
        "date_updated": order.get("date_updated") or order.get("date_created") or now,
        "items": items
    }

def select_canvass_supplier(pr: dict, selected_supplier_id: Optional[str] = None) -> Optional[dict]:
    suppliers = pr.get("suppliers") or []
    selected_ids = pr.get("selected_supplier_ids") or []
    target_id = selected_supplier_id or (selected_ids[0] if selected_ids else None)
    if target_id:
        selected = next((supplier for supplier in suppliers if str(supplier.get("supplier_id")) == str(target_id)), None)
        if selected:
            return selected
    return suppliers[0] if suppliers else None

async def upsert_abstract_of_canvass(db, pr: dict, selected_supplier_id: Optional[str], username: str, remarks: str = "") -> Optional[dict]:
    selected_supplier = select_canvass_supplier(pr, selected_supplier_id)
    if not selected_supplier:
        return None

    supplier_id = str(selected_supplier.get("supplier_id") or selected_supplier_id or "")
    now = datetime.now(timezone.utc).isoformat()
    abstract_doc = {
        "pr_number": pr.get("pr_number"),
        "pr_id": str(pr.get("_id")),
        "selected_supplier_id": supplier_id,
        "selected_supplier": selected_supplier,
        "suppliers": pr.get("suppliers") or [],
        "total_amount": pr.get("total_amount", 0),
        "status": "Awarded",
        "remarks": remarks,
        "awarded_by": username,
        "date_updated": now
    }
    existing = await db.abstracts_of_canvass.find_one({"pr_number": pr.get("pr_number")})
    if existing:
        await db.abstracts_of_canvass.update_one({"_id": existing["_id"]}, {"$set": abstract_doc})
        abstract_doc["_id"] = existing["_id"]
        abstract_doc["date_created"] = existing.get("date_created", now)
    else:
        abstract_doc["date_created"] = now
        result = await db.abstracts_of_canvass.insert_one(abstract_doc)
        abstract_doc["_id"] = result.inserted_id

    await db.purchase_requests.update_one(
        {"_id": pr["_id"]},
        {"$set": {
            "selected_supplier_ids": [supplier_id],
            "canvass_submitted_at": now,
            "date_updated": now
        }}
    )
    return abstract_doc

def normalize_abstract_response(doc: dict) -> dict:
    return {
        "id": str(doc.get("_id")),
        "pr_number": doc.get("pr_number") or "",
        "selected_supplier_id": str(doc.get("selected_supplier_id") or ""),
        "selected_supplier": doc.get("selected_supplier"),
        "suppliers": doc.get("suppliers") or [],
        "total_amount": doc.get("total_amount") or 0,
        "status": doc.get("status") or "Awarded",
        "remarks": doc.get("remarks") or "",
        "awarded_by": doc.get("awarded_by"),
        "date_created": doc.get("date_created") or datetime.now(timezone.utc).isoformat(),
        "date_updated": doc.get("date_updated")
    }

def normalize_delivery_response(doc: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": int(doc.get("id", 0)),
        "receipt_number": doc.get("receipt_number") or "",
        "po_number": doc.get("po_number") or "",
        "delivery_date": doc.get("delivery_date") or now,
        "delivered_by": doc.get("delivered_by") or "",
        "received_by": doc.get("received_by") or "",
        "items": normalize_purchase_order_response({"items": doc.get("items") or []})["items"],
        "remarks": doc.get("remarks") or "",
        "status": doc.get("status") or "Pending",
        "date_created": doc.get("date_created") or now,
        "date_updated": doc.get("date_updated") or doc.get("date_created") or now
    }

def normalize_invoice_response(doc: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": int(doc.get("id", 0)),
        "invoice_number": doc.get("invoice_number") or "",
        "po_number": doc.get("po_number") or "",
        "supplier_name": doc.get("supplier_name") or "N/A",
        "invoice_date": doc.get("invoice_date") or now,
        "due_date": doc.get("due_date"),
        "amount": doc.get("amount") or 0,
        "status": doc.get("status") or "Submitted",
        "remarks": doc.get("remarks") or "",
        "date_created": doc.get("date_created") or now,
        "date_updated": doc.get("date_updated") or doc.get("date_created") or now
    }

def normalize_payment_response(doc: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": int(doc.get("id", 0)),
        "payment_number": doc.get("payment_number") or "",
        "invoice_number": doc.get("invoice_number") or "",
        "po_number": doc.get("po_number") or "",
        "amount": doc.get("amount") or 0,
        "payment_method": doc.get("payment_method") or "Bank Transfer",
        "status": doc.get("status") or "Pending Finance Approval",
        "approved_by": doc.get("approved_by"),
        "remarks": doc.get("remarks") or "",
        "date_created": doc.get("date_created") or now,
        "date_updated": doc.get("date_updated") or doc.get("date_created") or now
    }

def normalize_voucher_response(doc: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": int(doc.get("id", 0)),
        "voucher_number": doc.get("voucher_number") or "",
        "payment_number": doc.get("payment_number") or "",
        "invoice_number": doc.get("invoice_number") or "",
        "po_number": doc.get("po_number") or "",
        "amount": doc.get("amount") or 0,
        "status": doc.get("status") or "Prepared",
        "prepared_by": doc.get("prepared_by") or "",
        "approved_by": doc.get("approved_by"),
        "date_created": doc.get("date_created") or now,
        "date_updated": doc.get("date_updated") or doc.get("date_created") or now
    }

def make_blockchain_event_id(prefix: str, entity_id: str) -> str:
    safe_entity = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in str(entity_id))
    return f"{prefix}-{safe_entity}"

async def record_procurement_event_on_chain(
    event_type: str,
    entity_id: str,
    actor: str,
    status_value: str,
    payload: dict
) -> dict:
    event_prefix_map = {
        "PURCHASE_REQUEST_SUBMITTED": "PRSUB",
        "PURCHASE_REQUEST_APPROVED": "PRAPP",
        "PURCHASE_ORDER_ISSUED": "POISS",
        "DELIVERY_RECEIVING_CONFIRMED": "DELREC",
        "PAYMENT_COMPLETED": "PAYDONE",
    }
    event_id = make_blockchain_event_id(event_prefix_map.get(event_type, "EVENT"), entity_id)
    try:
        blockchain_client = get_blockchain_client()
        return blockchain_client.record_procurement_event(
            event_id=event_id,
            event_type=event_type,
            entity_id=entity_id,
            actor=actor,
            status=status_value,
            payload=payload
        )
    except Exception as blockchain_error:
        return {
            "success": False,
            "event_id": event_id,
            "error": str(blockchain_error),
            "message": "Blockchain recording failed"
        }

async def update_blockchain_event_metadata(collection, query: dict, event_result: dict):
    update_doc = {
        "blockchain_event_id": event_result.get("event_id"),
        "blockchain_event_tx_id": event_result.get("tx_id"),
        "blockchain_event_timestamp": event_result.get("timestamp"),
        "blockchain_event_recorded": bool(event_result.get("success")),
    }
    if not event_result.get("success"):
        update_doc["blockchain_event_error"] = event_result.get("error")
    await collection.update_one(query, {"$set": update_doc})

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
            "role": role_name,
            "is_admin": is_admin
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
            "status": PRStatus.DRAFT.value,
            "requested_by": requested_by,
            "requested_by_id": user_id,
            "items": [item.dict() for item in request.items],
            "total_amount": total_amount,
            "approval_required_stages": [stage.value for stage in ApprovalMatrix.get_required_stages(total_amount, request.office_section)],
            "approval_current_stage": None,
            "approval_history": [],
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
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Update a purchase request (e.g., change status to Approved)"""
    try:
        user_context = await get_authenticated_user_context(credentials)
        payload = user_context["payload"]
        
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
            update_doc.update(apply_pr_transition(pr, update_data.status, user_context))
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
            await upsert_abstract_of_canvass(
                db,
                {**pr, **update_doc},
                (update_doc.get("selected_supplier_ids") or pr.get("selected_supplier_ids") or [None])[0],
                user_context.get("username", "unknown")
            )
        
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

# Supplier endpoints
@app.get("/api/suppliers", response_model=List[SupplierResponse])
async def get_suppliers(credentials: HTTPAuthorizationCredentials = Depends(security)):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    suppliers = await db.suppliers.find({}).sort("name", 1).to_list(length=None)
    return [SupplierResponse(**normalize_supplier_response(supplier)) for supplier in suppliers]

@app.post("/api/suppliers/award", response_model=AbstractOfCanvassResponse)
async def award_supplier_from_canvass(award: CreateAbstractOfCanvass, credentials: HTTPAuthorizationCredentials = Depends(security)):
    user_context = await get_authenticated_user_context(credentials)
    db = await get_database()
    from bson import ObjectId

    query = {}
    if award.pr_id:
        try:
            query = {"_id": ObjectId(award.pr_id)}
        except Exception:
            query = {"pr_number": award.pr_id}
    elif award.pr_number:
        query = {"pr_number": award.pr_number}
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="pr_id or pr_number is required")

    pr = await db.purchase_requests.find_one(query)
    if not pr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase request not found")

    abstract_doc = await upsert_abstract_of_canvass(
        db,
        pr,
        award.selected_supplier_id,
        user_context.get("username", "unknown"),
        award.remarks or ""
    )
    if not abstract_doc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected supplier was not found on this canvass")
    return AbstractOfCanvassResponse(**normalize_abstract_response(abstract_doc))

@app.get("/api/suppliers/{supplier_id}", response_model=SupplierResponse)
async def get_supplier(supplier_id: int, credentials: HTTPAuthorizationCredentials = Depends(security)):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    supplier = await db.suppliers.find_one({"id": supplier_id})
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    return SupplierResponse(**normalize_supplier_response(supplier))

@app.post("/api/suppliers", response_model=SupplierResponse)
async def create_supplier(supplier_data: SupplierCreate, credentials: HTTPAuthorizationCredentials = Depends(security)):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    now = datetime.now(timezone.utc).isoformat()
    doc = supplier_data.dict()
    doc["id"] = await get_next_numeric_id(db.suppliers)
    doc["created_at"] = now
    doc["updated_at"] = now
    await db.suppliers.insert_one(doc)
    return SupplierResponse(**normalize_supplier_response(doc))

@app.put("/api/suppliers/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(supplier_id: int, supplier_data: SupplierCreate, credentials: HTTPAuthorizationCredentials = Depends(security)):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    update_doc = supplier_data.dict()
    update_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.suppliers.update_one({"id": supplier_id}, {"$set": update_doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    supplier = await db.suppliers.find_one({"id": supplier_id})
    return SupplierResponse(**normalize_supplier_response(supplier))

@app.delete("/api/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: int, credentials: HTTPAuthorizationCredentials = Depends(security)):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    result = await db.suppliers.delete_one({"id": supplier_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    return {"message": "Supplier deleted successfully"}

# Purchase Order endpoints
@app.post("/api/orders", response_model=PurchaseOrderResponse)
async def create_order(order_data: CreatePurchaseOrder, request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    user_context = await get_authenticated_user_context(credentials)
    db = await get_database()
    now = datetime.now(timezone.utc).isoformat()
    order_id = await get_next_numeric_id(db.purchase_orders)
    po_number = await generate_sequential_number(db.purchase_orders, "po_number", "PO")

    pr = None
    supplier = None
    items = []
    if order_data.pr_id or order_data.pr_number:
        from bson import ObjectId
        if order_data.pr_id:
            try:
                pr = await db.purchase_requests.find_one({"_id": ObjectId(order_data.pr_id)})
            except Exception:
                pr = await db.purchase_requests.find_one({"pr_number": order_data.pr_id})
        if not pr and order_data.pr_number:
            pr = await db.purchase_requests.find_one({"pr_number": order_data.pr_number})
        if not pr:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approved purchase request not found")
        if str(pr.get("status", "")).lower() not in {"approved", "completed"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Purchase request must be approved before creating a purchase order")
        selected_supplier = select_canvass_supplier(pr)
        supplier = normalize_supplier_response(selected_supplier or {"name": pr.get("entity_name", "N/A")})
        for index, item in enumerate(pr.get("items") or [], start=1):
            quantity = item.get("quantity") or 0
            unit_price = item.get("unit_cost") or 0
            items.append({
                "id": index,
                "product_id": index,
                "product": {
                    "id": index,
                    "name": item.get("item_description") or "Unknown Item",
                    "description": item.get("item_description") or "",
                    "unit": item.get("unit") or "pcs",
                    "unit_price": unit_price,
                    "category": "",
                    "is_active": True
                },
                "quantity": quantity,
                "unit_price": unit_price,
                "total_price": item.get("total_cost") if item.get("total_cost") is not None else quantity * unit_price
            })
    else:
        if not order_data.supplier_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="supplier_id is required when creating a purchase order manually")
        supplier_doc = await db.suppliers.find_one({"id": order_data.supplier_id})
        if not supplier_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
        supplier = normalize_supplier_response(supplier_doc)
        for index, item in enumerate(order_data.items or [], start=1):
            quantity = item.quantity
            unit_price = item.unit_price
            product = item.product.dict() if item.product else {}
            items.append({
                "id": index,
                "product_id": item.product_id or index,
                "product": {
                    "id": item.product_id or index,
                    "name": product.get("name") or f"Product {item.product_id or index}",
                    "description": product.get("description") or "",
                    "unit": product.get("unit") or "pcs",
                    "unit_price": unit_price,
                    "category": product.get("category") or "",
                    "is_active": product.get("is_active", True)
                },
                "quantity": quantity,
                "unit_price": unit_price,
                "total_price": item.total_price if item.total_price is not None else quantity * unit_price
            })

    total_amount = sum(item["total_price"] for item in items)
    order_doc = {
        "id": order_id,
        "po_number": po_number,
        "pr_number": pr.get("pr_number") if pr else None,
        "supplier_id": supplier["id"],
        "supplier": supplier,
        "delivery_address": order_data.delivery_address or (pr.get("office_section", "") if pr else ""),
        "notes": order_data.notes or (pr.get("remark", "") if pr else ""),
        "status": "Draft",
        "total_amount": total_amount,
        "items": items,
        "created_by": user_context.get("username"),
        "date_created": now,
        "date_updated": now
    }
    await db.purchase_orders.insert_one(order_doc)
    mark_status_change_audit(request, user_context, "purchase_orders", po_number, None, "Draft")
    event_result = await record_procurement_event_on_chain(
        "PURCHASE_ORDER_ISSUED",
        po_number,
        user_context.get("username", "unknown"),
        order_doc.get("status"),
        {
            "po_number": po_number,
            "pr_number": order_doc.get("pr_number"),
            "supplier": order_doc.get("supplier"),
            "total_amount": order_doc.get("total_amount"),
            "items": order_doc.get("items", [])
        }
    )
    await update_blockchain_event_metadata(db.purchase_orders, {"id": order_id}, event_result)
    if event_result.get("success"):
        order_doc.update({
            "blockchain_event_id": event_result.get("event_id"),
            "blockchain_event_tx_id": event_result.get("tx_id"),
            "blockchain_event_timestamp": event_result.get("timestamp"),
            "blockchain_event_recorded": True
        })
    return PurchaseOrderResponse(**normalize_purchase_order_response(order_doc))

@app.get("/api/orders", response_model=List[PurchaseOrderResponse])
async def get_orders(credentials: HTTPAuthorizationCredentials = Depends(security)):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    orders = await db.purchase_orders.find({}).sort("date_created", -1).to_list(length=None)
    return [PurchaseOrderResponse(**normalize_purchase_order_response(order)) for order in orders]

@app.get("/api/orders/{order_id}", response_model=PurchaseOrderResponse)
async def get_order(order_id: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    query = {"po_number": order_id}
    try:
        query = {"id": int(order_id)}
    except Exception:
        pass
    order = await db.purchase_orders.find_one(query)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    return PurchaseOrderResponse(**normalize_purchase_order_response(order))

@app.put("/api/orders/{order_id}", response_model=PurchaseOrderResponse)
async def update_order(order_id: str, order_data: UpdatePurchaseOrder, request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    user_context = await get_authenticated_user_context(credentials)
    db = await get_database()
    query = {"po_number": order_id}
    try:
        query = {"id": int(order_id)}
    except Exception:
        pass
    order = await db.purchase_orders.find_one(query)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    update_doc = {k: v for k, v in order_data.dict(exclude_unset=True).items() if v is not None}
    if order_data.status and str(order_data.status).lower() == "approved":
        require_management_approval(user_context)
        if str(order.get("status", "")).lower() not in {"draft", "pending", "submitted"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only draft, pending, or submitted purchase orders can be approved")
    if order_data.items is not None:
        update_doc["items"] = [item.dict() for item in order_data.items]
        update_doc["total_amount"] = sum((item.total_price if item.total_price is not None else item.quantity * item.unit_price) for item in order_data.items)
    update_doc["date_updated"] = datetime.now(timezone.utc).isoformat()
    await db.purchase_orders.update_one(query, {"$set": update_doc})
    updated_order = await db.purchase_orders.find_one(query)
    mark_status_change_audit(request, user_context, "purchase_orders", updated_order.get("po_number"), order.get("status"), updated_order.get("status"))
    return PurchaseOrderResponse(**normalize_purchase_order_response(updated_order))

@app.post("/api/orders/{order_id}/approve", response_model=PurchaseOrderResponse)
async def approve_order(order_id: str, request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    return await update_order(order_id, UpdatePurchaseOrder(status="Approved"), request, credentials)

# Delivery and Receiving endpoints
@app.post("/api/deliveries", response_model=DeliveryReceiptResponse)
async def create_delivery_receipt(delivery: CreateDeliveryReceipt, request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    user_context = await get_authenticated_user_context(credentials)
    db = await get_database()
    po = await db.purchase_orders.find_one({"po_number": delivery.po_number})
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    if str(po.get("status", "")).lower() not in {"approved", "completed"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only approved purchase orders can receive deliveries")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": await get_next_numeric_id(db.delivery_receipts),
        "receipt_number": await generate_sequential_number(db.delivery_receipts, "receipt_number", "DR"),
        "po_number": delivery.po_number,
        "delivery_date": delivery.delivery_date,
        "delivered_by": delivery.delivered_by,
        "received_by": delivery.received_by,
        "items": [item.dict() for item in delivery.items] if delivery.items else po.get("items", []),
        "remarks": delivery.remarks or "",
        "status": "Pending Acceptance",
        "created_by": user_context.get("username"),
        "date_created": now,
        "date_updated": now
    }
    await db.delivery_receipts.insert_one(doc)
    mark_status_change_audit(request, user_context, "delivery_receipts", doc["receipt_number"], None, doc["status"])
    return DeliveryReceiptResponse(**normalize_delivery_response(doc))

@app.get("/api/deliveries", response_model=List[DeliveryReceiptResponse])
async def get_delivery_receipts(credentials: HTTPAuthorizationCredentials = Depends(security)):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    docs = await db.delivery_receipts.find({}).sort("date_created", -1).to_list(length=None)
    return [DeliveryReceiptResponse(**normalize_delivery_response(doc)) for doc in docs]

@app.get("/api/deliveries/{receipt_id}", response_model=DeliveryReceiptResponse)
async def get_delivery_receipt(receipt_id: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    query = {"receipt_number": receipt_id}
    try:
        query = {"id": int(receipt_id)}
    except Exception:
        pass
    doc = await db.delivery_receipts.find_one(query)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery receipt not found")
    return DeliveryReceiptResponse(**normalize_delivery_response(doc))

@app.put("/api/deliveries/{receipt_id}", response_model=DeliveryReceiptResponse)
async def update_delivery_receipt(receipt_id: str, delivery_update: UpdateDeliveryReceipt, request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    user_context = await get_authenticated_user_context(credentials)
    db = await get_database()
    query = {"receipt_number": receipt_id}
    try:
        query = {"id": int(receipt_id)}
    except Exception:
        pass
    doc = await db.delivery_receipts.find_one(query)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery receipt not found")
    update_doc = {k: v for k, v in delivery_update.dict(exclude_unset=True).items() if v is not None}
    if "status" in update_doc and update_doc["status"] not in {"Accepted", "Rejected", "Pending Acceptance"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Delivery status must be Accepted, Rejected, or Pending Acceptance")
    update_doc["date_updated"] = datetime.now(timezone.utc).isoformat()
    await db.delivery_receipts.update_one(query, {"$set": update_doc})
    updated = await db.delivery_receipts.find_one(query)
    mark_status_change_audit(request, user_context, "delivery_receipts", updated.get("receipt_number"), doc.get("status"), updated.get("status"))
    if doc.get("status") != updated.get("status") and updated.get("status") in {"Accepted", "Rejected"}:
        event_result = await record_procurement_event_on_chain(
            "DELIVERY_RECEIVING_CONFIRMED",
            updated.get("receipt_number"),
            user_context.get("username", "unknown"),
            updated.get("status"),
            {
                "receipt_number": updated.get("receipt_number"),
                "po_number": updated.get("po_number"),
                "delivery_date": updated.get("delivery_date"),
                "delivered_by": updated.get("delivered_by"),
                "received_by": updated.get("received_by"),
                "items": updated.get("items", []),
                "remarks": updated.get("remarks", "")
            }
        )
        await update_blockchain_event_metadata(db.delivery_receipts, query, event_result)
        updated = await db.delivery_receipts.find_one(query)
    return DeliveryReceiptResponse(**normalize_delivery_response(updated))

# Invoice, Payment, and Disbursement Voucher endpoints
@app.post("/api/invoices", response_model=InvoiceResponse)
async def create_invoice(invoice: CreateInvoice, request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    user_context = await get_authenticated_user_context(credentials)
    db = await get_database()
    po = await db.purchase_orders.find_one({"po_number": invoice.po_number})
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    accepted_delivery = await db.delivery_receipts.find_one({"po_number": invoice.po_number, "status": "Accepted"})
    if not accepted_delivery:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invoice requires an accepted delivery receipt")
    existing = await db.invoices.find_one({"invoice_number": invoice.invoice_number})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invoice number already exists")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": await get_next_numeric_id(db.invoices),
        "invoice_number": invoice.invoice_number,
        "po_number": invoice.po_number,
        "supplier_name": invoice.supplier_name or (po.get("supplier") or {}).get("name", "N/A"),
        "invoice_date": invoice.invoice_date,
        "due_date": invoice.due_date,
        "amount": invoice.amount,
        "status": "Submitted",
        "remarks": invoice.remarks or "",
        "submitted_by": user_context.get("username"),
        "date_created": now,
        "date_updated": now
    }
    await db.invoices.insert_one(doc)
    mark_status_change_audit(request, user_context, "invoices", doc["invoice_number"], None, doc["status"])
    return InvoiceResponse(**normalize_invoice_response(doc))

@app.get("/api/invoices", response_model=List[InvoiceResponse])
async def get_invoices(credentials: HTTPAuthorizationCredentials = Depends(security)):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    docs = await db.invoices.find({}).sort("date_created", -1).to_list(length=None)
    return [InvoiceResponse(**normalize_invoice_response(doc)) for doc in docs]

@app.get("/api/invoices/{invoice_number}", response_model=InvoiceResponse)
async def get_invoice(invoice_number: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    doc = await db.invoices.find_one({"invoice_number": invoice_number})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    return InvoiceResponse(**normalize_invoice_response(doc))

@app.put("/api/invoices/{invoice_number}", response_model=InvoiceResponse)
async def update_invoice(invoice_number: str, invoice_update: UpdateInvoice, request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    user_context = await get_authenticated_user_context(credentials)
    db = await get_database()
    doc = await db.invoices.find_one({"invoice_number": invoice_number})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    update_doc = {k: v for k, v in invoice_update.dict(exclude_unset=True).items() if v is not None}
    if update_doc.get("status") not in {None, "Submitted", "Verified", "Rejected"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invoice status must be Submitted, Verified, or Rejected")
    update_doc["date_updated"] = datetime.now(timezone.utc).isoformat()
    await db.invoices.update_one({"invoice_number": invoice_number}, {"$set": update_doc})
    updated = await db.invoices.find_one({"invoice_number": invoice_number})
    mark_status_change_audit(request, user_context, "invoices", invoice_number, doc.get("status"), updated.get("status"))
    return InvoiceResponse(**normalize_invoice_response(updated))

@app.post("/api/payments", response_model=PaymentResponse)
async def create_payment(payment: CreatePayment, request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    user_context = await get_authenticated_user_context(credentials)
    db = await get_database()
    invoice = await db.invoices.find_one({"invoice_number": payment.invoice_number})
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    if str(invoice.get("status", "")).lower() not in {"submitted", "verified"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only submitted or verified invoices can be queued for payment")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": await get_next_numeric_id(db.payments),
        "payment_number": await generate_sequential_number(db.payments, "payment_number", "PAY"),
        "invoice_number": payment.invoice_number,
        "po_number": invoice.get("po_number"),
        "amount": payment.amount if payment.amount is not None else invoice.get("amount", 0),
        "payment_method": payment.payment_method or "Bank Transfer",
        "status": "Pending Finance Approval",
        "remarks": payment.remarks or "",
        "created_by": user_context.get("username"),
        "date_created": now,
        "date_updated": now
    }
    await db.payments.insert_one(doc)
    mark_status_change_audit(request, user_context, "payments", doc["payment_number"], None, doc["status"])
    return PaymentResponse(**normalize_payment_response(doc))

@app.get("/api/payments", response_model=List[PaymentResponse])
async def get_payments(credentials: HTTPAuthorizationCredentials = Depends(security)):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    docs = await db.payments.find({}).sort("date_created", -1).to_list(length=None)
    return [PaymentResponse(**normalize_payment_response(doc)) for doc in docs]

@app.put("/api/payments/{payment_number}", response_model=PaymentResponse)
async def update_payment(payment_number: str, payment_update: UpdatePayment, request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    user_context = await get_authenticated_user_context(credentials)
    db = await get_database()
    doc = await db.payments.find_one({"payment_number": payment_number})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    update_doc = {k: v for k, v in payment_update.dict(exclude_unset=True).items() if v is not None}
    if update_doc.get("status") == "Approved":
        require_finance_approval(user_context)
        update_doc["approved_by"] = user_context.get("username")
    if update_doc.get("status") not in {None, "Pending Finance Approval", "Approved", "Rejected", "Paid"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payment status")
    update_doc["date_updated"] = datetime.now(timezone.utc).isoformat()
    await db.payments.update_one({"payment_number": payment_number}, {"$set": update_doc})
    updated = await db.payments.find_one({"payment_number": payment_number})
    mark_status_change_audit(request, user_context, "payments", payment_number, doc.get("status"), updated.get("status"))
    if updated.get("status") == "Approved":
        existing_voucher = await db.disbursement_vouchers.find_one({"payment_number": payment_number})
        if not existing_voucher:
            now = datetime.now(timezone.utc).isoformat()
            voucher = {
                "id": await get_next_numeric_id(db.disbursement_vouchers),
                "voucher_number": await generate_sequential_number(db.disbursement_vouchers, "voucher_number", "DV"),
                "payment_number": payment_number,
                "invoice_number": updated.get("invoice_number"),
                "po_number": updated.get("po_number"),
                "amount": updated.get("amount", 0),
                "status": "Prepared",
                "prepared_by": user_context.get("username"),
                "approved_by": user_context.get("username"),
                "date_created": now,
                "date_updated": now
            }
            await db.disbursement_vouchers.insert_one(voucher)
    if doc.get("status") != updated.get("status") and updated.get("status") == "Paid":
        event_result = await record_procurement_event_on_chain(
            "PAYMENT_COMPLETED",
            payment_number,
            user_context.get("username", "unknown"),
            updated.get("status"),
            {
                "payment_number": payment_number,
                "invoice_number": updated.get("invoice_number"),
                "po_number": updated.get("po_number"),
                "amount": updated.get("amount"),
                "payment_method": updated.get("payment_method"),
                "approved_by": updated.get("approved_by")
            }
        )
        await update_blockchain_event_metadata(db.payments, {"payment_number": payment_number}, event_result)
        updated = await db.payments.find_one({"payment_number": payment_number})
    return PaymentResponse(**normalize_payment_response(updated))

@app.post("/api/payments/{payment_number}/approve", response_model=PaymentResponse)
async def approve_payment(payment_number: str, request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    return await update_payment(payment_number, UpdatePayment(status="Approved"), request, credentials)

@app.get("/api/disbursement-vouchers", response_model=List[DisbursementVoucherResponse])
async def get_disbursement_vouchers(credentials: HTTPAuthorizationCredentials = Depends(security)):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    docs = await db.disbursement_vouchers.find({}).sort("date_created", -1).to_list(length=None)
    return [DisbursementVoucherResponse(**normalize_voucher_response(doc)) for doc in docs]

# Audit log endpoint
@app.get("/api/audit-logs")
async def get_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    action: Optional[str] = Query(""),
    table_name: Optional[str] = Query(""),
    username: Optional[str] = Query(""),
    date_from: Optional[str] = Query(""),
    date_to: Optional[str] = Query(""),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    query = {}
    if action:
        query["action"] = action
    if table_name:
        query["table_name"] = table_name
    if username:
        query["username"] = {"$regex": username, "$options": "i"}
    if date_from or date_to:
        query["created_at"] = {}
        if date_from:
            query["created_at"]["$gte"] = date_from
        if date_to:
            query["created_at"]["$lte"] = date_to

    skip = (page - 1) * limit
    total = await db.audit_logs.count_documents(query)
    docs = await db.audit_logs.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    logs = []
    for doc in docs:
        logs.append({
            "id": str(doc.get("_id")),
            "user_id": doc.get("user_id", 0),
            "username": doc.get("username", "unknown"),
            "action": doc.get("action", "status_change"),
            "entity": doc.get("entity") or doc.get("table_name"),
            "table_name": doc.get("table_name") or doc.get("entity"),
            "record_id": doc.get("record_id", ""),
            "old_status": doc.get("old_status"),
            "new_status": doc.get("new_status"),
            "old_values": doc.get("old_values"),
            "new_values": doc.get("new_values"),
            "ip_address": doc.get("ip_address", ""),
            "user_agent": doc.get("user_agent", ""),
            "created_at": doc.get("created_at") or doc.get("timestamp")
        })
    return {"logs": logs, "total": total, "page": page, "limit": limit}

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

    clients = get_active_clients()

    return {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "targets": results,
        "clients": clients,
    }


@app.post("/api/connection/ping")
async def connection_ping(request: Request):
    """
    Lightweight heartbeat that frontend calls periodically.

    Used to show which desktops/browsers are currently connected
    and able to reach the backend over the network.
    """
    body = await request.json() if request.headers.get("content-type", "").startswith("application/json") else {}
    client_id = (body or {}).get("client_id") or ""

    ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    register_client_ping(client_id=client_id, ip=ip, user_agent=user_agent)

    return {
        "ok": True,
        "client_id": client_id or ip,
        "ip": ip,
        "user_agent": user_agent,
        "timestamp": datetime.now(timezone.utc).isoformat(),
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

@app.get("/api/blockchain/events")
async def get_blockchain_procurement_events(
    event_type: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Return inspection-derived blockchain events from Fabric inspection records."""
    await get_authenticated_user_context(credentials)
    def inspection_to_event(inspection: dict, source: str = "fabric") -> dict:
            inspection_id = (
                inspection.get("inspectionId")
                or inspection.get("inspection_id")
                or inspection.get("id")
                or str(inspection.get("_id", ""))
                or inspection.get("txId")
                or inspection.get("tx_id")
            )
            po_number = inspection.get("poNumber") or inspection.get("po_number") or ""
            timestamp = (
                inspection.get("timestamp")
                or inspection.get("blockchain_timestamp")
                or inspection.get("createdAt")
                or inspection.get("date_created")
                or inspection.get("inspectionDate")
                or inspection.get("inspection_date")
                or ""
            )
            transaction_id = inspection.get("txId") or inspection.get("tx_id") or inspection.get("blockchain_tx_id") or ""
            return {
                "event_id": f"INSP-{inspection_id}" if inspection_id else f"INSP-{transaction_id}",
                "event_type": "INSPECTION_RECORDED",
                "timestamp": timestamp,
                "performed_by": inspection.get("inspectedBy") or inspection.get("inspected_by") or "",
                "transaction_id": transaction_id,
                "status": inspection.get("status") or "",
                "details": {
                    "inspection_id": inspection_id,
                    "po_number": po_number,
                    "inspection_date": inspection.get("inspectionDate") or inspection.get("inspection_date") or "",
                    "items": inspection.get("items") or [],
                    "overall_remarks": inspection.get("overallRemarks") or inspection.get("overall_remarks") or "",
                    "creator_msp_id": inspection.get("creatorMspId") or inspection.get("creator_msp_id") or "",
                    "locked": bool(inspection.get("locked") or inspection.get("islocked") or inspection.get("blockchain_recorded")),
                    "source": source
                }
            }

    def apply_filters(events: list) -> list:
        filtered = events
        if event_type:
            filtered = [event for event in filtered if event["event_type"] == event_type]
        if entity_id:
            filtered = [
                event for event in filtered
                if entity_id in {
                    str(event.get("event_id", "")),
                    str(event.get("details", {}).get("inspection_id", "")),
                    str(event.get("details", {}).get("po_number", ""))
                }
            ]
        return filtered

    try:
        blockchain_client = get_blockchain_client()
        result = blockchain_client.get_all_inspections()

        if result.get("success"):
            inspections = result.get("data", [])
            if not isinstance(inspections, list):
                inspections = []
            events = [inspection_to_event(inspection, "fabric") for inspection in inspections]
            events = apply_filters(events)
            return {
                "events": events,
                "total": len(events),
                "source": "fabric"
            }

        db = await get_database()
        cursor = db.inspected.find({
            "$or": [
                {"blockchain_recorded": True},
                {"blockchain_tx_id": {"$exists": True, "$ne": None}},
                {"islocked": True},
                {"isLocked": True}
            ]
        }).sort("blockchain_timestamp", -1)
        inspected_docs = await cursor.to_list(length=None)

        events = []
        for doc in inspected_docs:
            if "_id" in doc:
                doc["id"] = str(doc["_id"])
                del doc["_id"]
            events.append(inspection_to_event(doc, "database_fallback"))
        events = apply_filters(events)
        return {
            "events": events,
            "total": len(events),
            "source": "database_fallback",
            "warning": result.get("error", "Fabric query failed; showing locally stored blockchain metadata")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching blockchain procurement events: {str(e)}"
        )

@app.get("/api/blockchain/events/{event_id}")
async def get_blockchain_procurement_event(
    event_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    await get_authenticated_user_context(credentials)
    blockchain_client = get_blockchain_client()
    result = blockchain_client.get_procurement_event(event_id)
    if not result.get("success"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result.get("error", "Event not found"))
    return result.get("data")

@app.get("/api/blockchain/events/{event_id}/verify")
async def verify_blockchain_procurement_event(
    event_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    await get_authenticated_user_context(credentials)
    blockchain_client = get_blockchain_client()
    result = blockchain_client.verify_procurement_event(event_id)
    if not result.get("success"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result.get("error", "Event not found"))
    return result.get("data")

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
