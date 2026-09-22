import subprocess
import sys
import time
import os
import socket
import signal

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def kill_port_owner(port):
    """Cleanly terminate any stale process listening on the specified port (Windows / Unix)."""
    try:
        if sys.platform == "win32":
            output = subprocess.check_output(f"netstat -ano | findstr :{port}", shell=True, text=True)
            pids = set()
            for line in output.strip().split("\n"):
                parts = line.split()
                if len(parts) >= 5 and "LISTENING" in line:
                    pids.add(parts[-1])
            for pid in pids:
                if pid and pid != "0":
                    print(f"[*] Terminating stale process on port {port} (PID {pid})...")
                    subprocess.run(f"taskkill /F /PID {pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            output = subprocess.check_output(f"lsof -t -i:{port}", shell=True, text=True)
            for pid in output.strip().split("\n"):
                if pid:
                    os.kill(int(pid), signal.SIGKILL)
    except Exception:
        pass

def run():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(root_dir, "frontend")
    local_ip = get_local_ip()

    print("==================================================")
    print("      Starting WeatherGPT (Backend & Frontend)    ")
    print("==================================================")

    kill_port_owner(8000)
    kill_port_owner(5173)

    print("[1/2] Launching FastAPI Backend on http://0.0.0.0:8000 ...")
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd=root_dir
    )

    time.sleep(2.0)

    print("[2/2] Launching Vite React Frontend on http://0.0.0.0:5173 ...")
    npx_cmd = "npx.cmd" if sys.platform == "win32" else "npx"
    frontend_proc = subprocess.Popen(
        f"{npx_cmd} vite --host 0.0.0.0 --port 5173",
        cwd=frontend_dir,
        shell=True
    )

    print("\n==================================================")
    print("           WeatherGPT Servers Are Live!           ")
    print("==================================================")
    print(f"   -> Local UI:      http://localhost:5173")
    print(f"   -> Network UI:    http://{local_ip}:5173  (Mobile / Tablet / LAN)")
    print(f"   -> Backend API:   http://{local_ip}:8000/docs")
    print("==================================================")
    print("   Press Ctrl+C anytime to stop all servers.\n")

    try:
        backend_proc.wait()
        frontend_proc.wait()
    except KeyboardInterrupt:
        print("\nStopping WeatherGPT servers cleanly...")
        try:
            backend_proc.terminate()
            frontend_proc.terminate()
            backend_proc.wait(timeout=3)
            frontend_proc.wait(timeout=3)
        except Exception:
            pass
        kill_port_owner(8000)
        kill_port_owner(5173)
        print("WeatherGPT stopped cleanly.")
        sys.exit(0)

if __name__ == "__main__":
    run()
