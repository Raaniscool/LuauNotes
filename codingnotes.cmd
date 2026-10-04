@echo off
rem LuauNotes launcher (Windows Command Prompt)
rem Starts the LuauNotes server and opens it in your browser.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [X] Node.js is required but not installed. Get it from https://nodejs.org
    exit /b 1
)

if "%PORT%"=="" set PORT=4330
echo ^> Starting LuauNotes on http://localhost:%PORT%  (Ctrl+C to stop)
start "" /b cmd /c "timeout /t 1 >nul & start http://localhost:%PORT%"
node app/server.js
