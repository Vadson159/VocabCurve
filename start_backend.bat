@echo off
cd /d "%~dp0"
title VocabCurve Backend

echo ==========================================================
echo           VocabCurve - STARTING BACKEND ONLY
echo ==========================================================
echo.

:: 0. Anki
echo [STEP 0] Ensuring Anki is running...
call "%~dp0scripts\launch_anki.bat"
echo.

:: 1. Clean
echo [STEP 1] Cleaning old processes on port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /C:":8000 "') do (
    taskkill /f /pid %%a 2>nul
)
echo [OK] Done cleaning.
echo.

:: 2. Backend
echo [STEP 2] Starting Backend...

if not exist "backend\.venv\Scripts\activate.bat" goto :REBUILD_VENV
if not exist "backend\.venv\install_dir.txt" goto :REBUILD_VENV
set /p SAVED_DIR=<"backend\.venv\install_dir.txt"
if not "%SAVED_DIR%"=="%CD%" (
    echo [INFO] Project moved! Old path: %SAVED_DIR%
    echo [INFO] Rebuilding virtual environment to fix paths...
    rmdir /s /q backend\.venv 2>nul
    goto :REBUILD_VENV
)
goto :START_BACKEND

:REBUILD_VENV
echo [ACTION] Environment missing or path changed. Creating venv...
python -m venv backend\.venv
if not exist "backend\.venv\Scripts\activate.bat" (
    echo [ERROR] Failed to create venv. Make sure Python is installed and in PATH.
    pause
    exit /b
)
echo %CD%>"backend\.venv\install_dir.txt"
echo [OK] Venv created successfully.

:START_BACKEND
echo [OK] Launching Uvicorn...
call backend\.venv\Scripts\activate.bat
cd backend
python -m pip install -r requirements.txt
uvicorn main:app --port 8000
pause
