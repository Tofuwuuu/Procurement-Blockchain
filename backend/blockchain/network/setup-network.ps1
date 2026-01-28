# Hyperledger Fabric Network Setup Script
# This script sets up a complete Fabric network from scratch

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Blue
Write-Host "Hyperledger Fabric Network Setup" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue

$networkDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $networkDir

# Step 1: Clean up old files
Write-Host "`n[1/5] Cleaning up old files..." -ForegroundColor Yellow
if (Test-Path "crypto-config") {
    Remove-Item -Path "crypto-config" -Recurse -Force
    Write-Host "[OK] Removed old crypto-config" -ForegroundColor Green
}
if (Test-Path "artifacts") {
    Remove-Item -Path "artifacts" -Recurse -Force
    Write-Host "[OK] Removed old artifacts" -ForegroundColor Green
}
New-Item -ItemType Directory -Path "artifacts" -Force | Out-Null

# Step 2: Generate certificates using Docker cryptogen
Write-Host "`n[2/5] Generating certificates..." -ForegroundColor Yellow
Write-Host "Using Docker to run cryptogen..." -ForegroundColor Cyan

$cryptoConfigYaml = Join-Path $networkDir "crypto-config.yaml"
if (-not (Test-Path $cryptoConfigYaml)) {
    Write-Host "[ERROR] crypto-config.yaml not found!" -ForegroundColor Red
    exit 1
}

docker run --rm `
    -v "${networkDir}:/work" `
    -w /work `
    hyperledger/fabric-tools:2.5 `
    cryptogen generate --config=./crypto-config.yaml --output=./crypto-config

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Certificate generation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Certificates generated" -ForegroundColor Green

# Step 3: Generate genesis block
Write-Host "`n[3/5] Generating genesis block..." -ForegroundColor Yellow

docker run --rm `
    -v "${networkDir}:/work" `
    -w /work `
    hyperledger/fabric-tools:2.5 `
    configtxgen -profile OrdererGenesis -channelID system-channel -outputBlock ./artifacts/genesis.block -configPath .

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Genesis block generation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Genesis block generated" -ForegroundColor Green

# Step 4: Stop any existing containers
Write-Host "`n[4/5] Stopping existing containers..." -ForegroundColor Yellow
docker-compose -f docker-compose-fabric.yml down -v 2>&1 | Out-Null
Write-Host "[OK] Containers stopped" -ForegroundColor Green

# Step 5: Start the network
Write-Host "`n[5/5] Starting Fabric network..." -ForegroundColor Yellow
docker-compose -f docker-compose-fabric.yml up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to start containers!" -ForegroundColor Red
    exit 1
}

Write-Host "`n========================================" -ForegroundColor Blue
Write-Host "Network Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Blue

Write-Host "`nWaiting for containers to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "`nContainer Status:" -ForegroundColor Cyan
docker-compose -f docker-compose-fabric.yml ps

Write-Host "`nTo check logs:" -ForegroundColor Yellow
Write-Host "  docker logs orderer.example.com" -ForegroundColor White
Write-Host "  docker logs peer0.org1.example.com" -ForegroundColor White
Write-Host "  docker logs peer0.org2.example.com" -ForegroundColor White

Write-Host "`nTo stop the network:" -ForegroundColor Yellow
Write-Host "  docker-compose -f docker-compose-fabric.yml down" -ForegroundColor White
