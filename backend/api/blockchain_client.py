"""
Hyperledger Fabric Blockchain Client
Handles interaction with Fabric network for recording inspection results
"""

import os
import json
import subprocess
from typing import Dict, List, Optional
from datetime import datetime
from dataclasses import dataclass
from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class FabricOrgConfig:
    """Runtime Fabric peer identity and connection settings loaded from env."""

    name: str
    peer_container: str
    local_msp_id: str
    tls_enabled: str
    tls_root_cert_file: str
    msp_config_path: str
    peer_address: str


class BlockchainClient:
    """Client for interacting with Hyperledger Fabric network"""
    
    def __init__(self):
        self.channel_name = self._required_env("FABRIC_CHANNEL_NAME")
        self.chaincode_name = self._required_env("FABRIC_CHAINCODE_NAME")
        self.orderer_address = self._required_env("FABRIC_ORDERER_ADDRESS")
        self.orderer_tls_ca_file = self._required_env("FABRIC_ORDERER_TLS_CA_FILE")
        self.submit_org = os.getenv("FABRIC_SUBMIT_ORG", "org1")
        self.query_org = os.getenv("FABRIC_QUERY_ORG", self.submit_org)
        self.peer_cli_mode = os.getenv("FABRIC_PEER_CLI_MODE", "docker").lower()
        self.peer_cli_binary = os.getenv("FABRIC_PEER_CLI_BINARY", "peer")
        self.docker_binary = os.getenv("FABRIC_DOCKER_BINARY", "docker")
        self.connection_profile_path = os.getenv("FABRIC_CONNECTION_PROFILE")
        self.network_dir = os.getenv("FABRIC_NETWORK_DIR")
        self.command_timeout_seconds = int(os.getenv("FABRIC_COMMAND_TIMEOUT_SECONDS", "60"))
        self.invoke_peer_addresses = self._env_list("FABRIC_INVOKE_PEER_ADDRESSES")
        self.invoke_tls_root_cert_files = self._env_list("FABRIC_INVOKE_TLS_ROOT_CERT_FILES")
        self.query_peer_address = os.getenv("FABRIC_QUERY_PEER_ADDRESS")
        self.query_tls_root_cert_file = os.getenv("FABRIC_QUERY_TLS_ROOT_CERT_FILE")

    @staticmethod
    def _required_env(name: str) -> str:
        value = os.getenv(name)
        if not value:
            raise RuntimeError(f"{name} must be set for Fabric integration")
        return value

    @staticmethod
    def _env_list(name: str) -> List[str]:
        value = os.getenv(name, "")
        return [item.strip() for item in value.split(",") if item.strip()]

    @staticmethod
    def _org_env_name(org: str, suffix: str) -> str:
        return f"FABRIC_{org.upper()}_{suffix}"

    def _load_org_config(self, org: str) -> FabricOrgConfig:
        return FabricOrgConfig(
            name=org,
            peer_container=self._required_env(self._org_env_name(org, "PEER_CONTAINER")),
            local_msp_id=self._required_env(self._org_env_name(org, "LOCAL_MSP_ID")),
            tls_enabled=os.getenv(self._org_env_name(org, "TLS_ENABLED"), "true"),
            tls_root_cert_file=self._required_env(self._org_env_name(org, "TLS_ROOTCERT_FILE")),
            msp_config_path=self._required_env(self._org_env_name(org, "MSPCONFIGPATH")),
            peer_address=self._required_env(self._org_env_name(org, "PEER_ADDRESS")),
        )

    def _peer_env(self, org_config: FabricOrgConfig) -> Dict[str, str]:
        env_vars = {
            "CORE_PEER_LOCALMSPID": org_config.local_msp_id,
            "CORE_PEER_TLS_ENABLED": org_config.tls_enabled,
            "CORE_PEER_TLS_ROOTCERT_FILE": org_config.tls_root_cert_file,
            "CORE_PEER_MSPCONFIGPATH": org_config.msp_config_path,
            "CORE_PEER_ADDRESS": org_config.peer_address,
        }
        if self.connection_profile_path:
            env_vars["FABRIC_CONNECTION_PROFILE"] = self.connection_profile_path
        return env_vars

    def _peer_command_args(self, env_vars: Dict[str, str], org_config: FabricOrgConfig, command: List[str]) -> List[str]:
        if self.peer_cli_mode == "docker":
            docker_cmd = [self.docker_binary, "exec"]
            for key, value in env_vars.items():
                docker_cmd.extend(["-e", f"{key}={value}"])
            return docker_cmd + [org_config.peer_container, self.peer_cli_binary] + command

        if self.peer_cli_mode == "local":
            return [self.peer_cli_binary] + command

        raise RuntimeError("FABRIC_PEER_CLI_MODE must be either 'docker' or 'local'")

    def _chaincode_command(self, action: str, args: List[str], include_endorsement_peers: bool = False) -> List[str]:
        ctor = {"Args": args}
        command = [
            "chaincode", action,
            "--tls",
            "--cafile", self.orderer_tls_ca_file,
            "-C", self.channel_name,
            "-n", self.chaincode_name,
            "-c", json.dumps(ctor),
        ]

        if action == "invoke":
            command[2:2] = ["-o", self.orderer_address]

        if include_endorsement_peers:
            if len(self.invoke_peer_addresses) != len(self.invoke_tls_root_cert_files):
                raise RuntimeError(
                    "FABRIC_INVOKE_PEER_ADDRESSES and FABRIC_INVOKE_TLS_ROOT_CERT_FILES must have the same number of entries"
                )
            for peer_address, tls_root_cert_file in zip(self.invoke_peer_addresses, self.invoke_tls_root_cert_files):
                command.extend(["--peerAddresses", peer_address, "--tlsRootCertFiles", tls_root_cert_file])
        elif self.query_peer_address and self.query_tls_root_cert_file:
            command.extend(["--peerAddresses", self.query_peer_address, "--tlsRootCertFiles", self.query_tls_root_cert_file])

        return command

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
        Execute a peer command using the configured Fabric CLI runtime.
        
        Args:
            command: List of command arguments
            org: Organization key configured with FABRIC_<ORG>_* variables
        
        Returns:
            Dict with success status and result/error
        """
        try:
            org_config = self._load_org_config(org)
            env_vars = self._peer_env(org_config)
            peer_cmd = self._peer_command_args(env_vars, org_config, command)
            command_env = os.environ.copy()
            command_env.update(env_vars)

            result = subprocess.run(
                peer_cmd,
                capture_output=True,
                text=True,
                timeout=self.command_timeout_seconds,
                cwd=self.network_dir or None,
                env=command_env,
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
        command = self._chaincode_command("invoke", args, include_endorsement_peers=True)
        return self._run_peer_command(command, org=self.submit_org)

    def _query_contract(self, args: List[str]) -> Dict:
        command = self._chaincode_command("query", args)
        return self._run_peer_command(command, org=self.query_org)

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
        result = self._invoke_contract([
            "InspectionContract:recordInspection",
            inspection_id,
            po_number,
            inspection_date,
            inspected_by,
            status,
            items_json,
            overall_remarks or "",
        ])
        
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
        result = self._query_contract(["InspectionContract:getInspection", inspection_id])
        
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
        result = self._query_contract(["InspectionContract:getInspectionByPO", po_number])
        
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
        result = self._query_contract(["InspectionContract:verifyInspection", inspection_id])
        
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
