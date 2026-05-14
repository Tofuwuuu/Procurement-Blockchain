# Hyperledger Fabric Network Setup Script
# This script sets up a complete Fabric network from scratch

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Blue
Write-Host "Hyperledger Fabric Network Setup" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue

$networkDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $networkDir

$fabricContainerNames = @(
    "orderer.example.com",
    "peer0.org1.example.com",
    "peer1.org1.example.com",
    "peer0.org2.example.com",
    "couchdb0",
    "couchdb1",
    "couchdb2"
)

function Invoke-DockerCli {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [switch]$Quiet
    )

    $stdoutFile = New-TemporaryFile
    $stderrFile = New-TemporaryFile

    try {
        $process = Start-Process -FilePath "docker" `
            -ArgumentList $Arguments `
            -NoNewWindow `
            -Wait `
            -PassThru `
            -RedirectStandardOutput $stdoutFile.FullName `
            -RedirectStandardError $stderrFile.FullName

        $stdout = Get-Content -Path $stdoutFile.FullName -Raw -ErrorAction SilentlyContinue
        $stderr = Get-Content -Path $stderrFile.FullName -Raw -ErrorAction SilentlyContinue

        if (-not $Quiet) {
            if (-not [string]::IsNullOrWhiteSpace($stdout)) {
                Write-Host $stdout.TrimEnd()
            }
            if (-not [string]::IsNullOrWhiteSpace($stderr)) {
                Write-Host $stderr.TrimEnd()
            }
        }

        return $process.ExitCode
    }
    finally {
        Remove-Item -Path $stdoutFile.FullName, $stderrFile.FullName -Force -ErrorAction SilentlyContinue
    }
}

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

$certificateExitCode = Invoke-DockerCli -Arguments @(
    "run", "--rm",
    "-v", "${networkDir}:/work",
    "-w", "/work",
    "hyperledger/fabric-tools:2.5",
    "cryptogen", "generate",
    "--config=./crypto-config.yaml",
    "--output=./crypto-config"
)

if ($certificateExitCode -ne 0) {
    Write-Host "[ERROR] Certificate generation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Certificates generated" -ForegroundColor Green

# Step 3: Generate genesis block
Write-Host "`n[3/5] Generating genesis block..." -ForegroundColor Yellow

$genesisExitCode = Invoke-DockerCli -Arguments @(
    "run", "--rm",
    "-v", "${networkDir}:/work",
    "-w", "/work",
    "hyperledger/fabric-tools:2.5",
    "configtxgen",
    "-profile", "OrdererGenesis",
    "-channelID", "system-channel",
    "-outputBlock", "./artifacts/genesis.block",
    "-configPath", "."
)

if ($genesisExitCode -ne 0) {
    Write-Host "[ERROR] Genesis block generation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Genesis block generated" -ForegroundColor Green

# Step 4: Stop any existing containers
Write-Host "`n[4/5] Stopping existing containers..." -ForegroundColor Yellow
$composeDownExitCode = Invoke-DockerCli -Arguments @("compose", "-f", "docker-compose-fabric.yml", "down", "-v") -Quiet
if ($composeDownExitCode -ne 0) {
    Write-Host "[ERROR] Failed to stop existing containers!" -ForegroundColor Red
    exit 1
}
foreach ($containerName in $fabricContainerNames) {
    $containerExistsExitCode = Invoke-DockerCli -Arguments @("container", "inspect", $containerName) -Quiet
    if ($containerExistsExitCode -eq 0) {
        $containerRemoveExitCode = Invoke-DockerCli -Arguments @("rm", "-f", "-v", $containerName) -Quiet
        if ($containerRemoveExitCode -ne 0) {
            Write-Host "[ERROR] Failed to remove leftover container: $containerName" -ForegroundColor Red
            exit 1
        }
    }
}
Write-Host "[OK] Containers stopped" -ForegroundColor Green

# Step 5: Start the network
Write-Host "`n[5/5] Starting Fabric network..." -ForegroundColor Yellow
$composeUpExitCode = Invoke-DockerCli -Arguments @("compose", "-f", "docker-compose-fabric.yml", "up", "-d")

if ($composeUpExitCode -ne 0) {
    Write-Host "[ERROR] Failed to start containers!" -ForegroundColor Red
    exit 1
}

Write-Host "`n========================================" -ForegroundColor Blue
Write-Host "Network Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Blue

Write-Host "`nWaiting for containers to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "`nContainer Status:" -ForegroundColor Cyan
$composePsExitCode = Invoke-DockerCli -Arguments @("compose", "-f", "docker-compose-fabric.yml", "ps")
if ($composePsExitCode -ne 0) {
    Write-Host "[WARN] Failed to read container status." -ForegroundColor Yellow
}

Write-Host "`nTo check logs:" -ForegroundColor Yellow
Write-Host "  docker logs orderer.example.com" -ForegroundColor White
Write-Host "  docker logs peer0.org1.example.com" -ForegroundColor White
Write-Host "  docker logs peer0.org2.example.com" -ForegroundColor White

Write-Host "`nTo stop the network:" -ForegroundColor Yellow
Write-Host "  docker compose -f docker-compose-fabric.yml down" -ForegroundColor White
