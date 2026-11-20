# Spoaxio Software installer / updater. Run "Install Spoaxio Software.cmd" (double-click).
# Program files are replaced on every install; the data folder is never touched.
# The folder stays C:\KPR Pitstop so shops that installed an earlier version keep their data.
param(
  [string]$Target = "C:\KPR Pitstop",
  [switch]$NoStartup
)
$ErrorActionPreference = "Stop"
$AppName = "Spoaxio Software"
$src = Join-Path $PSScriptRoot "program"
$program = Join-Path $Target "program"
$data = Join-Path $Target "data"

Write-Host ""
Write-Host "  $AppName - installing to $Target" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $src)) { throw "The 'program' folder is missing next to this installer. Extract the whole ZIP first." }

# 1. Stop a running copy (update case – also versions installed as "KPR Pitstop")
if (Test-Path (Join-Path $program "launcher.js")) {
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
$vbs = Join-Path $program "$AppName.vbs"
function New-Shortcut($path, $arguments, $name) {
  try {
    if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
    $s = $shell.CreateShortcut($path)
    $s.TargetPath = "$env:WINDIR\System32\wscript.exe"
    $s.Arguments = "`"$vbs`" $arguments".Trim()
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
$programs = [Environment]::GetFolderPath("Programs")

# Shortcuts from versions installed under the old name "KPR Pitstop"
Remove-Item -LiteralPath (Join-Path $desktop "KPR Pitstop.lnk") -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $programs "KPR Pitstop") -Recurse -Force -ErrorAction SilentlyContinue

$startMenu = Join-Path $programs $AppName
New-Item -ItemType Directory -Force -Path $startMenu | Out-Null
New-Shortcut (Join-Path $desktop "$AppName.lnk") "" "Open $AppName"
New-Shortcut (Join-Path $startMenu "$AppName.lnk") "" "Open $AppName"
New-Shortcut (Join-Path $startMenu "Stop $AppName.lnk") "--stop" "Stop the $AppName background service"
# Forgotten password tool: opens a console window on this PC only
try {
  $r = Join-Path $startMenu "Reset password.lnk"
  if (Test-Path -LiteralPath $r) { Remove-Item -LiteralPath $r -Force }
  $s = $shell.CreateShortcut($r)
  $s.TargetPath = "$program\node\node.exe"
  $s.Arguments = "`"$program\launcher.js`" --reset-password"
  $s.WorkingDirectory = $program
  $s.IconLocation = "$program\kpr.ico,0"
  $s.Description = "Set a new password if a login is forgotten"
  $s.Save()
} catch { Write-Host "  Could not create the password reset shortcut." -ForegroundColor Yellow }
# Let phones / other PCs connect later without reinstalling (asks Windows for administrator approval)
try {
  $a = Join-Path $startMenu "Allow phones & other PCs.lnk"
  if (Test-Path -LiteralPath $a) { Remove-Item -LiteralPath $a -Force }
  $s = $shell.CreateShortcut($a)
  $s.TargetPath = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"
  $s.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$program\allow-network.ps1`""
  $s.WorkingDirectory = $program
  $s.IconLocation = "$program\kpr.ico,0"
  $s.Description = "Let phones and other PCs on the shop Wi-Fi use $AppName (asks for administrator approval)"
  $s.Save()
} catch { Write-Host "  Could not create the 'Allow phones & other PCs' shortcut." -ForegroundColor Yellow }

# Start in the background when Windows starts (registry "Run" key - not blocked by folder protection)
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$oldStartup = Join-Path ([Environment]::GetFolderPath("Startup")) "KPR Pitstop (background).lnk"
Remove-Item -LiteralPath $oldStartup -ErrorAction SilentlyContinue
Remove-ItemProperty -Path $runKey -Name "KPR Pitstop" -ErrorAction SilentlyContinue
if ($NoStartup) {
  Remove-ItemProperty -Path $runKey -Name $AppName -ErrorAction SilentlyContinue
} else {
  try {
    Set-ItemProperty -Path $runKey -Name $AppName -Value "`"$env:WINDIR\System32\wscript.exe`" `"$vbs`" --server-only"
    Write-Host "  Starts automatically with Windows."
  } catch { Write-Host "  Could not set automatic start: $($_.Exception.Message)" -ForegroundColor Yellow }
}

# 4. Allow phones / other counters on the shop network (needs admin; skipped otherwise)
try {
  $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if ($isAdmin) {
    & (Join-Path $program "allow-network.ps1") -Exe (Join-Path $program "node\node.exe")
    Write-Host "  Network access for other shop devices: allowed."
  } else {
    Write-Host "  (For phones / other PCs: Start menu > $AppName > Allow phones & other PCs.)" -ForegroundColor Yellow
  }
} catch { Write-Host "  Firewall rule skipped: $($_.Exception.Message)" -ForegroundColor Yellow }

Write-Host ""
Write-Host "  Installed. Data and backups are kept in: $data" -ForegroundColor Green
Write-Host "  Opening $AppName..."
Start-Process "$env:WINDIR\System32\wscript.exe" -ArgumentList "`"$vbs`""
