$ErrorActionPreference = "Stop"

$SiteRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodePath = "C:\Users\76724\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$BrowserPath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$Url = "http://127.0.0.1:4173/"

if (-not (Test-Path -LiteralPath $NodePath)) {
  throw "Node.js was not found at $NodePath"
}

if (-not (Test-Path -LiteralPath $BrowserPath)) {
  throw "Microsoft Edge was not found at $BrowserPath"
}

if (-not $env:SITE_ADMIN_PASSWORD) {
  $env:SITE_ADMIN_PASSWORD = [Environment]::GetEnvironmentVariable("SITE_ADMIN_PASSWORD", "User")
}

if (-not $env:SESSION_SECRET) {
  $env:SESSION_SECRET = [Environment]::GetEnvironmentVariable("SESSION_SECRET", "User")
}

$listener = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue
if (-not $listener) {
  Start-Process -FilePath $NodePath -ArgumentList "server.js" -WorkingDirectory $SiteRoot -WindowStyle Hidden
  Start-Sleep -Seconds 2
}

Start-Process -FilePath $BrowserPath -ArgumentList @(
  "--app=$Url",
  "--window-size=430,760",
  "--window-position=60,40",
  "--no-first-run"
)
