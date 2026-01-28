# Working Channel Creation Script
# Creates channel and joins all peers

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Blue
Write-Host "Creating Procurement Channel" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue

$networkDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $networkDir

$CHANNEL_NAME = "procurementchannel"

# Step 1: Generate channel creation transaction
Write-Host "`n[1/4] Generating channel creation transaction..." -ForegroundColor Yellow

docker run --rm `
    -v "${networkDir}:/work" `
    -w /work `
    hyperledger/fabric-tools:2.5 `
    configtxgen -profile ProcurementChannel -outputCreateChannelTx ./artifacts/${CHANNEL_NAME}.tx -channelID ${CHANNEL_NAME} -configPath . 2>&1 | Out-Null

if (-not (Test-Path "./artifacts/${CHANNEL_NAME}.tx")) {
    Write-Host "[ERROR] Channel transaction generation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Channel transaction generated" -ForegroundColor Green

# Step 2: Copy orderer TLS cert to artifacts for peer access
Write-Host "`n[2/4] Preparing TLS certificates..." -ForegroundColor Yellow
docker exec orderer.example.com cat /var/hyperledger/orderer/tls/ca.crt | Out-File -FilePath "./artifacts/orderer_tls_ca.crt" -Encoding ASCII -NoNewline
Write-Host "[OK] Orderer TLS cert copied" -ForegroundColor Green

# Step 2b: Create channel using peer container with Admin user MSP
Write-Host "  Creating channel..." -ForegroundColor Cyan
docker exec -e CORE_PEER_LOCALMSPID=Org1MSP `
    -e CORE_PEER_TLS_ENABLED=true `
    -e CORE_PEER_TLS_ROOTCERT_FILE=/work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt `
    -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp `
    -e CORE_PEER_ADDRESS=peer0.org1.example.com:7051 `
    peer0.org1.example.com `
    peer channel create `
        -o orderer.example.com:7050 `
        -c ${CHANNEL_NAME} `
        -f /work/artifacts/${CHANNEL_NAME}.tx `
        --tls `
        --cafile /work/artifacts/orderer_tls_ca.crt `
        --outputBlock /work/artifacts/${CHANNEL_NAME}.block `
        2>&1 | Out-Null

if (-not (Test-Path "./artifacts/${CHANNEL_NAME}.block")) {
    Write-Host "[ERROR] Channel creation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Channel created: ${CHANNEL_NAME}" -ForegroundColor Green

# Step 3: Join peers to channel
Write-Host "`n[3/4] Joining peers to channel..." -ForegroundColor Yellow

# Join peer0.org1
Write-Host "  Joining peer0.org1.example.com..." -ForegroundColor Cyan
docker exec peer0.org1.example.com peer channel join -b /work/artifacts/${CHANNEL_NAME}.block 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] peer0.org1 joined" -ForegroundColor Green
} else {
    Write-Host "  [WARN] peer0.org1 join may have failed" -ForegroundColor Yellow
}

# Join peer1.org1
Write-Host "  Joining peer1.org1.example.com..." -ForegroundColor Cyan
docker exec peer1.org1.example.com peer channel join -b /work/artifacts/${CHANNEL_NAME}.block 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] peer1.org1 joined" -ForegroundColor Green
} else {
    Write-Host "  [WARN] peer1.org1 join may have failed" -ForegroundColor Yellow
}

# Join peer0.org2
Write-Host "  Joining peer0.org2.example.com..." -ForegroundColor Cyan
docker exec peer0.org2.example.com peer channel join -b /work/artifacts/${CHANNEL_NAME}.block 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] peer0.org2 joined" -ForegroundColor Green
} else {
    Write-Host "  [WARN] peer0.org2 join may have failed" -ForegroundColor Yellow
}

# Step 4: Update anchor peers
Write-Host "`n[4/4] Updating anchor peers..." -ForegroundColor Yellow

# Generate anchor peer updates
docker run --rm `
    -v "${networkDir}:/work" `
    -w /work `
    hyperledger/fabric-tools:2.5 `
    configtxgen -profile ProcurementChannel -outputAnchorPeersUpdate ./artifacts/Org1MSPanchors.tx -channelID ${CHANNEL_NAME} -asOrg Org1MSP -configPath . 2>&1 | Out-Null

docker run --rm `
    -v "${networkDir}:/work" `
    -w /work `
    hyperledger/fabric-tools:2.5 `
    configtxgen -profile ProcurementChannel -outputAnchorPeersUpdate ./artifacts/Org2MSPanchors.tx -channelID ${CHANNEL_NAME} -asOrg Org2MSP -configPath . 2>&1 | Out-Null

# Update anchor peers (try without TLS)
Write-Host "  Updating anchor peers..." -ForegroundColor Cyan
docker exec peer0.org1.example.com peer channel update -o orderer.example.com:7050 -c ${CHANNEL_NAME} -f /work/artifacts/Org1MSPanchors.tx 2>&1 | Out-Null
docker exec peer0.org2.example.com peer channel update -o orderer.example.com:7050 -c ${CHANNEL_NAME} -f /work/artifacts/Org2MSPanchors.tx 2>&1 | Out-Null

Write-Host "`n========================================" -ForegroundColor Blue
Write-Host "Channel Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Blue

Write-Host "`nChannel Name: ${CHANNEL_NAME}" -ForegroundColor Cyan
Write-Host "`nVerifying channel..." -ForegroundColor Yellow
docker exec peer0.org1.example.com peer channel list 2>&1
