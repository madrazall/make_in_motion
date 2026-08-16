@echo off
setlocal
title Make In Motion - local site
cd /d "%~dp0"

echo.
echo  ===========================================
echo   MAKE IN MOTION - starting your local site
echo  ===========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js isn't installed on this computer.
  echo.
  echo  Get it here:  https://nodejs.org
  echo  Download the "LTS" version, install it, then
  echo  double-click this file again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo  First run - installing. This takes 2-3 minutes.
  echo  You'll see a lot of scrolling text. That's normal.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  Install failed. Copy the red text above and send it to Claude.
    echo.
    pause
    exit /b 1
  )
  echo.
  echo  Done installing.
  echo.
)

if not exist ".env.local" (
  echo  No .env.local found - starting in PREVIEW MODE with sample data.
  echo  That's fine for looking around. See SUPABASE-SETUP.md to connect
  echo  the real database.
  echo.
)

echo  Starting the site...
echo  Your browser will open in about 15 seconds.
echo.
echo  ^>^>  Leave this window OPEN while you browse.
echo  ^>^>  Close it, or press Ctrl+C, to stop the site.
echo.

start "" cmd /c "timeout /t 15 >nul && start http://localhost:3000"

call npm run dev

echo.
echo  Site stopped.
pause
