# KPR Pitstop installer / updater. Run "Install KPR Pitstop.cmd" (double-click).
# Program files are replaced on every install; the data folder is never touched.
param(
  [string]$Target = "C:\KPR Pitstop",
  [switch]$NoStartup
)
$ErrorActionPreference = "Stop"
$src = Join-Path $PSScriptRoot "program"
$program = Join-Path $Target "program"
$data = Join-Path $Target "data"

Write-Host ""
Write-Host "  KPR Pitstop - installing to $Target" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $src)) { throw "The 'program' folder is missing next to this installer. Extract the whole ZIP first." }

# 1. Stop a running copy (update case)
$vbsOld = Join-Path $program "KPR Pitstop.vbs"
if (Test-Path $vbsOld) {
  Write-Host "  Stopping the running app..."
  & (Join-Path $program "node\node.exe") (Join-Path $program "launcher.js") --stop
  Start-Sleep -Seconds 2
}

# 2. Copy program files (data folder is left alone)
New-Item -ItemType Directory -Force -Path $Target, $data | Out-Null
Write-Host "  Copying program files (this can take a minute)..."
robocopy $src $program /MIR /NFL /NDL /NJH /NJS /NP /R:2 /W:2 | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Copying files failed (robocopy code $LASTEXITCODE)." }

# 3. Shortcuts
$shell = New-Object -ComObject WScript.Shell
function New-Shortcut($path, $arguments, $name) {
  try {
    if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
    $s = $shell.CreateShortcut($path)
    $s.TargetPath = "$env:WINDIR\System32\wscript.exe"
    $s.Arguments = "`"$program\KPR Pitstop.vbs`" $arguments".Trim()
    $s.WorkingDirectory = $program
    $s.IconLocation = "$program\kpr.ico,0"
    $s.Description = $name
    $s.Save()
  } catch {
    # Antivirus / Windows security sometimes blocks shortcut changes; the app still works without it
    Write-Host "  Could not create shortcut: $path" -ForegroundColor Yellow
  }
}
$desktop = [Environment]::GetFolderPath("Desktop")
$startMenu = Join-Path ([Environment]::GetFolderPath("Programs")) "KPR Pitstop"
New-Item -ItemType Directory -Force -Path $startMenu | Out-Null
New-Shortcut (Join-Path $desktop "KPR Pitstop.lnk") "" "Open KPR Pitstop"
New-Shortcut (Join-Path $startMenu "KPR Pitstop.lnk") "" "Open KPR Pitstop"
New-Shortcut (Join-Path $startMenu "Stop KPR Pitstop.lnk") "--stop" "Stop the KPR Pitstop background service"
# Forgotten password tool: opens a console window on this PC only
try {
  $r = Join-Path $startMenu "Reset KPR password.lnk"
  if (Test-Path -LiteralPath $r) { Remove-Item -LiteralPath $r -Force }
  $s = $shell.CreateShortcut($r)
  $s.TargetPath = "$program\node\node.exe"
  $s.Arguments = "`"$program\launcher.js`" --reset-password"
  $s.WorkingDirectory = $program
  $s.IconLocation = "$program\kpr.ico,0"
  $s.Description = "Set a new password if a login is forgotten"
  $s.Save()
} catch { Write-Host "  Could not create the password reset shortcut." -ForegroundColor Yellow }
# Start in the background when Windows starts (registry "Run" key - not blocked by folder protection)
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$oldStartup = Join-Path ([Environment]::GetFolderPath("Startup")) "KPR Pitstop (background).lnk"
Remove-Item -LiteralPath $oldStartup -ErrorAction SilentlyContinue
if ($NoStartup) {
  Remove-ItemProperty -Path $runKey -Name "KPR Pitstop" -ErrorAction SilentlyContinue
} else {
  try {
    Set-ItemProperty -Path $runKey -Name "KPR Pitstop" -Value "`"$env:WINDIR\System32\wscript.exe`" `"$program\KPR Pitstop.vbs`" --server-only"
    Write-Host "  Starts automatically with Windows."
  } catch { Write-Host "  Could not set automatic start: $($_.Exception.Message)" -ForegroundColor Yellow }
}

# 4. Allow phones / other counters on the shop network (needs admin; skipped otherwise)
try {
  $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if ($isAdmin) {
    Remove-NetFirewallRule -DisplayName "KPR Pitstop" -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName "KPR Pitstop" -Direction Inbound -Program "$program\node\node.exe" -Action Allow -Profile Private,Domain | Out-Null
    Write-Host "  Network access for other shop devices: allowed."
  } else {
    Write-Host "  (Run as administrator if other devices on the shop Wi-Fi need to use the app.)" -ForegroundColor Yellow
  }
} catch { Write-Host "  Firewall rule skipped: $($_.Exception.Message)" -ForegroundColor Yellow }

Write-Host ""
Write-Host "  Installed. Data and backups are kept in: $data" -ForegroundColor Green
Write-Host "  Opening KPR Pitstop..."
Start-Process "$env:WINDIR\System32\wscript.exe" -ArgumentList "`"$program\KPR Pitstop.vbs`""
