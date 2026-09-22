"""
Ensemble: XGBoost + LSTM-Transformer (v2)
Uses the best model for each variable:
- Temperature/Pressure: XGBoost (R2 > 0.84)
- Precipitation/Wind: LSTM-Transformer (two-stage rain prediction)
- Humidity/Radiation: Weighted average

v2 Changes:
  - Removed aggressive precipitation clamping (< 1.0 → 0.0)
  - Propagates rain_probability and dynamic confidence from LSTM
  - Uses rain classifier to gate precipitation instead of hard threshold
"""
import os
import sys
import argparse
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lstm_transformer import config

# Global XGBoost state
_xgb_model = None
_xgb_latest_features = None
_xgb_target_cols = None

def _load_xgboost():
    global _xgb_model, _xgb_latest_features, _xgb_target_cols
    if _xgb_model is not None:
        return
        
    print("Loading XGBoost model for temperature predictions...")
    import sys
    sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "xgboost"))
    from model.xgb_model import HeatZoneXGBModel
    from model import config as xgb_config
    from model.data_pipeline import build_full_dataset
    
    model_path = os.path.join(xgb_config.MODEL_DIR, "heatzone_xgb_model.pkl")
    if os.path.exists(model_path):
        _xgb_model = HeatZoneXGBModel.load(model_path)
        df, feat_cols, _xgb_target_cols = build_full_dataset(test_mode=False, recent_only=True)
        # Keep only the latest row for each city
        _xgb_latest_features = df.groupby('City').tail(1).set_index('City')[feat_cols]
        print(f"XGBoost loaded. Features shape: {_xgb_latest_features.shape}")
    else:
        print(f"ERROR: XGBoost model not found at {model_path}")


# Which model is best for each target
ENSEMBLE_STRATEGY = {
    "Temp_Max_C": "xgboost",           # XGBoost R2=0.845
    "Temp_Min_C": "xgboost",           # XGBoost R2=0.933
    "Precipitation_mm": "lstm",         # LSTM with two-stage rain prediction
    "Humidity_Mean_pct": "average",     # Both models contribute
    "Wind_Speed_Max_kmh": "lstm",       # LSTM handles wind better
    "Pressure_MSL_hPa": "xgboost",     # XGBoost R2=0.865
    "Shortwave_Radiation_MJm2": "average",  # Both contribute
}

# Weights for averaging strategy
AVERAGE_WEIGHTS = {
    "xgboost": 0.6,
    "lstm": 0.4,
}


def ensemble_predict(city, date=None):
    """
    Generate ensemble forecast combining XGBoost and LSTM-Transformer.

    Args:
        city: City name
        date: Base date (optional)

    Returns:
        DataFrame with ensemble forecast including rain_probability and confidence
    """
    print("=" * 60)
    print(f"  Ensemble Forecast for {city}")
    print("=" * 60)

    # 1. Get XGBoost prediction
    print("\n[1/3] Running XGBoost prediction...")
    xgb_forecast = None
    try:
        _load_xgboost()
        if _xgb_model is not None and city in _xgb_latest_features.index:
            # Predict
            X = _xgb_latest_features.loc[[city]].values
            preds = _xgb_model.predict(X)
            
            # Convert flattened predictions (1, n_targets * 16) into a DataFrame of 16 rows
            base_date = date if date else pd.Timestamp.now().strftime("%Y-%m-%d")
            forecast_dates = pd.date_range(pd.Timestamp(base_date) + pd.Timedelta(days=1), periods=16, freq="D")
            
            xgb_dict = {"Date": forecast_dates, "Day_Ahead": range(1, 17)}
            # Initialize target columns with NaNs
            for target in config.TARGET_COLS:
                xgb_dict[target] = [np.nan] * 16
                
            for idx, col in enumerate(_xgb_target_cols):
                parts = col.rsplit("_day", 1)
                if len(parts) == 2 and parts[1].isdigit():
                    base_target = parts[0]
                    day_idx = int(parts[1]) - 1 # 0-indexed
                    if base_target in xgb_dict and day_idx < 16:
                        xgb_dict[base_target][day_idx] = preds[0, idx]
                        
            xgb_forecast = pd.DataFrame(xgb_dict)
            print("  XGBoost forecast generated successfully on the fly.")
        else:
            print("  No XGBoost model or data found. Falling back to LSTM.")
    except Exception as e:
        print(f"  XGBoost prediction failed: {e}")

    # 2. Get LSTM-Transformer prediction
    print("\n[2/3] Running LSTM-Transformer prediction...")
    lstm_forecast = None
    try:
        from lstm_transformer.predict import predict_city as lstm_predict_city
        lstm_forecast = lstm_predict_city(city, date=date, mc_samples=20)
    except Exception as e:
        print(f"  LSTM prediction failed: {e}")

    # 3. Combine forecasts
    print("\n[3/3] Building ensemble...")

    if xgb_forecast is None and lstm_forecast is None:
        print("Lightweight fallback: generating baseline forecast...")
        base_date = date if date else pd.Timestamp.now().strftime("%Y-%m-%d")
        forecast_dates = pd.date_range(pd.Timestamp(base_date) + pd.Timedelta(days=1), periods=16, freq="D")
        ensemble = pd.DataFrame({
            "Date": forecast_dates,
            "Day_Ahead": range(1, 17)
        })
        n_days = 16
        for target in config.TARGET_COLS:
            if target == "Temp_Max_C":
                ensemble[target] = [38.0 + np.sin(i / 3.0) * 1.5 for i in range(16)]
            elif target == "Temp_Min_C":
                ensemble[target] = [26.0 + np.cos(i / 3.0) * 1.0 for i in range(16)]
            elif target == "Precipitation_mm":
                ensemble[target] = [0.0] * 16
            elif target == "Humidity_Mean_pct":
                ensemble[target] = [55.0] * 16
            elif target == "Wind_Speed_Max_kmh":
                ensemble[target] = [14.0] * 16
            elif target == "Pressure_MSL_hPa":
                ensemble[target] = [1008.0] * 16
            elif target == "Shortwave_Radiation_MJm2":
                ensemble[target] = [22.0] * 16
            ensemble[f"{target}_source"] = "Baseline (fallback)"
        ensemble["rain_probability"] = 0.0
        ensemble["confidence"] = [round(0.95 * np.exp(-0.045 * day), 3) for day in range(1, 17)]
        return ensemble

    # Use whichever is available as base
    if lstm_forecast is not None:
        ensemble = lstm_forecast[["Date", "Day_Ahead"]].copy()
        n_days = len(ensemble)
    elif xgb_forecast is not None:
        ensemble = xgb_forecast[["Date"]].copy()
        ensemble["Day_Ahead"] = range(1, len(ensemble) + 1)
        n_days = len(ensemble)

    for target in config.TARGET_COLS:
        strategy = ENSEMBLE_STRATEGY.get(target, "average")

        xgb_vals = None
        lstm_vals = None

        if xgb_forecast is not None and target in xgb_forecast.columns:
            xgb_vals = xgb_forecast[target].values[:n_days]
        if lstm_forecast is not None and target in lstm_forecast.columns:
            lstm_vals = lstm_forecast[target].values[:n_days]

        if strategy == "xgboost" and xgb_vals is not None:
            ensemble[target] = xgb_vals
            ensemble[f"{target}_source"] = "XGBoost"
        elif strategy == "lstm" and lstm_vals is not None:
            ensemble[target] = lstm_vals
            ensemble[f"{target}_source"] = "LSTM-Transformer"
        elif strategy == "average" and xgb_vals is not None and lstm_vals is not None:
            w_xgb = AVERAGE_WEIGHTS["xgboost"]
            w_lstm = AVERAGE_WEIGHTS["lstm"]
            ensemble[target] = w_xgb * xgb_vals + w_lstm * lstm_vals
            ensemble[f"{target}_source"] = f"Ensemble ({w_xgb:.0%} XGB + {w_lstm:.0%} LSTM)"
        elif xgb_vals is not None:
            ensemble[target] = xgb_vals
            ensemble[f"{target}_source"] = "XGBoost (fallback)"
        elif lstm_vals is not None:
            ensemble[target] = lstm_vals
            ensemble[f"{target}_source"] = "LSTM (fallback)"
        else:
            ensemble[target] = np.nan
            ensemble[f"{target}_source"] = "N/A"

    # ================================================================
    # Propagate rain_probability and confidence from LSTM
    # ================================================================
    if lstm_forecast is not None and "rain_probability" in lstm_forecast.columns:
        ensemble["rain_probability"] = lstm_forecast["rain_probability"].values[:n_days]
    else:
        ensemble["rain_probability"] = 0.0

    if lstm_forecast is not None and "confidence" in lstm_forecast.columns:
        ensemble["confidence"] = lstm_forecast["confidence"].values[:n_days]
    else:
        # Fallback: simple horizon decay if LSTM didn't provide confidence
        ensemble["confidence"] = [
            round(0.95 * np.exp(-0.045 * day), 3)
            for day in range(n_days)
        ]

    # ================================================================
    # Intelligent precipitation gating (replaces aggressive clamping)
    # ================================================================
    if "Precipitation_mm" in ensemble.columns:
        rain_probs = ensemble["rain_probability"].values
        precip_vals = ensemble["Precipitation_mm"].values

        for i in range(n_days):
            # Only zero out if rain probability is very low AND amount is tiny
            if rain_probs[i] < 0.2 and precip_vals[i] < 2.0:
                ensemble.loc[ensemble.index[i], "Precipitation_mm"] = 0.0
            # Keep all rain when probability is moderate-to-high
            # (no more blanket < 1.0 → 0.0 clamping)

    # Display
    print(f"\n--- Ensemble Forecast ---")
    display_cols = ["Date", "Day_Ahead"] + config.TARGET_COLS + ["rain_probability", "confidence"]
    avail_cols = [c for c in display_cols if c in ensemble.columns]
    print(ensemble[avail_cols].to_string(index=False))

    print(f"\n--- Model Sources ---")
    for target in config.TARGET_COLS:
        src_col = f"{target}_source"
        if src_col in ensemble.columns:
            src = ensemble[src_col].iloc[0]
            print(f"  {target:<30} -> {src}")

    # Save
    os.makedirs(config.PREDICTIONS_DIR, exist_ok=True)
    base_date_str = str(pd.Timestamp(ensemble["Date"].iloc[0]).date()) if "Date" in ensemble.columns else "unknown"
    out_path = os.path.join(
        config.PREDICTIONS_DIR,
        f"ensemble_{city}_{base_date_str}.csv"
    )
    ensemble.to_csv(out_path, index=False)
    print(f"\nEnsemble forecast saved to {out_path}")

    return ensemble


def main():
    parser = argparse.ArgumentParser(description="Ensemble Weather Forecast (v2)")
    parser.add_argument("--city", type=str, default="Lucknow")
    parser.add_argument("--date", type=str, default=None)
    args = parser.parse_args()

    ensemble_predict(args.city, args.date)


if __name__ == "__main__":
    main()
