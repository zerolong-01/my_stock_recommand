@echo off
title Stock Starter - Update Data
color 0A

echo ========================================
echo   Stock Starter Data Update
echo ========================================
echo.

cd /d "%~dp0"

echo Running the standalone market refresh...
C:\Users\mofun\AppData\Local\Python\pythoncore-3.14-64\python.exe collect_stock_data.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Data update failed. Please review the logs above.
    echo.
    pause
    exit /b 1
)

echo.
echo Refreshing database summary...
C:\Users\mofun\AppData\Local\Python\pythoncore-3.14-64\python.exe check_db.py

echo.
echo Update complete. Reload the dashboard to see the latest shortlist.
echo http://localhost:3000
echo.
pause
