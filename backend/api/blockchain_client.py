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
        self.command_timeout_seconds = int(os.getenv("FABRIC_COMMAND_TIMEOUT_SECONDS", "60"))

    @staticmethod
    def _is_already_locked_error(err: str) -> bool:
        if not err:
            return False
        e = err.lower()
        return (
            "already recorded and locked" in e
            or "already recorded" in e and "locked" in e
            or "cannot modify" in e and "locked" in e
        )
        
    def _run_peer_command(self, command: List[str], org: str = "org1") -> Dict:
        """
        Execute a peer command via Docker
        
        Args:
            command: List of command arguments
            org: Organization (org1 or org2)
        
        Returns:
            Dict with success status and result/error
        """
        # Guard against accidental typos in org name
        if org not in ("org1", "org2"):
            org = "org1"

        peer_container = f"peer0.{org}.example.com"

        # Peer containers are configured with TLS enabled (docker-compose).
        # Use Org Admin identity (mounted at /work/crypto-config) so policies like
        # /Channel/Application/Readers and Writers are satisfied.
        env_vars = {
            "CORE_PEER_LOCALMSPID": f"{org.capitalize()}MSP",
            "CORE_PEER_TLS_ENABLED": "true",
            "CORE_PEER_TLS_ROOTCERT_FILE": f"/work/crypto-config/peerOrganizations/{org}.example.com/peers/{peer_container}/tls/ca.crt",
            "CORE_PEER_MSPCONFIGPATH": f"/work/crypto-config/peerOrganizations/{org}.example.com/users/Admin@{org}.example.com/msp",
            "CORE_PEER_ADDRESS": f"{peer_container}:{7051 if org == 'org1' else 9051}",
        }
        
        # Build docker exec command
        docker_cmd = [
            "docker", "exec",
            "-e", f"CORE_PEER_LOCALMSPID={env_vars['CORE_PEER_LOCALMSPID']}",
            "-e", f"CORE_PEER_TLS_ENABLED={env_vars['CORE_PEER_TLS_ENABLED']}",
            "-e", f"CORE_PEER_TLS_ROOTCERT_FILE={env_vars['CORE_PEER_TLS_ROOTCERT_FILE']}",
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
                timeout=self.command_timeout_seconds
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

    def _invoke_contract(self, args: List[str]) -> Dict:
        ctor = {"Args": args}
        command = [
            "chaincode", "invoke",
            "-o", self.orderer_address,
            "--tls",
            "--cafile", "/work/artifacts/orderer_tls_ca.crt",
            "-C", self.channel_name,
            "-n", self.chaincode_name,
            "-c", json.dumps(ctor),
            "--peerAddresses", "peer0.org1.example.com:7051",
            "--tlsRootCertFiles", "/work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt",
            "--peerAddresses", "peer0.org2.example.com:9051",
            "--tlsRootCertFiles", "/work/crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt",
        ]
        return self._run_peer_command(command, org="org1")

    def _query_contract(self, args: List[str]) -> Dict:
        ctor = {"Args": args}
        command = [
            "chaincode", "query",
            "--tls",
            "--cafile", "/work/artifacts/orderer_tls_ca.crt",
            "-C", self.channel_name,
            "-n", self.chaincode_name,
            "-c", json.dumps(ctor),
            "--peerAddresses", "peer0.org1.example.com:7051",
            "--tlsRootCertFiles", "/work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt",
        ]
        return self._run_peer_command(command, org="org1")

    @staticmethod
    def _parse_query_result(result: Dict, not_found_message: str = "Record not found") -> Dict:
        if result["success"]:
            try:
                return {"success": True, "data": json.loads(result["result"])}
            except json.JSONDecodeError:
                return {"success": False, "error": "Failed to parse blockchain response"}
        return {"success": False, "error": result.get("error") or not_found_message}

    def record_procurement_event(
        self,
        event_id: str,
        event_type: str,
        entity_id: str,
        actor: str,
        status: str,
        payload: Optional[Dict] = None
    ) -> Dict:
        payload_json = json.dumps(payload or {})
        event_function_map = {
            "PURCHASE_REQUEST_SUBMITTED": "InspectionContract:recordPurchaseRequestSubmission",
            "PURCHASE_REQUEST_APPROVED": "InspectionContract:recordPurchaseRequestApproval",
            "PURCHASE_ORDER_ISSUED": "InspectionContract:recordPurchaseOrderIssuance",
            "DELIVERY_RECEIVING_CONFIRMED": "InspectionContract:recordDeliveryReceiving",
            "PAYMENT_COMPLETED": "InspectionContract:recordPaymentCompletion",
        }
        function_name = event_function_map.get(event_type, "InspectionContract:recordProcurementEvent")
        args = [function_name, event_id, entity_id, actor or "", status or "", payload_json]
        if function_name == "InspectionContract:recordProcurementEvent":
            args = [function_name, event_id, event_type, entity_id, actor or "", status or "", payload_json]

        result = self._invoke_contract(args)
        if result["success"]:
            query_result = self.get_procurement_event(event_id)
            event_data = query_result.get("data") or {}
            return {
                "success": True,
                "message": "Procurement event recorded on blockchain",
                "event_id": event_id,
                "timestamp": event_data.get("timestamp") or datetime.utcnow().isoformat(),
                "tx_id": event_data.get("txId"),
                "raw": result["result"]
            }

        if self._is_already_locked_error(result.get("error") or ""):
            query_result = self.get_procurement_event(event_id)
            event_data = query_result.get("data") or {}
            return {
                "success": True,
                "message": "Procurement event already recorded and locked on blockchain",
                "event_id": event_id,
                "timestamp": event_data.get("timestamp") or datetime.utcnow().isoformat(),
                "tx_id": event_data.get("txId"),
                "raw": result.get("error") or ""
            }

        return {
            "success": False,
            "error": result["error"],
            "message": "Failed to record procurement event on blockchain"
        }

    def get_procurement_event(self, event_id: str) -> Dict:
        result = self._query_contract(["InspectionContract:getProcurementEvent", event_id])
        return self._parse_query_result(result, "Procurement event not found on blockchain")

    def get_all_procurement_events(self) -> Dict:
        result = self._query_contract(["InspectionContract:getAllProcurementEvents"])
        return self._parse_query_result(result, "Procurement events not found on blockchain")

    def get_procurement_events_by_type(self, event_type: str) -> Dict:
        result = self._query_contract(["InspectionContract:getProcurementEventsByType", event_type])
        return self._parse_query_result(result, "Procurement events not found on blockchain")

    def get_procurement_events_by_entity(self, entity_id: str) -> Dict:
        result = self._query_contract(["InspectionContract:getProcurementEventsByEntity", entity_id])
        return self._parse_query_result(result, "Procurement events not found on blockchain")

    def verify_procurement_event(self, event_id: str) -> Dict:
        result = self._query_contract(["InspectionContract:verifyProcurementEvent", event_id])
        return self._parse_query_result(result, "Procurement event not found on blockchain")

    def get_all_inspections(self) -> Dict:
        result = self._query_contract(["InspectionContract:getAllInspections"])
        return self._parse_query_result(result, "Inspection records not found on blockchain")
    
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
        items_json = json.dumps(items)

        # Fabric contract-api uses "ContractName:functionName" as the first arg.
        # Our contract name is InspectionContract (see chaincode constructor).
        ctor = {
            "Args": [
                "InspectionContract:recordInspection",
                inspection_id,
                po_number,
                inspection_date,
                inspected_by,
                status,
                items_json,
                overall_remarks or "",
            ]
        }

        command = [
            "chaincode", "invoke",
            "-o", self.orderer_address,
            "--tls",
            "--cafile", "/work/artifacts/orderer_tls_ca.crt",
            "-C", self.channel_name,
            "-n", self.chaincode_name,
            "-c", json.dumps(ctor),
            "--peerAddresses", "peer0.org1.example.com:7051",
            "--tlsRootCertFiles", "/work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt",
            "--peerAddresses", "peer0.org2.example.com:9051",
            "--tlsRootCertFiles", "/work/crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt",
        ]
        
        # Use org1 peer container to submit the tx
        result = self._run_peer_command(command, org="org1")
        
        if result["success"]:
            # After successful invoke, wait for commit, then query to get the txId
            import time
            tx_id = None
            timestamp = datetime.utcnow().isoformat()
            
            # Retry query up to 3 times with increasing delays
            for attempt in range(3):
                time.sleep(2 + attempt)  # 2s, 3s, 4s delays
                query_result = self.get_inspection(inspection_id)
                
                if query_result.get("success") and query_result.get("data"):
                    stored_record = query_result["data"]
                    tx_id = stored_record.get("txId") or stored_record.get("tx_id")
                    # Use timestamp from blockchain if available
                    if stored_record.get("timestamp"):
                        timestamp = stored_record["timestamp"]
                    if tx_id:
                        break  # Successfully retrieved txId
            
            return {
                "success": True,
                "message": "Inspection recorded on blockchain",
                "inspection_id": inspection_id,
                "timestamp": timestamp,
                "tx_id": tx_id,
                "raw": result["result"]
            }
        else:
            # Idempotency: if chaincode says it's already locked, treat as success
            if self._is_already_locked_error(result.get("error") or ""):
                # Query existing record to get txId (should be immediate since it already exists)
                import time
                tx_id = None
                timestamp = datetime.utcnow().isoformat()
                
                query_result = self.get_inspection(inspection_id)
                if query_result.get("success") and query_result.get("data"):
                    stored_record = query_result["data"]
                    tx_id = stored_record.get("txId") or stored_record.get("tx_id")
                    if stored_record.get("timestamp"):
                        timestamp = stored_record["timestamp"]
                
                return {
                    "success": True,
                    "message": "Inspection already recorded and locked on blockchain",
                    "inspection_id": inspection_id,
                    "timestamp": timestamp,
                    "tx_id": tx_id,
                    "raw": result.get("error") or ""
                }
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
        ctor = {"Args": ["InspectionContract:getInspection", inspection_id]}
        command = [
            "chaincode", "query",
            "--tls",
            "--cafile", "/work/artifacts/orderer_tls_ca.crt",
            "-C", self.channel_name,
            "-n", self.chaincode_name,
            "-c", json.dumps(ctor),
            "--peerAddresses", "peer0.org1.example.com:7051",
            "--tlsRootCertFiles", "/work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt",
        ]
        
        result = self._run_peer_command(command, org="org1")
        
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
        ctor = {"Args": ["InspectionContract:getInspectionByPO", po_number]}
        command = [
            "chaincode", "query",
            "--tls",
            "--cafile", "/work/artifacts/orderer_tls_ca.crt",
            "-C", self.channel_name,
            "-n", self.chaincode_name,
            "-c", json.dumps(ctor),
            "--peerAddresses", "peer0.org1.example.com:7051",
            "--tlsRootCertFiles", "/work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt",
        ]
        
        result = self._run_peer_command(command, org="org1")
        
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
        ctor = {"Args": ["InspectionContract:verifyInspection", inspection_id]}
        command = [
            "chaincode", "query",
            "--tls",
            "--cafile", "/work/artifacts/orderer_tls_ca.crt",
            "-C", self.channel_name,
            "-n", self.chaincode_name,
            "-c", json.dumps(ctor),
            "--peerAddresses", "peer0.org1.example.com:7051",
            "--tlsRootCertFiles", "/work/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt",
        ]
        
        result = self._run_peer_command(command, org="org1")
        
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
