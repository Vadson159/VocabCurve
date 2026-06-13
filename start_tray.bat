@echo off
if "%~1"=="hidden" goto :main
wscript //nologo "%~dp0scripts\run_hidden.vbs" cmd.exe /c "%~dp0start_tray.bat" hidden
exit /b

:main
cd /d "%~dp0"
call "%~dp0scripts\launch_anki.bat"
pip install pystray Pillow -q 2>nul
start "" pythonw "scripts\tray_launcher.py" "start.bat" "icon.ico" "VocabCurve"
exit
