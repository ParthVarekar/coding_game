# ═══════════════════════════════════════════════════════════════
# Nexus-AI — Init & Dev Server Launch Script
# ═══════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$projectDir = $PSScriptRoot
if (-not $projectDir) { $projectDir = Get-Location }

Write-Host "`n  NEXUS-AI Dev Server Initializing...`n" -ForegroundColor Cyan

# Check for Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is required." -ForegroundColor Red
    exit 1
}

# Verify key files
$requiredFiles = @("index.html", "js\main.js", "css\index.css")
$allPresent = $true
foreach ($file in $requiredFiles) {
    if (-not (Test-Path (Join-Path $projectDir $file))) {
        Write-Host "[MISSING] $file" -ForegroundColor Red
        $allPresent = $false
    }
}

if (-not $allPresent) { exit 1 }

Write-Host "[OK] Project files verified." -ForegroundColor Green

# Start dev server
$port = 3000
Write-Host "[START] Launching on http://localhost:$port`n" -ForegroundColor Cyan

Set-Location $projectDir
node server.js
