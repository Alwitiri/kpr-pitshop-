# Removes the KPR Pitstop program and shortcuts. The data folder (database + backups) is KEPT.
param([string]$Target = "C:\KPR Pitstop")
$program = Join-Path $Target "program"
if (Test-Path (Join-Path $program "launcher.js")) {
  & (Join-Path $program "node\node.exe") (Join-Path $program "launcher.js") --stop
  Start-Sleep -Seconds 2
}
Remove-Item (Join-Path ([Environment]::GetFolderPath("Desktop")) "KPR Pitstop.lnk") -ErrorAction SilentlyContinue
Remove-Item (Join-Path ([Environment]::GetFolderPath("Programs")) "KPR Pitstop") -Recurse -ErrorAction SilentlyContinue
Remove-Item (Join-Path ([Environment]::GetFolderPath("Startup")) "KPR Pitstop (background).lnk") -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "KPR Pitstop" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "KPR Pitstop" -ErrorAction SilentlyContinue
Remove-Item $program -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "KPR Pitstop removed. Your data is still in $(Join-Path $Target 'data')." -ForegroundColor Green
