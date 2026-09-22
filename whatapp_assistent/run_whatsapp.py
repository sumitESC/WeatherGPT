import uvicorn
import os
import sys
import io

if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if script_dir not in sys.path:
        sys.path.insert(0, script_dir)

    print("==================================================")
    print(" [+] Starting WeatherGPT WhatsApp Assistant Bot  ")
    print("==================================================")
    print("👉 Server URL:       http://127.0.0.1:8001")
    print("👉 Meta Webhook:     http://127.0.0.1:8001/webhook")
    print("👉 Twilio Webhook:   http://127.0.0.1:8001/twilio")
    print("👉 Health Check:     http://127.0.0.1:8001/health")
    print("==================================================\n")

    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=True)

if __name__ == "__main__":
    main()
