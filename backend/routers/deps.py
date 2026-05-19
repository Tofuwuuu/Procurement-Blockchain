"""
Shared dependencies, auth helpers, normalizers, and utilities used by all routers.
"""
from fastapi import HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone
from typing import List, Optional
import os

from database import get_database
from auth import decode_access_token, create_access_token
from workflow_config import ApprovalMatrix, ApprovalStage, PRStatus, WorkflowTransitions
from api.blockchain_client import get_blockchain_client

# ---------------------------------------------------------------------------
# Shared security dependency
# ---------------------------------------------------------------------------
security = HTTPBearer()


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

async def get_authenticated_user_context(credentials: HTTPAuthorizationCredentials) -> dict:
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
            role_doc = await db.roles.find_one(
                {"id": role_id} if isinstance(role_id, int) else {"_id": role_id}
            )
            if role_doc:
                role_name = role_doc.get("name", role_name)

    return {
        "payload": payload,
        "username": payload.get("sub") or "unknown",
        "user_id": user_id,
        "role": str(role_name or "employee").lower(),
        "user": user,
    }


def mark_status_change_audit(
    request,
    user_context: dict,
    entity: str,
    record_id: str,
    old_status: Optional[str],
    new_status: Optional[str],
):
    if new_status is None or old_status == new_status:
        return
    request.state.workflow_status_change = {
        "username": user_context.get("username", "unknown"),
        "user_id": user_context.get("user_id", 0),
        "action": "status_change",
        "entity": entity,
        "record_id": record_id,
        "old_status": old_status,
        "new_status": new_status,
    }


# ---------------------------------------------------------------------------
# Role guards
# ---------------------------------------------------------------------------

def role_allowed(user_context: dict, allowed_roles: List[str]) -> bool:
    role = str(user_context.get("role", "")).lower()
    return role in [r.lower() for r in allowed_roles]


def require_role(user_context: dict, allowed_roles: List[str], action: str):
    if not role_allowed(user_context, allowed_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{action} requires one of these roles: {', '.join(allowed_roles)}",
        )


def require_department_head_approval(user_context: dict):
    allowed = list({
        *WorkflowTransitions.CAN_REJECT,
        "department_head", "department head", "head", "supervisor",
    })
    require_role(user_context, allowed, "Purchase request approval")


def require_management_approval(user_context: dict):
    require_role(user_context, ["admin", "management", "manager", "validator"], "Purchase order approval")


def require_finance_approval(user_context: dict):
    require_role(user_context, ["admin", "finance"], "Payment approval")


# ---------------------------------------------------------------------------
# Workflow transition
# ---------------------------------------------------------------------------

def apply_pr_transition(pr: dict, requested_status: str, user_context: dict) -> dict:
    current_status = pr.get("status") or PRStatus.DRAFT.value
    target_status = requested_status
    normalized_current = current_status.lower()
    normalized_target = target_status.lower()
    update_doc = {
        "status": target_status,
        "workflow_action": normalized_target,
        "workflow_updated_by": user_context.get("username"),
    }

    if normalized_target == "submitted":
        if normalized_current not in {"draft", "returned"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Only Draft or Returned PRs can be submitted")
        if not WorkflowTransitions.can_user_submit(user_context.get("role", "")):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="You are not allowed to submit purchase requests")
        required_stages = [
            stage.value for stage in
            ApprovalMatrix.get_required_stages(pr.get("total_amount", 0), pr.get("office_section"))
        ]
        update_doc.update({
            "approval_required_stages": required_stages,
            "approval_current_stage": ApprovalStage.SUPERVISOR.value if required_stages else None,
            "approval_history": pr.get("approval_history", []) + [{
                "action": "Submitted",
                "by": user_context.get("username"),
                "at": datetime.now(timezone.utc).isoformat(),
            }],
        })
        return update_doc

    if normalized_target == "approved":
        if normalized_current not in {"submitted", "under review"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Only Submitted or Under Review PRs can be approved")
        require_department_head_approval(user_context)
        current_stage = pr.get("approval_current_stage") or ApprovalStage.SUPERVISOR.value
        allowed_dept_roles = {"department_head", "department head", "head", "supervisor", "admin"}
        if not WorkflowTransitions.can_user_approve_at_stage(user_context.get("role", ""), ApprovalStage.SUPERVISOR):
            if user_context.get("role", "") not in allowed_dept_roles:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                    detail="Current approval stage requires department head approval")
        update_doc.update({
            "approval_current_stage": None,
            "approval_completed_at": datetime.now(timezone.utc).isoformat(),
            "approval_history": pr.get("approval_history", []) + [{
                "action": "Approved",
                "stage": current_stage,
                "by": user_context.get("username"),
                "at": datetime.now(timezone.utc).isoformat(),
            }],
        })
        return update_doc

    if normalized_target == "rejected":
        if normalized_current not in {"submitted", "under review", "approved"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Only submitted, under review, or approved PRs can be rejected")
        if not WorkflowTransitions.can_user_reject(user_context.get("role", "")):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="You are not allowed to reject purchase requests")
        update_doc["approval_history"] = pr.get("approval_history", []) + [{
            "action": "Rejected",
            "by": user_context.get("username"),
            "at": datetime.now(timezone.utc).isoformat(),
        }]
        return update_doc

    if normalized_target == "returned":
        if normalized_current not in {"submitted", "under review", "rejected"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Only submitted, under review, or rejected PRs can be returned")
        if not WorkflowTransitions.can_user_reject(user_context.get("role", "")):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="You are not allowed to return purchase requests")
        update_doc["approval_history"] = pr.get("approval_history", []) + [{
            "action": "Returned",
            "by": user_context.get("username"),
            "at": datetime.now(timezone.utc).isoformat(),
        }]
        return update_doc

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid PR transition. Allowed transitions are Draft -> Submitted -> Approved, "
               "plus Rejected or Returned from review states.",
    )


# ---------------------------------------------------------------------------
# Sequential ID / number generators
# ---------------------------------------------------------------------------

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


async def generate_pr_number() -> str:
    db = await get_database()
    year = datetime.now().year
    try:
        counter = await db.counters.find_one_and_update(
            {"_id": f"pr_{year}"},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=True,
        )
        seq = counter.get("seq", 1)
        return f"PR-{year}-{str(seq).zfill(3)}"
    except Exception as e:
        print(f"Error generating PR number: {e}")
        timestamp = int(datetime.now().timestamp())
        return f"PR-{year}-{str(timestamp % 1000).zfill(3)}"


async def generate_cc_reference_number() -> str:
    db = await get_database()
    now = datetime.now()
    year = now.year
    mmdd = now.strftime("%m%d")
    base = f"CC{year}-{mmdd}"
    key = f"cc_{year}_{mmdd}"
    try:
        counter = await db.counters.find_one_and_update(
            {"_id": key},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=True,
        )
        seq = int(counter.get("seq", 1))
        return base if seq <= 1 else f"{base}-{str(seq).zfill(3)}"
    except Exception as e:
        print(f"Error generating CC reference number: {e}")
        return base


# ---------------------------------------------------------------------------
# Response normalizers
# ---------------------------------------------------------------------------

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
        "updated_at": supplier.get("updated_at") or supplier.get("created_at") or now,
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
                "is_active": product.get("is_active", True),
            },
            "quantity": quantity,
            "unit_price": unit_price,
            "total_price": item.get("total_price") if item.get("total_price") is not None
                           else quantity * unit_price,
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
        "total_amount": order.get("total_amount") or sum(i["total_price"] for i in items),
        "date_created": order.get("date_created") or now,
        "date_updated": order.get("date_updated") or order.get("date_created") or now,
        "items": items,
    }


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
        "date_updated": doc.get("date_updated"),
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
        "date_updated": doc.get("date_updated") or doc.get("date_created") or now,
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
        "date_updated": doc.get("date_updated") or doc.get("date_created") or now,
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
        "date_updated": doc.get("date_updated") or doc.get("date_created") or now,
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
        "date_updated": doc.get("date_updated") or doc.get("date_created") or now,
    }


# ---------------------------------------------------------------------------
# Canvass / abstract helpers
# ---------------------------------------------------------------------------

def select_canvass_supplier(pr: dict, selected_supplier_id: Optional[str] = None) -> Optional[dict]:
    suppliers = pr.get("suppliers") or []
    selected_ids = pr.get("selected_supplier_ids") or []
    target_id = selected_supplier_id or (selected_ids[0] if selected_ids else None)
    if target_id:
        selected = next(
            (s for s in suppliers if str(s.get("supplier_id")) == str(target_id)), None
        )
        if selected:
            return selected
    return suppliers[0] if suppliers else None


async def upsert_abstract_of_canvass(
    db,
    pr: dict,
    selected_supplier_id: Optional[str],
    username: str,
    remarks: str = "",
) -> Optional[dict]:
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
        "date_updated": now,
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
            "date_updated": now,
        }},
    )
    return abstract_doc


# ---------------------------------------------------------------------------
# Blockchain event helpers
# ---------------------------------------------------------------------------

def make_blockchain_event_id(prefix: str, entity_id: str) -> str:
    safe_entity = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in str(entity_id))
    return f"{prefix}-{safe_entity}"


async def record_procurement_event_on_chain(
    event_type: str,
    entity_id: str,
    actor: str,
    status_value: str,
    payload: dict,
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
            payload=payload,
        )
    except Exception as blockchain_error:
        return {
            "success": False,
            "event_id": event_id,
            "error": str(blockchain_error),
            "message": "Blockchain recording failed",
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
