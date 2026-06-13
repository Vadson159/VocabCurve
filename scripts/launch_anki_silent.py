"""
Launch Anki in silent/hidden mode.
Finds Anki on the system, starts it, waits for its window to appear,
then hides the window so it runs silently in the background.

Modern Anki (v25+) uses a launcher (anki.exe) that spawns pythonw.exe
as the real process, so we search for windows by title, not by PID.
"""
import subprocess
import ctypes
import ctypes.wintypes
import time
import sys
import os
import winreg

# Win32 constants
SW_SHOWMINNOACTIVE = 7
SW_MINIMIZE = 6
GW_OWNER = 4

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

EnumWindows = user32.EnumWindows
EnumWindowsProc = ctypes.WINFUNCTYPE(
    ctypes.c_bool, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM
)
GetWindowTextW = user32.GetWindowTextW
GetWindowTextLengthW = user32.GetWindowTextLengthW
IsWindowVisible = user32.IsWindowVisible
ShowWindow = user32.ShowWindow
GetWindow = user32.GetWindow


def find_anki_path():
    """Find Anki executable path using multiple strategies."""

    # 1. Check PATH
    try:
        result = subprocess.run(
            ["where", "anki.exe"], capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            path = result.stdout.strip().splitlines()[0]
            if os.path.isfile(path):
                return path
    except Exception:
        pass

    # 2. Check registry Uninstall keys (most reliable for Anki)
    for hive in [winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE]:
        try:
            key = winreg.OpenKey(
                hive,
                r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Anki",
            )
            uninst_str, _ = winreg.QueryValueEx(key, "UninstallString")
            winreg.CloseKey(key)
            uninst_str = uninst_str.strip('"')
            anki_dir = os.path.dirname(uninst_str)
            anki_exe = os.path.join(anki_dir, "anki.exe")
            if os.path.isfile(anki_exe):
                return anki_exe
        except (FileNotFoundError, OSError):
            pass

    # 3. Check App Paths registry
    for hive in [winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE]:
        try:
            key = winreg.OpenKey(
                hive,
                r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\anki.exe",
            )
            path, _ = winreg.QueryValueEx(key, "")
            winreg.CloseKey(key)
            path = path.strip('"')
            if os.path.isfile(path):
                return path
        except (FileNotFoundError, OSError):
            pass

    # 4. Check common locations on all available drives
    drives = []
    bitmask = kernel32.GetLogicalDrives()
    for letter_idx in range(26):
        if bitmask & (1 << letter_idx):
            drives.append(chr(ord("A") + letter_idx))

    for drive in drives:
        for subdir in ["Program Files\\Anki", "Program Files (x86)\\Anki"]:
            candidate = os.path.join(f"{drive}:\\", subdir, "anki.exe")
            if os.path.isfile(candidate):
                return candidate

    # 5. Check LocalAppData
    local_app_data = os.environ.get("LocalAppData", "")
    if local_app_data:
        candidate = os.path.join(local_app_data, "Programs", "Anki", "anki.exe")
        if os.path.isfile(candidate):
            return candidate

    return None


def find_anki_windows():
    """Find all visible top-level windows with 'Anki' in the title."""
    found = []

    def callback(hwnd, _):
        if IsWindowVisible(hwnd):
            length = GetWindowTextLengthW(hwnd)
            if length > 0:
                buf = ctypes.create_unicode_buffer(length + 1)
                GetWindowTextW(hwnd, buf, length + 1)
                title = buf.value
                # Anki window title contains " - Anki" (e.g. "Deck - Anki")
                if title.endswith("- Anki") or title == "Anki":
                    # Only top-level windows (no owner)
                    owner = GetWindow(hwnd, GW_OWNER)
                    if owner == 0:
                        found.append((hwnd, title))
        return True

    EnumWindows(EnumWindowsProc(callback), 0)
    return found


def is_anki_running():
    """Check if any Anki-related window is already present (visible or hidden)."""
    # Check for the pythonw process that has Anki in its window title
    try:
        result = subprocess.run(
            ["tasklist", "/v", "/fo", "csv", "/fi", "imagename eq pythonw.exe"],
            capture_output=True, text=True, timeout=10
        )
        if "anki" in result.stdout.lower():
            return True
    except Exception:
        pass

    # Also check for anki.exe itself (older versions)
    try:
        result = subprocess.run(
            ["tasklist", "/fi", "imagename eq anki.exe"],
            capture_output=True, text=True, timeout=10
        )
        if "anki.exe" in result.stdout.lower():
            return True
    except Exception:
        pass

    return False


def main():
    # Check if already running
    if is_anki_running():
        # Still try to hide visible windows in case it's showing
        windows = find_anki_windows()
        for hwnd, title in windows:
            ShowWindow(hwnd, SW_SHOWMINNOACTIVE)
        print("[ANKI] Anki is already running.")
        return 0

    # Find Anki
    anki_path = find_anki_path()
    if not anki_path:
        print("[ANKI] Error: Anki not found. Please ensure it is installed.")
        return 1

    print(f"[ANKI] Found Anki at: {anki_path}")
    print("[ANKI] Launching Anki in silent mode...")

    # Launch Anki using os.startfile to perfectly simulate a user double-clicking it
    # This prevents any weird behavior from CREATE_NO_WINDOW or inherited handles.
    os.startfile(anki_path)

    # Wait for Anki window to appear, then hide it
    timeout = 45  # seconds — Anki can be slow on first start
    start = time.time()
    hidden = False

    while time.time() - start < timeout:
        windows = find_anki_windows()
        if windows:
            for hwnd, title in windows:
                ShowWindow(hwnd, SW_SHOWMINNOACTIVE)
                try:
                    print(f"[ANKI] Minimized window: '{title}'")
                except UnicodeEncodeError:
                    print(f"[ANKI] Minimized window: '{title!a}'")
            # Wait a moment and do another pass for any late windows
            time.sleep(2)
            windows = find_anki_windows()
            for hwnd, title in windows:
                ShowWindow(hwnd, SW_SHOWMINNOACTIVE)
            hidden = True
            break
        time.sleep(0.5)

    if hidden:
        print("[ANKI] Anki is now running silently in the background.")
    else:
        print("[ANKI] Warning: Timed out waiting for Anki window. Anki may not have started.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
