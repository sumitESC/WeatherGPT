import os
import argparse
import time
import torch
from torch.amp import autocast, GradScaler

import models.sat_model.config as config
from models.sat_model.dataset import create_dataloaders
from models.sat_model.model import SpatiotemporalCrossAttentionModel, WeatherForecastLoss

def train():
    parser = argparse.ArgumentParser(description="Train Spatiotemporal Cross-Attention Model")
    parser.add_argument("--test-mode", action="store_true", help="Run on tiny subset")
    args = parser.parse_args()

    print("=" * 60)
    print("  HeatZone-Vision sat_model Training")
    print("=" * 60)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n  Device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'}")

    print("\n--- Loading Data ---")
    batch_size = 16 if args.test_mode else config.BATCH_SIZE
    train_loader, val_loader, test_loader, feature_dims = create_dataloaders(
        test_mode=args.test_mode, batch_size=batch_size
    )

    print("\n  Feature dimensions:")
    print(f"    Local weather features: {feature_dims['n_weather_features']}")
    print(f"    Context features:       {feature_dims['n_context_features']}")
    print(f"    Target variables:       {feature_dims['n_targets']}")
    print(f"    Batches/epoch:          {len(train_loader)}")

    model = SpatiotemporalCrossAttentionModel(
        n_weather_features=feature_dims["n_weather_features"],
        n_context_features=feature_dims["n_context_features"],
        n_targets=feature_dims["n_targets"],
        embed_dim=config.EMBED_DIM,
        transformer_heads=config.TRANSFORMER_HEADS,
        encoder_layers=config.ENCODER_LAYERS,
        cross_attn_layers=config.CROSS_ATTN_LAYERS,
        transformer_ff_dim=config.TRANSFORMER_FF_DIM,
        dropout=config.DROPOUT,
        seq_length=config.SEQ_LENGTH,
        forecast_horizon=config.FORECAST_HORIZON
    ).to(device)

    print(f"\n  Model parameters: {model.count_parameters():,}")
    
    optimizer = torch.optim.AdamW(
        model.parameters(), 
        lr=config.LEARNING_RATE,
        weight_decay=config.WEIGHT_DECAY
    )
    
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='min', factor=0.5, patience=3, min_lr=1e-6
    )
    
    criterion = WeatherForecastLoss(
        loss_weights=config.LOSS_WEIGHTS,
        target_names=config.TARGET_COLS
    )

    epochs = 5 if args.test_mode else config.EPOCHS
    best_val_loss = float('inf')
    patience_counter = 0
    scaler = GradScaler('cuda' if device.type == 'cuda' else 'cpu')

    print(f"\n--- Training for {epochs} epochs ---")
    
    for epoch in range(1, epochs + 1):
        start_time = time.time()
        
        # Train
        model.train()
        train_loss = 0.0
        for w_seq, c_seq, targets, mask in train_loader:
            w_seq = w_seq.to(device)
            c_seq = c_seq.to(device)
            targets = targets.to(device)
            mask = mask.to(device)
            
            optimizer.zero_grad(set_to_none=True)
            
            if device.type == 'cuda':
                with autocast('cuda'):
                    preds, _ = model(w_seq, c_seq)
                    loss = criterion(preds, targets, mask)
                scaler.scale(loss).backward()
                scaler.unscale_(optimizer)
                torch.nn.utils.clip_grad_norm_(model.parameters(), config.GRAD_CLIP)
                scaler.step(optimizer)
                scaler.update()
            else:
                preds, _ = model(w_seq, c_seq)
                loss = criterion(preds, targets, mask)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), config.GRAD_CLIP)
                optimizer.step()
                
            train_loss += loss.item()
            
        train_loss /= len(train_loader)
        
        # Validate
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for w_seq, c_seq, targets, mask in val_loader:
                w_seq = w_seq.to(device)
                c_seq = c_seq.to(device)
                targets = targets.to(device)
                mask = mask.to(device)
                
                if device.type == 'cuda':
                    with autocast('cuda'):
                        preds, _ = model(w_seq, c_seq)
                        loss = criterion(preds, targets, mask)
                else:
                    preds, _ = model(w_seq, c_seq)
                    loss = criterion(preds, targets, mask)
                    
                val_loss += loss.item()
        
        val_loss /= max(len(val_loader), 1)
        scheduler.step(val_loss)
        
        elapsed = time.time() - start_time
        current_lr = optimizer.param_groups[0]['lr']
        
        saved_str = ""
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
            
            os.makedirs(config.MODEL_SAVE_DIR, exist_ok=True)
            
            # Save configuration needed for inference
            model_config = {
                "embed_dim": config.EMBED_DIM,
                "transformer_heads": config.TRANSFORMER_HEADS,
                "encoder_layers": config.ENCODER_LAYERS,
                "cross_attn_layers": config.CROSS_ATTN_LAYERS,
                "transformer_ff_dim": config.TRANSFORMER_FF_DIM,
                "dropout": config.DROPOUT,
                "seq_length": config.SEQ_LENGTH,
                "forecast_horizon": config.FORECAST_HORIZON,
                "target_cols": config.TARGET_COLS,
            }
            
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_loss": best_val_loss,
                "feature_dims": feature_dims,
                "config": model_config,
            }, config.MODEL_PATH)
            
            saved_str = "[SAVED - Best]"
        else:
            patience_counter += 1
            
        print(f"  Epoch {epoch:3d}/{epochs} | Train: {train_loss:.4f} | Val: {val_loss:.4f} | LR: {current_lr:.6f} | Time: {elapsed:.1f}s {saved_str}")
        
        if patience_counter >= config.PATIENCE and not args.test_mode:
            print(f"\n  Early stopping triggered at epoch {epoch}")
            break
            
    print("\n" + "=" * 60)
    print("  Training Complete!")
    print(f"  Best validation loss: {best_val_loss:.4f}")
    print(f"  Model saved to: {config.MODEL_PATH}")
    print("=" * 60)

if __name__ == "__main__":
    train()
