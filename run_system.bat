@echo off
TITLE Stock Analysis System Launcher

echo ====================================================
echo Starting Stock Analysis System...
echo ====================================================

:: 1. Check Docker
docker info >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is not running. Please start Docker Desktop and try again.
    pause
    exit /b
)

:: 2. Start Infrastructure (DB, Redis)
echo [1/4] Starting Database & Redis (Docker)...
docker-compose up -d db redis

:: 3. Start Backend
echo [2/4] Starting Backend API...
start "Stock Backend" cmd /k "cd backend && venv\Scripts\activate && uvicorn main:app --reload"

:: 4. Start Frontend
echo [3/4] Starting Frontend Dashboard...
start "Stock Frontend" cmd /k "cd frontend && npm run dev"

:: 5. Open Browser
echo [4/4] Opening Web Browser...
timeout /t 5 >nul
start http://localhost:3000

echo ====================================================
echo System Started!
echo - Backend: http://localhost:8000
echo - Frontend: http://localhost:3000
echo ====================================================
pause
