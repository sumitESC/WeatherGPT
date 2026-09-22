"""
Dynamic Forecast Confidence Calculator

Replaces the hardcoded confidence = 0.85 with a data-driven estimate:
  confidence = f(forecast_horizon, MC_uncertainty, historical_accuracy)

Components:
  1. Horizon decay — confidence naturally decreases with forecast day
  2. MC uncertainty penalty — lower confidence when model disagrees across samples
  3. Historical calibration — use per-day validation MAE to calibrate

This ensures Day 1 gets ~0.90+ while Day 16 gets ~0.45-0.55.
"""
import numpy as np


# Expected MAE ranges per target (for normalizing MC std)
EXPECTED_MAE = {
    "Temp_Max_C": 2.0,         # 2°C is acceptable temp error
    "Temp_Min_C": 2.0,
    "Precipitation_mm": 5.0,   # 5mm is acceptable rain error
    "Humidity_Mean_pct": 8.0,  # 8% humidity
    "Wind_Speed_Max_kmh": 5.0, # 5 km/h
    "Pressure_MSL_hPa": 3.0,  # 3 hPa
    "Shortwave_Radiation_MJm2": 3.0,
}

# Acceptable MAE thresholds (errors above this reduce confidence significantly)
ACCEPTABLE_ERROR = {
    "Temp_Max_C": 3.0,
    "Temp_Min_C": 3.0,
    "Precipitation_mm": 10.0,
    "Humidity_Mean_pct": 12.0,
    "Wind_Speed_Max_kmh": 8.0,
    "Pressure_MSL_hPa": 5.0,
    "Shortwave_Radiation_MJm2": 5.0,
}


def compute_forecast_confidence(day_ahead, mc_std, target_names,
                                 historical_mae_by_day=None):
    """
    Compute a dynamic confidence score for a specific forecast day.

    Args:
        day_ahead: int, 1-16 (which forecast day)
        mc_std: np.array of shape (n_targets,) — MC dropout std per target
        target_names: list of target variable names
        historical_mae_by_day: dict mapping target_name -> list[MAE per day]
            from validation set. If None, only uses horizon decay + MC penalty.

    Returns:
        float: confidence score between 0.0 and 1.0
    """
    # ================================================================
    # 1. Horizon decay: confidence naturally drops with forecast day
    # ================================================================
    # Exponential decay: Day1=0.93, Day8=0.68, Day16=0.48
    decay_rate = 0.045
    base_confidence = 0.95 * np.exp(-decay_rate * (day_ahead - 1))

    # ================================================================
    # 2. MC uncertainty penalty: penalize when model is highly uncertain
    # ================================================================
    mc_penalties = []
    for t_idx, name in enumerate(target_names):
        expected = EXPECTED_MAE.get(name, 5.0)
        # Normalize MC std by expected MAE
        normalized_std = mc_std[t_idx] / expected if expected > 0 else 0.0
        # Penalty: clip to [0, 0.15] per target
        penalty = min(normalized_std * 0.1, 0.15)
        mc_penalties.append(penalty)

    # Average penalty across all targets
    avg_mc_penalty = np.mean(mc_penalties) if mc_penalties else 0.0

    # ================================================================
    # 3. Historical calibration: adjust based on validation performance
    # ================================================================
    hist_factor = 1.0
    if historical_mae_by_day is not None:
        hist_adjustments = []
        for name in target_names:
            if name in historical_mae_by_day:
                day_idx = day_ahead - 1
                maes = historical_mae_by_day[name]
                if day_idx < len(maes):
                    mae = maes[day_idx]
                    acceptable = ACCEPTABLE_ERROR.get(name, 5.0)
                    # Factor: 1.0 if MAE is 0, drops as MAE approaches acceptable
                    adj = 1.0 - min(mae / acceptable, 0.3)
                    hist_adjustments.append(adj)

        if hist_adjustments:
            hist_factor = np.mean(hist_adjustments)

    # ================================================================
    # Combine: base * historical_factor - mc_penalty
    # ================================================================
    confidence = base_confidence * hist_factor - avg_mc_penalty

    # Clamp to reasonable range [0.15, 0.95]
    confidence = max(0.15, min(0.95, confidence))

    return round(float(confidence), 3)


def compute_batch_confidences(forecast_horizon, mc_stds, target_names,
                               historical_mae_by_day=None):
    """
    Compute confidence scores for all forecast days at once.

    Args:
        forecast_horizon: int (typically 16)
        mc_stds: np.array of shape (horizon, n_targets) — MC std per day per target
        target_names: list of target names
        historical_mae_by_day: dict from validation metrics

    Returns:
        list of float: confidence per day
    """
    confidences = []
    for day in range(forecast_horizon):
        conf = compute_forecast_confidence(
            day_ahead=day + 1,
            mc_std=mc_stds[day],
            target_names=target_names,
            historical_mae_by_day=historical_mae_by_day,
        )
        confidences.append(conf)
    return confidences
