import os
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from web3 import Web3
from web3.exceptions import Web3Exception, ContractLogicError

# Load environment variables from backend/.env
backend_root = Path(__file__).resolve().parent.parent
env_file = backend_root / ".env"
if env_file.exists():
    load_dotenv(env_file)
else:
    load_dotenv()

class BlockchainConfigurationError(Exception):
    """Raised when the Web3 RPC node is unreachable, unconfigured, or EVM execution fails."""
    pass

def _load_contract_abi() -> list:
    """Loads the contract ABI produced by forge build in contracts/out/AuditChain.sol/AuditChain.json."""
    project_root = Path(__file__).resolve().parent.parent.parent
    abi_path = project_root / "contracts" / "out" / "AuditChain.sol" / "AuditChain.json"
    
    if not abi_path.exists():
        raise BlockchainConfigurationError(
            f"Contract ABI artifact not found at {abi_path}. "
            "Please run the setup script ('scripts/setup_blockchain.ps1' or 'scripts/setup_blockchain.sh') "
            "to compile and deploy smart contracts."
        )
    
    try:
        with open(abi_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("abi", [])
    except Exception as e:
        raise BlockchainConfigurationError(f"Failed to read contract artifact: {e}")

def get_web3_client():
    """Initializes and returns (Web3 instance, contract instance, account object)."""
    rpc_url = os.getenv("WEB3_RPC_URL", "http://127.0.0.1:8545")
    contract_address = os.getenv("CONTRACT_ADDRESS", "").strip()
    owner_private_key = os.getenv("OWNER_PRIVATE_KEY", "").strip()

    if not contract_address:
        raise BlockchainConfigurationError(
            "CONTRACT_ADDRESS is not set in backend/.env. "
            "Please deploy AuditChain contract using the setup script ('scripts/setup_blockchain.ps1' or 'scripts/setup_blockchain.sh')."
        )

    if not owner_private_key:
        raise BlockchainConfigurationError(
            "OWNER_PRIVATE_KEY is not set in backend/.env. "
            "Please configure the NMC administrator / Anvil test account private key in backend/.env."
        )

    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        raise BlockchainConfigurationError(
            f"Cannot connect to Ethereum RPC node at {rpc_url}. "
            "Please ensure Anvil local blockchain node is running (run 'anvil' or execute the setup script)."
        )

    abi = _load_contract_abi()
    try:
        checksum_address = Web3.to_checksum_address(contract_address)
        contract = w3.eth.contract(address=checksum_address, abi=abi)
        account = w3.eth.account.from_key(owner_private_key)
    except Exception as e:
        raise BlockchainConfigurationError(f"Invalid Ethereum configuration or key: {e}")

    return w3, contract, account

def compute_data_hash(payload_str: str) -> str:
    """Computes a keccak256 hash string prefixed with 0x."""
    return Web3.keccak(text=payload_str).hex()

def lock_weighbridge_record(
    ticket_id: str,
    truck_id: str,
    contractor: str,
    weight_kg: float,
    timestamp: datetime,
    gps_route_id: Optional[str] = None,
    disposition: Optional[str] = None
) -> Dict[str, Any]:
    """
    Builds, signs, and broadcasts a real lockWeighbridgeRecord() transaction to the local blockchain.
    Returns transaction hash and confirmed block number.
    """
    w3, contract, account = get_web3_client()
    
    # Compute real cryptographic hashes for the payload (including disposition ruling)
    disp_tag = disposition or "cleared"
    data_payload = f"TICKET:{ticket_id}|TRUCK:{truck_id}|CONTRACTOR:{contractor}|WEIGHT:{weight_kg}|TIME:{timestamp.isoformat()}|DISPOSITION:{disp_tag}"
    gps_payload = f"ROUTE:{gps_route_id or 'DEFAULT'}|TRUCK:{truck_id}|TIME:{timestamp.isoformat()}"
    
    data_hash = compute_data_hash(data_payload)
    gps_route_hash = compute_data_hash(gps_payload)
    
    weight_int = int(round(weight_kg))
    time_int = int(timestamp.timestamp())
    
    try:
        # Check if already locked on-chain
        try:
            existing = contract.functions.getWeighbridgeRecord(ticket_id).call()
            if existing and existing[8]:  # exists flag
                return {
                    "tx_hash": compute_data_hash(f"LOCKED_ON_CHAIN:{ticket_id}:{existing[7]}"),
                    "block_number": existing[7],
                    "status": 1,
                    "already_locked": True
                }
        except Exception:
            pass  # Not yet locked on chain, proceed to write

        nonce = w3.eth.get_transaction_count(account.address)
        gas_price = w3.eth.gas_price

        # Build transaction with estimated gas
        tx_fn = contract.functions.lockWeighbridgeRecord(
            ticket_id,
            truck_id,
            contractor,
            weight_int,
            time_int,
            gps_route_hash,
            data_hash
        )

        try:
            gas_est = tx_fn.estimate_gas({'from': account.address})
            gas_limit = int(gas_est * 1.3)
        except Exception:
            gas_limit = 350000

        tx = tx_fn.build_transaction({
            'from': account.address,
            'nonce': nonce,
            'gasPrice': gas_price,
            'gas': gas_limit,
            'chainId': w3.eth.chain_id
        })

        signed_tx = w3.eth.account.sign_transaction(tx, private_key=account.key)
        tx_hash_bytes = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash_bytes, timeout=15)

        tx_hex = Web3.to_hex(tx_hash_bytes)
        if not tx_hex.startswith("0x"):
            tx_hex = f"0x{tx_hex}"

        if receipt.status != 1:
            raise BlockchainConfigurationError(f"EVM transaction reverted on-chain (tx: {tx_hex})")

        return {
            "tx_hash": tx_hex,
            "block_number": receipt.blockNumber,
            "status": receipt.status
        }
    except ContractLogicError as e:
        raise BlockchainConfigurationError(f"Smart contract reverted: {e}")
    except Web3Exception as e:
        raise BlockchainConfigurationError(f"Web3 transaction error: {e}")
    except Exception as e:
        raise BlockchainConfigurationError(f"Transaction broadcasting failed: {e}")

def lock_road_repair_record(
    repair_id: str,
    contractor: str,
    ward_name: str,
    location_gps: str,
    before_photo_url: str,
    after_photo_url: str,
    work_date: datetime,
    sla_expiry_date: datetime,
    disposition: Optional[str] = None
) -> Dict[str, Any]:
    """
    Builds, signs, and broadcasts a real lockRoadRepairRecord() transaction to the local blockchain.
    Returns transaction hash and confirmed block number.
    """
    w3, contract, account = get_web3_client()

    disp_tag = disposition or "cleared"
    before_photo_hash = compute_data_hash(f"{before_photo_url or 'NO_BEFORE_PHOTO'}|DISP:{disp_tag}")
    after_photo_hash = compute_data_hash(f"{after_photo_url or 'NO_AFTER_PHOTO'}|DISP:{disp_tag}")
    
    work_date_int = int(work_date.timestamp())
    sla_expiry_int = int(sla_expiry_date.timestamp())

    try:
        # Check if already locked on-chain
        try:
            existing = contract.functions.getRoadRepairRecord(repair_id).call()
            if existing and existing[10]:  # exists flag
                return {
                    "tx_hash": compute_data_hash(f"LOCKED_ON_CHAIN:{repair_id}:{existing[9]}"),
                    "block_number": existing[9],
                    "status": 1,
                    "already_locked": True
                }
        except Exception:
            pass  # Not yet locked on chain, proceed to write

        nonce = w3.eth.get_transaction_count(account.address)
        gas_price = w3.eth.gas_price

        tx_fn = contract.functions.lockRoadRepairRecord(
            repair_id,
            contractor,
            ward_name,
            location_gps,
            before_photo_hash,
            after_photo_hash,
            work_date_int,
            sla_expiry_int
        )

        try:
            gas_est = tx_fn.estimate_gas({'from': account.address})
            gas_limit = int(gas_est * 1.3)
        except Exception:
            gas_limit = 400000

        tx = tx_fn.build_transaction({
            'from': account.address,
            'nonce': nonce,
            'gasPrice': gas_price,
            'gas': gas_limit,
            'chainId': w3.eth.chain_id
        })

        signed_tx = w3.eth.account.sign_transaction(tx, private_key=account.key)
        tx_hash_bytes = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash_bytes, timeout=15)

        tx_hex = Web3.to_hex(tx_hash_bytes)
        if not tx_hex.startswith("0x"):
            tx_hex = f"0x{tx_hex}"

        if receipt.status != 1:
            raise BlockchainConfigurationError(f"EVM transaction reverted on-chain (tx: {tx_hex})")

        return {
            "tx_hash": tx_hex,
            "block_number": receipt.blockNumber,
            "status": receipt.status
        }
    except ContractLogicError as e:
        raise BlockchainConfigurationError(f"Smart contract reverted: {e}")
    except Web3Exception as e:
        raise BlockchainConfigurationError(f"Web3 transaction error: {e}")
    except Exception as e:
        raise BlockchainConfigurationError(f"Transaction broadcasting failed: {e}")
