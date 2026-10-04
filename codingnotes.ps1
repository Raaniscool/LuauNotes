# LuauNotes launcher (PowerShell)
# Starts the LuauNotes server and opens it in your browser.
# Usage:  .\codingnotes.ps1      (optionally: $env:PORT = "4400" before running)
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "✗ Node.js is required but not installed. Get it from https://nodejs.org" -ForegroundColor Red
    exit 1
}

$port = if ($env:PORT) { $env:PORT } else { "4330" }
Write-Host "▶ Starting LuauNotes on http://localhost:$port  (Ctrl+C to stop)"
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 1
    Start-Process "http://localhost:$using:port" | Out-Null
} | Out-Null
node app/server.js
