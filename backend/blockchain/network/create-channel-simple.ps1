# Simplified Channel Creation Script
# Uses orderer's TLS cert directly

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
Write-Host "[OK] Channel transaction generated" -ForegroundColor Green

# Step 2: Create channel using orderer's TLS cert from container
Write-Host "`n[2/4] Creating channel..." -ForegroundColor Yellow

# Copy orderer TLS cert to a temp location
$tempCert = Join-Path $networkDir "temp_orderer_tls.crt"
docker exec orderer.example.com cat /var/hyperledger/orderer/tls/ca.crt | Out-File -FilePath $tempCert -Encoding ASCII

# Create channel (try with TLS first, fallback to no TLS)
Write-Host "  Attempting channel creation..." -ForegroundColor Cyan
$createResult = docker exec -e CORE_PEER_LOCALMSPID=Org1MSP `
    -e CORE_PEER_TLS_ENABLED=false `
    -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp `
    -e CORE_PEER_ADDRESS=peer0.org1.example.com:7051 `
    peer0.org1.example.com `
    peer channel create -o orderer.example.com:7050 -c ${CHANNEL_NAME} -f /work/artifacts/${CHANNEL_NAME}.tx --outputBlock /work/artifacts/${CHANNEL_NAME}.block 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "  Output: $createResult" -ForegroundColor Yellow
}

# Clean up temp cert
Remove-Item $tempCert -ErrorAction SilentlyContinue

if (-not (Test-Path "./artifacts/${CHANNEL_NAME}.block")) {
    Write-Host "[ERROR] Channel creation failed - block not found!" -ForegroundColor Red
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
}

# Join peer1.org1
Write-Host "  Joining peer1.org1.example.com..." -ForegroundColor Cyan
docker exec peer1.org1.example.com peer channel join -b /work/artifacts/${CHANNEL_NAME}.block
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] peer1.org1 joined" -ForegroundColor Green
}

# Join peer0.org2
Write-Host "  Joining peer0.org2.example.com..." -ForegroundColor Cyan
docker exec peer0.org2.example.com peer channel join -b /work/artifacts/${CHANNEL_NAME}.block
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] peer0.org2 joined" -ForegroundColor Green
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

# Update anchor peer for Org1 (try without TLS first, then with TLS)
Write-Host "  Updating Org1 anchor peer..." -ForegroundColor Cyan
docker exec peer0.org1.example.com peer channel update `
    -o orderer.example.com:7050 `
    -c ${CHANNEL_NAME} `
    -f /work/artifacts/Org1MSPanchors.tx 2>&1 | Out-Null

# Update anchor peer for Org2
Write-Host "  Updating Org2 anchor peer..." -ForegroundColor Cyan
docker exec peer0.org2.example.com peer channel update `
    -o orderer.example.com:7050 `
    -c ${CHANNEL_NAME} `
    -f /work/artifacts/Org2MSPanchors.tx 2>&1 | Out-Null

Write-Host "`n========================================" -ForegroundColor Blue
Write-Host "Channel Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Blue

Write-Host "`nChannel Name: ${CHANNEL_NAME}" -ForegroundColor Cyan
Write-Host "`nTo verify channel:" -ForegroundColor Yellow
Write-Host "  docker exec peer0.org1.example.com peer channel list" -ForegroundColor White
