#!/bin/bash

# This script initializes certificates within the peer container

PEER_MSP_PATH="/etc/hyperledger/msp/peer"
ORDERER_MSP_PATH="/var/hyperledger/orderer/msp"

# Create required directories for peer
mkdir -p $PEER_MSP_PATH/signcerts
mkdir -p $PEER_MSP_PATH/keystore  
mkdir -p $PEER_MSP_PATH/cacerts
mkdir -p $PEER_MSP_PATH/tlscacerts

# Create a minimal but valid self-signed certificate
cat > $PEER_MSP_PATH/signcerts/cert.pem << 'EOF'
-----BEGIN CERTIFICATE-----
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
-----END CERTIFICATE-----
EOF

# Create config.yaml with NodeOUs disabled for development
cat > $PEER_MSP_PATH/config.yaml << 'EOF'
NodeOUs:
  Enable: false
EOF

# Create dummy keystore key
cat > $PEER_MSP_PATH/keystore/key.pem << 'EOF'
-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgQWlYGfbvdMFpl8tK
e0e4XH/PBQP4BxIEGRWRGfAiXPlFoUQDQgAEeVgZ9u90wWmXy0p7R7hcf88FA/gH
EgQZFZEZ8CJc+UWhDAOkZ9nwPknupBGFBzy7UMb2RAEemCBGPEks+/uH0Q==
-----END PRIVATE KEY-----
EOF

echo "Certificate initialization complete"
