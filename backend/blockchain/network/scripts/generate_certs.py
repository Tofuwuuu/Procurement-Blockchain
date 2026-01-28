#!/usr/bin/env python3
"""
Hyperledger Fabric Certificate Generation Script (Python)
Generates self-signed certificates for Orderer and Peers
For development/testing purposes only
"""

import os
import sys
import shutil
from pathlib import Path
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
import datetime

def generate_certificate(path, cn, org):
    """Generate a self-signed certificate and key"""
    print(f"[INFO] Generating certificate for {cn}...")
    
    # Create directories
    Path(f"{path}/signcerts").mkdir(parents=True, exist_ok=True)
    Path(f"{path}/keystore").mkdir(parents=True, exist_ok=True)
    Path(f"{path}/cacerts").mkdir(parents=True, exist_ok=True)
    Path(f"{path}/tlscacerts").mkdir(parents=True, exist_ok=True)
    
    # Generate private key (EC P-256)
    private_key = ec.generate_private_key(ec.SECP256R1())
    
    # Create certificate subject and issuer
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "PH"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "NCR"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, "Manila"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, org),
        x509.NameAttribute(NameOID.COMMON_NAME, cn),
    ])
    
    # Build certificate
    cert = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer
    ).public_key(
        private_key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.datetime.utcnow()
    ).not_valid_after(
        datetime.datetime.utcnow() + datetime.timedelta(days=365)
    ).sign(private_key, hashes.SHA256())
    
    # Save private key for both signing and TLS
    key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    
    with open(f"{path}/keystore/key.pem", "wb") as f:
        f.write(key_pem)
    
    # For TLS, create server.key and server.crt
    with open(f"{path}/server.key", "wb") as f:
        f.write(key_pem)
    
    # Save certificate
    cert_pem = cert.public_bytes(serialization.Encoding.PEM)
    with open(f"{path}/signcerts/cert.pem", "wb") as f:
        f.write(cert_pem)
    
    # For TLS, create server.crt
    with open(f"{path}/server.crt", "wb") as f:
        f.write(cert_pem)
    
    # Copy to cacerts and tlscacerts
    shutil.copy(f"{path}/signcerts/cert.pem", f"{path}/cacerts/ca.pem")
    shutil.copy(f"{path}/signcerts/cert.pem", f"{path}/tlscacerts/tlsca.pem")
    
    # Also create ca.crt in the path root for TLS
    shutil.copy(f"{path}/signcerts/cert.pem", f"{path}/ca.crt")
    
    print(f"[OK] Generated certs for {cn}")

def main():
    crypto_dir = "./crypto-config"
    
    print("=" * 40)
    print("Hyperledger Fabric Certificate Generator")
    print("=" * 40)
    
    # Clean up previous certs
    if os.path.exists(crypto_dir):
        print("[INFO] Cleaning up existing crypto-config...")
        shutil.rmtree(crypto_dir)
    
    os.makedirs(crypto_dir, exist_ok=True)
    
    # ============================================
    # 1. Create Orderer Organization
    # ============================================
    print("\n[1/3] Setting up Orderer Organization...")
    
    orderer_org = f"{crypto_dir}/ordererOrganizations/example.com"
    orderer_orderers = f"{orderer_org}/orderers"
    orderer_msp = f"{orderer_org}/msp"
    orderer_tls = f"{orderer_orderers}/orderer.example.com/tls"
    
    os.makedirs(f"{orderer_orderers}/orderer.example.com", exist_ok=True)
    os.makedirs(orderer_msp, exist_ok=True)
    
    generate_certificate(f"{orderer_orderers}/orderer.example.com", "orderer.example.com", "OrdererOrg")
    
    # Ensure all MSP subdirectories exist
    os.makedirs(f"{orderer_msp}/signcerts", exist_ok=True)
    os.makedirs(f"{orderer_msp}/keystore", exist_ok=True)
    os.makedirs(f"{orderer_msp}/cacerts", exist_ok=True)
    os.makedirs(f"{orderer_msp}/tlscacerts", exist_ok=True)
    
    # Copy orderer certs to org MSP
    shutil.copy(f"{orderer_orderers}/orderer.example.com/signcerts/cert.pem", f"{orderer_msp}/signcerts/cert.pem")
    shutil.copy(f"{orderer_orderers}/orderer.example.com/keystore/key.pem", f"{orderer_msp}/keystore/key.pem")
    shutil.copy(f"{orderer_orderers}/orderer.example.com/cacerts/ca.pem", f"{orderer_msp}/cacerts/ca.pem")
    shutil.copy(f"{orderer_orderers}/orderer.example.com/tlscacerts/tlsca.pem", f"{orderer_msp}/tlscacerts/tlsca.pem")
    
    with open(f"{orderer_msp}/config.yaml", "w") as f:
        f.write("NodeOUs:\n  Enable: false\n")
    
    print("[OK] Orderer Organization setup complete")
    
    # ============================================
    # 2. Create Peer Organization 1 (Org1)
    # ============================================
    print("\n[2/3] Setting up Peer Organization 1 (Org1)...")
    
    org1 = f"{crypto_dir}/peerOrganizations/org1.example.com"
    org1_peers = f"{org1}/peers"
    org1_msp = f"{org1}/msp"
    org1_users = f"{org1}/users"
    
    os.makedirs(f"{org1_peers}/peer0.org1.example.com", exist_ok=True)
    os.makedirs(f"{org1_peers}/peer1.org1.example.com", exist_ok=True)
    os.makedirs(org1_msp, exist_ok=True)
    os.makedirs(f"{org1_users}/Admin@org1.example.com", exist_ok=True)
    os.makedirs(f"{org1_users}/User1@org1.example.com", exist_ok=True)
    
    generate_certificate(f"{org1_peers}/peer0.org1.example.com", "peer0.org1.example.com", "Org1")
    generate_certificate(f"{org1_peers}/peer1.org1.example.com", "peer1.org1.example.com", "Org1")
    generate_certificate(f"{org1_users}/Admin@org1.example.com", "Admin@org1.example.com", "Org1")
    generate_certificate(f"{org1_users}/User1@org1.example.com", "User1@org1.example.com", "Org1")
    
    os.makedirs(f"{org1_msp}/signcerts", exist_ok=True)
    shutil.copy(f"{org1_peers}/peer0.org1.example.com/signcerts/cert.pem", f"{org1_msp}/signcerts/cert.pem")
    
    with open(f"{org1_msp}/config.yaml", "w") as f:
        f.write("NodeOUs:\n  Enable: false\n")
    
    print("[OK] Org1 setup complete")
    
    # ============================================
    # 3. Create Peer Organization 2 (Org2)
    # ============================================
    print("\n[3/3] Setting up Peer Organization 2 (Org2)...")
    
    org2 = f"{crypto_dir}/peerOrganizations/org2.example.com"
    org2_peers = f"{org2}/peers"
    org2_msp = f"{org2}/msp"
    org2_users = f"{org2}/users"
    
    os.makedirs(f"{org2_peers}/peer0.org2.example.com", exist_ok=True)
    os.makedirs(f"{org2_peers}/peer1.org2.example.com", exist_ok=True)
    os.makedirs(org2_msp, exist_ok=True)
    os.makedirs(f"{org2_users}/Admin@org2.example.com", exist_ok=True)
    os.makedirs(f"{org2_users}/User1@org2.example.com", exist_ok=True)
    
    generate_certificate(f"{org2_peers}/peer0.org2.example.com", "peer0.org2.example.com", "Org2")
    generate_certificate(f"{org2_peers}/peer1.org2.example.com", "peer1.org2.example.com", "Org2")
    generate_certificate(f"{org2_users}/Admin@org2.example.com", "Admin@org2.example.com", "Org2")
    generate_certificate(f"{org2_users}/User1@org2.example.com", "User1@org2.example.com", "Org2")
    
    os.makedirs(f"{org2_msp}/signcerts", exist_ok=True)
    shutil.copy(f"{org2_peers}/peer0.org2.example.com/signcerts/cert.pem", f"{org2_msp}/signcerts/cert.pem")
    
    with open(f"{org2_msp}/config.yaml", "w") as f:
        f.write("NodeOUs:\n  Enable: false\n")
    
    print("[OK] Org2 setup complete")
    
    # ============================================
    # Summary
    # ============================================
    print("\n" + "=" * 40)
    print("Certificate Generation Complete!")
    print("=" * 40)
    
    print("\nGenerated Structure:")
    print(f"  Orderer: {orderer_org}")
    print(f"  Org1:    {org1}")
    print(f"  Org2:    {org2}")
    
    print("\nTotal Entities:")
    print("  - 1 Orderer")
    print("  - 4 Peers (2x Org1, 2x Org2)")
    print("  - 4 Admins (1 per org and orderer)")
    print("  - 2 Users")
    
    print("\nNext Steps:")
    print("  1. Run docker-compose to start network")
    print("  2. Create channel configuration")
    print("  3. Deploy chaincode")
    
    print("\nDone!\n")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
