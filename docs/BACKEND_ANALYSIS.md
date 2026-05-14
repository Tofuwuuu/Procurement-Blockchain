# Backend Blockchain Analysis

## Overview
Your backend is a **FastAPI-based procurement management system** with Hyperledger Fabric blockchain integration. It manages purchase requests, inspections, inventory, and property transfers with JWT authentication and MongoDB persistence.

---

## Architecture

### Tech Stack
- **Framework**: FastAPI 0.115.0
- **Database**: MongoDB (Motor async driver)
- **Authentication**: JWT + BCrypt
- **Blockchain**: Hyperledger Fabric 2.5
- **Container Orchestration**: Docker Compose
- **Language**: Python 3.x

### Key Dependencies
```
fastapi>=0.115.0
motor>=3.6.0 (async MongoDB)
pymongo>=4.10.0
python-jose[cryptography]>=3.3.0
bcrypt>=4.2.0
python-dotenv>=1.0.1
requests>=2.31.0
beautifulsoup4>=4.12.0 (web scraping)
```

---

## Project Structure

### Backend Core Files
- **`main.py`** (1,901 lines) - Main FastAPI application with all endpoints
- **`database.py`** - MongoDB connection management
- **`models.py`** - Pydantic data models for request/response validation
- **`auth.py`** - JWT token generation/verification and password hashing
- **`node.py`** - Currently empty (reserved for blockchain node logic)

### Blockchain Components
```
blockchain/
├── chaincode/
│   ├── index.js (empty)
│   ├── package.json
│   └── inspection_contract/
│       └── inspection.js (empty - placeholder)
└── network/
    ├── docker-compose-fabric.yml
    ├── configtx.yaml
    ├── crypto-config/ (crypto materials)
    ├── peercfg/ (peer configuration)
    └── scripts/ (deployment scripts)
```

### API Routes
```
api/
├── blockchain_client.py (empty)
├── inspection.py (empty)
└── procurement.py (empty)
```

### Supporting Modules
```
Scraping/ - Web scraper for supplier data
├── scraper.py
├── service.py
├── supplier_api.py (integrated as router)
├── schema.py
├── security.py
└── __init__.py
```

---

## Core Features

### 1. Authentication (JWT-Based)
**Endpoints:**
- `POST /api/auth/login` - User login with username/password
- `GET /api/auth/me` - Get current user info
- `GET /api/auth/verify` - Verify token validity

**Features:**
- Bcrypt password hashing (supports both hashed and plain text)
- 24-hour JWT token expiration
- Role-based access control (admin/employee)
- User lookup by username or email

---

### 2. Purchase Request Management
**Endpoints:**
- `POST /api/purchase-requests` - Create new PR
- `GET /api/purchase-requests` - List all PRs (with user filter option)
- `GET /api/purchase-requests/{pr_id}` - Get specific PR
- `PUT /api/purchase-requests/{pr_id}` - Update PR

**Features:**
- Auto-generated PR numbers: `PR-YYYY-XXX` format
- Track PR status (Pending, etc.)
- Multi-item support per PR
- Total cost calculation
- Timestamp tracking (created, updated)
- User attribution

**Data Model:**
```python
{
  "pr_number": "PR-2025-001",
  "entity_name": string,
  "fund_cluster": string,
  "office_section": string,
  "responsibility_center_code": string,
  "date": string,
  "status": "Pending" | other,
  "items": [
    {
      "unit": string,
      "item_description": string,
      "quantity": int,
      "unit_cost": float,
      "total_cost": float
    }
  ],
  "total_amount": float
}
```

---

### 3. Inspection Management
**Endpoints:**
- `GET /api/inspections` - List inspections (filterable by user)
- `GET /api/inspections/{po_number}` - Get specific inspection
- `GET /api/inspections/check/{po_number}` - Check inspection status
- `POST /api/inspection-reports` - Create inspection report
- `GET /api/inspection-reports` - List all reports

**Features:**
- Track inspections by PO number
- Inspection report creation and retrieval
- Pending inspection tracking

---

### 4. Inventory Management
**Endpoints:**
- `POST /api/custodian-slips` - Create custodian slip
- `GET /api/custodian-slips` - List custodian slips
- `POST /api/inventory-transfer-reports` - Create transfer report
- `GET /api/inventory-transfer-reports` - List transfer reports
- `POST /api/inspected` - Mark items as inspected
- `GET /api/inspected` - Get inspected items list

**Features:**
- Custodian accountability tracking
- Property transfer documentation
- Inventory movement tracking

---

### 5. Property Management
**Endpoints (inferred from models):**
- Property Return Slips
- Property Transfer Reports
- Property Acknowledgement Receipts
- Waste Materials Reports

---

### 6. Additional Features
- `GET /health` - Health check endpoint with DB connection test
- `GET /` - Root health check
- `GET /api/test` - Test endpoint
- `GET /api/test-purchase-requests` - Test data generator
- **Supplier Search Router** - Integrated web scraping module for supplier lookup

---

## Database Schema

### MongoDB Collections
1. **`users`** - User accounts with credentials
2. **`roles`** - Role definitions (admin, employee, etc.)
3. **`purchase_requests`** - Purchase request documents
4. **`inspection_reports`** - Inspection records
5. **`custodian_slips`** - Custodian accountability
6. **`inventory_transfer_reports`** - Transfer records
7. **`waste_materials_reports`** - Waste tracking
8. **`counters`** - ID sequence counters for PR and CC numbers
9. **Additional collections** for other document types

---

## Hyperledger Fabric Network Setup

### Network Configuration
- **Version**: Hyperledger Fabric 2.5
- **Consensus**: RAFT-based ordering
- **Organizations**: 2 (Org1 + Org2) + OrdererOrg
- **Peers**: At least 1 peer per org (peer0.org1.example.com, peer0.org2.example.com)
- **Orderer**: Single orderer (orderer.example.com)
- **State Database**: CouchDB
- **TLS**: Enabled for all components

### Services
- **Orderer** (port 7050) - Transaction ordering and consensus
- **Peer0.Org1** (port 7051) - Ledger and chaincode execution
- **CouchDB0** (port 5984) - State database for Peer0.Org1
- **Additional peers** for Org2 and CouchDB replicas

### Configuration Files
- **configtx.yaml** - Channel configuration, organizations, policies
- **docker-compose-fabric.yml** - Container definitions for all services
- **crypto-config/** - Generated TLS certificates and MSP materials
- **peercfg/** - Peer configuration files

---

## Smart Contracts (Chaincode)

### Status: **INCOMPLETE**
- `inspection_contract/inspection.js` - Empty placeholder
- `index.js` - Empty placeholder
- Package dependencies configured but not implemented

### Expected Functionality
Based on structure, should implement:
1. **Inspection Contract** - Record and validate item inspections
2. Integration with purchase request workflow
3. Immutable record keeping on blockchain

### Dependencies (from package.json)
```json
{
  "fabric-contract-api": "^2.2.0",
  "fabric-shim": "^2.2.0"
}
```

---

## API Modules (Empty)

### Status: **NOT IMPLEMENTED**
- **`api/blockchain_client.py`** - Fabric network client (empty)
- **`api/inspection.py`** - Inspection-specific endpoints (empty)
- **`api/procurement.py`** - Procurement-specific endpoints (empty)

These modules likely need implementation to:
- Connect to Hyperledger Fabric network
- Submit chaincode transactions
- Query blockchain state
- Handle blockchain-specific validation

---

## Authentication & Security

### JWT Configuration
- **Algorithm**: HS256
- **Expiration**: 24 hours (configurable)
- **Secret Key**: From `.env` (should be changed in production)

### Password Security
- **Hash Algorithm**: BCrypt
- **Fallback**: Plain text comparison for legacy data
- **Salt**: Auto-generated per bcrypt standard

### CORS Configuration
- Currently allows all origins (`allow_origins=["*"]`)
- **⚠️ SECURITY NOTE**: Should restrict to specific frontend domain in production

---

## Supplier Integration

### Features
- Web scraping module integrated
- Supplier search router exposed
- Support for canvassing suppliers
- Integration with purchase request items

### Modules
- `Scraping/scraper.py` - Scraping logic
- `Scraping/supplier_api.py` - API integration
- `Scraping/service.py` - Business logic
- `Scraping/schema.py` - Data models
- `Scraping/security.py` - Security utilities

---

## Issues & Gaps

### Critical ⚠️
1. **Empty Chaincode** - Smart contracts not implemented
2. **Empty API Modules** - Blockchain client not implemented
3. **Empty node.py** - Blockchain node logic not implemented
4. **No Actual Blockchain Integration** - Main.py doesn't interact with Fabric network

### Security 🔒
1. **CORS too permissive** - Allow all origins
2. **Secret key in code** - Should use environment variable
3. **No rate limiting** - Missing request throttling
4. **No input validation** - Minimal security checks on user input
5. **No logging** - Limited audit trail

### Missing Features 📝
1. Blockchain transaction recording
2. Immutable audit logs
3. Supply chain traceability
4. Smart contract enforcement
5. Complex query support on blockchain
6. Blockchain synchronization
7. Network health monitoring

### Incomplete Integrations 🔌
- Web scraper functionality not fully connected
- No actual blockchain reads/writes
- No transaction verification
- No blockchain state synchronization with MongoDB

---

## Environment Configuration

### Required `.env` Variables
```env
MONGO_URL=mongodb://localhost:27017
DATABASE_NAME=procurement
SECRET_KEY=your-secret-key-change-this
```

### Optional Blockchain Configuration
```env
FABRIC_SDK_PYTHON_PATH=...
FABRIC_NETWORK_NAME=...
FABRIC_ORG_NAME=...
```

---

## Running the Backend

### Prerequisites
1. Python 3.8+
2. MongoDB running locally or remote
3. Optional: Docker for Hyperledger Fabric

### Startup
```bash
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

### Expected Output
- Server runs on `http://localhost:8000`
- MongoDB connection logs
- API docs available at `http://localhost:8000/docs`

---

## Recommendations

### High Priority
1. **Implement Chaincode** - Complete inspection.js with create/read/update operations
2. **Implement Blockchain Client** - Create Fabric network interface
3. **Fix CORS Security** - Restrict to frontend domain
4. **Add Input Validation** - Implement comprehensive request validation
5. **Add Logging & Monitoring** - Implement proper logging system

### Medium Priority
1. Implement blockchain transaction recording
2. Add blockchain state synchronization
3. Create blockchain query endpoints
4. Implement audit logging
5. Add rate limiting and request validation

### Low Priority
1. Optimize database queries with indexing
2. Implement caching layer
3. Add async processing for heavy operations
4. Create comprehensive API documentation
5. Add integration tests

---

## Summary

Your backend is a **well-structured FastAPI application for procurement management** with:
- ✅ Complete REST API for purchase requests and inspections
- ✅ Functional MongoDB integration
- ✅ JWT authentication system
- ✅ Hyperledger Fabric network infrastructure
- ❌ Missing blockchain integration code
- ❌ Missing smart contract implementation
- ⚠️ Security considerations needed

**The blockchain network is set up but not actively used. Main.py operates as a traditional REST API without blockchain interaction.**
