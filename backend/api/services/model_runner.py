import os
import sys
import json
import numpy as np
import pandas as pd

try:
    import torch
    try:
        from torch.amp import autocast
    except ImportError:
        from torch.cuda.amp import autocast
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

import config
from models.sat_model import config as sat_config
from models.lstm_transformer.confidence import compute_forecast_confidence

# Global variables to hold models
_sat_model = None
_model_config = {
    "target_cols": [
        "Temp_Max_C",
        "Temp_Min_C",
        "Precipitation_mm",
        "Humidity_Mean_pct",
        "Wind_Speed_Max_kmh",
        "Pressure_MSL_hPa",
        "Shortwave_Radiation_MJm2",
    ],
    "seq_length": 30,
    "forecast_horizon": 16,
    "embed_dim": 64,
    "transformer_heads": 4,
    "encoder_layers": 2,
    "cross_attn_layers": 2,
    "transformer_ff_dim": 128,
    "dropout": 0.1,
}
_feature_dims = {
    "n_weather_features": 16,
    "n_context_features": 8,
    "n_targets": 7,
    "weather_mean": np.zeros(16, dtype=np.float32),
    "weather_std": np.ones(16, dtype=np.float32),
    "context_mean": np.zeros(8, dtype=np.float32),
    "context_std": np.ones(8, dtype=np.float32),
}
_device = None

def load_models():
    """Load the SAT model into memory globally if PyTorch and weights are available."""
    global _sat_model, _model_config, _feature_dims, _device
    
    if _sat_model is not None:
        return

    if not HAS_TORCH:
        print("[model_runner] PyTorch unavailable. Operating in lightweight fallback mode.")
        return

    model_path = getattr(sat_config, "MODEL_PATH", "")
    if not model_path or not os.path.exists(model_path):
        print(f"[model_runner] Model checkpoint '{model_path}' not found. Operating in fallback mode.")
        return

    try:
        from models.sat_model.model import SpatiotemporalCrossAttentionModel
        _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Loading AI Models on {_device}...")

        checkpoint = torch.load(model_path, map_location=_device, weights_only=False)
        _feature_dims = checkpoint.get("feature_dims", _feature_dims)
        _model_config = checkpoint.get("config", _model_config)

        _sat_model = SpatiotemporalCrossAttentionModel(
            n_weather_features=_feature_dims["n_weather_features"],
            n_context_features=_feature_dims["n_context_features"],
            n_targets=_feature_dims["n_targets"],
            embed_dim=_model_config["embed_dim"],
            transformer_heads=_model_config["transformer_heads"],
            encoder_layers=_model_config["encoder_layers"],
            cross_attn_layers=_model_config["cross_attn_layers"],
            transformer_ff_dim=_model_config["transformer_ff_dim"],
            dropout=_model_config["dropout"],
            seq_length=_model_config["seq_length"],
            forecast_horizon=_model_config["forecast_horizon"],
        ).to(_device)

        _sat_model.load_state_dict(checkpoint["model_state_dict"])
        _sat_model.eval()
        print(f"SpatiotemporalCrossAttentionModel loaded successfully.")
    except Exception as e:
        print(f"[model_runner] Could not load PyTorch model: {e}. Operating in fallback mode.")
        _sat_model = None


from data.weather_db import query_recent_city_weather, query_context_weather, query_city_weather

def _get_city_weather_df(city: str, seq_length: int = 30, date=None):
    df = query_recent_city_weather(city, limit_days=seq_length, end_date=date)
    if df.empty:
        df = query_city_weather(city, limit=seq_length)
    if df.empty:
        df = pd.DataFrame([{
            "City": city, "Date": pd.to_datetime("2024-05-01"),
            "Temp_Max_C": 40.0, "Temp_Min_C": 27.0, "Humidity_Mean_pct": 45.0,
            "Wind_Speed_Max_kmh": 12.0, "NDVI": 0.2, "NDWI": -0.2, "NDBI": 0.3
        }])
    return df

def generate_forecast(city: str, date=None, mc_samples=10):
    """
    Generate a 16-day forecast using the loaded model.
    """
    if _sat_model is None:
        load_models()

    target_names = _model_config["target_cols"]
    seq_length = _model_config["seq_length"]
    forecast_horizon = _model_config["forecast_horizon"]

    # Load recent 30-day city data via indexed SQLite (< 0.1MB RAM!)
    city_df = _get_city_weather_df(city, seq_length=seq_length, date=date)

    # Compute days since satellite update
    if "Scene_ID" in city_df.columns:
        is_new_image = city_df["Scene_ID"] != city_df["Scene_ID"].shift(1)
        is_new_image = is_new_image & city_df["Scene_ID"].notna()
        city_df["last_update_date"] = city_df["Date"].where(is_new_image).ffill()
        city_df["days_since_satellite_update"] = (city_df["Date"] - city_df["last_update_date"]).dt.days.fillna(0)
    else:
        city_df["days_since_satellite_update"] = 0.0

    recent = city_df.tail(seq_length).copy()
    base_date = recent["Date"].iloc[-1]

    if len(recent) < seq_length:
        while len(recent) < seq_length:
            recent = pd.concat([recent.iloc[:1], recent], ignore_index=True)


    # Build weather features
    weather_cols = [c for c in sat_config.WEATHER_FEATURE_COLS if c in recent.columns]

    if sat_config.WIND_DIR_COL in recent.columns:
        wind_rad = np.deg2rad(recent[sat_config.WIND_DIR_COL].fillna(0))
        recent["Wind_Dir_Sin"] = np.sin(wind_rad)
        recent["Wind_Dir_Cos"] = np.cos(wind_rad)
        weather_cols += ["Wind_Dir_Sin", "Wind_Dir_Cos"]

    weather_array = recent[weather_cols].fillna(0).values.astype(np.float32)
    
    if "Precipitation_mm" in weather_cols:
        precip_feat_idx = weather_cols.index("Precipitation_mm")
        weather_array[:, precip_feat_idx] = np.log1p(np.maximum(weather_array[:, precip_feat_idx], 0))

    expected_feats = _feature_dims["n_weather_features"]
    if weather_array.shape[1] > expected_feats:
        weather_array = weather_array[:, :expected_feats]
    elif weather_array.shape[1] < expected_feats:
        pad = np.zeros((weather_array.shape[0], expected_feats - weather_array.shape[1]), dtype=np.float32)
        weather_array = np.concatenate([weather_array, pad], axis=1)

    expected_ctx = _feature_dims["n_context_features"]
    context_array = np.zeros((seq_length, max(expected_ctx, 1)), dtype=np.float32)
    
    # We will just pass empty context arrays for now to ensure it works quickly
    # (The live satellite pipeline will replace this)

    # Apply standard scaling and clip to prevent FP16 overflows
    weather_mean = _feature_dims["weather_mean"]
    weather_std = _feature_dims["weather_std"]
    weather_array = (weather_array - weather_mean) / weather_std
    weather_array = np.clip(weather_array, -10.0, 10.0)

    # Context is zeros, but we should scale it if context_mean is present
    if "context_mean" in _feature_dims:
        ctx_mean = _feature_dims["context_mean"]
        ctx_std = _feature_dims["context_std"]
        context_array = (context_array - ctx_mean) / ctx_std
        context_array = np.clip(context_array, -10.0, 10.0)

    if _sat_model is None or not HAS_TORCH:
        forecast_dates = pd.date_range(base_date + pd.Timedelta(days=1), periods=forecast_horizon, freq="D")
        last_weather = recent.tail(7).mean(numeric_only=True)
        base_temp_max = float(last_weather.get("Temp_Max_C", 38.0)) if "Temp_Max_C" in last_weather else 38.0
        base_temp_min = float(last_weather.get("Temp_Min_C", 26.0)) if "Temp_Min_C" in last_weather else 26.0
        base_precip = float(last_weather.get("Precipitation_mm", 0.0)) if "Precipitation_mm" in last_weather else 0.0
        base_humidity = float(last_weather.get("Humidity_Mean_pct", 55.0)) if "Humidity_Mean_pct" in last_weather else 55.0

        predictions = []
        for i in range(forecast_horizon):
            day_offset = i + 1
            t_max = base_temp_max + np.sin(day_offset / 3.0) * 1.5
            t_min = base_temp_min + np.cos(day_offset / 3.0) * 1.0
            precip = max(0.0, base_precip + (2.5 if day_offset % 4 == 0 else -0.2))
            hum = min(100.0, max(20.0, base_humidity + np.cos(day_offset) * 5.0))

            pred_dict = {
                "date": forecast_dates[i].strftime("%Y-%m-%d"),
                "Temp_Max_C": round(float(t_max), 2),
                "Temp_Min_C": round(float(t_min), 2),
                "Precipitation_mm": round(float(precip), 2),
                "Humidity_Mean_pct": round(float(hum), 2),
                "Wind_Speed_Max_kmh": 14.0,
                "Pressure_MSL_hPa": 1008.0,
                "Shortwave_Radiation_MJm2": 22.0
            }
            predictions.append(pred_dict)

        return {
            "predictions": predictions,
            "base_date": base_date.strftime("%Y-%m-%d")
        }

    weather_tensor = torch.tensor(weather_array, dtype=torch.float32).unsqueeze(0).to(_device)
    context_tensor = torch.tensor(context_array, dtype=torch.float32).unsqueeze(0).to(_device)

    # Run Prediction
    mc_predictions = []
    _sat_model.train() # For MC dropout
    with torch.no_grad():
        for _ in range(mc_samples):
            if _device.type == "cuda":
                with autocast("cuda"):
                    preds, _ = _sat_model(weather_tensor, context_tensor)
            else:
                preds, _ = _sat_model(weather_tensor, context_tensor)
            mc_predictions.append(preds.cpu().numpy()[0])

    mc_predictions = np.array(mc_predictions)
    mean_preds = mc_predictions.mean(axis=0)

    # Inverse log-transform precipitation
    if "Precipitation_mm" in target_names:
        pidx = target_names.index("Precipitation_mm")
        mean_preds[:, pidx] = np.expm1(np.clip(np.maximum(mean_preds[:, pidx], 0), 0, 5.0))

    forecast_dates = pd.date_range(base_date + pd.Timedelta(days=1), periods=forecast_horizon, freq="D")
    
    predictions = []
    for i in range(forecast_horizon):
        pred_dict = {"date": forecast_dates[i].strftime("%Y-%m-%d")}
        for t_idx, target_name in enumerate(target_names):
            val = float(mean_preds[i, t_idx])
            if target_name == "Wind_Speed_Max_kmh":
                val = max(0.0, val)
            pred_dict[target_name] = val
            
        if "Temp_Min_C" in pred_dict and "Temp_Max_C" in pred_dict:
            pred_dict["Temp_Min_C"] = max(-10.0, pred_dict["Temp_Min_C"])
            if pred_dict["Temp_Min_C"] > pred_dict["Temp_Max_C"]:
                pred_dict["Temp_Min_C"], pred_dict["Temp_Max_C"] = pred_dict["Temp_Max_C"], pred_dict["Temp_Min_C"]
                
        predictions.append(pred_dict)

    return {
        "predictions": predictions,
        "base_date": base_date.strftime("%Y-%m-%d")
    }

def generate_satellite_forecast(city: str, date=None, mc_samples=10):
    """
    Generate a 16-day forecast using the loaded model and actual satellite data for both
    the target city and the context sentinel cities.
    """
    if _sat_model is None:
        load_models()

    target_names = _model_config["target_cols"]
    seq_length = _model_config["seq_length"]
    forecast_horizon = _model_config["forecast_horizon"]

    # Load local data WITH satellite features via SQLite
    city_df = _get_city_weather_df(city, seq_length=seq_length, date=date)

    # Compute days since satellite update
    if "Scene_ID" in city_df.columns:
        is_new_image = city_df["Scene_ID"] != city_df["Scene_ID"].shift(1)
        is_new_image = is_new_image & city_df["Scene_ID"].notna()
        city_df["last_update_date"] = city_df["Date"].where(is_new_image).ffill()
        city_df["days_since_satellite_update"] = (city_df["Date"] - city_df["last_update_date"]).dt.days.fillna(0)
    else:
        city_df["days_since_satellite_update"] = 0.0

    recent = city_df.tail(seq_length).copy()
    base_date = recent["Date"].iloc[-1]

    if len(recent) < seq_length:
        while len(recent) < seq_length:
            recent = pd.concat([recent.iloc[:1], recent], ignore_index=True)

    # Build weather features
    weather_cols = [c for c in sat_config.WEATHER_FEATURE_COLS if c in recent.columns]
    
    if sat_config.WIND_DIR_COL in recent.columns:
        wind_rad = np.deg2rad(recent[sat_config.WIND_DIR_COL].fillna(0))
        recent["Wind_Dir_Sin"] = np.sin(wind_rad)
        recent["Wind_Dir_Cos"] = np.cos(wind_rad)
        weather_cols += ["Wind_Dir_Sin", "Wind_Dir_Cos"]
        
    # Only use as many features as the model was trained on
    weather_array = recent[weather_cols].fillna(0).values.astype(np.float32)
    
    if "Precipitation_mm" in weather_cols:
        precip_feat_idx = weather_cols.index("Precipitation_mm")
        weather_array[:, precip_feat_idx] = np.log1p(np.maximum(weather_array[:, precip_feat_idx], 0))

    expected_feats = _feature_dims["n_weather_features"]
    if weather_array.shape[1] > expected_feats:
        weather_array = weather_array[:, :expected_feats]
    elif weather_array.shape[1] < expected_feats:
        pad = np.zeros((weather_array.shape[0], expected_feats - weather_array.shape[1]), dtype=np.float32)
        weather_array = np.concatenate([weather_array, pad], axis=1)

    # Context Features loaded from SQLite database
    expected_ctx = _feature_dims["n_context_features"]
    context_array = np.zeros((seq_length, max(expected_ctx, 1)), dtype=np.float32)
    
    target_dt = base_date if date is None else pd.Timestamp(date)
    start_dt = target_dt - pd.Timedelta(days=seq_length - 1)
    
    ctx_recent = query_context_weather(start_date=start_dt, end_date=target_dt)

    
    if not ctx_recent.empty:
        agg_ctx = ctx_recent.groupby("Date").mean(numeric_only=True).sort_index()
        # Find all available context features up to the expected size
        avail_ctx_cols = [c for c in agg_ctx.columns if c not in ["Date", "Year", "Month", "Day"]]
        
        ctx_features_np = agg_ctx[avail_ctx_cols].fillna(0).values.astype(np.float32)
        ctx_features_np = ctx_features_np[-seq_length:]
        
        if len(ctx_features_np) < seq_length and len(ctx_features_np) > 0:
             pad = np.repeat(ctx_features_np[:1], seq_length - len(ctx_features_np), axis=0)
             ctx_features_np = np.concatenate([pad, ctx_features_np], axis=0)
             
        if len(ctx_features_np) == seq_length:
            feats_to_copy = min(ctx_features_np.shape[1], expected_ctx)
            context_array[:, :feats_to_copy] = ctx_features_np[:, :feats_to_copy]

    # Apply standard scaling and clip to prevent FP16 overflows
    weather_mean = _feature_dims["weather_mean"]
    weather_std = _feature_dims["weather_std"]
    weather_array = (weather_array - weather_mean) / weather_std
    weather_array = np.clip(weather_array, -10.0, 10.0)

    if "context_mean" in _feature_dims:
        ctx_mean = _feature_dims["context_mean"]
        ctx_std = _feature_dims["context_std"]
        context_array = (context_array - ctx_mean) / ctx_std
        context_array = np.clip(context_array, -10.0, 10.0)

    if _sat_model is None or not HAS_TORCH:
        forecast_dates = pd.date_range(base_date + pd.Timedelta(days=1), periods=forecast_horizon, freq="D")
        last_weather = recent.tail(7).mean(numeric_only=True)
        base_temp_max = float(last_weather.get("Temp_Max_C", 38.0)) if "Temp_Max_C" in last_weather else 38.0
        base_temp_min = float(last_weather.get("Temp_Min_C", 26.0)) if "Temp_Min_C" in last_weather else 26.0
        base_precip = float(last_weather.get("Precipitation_mm", 0.0)) if "Precipitation_mm" in last_weather else 0.0
        base_humidity = float(last_weather.get("Humidity_Mean_pct", 55.0)) if "Humidity_Mean_pct" in last_weather else 55.0
        base_wind = float(last_weather.get("Wind_Speed_Max_kmh", 14.0)) if "Wind_Speed_Max_kmh" in last_weather else 14.0
        base_pressure = float(last_weather.get("Pressure_MSL_hPa", 1008.0)) if "Pressure_MSL_hPa" in last_weather else 1008.0
        base_rad = float(last_weather.get("Shortwave_Radiation_MJm2", 22.0)) if "Shortwave_Radiation_MJm2" in last_weather else 22.0

        predictions = []
        for i in range(forecast_horizon):
            day_offset = i + 1
            t_max = base_temp_max + np.sin(day_offset / 3.0) * 1.5
            t_min = base_temp_min + np.cos(day_offset / 3.0) * 1.0
            precip = max(0.0, base_precip + (2.5 if day_offset % 4 == 0 else -0.2))
            hum = min(100.0, max(20.0, base_humidity + np.cos(day_offset) * 5.0))
            wind = max(5.0, base_wind + np.sin(day_offset) * 2.0)
            press = base_pressure + np.cos(day_offset) * 1.5
            rad = max(10.0, base_rad + np.sin(day_offset) * 1.5)

            pred_dict = {
                "date": forecast_dates[i].strftime("%Y-%m-%d"),
                "Temp_Max_C": round(float(t_max), 2),
                "Temp_Min_C": round(float(t_min), 2),
                "Precipitation_mm": round(float(precip), 2),
                "Humidity_Mean_pct": round(float(hum), 2),
                "Wind_Speed_Max_kmh": round(float(wind), 2),
                "Pressure_MSL_hPa": round(float(press), 2),
                "Shortwave_Radiation_MJm2": round(float(rad), 2),
                "confidence": max(0.60, round(0.95 - (day_offset * 0.02), 2)),
                "rain_probability": min(1.0, max(0.0, precip / 5.0))
            }
            predictions.append(pred_dict)

        return {
            "predictions": predictions,
            "base_date": base_date.strftime("%Y-%m-%d")
        }

    weather_tensor = torch.tensor(weather_array, dtype=torch.float32).unsqueeze(0).to(_device)
    context_tensor = torch.tensor(context_array, dtype=torch.float32).unsqueeze(0).to(_device)

    mc_predictions = []
    _sat_model.train() 
    with torch.no_grad():
        for _ in range(mc_samples):
            if _device.type == "cuda":
                with autocast("cuda"):
                    preds, _ = _sat_model(weather_tensor, context_tensor)
            else:
                preds, _ = _sat_model(weather_tensor, context_tensor)
            mc_predictions.append(preds.cpu().numpy()[0])

    mc_predictions = np.array(mc_predictions)
    mean_preds = mc_predictions.mean(axis=0)
    std_preds = mc_predictions.std(axis=0)  # For confidence calculation

    if "Precipitation_mm" in target_names:
        pidx = target_names.index("Precipitation_mm")
        mean_preds[:, pidx] = np.expm1(np.clip(np.maximum(mean_preds[:, pidx], 0), 0, 5.0))

    # Load validation metrics for confidence calibration (if available)
    val_metrics = None
    lstm_metrics_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "models", "lstm_transformer", "checkpoints", "validation_metrics.json"
    )
    if os.path.exists(lstm_metrics_path):
        with open(lstm_metrics_path, "r") as f:
            val_metrics = json.load(f)

    forecast_dates = pd.date_range(base_date + pd.Timedelta(days=1), periods=forecast_horizon, freq="D")
    
    predictions = []
    for i in range(forecast_horizon):
        pred_dict = {"date": forecast_dates[i].strftime("%Y-%m-%d")}
        for t_idx, target_name in enumerate(target_names):
            val = float(mean_preds[i, t_idx])
            if target_name == "Wind_Speed_Max_kmh":
                val = max(0.0, val)
            pred_dict[target_name] = val
            
        if "Temp_Min_C" in pred_dict and "Temp_Max_C" in pred_dict:
            pred_dict["Temp_Min_C"] = max(-10.0, pred_dict["Temp_Min_C"])
            if pred_dict["Temp_Min_C"] > pred_dict["Temp_Max_C"]:
                pred_dict["Temp_Min_C"], pred_dict["Temp_Max_C"] = pred_dict["Temp_Max_C"], pred_dict["Temp_Min_C"]
        
        # Compute dynamic confidence from MC dropout uncertainty
        conf = compute_forecast_confidence(
            day_ahead=i + 1,
            mc_std=std_preds[i],
            target_names=target_names,
            historical_mae_by_day=val_metrics,
        )
        pred_dict["confidence"] = conf
        
        # Rain probability estimate from the prediction magnitude
        if "Precipitation_mm" in target_names:
            precip_val = pred_dict["Precipitation_mm"]
            # Simple heuristic: higher precip → higher rain probability
            pred_dict["rain_probability"] = min(1.0, max(0.0, precip_val / 5.0))
        
        predictions.append(pred_dict)

    return {
        "predictions": predictions,
        "base_date": base_date.strftime("%Y-%m-%d")
    }
