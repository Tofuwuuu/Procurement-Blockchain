# Hyperledger Fabric Network Setup

This directory contains the configuration and scripts to set up a Hyperledger Fabric blockchain network for the procurement system.

## Network Architecture

- **1 Orderer**: `orderer.example.com` (port 7050)
- **2 Organizations**: Org1 and Org2
- **4 Peers**: 
  - `peer0.org1.example.com` (port 7051)
  - `peer1.org1.example.com` (port 8051)
  - `peer0.org2.example.com` (port 9051)
  - `peer1.org2.example.com` (port 10051)
- **3 CouchDB instances**: One for each peer organization

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Internet connection (to pull Docker images)

### Setup Steps

1. **Run the setup script:**
   ```powershell
   cd backend\blockchain\network
   .\setup-network.ps1
   ```

   This script will:
   - Clean up any old configuration
   - Generate certificates using cryptogen (via Docker)
   - Generate the genesis block
   - Start all containers

2. **Verify the network is running:**
   ```powershell
   docker-compose -f docker-compose-fabric.yml ps
   ```

3. **Check logs:**
   ```powershell
   docker logs orderer.example.com
   docker logs peer0.org1.example.com
   docker logs peer0.org2.example.com
   ```

## Manual Setup (Alternative)

If the script doesn't work, you can run commands manually:

### 1. Generate Certificates
```powershell
docker run --rm -v ${PWD}:/work -w /work hyperledger/fabric-tools:2.5 cryptogen generate --config=./crypto-config.yaml --output=./crypto-config
```

### 2. Generate Genesis Block
```powershell
docker run --rm -v ${PWD}:/work -w /work hyperledger/fabric-tools:2.5 configtxgen -profile OrdererGenesis -channelID system-channel -outputBlock ./artifacts/genesis.block -configPath .
```

### 3. Start Network
```powershell
docker-compose -f docker-compose-fabric.yml up -d
```

## Stopping the Network

```powershell
docker-compose -f docker-compose-fabric.yml down
```

To also remove volumes:
```powershell
docker-compose -f docker-compose-fabric.yml down -v
```

## Files

- `crypto-config.yaml` - Configuration for certificate generation
- `configtx.yaml` - Channel configuration
- `docker-compose-fabric.yml` - Docker Compose configuration
- `setup-network.ps1` - Automated setup script
- `artifacts/` - Generated genesis block and channel artifacts
- `crypto-config/` - Generated certificates and MSPs

## Troubleshooting

### Containers won't start
- Check Docker is running: `docker ps`
- Check ports are not in use: `netstat -ano | findstr "7050 7051 8051 9051"`
- Check logs: `docker logs <container-name>`

### Certificate errors
- Delete `crypto-config` folder and regenerate
- Ensure `crypto-config.yaml` is correct

### Genesis block errors
- Delete `artifacts` folder and regenerate
- Ensure `configtx.yaml` matches your network structure

## Next Steps

After the network is running:

1. Create a channel (if needed)
2. Deploy chaincode
3. Connect your application to the network

## Ports

- **7050**: Orderer
- **7051**: Peer0.Org1
- **8051**: Peer1.Org1
- **9051**: Peer0.Org2
- **10051**: Peer1.Org2
- **5984**: CouchDB0
- **6984**: CouchDB1
- **7984**: CouchDB2
