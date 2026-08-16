# ==============================================================================
# AuditChain Nagpur - Local Blockchain Automated Setup Script (PowerShell)
# ==============================================================================
# 1. Verifies Foundry (forge, anvil, cast) installation.
# 2. Checks/starts local Anvil blockchain node on port 8545.
# 3. Compiles smart contracts using forge.
# 4. Deploys AuditChain.sol using the NMC administrator test account.
# 5. Generates backend/.env with the deployed contract address.
# ==============================================================================

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$ContractsDir = Join-Path $ProjectRoot "contracts"
$BackendDir = Join-Path $ProjectRoot "backend"

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host " [NMC] AuditChain Nagpur - Local Blockchain Deployment Setup" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

# 1. Discover Foundry binaries in PATH or ~/.foundry/bin
$FoundryBin = Join-Path $env:USERPROFILE ".foundry\bin"
if (Test-Path $FoundryBin) {
    if ($env:PATH -notlike "*$FoundryBin*") {
        $env:PATH = "$FoundryBin;$env:PATH"
    }
}

$ForgeCmd = Get-Command "forge" -ErrorAction SilentlyContinue
$AnvilCmd = Get-Command "anvil" -ErrorAction SilentlyContinue
$CastCmd = Get-Command "cast" -ErrorAction SilentlyContinue

if (-not $ForgeCmd -or -not $AnvilCmd) {
    Write-Host "[ERROR] Foundry toolchain (forge/anvil/cast) not found." -ForegroundColor Red
    Write-Host "Please install Foundry using the following command:" -ForegroundColor Yellow
    Write-Host "  curl -L https://foundry.paradigm.xyz | bash && foundryup" -ForegroundColor White
    Write-Host "After installation completes, re-run this setup script." -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Foundry tools detected: forge, anvil, cast." -ForegroundColor Green

# 2. Check if Anvil is already running on port 8545
$RpcUrl = "http://127.0.0.1:8545"
$AnvilRunning = $false

try {
    $TestReq = [System.Net.WebRequest]::Create($RpcUrl)
    $TestReq.Method = "POST"
    $TestReq.ContentType = "application/json"
    $TestReq.Timeout = 1500
    $BodyBytes = [System.Text.Encoding]::UTF8.GetBytes('{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}')
    $Stream = $TestReq.GetRequestStream()
    $Stream.Write($BodyBytes, 0, $BodyBytes.Length)
    $Stream.Close()
    $Resp = $TestReq.GetResponse()
    $Resp.Close()
    $AnvilRunning = $true
} catch {
    $AnvilRunning = $false
}

if ($AnvilRunning) {
    Write-Host "[OK] Anvil Ethereum node is already active on port 8545." -ForegroundColor Green
} else {
    Write-Host "[INFO] Starting Anvil Ethereum node on port 8545 in background..." -ForegroundColor Yellow
    Start-Process -FilePath "anvil" -ArgumentList "--port 8545 --state anvil-state.json" -WindowStyle Hidden
    Start-Sleep -Seconds 2
    Write-Host "[OK] Anvil node started." -ForegroundColor Green
}

# 3. Build contracts
Write-Host "[INFO] Compiling Solidity smart contracts in contracts/..." -ForegroundColor Yellow
Push-Location $ContractsDir
try {
    & forge build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] forge build failed." -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}
Write-Host "[OK] Smart contracts compiled successfully." -ForegroundColor Green

# 4. Deploy AuditChain.sol to Anvil
$AnvilKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
Write-Host "[INFO] Deploying AuditChain.sol contract to Anvil..." -ForegroundColor Yellow

Push-Location $ContractsDir
$DeployOutput = ""
try {
    $DeployOutput = & forge create src/AuditChain.sol:AuditChain --rpc-url $RpcUrl --private-key $AnvilKey --broadcast 2>&1 | Out-String
} finally {
    Pop-Location
}

# 5. Extract Deployed Address
$ContractAddress = ""
if ($DeployOutput -match "Deployed to:\s*(0x[0-9a-fA-F]{40})") {
    $ContractAddress = $Matches[1]
} else {
    Write-Host "[ERROR] Could not extract deployed contract address from forge output:" -ForegroundColor Red
    Write-Host $DeployOutput -ForegroundColor White
    exit 1
}

Write-Host "[SUCCESS] AuditChain.sol deployed at: $ContractAddress" -ForegroundColor Green

# 6. Write backend/.env
$EnvFilePath = Join-Path $BackendDir ".env"
$EnvContent = @"
# AuditChain Nagpur - Local Blockchain Environment Configuration
# Automatically generated on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
WEB3_RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=$ContractAddress
OWNER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
"@

Set-Content -Path $EnvFilePath -Value $EnvContent -Encoding UTF8
Write-Host "[OK] Configuration written to backend/.env." -ForegroundColor Green

# 7. Final Summary
Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host " Blockchain Setup Completed Successfully" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host " RPC URL:          $RpcUrl" -ForegroundColor White
Write-Host " Contract Address: $ContractAddress" -ForegroundColor White
Write-Host " Deployer/Owner:   0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (NMC Admin)" -ForegroundColor White
Write-Host " Configuration:    $EnvFilePath" -ForegroundColor White
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "You can now start/restart the backend server." -ForegroundColor Green
