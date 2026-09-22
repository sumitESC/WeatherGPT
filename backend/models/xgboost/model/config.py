"""
HEATZONE-ML Configuration
Centralized configuration for all paths, feature lists, and hyperparameters.
"""
import os

# ─── Data Paths ───────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
DATA_DIR = os.environ.get("HEATZONE_DATA_DIR", os.path.join(BASE_DIR, "data", "processed"))
MODEL_DIR = os.environ.get("HEATZONE_MODEL_DIR", os.path.join(BASE_DIR, "models", "checkpoints"))

# Raw data files
UP_WEATHER_CSV = os.path.join(DATA_DIR, "india_regional_weather.csv")
UP_SATELLITE_CSV = os.path.join(DATA_DIR, "real_historical_satellite_indices.csv")
CONTEXT_WEATHER_CSV = os.path.join(DATA_DIR, "india_context_weather.csv")
CONTEXT_SATELLITE_CSV = os.path.join(DATA_DIR, "india_context_satellite_indices.csv")
CONTEXT_FORECAST_CSV = os.path.join(DATA_DIR, "india_context_forecast.csv")
ALL_UP_CITIES_JSON = os.path.join(BASE_DIR, "data", "all_up_cities.json")
CONTEXT_CITIES_JSON = os.path.join(BASE_DIR, "data", "india_context_cities.json")

# Pre-merged ML-ready files
ML_READY_HISTORICAL_CSV = os.path.join(DATA_DIR, "ml_ready_historical_data.csv")
ML_READY_CONTEXT_CSV = os.path.join(DATA_DIR, "ml_ready_context_data.csv")

# Output paths
PREDICTIONS_DIR = os.path.join(BASE_DIR, "models", "predictions")

# ─── Target Variables ─────────────────────────────────────────────────────────
TARGET_COLS = [
    "Temp_Max_C",
    "Temp_Min_C",
    "Precipitation_mm",
    "Humidity_Mean_pct",
    "Wind_Speed_Max_kmh",
    "Pressure_MSL_hPa",
    "Shortwave_Radiation_MJm2",
]

# ─── Weather Feature Columns ─────────────────────────────────────────────────
WEATHER_FEATURE_COLS = [
    "Temp_Max_C", "Temp_Min_C", "Temp_Mean_C",
    "Apparent_Temp_Max_C", "Apparent_Temp_Min_C",
    "Precipitation_mm", "Rain_mm",
    "Wind_Speed_Max_kmh", "Wind_Gusts_Max_kmh",
    "Wind_Direction_Dominant_deg",
    "Shortwave_Radiation_MJm2", "ET0_Evapotranspiration_mm",
    "Humidity_Mean_pct", "Humidity_Max_pct", "Humidity_Min_pct",
    "Dew_Point_Mean_C", "Pressure_MSL_hPa",
    "Soil_Temp_0_7cm_C", "Soil_Moisture_0_7cm_m3m3",
]

# ─── Wind Encoding ───────────────────────────────────────────────────────────
# Wind direction is circular (0-360°), raw degrees mislead the model
# 350° and 10° are only 20° apart but the model sees 340 difference
# Fix: decompose into sin/cos components + wind vector components
WIND_DIR_COL = "Wind_Direction_Dominant_deg"
WIND_SPEED_COLS = ["Wind_Speed_Max_kmh", "Wind_Gusts_Max_kmh"]

# ─── Satellite Feature Columns ───────────────────────────────────────────────
SATELLITE_FEATURE_COLS = [
    "NDVI", "NDBI", "NDWI", "NDMI", "SAVI", "EVI",
    "BSI", "UI", "MNDWI", "Albedo",
    "Blue_Mean", "Green_Mean", "Red_Mean",
    "NIR_Mean", "SWIR1_Mean", "SWIR2_Mean",
]

# Key satellite indices for context trend features
SATELLITE_TREND_COLS = ["NDVI", "NDWI", "NDMI", "BSI", "EVI", "Albedo"]

# ─── Climate Event Groups (upstream sentinel cities) ─────────────────────────
CLIMATE_EVENT_GROUPS = {
    "EVENT_1_LOO_HEATWAVE": {
        "cities": ["Bikaner", "Churu", "Jaipur", "Hisar", "New Delhi"],
        "lead_time_days": (1, 3),
        "key_features": ["Temp_Max_C", "Temp_Mean_C", "Wind_Speed_Max_kmh"],
    },
    "EVENT_2_WESTERN_DISTURBANCE": {
        "cities": ["Srinagar", "Shimla", "Amritsar", "Chandigarh", "Dehradun"],
        "lead_time_days": (2, 4),
        "key_features": ["Precipitation_mm", "Pressure_MSL_hPa", "Temp_Min_C"],
    },
    "EVENT_3_SW_MONSOON": {
        "cities": ["Thiruvananthapuram", "Mumbai", "Nagpur", "Bhopal", "Gwalior"],
        "lead_time_days": (5, 15),
        "key_features": ["Precipitation_mm", "Humidity_Mean_pct", "Wind_Direction_Dominant_deg"],
    },
    "EVENT_4_BAY_DEPRESSION": {
        "cities": ["Bhubaneswar", "Kolkata", "Ranchi", "Patna"],
        "lead_time_days": (2, 4),
        "key_features": ["Precipitation_mm", "Pressure_MSL_hPa", "Wind_Speed_Max_kmh", "Wind_Gusts_Max_kmh"],
    },
}

# Full set of weather features used for upstream context (not just key_features)
CONTEXT_FULL_WEATHER_COLS = [
    "Temp_Max_C", "Temp_Min_C", "Temp_Mean_C",
    "Precipitation_mm", "Humidity_Mean_pct",
    "Wind_Speed_Max_kmh", "Pressure_MSL_hPa",
    "Dew_Point_Mean_C", "Soil_Temp_0_7cm_C", "Soil_Moisture_0_7cm_m3m3",
]

# ─── Feature Engineering Parameters ─────────────────────────────────────────
LOOKBACK_DAYS = 7           # Days of historical weather to look back
FORECAST_HORIZON = 16       # Days ahead to predict

# Rolling window sizes for statistical features
ROLLING_WINDOWS = [3, 7, 14]

# Rate of change periods
DELTA_PERIODS = [1, 3]

# Features to compute rolling statistics for
ROLLING_FEATURE_COLS = [
    "Temp_Max_C", "Temp_Min_C", "Temp_Mean_C",
    "Precipitation_mm", "Humidity_Mean_pct",
    "Pressure_MSL_hPa", "Wind_Speed_Max_kmh",
    "Dew_Point_Mean_C",
]

# Features to compute rate-of-change for
DELTA_FEATURE_COLS = [
    "Temp_Max_C", "Temp_Min_C", "Humidity_Mean_pct",
    "Pressure_MSL_hPa", "Dew_Point_Mean_C",
    "Soil_Temp_0_7cm_C", "Soil_Moisture_0_7cm_m3m3",
]

# ─── Train/Val/Test Split ────────────────────────────────────────────────────
TRAIN_END_YEAR = 2022       # Train: 2000-2022
VAL_END_YEAR = 2024         # Val:   2023-2024
# Test: 2025-2026

# ─── Model Hyperparameters ───────────────────────────────────────────────────
XGB_PARAMS = {
    "n_estimators": 800,
    "max_depth": 8,
    "learning_rate": 0.05,
    "subsample": 0.8,
    "colsample_bytree": 0.7,
    "min_child_weight": 5,
    "reg_alpha": 0.1,
    "reg_lambda": 1.0,
    "gamma": 0.1,
    "n_jobs": -1,
    "random_state": 42,
    "tree_method": "hist",
}

# Early stopping configuration
EARLY_STOPPING_ROUNDS = 30

# Autoregressive prediction: use predictions from day1..N as features for day N+1
# Only for short-range (most accurate). Beyond this, predict independently.
AUTOREGRESSIVE_DAYS = 5
