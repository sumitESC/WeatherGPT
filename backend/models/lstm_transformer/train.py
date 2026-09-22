"""
LSTM-Transformer Training Script (v2)
Trains the weather forecast model with mixed precision (AMP) for GPU efficiency.

v2 Changes:
  - Handles 3-output forward pass (predictions, precip_logits, rain_amounts)
  - Learning rate warmup for autoregressive decoder stability
  - Saves validation metrics per-day for confidence calibration
"""
import os
import sys
import time
import json
import argparse
import numpy as np
import torch
import torch.nn as nn
from torch.amp import autocast, GradScaler

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lstm_transformer import config
from lstm_transformer.dataset import create_dataloaders
from lstm_transformer.model import WeatherLSTMTransformer, WeatherForecastLoss


def get_lr_with_warmup(epoch, warmup_epochs, base_lr, total_epochs):
    """Linear warmup then cosine decay."""
    if epoch < warmup_epochs:
        return base_lr * (epoch + 1) / warmup_epochs
    else:
        progress = (epoch - warmup_epochs) / max(total_epochs - warmup_epochs, 1)
        return base_lr * (0.5 * (1.0 + np.cos(np.pi * progress)))


def compute_validation_metrics_per_day(model, val_loader, device, use_amp,
                                        target_names, forecast_horizon):
    """
    Compute per-day validation MAE for confidence calibration.
    Returns dict mapping target_name -> list of MAE per forecast day.
    """
    model.eval()
    all_preds = []
    all_targets = []
    all_masks = []

    with torch.no_grad():
        for batch in val_loader:
            weather_seq = batch["weather_seq"].to(device)
            context_seq = batch["context_seq"].to(device)
            targets = batch["targets"]
            target_mask = batch["target_mask"]

            if use_amp:
                with autocast("cuda"):
                    preds, _, _ = model(weather_seq, context_seq)
            else:
                preds, _, _ = model(weather_seq, context_seq)

            all_preds.append(preds.cpu().numpy())
            all_targets.append(targets.numpy())
            all_masks.append(target_mask.numpy())

    all_preds = np.concatenate(all_preds, axis=0)
    all_targets = np.concatenate(all_targets, axis=0)
    all_masks = np.concatenate(all_masks, axis=0)

    metrics = {}
    for t_idx, name in enumerate(target_names):
        day_maes = []
        for day in range(forecast_horizon):
            mask = all_masks[:, day, t_idx] > 0.5
            if mask.sum() < 10:
                day_maes.append(999.0)
                continue
            yt = all_targets[mask, day, t_idx]
            yp = all_preds[mask, day, t_idx]
            mae = np.mean(np.abs(yt - yp))
            day_maes.append(float(mae))
        metrics[name] = day_maes

    return metrics


def train():
    parser = argparse.ArgumentParser(description="Train LSTM-Transformer Weather Model (v2)")
    parser.add_argument("--test-mode", action="store_true",
                       help="Run with 3 cities, fewer epochs")
    parser.add_argument("--epochs", type=int, default=None,
                       help="Override number of epochs")
    parser.add_argument("--batch-size", type=int, default=None)
    parser.add_argument("--cpu", action="store_true", help="Force CPU training")
    args = parser.parse_args()

    print("=" * 60)
    print("  LSTM-Transformer Weather Forecast Training (v2)")
    print("  - Autoregressive GRU Decoder")
    print("  - Two-Stage Precipitation")
    print("  - Dynamic Confidence Calibration")
    print("=" * 60)

    import gc
    torch.set_num_threads(1)

    # Device
    if args.cpu or not torch.cuda.is_available():
        device = torch.device("cpu")
        print(f"\n  Device: CPU")
    else:
        device = torch.device("cuda")
        gpu_name = torch.cuda.get_device_name(0)
        gpu_mem = torch.cuda.get_device_properties(0).total_memory / 1e9
        print(f"\n  Device: {gpu_name} ({gpu_mem:.1f} GB)")

    use_amp = device.type == "cuda"  # Mixed precision only on GPU


    # Epochs
    epochs = args.epochs or (5 if args.test_mode else config.EPOCHS)
    batch_size = args.batch_size or (32 if args.test_mode else config.BATCH_SIZE)
    warmup_epochs = min(config.WARMUP_EPOCHS, epochs // 3)

    # 1. Create DataLoaders
    print("\n--- Loading Data ---")
    train_loader, val_loader, test_loader, feature_dims = create_dataloaders(
        test_mode=args.test_mode, batch_size=batch_size
    )

    print(f"\n  Feature dimensions:")
    print(f"    Weather features: {feature_dims['n_weather_features']}")
    print(f"    Context features: {feature_dims['n_context_features']}")
    print(f"    Target variables: {feature_dims['n_targets']}")
    print(f"    Batches/epoch:    {len(train_loader)}")
    print(f"    Warmup epochs:    {warmup_epochs}")

    # 2. Create Model
    model = WeatherLSTMTransformer(
        n_weather_features=feature_dims["n_weather_features"],
        n_context_features=feature_dims["n_context_features"],
        n_targets=feature_dims["n_targets"],
    ).to(device)

    n_params = model.count_parameters()
    print(f"\n  Model parameters: {n_params:,}")
    est_mem_mb = n_params * 4 / 1e6  # Float32
    print(f"  Estimated model memory: {est_mem_mb:.1f} MB")

    # 3. Loss, Optimizer, Scheduler
    criterion = WeatherForecastLoss(
        target_names=config.TARGET_COLS,
        rain_pos_weight=config.RAIN_POS_WEIGHT,
    ).to(device)

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=config.LEARNING_RATE,
        weight_decay=config.WEIGHT_DECAY,
    )

    # Warmup + cosine annealing via manual LR adjustment
    scaler = GradScaler("cuda") if use_amp else None

    # 4. Training Loop
    print(f"\n--- Training for {epochs} epochs (warmup: {warmup_epochs}) ---")
    best_val_loss = float("inf")
    patience_counter = 0
    train_losses = []
    val_losses = []

    os.makedirs(config.MODEL_SAVE_DIR, exist_ok=True)
    best_model_path = os.path.join(config.MODEL_SAVE_DIR, "best_model.pt")

    for epoch in range(1, epochs + 1):
        epoch_start = time.time()

        # Update learning rate with warmup
        lr = get_lr_with_warmup(epoch - 1, warmup_epochs,
                                config.LEARNING_RATE, epochs)
        for pg in optimizer.param_groups:
            pg["lr"] = lr

        # --- Train ---
        model.train()
        train_loss_sum = 0.0
        train_batches = 0

        for batch in train_loader:
            weather_seq = batch["weather_seq"].to(device)
            context_seq = batch["context_seq"].to(device)
            targets = batch["targets"].to(device)
            target_mask = batch["target_mask"].to(device)

            optimizer.zero_grad()

            if use_amp:
                with autocast("cuda"):
                    predictions, precip_logits, rain_amounts = model(
                        weather_seq, context_seq
                    )
                    loss = criterion(predictions, targets, target_mask,
                                     precip_logits, rain_amounts)
                scaler.scale(loss).backward()
                scaler.unscale_(optimizer)
                nn.utils.clip_grad_norm_(model.parameters(), config.GRAD_CLIP)
                scaler.step(optimizer)
                scaler.update()
            else:
                predictions, precip_logits, rain_amounts = model(
                    weather_seq, context_seq
                )
                loss = criterion(predictions, targets, target_mask,
                                 precip_logits, rain_amounts)
                loss.backward()
                nn.utils.clip_grad_norm_(model.parameters(), config.GRAD_CLIP)
                optimizer.step()

            train_loss_sum += loss.item()
            train_batches += 1

        avg_train_loss = train_loss_sum / max(train_batches, 1)
        train_losses.append(avg_train_loss)

        # --- Validate ---
        model.eval()
        val_loss_sum = 0.0
        val_batches = 0

        with torch.no_grad():
            for batch in val_loader:
                weather_seq = batch["weather_seq"].to(device)
                context_seq = batch["context_seq"].to(device)
                targets = batch["targets"].to(device)
                target_mask = batch["target_mask"].to(device)

                if use_amp:
                    with autocast("cuda"):
                        predictions, precip_logits, rain_amounts = model(
                            weather_seq, context_seq
                        )
                        loss = criterion(predictions, targets, target_mask,
                                         precip_logits, rain_amounts)
                else:
                    predictions, precip_logits, rain_amounts = model(
                        weather_seq, context_seq
                    )
                    loss = criterion(predictions, targets, target_mask,
                                     precip_logits, rain_amounts)

                val_loss_sum += loss.item()
                val_batches += 1

        avg_val_loss = val_loss_sum / max(val_batches, 1)
        val_losses.append(avg_val_loss)

        epoch_time = time.time() - epoch_start

        # Early stopping check
        improved = ""
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            patience_counter = 0
            # Save best model
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_loss": best_val_loss,
                "feature_dims": feature_dims,
                "config": {
                    "embed_dim": config.EMBED_DIM,
                    "lstm_hidden": config.LSTM_HIDDEN,
                    "lstm_layers": config.LSTM_LAYERS,
                    "transformer_heads": config.TRANSFORMER_HEADS,
                    "transformer_layers": config.TRANSFORMER_LAYERS,
                    "transformer_ff_dim": config.TRANSFORMER_FF_DIM,
                    "dropout": config.DROPOUT,
                    "seq_length": config.SEQ_LENGTH,
                    "forecast_horizon": config.FORECAST_HORIZON,
                    "target_cols": config.TARGET_COLS,
                    "model_version": "v2_autoregressive",
                },
            }, best_model_path)
            improved = " [SAVED - Best]"
        else:
            patience_counter += 1

        print(f"  Epoch {epoch:3d}/{epochs} | "
              f"Train: {avg_train_loss:.4f} | "
              f"Val: {avg_val_loss:.4f} | "
              f"LR: {lr:.6f} | "
              f"Time: {epoch_time:.1f}s{improved}")

        if patience_counter >= config.PATIENCE:
            print(f"\n  Early stopping at epoch {epoch} (no improvement for {config.PATIENCE} epochs)")
            break

    # 5. Compute per-day validation metrics for confidence calibration
    print("\nComputing per-day validation metrics for confidence calibration...")
    model.load_state_dict(torch.load(best_model_path, map_location=device,
                                      weights_only=False)["model_state_dict"])
    val_metrics = compute_validation_metrics_per_day(
        model, val_loader, device, use_amp,
        config.TARGET_COLS, config.FORECAST_HORIZON
    )

    # Save validation metrics
    val_metrics_path = os.path.join(config.MODEL_SAVE_DIR, "validation_metrics.json")
    with open(val_metrics_path, "w") as f:
        json.dump(val_metrics, f, indent=2)
    print(f"  Validation metrics saved to {val_metrics_path}")

    # Print per-day MAE summary
    print(f"\n  Per-Day Validation MAE:")
    for name in config.TARGET_COLS:
        maes = val_metrics[name]
        print(f"    {name:30s}  Day1={maes[0]:.3f}  Day8={maes[7]:.3f}  Day16={maes[15]:.3f}")

    # 6. Summary
    print(f"\n{'='*60}")
    print(f"  Training Complete!")
    print(f"  Best validation loss: {best_val_loss:.4f}")
    print(f"  Model saved to: {best_model_path}")
    print(f"{'='*60}")

    # Quick test inference
    print("\nQuick test inference...")
    model.eval()
    with torch.no_grad():
        sample = next(iter(test_loader))
        weather_seq = sample["weather_seq"][:1].to(device)
        context_seq = sample["context_seq"][:1].to(device)

        if use_amp:
            with autocast("cuda"):
                preds, precip_log, rain_amt = model(weather_seq, context_seq)
        else:
            preds, precip_log, rain_amt = model(weather_seq, context_seq)

        preds = preds.cpu().numpy()[0]  # (horizon, n_targets)
        rain_probs = torch.sigmoid(precip_log).cpu().numpy()[0]  # (horizon, 1)
        rain_amts = rain_amt.cpu().numpy()[0]  # (horizon, 1)

        print(f"  Output shape: {preds.shape} (horizon={preds.shape[0]}, targets={preds.shape[1]})")
        print(f"  Day 1 predictions: {preds[0]}")
        print(f"  Day 1 rain prob:   {rain_probs[0, 0]:.3f}")
        print(f"  Day 1 rain amount: {rain_amts[0, 0]:.3f}")
        print(f"  Day 16 rain prob:  {rain_probs[15, 0]:.3f}")

    return model, best_model_path


if __name__ == "__main__":
    train()
