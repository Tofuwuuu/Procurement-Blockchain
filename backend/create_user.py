"""
Helper script to create a user in MongoDB
Usage: python create_user.py --username <username> --password <password> [--email <email>] [--full_name <name>] [--role <role>]
"""
import asyncio
import argparse
from motor.motor_asyncio import AsyncIOMotorClient
from auth import get_password_hash
from datetime import datetime
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
    
    # Check if user already exists
    existing_user = await users_collection.find_one({"username": username})
    if existing_user:
        print(f"❌ User '{username}' already exists!")
        client.close()
        return False
    
    # Hash password
    password_hash = get_password_hash(password)
    
    # Create user document
    user_doc = {
        "username": username,
        "password_hash": password_hash,
        "email": email,
        "full_name": full_name,
        "role": role,
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    
    # Insert user
    result = await users_collection.insert_one(user_doc)
    
    if result.inserted_id:
        print(f"✅ User '{username}' created successfully!")
        print(f"   User ID: {result.inserted_id}")
        print(f"   Role: {role}")
        client.close()
        return True
    else:
        print(f"❌ Failed to create user '{username}'")
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
        print("\n💡 You can now login using:")
        print(f"   POST http://localhost:8000/api/auth/login")
        print(f"   Body: {{'username': '{args.username}', 'password': '<your-password>'}}")

if __name__ == "__main__":
    asyncio.run(main())
