# Deploy Inspection Chaincode to Procurement Channel
# This script packages, installs, and commits the chaincode

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Blue
Write-Host "Deploying Inspection Chaincode" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue

$networkDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$chaincodeDir = Join-Path (Split-Path -Parent $networkDir) "chaincode"
$CHANNEL_NAME = "procurementchannel"
$CHAINCODE_NAME = "inspection"
$CHAINCODE_VERSION = "1.3"
$CHAINCODE_PATH = "inspection_contract"
$CHAINCODE_SEQUENCE = 4

Set-Location $networkDir

# Step 1: Package chaincode
Write-Host "`n[1/5] Packaging chaincode..." -ForegroundColor Yellow

docker run --rm `
    -v "${chaincodeDir}:/chaincode" `
    -v "${networkDir}:/work" `
    -w /chaincode `
    hyperledger/fabric-tools:2.5 `
    peer lifecycle chaincode package /work/artifacts/${CHAINCODE_NAME}.tar.gz --path . --lang node --label ${CHAINCODE_NAME}_${CHAINCODE_VERSION}

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Chaincode packaging failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Chaincode packaged: ${CHAINCODE_NAME}.tar.gz" -ForegroundColor Green

# Step 2: Install chaincode on all peers
Write-Host "`n[2/5] Installing chaincode on peers..." -ForegroundColor Yellow

# Install on peer0.org1 (using Admin MSP)
Write-Host "  Installing on peer0.org1.example.com..." -ForegroundColor Cyan
docker exec -e CORE_PEER_LOCALMSPID=Org1MSP `
    -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp `
    peer0.org1.example.com `
    peer lifecycle chaincode install /work/artifacts/${CHAINCODE_NAME}.tar.gz

if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] Installed on peer0.org1" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Installation on peer0.org1 failed" -ForegroundColor Yellow
}

# Install on peer1.org1 (using Admin MSP)
Write-Host "  Installing on peer1.org1.example.com..." -ForegroundColor Cyan
docker exec -e CORE_PEER_LOCALMSPID=Org1MSP `
    -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp `
    peer1.org1.example.com `
    peer lifecycle chaincode install /work/artifacts/${CHAINCODE_NAME}.tar.gz

if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] Installed on peer1.org1" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Installation on peer1.org1 failed" -ForegroundColor Yellow
}

# Install on peer0.org2 (using Admin MSP)
Write-Host "  Installing on peer0.org2.example.com..." -ForegroundColor Cyan
docker exec -e CORE_PEER_LOCALMSPID=Org2MSP `
    -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp `
    peer0.org2.example.com `
    peer lifecycle chaincode install /work/artifacts/${CHAINCODE_NAME}.tar.gz

if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] Installed on peer0.org2" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Installation on peer0.org2 failed" -ForegroundColor Yellow
}

# Step 3: Get package ID (using Admin MSP)
Write-Host "`n[3/5] Getting package ID..." -ForegroundColor Yellow
$packageIdOutput = docker exec -e CORE_PEER_LOCALMSPID=Org1MSP `
    -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp `
    peer0.org1.example.com `
    peer lifecycle chaincode queryinstalled

$packageId = ($packageIdOutput | Select-String -Pattern "${CHAINCODE_NAME}_${CHAINCODE_VERSION}" | Select-Object -First 1)
if ($packageId) {
    $packageIdStr = $packageId.ToString()
    if ($packageIdStr -match 'Package ID: ([^,]+)') {
        $PACKAGE_ID = $matches[1].Trim()
        Write-Host "[OK] Package ID: $PACKAGE_ID" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Could not extract package ID from: $packageIdStr" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[ERROR] Package ID not found in output" -ForegroundColor Red
    Write-Host "Output: $packageIdOutput" -ForegroundColor Yellow
    exit 1
}

# Step 4: Approve chaincode for Org1
Write-Host "`n[4/5] Approving chaincode..." -ForegroundColor Yellow

Write-Host "  Approving for Org1..." -ForegroundColor Cyan
docker exec -e CORE_PEER_LOCALMSPID=Org1MSP `
    -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp `
    -e CORE_PEER_TLS_ENABLED=true `
    -e CORE_PEER_TLS_ROOTCERT_FILE=/work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt `
    -e CORE_PEER_ADDRESS=peer0.org1.example.com:7051 `
    peer0.org1.example.com `
    peer lifecycle chaincode approveformyorg `
        -o orderer.example.com:7050 `
        --channelID ${CHANNEL_NAME} `
        --name ${CHAINCODE_NAME} `
        --version ${CHAINCODE_VERSION} `
        --package-id ${PACKAGE_ID} `
        --sequence ${CHAINCODE_SEQUENCE} `
        --tls `
        --cafile /work/artifacts/orderer_tls_ca.crt `
        --signature-policy "AND('Org1MSP.peer','Org2MSP.peer')"

if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] Org1 approved" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Org1 approval failed" -ForegroundColor Yellow
}

# Approve chaincode for Org2
Write-Host "  Approving for Org2..." -ForegroundColor Cyan
docker exec -e CORE_PEER_LOCALMSPID=Org2MSP `
    -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp `
    -e CORE_PEER_TLS_ENABLED=true `
    -e CORE_PEER_TLS_ROOTCERT_FILE=/work/crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt `
    -e CORE_PEER_ADDRESS=peer0.org2.example.com:9051 `
    peer0.org2.example.com `
    peer lifecycle chaincode approveformyorg `
        -o orderer.example.com:7050 `
        --channelID ${CHANNEL_NAME} `
        --name ${CHAINCODE_NAME} `
        --version ${CHAINCODE_VERSION} `
        --package-id ${PACKAGE_ID} `
        --sequence ${CHAINCODE_SEQUENCE} `
        --tls `
        --cafile /work/artifacts/orderer_tls_ca.crt `
        --signature-policy "AND('Org1MSP.peer','Org2MSP.peer')"

if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] Org2 approved" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Org2 approval failed" -ForegroundColor Yellow
}

# Step 5: Commit chaincode
Write-Host "`n[5/5] Committing chaincode..." -ForegroundColor Yellow

docker exec -e CORE_PEER_LOCALMSPID=Org1MSP `
    -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp `
    -e CORE_PEER_TLS_ENABLED=true `
    -e CORE_PEER_TLS_ROOTCERT_FILE=/work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt `
    -e CORE_PEER_ADDRESS=peer0.org1.example.com:7051 `
    peer0.org1.example.com `
    peer lifecycle chaincode commit `
        -o orderer.example.com:7050 `
        --channelID ${CHANNEL_NAME} `
        --name ${CHAINCODE_NAME} `
        --version ${CHAINCODE_VERSION} `
        --sequence ${CHAINCODE_SEQUENCE} `
        --tls `
        --cafile /work/artifacts/orderer_tls_ca.crt `
        --peerAddresses peer0.org1.example.com:7051 `
        --tlsRootCertFiles /work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt `
        --peerAddresses peer0.org2.example.com:9051 `
        --tlsRootCertFiles /work/crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt `
        --signature-policy "AND('Org1MSP.peer','Org2MSP.peer')"

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Chaincode committed to channel" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Chaincode commit failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n========================================" -ForegroundColor Blue
Write-Host "Chaincode Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Blue

Write-Host "`nChaincode Details:" -ForegroundColor Cyan
Write-Host "  Name: ${CHAINCODE_NAME}" -ForegroundColor White
Write-Host "  Version: ${CHAINCODE_VERSION}" -ForegroundColor White
Write-Host "  Channel: ${CHANNEL_NAME}" -ForegroundColor White
Write-Host "  Package ID: ${PACKAGE_ID}" -ForegroundColor White

Write-Host "`nTo test chaincode:" -ForegroundColor Yellow
Write-Host "  docker exec peer0.org1.example.com peer chaincode query -C ${CHANNEL_NAME} -n ${CHAINCODE_NAME} -c '{\"Args\":[\"getAllInspections\"]}'" -ForegroundColor White
