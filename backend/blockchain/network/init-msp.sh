#!/bin/bash

CERT="-----BEGIN CERTIFICATE-----
MIICHjCCAhWgAwIBAgIUBmyfj9ej7Ewd8sVy8eIE0GmqB7swCgYIKoZIzj0EAwIw
YzELMAkGA1UEBhMCVVMxEzARBgNVBAgMCldhc2hpbmd0b24xEDAOBgNVBAcMB1Nl
YXR0bGUxDDAKBgNVBAoMA1N0ZTEcMBoGA1UEAwwTY2Eub3JnMS5leGFtcGxlLmNv
bTAeFw0yNjAxMjcwNDMwMDBaFw0yNzAxMjcwNDMwMDBaMHMxCzAJBgNVBAYTAlVT
MRMwEQYDVQQIDApXYXNoaW5ndG9uMRAwDgYDVQQHDAdTZWF0dGxlMQwwCgYDVQQK
DANTdGUxFDASBgNVBAsrCmFkbWluc3RyYXRvcjEhMB8GA1UEAwwYcGVlcjAub3Jn
MS5leGFtcGxlLmNvbTBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABHlYGfbvdMFp
l8tKe0e4XH/PBQP4BxIEGRWRGfAiXPlFoQwDpGfZ8D5J7qQRhQc8u1DG9kQBHpgg
RjxJLPv7h9GjMjAwMA4GA1UdDwEB/wQEAwIBBjAdBgNVHSUEFjAUBggrBgEFBQcD
AQYIKwYBBQUHAwIwCgYIKoZIzj0EAwIDRwAwRAIgKN6cQrD7J0FkqvXoMqRCEkqK
eC4VWXuJmxp5dBSn1lQCIDJf+E7QKZS7Z9V7Yl5CEGIpGpNXYRGJPg2RKrvpJ0CG
-----END CERTIFICATE-----"

CONFIG="NodeOUs:
  Enable: false"

# Setup orderer MSP
mkdir -p /var/hyperledger/orderer/msp/signcerts /var/hyperledger/orderer/msp/keystore
echo "$CERT" > /var/hyperledger/orderer/msp/signcerts/cert.pem
echo "$CONFIG" > /var/hyperledger/orderer/msp/config.yaml

# Setup peer MSP
mkdir -p /etc/hyperledger/msp/peer/signcerts /etc/hyperledger/msp/peer/keystore
echo "$CERT" > /etc/hyperledger/msp/peer/signcerts/cert.pem
echo "$CONFIG" > /etc/hyperledger/msp/peer/config.yaml

echo "✓ Certificates initialized"
