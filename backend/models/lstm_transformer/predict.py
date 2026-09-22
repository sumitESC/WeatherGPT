"""
LSTM-Transformer Real-Time Prediction Script (v2)
Generates 16-day forecasts using the most recent 30 days of weather data.

v2 Changes:
  - Two-stage rainfall: classifier gate + dedicated regression
  - Per-day dynamic confidence from MC dropout + validation metrics
  - Rain probability output per day
"""
import os
import sys
import argparse
import json
import numpy as np
import pandas as pd
import torch
from torch.amp import autocast

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lstm_transformer import config
from lstm_transformer.model import WeatherLSTMTransformer
from lstm_transformer.confidence import compute_forecast_confidence


def load_model(device=None):
    """Load the best saved model."""
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model_path = os.path.join(config.MODEL_SAVE_DIR, "best_model.pt")
    checkpoint = torch.load(model_path, map_location=device, weights_only=False)

    feature_dims = checkpoint["feature_dims"]
    model_config = checkpoint["config"]

    model = WeatherLSTMTransformer(
        n_weather_features=feature_dims["n_weather_features"],
        n_context_features=feature_dims["n_context_features"],
        n_targets=feature_dims["n_targets"],
        embed_dim=model_config["embed_dim"],
        lstm_hidden=model_config["lstm_hidden"],
        lstm_layers=model_config["lstm_layers"],
        transformer_heads=model_config["transformer_heads"],
        transformer_layers=model_config["transformer_layers"],
        transformer_ff_dim=model_config["transformer_ff_dim"],
        dropout=model_config["dropout"],
        seq_length=model_config["seq_length"],
        forecast_horizon=model_config["forecast_horizon"],
    ).to(device)

    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()
    return model, model_config, feature_dims


def load_validation_metrics():
    """Load per-day validation MAE for confidence calibration."""
    metrics_path = os.path.join(config.MODEL_SAVE_DIR, "validation_metrics.json")
    if os.path.exists(metrics_path):
        with open(metrics_path, "r") as f:
            return json.load(f)
    return None


def predict_city(city, date=None, mc_samples=20):
    """
    Generate a 16-day forecast for a specific UP city.

    Args:
        city: City name (e.g., "Lucknow")
        date: Base date for prediction (default: latest available)
        mc_samples: Number of Monte Carlo dropout samples for uncertainty

    Returns:
        DataFrame with forecast, confidence bounds, rain probability, and confidence
    """
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model, model_config, feature_dims = load_model(device)
    target_names = model_config["target_cols"]
    seq_length = model_config["seq_length"]
    forecast_horizon = model_config["forecast_horizon"]
    val_metrics = load_validation_metrics()

    print(f"Model loaded ({model.count_parameters():,} params) on {device}")

    # Load recent weather data with all rolling features
    weather_df = pd.read_csv(config.HISTORICAL_CSV)
    weather_df["Date"] = pd.to_datetime(weather_df["Date"])

    city_df = weather_df[weather_df["City"] == city].sort_values("Date")
    if city_df.empty:
        print(f"Error: City '{city}' not found.")
        return None

    if date is not None:
        date = pd.Timestamp(date)
        city_df = city_df[city_df["Date"] <= date]

    # Get the last seq_length days
    recent = city_df.tail(seq_length).copy()
    base_date = recent["Date"].iloc[-1]
    print(f"Base date: {base_date.date()}")

    if len(recent) < seq_length:
        print(f"Warning: Only {len(recent)} days available (need {seq_length}). Padding with repeats.")
        while len(recent) < seq_length:
            recent = pd.concat([recent.iloc[:1], recent], ignore_index=True)

    # Build weather features
    weather_cols = [c for c in config.WEATHER_FEATURE_COLS if c in recent.columns]

    # Wind encoding
    if config.WIND_DIR_COL in recent.columns:
        wind_rad = np.deg2rad(recent[config.WIND_DIR_COL].fillna(0))
        recent["Wind_Dir_Sin"] = np.sin(wind_rad)
        recent["Wind_Dir_Cos"] = np.cos(wind_rad)
        weather_cols += ["Wind_Dir_Sin", "Wind_Dir_Cos"]

    # Satellite features
    try:
        sat_df = pd.read_csv(config.UP_SATELLITE_CSV)
        sat_df["Date"] = pd.to_datetime(sat_df["Date"])
        sat_city = sat_df[sat_df["City"] == city].sort_values("Date")
        sat_cols = [c for c in config.SATELLITE_COLS if c in sat_city.columns]
        if sat_cols and not sat_city.empty:
            sat_city = sat_city.set_index("Date")[sat_cols]
            date_range = pd.date_range(sat_city.index.min(), sat_city.index.max(), freq="D")
            sat_city = sat_city.reindex(date_range).ffill().bfill()
            for sc in sat_cols:
                if sc in sat_city.columns:
                    vals = []
                    for d in recent["Date"]:
                        if d in sat_city.index:
                            vals.append(sat_city.loc[d, sc])
                        else:
                            vals.append(np.nan)
                    recent[sc] = vals
            weather_cols += sat_cols
    except Exception:
        pass

    # Log-transform precipitation in features
    if "Precipitation_mm" in weather_cols:
        precip_feat_idx = weather_cols.index("Precipitation_mm")

    weather_array = recent[weather_cols].fillna(0).values.astype(np.float32)
    if "Precipitation_mm" in weather_cols:
        weather_array[:, precip_feat_idx] = np.log1p(
            np.maximum(weather_array[:, precip_feat_idx], 0)
        )

    # Pad or trim to expected feature count
    expected_feats = feature_dims["n_weather_features"]
    if weather_array.shape[1] < expected_feats:
        pad = np.zeros((weather_array.shape[0], expected_feats - weather_array.shape[1]),
                       dtype=np.float32)
        weather_array = np.concatenate([weather_array, pad], axis=1)
    elif weather_array.shape[1] > expected_feats:
        weather_array = weather_array[:, :expected_feats]

    # Build context features
    expected_ctx = feature_dims["n_context_features"]
    context_array = np.zeros((seq_length, max(expected_ctx, 1)), dtype=np.float32)

    try:
        try:
            from xgboost.model.context_builder import build_all_context_features
        except ImportError:
            import sys
            sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "xgboost", "model"))
            from context_builder import build_all_context_features
        ctx_weather = pd.read_csv(config.CONTEXT_WEATHER_CSV)
        ctx_weather["Date"] = pd.to_datetime(ctx_weather["Date"])
        ctx_sat = pd.read_csv(config.CONTEXT_SATELLITE_CSV)
        ctx_sat["Date"] = pd.to_datetime(ctx_sat["Date"])
        if "LST_Celsius" in ctx_sat.columns:
            ctx_sat = ctx_sat.drop(columns=["LST_Celsius"])

        context_df = build_all_context_features(ctx_weather, ctx_sat)
        context_df = context_df.set_index("Date")
        ctx_cols = [c for c in context_df.columns]

        for i, d in enumerate(recent["Date"]):
            d_ts = pd.Timestamp(d)
            if d_ts in context_df.index:
                row = context_df.loc[d_ts, ctx_cols[:expected_ctx]].values
                context_array[i, :len(row)] = np.nan_to_num(
                    row.astype(np.float32), nan=0.0
                )
    except Exception as e:
        print(f"  Context loading skipped: {e}")

    # Apply standard scaling and clip
    if "weather_mean" in feature_dims:
        weather_mean = feature_dims["weather_mean"]
        weather_std = feature_dims["weather_std"]
        # Only scale up to the available dimension
        dim_w = min(weather_array.shape[1], len(weather_mean))
        weather_array[:, :dim_w] = (weather_array[:, :dim_w] - weather_mean[:dim_w]) / weather_std[:dim_w]
        weather_array = np.clip(weather_array, -10.0, 10.0)

    if "context_mean" in feature_dims:
        ctx_mean = feature_dims["context_mean"]
        ctx_std = feature_dims["context_std"]
        dim_c = min(context_array.shape[1], len(ctx_mean))
        context_array[:, :dim_c] = (context_array[:, :dim_c] - ctx_mean[:dim_c]) / ctx_std[:dim_c]
        context_array = np.clip(context_array, -10.0, 10.0)

    # Convert to tensors
    weather_tensor = torch.tensor(weather_array, dtype=torch.float32).unsqueeze(0).to(device)
    context_tensor = torch.tensor(context_array, dtype=torch.float32).unsqueeze(0).to(device)

    # MC Dropout for uncertainty estimation
    print(f"Running {mc_samples} Monte Carlo samples for uncertainty...")
    mc_predictions = []
    mc_precip_logits = []
    mc_rain_amounts = []
    model.train()  # Enable dropout for MC sampling
    with torch.no_grad():
        for _ in range(mc_samples):
            if device.type == "cuda":
                with autocast("cuda"):
                    preds, precip_logits, rain_amounts = model(
                        weather_tensor, context_tensor
                    )
            else:
                preds, precip_logits, rain_amounts = model(
                    weather_tensor, context_tensor
                )
            mc_predictions.append(preds.cpu().numpy()[0])
            mc_precip_logits.append(precip_logits.cpu().numpy()[0])
            mc_rain_amounts.append(rain_amounts.cpu().numpy()[0])

    mc_predictions = np.array(mc_predictions)  # (mc_samples, horizon, n_targets)
    mean_preds = mc_predictions.mean(axis=0)
    std_preds = mc_predictions.std(axis=0)
    lower_95 = mean_preds - 1.96 * std_preds
    upper_95 = mean_preds + 1.96 * std_preds

    # ================================================================
    # Two-stage precipitation processing
    # ================================================================
    rain_probs_per_day = np.zeros(forecast_horizon)

    if "Precipitation_mm" in target_names:
        pidx = target_names.index("Precipitation_mm")

        # Stage 1: Rain probability from classifier
        mc_precip_logits = np.array(mc_precip_logits)  # (mc_samples, horizon, 1)
        mean_precip_logits = mc_precip_logits.mean(axis=0).squeeze(-1)  # (horizon,)
        rain_probs = 1 / (1 + np.exp(-mean_precip_logits))  # Sigmoid
        rain_probs_per_day = rain_probs.copy()

        # Stage 2: Rain amount from dedicated head
        mc_rain_amounts = np.array(mc_rain_amounts)  # (mc_samples, horizon, 1)
        mean_rain_amounts = mc_rain_amounts.mean(axis=0).squeeze(-1)  # (horizon,)
        std_rain_amounts = mc_rain_amounts.std(axis=0).squeeze(-1)

        # Combine: use rain amount from dedicated head, gated by rain probability
        rain_threshold = 0.3  # Lower than 0.5 to catch more rain events
        rain_mask = (rain_probs >= rain_threshold)

        # Inverse log-transform the rain amounts (they're in log1p space)
        final_precip = np.expm1(np.maximum(mean_rain_amounts, 0)) * rain_mask

        # Also update the general predictions' precipitation column
        general_precip = np.expm1(np.maximum(mean_preds[:, pidx], 0))

        # Use the HIGHER of general or dedicated rain head (to avoid underprediction)
        final_precip = np.maximum(final_precip, general_precip * rain_mask)

        mean_preds[:, pidx] = final_precip
        lower_95[:, pidx] = np.maximum(
            np.expm1(np.maximum(lower_95[:, pidx], 0)), 0
        ) * rain_mask
        upper_95[:, pidx] = np.expm1(
            np.maximum(upper_95[:, pidx], 0)
        ) * rain_mask

    # ================================================================
    # Dynamic confidence calculation
    # ================================================================
    confidences = []
    for day in range(forecast_horizon):
        day_mc_std = std_preds[day]  # (n_targets,)
        conf = compute_forecast_confidence(
            day_ahead=day + 1,
            mc_std=day_mc_std,
            target_names=target_names,
            historical_mae_by_day=val_metrics,
        )
        confidences.append(conf)

    # Build output DataFrame
    forecast_dates = pd.date_range(base_date + pd.Timedelta(days=1),
                                    periods=forecast_horizon, freq="D")

    result = pd.DataFrame({
        "Date": forecast_dates,
        "Day_Ahead": range(1, forecast_horizon + 1),
    })

    for t_idx, target_name in enumerate(target_names):
        result[target_name] = mean_preds[:, t_idx]
        result[f"{target_name}_lower95"] = lower_95[:, t_idx]
        result[f"{target_name}_upper95"] = upper_95[:, t_idx]

    result["rain_probability"] = rain_probs_per_day
    result["confidence"] = confidences

    # Display
    print(f"\n--- {forecast_horizon}-Day Forecast for {city} ---")
    display_cols = ["Date", "Day_Ahead"] + target_names + ["rain_probability", "confidence"]
    print(result[display_cols].to_string(index=False))

    # Save
    os.makedirs(config.PREDICTIONS_DIR, exist_ok=True)
    out_path = os.path.join(
        config.PREDICTIONS_DIR,
        f"lstm_forecast_{city}_{base_date.strftime('%Y-%m-%d')}.csv"
    )
    result.to_csv(out_path, index=False)
    print(f"\nForecast saved to {out_path}")

    return result


def main():
    parser = argparse.ArgumentParser(description="LSTM-Transformer Real-Time Prediction (v2)")
    parser.add_argument("--city", type=str, default="Lucknow",
                       help="City name to predict")
    parser.add_argument("--date", type=str, default=None,
                       help="Base date (YYYY-MM-DD). Default: latest available.")
    parser.add_argument("--mc-samples", type=int, default=20,
                       help="Monte Carlo samples for uncertainty")
    parser.add_argument("--all-cities", action="store_true",
                       help="Predict for all 75 UP cities")
    args = parser.parse_args()

    if args.all_cities:
        weather_df = pd.read_csv(config.UP_WEATHER_CSV)
        cities = sorted(weather_df["City"].unique())
        print(f"Predicting for {len(cities)} cities...")
        for i, city in enumerate(cities):
            print(f"\n[{i+1}/{len(cities)}] {city}")
            try:
                predict_city(city, date=args.date, mc_samples=args.mc_samples)
            except Exception as e:
                print(f"  Error: {e}")
    else:
        predict_city(args.city, date=args.date, mc_samples=args.mc_samples)


if __name__ == "__main__":
    main()
