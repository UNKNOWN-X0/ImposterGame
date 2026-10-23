@echo off
rem
rem  Double-click this file to play (Windows).
rem
rem  It installs what is missing the first time, builds the app, starts the
rem  server and opens the browser. Close the window, or press Ctrl-C, to stop.
rem
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed.
  echo   Get the LTS version from https://nodejs.org, then double-click this again.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo.
  echo   First run - installing what the game needs. This takes a minute.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   That install did not finish. The message above says why.
    pause
    exit /b 1
  )
)

echo.
echo   Building...
echo.
call npm run build
if errorlevel 1 (
  echo.
  echo   The build failed. The message above says why.
  pause
  exit /b 1
)

if "%PORT%"=="" set PORT=5173
start "" "http://localhost:%PORT%"
node server\server.js
