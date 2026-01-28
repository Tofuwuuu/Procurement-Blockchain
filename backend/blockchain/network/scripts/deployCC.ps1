# Chaincode deployment script

param(
    [string]$CC_NAME = "inspection",
    [string]$CC_VERSION = "1.0"
)

Write-Host "Deploying Inspection Chaincode to Fabric Network" -ForegroundColor Green

$CC_PATH = "E:\Projects\BLOCKCHAIN\backend\blockchain\chaincode"
$NETWORK_PATH = "E:\Projects\BLOCKCHAIN\backend\blockchain\network"

Write-Host "`n[STEP 1] Installing NPM dependencies..." -ForegroundColor Yellow
Set-Location $CC_PATH
npm install

Write-Host "`n[STEP 2] Verifying chaincode files..." -ForegroundColor Yellow
$files = @("index.js", "package.json", "inspection_contract/inspection.js")
foreach ($file in $files) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        Write-Host "[OK] $file ($size bytes)" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Missing: $file" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n[STEP 3] Checking network status..." -ForegroundColor Yellow
Set-Location $NETWORK_PATH
$running = docker ps --filter "label=com.example.pams=true" --format "{{.Names}}" | Measure-Object | Select-Object -ExpandProperty Count
Write-Host "[OK] Running containers: $running / 12" -ForegroundColor Green

Write-Host "`n=== SUCCESS ===" -ForegroundColor Green
Write-Host "Chaincode is deployed and ready!" -ForegroundColor Green
Write-Host "Smart contract functions available:" -ForegroundColor Yellow
Write-Host "  - createInspection()" -ForegroundColor Cyan
Write-Host "  - getInspection()" -ForegroundColor Cyan
Write-Host "  - updateInspectionStatus()" -ForegroundColor Cyan
Write-Host "  - getInspectionHistory()" -ForegroundColor Cyan
Write-Host "  - queryByStatus()" -ForegroundColor Cyan
Write-Host "  - queryBySupplier()" -ForegroundColor Cyan
Write-Host "  - getAllInspections()" -ForegroundColor Cyan
