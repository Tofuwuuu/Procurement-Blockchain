# Complete Blockchain Setup Script
# Creates channel, joins peers, and deploys chaincode

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Blue
Write-Host "Complete Blockchain Setup" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue

$networkDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $networkDir

$CHANNEL_NAME = "procurementchannel"
$CHAINCODE_NAME = "inspection"
$CHAINCODE_VERSION = "1.0"

# Ensure orderer TLS cert is available
Write-Host "`n[0/6] Preparing TLS certificates..." -ForegroundColor Yellow
docker exec orderer.example.com cat /var/hyperledger/orderer/tls/ca.crt | docker exec -i peer0.org1.example.com sh -c "cat > /work/artifacts/orderer_tls_ca.crt" 2>&1 | Out-Null
docker exec orderer.example.com cat /var/hyperledger/orderer/tls/ca.crt | docker exec -i peer0.org2.example.com sh -c "cat > /work/artifacts/orderer_tls_ca.crt" 2>&1 | Out-Null
Write-Host "[OK] TLS certificates prepared" -ForegroundColor Green

# Step 1: Generate channel transaction
Write-Host "`n[1/6] Generating channel transaction..." -ForegroundColor Yellow
docker run --rm -v "${networkDir}:/work" -w /work hyperledger/fabric-tools:2.5 `
    configtxgen -profile ProcurementChannel -outputCreateChannelTx ./artifacts/${CHANNEL_NAME}.tx -channelID ${CHANNEL_NAME} -configPath . 2>&1 | Out-Null
Write-Host "[OK] Channel transaction generated" -ForegroundColor Green

# Step 2: Create channel
Write-Host "`n[2/6] Creating channel..." -ForegroundColor Yellow
docker exec -e CORE_PEER_LOCALMSPID=Org1MSP `
    -e CORE_PEER_TLS_ENABLED=true `
    -e CORE_PEER_TLS_ROOTCERT_FILE=/work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt `
    -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp `
    -e CORE_PEER_ADDRESS=peer0.org1.example.com:7051 `
    peer0.org1.example.com `
    peer channel create -o orderer.example.com:7050 -c ${CHANNEL_NAME} -f /work/artifacts/${CHANNEL_NAME}.tx --tls --cafile /work/artifacts/orderer_tls_ca.crt --outputBlock /work/artifacts/${CHANNEL_NAME}.block 2>&1 | Out-Null

if (Test-Path "./artifacts/${CHANNEL_NAME}.block") {
    Write-Host "[OK] Channel created" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Channel creation failed!" -ForegroundColor Red
    exit 1
}

# Step 3: Join peers
Write-Host "`n[3/6] Joining peers to channel..." -ForegroundColor Yellow
. .\join-channel.ps1

# Step 4: Package chaincode
Write-Host "`n[4/6] Packaging chaincode..." -ForegroundColor Yellow
$chaincodeDir = Join-Path (Split-Path -Parent $networkDir) "chaincode"
docker run --rm -v "${chaincodeDir}:/chaincode" -v "${networkDir}:/work" -w /chaincode `
    hyperledger/fabric-tools:2.5 `
    peer lifecycle chaincode package /work/artifacts/${CHAINCODE_NAME}.tar.gz --path . --lang node --label ${CHAINCODE_NAME}_${CHAINCODE_VERSION} 2>&1 | Out-Null
Write-Host "[OK] Chaincode packaged" -ForegroundColor Green

# Step 5: Install chaincode (already done, skip if exists)
Write-Host "`n[5/6] Installing chaincode..." -ForegroundColor Yellow
$packageIdOutput = docker exec -e CORE_PEER_LOCALMSPID=Org1MSP `
    -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp `
    peer0.org1.example.com `
    peer lifecycle chaincode queryinstalled 2>&1

$packageId = ($packageIdOutput | Select-String -Pattern "${CHAINCODE_NAME}_${CHAINCODE_VERSION}")
if (-not $packageId) {
    Write-Host "  Installing on peers..." -ForegroundColor Cyan
    docker exec -e CORE_PEER_LOCALMSPID=Org1MSP -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp peer0.org1.example.com peer lifecycle chaincode install /work/artifacts/${CHAINCODE_NAME}.tar.gz 2>&1 | Out-Null
    docker exec -e CORE_PEER_LOCALMSPID=Org1MSP -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp peer1.org1.example.com peer lifecycle chaincode install /work/artifacts/${CHAINCODE_NAME}.tar.gz 2>&1 | Out-Null
    docker exec -e CORE_PEER_LOCALMSPID=Org2MSP -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp peer0.org2.example.com peer lifecycle chaincode install /work/artifacts/${CHAINCODE_NAME}.tar.gz 2>&1 | Out-Null
    Write-Host "[OK] Chaincode installed" -ForegroundColor Green
} else {
    Write-Host "[OK] Chaincode already installed" -ForegroundColor Green
}

# Get package ID
$packageIdOutput = docker exec -e CORE_PEER_LOCALMSPID=Org1MSP -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp peer0.org1.example.com peer lifecycle chaincode queryinstalled 2>&1
$packageId = ($packageIdOutput | Select-String -Pattern "${CHAINCODE_NAME}_${CHAINCODE_VERSION}").ToString()
if ($packageId -match 'Package ID: ([^,]+)') {
    $PACKAGE_ID = $matches[1].Trim()
} else {
    Write-Host "[ERROR] Could not get package ID" -ForegroundColor Red
    exit 1
}

# Step 6: Approve and commit
Write-Host "`n[6/6] Approving and committing chaincode..." -ForegroundColor Yellow

# Approve Org1
Write-Host "  Approving for Org1..." -ForegroundColor Cyan
docker exec -e CORE_PEER_LOCALMSPID=Org1MSP `
    -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp `
    -e CORE_PEER_TLS_ENABLED=true `
    -e CORE_PEER_TLS_ROOTCERT_FILE=/work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt `
    -e CORE_PEER_ADDRESS=peer0.org1.example.com:7051 `
    peer0.org1.example.com `
    peer lifecycle chaincode approveformyorg -o orderer.example.com:7050 --channelID ${CHANNEL_NAME} --name ${CHAINCODE_NAME} --version ${CHAINCODE_VERSION} --package-id ${PACKAGE_ID} --sequence 1 --tls --cafile /work/artifacts/orderer_tls_ca.crt --signature-policy "AND('Org1MSP.peer','Org2MSP.peer')" 2>&1 | Out-Null

# Approve Org2
Write-Host "  Approving for Org2..." -ForegroundColor Cyan
docker exec -e CORE_PEER_LOCALMSPID=Org2MSP `
    -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp `
    -e CORE_PEER_TLS_ENABLED=true `
    -e CORE_PEER_TLS_ROOTCERT_FILE=/work/crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt `
    -e CORE_PEER_ADDRESS=peer0.org2.example.com:9051 `
    peer0.org2.example.com `
    peer lifecycle chaincode approveformyorg -o orderer.example.com:7050 --channelID ${CHANNEL_NAME} --name ${CHAINCODE_NAME} --version ${CHAINCODE_VERSION} --package-id ${PACKAGE_ID} --sequence 1 --tls --cafile /work/artifacts/orderer_tls_ca.crt --signature-policy "AND('Org1MSP.peer','Org2MSP.peer')" 2>&1 | Out-Null

# Commit
Write-Host "  Committing chaincode..." -ForegroundColor Cyan
docker exec -e CORE_PEER_LOCALMSPID=Org1MSP `
    -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp `
    -e CORE_PEER_TLS_ENABLED=true `
    -e CORE_PEER_TLS_ROOTCERT_FILE=/work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt `
    -e CORE_PEER_ADDRESS=peer0.org1.example.com:7051 `
    peer0.org1.example.com `
    peer lifecycle chaincode commit -o orderer.example.com:7050 --channelID ${CHANNEL_NAME} --name ${CHAINCODE_NAME} --version ${CHAINCODE_VERSION} --sequence 1 --tls --cafile /work/artifacts/orderer_tls_ca.crt --peerAddresses peer0.org1.example.com:7051 --tlsRootCertFiles /work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt --peerAddresses peer0.org2.example.com:9051 --tlsRootCertFiles /work/crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt --signature-policy "AND('Org1MSP.peer','Org2MSP.peer')" 2>&1 | Out-Null

Write-Host "[OK] Chaincode deployed" -ForegroundColor Green

Write-Host "`n========================================" -ForegroundColor Blue
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Blue
Write-Host "`nChannel: ${CHANNEL_NAME}" -ForegroundColor Cyan
Write-Host "Chaincode: ${CHAINCODE_NAME} v${CHAINCODE_VERSION}" -ForegroundColor Cyan
Write-Host "`nTesting chaincode..." -ForegroundColor Yellow
docker exec -e CORE_PEER_LOCALMSPID=Org1MSP -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp -e CORE_PEER_TLS_ENABLED=true -e CORE_PEER_TLS_ROOTCERT_FILE=/work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt -e CORE_PEER_ADDRESS=peer0.org1.example.com:7051 peer0.org1.example.com peer chaincode query -C ${CHANNEL_NAME} -n ${CHAINCODE_NAME} -c '{\"Args\":[\"getAllInspections\"]}' --tls --cafile /work/artifacts/orderer_tls_ca.crt 2>&1 | Select-Object -Last 3
