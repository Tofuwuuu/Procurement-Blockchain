# Blockchain Procurement Management System

A full-stack procurement management platform built for Philippine government procurement workflows. The frontend is a React/TypeScript SPA; the backend is a FastAPI + MongoDB API with Hyperledger Fabric used as an immutable audit ledger for inspection and procurement events.

[![FastAPI](https://img.shields.io/badge/FastAPI-backend-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9.0-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Features

### Procurement Workflow
- **Purchase Requests** — create, review, and multi-stage approval by role
- **Canvassing & Suppliers** — abstract of canvass, supplier CRUD with Philippine compliance fields
- **Purchase Orders** — create, approve, and track
- **Deliveries, Invoices & Payments** — full lifecycle through disbursement voucher
- **Inspections** — inspection reports recorded on Hyperledger Fabric for tamper-evident audit

### Inventory & Property
- **Inventory Transfer Reports** — track asset movement between units
- **Property Transfer / Return Slips** — custodian and property return forms
- **Waste Materials Reports** — disposal documentation
- **Custodian Slips** — hand-receipt generation

### Platform
- **Audit Logs** — every workflow status change is captured in MongoDB
- **Blockchain Explorer** — view Fabric-recorded procurement events and verify on-chain
- **Supplier Search** — web-scraping utility for external supplier discovery
- **Role-based Access** — admin, canvasser, validator, finance, auditor, and custodian roles
- **Dashboard Analytics** — real-time statistics across all procurement stages

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                   Frontend (React/TS :3000)                │
│   Dashboard  │  Procurement Workflow  │  Blockchain UI     │
└──────────────────────────┬─────────────────────────────────┘
                           │  REST/JWT  (CRA proxy → :8000)
┌──────────────────────────▼─────────────────────────────────┐
│                  Backend (FastAPI :8000)                   │
│   Auth/JWT  │  Procurement Routes  │  Fabric Proxy         │
│                    Motor (async)                           │
│                    MongoDB :27017                          │
└──────────────────────────┬─────────────────────────────────┘
                           │  docker exec peer
┌──────────────────────────▼─────────────────────────────────┐
│           Hyperledger Fabric (Docker)                      │
│   procurementchannel  │  inspection chaincode              │
└────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- MongoDB (local or Atlas)
- Docker Desktop (required only for Hyperledger Fabric audit features)

### 1. Backend

**Option A — Docker (recommended with Fabric)**

From the project root, start MongoDB, the FastAPI backend, and the Fabric network together:

```powershell
docker compose up -d --build
```

The API is available at **http://localhost:8000** (docs at **http://localhost:8000/docs**).

**Option B — Local Python**

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1          # Windows PowerShell
pip install -r requirements.txt
python main.py                       # starts on http://localhost:8000
```

Interactive API docs are available at **http://localhost:8000/docs** once the server is running.

> If you use Docker for the backend, stop any local MongoDB service on port `27017` first to avoid a port conflict.

### 2. Frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm start                            # starts on http://localhost:3000
```

The React dev server proxies all `/api/*` requests to `http://localhost:8000`.

### 3. MongoDB

Default connection: `mongodb://localhost:27017`, database `procurement`. Override with the `MONGO_URL` and `DATABASE_NAME` environment variables.

### 4. Hyperledger Fabric (optional)

Required only for on-chain inspection recording. Follow `backend/blockchain/network/QUICK_START.md` to:

1. Generate crypto material and channel artifacts
2. Start the full stack: `docker compose up -d --build` (Fabric + MongoDB + backend)
3. Deploy chaincode: run `backend/blockchain/network/deploy-chaincode.ps1`

The backend degrades gracefully when Fabric is unavailable — procurement data continues to save to MongoDB.

## Environment Variables

Create a `.env` file in `backend/`. Security and Fabric settings are loaded from environment variables so deployments can provide different origins, credentials, paths, peer containers, and connection profiles without code changes:

```env
MONGO_URL=mongodb://localhost:27017
DATABASE_NAME=procurement
FRONTEND_URL=http://localhost:3000
JWT_SECRET=replace-with-a-random-secret-of-at-least-32-characters

FABRIC_PEER_CLI_MODE=docker
FABRIC_DOCKER_BINARY=docker
FABRIC_PEER_CLI_BINARY=peer
FABRIC_COMMAND_TIMEOUT_SECONDS=60
FABRIC_CONNECTION_PROFILE=

FABRIC_CHANNEL_NAME=procurementchannel
FABRIC_CHAINCODE_NAME=inspection
FABRIC_ORDERER_ADDRESS=orderer.example.com:7050
FABRIC_ORDERER_TLS_CA_FILE=/work/artifacts/orderer_tls_ca.crt
FABRIC_SUBMIT_ORG=org1
FABRIC_QUERY_ORG=org1

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

FABRIC_INVOKE_PEER_ADDRESSES=peer0.org1.example.com:7051,peer0.org2.example.com:9051
FABRIC_INVOKE_TLS_ROOT_CERT_FILES=/work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt,/work/crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt
FABRIC_QUERY_PEER_ADDRESS=peer0.org1.example.com:7051
FABRIC_QUERY_TLS_ROOT_CERT_FILE=/work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
```

Production frontend builds read `REACT_APP_API_URL` from a `.env` file in `frontend/`.

## API Reference

All endpoints are also browsable at **http://localhost:8000/docs** (Swagger UI) and **http://localhost:8000/redoc**.

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Root health check |
| GET | `/health` | Detailed health status |
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/test` | API connectivity test |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Current user profile |
| GET | `/api/auth/verify` | Verify JWT token |

### Purchase Requests

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/purchase-requests` | Create purchase request |
| GET | `/api/purchase-requests` | List purchase requests |
| GET | `/api/purchase-requests/{pr_id}` | Get purchase request |
| PUT | `/api/purchase-requests/{pr_id}` | Update / advance workflow |

### Suppliers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/suppliers` | List suppliers |
| POST | `/api/suppliers` | Create supplier |
| GET | `/api/suppliers/{supplier_id}` | Get supplier |
| PUT | `/api/suppliers/{supplier_id}` | Update supplier |
| DELETE | `/api/suppliers/{supplier_id}` | Delete supplier |
| POST | `/api/suppliers/award` | Award abstract of canvass |

### Purchase Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orders` | Create purchase order |
| GET | `/api/orders` | List purchase orders |
| GET | `/api/orders/{order_id}` | Get purchase order |
| PUT | `/api/orders/{order_id}` | Update purchase order |
| POST | `/api/orders/{order_id}/approve` | Approve purchase order |

### Deliveries, Invoices & Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/deliveries` | Create delivery receipt |
| GET | `/api/deliveries` | List delivery receipts |
| GET | `/api/deliveries/{receipt_id}` | Get delivery receipt |
| PUT | `/api/deliveries/{receipt_id}` | Update delivery receipt |
| POST | `/api/invoices` | Create invoice |
| GET | `/api/invoices` | List invoices |
| GET | `/api/invoices/{invoice_number}` | Get invoice |
| PUT | `/api/invoices/{invoice_number}` | Update invoice |
| POST | `/api/payments` | Create payment |
| GET | `/api/payments` | List payments |
| PUT | `/api/payments/{payment_number}` | Update payment |
| POST | `/api/payments/{payment_number}/approve` | Approve payment |
| GET | `/api/disbursement-vouchers` | List disbursement vouchers |

### Inspections

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inspections` | List inspections |
| GET | `/api/inspections/{po_number}` | Get inspection by PO |
| GET | `/api/inspections/check/{po_number}` | Check inspection status |
| POST | `/api/inspection-reports` | Submit inspection report (recorded on Fabric) |
| GET | `/api/inspection-reports` | List inspection reports |
| POST | `/api/inspected` | Mark items as inspected |
| GET | `/api/inspected` | List inspected items |

### Property & Inventory

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/custodian-slips` | Create custodian slip |
| GET | `/api/custodian-slips` | List custodian slips |
| POST | `/api/inventory-transfer-reports` | Create ITR |
| GET | `/api/inventory-transfer-reports` | List ITRs |
| GET | `/api/inventory-transfer-reports/{itr_id}` | Get ITR |
| POST | `/api/property-transfer-reports` | Create PTR |
| GET | `/api/property-transfer-reports` | List PTRs |
| GET | `/api/property-transfer-reports/{ptr_id}` | Get PTR |
| POST | `/api/property-return-slips` | Create property return slip |
| GET | `/api/property-return-slips` | List property return slips |
| GET | `/api/property-return-slips/{slip_id}` | Get property return slip |
| POST | `/api/waste-materials-reports` | Create waste materials report |
| GET | `/api/waste-materials-reports` | List waste materials reports |
| GET | `/api/waste-materials-reports/{id}` | Get waste materials report |

### Blockchain / Audit

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/blockchain/events` | List all on-chain procurement events |
| GET | `/api/blockchain/events/{event_id}` | Get event detail |
| GET | `/api/blockchain/events/{event_id}/verify` | Verify event on Fabric |
| GET | `/api/blockchain/inspections` | List on-chain inspection records |
| GET | `/api/blockchain/inspections/{inspection_id}` | Get on-chain inspection |
| GET | `/api/blockchain/inspections/po/{po_number}` | Get on-chain inspection by PO |
| GET | `/api/blockchain/inspections/{inspection_id}/verify` | Verify inspection on Fabric |
| POST | `/api/blockchain/inspections/sync` | Sync inspection records from Fabric |

### Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/audit-logs` | System audit log |
| GET | `/api/connections` | Active client connections + Fabric status |
| POST | `/api/connection/ping` | Heartbeat from browser client |

## Technology Stack

### Backend
- **Python 3.13** — runtime
- **FastAPI** — web framework
- **Motor / PyMongo** — async MongoDB driver
- **Pydantic v2** — data validation and serialization
- **python-jose** — JWT authentication
- **bcrypt** — password hashing
- **Uvicorn** — ASGI server
- **BeautifulSoup4 / lxml** — supplier web scraping

### Frontend
- **React 18.2** — UI framework
- **TypeScript 4.9** — type safety
- **Bootstrap 5.3** — component library
- **React Router DOM 6** — client-side routing
- **Axios** — HTTP client

### Blockchain / Infrastructure
- **Hyperledger Fabric 2.5** — permissioned ledger for audit events
- **CouchDB 3.2** — Fabric state database
- **MongoDB** — primary application database

## Project Structure

```
BLOCKCHAIN/
├── backend/
│   ├── main.py                  # FastAPI app, all routes (~3700 lines)
│   ├── auth.py                  # JWT helpers
│   ├── database.py              # MongoDB connection
│   ├── workflow_config.py       # Multi-stage approval rules
│   ├── requirements.txt         # Python dependencies
│   ├── api/
│   │   └── blockchain_client.py # Hyperledger Fabric integration
│   ├── blockchain/
│   │   ├── chaincode/           # Fabric inspection smart contract (Node.js)
│   │   └── network/             # Docker Compose, channel config, scripts
│   ├── Connection/
│   │   └── Connector.py         # In-memory client heartbeat registry
│   └── Scraping/
│       └── supplier_api.py      # Supplier web search routes
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   ├── pages/               # Page components
│   │   ├── services/api.ts      # Axios API client
│   │   └── contexts/            # Auth and app state contexts
│   └── package.json             # React dependencies + proxy config
├── docs/                        # Architecture notes and analysis
└── README.md
```

## Security Notes

- Set `SECRET_KEY` in `.env` before any deployment — the default value is not secure.
- CORS is currently open (`allow_origins=["*"]`). Restrict this to your frontend origin in production.
- The `verify_password` function accepts plaintext passwords for legacy data migration. Migrate all users to bcrypt hashes before going to production.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
