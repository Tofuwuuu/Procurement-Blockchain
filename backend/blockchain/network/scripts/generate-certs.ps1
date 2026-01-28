# Hyperledger Fabric Certificate Generation Script (PowerShell)
# Generates self-signed certificates for Orderer and Peers
# For development/testing purposes only

param(
    [string]$CryptoDir = "./crypto-config",
    [int]$DaysValid = 365
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Blue
Write-Host "Hyperledger Fabric Certificate Generator" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue

# Function to generate certificate and key
function Generate-Cert {
    param(
        [string]$Path,
        [string]$CN,
        [string]$Org
    )
    
    Write-Host "[INFO] Generating certificate for $CN..." -ForegroundColor Yellow
    
    # Create directories
    New-Item -ItemType Directory -Path "$Path/signcerts" -Force | Out-Null
    New-Item -ItemType Directory -Path "$Path/keystore" -Force | Out-Null
    New-Item -ItemType Directory -Path "$Path/cacerts" -Force | Out-Null
    New-Item -ItemType Directory -Path "$Path/tlscacerts" -Force | Out-Null
    
    # Generate private key using openssl
    & openssl ecparam -name prime256v1 -genkey -noout -out "$Path/keystore/key.pem" 2>&1 | Out-Null
    
    # Generate self-signed certificate
    & openssl req -new -x509 `
        -key "$Path/keystore/key.pem" `
        -out "$Path/signcerts/cert.pem" `
        -days $DaysValid `
        -subj "/C=PH/ST=NCR/L=Manila/O=$Org/CN=$CN" 2>&1 | Out-Null
    
    # Copy cert to cacerts and tlscacerts
    Copy-Item "$Path/signcerts/cert.pem" "$Path/cacerts/ca.pem" -Force
    Copy-Item "$Path/signcerts/cert.pem" "$Path/tlscacerts/tlsca.pem" -Force
    
    Write-Host "[OK] Generated certs for $CN" -ForegroundColor Green
}

# Clean up previous certs
if (Test-Path $CryptoDir) {
    Write-Host "[INFO] Cleaning up existing crypto-config..." -ForegroundColor Yellow
    Remove-Item -Path $CryptoDir -Recurse -Force
}

New-Item -ItemType Directory -Path $CryptoDir -Force | Out-Null

# ============================================
# 1. Create Orderer Organization
# ============================================
Write-Host "`n[1/3] Setting up Orderer Organization..." -ForegroundColor Blue

$OrdererOrg = "$CryptoDir/ordererOrganizations/example.com"
$OrdererOrderers = "$OrdererOrg/orderers"
$OrdererMSP = "$OrdererOrg/msp"

New-Item -ItemType Directory -Path "$OrdererOrderers/orderer.example.com" -Force | Out-Null
New-Item -ItemType Directory -Path $OrdererMSP -Force | Out-Null

Generate-Cert "$OrdererOrderers/orderer.example.com" "orderer.example.com" "OrdererOrg"

New-Item -ItemType Directory -Path "$OrdererMSP/signcerts" -Force | Out-Null
Copy-Item "$OrdererOrderers/orderer.example.com/signcerts/cert.pem" "$OrdererMSP/signcerts/cert.pem" -Force

@"
NodeOUs:
  Enable: false
"@ | Set-Content "$OrdererMSP/config.yaml"

Write-Host "[OK] Orderer Organization setup complete" -ForegroundColor Green

# ============================================
# 2. Create Peer Organization 1 (Org1)
# ============================================
Write-Host "`n[2/3] Setting up Peer Organization 1 (Org1)..." -ForegroundColor Blue

$Org1 = "$CryptoDir/peerOrganizations/org1.example.com"
$Org1Peers = "$Org1/peers"
$Org1MSP = "$Org1/msp"
$Org1Users = "$Org1/users"

New-Item -ItemType Directory -Path "$Org1Peers/peer0.org1.example.com" -Force | Out-Null
New-Item -ItemType Directory -Path "$Org1Peers/peer1.org1.example.com" -Force | Out-Null
New-Item -ItemType Directory -Path $Org1MSP -Force | Out-Null
New-Item -ItemType Directory -Path "$Org1Users/Admin@org1.example.com" -Force | Out-Null
New-Item -ItemType Directory -Path "$Org1Users/User1@org1.example.com" -Force | Out-Null

Generate-Cert "$Org1Peers/peer0.org1.example.com" "peer0.org1.example.com" "Org1"
Generate-Cert "$Org1Peers/peer1.org1.example.com" "peer1.org1.example.com" "Org1"
Generate-Cert "$Org1Users/Admin@org1.example.com" "Admin@org1.example.com" "Org1"
Generate-Cert "$Org1Users/User1@org1.example.com" "User1@org1.example.com" "Org1"

New-Item -ItemType Directory -Path "$Org1MSP/signcerts" -Force | Out-Null
Copy-Item "$Org1Peers/peer0.org1.example.com/signcerts/cert.pem" "$Org1MSP/signcerts/cert.pem" -Force

@"
NodeOUs:
  Enable: false
"@ | Set-Content "$Org1MSP/config.yaml"

Write-Host "[OK] Org1 setup complete" -ForegroundColor Green

# ============================================
# 3. Create Peer Organization 2 (Org2)
# ============================================
Write-Host "`n[3/3] Setting up Peer Organization 2 (Org2)..." -ForegroundColor Blue

$Org2 = "$CryptoDir/peerOrganizations/org2.example.com"
$Org2Peers = "$Org2/peers"
$Org2MSP = "$Org2/msp"
$Org2Users = "$Org2/users"

New-Item -ItemType Directory -Path "$Org2Peers/peer0.org2.example.com" -Force | Out-Null
New-Item -ItemType Directory -Path "$Org2Peers/peer1.org2.example.com" -Force | Out-Null
New-Item -ItemType Directory -Path $Org2MSP -Force | Out-Null
New-Item -ItemType Directory -Path "$Org2Users/Admin@org2.example.com" -Force | Out-Null
New-Item -ItemType Directory -Path "$Org2Users/User1@org2.example.com" -Force | Out-Null

Generate-Cert "$Org2Peers/peer0.org2.example.com" "peer0.org2.example.com" "Org2"
Generate-Cert "$Org2Peers/peer1.org2.example.com" "peer1.org2.example.com" "Org2"
Generate-Cert "$Org2Users/Admin@org2.example.com" "Admin@org2.example.com" "Org2"
Generate-Cert "$Org2Users/User1@org2.example.com" "User1@org2.example.com" "Org2"

New-Item -ItemType Directory -Path "$Org2MSP/signcerts" -Force | Out-Null
Copy-Item "$Org2Peers/peer0.org2.example.com/signcerts/cert.pem" "$Org2MSP/signcerts/cert.pem" -Force

@"
NodeOUs:
  Enable: false
"@ | Set-Content "$Org2MSP/config.yaml"

Write-Host "[OK] Org2 setup complete" -ForegroundColor Green

# ============================================
# Summary
# ============================================
Write-Host "`n========================================" -ForegroundColor Blue
Write-Host "Certificate Generation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Blue

Write-Host "`nGenerated Structure:" -ForegroundColor Yellow
Write-Host "  Orderer: $OrdererOrg"
Write-Host "  Org1:    $Org1"
Write-Host "  Org2:    $Org2"

Write-Host "`nTotal Entities:" -ForegroundColor Yellow
Write-Host "  - 1 Orderer"
Write-Host "  - 4 Peers (2x Org1, 2x Org2)"
Write-Host "  - 4 Admins (1 per org and orderer)"
Write-Host "  - 2 Users"

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "  1. Run docker-compose to start network"
Write-Host "  2. Create channel configuration"
Write-Host "  3. Deploy chaincode"

Write-Host "`nDone!`n" -ForegroundColor Green
