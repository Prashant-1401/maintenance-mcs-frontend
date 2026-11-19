param(
  [Parameter(Mandatory = $true)][ValidateSet('start', 'stop')][string]$Action
)

# Maintenance Reliability App - demo launcher
# start : clean-starts database + API + web, waits until ready, opens the browser
# stop  : shuts everything down (data is kept)

$ErrorActionPreference = 'Continue'
$root    = Split-Path -Parent $PSScriptRoot
$apiDir  = Join-Path $root 'apps\api'
$webDir  = Join-Path $root 'apps\web'
$logDir  = Join-Path $root 'logs'
$dbPort  = 51214
$apiPort = 3000
$webPort = 5173
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Say($msg) { Write-Host ("  " + $msg) }

function Test-Port([int]$port) {
  $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  return [bool]$c
}

function Stop-Port([int]$port) {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}

function Wait-Port([int]$port, [int]$seconds) {
  for ($i = 0; $i -lt $seconds; $i++) {
    if (Test-Port $port) { return $true }
    Start-Sleep -Seconds 1
  }
  return $false
}

function Wait-Http([string]$url, [int]$seconds) {
  for ($i = 0; $i -lt $seconds; $i++) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
      if ($r.StatusCode -ge 200) { return $true }
    } catch {
      # 401/404 still means the server is answering
      if ($_.Exception.Response) { return $true }
    }
    Start-Sleep -Seconds 1
  }
  return $false
}

# Run a prisma-dev command but never wait on it for more than $seconds (it can occasionally hang).
function Invoke-PrismaDev([string]$verb, [int]$seconds) {
  $p = Start-Process -FilePath 'cmd.exe' -ArgumentList ('/c npx prisma dev ' + $verb + ' maintenance') -WorkingDirectory $apiDir `
    -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir 'db.log') -RedirectStandardError (Join-Path $logDir 'db-error.log')
  if (-not $p.WaitForExit($seconds * 1000)) {
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  }
}

function Stop-All {
  Say 'Stopping app servers...'
  Stop-Port $webPort
  Stop-Port $apiPort
  Say 'Stopping database...'
  Invoke-PrismaDev 'stop' 40
  Stop-Port $dbPort
  Start-Sleep -Seconds 2
}

function Start-Database {
  Say 'Starting database (about 30-60 seconds)...'
  for ($try = 1; $try -le 4; $try++) {
    if (-not (Test-Port $dbPort)) { Invoke-PrismaDev 'start' 60 }
    if (Wait-Port $dbPort 30) { return $true }
    Say ("  database not ready yet (attempt $try of 4)...")
  }
  return (Test-Port $dbPort)
}

function Start-Api {
  Say 'Starting application server...'
  $entry = Join-Path $apiDir 'dist\src\main.js'
  if (-not (Test-Path $entry)) { $entry = Join-Path $apiDir 'dist\main.js' }
  if (-not (Test-Path $entry)) { Say 'ERROR: app is not built (run: npm run build:api)'; return $false }
  Start-Process -FilePath 'node' -ArgumentList ('"' + $entry + '"') -WorkingDirectory $apiDir -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir 'api.log') -RedirectStandardError (Join-Path $logDir 'api-error.log')
  return (Wait-Port $apiPort 60)
}

function Start-Web {
  Say 'Starting web pages...'
  $vite = Join-Path $root 'node_modules\vite\bin\vite.js'
  if (-not (Test-Path (Join-Path $webDir 'dist\index.html'))) { Say 'ERROR: web is not built (run: npm run build:web)'; return $false }
  Start-Process -FilePath 'node' -ArgumentList ('"' + $vite + '" preview --port ' + $webPort + ' --strictPort') -WorkingDirectory $webDir -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir 'web.log') -RedirectStandardError (Join-Path $logDir 'web-error.log')
  return (Wait-Port $webPort 30)
}

if ($Action -eq 'stop') {
  Stop-All
  Say 'Demo stopped. Your data is saved.'
  exit 0
}

Write-Host ''
Write-Host '  Maintenance Reliability App - starting demo' -ForegroundColor Cyan
Write-Host ''
Stop-All

if (-not (Start-Database)) { Say 'Could not start the database. Please run Fix-Demo again or contact support.'; exit 1 }
if (-not (Start-Api))      { Say 'Could not start the application server. See logs\api-error.log'; exit 1 }
if (-not (Start-Web))      { Say 'Could not start the web pages. See logs\web-error.log'; exit 1 }

Say 'Warming up...'
Wait-Http "http://localhost:$apiPort" 30 | Out-Null

Start-Process "http://localhost:$webPort"
Write-Host ''
Write-Host '  READY - the app is open in your browser.' -ForegroundColor Green
Write-Host '  Login: admin@maintenance.local   Password: password123'
Write-Host '  (Use Stop-Demo when you are done. If anything looks stuck, run Fix-Demo.)'
Write-Host ''
Start-Sleep -Seconds 6
