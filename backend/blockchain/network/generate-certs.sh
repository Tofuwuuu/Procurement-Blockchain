#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

CRYPTO_DIR="./crypto-config"
mkdir -p $CRYPTO_DIR

echo -e "${YELLOW}[INFO] Generating self-signed certificates for development...${NC}"

# Function to generate cert and key
generate_cert() {
    local path=$1
    local cn=$2
    
    mkdir -p "$path/signcerts" "$path/keystore" "$path/cacerts" "$path/tlscacerts"
    
    # Generate private key
    openssl genrsa -out "$path/keystore/key.pem" 2048 2>/dev/null
    
    # Generate certificate
    openssl req -new -x509 -key "$path/keystore/key.pem" -out "$path/signcerts/cert.pem" \
        -days 365 -subj "/CN=$cn" 2>/dev/null
    
    # Copy cert to cacerts and tlscacerts
    cp "$path/signcerts/cert.pem" "$path/cacerts/ca.pem"
    cp "$path/signcerts/cert.pem" "$path/tlscacerts/tlsca.pem"
    
    echo -e "${GREEN}[OK] Generated certs for $cn${NC}"
}

# Create Orderer Organization
echo -e "${YELLOW}[INFO] Setting up Orderer Organization...${NC}"
mkdir -p $CRYPTO_DIR/ordererOrganizations/example.com/orderers/orderer.example.com
generate_cert "$CRYPTO_DIR/ordererOrganizations/example.com/orderers/orderer.example.com" "orderer.example.com"

mkdir -p $CRYPTO_DIR/ordererOrganizations/example.com/msp
cp "$CRYPTO_DIR/ordererOrganizations/example.com/orderers/orderer.example.com/signcerts/cert.pem" \
   "$CRYPTO_DIR/ordererOrganizations/example.com/msp/signcerts/cert.pem" 2>/dev/null || \
mkdir -p $CRYPTO_DIR/ordererOrganizations/example.com/msp/signcerts && \
cp "$CRYPTO_DIR/ordererOrganizations/example.com/orderers/orderer.example.com/signcerts/cert.pem" \
   "$CRYPTO_DIR/ordererOrganizations/example.com/msp/signcerts/cert.pem"

# Create Org1
echo -e "${YELLOW}[INFO] Setting up Organization 1...${NC}"
mkdir -p $CRYPTO_DIR/peerOrganizations/org1.example.com/peers/peer0.org1.example.com
mkdir -p $CRYPTO_DIR/peerOrganizations/org1.example.com/peers/peer1.org1.example.com
generate_cert "$CRYPTO_DIR/peerOrganizations/org1.example.com/peers/peer0.org1.example.com" "peer0.org1.example.com"
generate_cert "$CRYPTO_DIR/peerOrganizations/org1.example.com/peers/peer1.org1.example.com" "peer1.org1.example.com"

mkdir -p $CRYPTO_DIR/peerOrganizations/org1.example.com/msp/signcerts
cp "$CRYPTO_DIR/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/signcerts/cert.pem" \
   "$CRYPTO_DIR/peerOrganizations/org1.example.com/msp/signcerts/cert.pem"

# Create Org2
echo -e "${YELLOW}[INFO] Setting up Organization 2...${NC}"
mkdir -p $CRYPTO_DIR/peerOrganizations/org2.example.com/peers/peer0.org2.example.com
mkdir -p $CRYPTO_DIR/peerOrganizations/org2.example.com/peers/peer1.org2.example.com
generate_cert "$CRYPTO_DIR/peerOrganizations/org2.example.com/peers/peer0.org2.example.com" "peer0.org2.example.com"
generate_cert "$CRYPTO_DIR/peerOrganizations/org2.example.com/peers/peer1.org2.example.com" "peer1.org2.example.com"

mkdir -p $CRYPTO_DIR/peerOrganizations/org2.example.com/msp/signcerts
cp "$CRYPTO_DIR/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/signcerts/cert.pem" \
   "$CRYPTO_DIR/peerOrganizations/org2.example.com/msp/signcerts/cert.pem"

# Create config.yaml files for all MSPs
for ORG_PATH in $CRYPTO_DIR/ordererOrganizations/example.com/orderers/orderer.example.com/msp \
                $CRYPTO_DIR/peerOrganizations/org1.example.com/msp \
                $CRYPTO_DIR/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/msp \
                $CRYPTO_DIR/peerOrganizations/org1.example.com/peers/peer1.org1.example.com/msp \
                $CRYPTO_DIR/peerOrganizations/org2.example.com/msp \
                $CRYPTO_DIR/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/msp \
                $CRYPTO_DIR/peerOrganizations/org2.example.com/peers/peer1.org2.example.com/msp; do
    cat > "$ORG_PATH/config.yaml" << 'EOF'
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/ca.pem
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/ca.pem
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/ca.pem
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/ca.pem
    OrganizationalUnitIdentifier: orderer
EOF
done

echo -e "${GREEN}[SUCCESS] All cryptographic materials generated successfully!${NC}"
echo -e "${YELLOW}[INFO] Development certificates are ready for use.${NC}"
