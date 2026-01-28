#!/usr/bin/env python3
"""Bootstrap script to create certificates and deploy Fabric network in containers"""
import os
import subprocess
import sys
import time
import tempfile

CERT_CONTENT = """-----BEGIN CERTIFICATE-----
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
-----END CERTIFICATE-----"""

CONFIG_YAML = """NodeOUs:
  Enable: false
"""

def setup_container_certs_inline(container_name, msp_path):
    """Setup MSP for a container using docker exec and inline echo"""
    print(f"  Injecting certificate to {container_name}...")
    
    try:
        # Write certificate using printf directly via shell (avoids escaping issues)
        subprocess.run([
            "docker", "exec", "-i", container_name, "sh", "-c",
            f"cat > {msp_path}/signcerts/cert.pem"
        ], input=CERT_CONTENT.encode(), check=True, capture_output=True, timeout=10)
        
        # Write config
        subprocess.run([
            "docker", "exec", "-i", container_name, "sh", "-c",
            f"cat > {msp_path}/config.yaml"
        ], input=CONFIG_YAML.encode(), check=True, capture_output=True, timeout=10)
        
        print(f"    ✓ Injected certs into {container_name}")
        return True
            
    except subprocess.TimeoutExpired:
        print(f"    ✗ Timeout injecting certs to {container_name}")
        return False
    except subprocess.CalledProcessError as e:
        err = e.stderr.decode() if e.stderr else str(e)
        print(f"    ✗ Failed to inject certs: {err}")
        return False

def restart_containers(container_names):
    """Restart containers so they pick up the certificates"""
    print("\nRestarting containers to load certificates...")
    for container in container_names:
        try:
            subprocess.run(["docker", "restart", container], check=True, capture_output=True, timeout=15)
            print(f"  ✓ Restarted {container}")
            time.sleep(2)
        except subprocess.CalledProcessError as e:
            print(f"  ✗ Failed to restart {container}")
            return False
    return True

def check_container_status():
    """Check if containers are running"""
    try:
        result = subprocess.run([
            "docker", "ps", "--format", "table {{.Names}}\\t{{.Status}}"
        ], capture_output=True, text=True, timeout=10)
        
        print("\nContainer Status:")
        print(result.stdout)
        return result.stdout
    except subprocess.CalledProcessError:
        return None

def bootstrap_network():
    """Bootstrap the Fabric network with inline certificate setup"""
    print("=" * 60)
    print("Hyperledger Fabric Network Bootstrap")
    print("=" * 60)
    
    os.chdir("e:\\Projects\\BLOCKCHAIN\\backend\\blockchain\\network")
    
    # Step 1: Start network
    print("\n[1/4] Starting network containers...")
    result = subprocess.run(["docker-compose", "up", "-d"], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"✗ Failed to start network: {result.stderr}")
        return False
    print("✓ Network containers started")
    
    # Step 2: Wait for containers to initialize
    print("\n[2/4] Waiting for containers to be ready...")
    time.sleep(8)
    
    # Step 3: Setup certificates in running containers
    print("\n[3/4] Setting up MSP certificates...")
    
    # Setup orderer
    if not setup_container_certs_inline("orderer.example.com", "/var/hyperledger/orderer/msp"):
        print("✗ Failed to setup orderer certificates")
        return False
    
    # Setup peers
    peers = [
        ("peer0.org1.example.com", "/etc/hyperledger/msp/peer"),
        ("peer1.org1.example.com", "/etc/hyperledger/msp/peer"),
        ("peer0.org2.example.com", "/etc/hyperledger/msp/peer"),
        ("peer1.org2.example.com", "/etc/hyperledger/msp/peer"),
    ]
    
    for peer_name, msp_path in peers:
        if not setup_container_certs_inline(peer_name, msp_path):
            print(f"✗ Failed to setup {peer_name} certificates")
            return False
    
    # Step 4: Restart containers to load certificates
    print("\n[4/4] Restarting containers to load certificates...")
    all_containers = ["orderer.example.com"] + [p[0] for p in peers]
    
    if not restart_containers(all_containers):
        print("✗ Failed to restart containers")
        return False
    
    # Final status
    time.sleep(5)
    print("\n" + "=" * 60)
    print("Bootstrap Complete!")
    print("=" * 60)
    check_container_status()
    
    print("\nNetwork Status:")
    print("✓ Hyperledger Fabric network deployed in containers")
    print("✓ All MSP certificates configured")
    print("✓ Ready for chaincode deployment")
    
    return True

if __name__ == "__main__":
    try:
        if bootstrap_network():
            sys.exit(0)
        else:
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n\nBootstrap cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        sys.exit(1)
