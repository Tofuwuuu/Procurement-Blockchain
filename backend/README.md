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

4. Set up environment variables:
Create a `.env` file in the backend directory:
```env
MONGO_URL=mongodb://localhost:27017
DATABASE_NAME=procurement
FRONTEND_URL=http://localhost:3000
JWT_SECRET=replace-with-a-random-secret-of-at-least-32-characters

# Fabric CLI runtime. Use docker when running peer commands inside Fabric peer containers,
# or local when the peer binary and MSP material are available on the backend host.
FABRIC_PEER_CLI_MODE=docker
FABRIC_DOCKER_BINARY=docker
FABRIC_PEER_CLI_BINARY=peer
FABRIC_COMMAND_TIMEOUT_SECONDS=60
FABRIC_NETWORK_DIR=E:\Projects\BLOCKCHAIN\backend\blockchain\network
FABRIC_CONNECTION_PROFILE=

# Fabric network identity and channel settings
FABRIC_CHANNEL_NAME=procurementchannel
FABRIC_CHAINCODE_NAME=inspection
FABRIC_ORDERER_ADDRESS=orderer.example.com:7050
FABRIC_ORDERER_TLS_CA_FILE=/work/artifacts/orderer_tls_ca.crt
FABRIC_SUBMIT_ORG=org1
FABRIC_QUERY_ORG=org1

# Submit/query peer identity. Add one FABRIC_<ORG>_* group per org used by the app.
FABRIC_ORG1_PEER_CONTAINER=peer0.org1.example.com
FABRIC_ORG1_LOCAL_MSP_ID=Org1MSP
FABRIC_ORG1_TLS_ENABLED=true
FABRIC_ORG1_TLS_ROOTCERT_FILE=/work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
FABRIC_ORG1_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
FABRIC_ORG1_PEER_ADDRESS=peer0.org1.example.com:7051

FABRIC_ORG2_PEER_CONTAINER=peer0.org2.example.com
FABRIC_ORG2_LOCAL_MSP_ID=Org2MSP
FABRIC_ORG2_TLS_ENABLED=true
FABRIC_ORG2_TLS_ROOTCERT_FILE=/work/crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt
FABRIC_ORG2_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp
FABRIC_ORG2_PEER_ADDRESS=peer0.org2.example.com:9051

# Endorsement peers for invoke commands and read peer for query commands.
FABRIC_INVOKE_PEER_ADDRESSES=peer0.org1.example.com:7051,peer0.org2.example.com:9051
FABRIC_INVOKE_TLS_ROOT_CERT_FILES=/work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt,/work/crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt
FABRIC_QUERY_PEER_ADDRESS=peer0.org1.example.com:7051
FABRIC_QUERY_TLS_ROOT_CERT_FILE=/work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
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
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production Mode
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

## API Documentation

Once the server is running, you can access:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

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
curl -X POST http://localhost:8000/api/auth/login \
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
curl -X GET http://localhost:8000/api/auth/verify \
  -H "Authorization: Bearer <your-access-token>"

# Get current user:
curl -X GET http://localhost:8000/api/auth/me \
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
