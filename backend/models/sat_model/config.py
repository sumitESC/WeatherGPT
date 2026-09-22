"""
HeatZone-Vision Satellite Model Configuration
Designed for Spatiotemporal Dual-Branch forecasting on RTX 3050 (4GB VRAM).
"""
import os

# =============================================================================
# Paths 
# =============================================================================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # models
PROJECT_ROOT = os.path.dirname(BASE_DIR) # heatzone-weather-api
DATA_DIR = os.path.join(PROJECT_ROOT, "data", "processed")

# We use the pre-merged datasets built by the data pipeline
HISTORICAL_CSV = os.path.join(DATA_DIR, "ml_ready_historical_data.csv")
CONTEXT_CSV = os.path.join(DATA_DIR, "ml_ready_context_data.csv")

# Model save directory
MODEL_SAVE_DIR = os.path.join(BASE_DIR, "sat_model", "checkpoints")
os.makedirs(MODEL_SAVE_DIR, exist_ok=True)
MODEL_PATH = os.path.join(MODEL_SAVE_DIR, "best_model.pt")

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

# =============================================================================
# Weather & Satellite Features (Local Branch)
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
    # Satellite features
    "NDVI", "NDWI", "NDMI", "BSI", "EVI", "Albedo",
    "SAVI", "UI", "MNDWI", "NDBI",
    "days_since_satellite_update",
]

WIND_DIR_COL = "Wind_Direction_Dominant_deg"

# =============================================================================
# Model Architecture (Dual-Branch Cross-Attention)
# =============================================================================
# We keep dimensions slightly smaller to fit both branches in 4GB VRAM
EMBED_DIM = 64           # Feature embedding dimension
TRANSFORMER_HEADS = 4    # Attention heads
ENCODER_LAYERS = 2       # Number of self-attention layers per branch
CROSS_ATTN_LAYERS = 2    # Number of cross-attention fusion layers
TRANSFORMER_FF_DIM = 256 # Feed-forward dimension
DROPOUT = 0.2            # Dropout rate

# =============================================================================
# Training Configuration
# =============================================================================
BATCH_SIZE = 128          # Smaller batch size for dual-branch architecture
LEARNING_RATE = 1e-3
WEIGHT_DECAY = 1e-5
EPOCHS = 50
PATIENCE = 10             # Early stopping patience
GRAD_CLIP = 1.0           # Gradient clipping

# Loss weights — higher for precipitation and wind (our focus targets)
LOSS_WEIGHTS = {
    "Temp_Max_C": 1.0,
    "Temp_Min_C": 1.0,
    "Precipitation_mm": 5.0,
    "Humidity_Mean_pct": 1.0,
    "Wind_Speed_Max_kmh": 3.0,
    "Pressure_MSL_hPa": 1.0,
    "Shortwave_Radiation_MJm2": 1.0,
}

# =============================================================================
# Data Split
# =============================================================================
TRAIN_END_YEAR = 2022
VAL_END_YEAR = 2024
# Test: 2025+
