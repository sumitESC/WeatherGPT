import os

# =============================================================================
# Paths
# =============================================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
MODELS_DIR = os.path.join(BASE_DIR, "models")
CHECKPOINTS_DIR = os.path.join(MODELS_DIR, "checkpoints")

# Processed Data (for models)
PROCESSED_DATA_DIR = os.path.join(DATA_DIR, "processed")
UP_WEATHER_CSV = os.path.join(PROCESSED_DATA_DIR, "india_regional_weather.csv")
INDIA_CONTEXT_WEATHER_CSV = os.path.join(PROCESSED_DATA_DIR, "india_context_weather.csv")
ML_READY_HISTORICAL_CSV = os.path.join(PROCESSED_DATA_DIR, "ml_ready_historical_data.csv")
ML_READY_CONTEXT_CSV = os.path.join(PROCESSED_DATA_DIR, "ml_ready_context_data.csv")

# Model Paths
XGBOOST_MODEL_PATH = os.path.join(CHECKPOINTS_DIR, "heatzone_xgb_model.pkl")
LSTM_MODEL_PATH = os.path.join(CHECKPOINTS_DIR, "best_model.pt")

# =============================================================================
# API Settings
# =============================================================================
API_VERSION = "v1"
API_PREFIX = f"/api/{API_VERSION}"
PROJECT_NAME = "WeatherGPT Weather API"

# =============================================================================
# Sequence & Targets Configuration (from LSTM model)
# =============================================================================
SEQ_LENGTH = 30          # Days of history to look back
FORECAST_HORIZON = 16    # Days to predict ahead

TARGET_COLS = [
    "Temp_Max_C",
    "Temp_Min_C",
    "Precipitation_mm",
    "Humidity_Mean_pct",
    "Wind_Speed_Max_kmh",
    "Pressure_MSL_hPa",
    "Shortwave_Radiation_MJm2",
]
