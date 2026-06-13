import sys, subprocess, os, time, ctypes
import pystray
from PIL import Image

class App:
    def __init__(s, bat, ico, name):
        s.bat = os.path.abspath(bat)
        s.ico = os.path.abspath(ico)
        s.name = name
        s.proc = None
        s.log_file = None
        s.log_path = os.path.join(os.path.dirname(s.bat), "vocabcurve_log.txt")
        
        # Enforce single instance via PID file, kill old instance if exists
        s.pid_file = os.path.join(os.path.dirname(s.bat), "tray_launcher.pid")
        if os.path.exists(s.pid_file):
            try:
                with open(s.pid_file, "r") as f:
                    old_pid = int(f.read().strip())
                # Try to kill the old tray_launcher (it might be dead)
                subprocess.run(['taskkill', '/F', '/PID', str(old_pid)], capture_output=True)
                time.sleep(0.5) # Give it time to exit
            except Exception:
                pass
        try:
            with open(s.pid_file, "w") as f:
                f.write(str(os.getpid()))
        except Exception:
            pass

    def start(s):
        s.log_file = open(s.log_path, 'w', encoding='utf-8')
        s.log_file.write(f"\n\n--- Starting {s.name} at {time.ctime()} ---\n")
        s.log_file.flush()
        
        env = os.environ.copy()
        env['TRAY_MODE'] = '1'
        
        # 0x08000000 is CREATE_NO_WINDOW
        s.proc = subprocess.Popen(['cmd', '/c', s.bat],
                                  cwd=os.path.dirname(s.bat),
                                  creationflags=0x08000000,
                                  stdout=s.log_file,
                                  stderr=subprocess.STDOUT,
                                  env=env)

    def stop(s):
        if s.proc and s.proc.poll() is None:
            subprocess.run(['taskkill', '/F', '/T', '/PID', str(s.proc.pid)], capture_output=True)
            s.proc.wait()
        if s.log_file:
            try:
                s.log_file.write(f"\n--- Stopped {s.name} at {time.ctime()} ---\n")
                s.log_file.close()
            except: pass
            s.log_file = None

    def view_log(s, *a):
        if os.path.exists(s.log_path):
            os.startfile(s.log_path)
            
    def open_browser(s, *a):
        import webbrowser
        webbrowser.open('http://localhost:5173')
            
    def restart(s, *a):
        s.stop()
        s.start()

    def quit(s, icon, *a):
        s.stop()
        icon.stop() # This triggers icon.run() to return

    def run(s):
        s.start()
        try:
            img = Image.open(s.ico)
        except Exception as e:
            if s.log_file:
                s.log_file.write(f"Failed to load icon: {e}\n")
            return

        menu = pystray.Menu(
            pystray.MenuItem('Open VocabCurve', s.open_browser, default=True),
            pystray.MenuItem('View Log', s.view_log),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem('Restart', s.restart),
            pystray.MenuItem('Exit', s.quit)
        )
        s.icon = pystray.Icon(s.name, img, s.name, menu)
        s.icon.run() # Blocks here until icon.stop() is called
        os._exit(0)  # Ensures everything shuts down cleanly after icon is removed

if __name__ == '__main__':
    if len(sys.argv) < 4:
        sys.exit(1)
    App(sys.argv[1], sys.argv[2], sys.argv[3]).run()
