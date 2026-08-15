#!/usr/bin/env bash
# ==============================================================================
# AuditChain Nagpur - Local Blockchain Automated Setup Script (Bash)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTRACTS_DIR="$PROJECT_ROOT/contracts"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "===================================================================="
echo " [NMC] AuditChain Nagpur - Local Blockchain Deployment Setup"
echo "===================================================================="

# 1. Discover Foundry binaries in PATH or ~/.foundry/bin
if [ -d "$HOME/.foundry/bin" ]; then
    export PATH="$HOME/.foundry/bin:$PATH"
fi

if ! command -v forge &>/dev/null || ! command -v anvil &>/dev/null; then
    echo "[ERROR] Foundry toolchain (forge/anvil/cast) not found."
    echo "Please install Foundry using the following command:"
    echo "  curl -L https://foundry.paradigm.xyz | bash && foundryup"
    echo "After installation completes, re-run this setup script."
    exit 1
fi

echo "[OK] Foundry tools detected: forge, anvil, cast."

# 2. Check if Anvil node is running on port 8545
RPC_URL="http://127.0.0.1:8545"
if curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    "$RPC_URL" &>/dev/null; then
    echo "[OK] Anvil Ethereum node is already active on port 8545."
else
    echo "[INFO] Starting Anvil Ethereum node on port 8545 in background..."
    anvil --port 8545 > /dev/null 2>&1 &
    sleep 2
    echo "[OK] Anvil node started."
fi

# 3. Build smart contracts
echo "[INFO] Compiling Solidity smart contracts in contracts/..."
(cd "$CONTRACTS_DIR" && forge build)
echo "[OK] Smart contracts compiled successfully."

# 4. Deploy AuditChain.sol to Anvil
ANVIL_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
echo "[INFO] Deploying AuditChain.sol contract to Anvil..."
DEPLOY_OUTPUT=$(cd "$CONTRACTS_DIR" && forge create src/AuditChain.sol:AuditChain --rpc-url "$RPC_URL" --private-key "$ANVIL_KEY" --broadcast 2>&1)

# 5. Extract Deployed Address
CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oE "Deployed to: 0x[0-9a-fA-F]{40}" | awk '{print $3}')

if [ -z "$CONTRACT_ADDRESS" ]; then
    echo "[ERROR] Could not extract deployed contract address from forge output:"
    echo "$DEPLOY_OUTPUT"
    exit 1
fi

echo "[SUCCESS] AuditChain.sol deployed at: $CONTRACT_ADDRESS"

# 6. Write backend/.env
ENV_FILE="$BACKEND_DIR/.env"
cat <<EOF > "$ENV_FILE"
# AuditChain Nagpur - Local Blockchain Environment Configuration
# Automatically generated on $(date)
WEB3_RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=$CONTRACT_ADDRESS
OWNER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
EOF

echo "[OK] Configuration written to backend/.env."

# 7. Summary
echo ""
echo "===================================================================="
echo " Blockchain Setup Completed Successfully"
echo "===================================================================="
echo " RPC URL:          $RPC_URL"
echo " Contract Address: $CONTRACT_ADDRESS"
echo " Deployer/Owner:   0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (NMC Admin)"
echo " Configuration:    $ENV_FILE"
echo "===================================================================="
echo "You can now start/restart the backend server."
