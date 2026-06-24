@echo off
title Stock Starter - Collect Data
color 0A

echo ========================================
echo   Stock Starter Data Collection
echo ========================================
echo.

cd /d "%~dp0"

echo [1/2] Collecting starter stock data...
C:\Users\mofun\AppData\Local\Python\pythoncore-3.14-64\python.exe collect_stock_data.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo WARNING: Data collection reported an error.
    echo Review the messages above before refreshing the app.
    echo.
    pause
    exit /b 1
)

echo.
echo [2/2] Checking saved database summary...
C:\Users\mofun\AppData\Local\Python\pythoncore-3.14-64\python.exe check_db.py

echo.
echo Data refresh finished.
echo API recommendations: http://localhost:8000/recommendations
echo Dashboard:           http://localhost:3000
echo.
pause
