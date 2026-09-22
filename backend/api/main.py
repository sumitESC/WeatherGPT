from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import config

from api.endpoints import forecast, history, context, sat_model, weather
import threading
import sys
import os

# Add root directory to sys path so we can import top-level scripts
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import update_latest_weather
import generate_all_heatscores

from contextlib import asynccontextmanager
import time
import datetime

# Record app start time for uptime tracking
START_TIME = datetime.datetime.now(datetime.timezone.utc)


def auto_update_loop():
    print("==================================================")
    print("      AUTOMATIC WEATHER DATA UPDATER & PREDICTOR  ")
    print("==================================================")
    try:
        from data.weather_db import init_db
        init_db()
        print("Updating weather data...")
        update_latest_weather.main()
        print("[Auto-Updater] Weather data update complete! Memory footprint < 20MB.")
        print("[Auto-Updater] Generating new 16-day forecasts for all cities...")
        generate_all_heatscores.generate_all()
        print("[Auto-Updater] Forecast generation complete!")
    except Exception as e:
        print(f"[Auto-Updater] Error during data update or prediction: {e}")

    # Recurring 12-hour schedule loop
    while True:
        try:
            time.sleep(12 * 3600)  # Sleep 12 hours
            print("\n[Auto-Updater] Running scheduled 12-hour weather update...")
            update_latest_weather.main()
            print("[Auto-Updater] Scheduled 12-hour refresh complete!")
            print("[Auto-Updater] Generating new 16-day forecasts for all cities...")
            generate_all_heatscores.generate_all()
            print("[Auto-Updater] Scheduled forecast generation complete!")
        except Exception as e:
            print(f"[Auto-Updater] Scheduled refresh failed: {e}")

@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    # Startup: Start background data updater & scheduler thread
    updater_thread = threading.Thread(target=auto_update_loop, daemon=True)
    updater_thread.start()
    yield

app = FastAPI(
    title=config.PROJECT_NAME,
    description="AI Weather & Heatwave Forecasting REST API Server for Uttar Pradesh, India.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Enable CORS for cross-origin API consumers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(forecast.router, prefix=f"{config.API_PREFIX}/forecast", tags=["Forecast"])
app.include_router(history.router, prefix=f"{config.API_PREFIX}/history", tags=["Historical Data"])
app.include_router(context.router, prefix=f"{config.API_PREFIX}/context", tags=["Context Data"])
app.include_router(sat_model.router, prefix=f"{config.API_PREFIX}/sat_model", tags=["Satellite Telemetry & Corridors"])
app.include_router(weather.router, prefix=f"{config.API_PREFIX}/weather", tags=["Unified Weather & Live Updates"])

# Alias top-level live-update routes for convenience
@app.get(f"{config.API_PREFIX}/live-update", tags=["Live Updates"])
async def live_update_get(city: str = None, alert_type: str = None):
    return await weather.get_live_updates(city=city, alert_type=alert_type)

@app.post(f"{config.API_PREFIX}/live-update", tags=["Live Updates"])
async def live_update_post(background_tasks: weather.BackgroundTasks):
    return await weather.trigger_live_update(background_tasks=background_tasks)

# Dedicated Health Check Endpoints (for Render, UptimeRobot, Kubernetes, etc.)
@app.api_route("/healthz", methods=["GET", "HEAD"], tags=["Health Check"])
@app.api_route("/health", methods=["GET", "HEAD"], tags=["Health Check"])
@app.api_route(f"{config.API_PREFIX}/health", methods=["GET", "HEAD"], tags=["Health Check"])
async def health_check():
    """
    Render & Infrastructure Health Check Endpoint.
    Returns 200 OK along with service metadata and uptime statistics.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    uptime_seconds = round((now - START_TIME).total_seconds(), 2)
    return {
        "status": "ok",
        "healthy": True,
        "service": config.PROJECT_NAME,
        "version": "1.0.0",
        "timestamp": now.isoformat(),
        "uptime_seconds": uptime_seconds,
        "render_port": os.environ.get("PORT", "8000")
    }

@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    return {
        "status": "online",
        "service": config.PROJECT_NAME,
        "version": "1.0.0",
        "health_check": "/healthz",
        "documentation": {
            "swagger_ui": "/docs",
            "redoc": "/redoc",
            "openapi_schema": "/openapi.json"
        },
        "endpoints": {
            "health": "/healthz",
            "live_update": f"{config.API_PREFIX}/live-update",
            "weather_live": f"{config.API_PREFIX}/weather/live-update",
            "forecast": f"{config.API_PREFIX}/forecast/{{city}}",
            "history": f"{config.API_PREFIX}/history/{{city}}?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD",
            "context": f"{config.API_PREFIX}/context/{{city}}",
            "satellite_model": f"{config.API_PREFIX}/sat_model/{{city}}",
            "unified_weather": f"{config.API_PREFIX}/weather/{{city}}"
        }
    }


