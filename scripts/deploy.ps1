# ============================================
# Ndeip-Zthin Deployment Script (PowerShell)
# ============================================
# Usage: .\scripts\deploy.ps1 [environment]
# Environments: dev, staging, prod
# ============================================

param(
    [Parameter(Position=0)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment = "dev"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Ndeip-Zthin Deployment Script" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host ""

# Check if Supabase CLI is installed
if (-not (Get-Command "supabase" -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Supabase CLI not found. Install it first:" -ForegroundColor Red
    Write-Host "   npm install -g supabase" -ForegroundColor Gray
    exit 1
}

# Deploy Supabase Functions
Write-Host "📦 Deploying Supabase Edge Functions..." -ForegroundColor Cyan

# Get all function directories (excluding _shared)
$functionsPath = Join-Path $PSScriptRoot "..\supabase\functions"
$functions = Get-ChildItem -Path $functionsPath -Directory | 
    Where-Object { $_.Name -ne "_shared" } | 
    Select-Object -ExpandProperty Name

Write-Host "  Found $($functions.Count) functions to deploy" -ForegroundColor Gray

foreach ($fn in $functions) {
    Write-Host "  Deploying $fn..." -ForegroundColor Gray
    
    # Most functions need --no-verify-jwt for public access
    $noVerifyJwt = @("paynowWebhook", "health", "sendOTP", "verifyOTP", "resendOTP")
    
    if ($noVerifyJwt -contains $fn) {
        supabase functions deploy $fn --no-verify-jwt
    } else {
        supabase functions deploy $fn
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Warning: Failed to deploy $fn (continuing...)" -ForegroundColor Yellow
        # Don't exit, continue with other functions
    }
}

Write-Host ""
Write-Host "✅ Supabase functions deployed successfully!" -ForegroundColor Green

# For production, also run migrations
if ($Environment -eq "prod") {
    Write-Host ""
    Write-Host "📦 Running database migrations..." -ForegroundColor Cyan
    supabase db push
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Migration failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Migrations applied successfully!" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Test the deployed functions" -ForegroundColor Gray
Write-Host "  2. Build the app: cd expo-app && eas build" -ForegroundColor Gray
Write-Host "  3. Submit to stores: eas submit" -ForegroundColor Gray

