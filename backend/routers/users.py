"""
User management routes.

No /api/users or /api/roles endpoints exist yet; this module is a placeholder
for future user-admin functionality (create/update/delete users, role management).
"""
from fastapi import APIRouter

router = APIRouter(prefix="/api/users", tags=["users"])
