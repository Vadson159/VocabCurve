@echo off
:: Launch Anki silently via Python script (uses Win32 API to hide the window).
:: This script is called from start.bat, start_backend.bat, start_debug.bat, start_tray.bat.
:: %~dp0 ensures it works regardless of the caller's working directory.

pythonw "%~dp0launch_anki_silent.py"
