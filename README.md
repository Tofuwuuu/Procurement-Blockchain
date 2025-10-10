# 🔗 Blockchain Procurement Management System

A full-stack permissioned blockchain application with integrated procurement management platform, built with Node.js backend and React TypeScript frontend. This system provides immutable audit trails for Philippine business procurement processes using custom blockchain implementation.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9.0-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## ✨ Features

### 🔗 Blockchain Core
- **Proof-of-Work Consensus**: SHA-256 hashing with configurable difficulty
- **P2P Networking**: UDP multicast discovery + Socket.IO peer messaging
- **Smart Contracts**: Business rule validation for procurement operations
- **Chain Synchronization**: Automatic peer discovery and chain consensus
- **Mining System**: Configurable mining rewards and block generation

### 🏢 Procurement Management
- **Supplier Management**: Complete CRUD operations with Philippine compliance
- **Purchase Orders**: Create, approve, and track procurement orders
- **Inventory Control**: Real-time stock tracking and adjustments
- **Audit Logs**: Immutable blockchain-based transaction history
- **Dashboard Analytics**: Real-time statistics and reporting

### 🎨 Frontend Features
- **Modern UI**: Bootstrap 5 with Philippine-themed design
- **Responsive Design**: Mobile-first approach with accessibility compliance
- **Real-time Updates**: Live blockchain explorer and peer monitoring
- **Role-based Access**: Admin and user permission systems
- **Form Validation**: Comprehensive client and server-side validation

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React/TS)                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │  Dashboard  │ │ Blockchain  │ │  Procurement Mgmt   │   │
│  │   Analytics │ │   Explorer  │ │   (Orders/Suppliers)│   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │ REST API + WebSocket
┌─────────────────────▼───────────────────────────────────────┐
│                  Backend (Node.js)                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │  Express    │ │   Blockchain│ │   Smart Contracts   │   │
│  │   Server    │ │    Core     │ │    Validator        │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │   P2P       │ │   Database  │ │   Authentication    │   │
│  │  Network    │ │  (SQLite)   │ │     (JWT)           │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/blockchain-procurement.git
   cd blockchain-procurement
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   
   # Start genesis node (first node in network)
   npm run start:genesis
   ```

3. **Frontend Setup** (in a new terminal)
   ```bash
   cd frontend
   npm install
   npm start
   ```

4. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3003
   - Blockchain Explorer: Available in the frontend dashboard

### Running Multiple Nodes

```bash
# Terminal 1: Genesis node
cd backend && npm run start:genesis

# Terminal 2: Peer node
cd backend && npm run start:peer

# Terminal 3: Additional peer
cd backend && node node.js --port 3004 --peer localhost --peer-port 3003
```

## 📖 Usage

### Blockchain Operations

#### Mining Blocks
```bash
curl -X GET http://localhost:3003/mine
```

#### Create Transaction
```bash
curl -X POST http://localhost:3003/transactions/new \
  -H "Content-Type: application/json" \
  -d '{
    "from": "user123",
    "to": "supplier456",
    "amount": 1000,
    "action": "order_created",
    "data": {
      "order_id": "PO-2024-001",
      "supplier_id": 456,
      "total_amount": 1000
    }
  }'
```

#### View Blockchain
```bash
curl http://localhost:3003/chain
```

### Smart Contracts

The system includes built-in smart contracts for:

- **Order Management**: `order_created`, `order_approved`
- **Shipment Tracking**: `shipment_created`, `shipment_delivered`
- **Payment Processing**: `payment_processed`
- **Inventory Control**: `inventory_adjusted`
- **Supplier Management**: `supplier_registered`

### Frontend Features

- **Dashboard**: Real-time blockchain statistics and recent transactions
- **Blockchain Explorer**: View blocks, transactions, and mining status
- **Supplier Management**: Add, edit, and manage supplier information
- **Order Processing**: Create and track purchase orders
- **Inventory Tracking**: Monitor stock levels and adjustments
- **User Management**: Role-based access control

## 🔧 Configuration

### Environment Variables

**Backend (.env)**
```env
PORT=3003
NODE_ENV=development
JWT_SECRET=your-secret-key
BLOCKCHAIN_DIFFICULTY=4
MINING_REWARD=100
```

**Frontend (.env)**
```env
REACT_APP_API_URL=http://localhost:3003
REACT_APP_ENVIRONMENT=development
```

### Network Settings

- **UDP Multicast**: `224.0.0.1:5000`
- **Socket.IO**: Configurable port (default: 3003)
- **HTTP API**: REST endpoints on configured port

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
npm run test:coverage
```

## 📊 API Documentation

### Blockchain Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Node health check |
| GET | `/status` | Comprehensive node status |
| GET | `/chain` | Get full blockchain |
| GET | `/chain/block/:index` | Get specific block |
| POST | `/transactions/new` | Create new transaction |
| GET | `/mine` | Mine pending transactions |
| GET | `/peers` | List connected peers |
| POST | `/add_peer` | Add new peer |

### Procurement Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/suppliers` | Supplier management |
| GET | `/api/orders` | Purchase order management |
| GET | `/api/inventory` | Inventory tracking |
| POST | `/api/auth/login` | User authentication |

## 🛠️ Technology Stack

### Backend
- **Node.js 18+** - Runtime environment
- **Express.js** - Web framework
- **Socket.IO** - Real-time communication
- **SQLite** - Database
- **JWT** - Authentication
- **bcrypt** - Password hashing
- **SHA-256** - Cryptographic hashing

### Frontend
- **React 18.2.0** - UI framework
- **TypeScript 4.9.0** - Type safety
- **Bootstrap 5.3.0** - UI components
- **React Router DOM** - Client-side routing
- **Axios** - HTTP client
- **React Testing Library** - Testing framework

## 🔒 Security Features

- **Transaction Validation**: Smart contract enforcement
- **Chain Integrity**: SHA-256 hash verification
- **Peer Authentication**: Node ID validation
- **Input Sanitization**: Request validation and sanitization
- **JWT Authentication**: Secure user sessions
- **Role-based Access**: Admin and user permissions

## 📁 Project Structure

```
blockchain-procurement/
├── backend/                 # Node.js blockchain backend
│   ├── blockchain.js       # Core blockchain implementation
│   ├── p2p.js             # P2P networking layer
│   ├── consensus.js       # Consensus mechanism
│   ├── contracts.js       # Smart contract validation
│   ├── node.js            # Main node application
│   └── package.json       # Backend dependencies
├── frontend/               # React TypeScript frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API and data services
│   │   ├── contexts/      # React contexts
│   │   └── types/         # TypeScript type definitions
│   └── package.json       # Frontend dependencies
├── LICENSE                 # MIT License
└── README.md              # This file
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style and conventions
- Add tests for new functionality
- Update documentation as needed
- Ensure all tests pass before submitting PR

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with Node.js, Express, React, and TypeScript
- Inspired by blockchain principles and distributed systems
- Designed for Philippine procurement compliance
- Educational and development purposes

## 📞 Support

For questions and support:

- **Issues**: Create an issue on GitHub
- **Documentation**: Check the README files in backend/ and frontend/
- **Examples**: Review the code examples and API documentation

## 🔮 Roadmap

- [ ] Docker containerization
- [ ] Enhanced smart contract system
- [ ] Mobile application
- [ ] Advanced analytics dashboard
- [ ] Integration with external APIs
- [ ] Performance optimizations

---

**Built with ❤️ for the Philippine business community**

*This project demonstrates advanced blockchain development skills and full-stack application architecture.*
