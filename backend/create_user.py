"""Create a user in MongoDB from the command line."""

import argparse
import asyncio
from datetime import datetime, timezone

from auth import get_password_hash
from database import connect_to_mongo, close_mongo_connection, get_database


async def create_user(
    username: str,
    password: str,
    email: str,
    role: str,
    full_name: str,
) -> None:
    await connect_to_mongo()
    db = await get_database()

    existing = await db.users.find_one({"username": username})
    if existing:
        raise SystemExit(f"User '{username}' already exists")

    latest = await db.users.find_one(sort=[("id", -1)])
    next_id = (latest.get("id", 0) if latest else 0) + 1
    now = datetime.now(timezone.utc)

    await db.users.insert_one({
        "id": next_id,
        "username": username,
        "email": email,
        "password_hash": get_password_hash(password),
        "full_name": full_name,
        "position": "",
        "department": "",
        "role": role,
        "is_admin": role.lower() == "admin",
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    })
    print(f"Created user '{username}' with role '{role}'")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a MongoDB user")
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--email", default="")
    parser.add_argument("--role", default="employee")
    parser.add_argument("--full-name", default="")
    args = parser.parse_args()

    async def run() -> None:
        try:
            await create_user(
                username=args.username,
                password=args.password,
                email=args.email,
                role=args.role,
                full_name=args.full_name or args.username,
            )
        finally:
            await close_mongo_connection()

    asyncio.run(run())


if __name__ == "__main__":
    main()
