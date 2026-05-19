"""
Procurement document routes:
  purchase-requests, suppliers, orders, deliveries, invoices, payments,
  disbursement-vouchers
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from bson import ObjectId
from datetime import datetime, timezone
from typing import List, Optional
import traceback

from database import get_database
from auth import decode_access_token
from models import (
    CreatePurchaseRequest, PurchaseRequestResponse, UpdatePurchaseRequest,
    SupplierCreate, SupplierResponse, CreateAbstractOfCanvass, AbstractOfCanvassResponse,
    CreatePurchaseOrder, UpdatePurchaseOrder, PurchaseOrderResponse,
    CreateDeliveryReceipt, UpdateDeliveryReceipt, DeliveryReceiptResponse,
    CreateInvoice, UpdateInvoice, InvoiceResponse,
    CreatePayment, UpdatePayment, PaymentResponse, DisbursementVoucherResponse,
)
from workflow_config import PRStatus, ApprovalMatrix

from routers.deps import (
    security,
    get_authenticated_user_context,
    mark_status_change_audit,
    require_management_approval,
    require_finance_approval,
    apply_pr_transition,
    generate_sequential_number,
    get_next_numeric_id,
    generate_pr_number,
    generate_cc_reference_number,
    normalize_supplier_response,
    normalize_purchase_order_response,
    normalize_abstract_response,
    normalize_delivery_response,
    normalize_invoice_response,
    normalize_payment_response,
    normalize_voucher_response,
    select_canvass_supplier,
    upsert_abstract_of_canvass,
    record_procurement_event_on_chain,
    update_blockchain_event_metadata,
)

router = APIRouter(tags=["documents"])


# ---------------------------------------------------------------------------
# Purchase Requests
# ---------------------------------------------------------------------------

@router.post("/api/purchase-requests", response_model=PurchaseRequestResponse)
async def create_purchase_request(
    request: CreatePurchaseRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Create a new purchase request."""
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        if payload is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid or expired token")

        db = await get_database()
        user = await db.users.find_one({"username": payload.get("sub")})
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        user_id = str(user.get("_id")) if user.get("_id") else str(user.get("id", ""))
        requested_by = user.get("full_name") or user.get("username") or request.entity_name
        pr_number = await generate_pr_number()
        total_amount = sum(item.total_cost for item in request.items)

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
            "approval_required_stages": [
                stage.value for stage in
                ApprovalMatrix.get_required_stages(total_amount, request.office_section)
            ],
            "approval_current_stage": None,
            "approval_history": [],
            "date_created": datetime.now(timezone.utc).isoformat(),
            "date_updated": None,
        }

        print(f"💾 Saving purchase request to MongoDB: {pr_doc}")
        result = await db.purchase_requests.insert_one(pr_doc)
        if result.inserted_id:
            pr_doc["id"] = str(result.inserted_id)
            print(f"✅ Purchase request saved: {result.inserted_id}")
            return PurchaseRequestResponse(**pr_doc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Failed to create purchase request")
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Create purchase request error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"An error occurred: {e}")


@router.get("/api/purchase-requests", response_model=List[PurchaseRequestResponse])
async def get_purchase_requests(
    user_only: bool = Query(False),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Get all purchase requests, optionally filtered by current user."""
    try:
        print(f"📥 GET /api/purchase-requests called with user_only={user_only}")
        token = credentials.credentials
        payload = decode_access_token(token)
        if payload is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid or expired token")

        db = await get_database()
        query = {}
        if user_only:
            user = await db.users.find_one({"username": payload.get("sub")})
            if user:
                user_id = str(user.get("_id")) if user.get("_id") else str(user.get("id", ""))
                query["requested_by_id"] = user_id

        cursor = db.purchase_requests.find(query).sort("date_created", -1)
        requests_docs = await cursor.to_list(length=None)
        result = []
        for req in requests_docs:
            req["id"] = str(req["_id"])
            result.append(PurchaseRequestResponse(**req))
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Get purchase requests error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"An error occurred: {e}")


@router.get("/api/purchase-requests/{pr_id}", response_model=PurchaseRequestResponse)
async def get_purchase_request(
    pr_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Get a specific purchase request by ID."""
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        if payload is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid or expired token")

        db = await get_database()
        try:
            pr = await db.purchase_requests.find_one({"_id": ObjectId(pr_id)})
        except Exception:
            pr = await db.purchase_requests.find_one({"pr_number": pr_id})

        if not pr:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Purchase request not found")
        pr["id"] = str(pr["_id"])
        return PurchaseRequestResponse(**pr)
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Get purchase request error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"An error occurred: {e}")


@router.put("/api/purchase-requests/{pr_id}", response_model=PurchaseRequestResponse)
async def update_purchase_request(
    pr_id: str,
    update_data: UpdatePurchaseRequest,
    http_request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Update a purchase request (e.g., change status)."""
    try:
        user_context = await get_authenticated_user_context(credentials)

        db = await get_database()
        try:
            pr = await db.purchase_requests.find_one({"_id": ObjectId(pr_id)})
            pr_filter = {"_id": ObjectId(pr_id)}
        except Exception:
            pr = await db.purchase_requests.find_one({"pr_number": pr_id})
            pr_filter = {"pr_number": pr_id}

        if not pr:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Purchase request not found")

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
            update_doc["total_amount"] = sum(item.total_cost for item in update_data.items)
        if getattr(update_data, "suppliers", None) is not None:
            update_doc["suppliers"] = [s.dict() for s in update_data.suppliers] if update_data.suppliers else []
        if getattr(update_data, "selected_supplier_ids", None) is not None:
            update_doc["selected_supplier_ids"] = update_data.selected_supplier_ids or []
        if getattr(update_data, "canvass_submitted_at", None) is not None:
            update_doc["canvass_submitted_at"] = update_data.canvass_submitted_at

        new_status = update_doc.get("status")
        if new_status and str(new_status).lower() == "approved":
            if not pr.get("ref_number") and "ref_number" not in update_doc:
                update_doc["ref_number"] = await generate_cc_reference_number()

        if new_status and str(new_status).lower() == "completed":
            supplier_name = pr.get("entity_name", "N/A")
            supplier_id = None
            supplier_address = supplier_contact = supplier_phone = supplier_bir_tin = ""

            if pr.get("suppliers") and pr.get("selected_supplier_ids"):
                selected = next(
                    (s for s in pr.get("suppliers", [])
                     if s.get("supplier_id") in pr.get("selected_supplier_ids", [])),
                    None,
                )
                if selected:
                    supplier_name = selected.get("name", supplier_name)
                    supplier_id = selected.get("supplier_id")
                    supplier_address = selected.get("address", "")
                    supplier_contact = selected.get("contact_person", "")
                    supplier_phone = selected.get("phone", "")

            existing = await db.pending_inspections.find_one({"po_number": pr.get("pr_number")})
            if not existing:
                await db.pending_inspections.insert_one({
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
                    "confirmed_at": datetime.now(timezone.utc).isoformat(),
                })
                print(f"✅ Saved confirmed PR {pr.get('pr_number')} to pending_inspections")

            await upsert_abstract_of_canvass(
                db,
                {**pr, **update_doc},
                (update_doc.get("selected_supplier_ids") or pr.get("selected_supplier_ids") or [None])[0],
                user_context.get("username", "unknown"),
            )

        update_doc["date_updated"] = datetime.now(timezone.utc).isoformat()
        result = await db.purchase_requests.update_one(pr_filter, {"$set": update_doc})
        if result.matched_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Purchase request not found")

        updated_pr = await db.purchase_requests.find_one(pr_filter)
        if not updated_pr:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Failed to retrieve updated purchase request")

        updated_pr["id"] = str(updated_pr["_id"])
        for field, default in [
            ("pr_number", pr.get("pr_number", "")),
            ("entity_name", pr.get("entity_name", "")),
            ("office_section", pr.get("office_section", "")),
            ("date", pr.get("date", "")),
            ("status", pr.get("status", "Pending")),
            ("requested_by", pr.get("requested_by", "")),
            ("total_amount", pr.get("total_amount", 0)),
            ("date_created", pr.get("date_created", datetime.now(timezone.utc).isoformat())),
        ]:
            if field not in updated_pr:
                updated_pr[field] = default

        if not isinstance(updated_pr.get("items"), list):
            updated_pr["items"] = pr.get("items", [])
        if not updated_pr.get("items"):
            updated_pr["items"] = pr.get("items", [])

        for field, default in [
            ("ref_number", None), ("fund_cluster", ""), ("responsibility_center_code", ""),
            ("remark", ""), ("requested_by_id", None),
            ("date_updated", datetime.now(timezone.utc).isoformat()),
            ("suppliers", None), ("selected_supplier_ids", None), ("canvass_submitted_at", None),
        ]:
            updated_pr.setdefault(field, default)

        try:
            return PurchaseRequestResponse(**updated_pr)
        except Exception as ve:
            print(f"❌ Validation error: {ve}")
            if hasattr(ve, "errors"):
                print(f"Errors: {ve.errors()}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail=f"Validation error: {ve}")
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"❌ Update purchase request error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"An error occurred: {e}")


# ---------------------------------------------------------------------------
# Suppliers
# ---------------------------------------------------------------------------

@router.get("/api/suppliers", response_model=List[SupplierResponse])
async def get_suppliers(credentials: HTTPAuthorizationCredentials = Depends(security)):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    suppliers = await db.suppliers.find({}).sort("name", 1).to_list(length=None)
    return [SupplierResponse(**normalize_supplier_response(s)) for s in suppliers]


@router.post("/api/suppliers/award", response_model=AbstractOfCanvassResponse)
async def award_supplier_from_canvass(
    award: CreateAbstractOfCanvass,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    user_context = await get_authenticated_user_context(credentials)
    db = await get_database()

    query: dict = {}
    if award.pr_id:
        try:
            query = {"_id": ObjectId(award.pr_id)}
        except Exception:
            query = {"pr_number": award.pr_id}
    elif award.pr_number:
        query = {"pr_number": award.pr_number}
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="pr_id or pr_number is required")

    pr = await db.purchase_requests.find_one(query)
    if not pr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase request not found")

    abstract_doc = await upsert_abstract_of_canvass(
        db, pr, award.selected_supplier_id,
        user_context.get("username", "unknown"), award.remarks or "",
    )
    if not abstract_doc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Selected supplier was not found on this canvass")
    return AbstractOfCanvassResponse(**normalize_abstract_response(abstract_doc))


@router.get("/api/suppliers/{supplier_id}", response_model=SupplierResponse)
async def get_supplier(supplier_id: int, credentials: HTTPAuthorizationCredentials = Depends(security)):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    supplier = await db.suppliers.find_one({"id": supplier_id})
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    return SupplierResponse(**normalize_supplier_response(supplier))


@router.post("/api/suppliers", response_model=SupplierResponse)
async def create_supplier(
    supplier_data: SupplierCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    now = datetime.now(timezone.utc).isoformat()
    doc = supplier_data.dict()
    doc["id"] = await get_next_numeric_id(db.suppliers)
    doc["created_at"] = now
    doc["updated_at"] = now
    await db.suppliers.insert_one(doc)
    return SupplierResponse(**normalize_supplier_response(doc))


@router.put("/api/suppliers/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: int,
    supplier_data: SupplierCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    update_doc = supplier_data.dict()
    update_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.suppliers.update_one({"id": supplier_id}, {"$set": update_doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    supplier = await db.suppliers.find_one({"id": supplier_id})
    return SupplierResponse(**normalize_supplier_response(supplier))


@router.delete("/api/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: int, credentials: HTTPAuthorizationCredentials = Depends(security)):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    result = await db.suppliers.delete_one({"id": supplier_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    return {"message": "Supplier deleted successfully"}


# ---------------------------------------------------------------------------
# Purchase Orders
# ---------------------------------------------------------------------------

@router.post("/api/orders", response_model=PurchaseOrderResponse)
async def create_order(
    order_data: CreatePurchaseOrder,
    http_request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    user_context = await get_authenticated_user_context(credentials)
    db = await get_database()
    now = datetime.now(timezone.utc).isoformat()
    order_id = await get_next_numeric_id(db.purchase_orders)
    po_number = await generate_sequential_number(db.purchase_orders, "po_number", "PO")

    pr = None
    supplier = None
    items: list = []
    if order_data.pr_id or order_data.pr_number:
        if order_data.pr_id:
            try:
                pr = await db.purchase_requests.find_one({"_id": ObjectId(order_data.pr_id)})
            except Exception:
                pr = await db.purchase_requests.find_one({"pr_number": order_data.pr_id})
        if not pr and order_data.pr_number:
            pr = await db.purchase_requests.find_one({"pr_number": order_data.pr_number})
        if not pr:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Approved purchase request not found")
        if str(pr.get("status", "")).lower() not in {"approved", "completed"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Purchase request must be approved before creating a purchase order")
        selected_supplier = select_canvass_supplier(pr)
        supplier = normalize_supplier_response(selected_supplier or {"name": pr.get("entity_name", "N/A")})
        for index, item in enumerate(pr.get("items") or [], start=1):
            quantity = item.get("quantity") or 0
            unit_price = item.get("unit_cost") or 0
            items.append({
                "id": index, "product_id": index,
                "product": {
                    "id": index,
                    "name": item.get("item_description") or "Unknown Item",
                    "description": item.get("item_description") or "",
                    "unit": item.get("unit") or "pcs",
                    "unit_price": unit_price, "category": "", "is_active": True,
                },
                "quantity": quantity, "unit_price": unit_price,
                "total_price": item.get("total_cost") if item.get("total_cost") is not None
                               else quantity * unit_price,
            })
    else:
        if not order_data.supplier_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="supplier_id is required when creating a purchase order manually")
        supplier_doc = await db.suppliers.find_one({"id": order_data.supplier_id})
        if not supplier_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
        supplier = normalize_supplier_response(supplier_doc)
        for index, item in enumerate(order_data.items or [], start=1):
            quantity = item.quantity
            unit_price = item.unit_price
            product = item.product.dict() if item.product else {}
            items.append({
                "id": index, "product_id": item.product_id or index,
                "product": {
                    "id": item.product_id or index,
                    "name": product.get("name") or f"Product {item.product_id or index}",
                    "description": product.get("description") or "",
                    "unit": product.get("unit") or "pcs",
                    "unit_price": unit_price,
                    "category": product.get("category") or "",
                    "is_active": product.get("is_active", True),
                },
                "quantity": quantity, "unit_price": unit_price,
                "total_price": item.total_price if item.total_price is not None else quantity * unit_price,
            })

    total_amount = sum(i["total_price"] for i in items)
    order_doc = {
        "id": order_id, "po_number": po_number,
        "pr_number": pr.get("pr_number") if pr else None,
        "supplier_id": supplier["id"], "supplier": supplier,
        "delivery_address": order_data.delivery_address or (pr.get("office_section", "") if pr else ""),
        "notes": order_data.notes or (pr.get("remark", "") if pr else ""),
        "status": "Draft", "total_amount": total_amount, "items": items,
        "created_by": user_context.get("username"),
        "date_created": now, "date_updated": now,
    }
    await db.purchase_orders.insert_one(order_doc)
    mark_status_change_audit(http_request, user_context, "purchase_orders", po_number, None, "Draft")
    event_result = await record_procurement_event_on_chain(
        "PURCHASE_ORDER_ISSUED", po_number, user_context.get("username", "unknown"),
        order_doc.get("status"),
        {"po_number": po_number, "pr_number": order_doc.get("pr_number"),
         "supplier": order_doc.get("supplier"), "total_amount": order_doc.get("total_amount"),
         "items": order_doc.get("items", [])},
    )
    await update_blockchain_event_metadata(db.purchase_orders, {"id": order_id}, event_result)
    if event_result.get("success"):
        order_doc.update({
            "blockchain_event_id": event_result.get("event_id"),
            "blockchain_event_tx_id": event_result.get("tx_id"),
            "blockchain_event_timestamp": event_result.get("timestamp"),
            "blockchain_event_recorded": True,
        })
    return PurchaseOrderResponse(**normalize_purchase_order_response(order_doc))


@router.get("/api/orders", response_model=List[PurchaseOrderResponse])
async def get_orders(credentials: HTTPAuthorizationCredentials = Depends(security)):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    orders = await db.purchase_orders.find({}).sort("date_created", -1).to_list(length=None)
    return [PurchaseOrderResponse(**normalize_purchase_order_response(o)) for o in orders]


@router.get("/api/orders/{order_id}", response_model=PurchaseOrderResponse)
async def get_order(order_id: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    query: dict = {"po_number": order_id}
    try:
        query = {"id": int(order_id)}
    except Exception:
        pass
    order = await db.purchase_orders.find_one(query)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    return PurchaseOrderResponse(**normalize_purchase_order_response(order))


@router.put("/api/orders/{order_id}", response_model=PurchaseOrderResponse)
async def update_order(
    order_id: str,
    order_data: UpdatePurchaseOrder,
    http_request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    user_context = await get_authenticated_user_context(credentials)
    db = await get_database()
    query: dict = {"po_number": order_id}
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
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Only draft, pending, or submitted purchase orders can be approved")
    if order_data.items is not None:
        update_doc["items"] = [item.dict() for item in order_data.items]
        update_doc["total_amount"] = sum(
            (item.total_price if item.total_price is not None else item.quantity * item.unit_price)
            for item in order_data.items
        )
    update_doc["date_updated"] = datetime.now(timezone.utc).isoformat()
    await db.purchase_orders.update_one(query, {"$set": update_doc})
    updated = await db.purchase_orders.find_one(query)
    mark_status_change_audit(http_request, user_context, "purchase_orders",
                             updated.get("po_number"), order.get("status"), updated.get("status"))
    return PurchaseOrderResponse(**normalize_purchase_order_response(updated))


@router.post("/api/orders/{order_id}/approve", response_model=PurchaseOrderResponse)
async def approve_order(
    order_id: str,
    http_request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    return await update_order(order_id, UpdatePurchaseOrder(status="Approved"), http_request, credentials)


# ---------------------------------------------------------------------------
# Deliveries
# ---------------------------------------------------------------------------

@router.post("/api/deliveries", response_model=DeliveryReceiptResponse)
async def create_delivery_receipt(
    delivery: CreateDeliveryReceipt,
    http_request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    user_context = await get_authenticated_user_context(credentials)
    db = await get_database()
    po = await db.purchase_orders.find_one({"po_number": delivery.po_number})
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    if str(po.get("status", "")).lower() not in {"approved", "completed"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Only approved purchase orders can receive deliveries")
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
        "date_created": now, "date_updated": now,
    }
    await db.delivery_receipts.insert_one(doc)
    mark_status_change_audit(http_request, user_context, "delivery_receipts",
                             doc["receipt_number"], None, doc["status"])
    return DeliveryReceiptResponse(**normalize_delivery_response(doc))


@router.get("/api/deliveries", response_model=List[DeliveryReceiptResponse])
async def get_delivery_receipts(credentials: HTTPAuthorizationCredentials = Depends(security)):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    docs = await db.delivery_receipts.find({}).sort("date_created", -1).to_list(length=None)
    return [DeliveryReceiptResponse(**normalize_delivery_response(d)) for d in docs]


@router.get("/api/deliveries/{receipt_id}", response_model=DeliveryReceiptResponse)
async def get_delivery_receipt(
    receipt_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    query: dict = {"receipt_number": receipt_id}
    try:
        query = {"id": int(receipt_id)}
    except Exception:
        pass
    doc = await db.delivery_receipts.find_one(query)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery receipt not found")
    return DeliveryReceiptResponse(**normalize_delivery_response(doc))


@router.put("/api/deliveries/{receipt_id}", response_model=DeliveryReceiptResponse)
async def update_delivery_receipt(
    receipt_id: str,
    delivery_update: UpdateDeliveryReceipt,
    http_request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    user_context = await get_authenticated_user_context(credentials)
    db = await get_database()
    query: dict = {"receipt_number": receipt_id}
    try:
        query = {"id": int(receipt_id)}
    except Exception:
        pass
    doc = await db.delivery_receipts.find_one(query)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery receipt not found")

    update_doc = {k: v for k, v in delivery_update.dict(exclude_unset=True).items() if v is not None}
    if "status" in update_doc and update_doc["status"] not in {"Accepted", "Rejected", "Pending Acceptance"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Delivery status must be Accepted, Rejected, or Pending Acceptance")
    update_doc["date_updated"] = datetime.now(timezone.utc).isoformat()
    await db.delivery_receipts.update_one(query, {"$set": update_doc})
    updated = await db.delivery_receipts.find_one(query)
    mark_status_change_audit(http_request, user_context, "delivery_receipts",
                             updated.get("receipt_number"), doc.get("status"), updated.get("status"))
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
                "remarks": updated.get("remarks", ""),
            },
        )
        await update_blockchain_event_metadata(db.delivery_receipts, query, event_result)
        updated = await db.delivery_receipts.find_one(query)
    return DeliveryReceiptResponse(**normalize_delivery_response(updated))


# ---------------------------------------------------------------------------
# Invoices
# ---------------------------------------------------------------------------

@router.post("/api/invoices", response_model=InvoiceResponse)
async def create_invoice(
    invoice: CreateInvoice,
    http_request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    user_context = await get_authenticated_user_context(credentials)
    db = await get_database()
    po = await db.purchase_orders.find_one({"po_number": invoice.po_number})
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    accepted = await db.delivery_receipts.find_one({"po_number": invoice.po_number, "status": "Accepted"})
    if not accepted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Invoice requires an accepted delivery receipt")
    if await db.invoices.find_one({"invoice_number": invoice.invoice_number}):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Invoice number already exists")
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
        "date_created": now, "date_updated": now,
    }
    await db.invoices.insert_one(doc)
    mark_status_change_audit(http_request, user_context, "invoices",
                             doc["invoice_number"], None, doc["status"])
    return InvoiceResponse(**normalize_invoice_response(doc))


@router.get("/api/invoices", response_model=List[InvoiceResponse])
async def get_invoices(credentials: HTTPAuthorizationCredentials = Depends(security)):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    docs = await db.invoices.find({}).sort("date_created", -1).to_list(length=None)
    return [InvoiceResponse(**normalize_invoice_response(d)) for d in docs]


@router.get("/api/invoices/{invoice_number}", response_model=InvoiceResponse)
async def get_invoice(invoice_number: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    doc = await db.invoices.find_one({"invoice_number": invoice_number})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    return InvoiceResponse(**normalize_invoice_response(doc))


@router.put("/api/invoices/{invoice_number}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_number: str,
    invoice_update: UpdateInvoice,
    http_request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    user_context = await get_authenticated_user_context(credentials)
    db = await get_database()
    doc = await db.invoices.find_one({"invoice_number": invoice_number})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    update_doc = {k: v for k, v in invoice_update.dict(exclude_unset=True).items() if v is not None}
    if update_doc.get("status") not in {None, "Submitted", "Verified", "Rejected"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Invoice status must be Submitted, Verified, or Rejected")
    update_doc["date_updated"] = datetime.now(timezone.utc).isoformat()
    await db.invoices.update_one({"invoice_number": invoice_number}, {"$set": update_doc})
    updated = await db.invoices.find_one({"invoice_number": invoice_number})
    mark_status_change_audit(http_request, user_context, "invoices",
                             invoice_number, doc.get("status"), updated.get("status"))
    return InvoiceResponse(**normalize_invoice_response(updated))


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------

@router.post("/api/payments", response_model=PaymentResponse)
async def create_payment(
    payment: CreatePayment,
    http_request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    user_context = await get_authenticated_user_context(credentials)
    db = await get_database()
    invoice = await db.invoices.find_one({"invoice_number": payment.invoice_number})
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    if str(invoice.get("status", "")).lower() not in {"submitted", "verified"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Only submitted or verified invoices can be queued for payment")
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
        "date_created": now, "date_updated": now,
    }
    await db.payments.insert_one(doc)
    mark_status_change_audit(http_request, user_context, "payments",
                             doc["payment_number"], None, doc["status"])
    return PaymentResponse(**normalize_payment_response(doc))


@router.get("/api/payments", response_model=List[PaymentResponse])
async def get_payments(credentials: HTTPAuthorizationCredentials = Depends(security)):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    docs = await db.payments.find({}).sort("date_created", -1).to_list(length=None)
    return [PaymentResponse(**normalize_payment_response(d)) for d in docs]


@router.put("/api/payments/{payment_number}", response_model=PaymentResponse)
async def update_payment(
    payment_number: str,
    payment_update: UpdatePayment,
    http_request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
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
    mark_status_change_audit(http_request, user_context, "payments",
                             payment_number, doc.get("status"), updated.get("status"))
    if updated.get("status") == "Approved":
        if not await db.disbursement_vouchers.find_one({"payment_number": payment_number}):
            now = datetime.now(timezone.utc).isoformat()
            voucher = {
                "id": await get_next_numeric_id(db.disbursement_vouchers),
                "voucher_number": await generate_sequential_number(
                    db.disbursement_vouchers, "voucher_number", "DV"),
                "payment_number": payment_number,
                "invoice_number": updated.get("invoice_number"),
                "po_number": updated.get("po_number"),
                "amount": updated.get("amount", 0),
                "status": "Prepared",
                "prepared_by": user_context.get("username"),
                "approved_by": user_context.get("username"),
                "date_created": now, "date_updated": now,
            }
            await db.disbursement_vouchers.insert_one(voucher)
    if doc.get("status") != updated.get("status") and updated.get("status") == "Paid":
        event_result = await record_procurement_event_on_chain(
            "PAYMENT_COMPLETED", payment_number, user_context.get("username", "unknown"),
            updated.get("status"),
            {"payment_number": payment_number,
             "invoice_number": updated.get("invoice_number"),
             "po_number": updated.get("po_number"),
             "amount": updated.get("amount"),
             "payment_method": updated.get("payment_method"),
             "approved_by": updated.get("approved_by")},
        )
        await update_blockchain_event_metadata(
            db.payments, {"payment_number": payment_number}, event_result
        )
        updated = await db.payments.find_one({"payment_number": payment_number})
    return PaymentResponse(**normalize_payment_response(updated))


@router.post("/api/payments/{payment_number}/approve", response_model=PaymentResponse)
async def approve_payment(
    payment_number: str,
    http_request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    return await update_payment(payment_number, UpdatePayment(status="Approved"), http_request, credentials)


# ---------------------------------------------------------------------------
# Disbursement Vouchers
# ---------------------------------------------------------------------------

@router.get("/api/disbursement-vouchers", response_model=List[DisbursementVoucherResponse])
async def get_disbursement_vouchers(credentials: HTTPAuthorizationCredentials = Depends(security)):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    docs = await db.disbursement_vouchers.find({}).sort("date_created", -1).to_list(length=None)
    return [DisbursementVoucherResponse(**normalize_voucher_response(d)) for d in docs]
