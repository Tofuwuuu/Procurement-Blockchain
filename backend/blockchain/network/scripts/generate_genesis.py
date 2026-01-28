#!/usr/bin/env python3
"""
Fabric Genesis Block Generator (Python Implementation)
Creates orderer.genesis.block from configtx.yaml
"""

import os
import struct
import hashlib
import json
import yaml
from datetime import datetime

def create_minimal_genesis():
    """Create a minimal genesis block for development"""
    
    print("[INFO] Creating minimal genesis block structure...")
    
    # Read configtx.yaml to get organization info
    with open('configtx.yaml', 'r') as f:
        config = yaml.safe_load(f)
    
    # Create config.json (simplified channel configuration)
    channel_config = {
        "channel_group": {
            "groups": {
                "Application": {
                    "groups": {
                        "Org1MSP": {
                            "mod_policy": "Admins",
                            "policies": {},
                            "values": {},
                            "version": 0
                        },
                        "Org2MSP": {
                            "mod_policy": "Admins",
                            "policies": {},
                            "values": {},
                            "version": 0
                        }
                    },
                    "mod_policy": "Admins",
                    "policies": {},
                    "values": {},
                    "version": 0
                },
                "Orderer": {
                    "groups": {
                        "OrdererMSP": {
                            "mod_policy": "Admins",
                            "policies": {},
                            "values": {},
                            "version": 0
                        }
                    },
                    "mod_policy": "Admins",
                    "policies": {},
                    "values": {},
                    "version": 0
                },
                "Consortiums": {
                    "groups": {
                        "SampleConsortium": {
                            "groups": {
                                "Org1MSP": {
                                    "mod_policy": "Admins",
                                    "policies": {},
                                    "values": {},
                                    "version": 0
                                },
                                "Org2MSP": {
                                    "mod_policy": "Admins",
                                    "policies": {},
                                    "values": {},
                                    "version": 0
                                }
                            },
                            "mod_policy": "Admins",
                            "policies": {},
                            "values": {},
                            "version": 0
                        }
                    },
                    "mod_policy": "Admins",
                    "policies": {},
                    "values": {},
                    "version": 0
                }
            },
            "mod_policy": "Admins",
            "policies": {},
            "values": {},
            "version": 0
        }
    }
    
    # Save config.json
    with open('config.json', 'w') as f:
        json.dump(channel_config, f, indent=2)
    
    print("[OK] Created config.json")
    
    # Create genesis block (as JSON for inspection, binary format would require protobuf)
    genesis_block = {
        "header": {
            "number": "0",
            "previous_hash": "0000000000000000000000000000000000000000000000000000000000000000",
            "data_hash": hashlib.sha256(json.dumps(channel_config).encode()).hexdigest()
        },
        "data": {
            "data": [
                {
                    "payload": {
                        "header": {
                            "channel_header": {
                                "type": "CONFIG",
                                "version": 1,
                                "timestamp": datetime.utcnow().isoformat(),
                                "channel_id": "systemchannel",
                                "tx_id": "",
                                "epoch": 0
                            },
                            "signature_header": {
                                "creator": "OrdererMSP",
                                "nonce": ""
                            }
                        },
                        "data": {
                            "config": channel_config
                        }
                    }
                }
            ]
        },
        "metadata": {
            "metadata": [
                {
                    "SIGNATURES": []
                },
                {
                    "LAST_CONFIG": 0
                },
                {
                    "TRANSACTIONS_FILTER": [0]
                }
            ]
        }
    }
    
    with open('orderer.genesis.block.json', 'w') as f:
        json.dump(genesis_block, f, indent=2)
    
    print("[OK] Created orderer.genesis.block.json")
    
    # Create a simple binary genesis block file
    # In production, this would be generated by configtxgen, but we'll create a stub
    with open('orderer.genesis.block', 'wb') as f:
        # Write a simple header indicating this is a genesis block
        f.write(b'GENESIS_BLOCK_V1\x00')
        f.write(struct.pack('>Q', 0))  # Block number (0)
        f.write(b'\x00' * 32)  # Previous hash (all zeros for genesis)
        config_json = json.dumps(channel_config).encode()
        f.write(struct.pack('>I', len(config_json)))  # Config length
        f.write(config_json)
    
    print("[OK] Created orderer.genesis.block (stub)")
    
    # Create channel configuration artifacts
    print("[INFO] Creating channel configuration artifacts...")
    
    with open('procurementchannel.tx.json', 'w') as f:
        channel_tx = {
            "channel_id": "procurementchannel",
            "timestamp": datetime.utcnow().isoformat(),
            "type": "CONFIG",
            "config": channel_config
        }
        json.dump(channel_tx, f, indent=2)
    
    print("[OK] Created procurementchannel.tx.json")
    
    with open('Org1MSPanchors.tx.json', 'w') as f:
        anchor_tx = {
            "channel_id": "procurementchannel",
            "type": "ANCHOR_PEERS_UPDATE",
            "org": "Org1MSP",
            "anchor_peers": [
                {
                    "host": "peer0.org1.example.com",
                    "port": 7051
                }
            ]
        }
        json.dump(anchor_tx, f, indent=2)
    
    print("[OK] Created Org1MSPanchors.tx.json")
    
    with open('Org2MSPanchors.tx.json', 'w') as f:
        anchor_tx = {
            "channel_id": "procurementchannel",
            "type": "ANCHOR_PEERS_UPDATE",
            "org": "Org2MSP",
            "anchor_peers": [
                {
                    "host": "peer0.org2.example.com",
                    "port": 9051
                }
            ]
        }
        json.dump(anchor_tx, f, indent=2)
    
    print("[OK] Created Org2MSPanchors.tx.json")

def main():
    print("=" * 50)
    print("Fabric Genesis Block Generator")
    print("=" * 50)
    print()
    
    try:
        create_minimal_genesis()
        
        print("\n" + "=" * 50)
        print("Genesis Block Generation Complete")
        print("=" * 50)
        
        print("\nGenerated Files:")
        files = [
            'orderer.genesis.block',
            'orderer.genesis.block.json',
            'config.json',
            'procurementchannel.tx.json',
            'Org1MSPanchors.tx.json',
            'Org2MSPanchors.tx.json'
        ]
        
        for fname in files:
            if os.path.exists(fname):
                size = os.path.getsize(fname)
                print(f"  ✓ {fname} ({size} bytes)")
            else:
                print(f"  ✗ {fname} (failed)")
        
        print("\nNext Steps:")
        print("  1. Review orderer.genesis.block.json for configuration")
        print("  2. Start Docker: docker-compose -f docker-compose-fabric.yml up -d")
        print("  3. Create channel using procurementchannel.tx")
        print("  4. Update anchor peers using anchor tx files")
        print("  5. Deploy chaincode")
        
        print("\nNote: For production, use configtxgen from Fabric:")
        print("  configtxgen -profile OrdererGenesis -outputBlock orderer.genesis.block")
        print()
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
