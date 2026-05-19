"""
Admin / system routes:
  /api/stats, /api/connections, /api/connection/ping,
  /api/audit-logs, /api/test, /api/test-purchase-requests
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from datetime import datetime, timezone
from typing import Optional
import socket
import time
import os

from database import get_database
from auth import decode_access_token
from Connection.Connector import register_client_ping, get_active_clients
from routers.deps import (
    security,
    get_authenticated_user_context,
    normalize_purchase_order_response,
    normalize_supplier_response,
)

router = APIRouter(tags=["admin"])


# ---------------------------------------------------------------------------
# Dashboard stats
# ---------------------------------------------------------------------------

@router.get("/api/stats")
async def get_dashboard_stats(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Return real dashboard summary data for the frontend."""
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid or expired token")

    def fmt(value):
        if not value:
            return datetime.now(timezone.utc).isoformat()
        return value.isoformat() if hasattr(value, "isoformat") else str(value)

    def get_supplier_name(pr: dict) -> str:
        selected_ids = pr.get("selected_supplier_ids") or []
        suppliers = pr.get("suppliers") or []
        if selected_ids and suppliers:
            sel = next((s for s in suppliers if s.get("supplier_id") in selected_ids), None)
            if sel:
                return sel.get("name") or sel.get("supplier_name") or "N/A"
        if suppliers:
            first = suppliers[0]
            return first.get("name") or first.get("supplier_name") or "N/A"
        return pr.get("entity_name") or pr.get("requested_by") or "N/A"

    try:
        db = await get_database()
        order_count = await db.purchase_orders.count_documents({})
        if order_count > 0:
            pending_orders = await db.purchase_orders.count_documents(
                {"status": {"$in": ["Draft", "Pending"]}})
            approved_orders = await db.purchase_orders.count_documents({"status": "Approved"})
        else:
            pending_orders = await db.purchase_requests.count_documents({"status": "Pending"})
            approved_orders = await db.purchase_requests.count_documents({"status": "Approved"})

        try:
            low_inventory = await db.inventory.count_documents({"quantity": {"$lte": 10}})
        except Exception:
            low_inventory = 0

        recent_orders = []
        if order_count > 0:
            po_docs = await db.purchase_orders.find({}).sort("date_created", -1).limit(5).to_list(5)
            for order in po_docs:
                n = normalize_purchase_order_response(order)
                recent_orders.append({
                    "id": n["id"], "po_number": n["po_number"],
                    "supplier": {"name": n["supplier"]["name"]},
                    "date_created": n["date_created"],
                    "status": n["status"], "total_amount": n["total_amount"],
                })
        else:
            pr_docs = await db.purchase_requests.find({}).sort("date_created", -1).limit(5).to_list(5)
            for idx, pr in enumerate(pr_docs, start=1):
                recent_orders.append({
                    "id": idx,
                    "po_number": pr.get("pr_number") or str(pr.get("_id")),
                    "supplier": {"name": get_supplier_name(pr)},
                    "date_created": fmt(pr.get("date_created") or pr.get("date")),
                    "status": pr.get("status") or "Pending",
                    "total_amount": pr.get("total_amount") or 0,
                })

        return {
            "pending_orders": pending_orders,
            "approved_orders": approved_orders,
            "low_inventory": low_inventory,
            "recent_orders": recent_orders,
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Dashboard stats error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"An error occurred while loading dashboard stats: {e}")


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------

@router.get("/api/audit-logs")
async def get_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    action: Optional[str] = Query(""),
    table_name: Optional[str] = Query(""),
    username: Optional[str] = Query(""),
    date_from: Optional[str] = Query(""),
    date_to: Optional[str] = Query(""),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    await get_authenticated_user_context(credentials)
    db = await get_database()
    query: dict = {}
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
    docs = await db.audit_logs.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    logs = [
        {
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
            "created_at": doc.get("created_at") or doc.get("timestamp"),
        }
        for doc in docs
    ]
    return {"logs": logs, "total": total, "page": page, "limit": limit}


# ---------------------------------------------------------------------------
# Connections / network status
# ---------------------------------------------------------------------------

def _tcp_check(host: str, port: int, timeout_seconds: float = 1.5) -> dict:
    start = time.time()
    try:
        with socket.create_connection((host, port), timeout=timeout_seconds):
            return {"ok": True, "latency_ms": int((time.time() - start) * 1000), "error": None}
    except Exception as e:
        return {"ok": False, "latency_ms": int((time.time() - start) * 1000), "error": str(e)}


@router.get("/api/connections")
async def get_connections_status(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Quick connectivity status for Fabric endpoints (TCP reachability only)."""
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid or expired token")

    checks = [
        {"name": "orderer",
         "host": os.getenv("FABRIC_ORDERER_HOST", "orderer.example.com"),
         "port": int(os.getenv("FABRIC_ORDERER_PORT", "7050"))},
        {"name": "peer0",
         "host": os.getenv("FABRIC_PEER0_HOST", "peer0.org1.example.com"),
         "port": int(os.getenv("FABRIC_PEER0_PORT", "7051"))},
        {"name": "peer1",
         "host": os.getenv("FABRIC_PEER1_HOST", "peer1.org1.example.com"),
         "port": int(os.getenv("FABRIC_PEER1_PORT", "8051"))},
    ]

    results = []
    for c in checks:
        r = _tcp_check(c["host"], c["port"])
        results.append({
            "name": c["name"], "host": c["host"], "port": c["port"],
            "connected": r["ok"], "latency_ms": r["latency_ms"], "error": r["error"],
        })

    return {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "targets": results,
        "clients": get_active_clients(),
    }


@router.post("/api/connection/ping")
async def connection_ping(request: Request):
    """Lightweight heartbeat used by the frontend to register active connections."""
    body = {}
    if request.headers.get("content-type", "").startswith("application/json"):
        body = await request.json()
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


# ---------------------------------------------------------------------------
# Test / diagnostic endpoints
# ---------------------------------------------------------------------------

@router.get("/api/test-purchase-requests")
async def test_purchase_requests_endpoint():
    """Test endpoint to verify MongoDB connection and purchase_requests collection."""
    try:
        db = await get_database()
        count = await db.purchase_requests.count_documents({})
        return {
            "message": "Purchase requests collection accessible",
            "collection": "purchase_requests",
            "document_count": count,
            "database": db.name,
        }
    except Exception as e:
        return {"error": str(e), "message": "Failed to access purchase_requests collection"}


@router.get("/api/test")
async def test_endpoint():
    return {"message": "API is working correctly"}
