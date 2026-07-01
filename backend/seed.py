"""Seed default development data when collections are empty."""

from datetime import datetime, timezone

from auth import get_password_hash


async def seed_default_users(db) -> None:
    if await db.users.count_documents({}) > 0:
        return

    now = datetime.now(timezone.utc)
    await db.users.insert_one({
        "id": 1,
        "username": "admin",
        "email": "admin@example.com",
        "password_hash": get_password_hash("admin123"),
        "full_name": "System Administrator",
        "position": "Administrator",
        "department": "IT",
        "role": "admin",
        "is_admin": True,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    })
    print("Seeded default admin user (admin / admin123)")


async def seed_demo_data(db) -> None:
    if await db.purchase_orders.count_documents({}) > 0:
        return
    if await db.purchase_requests.count_documents({}) > 0:
        return

    now = datetime.now(timezone.utc).isoformat()
    suppliers = [
        {
            "id": 1,
            "name": "TechDistributors Inc",
            "address": "123 Tech Street, Makati City",
            "province": "Metro Manila",
            "contact_person": "Juan Dela Cruz",
            "phone": "+63 2 1234 5678",
            "email": "contact@techdistributors.com",
            "bir_tin": "123-456-789-000",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
    ]
    await db.suppliers.insert_many(suppliers)
    await db.purchase_orders.insert_one({
        "id": 1,
        "po_number": "PO-20250629-001",
        "supplier_id": 1,
        "supplier": suppliers[0],
        "status": "Pending",
        "total_amount": 60000.0,
        "items": [],
        "created_by": "admin",
        "date_created": now,
        "date_updated": now,
    })
    print("Seeded demo suppliers and purchase orders")
