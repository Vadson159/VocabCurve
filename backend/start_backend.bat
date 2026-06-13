@echo off
cd /d "%~dp0"
title VocabCurve Backend
echo ===========================================
echo   VocabCurve Backend - Standalone Launcher
echo ===========================================
echo.
echo [INFO] Backend folder: %CD%
echo.

:: Kill anything on port 8000
echo [STEP 1] Cleaning port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /C:":8000 "') do (
    echo [DEBUG] Killing PID %%a on port 8000
    taskkill /f /pid %%a 2>nul
)
echo [OK] Port cleared.
echo.

:: Check/rebuild venv
if not exist ".venv\Scripts\activate.bat" goto :REBUILD_VENV
if not exist ".venv\install_dir.txt" goto :REBUILD_VENV
set /p SAVED_DIR=<".venv\install_dir.txt"
if not "%SAVED_DIR%"=="%CD%" (
    echo [INFO] Backend was moved! Old path: %SAVED_DIR%
    echo [INFO] Current path: %CD%
    echo [INFO] Rebuilding virtual environment...
    rmdir /s /q .venv 2>nul
    goto :REBUILD_VENV
)
goto :START_SERVER

:REBUILD_VENV
echo [ACTION] Creating virtual environment...
python -m venv .venv
if not exist ".venv\Scripts\activate.bat" (
    echo [ERROR] Failed to create venv. Make sure Python 3.10+ is installed and in PATH.
    echo [ERROR] Download from: https://www.python.org/downloads/
    pause
    exit /b
)
echo %CD%>".venv\install_dir.txt"
echo [OK] Venv created.
echo.
echo [ACTION] Installing dependencies...
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
echo [OK] Dependencies installed.
echo.
goto :START_SERVER

echo [STEP 2] Starting VocabCurve Backend...
echo.
echo ============================================
echo   BACKEND IS STARTING ON: http://localhost:8000
echo   If another app uses port 8000, it will try to clear it first.
echo.
echo   KEEP THIS WINDOW OPEN!
echo   Press Ctrl+C to stop.
echo ============================================
echo.
call .venv\Scripts\activate.bat && uvicorn main:app --host 0.0.0.0 --port 8000
pause
