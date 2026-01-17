"""
Helper script to create a user in MongoDB
Usage: python create_user.py --username <username> --password <password> [--email <email>] [--full_name <name>] [--role <role>]
"""
import asyncio
import argparse
from motor.motor_asyncio import AsyncIOMotorClient
from auth import get_password_hash
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "procurement")

async def create_user(username: str, password: str, email: str = None, full_name: str = None, role: str = "user"):
    """Create a new user in MongoDB"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DATABASE_NAME]
    users_collection = db.users
    counters_collection = db.counters
    
    # Check if user already exists
    existing_user = await users_collection.find_one({"username": username})
    if existing_user:
        print(f"[ERROR] User '{username}' already exists!")
        client.close()
        return False
    
    # Get or generate unique ID
    user_id = None
    
    # Try to use counters collection for auto-increment (most reliable)
    try:
        counter = await counters_collection.find_one_and_update(
            {"_id": "userid"},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=True
        )
        if counter and counter.get("seq"):
            user_id = counter.get("seq")
            print(f"[INFO] Using counter ID: {user_id}")
    except Exception as e:
        print(f"[INFO] Counter method failed: {e}")
    
    # If counters didn't work, find max ID and increment
    if user_id is None:
        try:
            # Get all users with numeric IDs and find the max
            all_users = await users_collection.find(
                {"id": {"$exists": True, "$ne": None, "$type": "number"}},
                {"id": 1}
            ).to_list(length=None)
            
            if all_users and len(all_users) > 0:
                max_id = max([int(u.get("id", 0)) for u in all_users if u.get("id")])
                user_id = max_id + 1
                print(f"[INFO] Using max ID + 1: {user_id}")
            else:
                # If no users with numeric IDs, start from a high number
                total_users = await users_collection.count_documents({})
                user_id = max(1000, total_users * 100 + 1)
                print(f"[INFO] Using calculated ID: {user_id}")
        except Exception as e:
            print(f"[INFO] Max ID method failed: {e}")
            # Fallback: use timestamp-based ID
            user_id = int(datetime.now().timestamp()) % 1000000
            print(f"[INFO] Using timestamp ID: {user_id}")
    
    # Hash password
    password_hash = get_password_hash(password)
    
    # Create user document
    user_doc = {
        "id": user_id,
        "username": username,
        "password_hash": password_hash,
        "email": email,
        "full_name": full_name,
        "role": role,
        "is_active": True,
        "created_at": datetime.now(timezone.utc) if hasattr(timezone, 'utc') else datetime.utcnow()
    }
    
    # Insert user
    result = await users_collection.insert_one(user_doc)
    
    if result.inserted_id:
        print(f"[SUCCESS] User '{username}' created successfully!")
        print(f"   User ID: {result.inserted_id}")
        print(f"   Role: {role}")
        client.close()
        return True
    else:
        print(f"[ERROR] Failed to create user '{username}'")
        client.close()
        return False

async def main():
    parser = argparse.ArgumentParser(description="Create a new user in MongoDB")
    parser.add_argument("--username", required=True, help="Username")
    parser.add_argument("--password", required=True, help="Password")
    parser.add_argument("--email", help="Email address")
    parser.add_argument("--full_name", help="Full name")
    parser.add_argument("--role", default="user", help="User role (default: user)")
    
    args = parser.parse_args()
    
    success = await create_user(
        username=args.username,
        password=args.password,
        email=args.email,
        full_name=args.full_name,
        role=args.role
    )
    
    if success:
        print("\n[INFO] You can now login using:")
        print(f"   POST http://localhost:3003/api/auth/login")
        print(f"   Body: {{'username': '{args.username}', 'password': '<your-password>'}}")

if __name__ == "__main__":
    asyncio.run(main())
