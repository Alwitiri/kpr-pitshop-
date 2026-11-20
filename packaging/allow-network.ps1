# Lets phones, tablets and other PCs on the shop Wi-Fi / network open Spoaxio Software.
# Adds one Windows Firewall rule ("Spoaxio Software") for the app's own node.exe. Needs administrator:
# if not already elevated, it asks Windows for approval (a "Yes / No" prompt) and runs again.
param([string]$Exe = (Join-Path $PSScriptRoot "node\node.exe"))

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Start-Process powershell.exe -Verb RunAs -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", "`"$PSCommandPath`"", "-Exe", "`"$Exe`"")
  exit
}

# Replace the rule (also the one made under the old name "KPR Pitstop")
Remove-NetFirewallRule -DisplayName "Spoaxio Software" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "KPR Pitstop" -ErrorAction SilentlyContinue
# All network types: shop Wi-Fi is often marked "Public" by Windows (e.g. a phone hotspot).
# The software still asks every device for a username and password.
New-NetFirewallRule -DisplayName "Spoaxio Software" -Description "Lets phones and other PCs in the shop use Spoaxio Software" `
  -Direction Inbound -Program $Exe -Action Allow -Profile Any | Out-Null
