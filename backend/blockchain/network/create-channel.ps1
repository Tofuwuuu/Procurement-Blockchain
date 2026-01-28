# Create and Join Procurement Channel
# This script creates the procurement channel and joins all peers to it

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Blue
Write-Host "Creating Procurement Channel" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue

$networkDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $networkDir

$CHANNEL_NAME = "procurementchannel"
$CHANNEL_TX = "./artifacts/${CHANNEL_NAME}.tx"

# Step 1: Generate channel creation transaction
Write-Host "`n[1/4] Generating channel creation transaction..." -ForegroundColor Yellow

docker run --rm `
    -v "${networkDir}:/work" `
    -w /work `
    hyperledger/fabric-tools:2.5 `
    configtxgen -profile ProcurementChannel -outputCreateChannelTx ./artifacts/${CHANNEL_NAME}.tx -channelID ${CHANNEL_NAME} -configPath .

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Channel transaction generation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Channel transaction generated: ${CHANNEL_TX}" -ForegroundColor Green

# Step 2: Create channel (using peer0.org1 as creator)
Write-Host "`n[2/4] Creating channel..." -ForegroundColor Yellow

$env:CORE_PEER_LOCALMSPID = "Org1MSP"
$env:CORE_PEER_TLS_ENABLED = "true"
$env:CORE_PEER_TLS_ROOTCERT_FILE = "/work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
$env:CORE_PEER_MSPCONFIGPATH = "/work/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"
$env:CORE_PEER_ADDRESS = "peer0.org1.example.com:7051"

# Use the TLS cert from orderer's TLS directory (mounted in container)
docker exec peer0.org1.example.com peer channel create `
    -o orderer.example.com:7050 `
    -c ${CHANNEL_NAME} `
    -f /work/artifacts/${CHANNEL_NAME}.tx `
    --tls `
    --cafile /work/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt `
    --outputBlock /work/artifacts/${CHANNEL_NAME}.block

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Channel creation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Channel created: ${CHANNEL_NAME}" -ForegroundColor Green

# Step 3: Join peers to channel
Write-Host "`n[3/4] Joining peers to channel..." -ForegroundColor Yellow

# Join peer0.org1
Write-Host "  Joining peer0.org1.example.com..." -ForegroundColor Cyan
docker exec peer0.org1.example.com peer channel join -b /work/artifacts/${CHANNEL_NAME}.block
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] peer0.org1 joined" -ForegroundColor Green
} else {
    Write-Host "  [WARN] peer0.org1 join failed" -ForegroundColor Yellow
}

# Join peer1.org1
Write-Host "  Joining peer1.org1.example.com..." -ForegroundColor Cyan
docker exec peer1.org1.example.com peer channel join -b /work/artifacts/${CHANNEL_NAME}.block
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] peer1.org1 joined" -ForegroundColor Green
} else {
    Write-Host "  [WARN] peer1.org1 join failed" -ForegroundColor Yellow
}

# Join peer0.org2
Write-Host "  Joining peer0.org2.example.com..." -ForegroundColor Cyan
docker exec peer0.org2.example.com peer channel join -b /work/artifacts/${CHANNEL_NAME}.block
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] peer0.org2 joined" -ForegroundColor Green
} else {
    Write-Host "  [WARN] peer0.org2 join failed" -ForegroundColor Yellow
}

# Step 4: Update anchor peers
Write-Host "`n[4/4] Updating anchor peers..." -ForegroundColor Yellow

# Generate anchor peer updates
docker run --rm `
    -v "${networkDir}:/work" `
    -w /work `
    hyperledger/fabric-tools:2.5 `
    configtxgen -profile ProcurementChannel -outputAnchorPeersUpdate ./artifacts/Org1MSPanchors.tx -channelID ${CHANNEL_NAME} -asOrg Org1MSP -configPath .

docker run --rm `
    -v "${networkDir}:/work" `
    -w /work `
    hyperledger/fabric-tools:2.5 `
    configtxgen -profile ProcurementChannel -outputAnchorPeersUpdate ./artifacts/Org2MSPanchors.tx -channelID ${CHANNEL_NAME} -asOrg Org2MSP -configPath .

# Update anchor peer for Org1
Write-Host "  Updating Org1 anchor peer..." -ForegroundColor Cyan
# Update anchor peer for Org1
Write-Host "  Updating Org1 anchor peer..." -ForegroundColor Cyan
docker exec peer0.org1.example.com peer channel update `
    -o orderer.example.com:7050 `
    -c ${CHANNEL_NAME} `
    -f /work/artifacts/Org1MSPanchors.tx `
    --tls `
    --cafile /work/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt

# Update anchor peer for Org2
Write-Host "  Updating Org2 anchor peer..." -ForegroundColor Cyan
docker exec peer0.org2.example.com peer channel update `
    -o orderer.example.com:7050 `
    -c ${CHANNEL_NAME} `
    -f /work/artifacts/Org2MSPanchors.tx `
    --tls `
    --cafile /work/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt

Write-Host "`n========================================" -ForegroundColor Blue
Write-Host "Channel Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Blue

Write-Host "`nChannel Name: ${CHANNEL_NAME}" -ForegroundColor Cyan
Write-Host "`nTo verify channel:" -ForegroundColor Yellow
Write-Host "  docker exec peer0.org1.example.com peer channel list" -ForegroundColor White
Write-Host "  docker exec peer0.org2.example.com peer channel list" -ForegroundColor White
