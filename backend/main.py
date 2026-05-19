from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
import os
import sys

# ── Scraping module path ──────────────────────────────────────────────────────
scraping_path = os.path.join(os.path.dirname(__file__), "Scraping")
if scraping_path not in sys.path:
    sys.path.append(scraping_path)

# ── Local imports ─────────────────────────────────────────────────────────────
from database import connect_to_mongo, close_mongo_connection, get_database
from supplier_api import router as supplier_search_router

# ── Feature routers ───────────────────────────────────────────────────────────
from routers.auth import router as auth_router
from routers.documents import router as documents_router
from routers.inspections import router as inspections_router
from routers.blockchain import router as blockchain_router
from routers.admin import router as admin_router
from routers.users import router as users_router

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Blockchain Backend API",
    description="Backend API for the Blockchain Procurement Management System",
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Audit middleware ──────────────────────────────────────────────────────────
@app.middleware("http")
async def audit_workflow_status_changes(request: Request, call_next):
    response = await call_next(request)
    audit_entry = getattr(request.state, "workflow_status_change", None)
    if audit_entry and 200 <= response.status_code < 400:
        try:
            db = await get_database()
            now = datetime.now(timezone.utc).isoformat()
            await db.audit_logs.insert_one({
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
                "timestamp": now,
            })
        except Exception as audit_error:
            print(f"Audit log write failed: {audit_error}")
    return response

# ── Lifecycle events ──────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_event():
    await close_mongo_connection()

# ── Health / root ─────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"message": "Blockchain Backend API is running"}

@app.get("/health")
async def health_check():
    try:
        db = await get_database()
        await db.command("ping")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}

# ── Include routers ───────────────────────────────────────────────────────────
app.include_router(supplier_search_router)
app.include_router(auth_router)
app.include_router(documents_router)
app.include_router(inspections_router)
app.include_router(blockchain_router)
app.include_router(admin_router)
app.include_router(users_router)

# ── Dev entry point ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
