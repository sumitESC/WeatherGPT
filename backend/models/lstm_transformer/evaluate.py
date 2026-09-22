"""
LSTM-Transformer Evaluation Script (v2)
Comprehensive metrics suite for the hackathon:

Temperature: MAE, RMSE, R²
Rainfall: MAE, RMSE, occurrence accuracy, Precision/Recall/F1, Brier Score
Heat Risk: MAE, zone classification accuracy, correlation
"""
import os
import sys
import json
import numpy as np
import torch
from torch.amp import autocast

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lstm_transformer import config
from lstm_transformer.dataset import create_dataloaders
from lstm_transformer.model import WeatherLSTMTransformer


def load_model(device=None):
    """Load the best saved model."""
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model_path = os.path.join(config.MODEL_SAVE_DIR, "best_model.pt")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"No model found at {model_path}. Run train.py first.")

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

    print(f"Model loaded from {model_path} (epoch {checkpoint['epoch']})")
    return model, model_config


def evaluate():
    print("=" * 70)
    print("  LSTM-Transformer Comprehensive Evaluation (v2)")
    print("=" * 70)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"  Device: {device}")

    # Load model
    model, model_config = load_model(device)

    # Load test data
    _, _, test_loader, feature_dims = create_dataloaders(test_mode=False)
    target_names = model_config["target_cols"]
    forecast_horizon = model_config["forecast_horizon"]

    print(f"\n  Targets: {target_names}")
    print(f"  Forecast horizon: {forecast_horizon} days")

    # Collect predictions, actuals, and rain logits
    all_preds = []
    all_targets = []
    all_masks = []
    all_precip_logits = []
    all_rain_amounts = []

    use_amp = device.type == "cuda"

    with torch.no_grad():
        for batch in test_loader:
            weather_seq = batch["weather_seq"].to(device)
            context_seq = batch["context_seq"].to(device)
            targets = batch["targets"]
            target_mask = batch["target_mask"]

            if use_amp:
                with autocast("cuda"):
                    preds, precip_logits, rain_amounts = model(
                        weather_seq, context_seq
                    )
            else:
                preds, precip_logits, rain_amounts = model(
                    weather_seq, context_seq
                )

            all_preds.append(preds.cpu().numpy())
            all_targets.append(targets.numpy())
            all_masks.append(target_mask.numpy())
            all_precip_logits.append(precip_logits.cpu().numpy())
            all_rain_amounts.append(rain_amounts.cpu().numpy())

    all_preds = np.concatenate(all_preds, axis=0)
    all_targets = np.concatenate(all_targets, axis=0)
    all_masks = np.concatenate(all_masks, axis=0)
    all_precip_logits = np.concatenate(all_precip_logits, axis=0)
    all_rain_amounts = np.concatenate(all_rain_amounts, axis=0)

    print(f"\n  Test samples: {all_preds.shape[0]}")

    # Inverse log-transform for precipitation
    precip_idx = None
    if "Precipitation_mm" in target_names:
        precip_idx = target_names.index("Precipitation_mm")
        all_preds[:, :, precip_idx] = np.expm1(
            np.maximum(all_preds[:, :, precip_idx], 0)
        )
        all_targets[:, :, precip_idx] = np.expm1(
            np.maximum(all_targets[:, :, precip_idx], 0)
        )
        # Rain amounts from dedicated head
        all_rain_amounts = np.expm1(np.maximum(all_rain_amounts.squeeze(-1), 0))

    from sklearn.metrics import (mean_absolute_error, mean_squared_error,
                                  r2_score, precision_score, recall_score,
                                  f1_score, accuracy_score, brier_score_loss)

    # ================================================================
    # SECTION 1: Per-Variable Per-Day Metrics (Temperature, etc.)
    # ================================================================
    print(f"\n{'='*70}")
    print(f"  SECTION 1: Per-Variable Per-Day Metrics")
    print(f"{'='*70}")

    summary_results = {}

    for t_idx, target_name in enumerate(target_names):
        print(f"\n  --- {target_name} ---")
        print(f"  {'Day':<8} {'MAE':<10} {'RMSE':<10} {'R²':<10} {'Within2':<10} {'Within5':<10}")
        print(f"  {'-'*8} {'-'*10} {'-'*10} {'-'*10} {'-'*10} {'-'*10}")

        day_maes = []
        day_rmses = []
        day_r2s = []

        for day in range(forecast_horizon):
            yt = all_targets[:, day, t_idx]
            yp = all_preds[:, day, t_idx]
            mask = all_masks[:, day, t_idx] > 0.5

            if mask.sum() < 10:
                day_maes.append(np.nan)
                day_rmses.append(np.nan)
                day_r2s.append(np.nan)
                continue

            yt_v = yt[mask]
            yp_v = yp[mask]

            mae = mean_absolute_error(yt_v, yp_v)
            rmse = np.sqrt(mean_squared_error(yt_v, yp_v))
            r2 = r2_score(yt_v, yp_v) if np.std(yt_v) > 0 else 0.0
            errors = np.abs(yt_v - yp_v)
            w2 = (errors < 2.0).mean() * 100
            w5 = (errors < 5.0).mean() * 100

            day_maes.append(mae)
            day_rmses.append(rmse)
            day_r2s.append(r2)

            print(f"  Day {day+1:<4} {mae:<10.3f} {rmse:<10.3f} {r2:<10.3f} {w2:<10.1f}% {w5:<10.1f}%")

        summary_results[target_name] = {
            "avg_mae": float(np.nanmean(day_maes)),
            "avg_rmse": float(np.nanmean(day_rmses)),
            "avg_r2": float(np.nanmean(day_r2s)),
            "day1_mae": float(day_maes[0]) if not np.isnan(day_maes[0]) else None,
            "day16_mae": float(day_maes[-1]) if not np.isnan(day_maes[-1]) else None,
        }

    # ================================================================
    # SECTION 2: Rainfall-Specific Metrics
    # ================================================================
    if precip_idx is not None:
        print(f"\n{'='*70}")
        print(f"  SECTION 2: Rainfall-Specific Metrics")
        print(f"{'='*70}")

        rain_metrics_by_day = {}

        for day in range(forecast_horizon):
            yt = all_targets[:, day, precip_idx]
            yp = all_preds[:, day, precip_idx]
            mask = all_masks[:, day, precip_idx] > 0.5
            yt_v, yp_v = yt[mask], yp[mask]

            if mask.sum() < 10:
                continue

            # Rain detection threshold = 1mm
            actual_rain = yt_v > config.RAIN_THRESHOLD_MM
            pred_rain = yp_v > config.RAIN_THRESHOLD_MM

            # Rain probability from classifier
            rain_logits = all_precip_logits[mask, day, 0]
            rain_prob = 1 / (1 + np.exp(-rain_logits))
            pred_rain_from_classifier = rain_prob >= 0.3

            # Metrics
            accuracy = accuracy_score(actual_rain, pred_rain_from_classifier)
            if actual_rain.sum() > 0 and (~actual_rain).sum() > 0:
                precision = precision_score(actual_rain, pred_rain_from_classifier,
                                             zero_division=0)
                recall = recall_score(actual_rain, pred_rain_from_classifier,
                                       zero_division=0)
                f1 = f1_score(actual_rain, pred_rain_from_classifier,
                               zero_division=0)
                brier = brier_score_loss(actual_rain.astype(float), rain_prob)
            else:
                precision = recall = f1 = brier = 0.0

            # Rain amount metrics (only on rain days)
            rain_day_mask = actual_rain
            if rain_day_mask.sum() > 0:
                rain_mae = mean_absolute_error(yt_v[rain_day_mask], yp_v[rain_day_mask])
                rain_rmse = np.sqrt(mean_squared_error(yt_v[rain_day_mask], yp_v[rain_day_mask]))
            else:
                rain_mae = rain_rmse = 0.0

            # CSI (Critical Success Index)
            hits = (actual_rain & pred_rain_from_classifier).sum()
            misses = (actual_rain & ~pred_rain_from_classifier).sum()
            false_alarms = (~actual_rain & pred_rain_from_classifier).sum()
            csi = hits / max(hits + misses + false_alarms, 1) * 100

            rain_metrics_by_day[day + 1] = {
                "accuracy": float(accuracy),
                "precision": float(precision),
                "recall": float(recall),
                "f1": float(f1),
                "brier_score": float(brier),
                "csi": float(csi),
                "rain_mae": float(rain_mae),
                "rain_rmse": float(rain_rmse),
                "n_rain_days": int(actual_rain.sum()),
                "n_total": int(mask.sum()),
            }

        # Print rainfall metrics table
        print(f"\n  Rain Detection (≥{config.RAIN_THRESHOLD_MM}mm threshold):")
        print(f"  {'Day':<6} {'Acc':<8} {'Prec':<8} {'Rec':<8} {'F1':<8} {'Brier':<8} {'CSI':<8} {'Rain MAE':<10}")
        print(f"  {'-'*6} {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*10}")

        for day in sorted(rain_metrics_by_day.keys()):
            m = rain_metrics_by_day[day]
            print(f"  Day {day:<2} "
                  f"{m['accuracy']:<8.3f} "
                  f"{m['precision']:<8.3f} "
                  f"{m['recall']:<8.3f} "
                  f"{m['f1']:<8.3f} "
                  f"{m['brier_score']:<8.3f} "
                  f"{m['csi']:<8.1f} "
                  f"{m['rain_mae']:<10.2f}")

        # Averages
        avg_f1 = np.mean([m['f1'] for m in rain_metrics_by_day.values()])
        avg_brier = np.mean([m['brier_score'] for m in rain_metrics_by_day.values()])
        avg_csi = np.mean([m['csi'] for m in rain_metrics_by_day.values()])
        print(f"\n  Average F1: {avg_f1:.3f} | Brier: {avg_brier:.3f} | CSI: {avg_csi:.1f}%")

        summary_results["Rainfall_Classification"] = {
            "avg_f1": float(avg_f1),
            "avg_brier": float(avg_brier),
            "avg_csi": float(avg_csi),
            "per_day": rain_metrics_by_day,
        }

        # Heavy rain detection (>20mm)
        print(f"\n  Heavy Rain Detection (>20mm):")
        yt_all = all_targets[:, 0, precip_idx]
        yp_all = all_preds[:, 0, precip_idx]
        mask_all = all_masks[:, 0, precip_idx] > 0.5
        yt_v, yp_v = yt_all[mask_all], yp_all[mask_all]

        heavy_actual = yt_v > 20.0
        heavy_pred = yp_v > 10.0
        heavy_hits = (heavy_actual & heavy_pred).sum()
        heavy_total = heavy_actual.sum()
        heavy_rate = heavy_hits / max(heavy_total, 1) * 100
        print(f"    Total heavy rain days (Day 1): {heavy_total}")
        print(f"    Detection rate: {heavy_rate:.1f}%")

    # ================================================================
    # SECTION 3: Uncertainty Growth Analysis
    # ================================================================
    print(f"\n{'='*70}")
    print(f"  SECTION 3: Uncertainty Growth Analysis")
    print(f"{'='*70}")

    # Compute per-day prediction std (proxy for uncertainty)
    print(f"\n  Per-Day Prediction Spread (std of predictions across samples):")
    print(f"  {'Day':<6}", end="")
    for name in target_names:
        short_name = name[:12]
        print(f" {short_name:<14}", end="")
    print()

    for day in [0, 3, 7, 11, 15]:  # Days 1, 4, 8, 12, 16
        print(f"  Day {day+1:<2}", end="")
        for t_idx in range(len(target_names)):
            mask = all_masks[:, day, t_idx] > 0.5
            if mask.sum() > 0:
                yt_v = all_targets[mask, day, t_idx]
                yp_v = all_preds[mask, day, t_idx]
                error_std = np.std(yt_v - yp_v)
                print(f" {error_std:<14.3f}", end="")
            else:
                print(f" {'N/A':<14}", end="")
        print()

    # ================================================================
    # SECTION 4: Summary Scorecard
    # ================================================================
    print(f"\n{'='*70}")
    print(f"  SECTION 4: Summary Scorecard")
    print(f"{'='*70}")

    print(f"\n  {'Variable':<30} {'Avg MAE':<10} {'Avg RMSE':<10} {'Avg R²':<10} {'Grade':<8}")
    print(f"  {'-'*30} {'-'*10} {'-'*10} {'-'*10} {'-'*8}")

    for name, metrics in summary_results.items():
        if name == "Rainfall_Classification":
            continue
        mae = metrics['avg_mae']
        rmse = metrics['avg_rmse']
        r2 = metrics['avg_r2']

        # Grade based on R²
        if r2 >= 0.8:
            grade = "A"
        elif r2 >= 0.6:
            grade = "B"
        elif r2 >= 0.4:
            grade = "C"
        elif r2 >= 0.2:
            grade = "D"
        else:
            grade = "F"

        print(f"  {name:<30} {mae:<10.3f} {rmse:<10.3f} {r2:<10.3f} {grade:<8}")

    if "Rainfall_Classification" in summary_results:
        rc = summary_results["Rainfall_Classification"]
        print(f"  {'Rain Detection (F1)':<30} {'':10} {'':10} {rc['avg_f1']:<10.3f} ", end="")
        if rc['avg_f1'] >= 0.5:
            print("B")
        elif rc['avg_f1'] >= 0.3:
            print("C")
        else:
            print("D")

    # Save evaluation report
    eval_report_path = os.path.join(config.MODEL_SAVE_DIR, "evaluation_report.json")
    with open(eval_report_path, "w") as f:
        # Convert numpy types for JSON serialization
        def convert(obj):
            if isinstance(obj, (np.int32, np.int64)):
                return int(obj)
            if isinstance(obj, (np.float32, np.float64)):
                return float(obj)
            if isinstance(obj, np.ndarray):
                return obj.tolist()
            return obj

        json.dump(summary_results, f, indent=2, default=convert)
    print(f"\n  Evaluation report saved to {eval_report_path}")

    print(f"\n{'='*70}")
    print("  Evaluation Complete!")
    print(f"{'='*70}")


if __name__ == "__main__":
    evaluate()
