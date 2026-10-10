@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo [Jeoparty] Node.js non e' installato o non e' nel PATH.
  echo Installa la versione LTS:  winget install OpenJS.NodeJS.LTS
  echo oppure scaricala da https://nodejs.org  e poi riapri questo file.
  echo.
  pause
  exit /b 1
)
node -e "process.exit(Number(process.versions.node.split('.')[0]) < 20 ? 1 : 0)"
if errorlevel 1 (
  echo.
  echo [Jeoparty] Serve Node.js 20 o superiore. Versione trovata:
  node --version
  echo.
  pause
  exit /b 1
)
node server\server.js %*
if errorlevel 1 pause
