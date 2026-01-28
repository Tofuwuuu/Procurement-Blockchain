# PowerShell script to generate self-signed certificates for Hyperledger Fabric

$CRYPTO_DIR = ".\crypto-config"

Write-Host "[INFO] Generating self-signed certificates for development..." -ForegroundColor Yellow

# Function to generate cert and key
function Generate-Cert {
    param([string]$path, [string]$cn)
    
    # Create directories
    New-Item -ItemType Directory -Path "$path/signcerts" -Force | Out-Null
    New-Item -ItemType Directory -Path "$path/keystore" -Force | Out-Null
    New-Item -ItemType Directory -Path "$path/cacerts" -Force | Out-Null
    New-Item -ItemType Directory -Path "$path/tlscacerts" -Force | Out-Null
    
    # Generate private key and certificate using openssl
    & openssl genrsa -out "$path/keystore/key.pem" 2048 2>&1 | Out-Null
    & openssl req -new -x509 -key "$path/keystore/key.pem" -out "$path/signcerts/cert.pem" `
        -days 365 -subj "/CN=$cn" 2>&1 | Out-Null
    
    # Copy cert to cacerts and tlscacerts
    Copy-Item "$path/signcerts/cert.pem" "$path/cacerts/ca.pem" -Force
    Copy-Item "$path/signcerts/cert.pem" "$path/tlscacerts/tlsca.pem" -Force
    
    Write-Host "[OK] Generated certs for $cn" -ForegroundColor Green
}

# Create Orderer Organization
Write-Host "[INFO] Setting up Orderer Organization..." -ForegroundColor Yellow
$orderer_path = "$CRYPTO_DIR/ordererOrganizations/example.com/orderers/orderer.example.com"
New-Item -ItemType Directory -Path $orderer_path -Force | Out-Null
Generate-Cert $orderer_path "orderer.example.com"

$orderer_msp_path = "$CRYPTO_DIR/ordererOrganizations/example.com/msp"
New-Item -ItemType Directory -Path "$orderer_msp_path/signcerts" -Force | Out-Null
Copy-Item "$orderer_path/signcerts/cert.pem" "$orderer_msp_path/signcerts/cert.pem" -Force

# Create Org1
Write-Host "[INFO] Setting up Organization 1..." -ForegroundColor Yellow
$org1_peer0_path = "$CRYPTO_DIR/peerOrganizations/org1.example.com/peers/peer0.org1.example.com"
$org1_peer1_path = "$CRYPTO_DIR/peerOrganizations/org1.example.com/peers/peer1.org1.example.com"
New-Item -ItemType Directory -Path $org1_peer0_path -Force | Out-Null
New-Item -ItemType Directory -Path $org1_peer1_path -Force | Out-Null
Generate-Cert $org1_peer0_path "peer0.org1.example.com"
Generate-Cert $org1_peer1_path "peer1.org1.example.com"

$org1_msp_path = "$CRYPTO_DIR/peerOrganizations/org1.example.com/msp"
New-Item -ItemType Directory -Path "$org1_msp_path/signcerts" -Force | Out-Null
Copy-Item "$org1_peer0_path/signcerts/cert.pem" "$org1_msp_path/signcerts/cert.pem" -Force

# Create Org2
Write-Host "[INFO] Setting up Organization 2..." -ForegroundColor Yellow
$org2_peer0_path = "$CRYPTO_DIR/peerOrganizations/org2.example.com/peers/peer0.org2.example.com"
$org2_peer1_path = "$CRYPTO_DIR/peerOrganizations/org2.example.com/peers/peer1.org2.example.com"
New-Item -ItemType Directory -Path $org2_peer0_path -Force | Out-Null
New-Item -ItemType Directory -Path $org2_peer1_path -Force | Out-Null
Generate-Cert $org2_peer0_path "peer0.org2.example.com"
Generate-Cert $org2_peer1_path "peer1.org2.example.com"

$org2_msp_path = "$CRYPTO_DIR/peerOrganizations/org2.example.com/msp"
New-Item -ItemType Directory -Path "$org2_msp_path/signcerts" -Force | Out-Null
Copy-Item "$org2_peer0_path/signcerts/cert.pem" "$org2_msp_path/signcerts/cert.pem" -Force

# Create config.yaml files
$config_yaml = @"
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
"@

$msp_paths = @(
    "$orderer_path/msp",
    "$org1_msp_path",
    "$org1_peer0_path/msp",
    "$org1_peer1_path/msp",
    "$org2_msp_path",
    "$org2_peer0_path/msp",
    "$org2_peer1_path/msp"
)

foreach ($msp_path in $msp_paths) {
    $config_yaml | Out-File -FilePath "$msp_path/config.yaml" -Encoding UTF8 -Force
}

Write-Host "[SUCCESS] All cryptographic materials generated successfully!" -ForegroundColor Green
Write-Host "[INFO] Development certificates are ready for use." -ForegroundColor Yellow
