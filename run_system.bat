@echo off
title Stock Analysis System - Startup
color 0A

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

set "PYTHON_CMD="
where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set "PYTHON_CMD=python"
) else (
    where py >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        set "PYTHON_CMD=py"
    ) else if exist "%LocalAppData%\Python\pythoncore-3.14-64\python.exe" (
        set "PYTHON_CMD=%LocalAppData%\Python\pythoncore-3.14-64\python.exe"
    )
)

if not defined PYTHON_CMD (
    echo ERROR: No Python interpreter was found.
    echo Install Python or update run_system.bat with a valid interpreter path.
    pause >nul
    exit /b 1
)

set "NPM_CMD=npm.cmd"
where %NPM_CMD% >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm.cmd was not found in PATH.
    echo Install Node.js or update run_system.bat with a valid npm command.
    pause >nul
    exit /b 1
)

set "DRY_RUN=0"
if /I "%STOCK_STARTER_DRY_RUN%"=="1" set "DRY_RUN=1"

echo ========================================
echo   Stock Analysis System
echo   One-Click Startup
echo ========================================
echo.
echo Python: %PYTHON_CMD%
echo npm:    %NPM_CMD%
if "%DRY_RUN%"=="1" echo Mode:   dry run
echo.

:: 1. Collect Stock Data
echo [1/5] Collecting latest stock data from KRX...
call :run_or_echo "%PYTHON_CMD%" collect_stock_data.py
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Data collection failed. Continuing with existing data...
    timeout /t 3 /nobreak >nul
) else (
    echo Data collection completed successfully.
)

:: 2. Check Docker
echo.
echo [2/5] Checking Docker...
docker info >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo Docker is not running. Attempting to start Docker Desktop...
    
    if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
        start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    ) else (
        echo WARNING: Docker Desktop not found. Skipping Docker services...
        goto SKIP_DOCKER
    )
    
    echo Waiting for Docker to start...
    :WAIT_DOCKER
    timeout /t 5 >nul
    docker info >nul 2>&1
    IF %ERRORLEVEL% NEQ 0 (
        echo ...
        goto WAIT_DOCKER
    )
    echo Docker is ready!
)

:: 3. Start Docker Services
echo.
echo [3/5] Starting Docker services...
call :run_or_echo docker-compose up -d

:SKIP_DOCKER

:: 4. Start Backend
echo.
echo [4/5] Starting Backend API Server...
if "%DRY_RUN%"=="1" (
    echo start "Stock Backend" cmd /k "cd /d ""%ROOT_DIR%"" ^&^& ""%PYTHON_CMD%"" -m uvicorn backend.main:app --reload --port 8000"
) else (
    start "Stock Backend" cmd /k "cd /d ""%ROOT_DIR%"" && ""%PYTHON_CMD%"" -m uvicorn backend.main:app --reload --port 8000"
)

:: 5. Start Frontend
echo.
echo [5/5] Starting Frontend Dashboard...
if not exist "frontend\node_modules" (
    echo [INFO] First time setup: Installing Frontend dependencies...
    call :run_or_echo cmd /c "cd frontend && %NPM_CMD% install"
)
if "%DRY_RUN%"=="1" (
    echo start "Stock Frontend" cmd /k "cd /d ""%ROOT_DIR%frontend"" ^&^& %NPM_CMD% run dev"
) else (
    start "Stock Frontend" cmd /k "cd /d ""%ROOT_DIR%frontend"" && %NPM_CMD% run dev"
)

:: 6. Open Browser
echo.
echo ========================================
echo   System Started Successfully!
echo ========================================
echo.
echo Data collected and updated
echo Backend API: http://localhost:8000
echo Frontend:    http://localhost:3000
echo.
echo Opening browser in 5 seconds...
if "%DRY_RUN%"=="1" (
    echo start http://localhost:3000
) else (
    timeout /t 5 /nobreak >nul
    start http://localhost:3000
)

echo.
echo Press any key to exit this window...
pause >nul
exit /b 0

:run_or_echo
if "%DRY_RUN%"=="1" (
    echo %*
    exit /b 0
)
%*
exit /b %ERRORLEVEL%
