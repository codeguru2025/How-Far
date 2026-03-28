# Infobip 2FA Setup Script
# This script creates the 2FA application and message template

$API_KEY = "68a771e5c1ee35f340557d4ed9677be4-01ec3776-a601-434a-9d8a-ae7306439f1c"
$BASE_URL = "1gvn8k.api.infobip.com"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Infobip 2FA Setup for How Far" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$headers = @{
    "Authorization" = "App $API_KEY"
    "Content-Type" = "application/json"
}

# Step 1: Create 2FA Application
Write-Host "Step 1: Creating 2FA Application..." -ForegroundColor Yellow

$appBody = @{
    name = "How Far OTP"
    enabled = $true
    configuration = @{
        pinAttempts = 5
        allowMultiplePinVerifications = $false
        pinTimeToLive = "10m"
        verifyPinLimit = "1/3s"
        sendPinPerApplicationLimit = "10000/1d"
        sendPinPerPhoneNumberLimit = "5/1d"
    }
} | ConvertTo-Json -Depth 3

try {
    $appResponse = Invoke-RestMethod -Uri "https://$BASE_URL/2fa/2/applications" -Method POST -Headers $headers -Body $appBody -ErrorAction Stop
    
    $APP_ID = $appResponse.applicationId
    
    Write-Host "SUCCESS! Application created." -ForegroundColor Green
    Write-Host "Application ID: $APP_ID" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host "ERROR creating application:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    
    # Try to read error response
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        Write-Host $errorBody -ForegroundColor Red
    }
    exit 1
}

# Step 2: Create Message Template
Write-Host "Step 2: Creating Message Template..." -ForegroundColor Yellow

$msgBody = @{
    messageText = "Your How Far verification code is: {{pin}}. Valid for 10 minutes. Do not share this code."
    pinLength = 6
    pinType = "NUMERIC"
    senderId = "HowFar"
    language = "en"
} | ConvertTo-Json

try {
    $msgResponse = Invoke-RestMethod -Uri "https://$BASE_URL/2fa/2/applications/$APP_ID/messages" -Method POST -Headers $headers -Body $msgBody -ErrorAction Stop
    
    $MSG_ID = $msgResponse.messageId
    
    Write-Host "SUCCESS! Message template created." -ForegroundColor Green
    Write-Host "Message ID: $MSG_ID" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host "ERROR creating message template:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        Write-Host $errorBody -ForegroundColor Red
    }
    exit 1
}

# Output results
Write-Host "========================================" -ForegroundColor Green
Write-Host "  SETUP COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Save these values - you'll need them for Supabase secrets:" -ForegroundColor Yellow
Write-Host ""
Write-Host "INFOBIP_API_KEY=$API_KEY" -ForegroundColor Cyan
Write-Host "INFOBIP_BASE_URL=$BASE_URL" -ForegroundColor Cyan
Write-Host "INFOBIP_2FA_APP_ID=$APP_ID" -ForegroundColor Cyan
Write-Host "INFOBIP_2FA_MESSAGE_ID=$MSG_ID" -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Green

# Save to file for reference
$output = @"
# Infobip Configuration for How Far
# Generated: $(Get-Date)

INFOBIP_API_KEY=$API_KEY
INFOBIP_BASE_URL=$BASE_URL
INFOBIP_2FA_APP_ID=$APP_ID
INFOBIP_2FA_MESSAGE_ID=$MSG_ID

# To set in Supabase, run:
# supabase secrets set INFOBIP_API_KEY="$API_KEY"
# supabase secrets set INFOBIP_BASE_URL="$BASE_URL"
# supabase secrets set INFOBIP_2FA_APP_ID="$APP_ID"
# supabase secrets set INFOBIP_2FA_MESSAGE_ID="$MSG_ID"
"@

$output | Out-File -FilePath "infobip-config.txt" -Encoding UTF8
Write-Host "Configuration saved to: infobip-config.txt" -ForegroundColor Gray
Write-Host ""

