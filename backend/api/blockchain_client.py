"""
Hyperledger Fabric Blockchain Client
Handles interaction with Fabric network for recording inspection results
"""

import os
import json
import subprocess
from typing import Dict, List, Optional
from datetime import datetime

class BlockchainClient:
    """Client for interacting with Hyperledger Fabric network"""
    
    def __init__(self):
        self.channel_name = os.getenv("FABRIC_CHANNEL_NAME", "procurementchannel")
        self.chaincode_name = os.getenv("FABRIC_CHAINCODE_NAME", "inspection")
        self.peer_address = os.getenv("FABRIC_PEER_ADDRESS", "peer0.org1.example.com:7051")
        self.orderer_address = os.getenv("FABRIC_ORDERER_ADDRESS", "orderer.example.com:7050")
        self.network_dir = os.getenv("FABRIC_NETWORK_DIR", "../blockchain/network")
        
    def _run_peer_command(self, command: List[str], org: str = "org1") -> Dict:
        """
        Execute a peer command via Docker
        
        Args:
            command: List of command arguments
            org: Organization (org1 or org2)
        
        Returns:
            Dict with success status and result/error
        """
        # Fix org name if it has typo (org11 -> org1)
        if org == "org11":
            org = "org1"
        
        peer_container = f"peer0.{org}.example.com"
        
        # Set environment variables for peer command
        # Disable TLS for now to avoid connection issues
        env_vars = {
            "CORE_PEER_LOCALMSPID": f"{org.capitalize()}MSP",
            "CORE_PEER_TLS_ENABLED": "false",  # Disable TLS to avoid connection issues
            "CORE_PEER_MSPCONFIGPATH": f"/work/crypto-config/peerOrganizations/{org}.example.com/users/Admin@{org}.example.com/msp",
            "CORE_PEER_ADDRESS": f"{peer_container}:{7051 if org == 'org1' else 9051}"
        }
        
        # Build docker exec command
        docker_cmd = [
            "docker", "exec",
            "-e", f"CORE_PEER_LOCALMSPID={env_vars['CORE_PEER_LOCALMSPID']}",
            "-e", f"CORE_PEER_TLS_ENABLED={env_vars['CORE_PEER_TLS_ENABLED']}",
            "-e", f"CORE_PEER_MSPCONFIGPATH={env_vars['CORE_PEER_MSPCONFIGPATH']}",
            "-e", f"CORE_PEER_ADDRESS={env_vars['CORE_PEER_ADDRESS']}",
            peer_container,
            "peer"
        ] + command
        
        try:
            result = subprocess.run(
                docker_cmd,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                return {
                    "success": True,
                    "result": result.stdout.strip(),
                    "error": None
                }
            else:
                return {
                    "success": False,
                    "result": None,
                    "error": result.stderr.strip() or result.stdout.strip()
                }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "result": None,
                "error": "Command timed out"
            }
        except Exception as e:
            return {
                "success": False,
                "result": None,
                "error": str(e)
            }
    
    def record_inspection(
        self,
        inspection_id: str,
        po_number: str,
        inspection_date: str,
        inspected_by: str,
        status: str,
        items: List[Dict],
        overall_remarks: str = ""
    ) -> Dict:
        """
        Record an inspection result on the blockchain
        
        Args:
            inspection_id: Unique inspection ID
            po_number: Purchase Order number
            inspection_date: Inspection date (ISO format)
            inspected_by: Name of inspector
            status: Inspection status (Accepted/Partial/Rejected)
            items: List of inspection items
            overall_remarks: Overall remarks
        
        Returns:
            Dict with success status and transaction details
        """
        # Prepare arguments
        items_json = json.dumps(items)
        
        # Build invoke command - use proper format for chaincode
        # The -c flag expects a JSON string with function and Args
        chaincode_args = json.dumps({
            "function": "recordInspection",
            "Args": [
                inspection_id,
                po_number,
                inspection_date,
                inspected_by,
                status,
                items_json,
                overall_remarks
            ]
        })
        
        command = [
            "chaincode", "invoke",
            "-o", self.orderer_address,
            "-C", self.channel_name,
            "-n", self.chaincode_name,
            "-c", chaincode_args
        ]
        
        # Note: TLS is disabled for now - can be enabled later if needed
        
        result = self._run_peer_command(command)
        
        if result["success"]:
            return {
                "success": True,
                "message": "Inspection recorded on blockchain",
                "inspection_id": inspection_id,
                "timestamp": datetime.utcnow().isoformat(),
                "tx_id": result["result"] if result["result"] else "pending"
            }
        else:
            return {
                "success": False,
                "error": result["error"],
                "message": "Failed to record inspection on blockchain"
            }
    
    def get_inspection(self, inspection_id: str) -> Dict:
        """
        Get inspection record from blockchain
        
        Args:
            inspection_id: Inspection ID
        
        Returns:
            Dict with inspection record or error
        """
        command = [
            "chaincode", "query",
            "-C", self.channel_name,
            "-n", self.chaincode_name,
            "-c", json.dumps({
                "function": "getInspection",
                "Args": [inspection_id]
            })
        ]
        
        result = self._run_peer_command(command)
        
        if result["success"]:
            try:
                inspection_data = json.loads(result["result"])
                return {
                    "success": True,
                    "data": inspection_data
                }
            except json.JSONDecodeError:
                return {
                    "success": False,
                    "error": "Failed to parse blockchain response"
                }
        else:
            return {
                "success": False,
                "error": result["error"]
            }
    
    def get_inspection_by_po(self, po_number: str) -> Dict:
        """
        Get inspection records by PO number
        
        Args:
            po_number: Purchase Order number
        
        Returns:
            Dict with list of inspection records
        """
        chaincode_args = json.dumps({
            "function": "getInspectionByPO",
            "Args": [po_number]
        })
        
        command = [
            "chaincode", "query",
            "-C", self.channel_name,
            "-n", self.chaincode_name,
            "-c", chaincode_args
        ]
        
        result = self._run_peer_command(command)
        
        if result["success"]:
            try:
                inspections = json.loads(result["result"])
                return {
                    "success": True,
                    "data": inspections
                }
            except json.JSONDecodeError:
                return {
                    "success": False,
                    "error": "Failed to parse blockchain response"
                }
        else:
            return {
                "success": False,
                "error": result["error"]
            }
    
    def verify_inspection(self, inspection_id: str) -> Dict:
        """
        Verify inspection record integrity
        
        Args:
            inspection_id: Inspection ID
        
        Returns:
            Dict with verification result
        """
        chaincode_args = json.dumps({
            "function": "verifyInspection",
            "Args": [inspection_id]
        })
        
        command = [
            "chaincode", "query",
            "-C", self.channel_name,
            "-n", self.chaincode_name,
            "-c", chaincode_args
        ]
        
        result = self._run_peer_command(command)
        
        if result["success"]:
            try:
                verification = json.loads(result["result"])
                return {
                    "success": True,
                    "data": verification
                }
            except json.JSONDecodeError:
                return {
                    "success": False,
                    "error": "Failed to parse blockchain response"
                }
        else:
            return {
                "success": False,
                "error": result["error"]
            }

# Singleton instance
_blockchain_client = None

def get_blockchain_client() -> BlockchainClient:
    """Get singleton blockchain client instance"""
    global _blockchain_client
    if _blockchain_client is None:
        _blockchain_client = BlockchainClient()
    return _blockchain_client
