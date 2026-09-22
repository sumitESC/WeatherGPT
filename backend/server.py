import sys
import os
import uvicorn

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api.main import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    is_dev = os.environ.get("PORT") is None
    print("==================================================")
    print("      HEATZONE REST API FORECASTING SERVER        ")
    print("==================================================")
    print(f"Server running on port: {port}")
    print(f"Swagger Docs at:         http://localhost:{port}/docs")
    print(f"ReDoc Docs at:           http://localhost:{port}/redoc")
    print(f"OpenAPI Schema:          http://localhost:{port}/openapi.json")
    print("==================================================")
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=is_dev)
