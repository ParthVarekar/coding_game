# ═══════════════════════════════════════════════════════════════
# Nexus-AI — Init & Dev Server Launch Script
# Run: powershell -ExecutionPolicy Bypass -File .\init.ps1
# ═══════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$projectDir = $PSScriptRoot
if (-not $projectDir) { $projectDir = Get-Location }

Write-Host ""
Write-Host "  ╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║         NEXUS-AI Dev Server          ║" -ForegroundColor Cyan
Write-Host "  ║   Foundational Python Learning Game  ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check for Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is required. Install from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Node.js $(node --version)" -ForegroundColor Green

# Check if package.json exists, if not initialize
if (-not (Test-Path "$projectDir\package.json")) {
    Write-Host "[INIT] Creating package.json..." -ForegroundColor Yellow
    Set-Location $projectDir
    npm init -y | Out-Null
    npm install --save-dev http-server | Out-Null
    Write-Host "[OK] Dependencies installed." -ForegroundColor Green
}

# Verify key files exist
$requiredFiles = @(
    "index.html",
    "css\index.css",
    "js\main.js",
    "js\state\GameState.js",
    "js\utils\EventBus.js"
)

$allPresent = $true
foreach ($file in $requiredFiles) {
    $filePath = Join-Path $projectDir $file
    if (Test-Path $filePath) {
        Write-Host "  [✓] $file" -ForegroundColor DarkGreen
    } else {
        Write-Host "  [✗] $file MISSING" -ForegroundColor Red
        $allPresent = $false
    }
}

if (-not $allPresent) {
    Write-Host "`n[ERROR] Missing files. Ensure the project is built correctly." -ForegroundColor Red
    exit 1
}

Write-Host "`n[OK] All project files verified." -ForegroundColor Green

# Start dev server
$port = 3000
Write-Host "`n[START] Launching dev server on http://localhost:$port ..." -ForegroundColor Cyan
Write-Host "[INFO] Press Ctrl+C to stop.`n" -ForegroundColor DarkGray

Set-Location $projectDir
npx -y http-server . -p $port -c-1 --cors -o
