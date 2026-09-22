"""
LSTM-Transformer Model Configuration
Designed for RTX 3050 (4GB VRAM) — all sizes fit within memory.
"""
import os

# =============================================================================
# Paths (same data sources as XGBoost model)
# =============================================================================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # models
PROJECT_ROOT = os.path.dirname(BASE_DIR) # heatzone-weather-api
DATA_DIR = os.path.join(PROJECT_ROOT, "data", "processed")

UP_WEATHER_CSV = os.path.join(DATA_DIR, "india_regional_weather.csv")
UP_SATELLITE_CSV = os.path.join(DATA_DIR, "india_regional_satellite_indices.csv")
CONTEXT_WEATHER_CSV = os.path.join(DATA_DIR, "india_context_weather.csv")
CONTEXT_SATELLITE_CSV = os.path.join(DATA_DIR, "india_context_satellite_indices.csv")
CONTEXT_FORECAST_CSV = os.path.join(DATA_DIR, "india_context_forecast.csv")
HISTORICAL_CSV = os.path.join(DATA_DIR, "ml_ready_historical_data.csv")

# Model save directory
MODEL_SAVE_DIR = os.path.join(BASE_DIR, "lstm_transformer", "checkpoints")
PREDICTIONS_DIR = os.path.join(BASE_DIR, "predictions")

# =============================================================================
# Sequence Configuration
# =============================================================================
SEQ_LENGTH = 30          # Days of history to look back
FORECAST_HORIZON = 16    # Days to predict ahead

# =============================================================================
# Target Variables
# =============================================================================
TARGET_COLS = [
    "Temp_Max_C",
    "Temp_Min_C",
    "Precipitation_mm",
    "Humidity_Mean_pct",
    "Wind_Speed_Max_kmh",
    "Pressure_MSL_hPa",
    "Shortwave_Radiation_MJm2",
]

# Variables where LSTM-Transformer should outperform XGBoost
FOCUS_TARGETS = ["Precipitation_mm", "Wind_Speed_Max_kmh"]

# =============================================================================
# Weather Features (input to the model)
# =============================================================================
WEATHER_FEATURE_COLS = [
    "Temp_Max_C", "Temp_Min_C", "Temp_Mean_C",
    "Precipitation_mm", "Precipitation_Hours",
    "Humidity_Max_pct", "Humidity_Min_pct", "Humidity_Mean_pct",
    "Dew_Point_Mean_C",
    "Wind_Speed_Max_kmh", "Wind_Gusts_Max_kmh",
    "Pressure_MSL_hPa",
    "Cloud_Cover_Mean_pct",
    "Shortwave_Radiation_MJm2",
    "ET0_Evapotranspiration_mm",
    "Soil_Temp_0_7cm_C",
    "Soil_Moisture_0_7cm_m3m3",
    "NDVI", "NDWI", "NDMI", "BSI", "EVI", "Albedo",
    "SAVI", "UI", "MNDWI", "NDBI",
    "days_since_satellite_update",
]

# Wind direction will be encoded as sin/cos
WIND_DIR_COL = "Wind_Direction_Dominant_deg"

# Satellite indices (sparse, will be forward-filled)
SATELLITE_COLS = [
    "NDVI", "NDWI", "NDMI", "BSI", "EVI", "Albedo",
    "SAVI", "UI", "MNDWI", "NDBI",
]

# =============================================================================
# Context Features (India-wide sentinel cities)
# =============================================================================
CLIMATE_EVENT_GROUPS = {
    "LOO": {
        "cities": ["Jaipur", "Jodhpur", "Bikaner", "Nagpur", "Bhopal"],
        "lag_days": [1, 2, 3],
    },
    "WD": {
        "cities": ["Shimla", "Dehradun", "Chandigarh", "Amritsar"],
        "lag_days": [1, 2, 3],
    },
    "MON": {
        "cities": ["Mumbai", "Pune", "Goa", "Mangalore", "Thiruvananthapuram"],
        "lag_days": [3, 5, 7],
    },
    "BAY": {
        "cities": ["Kolkata", "Bhubaneswar", "Visakhapatnam", "Chennai", "Patna"],
        "lag_days": [1, 2, 3],
    },
}

CONTEXT_WEATHER_COLS = [
    "Temp_Max_C", "Temp_Min_C", "Precipitation_mm",
    "Humidity_Mean_pct", "Wind_Speed_Max_kmh", "Pressure_MSL_hPa",
]

# =============================================================================
# Model Architecture (fits in 4GB VRAM)
# =============================================================================
EMBED_DIM = 128          # Feature embedding dimension
LSTM_HIDDEN = 256        # LSTM hidden size
LSTM_LAYERS = 3          # LSTM depth
TRANSFORMER_HEADS = 8    # Attention heads
TRANSFORMER_LAYERS = 4   # Transformer encoder layers
TRANSFORMER_FF_DIM = 512 # Feed-forward dimension
DROPOUT = 0.2            # Dropout rate

# =============================================================================
# Training Configuration
# =============================================================================
BATCH_SIZE = 256          # Large batch to keep GPU saturated
LEARNING_RATE = 5e-4      # Slightly lower LR for autoregressive decoder stability
WEIGHT_DECAY = 1e-5
EPOCHS = 80               # More epochs for larger training set (2000-2024)
PATIENCE = 15             # More patience for complex autoregressive model
WARMUP_EPOCHS = 5         # Linear warmup for training stability
GRAD_CLIP = 1.0           # Gradient clipping

# Loss weights — higher for precipitation and wind (our focus targets)
LOSS_WEIGHTS = {
    "Temp_Max_C": 1.0,
    "Temp_Min_C": 1.0,
    "Precipitation_mm": 5.0,       # 5x weight — our main target
    "Humidity_Mean_pct": 1.0,
    "Wind_Speed_Max_kmh": 3.0,     # 3x weight — secondary focus
    "Pressure_MSL_hPa": 1.0,
    "Shortwave_Radiation_MJm2": 1.0,
}

# Precipitation log-transform threshold
PRECIP_LOG_OFFSET = 1.0   # log1p(precip) to handle zeros

# =============================================================================
# Data Split — maximize training data for diverse weather patterns
# 2000-2024 = 25 years of monsoons, heat waves, dry spells, pressure systems
# =============================================================================
TRAIN_END_YEAR = 2024     # 25 years of diverse weather patterns
VAL_END_YEAR = 2025       # Recent year for calibration
# Test: 2026+ (current year as unseen test)

# =============================================================================
# Precipitation Configuration
# =============================================================================
RAIN_THRESHOLD_MM = 1.0   # Minimum mm to classify as "rain" (standardized)
RAIN_POS_WEIGHT = 3.0     # BCE positive class weight (compensate dry-day majority)
