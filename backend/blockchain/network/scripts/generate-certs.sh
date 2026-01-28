#!/bin/bash

# Hyperledger Fabric Certificate Generation Script
# Generates self-signed certificates for Orderer and Peers
# For development/testing purposes only

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CRYPTO_DIR="./crypto-config"
DAYS_VALID=365

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Hyperledger Fabric Certificate Generator${NC}"
echo -e "${BLUE}========================================${NC}"

# Function to generate cert and key
generate_cert() {
    local path=$1
    local cn=$2
    local org=$3
    
    echo -e "${YELLOW}[INFO]${NC} Generating certificate for $cn..."
    
    mkdir -p "$path/signcerts" "$path/keystore" "$path/cacerts" "$path/tlscacerts"
    
    # Generate private key (EC P-256)
    openssl ecparam -name prime256v1 -genkey -noout -out "$path/keystore/key.pem" 2>/dev/null
    
    # Generate self-signed certificate
    openssl req -new -x509 \
        -key "$path/keystore/key.pem" \
        -out "$path/signcerts/cert.pem" \
        -days $DAYS_VALID \
        -subj "/C=PH/ST=NCR/L=Manila/O=$org/CN=$cn" 2>/dev/null
    
    # Copy cert to cacerts and tlscacerts
    cp "$path/signcerts/cert.pem" "$path/cacerts/ca.pem"
    cp "$path/signcerts/cert.pem" "$path/tlscacerts/tlsca.pem"
    
    echo -e "${GREEN}[OK]${NC} Generated certs for $cn"
}

# Clean up previous certs
if [ -d "$CRYPTO_DIR" ]; then
    echo -e "${YELLOW}[INFO]${NC} Cleaning up existing crypto-config..."
    rm -rf "$CRYPTO_DIR"
fi

mkdir -p "$CRYPTO_DIR"

# ============================================
# 1. Create Orderer Organization
# ============================================
echo -e "\n${BLUE}[1/3] Setting up Orderer Organization...${NC}"

ORDERER_ORG="$CRYPTO_DIR/ordererOrganizations/example.com"
ORDERER_ORDERERS="$ORDERER_ORG/orderers"
ORDERER_MSP="$ORDERER_ORG/msp"

mkdir -p "$ORDERER_ORDERERS/orderer.example.com"
mkdir -p "$ORDERER_MSP"

# Generate orderer certificate
generate_cert "$ORDERER_ORDERERS/orderer.example.com" "orderer.example.com" "OrdererOrg"

# Copy orderer cert to org MSP
mkdir -p "$ORDERER_MSP/signcerts"
cp "$ORDERER_ORDERERS/orderer.example.com/signcerts/cert.pem" "$ORDERER_MSP/signcerts/cert.pem"

# Create config.yaml
echo "NodeOUs:" > "$ORDERER_ORG/msp/config.yaml"
echo "  Enable: false" >> "$ORDERER_ORG/msp/config.yaml"

echo -e "${GREEN}[OK]${NC} Orderer Organization setup complete"

# ============================================
# 2. Create Peer Organization 1 (Org1)
# ============================================
echo -e "\n${BLUE}[2/3] Setting up Peer Organization 1 (Org1)...${NC}"

ORG1="$CRYPTO_DIR/peerOrganizations/org1.example.com"
ORG1_PEERS="$ORG1/peers"
ORG1_MSP="$ORG1/msp"
ORG1_USERS="$ORG1/users"

mkdir -p "$ORG1_PEERS/peer0.org1.example.com"
mkdir -p "$ORG1_PEERS/peer1.org1.example.com"
mkdir -p "$ORG1_MSP"
mkdir -p "$ORG1_USERS/Admin@org1.example.com"
mkdir -p "$ORG1_USERS/User1@org1.example.com"

# Generate peer certificates
generate_cert "$ORG1_PEERS/peer0.org1.example.com" "peer0.org1.example.com" "Org1"
generate_cert "$ORG1_PEERS/peer1.org1.example.com" "peer1.org1.example.com" "Org1"

# Generate admin certificate
generate_cert "$ORG1_USERS/Admin@org1.example.com" "Admin@org1.example.com" "Org1"

# Generate user certificate
generate_cert "$ORG1_USERS/User1@org1.example.com" "User1@org1.example.com" "Org1"

# Copy peer0 cert to org MSP
mkdir -p "$ORG1_MSP/signcerts"
cp "$ORG1_PEERS/peer0.org1.example.com/signcerts/cert.pem" "$ORG1_MSP/signcerts/cert.pem"

# Create config.yaml for Org1
echo "NodeOUs:" > "$ORG1_MSP/config.yaml"
echo "  Enable: false" >> "$ORG1_MSP/config.yaml"

echo -e "${GREEN}[OK]${NC} Org1 setup complete"

# ============================================
# 3. Create Peer Organization 2 (Org2)
# ============================================
echo -e "\n${BLUE}[3/3] Setting up Peer Organization 2 (Org2)...${NC}"

ORG2="$CRYPTO_DIR/peerOrganizations/org2.example.com"
ORG2_PEERS="$ORG2/peers"
ORG2_MSP="$ORG2/msp"
ORG2_USERS="$ORG2/users"

mkdir -p "$ORG2_PEERS/peer0.org2.example.com"
mkdir -p "$ORG2_PEERS/peer1.org2.example.com"
mkdir -p "$ORG2_MSP"
mkdir -p "$ORG2_USERS/Admin@org2.example.com"
mkdir -p "$ORG2_USERS/User1@org2.example.com"

# Generate peer certificates
generate_cert "$ORG2_PEERS/peer0.org2.example.com" "peer0.org2.example.com" "Org2"
generate_cert "$ORG2_PEERS/peer1.org2.example.com" "peer1.org2.example.com" "Org2"

# Generate admin certificate
generate_cert "$ORG2_USERS/Admin@org2.example.com" "Admin@org2.example.com" "Org2"

# Generate user certificate
generate_cert "$ORG2_USERS/User1@org2.example.com" "User1@org2.example.com" "Org2"

# Copy peer0 cert to org MSP
mkdir -p "$ORG2_MSP/signcerts"
cp "$ORG2_PEERS/peer0.org2.example.com/signcerts/cert.pem" "$ORG2_MSP/signcerts/cert.pem"

# Create config.yaml for Org2
echo "NodeOUs:" > "$ORG2_MSP/config.yaml"
echo "  Enable: false" >> "$ORG2_MSP/config.yaml"

echo -e "${GREEN}[OK]${NC} Org2 setup complete"

# ============================================
# Summary
# ============================================
echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Certificate Generation Complete!${NC}"
echo -e "${BLUE}========================================${NC}"

echo -e "\n${YELLOW}Generated Structure:${NC}"
echo "  Orderer: $ORDERER_ORG"
echo "  Org1:    $ORG1"
echo "  Org2:    $ORG2"

echo -e "\n${YELLOW}Total Entities:${NC}"
echo "  - 1 Orderer"
echo "  - 4 Peers (2x Org1, 2x Org2)"
echo "  - 4 Admins (1 per org + orderer)"
echo "  - 2 Users"

echo -e "\n${YELLOW}Next Steps:${NC}"
echo "  1. Run docker-compose to start network"
echo "  2. Create channel configuration"
echo "  3. Deploy chaincode"

echo -e "\n${GREEN}Done!${NC}\n"
