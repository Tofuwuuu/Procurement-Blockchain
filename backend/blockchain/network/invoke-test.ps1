$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)

$CHANNEL = "procurementchannel"
$CC = "inspection"

$items = @(
  @{
    item    = "WidgetA"
    qty     = 5
    result  = "Accepted"
    remarks = "OK"
  }
) | ConvertTo-Json -Compress

$args = @(
  "InspectionContract:recordInspection",
  "INSP001",
  "PO-1001",
  "2026-01-28T07:49:00Z",
  "Inspector A",
  "Accepted",
  $items,
  "All good"
)

$ctor = @{ Args = $args } | ConvertTo-Json -Compress

Write-Host "Invoking recordInspection..." -ForegroundColor Cyan
docker exec `
  -e CORE_PEER_LOCALMSPID=Org1MSP `
  -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp `
  -e CORE_PEER_TLS_ENABLED=true `
  -e CORE_PEER_TLS_ROOTCERT_FILE=/work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt `
  -e CORE_PEER_ADDRESS=peer0.org1.example.com:7051 `
  peer0.org1.example.com `
  sh -c "peer chaincode invoke -o orderer.example.com:7050 --tls --cafile /work/artifacts/orderer_tls_ca.crt -C $CHANNEL -n $CC --peerAddresses peer0.org1.example.com:7051 --tlsRootCertFiles /work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt --peerAddresses peer0.org2.example.com:9051 --tlsRootCertFiles /work/crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt -c '$ctor'"

Write-Host "Querying getInspection..." -ForegroundColor Cyan
$q = @{ Args = @("InspectionContract:getInspection", "INSP001") } | ConvertTo-Json -Compress
docker exec `
  -e CORE_PEER_LOCALMSPID=Org1MSP `
  -e CORE_PEER_MSPCONFIGPATH=/work/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp `
  -e CORE_PEER_TLS_ENABLED=true `
  -e CORE_PEER_TLS_ROOTCERT_FILE=/work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt `
  -e CORE_PEER_ADDRESS=peer0.org1.example.com:7051 `
  peer0.org1.example.com `
  sh -c "peer chaincode query --tls --cafile /work/artifacts/orderer_tls_ca.crt -C $CHANNEL -n $CC -c '$q'"

