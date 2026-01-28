# Join Peers to Procurement Channel
# Uses Admin MSP for proper authorization

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Blue
Write-Host "Joining Peers to Procurement Channel" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue

$networkDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $networkDir

$CHANNEL_NAME = "procurementchannel"

if (-not (Test-Path "./artifacts/${CHANNEL_NAME}.block")) {
    Write-Host "[ERROR] Channel block not found! Run create-channel script first." -ForegroundColor Red
    exit 1
}

# Join peer0.org1
Write-Host "`n[1/3] Joining peer0.org1.example.com..." -ForegroundColor Yellow
docker exec -e CORE_PEER_LOCALMSPID=Org1MSP `
    -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp `
    -e CORE_PEER_TLS_ENABLED=true `
    -e CORE_PEER_TLS_ROOTCERT_FILE=/work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt `
    -e CORE_PEER_ADDRESS=peer0.org1.example.com:7051 `
    peer0.org1.example.com `
    peer channel join -b /work/artifacts/${CHANNEL_NAME}.block

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] peer0.org1 joined" -ForegroundColor Green
} else {
    Write-Host "[WARN] peer0.org1 join failed" -ForegroundColor Yellow
}

# Join peer1.org1
Write-Host "`n[2/3] Joining peer1.org1.example.com..." -ForegroundColor Yellow
docker exec -e CORE_PEER_LOCALMSPID=Org1MSP `
    -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp `
    -e CORE_PEER_TLS_ENABLED=true `
    -e CORE_PEER_TLS_ROOTCERT_FILE=/work/crypto-config/peerOrganizations/org1.example.com/peers/peer1.org1.example.com/tls/ca.crt `
    -e CORE_PEER_ADDRESS=peer1.org1.example.com:8051 `
    peer1.org1.example.com `
    peer channel join -b /work/artifacts/${CHANNEL_NAME}.block

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] peer1.org1 joined" -ForegroundColor Green
} else {
    Write-Host "[WARN] peer1.org1 join failed" -ForegroundColor Yellow
}

# Join peer0.org2
Write-Host "`n[3/3] Joining peer0.org2.example.com..." -ForegroundColor Yellow
docker exec -e CORE_PEER_LOCALMSPID=Org2MSP `
    -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp `
    -e CORE_PEER_TLS_ENABLED=true `
    -e CORE_PEER_TLS_ROOTCERT_FILE=/work/crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt `
    -e CORE_PEER_ADDRESS=peer0.org2.example.com:9051 `
    peer0.org2.example.com `
    peer channel join -b /work/artifacts/${CHANNEL_NAME}.block

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] peer0.org2 joined" -ForegroundColor Green
} else {
    Write-Host "[WARN] peer0.org2 join failed" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Blue
Write-Host "Channel Join Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Blue

Write-Host "`nVerifying channel membership..." -ForegroundColor Yellow
docker exec -e CORE_PEER_LOCALMSPID=Org1MSP `
    -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp `
    peer0.org1.example.com `
    peer channel list
