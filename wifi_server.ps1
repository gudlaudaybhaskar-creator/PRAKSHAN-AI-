param(
    [int]$Port = 8080
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$dashboardDir = Join-Path $scriptDir "dashboard"

# Determine local IP address
$localIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.InterfaceAlias -match 'WiFi|Wireless|Ethernet' -and $_.IPAddress -notmatch '^169\.254' -and $_.IPAddress -notmatch '^127\.' 
} | Select-Object -First 1).IPAddress

if (-not $localIp) {
    $localIp = "127.0.0.1"
}

Write-Host "=========================================================" -ForegroundColor Green
Write-Host "  PRAKASHAN AI - Wireless Wi-Fi Web & Telemetry Server" -ForegroundColor Cyan
Write-Host "  Drying solutions for global agriculture" -ForegroundColor Yellow
Write-Host "=========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  [+] Dashboard Directory: $dashboardDir" -ForegroundColor White
Write-Host "  [+] Local Access URL:   http://localhost:$Port" -ForegroundColor Green
Write-Host "  [+] Wireless Wi-Fi URL: http://${localIp}:${Port}" -ForegroundColor Yellow
Write-Host "  [+] Telemetry API:      http://${localIp}:${Port}/api/telemetry" -ForegroundColor Cyan
Write-Host ""
Write-Host "  --> On your Phone / APK: Open Chrome and go to:" -ForegroundColor White
Write-Host "      http://${localIp}:${Port}" -ForegroundColor Yellow -BackgroundColor Black
Write-Host ""
Write-Host "  Press Ctrl+C to stop the server anytime." -ForegroundColor Gray
Write-Host "=========================================================" -ForegroundColor Green

# Create HttpListener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://*:$Port/")

try {
    $listener.Start()
} catch {
    # If http://*:8080/ requires elevation, fallback to localhost + local IP
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$Port/")
    $listener.Prefixes.Add("http://127.0.0.1:$Port/")
    try {
        $listener.Prefixes.Add("http://${localIp}:$Port/")
        $listener.Start()
    } catch {
        Write-Host "Note: Running on localhost. For multi-device access, run PowerShell as Administrator once." -ForegroundColor Yellow
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add("http://localhost:$Port/")
        $listener.Start()
    }
}

# Live telemetry state for Wi-Fi streaming
$telemetry = @{
    temp = 36.8
    hum = 44.5
    moist = 18.2
    target_moist = 13.0
    solar_pct = 82
    bat_v = 12.65
    pv_v = 18.20
    fan = 1
    vent = 45
    state = "DRYING"
    seed = "PADDY"
    elapsed_s = 120
}

$startTime = Get-Date

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # CORS Headers for APK & external fetch
        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.AddHeader("Access-Control-Allow-Headers", "Content-Type")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        $rawUrl = $request.RawUrl
        $path = $rawUrl.Split('?')[0]

        if ($path -eq "/api/telemetry") {
            # Update dynamic telemetry
            $elapsed = [math]::Round(((Get-Date) - $startTime).TotalSeconds)
            $telemetry["elapsed_s"] = $elapsed
            
            # Subtle realistic oscillation
            $telemetry["temp"] = [math]::Round(35.5 + [math]::Sin($elapsed / 30) * 2.5, 1)
            $telemetry["hum"] = [math]::Round(45.0 - [math]::Sin($elapsed / 30) * 3.0, 1)
            $telemetry["moist"] = [math]::Round([math]::Max(13.0, 18.2 - ($elapsed * 0.005)), 1)
            $telemetry["solar_pct"] = [math]::Round(80 + [math]::Sin($elapsed / 60) * 10)

            $jsonString = $telemetry | ConvertTo-Json -Compress
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonString)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # Static file serving from dashboard
        if ($path -eq "/" -or $path -eq "") {
            $path = "/index.html"
        }

        $filePath = Join-Path $dashboardDir ($path.TrimStart('/').Replace('/', '\'))

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = "application/octet-stream"
            switch ($ext) {
                ".html" { $contentType = "text/html; charset=utf-8" }
                ".htm"  { $contentType = "text/html; charset=utf-8" }
                ".js"   { $contentType = "application/javascript; charset=utf-8" }
                ".css"  { $contentType = "text/css; charset=utf-8" }
                ".json" { $contentType = "application/json; charset=utf-8" }
                ".jpg"  { $contentType = "image/jpeg" }
                ".jpeg" { $contentType = "image/jpeg" }
                ".png"  { $contentType = "image/png" }
                ".svg"  { $contentType = "image/svg+xml" }
                ".csv"  { $contentType = "text/csv; charset=utf-8" }
            }

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($notFound, 0, $notFound.Length)
        }

        $response.Close()
    } catch {
        # Catch client disconnects without crashing server
    }
}
