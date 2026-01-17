# Blockchain Backend API

FastAPI backend for the Blockchain application.

## Setup

1. Create a virtual environment (if not already created):
```bash
python -m venv venv
```

2. Activate the virtual environment:
```bash
# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up environment variables (optional):
Create a `.env` file in the backend directory:
```env
MONGO_URL=mongodb://localhost:27017
DATABASE_NAME=procurement
SECRET_KEY=your-secret-key-change-this-in-production
```

5. Create a test user:
```bash
python create_user.py --username admin --password admin123 --email admin@example.com --role admin
```

## Running the Server

### Development Mode
```bash
python main.py
```

Or using uvicorn directly:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 3003
```

### Production Mode
```bash
uvicorn main:app --host 0.0.0.0 --port 3003
```

## API Documentation

Once the server is running, you can access:
- **Swagger UI**: http://localhost:3003/docs
- **ReDoc**: http://localhost:3003/redoc

## Endpoints

### General
- `GET /` - Root endpoint
- `GET /health` - Health check endpoint (includes database status)
- `GET /api/test` - Test endpoint

### Authentication
- `POST /api/auth/login` - User login
  - Request body: `{"username": "admin", "password": "admin123"}`
  - Returns: JWT access token and user information
- `GET /api/auth/verify` - Verify JWT token (requires Bearer token in Authorization header)

## Login Example

```bash
# Login request
curl -X POST http://localhost:3003/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Response:
{
  "success": true,
  "message": "Login successful",
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": "...",
    "username": "admin",
    "email": "admin@example.com",
    "full_name": null,
    "role": "admin"
  }
}

# Using the token:
curl -X GET http://localhost:3003/api/auth/verify \
  -H "Authorization: Bearer <your-access-token>"

# Get current user:
curl -X GET http://localhost:3003/api/auth/me \
  -H "Authorization: Bearer <your-access-token>"
```

## MongoDB Setup

This API uses MongoDB for data storage. Make sure MongoDB is running:

```bash
# Check if MongoDB is running
# Windows: Check services
# Linux/Mac: sudo systemctl status mongod

# Default connection: mongodb://localhost:27017
# Default database: procurement
```

The login system expects a `users` collection in your MongoDB database. Use the `create_user.py` script to create users.

## Project Structure

```
backend/
├── main.py              # Main FastAPI application
├── database.py          # MongoDB connection and database utilities
├── models.py            # Pydantic models for requests/responses
├── auth.py              # Authentication utilities (JWT, password hashing)
├── create_user.py       # Helper script to create users
├── requirements.txt     # Python dependencies
└── README.md           # This file
```
