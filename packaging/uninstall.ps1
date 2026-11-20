# Removes the Spoaxio Software program and shortcuts. The data folder (database + backups) is KEPT.
param([string]$Target = "C:\KPR Pitstop")
$program = Join-Path $Target "program"
if (Test-Path (Join-Path $program "launcher.js")) {
  & (Join-Path $program "node\node.exe") (Join-Path $program "launcher.js") --stop
}
$desktop = [Environment]::GetFolderPath("Desktop")
$programs = [Environment]::GetFolderPath("Programs")
foreach ($n in "Spoaxio Software", "KPR Pitstop") {
  Remove-Item (Join-Path $desktop "$n.lnk") -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $programs $n) -Recurse -ErrorAction SilentlyContinue
  Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name $n -ErrorAction SilentlyContinue
  Remove-NetFirewallRule -DisplayName $n -ErrorAction SilentlyContinue
}
Remove-Item (Join-Path ([Environment]::GetFolderPath("Startup")) "KPR Pitstop (background).lnk") -ErrorAction SilentlyContinue
Remove-Item $program -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Spoaxio Software removed. Your data is still in $(Join-Path $Target 'data')." -ForegroundColor Green
