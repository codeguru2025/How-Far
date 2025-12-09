# ============================================
# Ndeip-Zthin Setup Script (PowerShell)
# ============================================
# Run this script to set up your development environment
# Usage: .\scripts\setup.ps1
# ============================================

$ErrorActionPreference = "Stop"

Write-Host "🔧 Ndeip-Zthin Development Setup" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Node.js not found. Please install Node.js 18+" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js $nodeVersion" -ForegroundColor Green

# Check npm
Write-Host "Checking npm..." -ForegroundColor Yellow
$npmVersion = npm --version 2>$null
Write-Host "✅ npm $npmVersion" -ForegroundColor Green

# Install Expo CLI if needed
Write-Host "Checking Expo CLI..." -ForegroundColor Yellow
if (-not (Get-Command "expo" -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Expo CLI..." -ForegroundColor Gray
    npm install -g expo-cli
}
Write-Host "✅ Expo CLI installed" -ForegroundColor Green

# Install Supabase CLI if needed
Write-Host "Checking Supabase CLI..." -ForegroundColor Yellow
if (-not (Get-Command "supabase" -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Supabase CLI..." -ForegroundColor Gray
    npm install -g supabase
}
Write-Host "✅ Supabase CLI installed" -ForegroundColor Green

# Install EAS CLI if needed
Write-Host "Checking EAS CLI..." -ForegroundColor Yellow
if (-not (Get-Command "eas" -ErrorAction SilentlyContinue)) {
    Write-Host "Installing EAS CLI..." -ForegroundColor Gray
    npm install -g eas-cli
}
Write-Host "✅ EAS CLI installed" -ForegroundColor Green

# Install app dependencies
Write-Host ""
Write-Host "Installing app dependencies..." -ForegroundColor Yellow
Set-Location expo-app
npm install
Set-Location ..

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Copy expo-app/.env.example to expo-app/.env" -ForegroundColor Gray
Write-Host "  2. Fill in your Supabase and PayNow credentials" -ForegroundColor Gray
Write-Host "  3. Run: cd expo-app && npm start" -ForegroundColor Gray
Write-Host ""

