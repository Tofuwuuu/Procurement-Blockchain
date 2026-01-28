#!/usr/bin/env python3
"""
Generate Hyperledger Fabric Genesis Block and Channel Configuration
Uses configtxgen tool or python implementation
"""

import os
import json
import struct
import subprocess
import sys
from pathlib import Path

def run_command(cmd, description):
    """Run a shell command and report results"""
    print(f"[INFO] {description}...")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=".")
        if result.returncode == 0:
            print(f"[OK] {description} - Success")
            return True
        else:
            print(f"[WARN] {description} - Output: {result.stderr}")
            return False
    except Exception as e:
        print(f"[WARN] Could not execute: {e}")
        return False

def create_genesis_block_json():
    """Create a JSON representation of the genesis block (for manual inspection)"""
    genesis = {
        "header": {
            "number": 0,
            "previous_hash": "",
            "data_hash": ""
        },
        "data": {
            "data": []
        },
        "metadata": {
            "metadata": []
        },
        "organizations": [
            {
                "name": "OrdererMSP",
                "msp_id": "OrdererMSP",
                "certificate": "crypto-config/ordererOrganizations/example.com/msp/signcerts/cert.pem"
            },
            {
                "name": "Org1MSP",
                "msp_id": "Org1MSP",
                "certificate": "crypto-config/peerOrganizations/org1.example.com/msp/signcerts/cert.pem"
            },
            {
                "name": "Org2MSP",
                "msp_id": "Org2MSP",
                "certificate": "crypto-config/peerOrganizations/org2.example.com/msp/signcerts/cert.pem"
            }
        ]
    }
    
    with open("genesis_block_template.json", "w") as f:
        json.dump(genesis, f, indent=2)
    
    print("[OK] Genesis block template created at genesis_block_template.json")

def main():
    print("=" * 50)
    print("Hyperledger Fabric Genesis & Channel Generator")
    print("=" * 50)
    
    # Step 1: Check for configtxgen tool
    print("\n[STEP 1] Checking for configtxgen tool...")
    
    # Try to use configtxgen if available
    if run_command("configtxgen --version", "Checking configtxgen availability"):
        print("\n[INFO] Using configtxgen to generate genesis block...")
        
        # Generate OrdererGenesis block
        run_command(
            'configtxgen -profile OrdererGenesis -channelID procurementchannel -outputBlock ./orderer.genesis.block -configPath . 2>&1',
            "Generating OrdererGenesis block"
        )
        
        # Generate ProcurementChannel configuration
        run_command(
            'configtxgen -profile ProcurementChannel -channelID procurementchannel -outputCreateChannelTx ./procurementchannel.tx -configPath . 2>&1',
            "Generating ProcurementChannel configuration"
        )
        
        run_command(
            'configtxgen -profile ProcurementChannel -channelID procurementchannel -outputAnchorPeersUpdate ./Org1MSPanchors.tx -asOrg Org1MSP -configPath . 2>&1',
            "Generating Org1 anchor peers"
        )
        
        run_command(
            'configtxgen -profile ProcurementChannel -channelID procurementchannel -outputAnchorPeersUpdate ./Org2MSPanchors.tx -asOrg Org2MSP -configPath . 2>&1',
            "Generating Org2 anchor peers"
        )
    else:
        print("\n[WARN] configtxgen not found in PATH")
        print("[INFO] Creating manual genesis block template instead...")
        create_genesis_block_json()
    
    # Step 2: Summary
    print("\n" + "=" * 50)
    print("Configuration Generation Summary")
    print("=" * 50)
    
    print("\nExpected Output Files:")
    files_to_check = [
        "orderer.genesis.block",
        "procurementchannel.tx",
        "Org1MSPanchors.tx",
        "Org2MSPanchors.tx"
    ]
    
    for fname in files_to_check:
        if os.path.exists(fname):
            print(f"  ✓ {fname}")
        else:
            print(f"  ✗ {fname} (not found)")
    
    print("\nNext Steps:")
    print("  1. Ensure orderer.genesis.block exists")
    print("  2. Start Docker containers: docker-compose -f docker-compose-fabric.yml up -d")
    print("  3. Create and join channel")
    print("  4. Install and instantiate chaincode")
    
    print("\nDone!\n")

if __name__ == "__main__":
    main()
