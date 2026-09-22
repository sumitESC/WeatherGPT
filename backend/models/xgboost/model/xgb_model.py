"""
HEATZONE-ML XGBoost Model (Improved)
Multi-output XGBoost regressor for 16-day weather forecasting.
Trains one XGBoost model per target variable per forecast day,
with early stopping and training error tracking per day-ahead.
"""
import os
import time
import joblib
import numpy as np
from xgboost import XGBRegressor
try:
    from model import config
except ImportError:
    try:
        from . import config
    except ImportError:
        import config


class HeatZoneXGBModel:
    """
    Multi-output XGBoost model with improvements:
    - Early stopping with validation monitoring
    - Per-day-ahead error tracking (for confidence bounds at prediction time)
    - Better default hyperparameters
    """

    def __init__(self, target_cols=None, xgb_params=None):
        self.target_cols = target_cols or []
        self.xgb_params = xgb_params or config.XGB_PARAMS
        self.models = {}  # {target_col_name: XGBRegressor}
        self.feature_names = None
        self.training_errors = {}  # {target_col_name: {"mae": float, "std": float}}

    def fit(self, X_train, y_train, X_val=None, y_val=None, feature_names=None):
        """
        Train XGBoost models for each target column with early stopping.

        Args:
            X_train: np.ndarray of shape (n_samples, n_features)
            y_train: np.ndarray of shape (n_samples, n_targets)
            X_val: optional validation features
            y_val: optional validation targets
            feature_names: list of feature names
        """
        self.feature_names = feature_names
        n_targets = y_train.shape[1]

        print(f"\nTraining {n_targets} XGBoost models...")
        print(f"  Features: {X_train.shape[1]}")
        print(f"  Train samples: {X_train.shape[0]}")
        if X_val is not None:
            print(f"  Val samples: {X_val.shape[0]}")
        print(f"  Early stopping: {config.EARLY_STOPPING_ROUNDS} rounds")

        total_start = time.time()
        skipped = 0

        for i, target_name in enumerate(self.target_cols):
            start = time.time()
            y_col = y_train[:, i]

            # Skip if all NaN
            valid_mask = ~np.isnan(y_col)
            if valid_mask.sum() == 0:
                skipped += 1
                continue

            # Build model with early stopping support
            params = self.xgb_params.copy()
            early_stop = config.EARLY_STOPPING_ROUNDS

            model = XGBRegressor(
                early_stopping_rounds=early_stop,
                **params
            )

            fit_params = {"verbose": False}
            eval_set = None

            if X_val is not None and y_val is not None:
                y_val_col = y_val[:, i]
                val_valid = ~np.isnan(y_val_col)
                if val_valid.sum() > 0:
                    eval_set = [(X_val[val_valid], y_val_col[val_valid])]
                    fit_params["eval_set"] = eval_set

            # If no validation set available, create one from training data
            if eval_set is None:
                # Use last 10% of training data as internal validation
                n_train_valid = valid_mask.sum()
                split_idx = int(n_train_valid * 0.9)
                X_train_valid = X_train[valid_mask]
                y_train_valid = y_col[valid_mask]
                fit_params["eval_set"] = [
                    (X_train_valid[split_idx:], y_train_valid[split_idx:])
                ]
                model.fit(X_train_valid[:split_idx], y_train_valid[:split_idx], **fit_params)
            else:
                model.fit(X_train[valid_mask], y_col[valid_mask], **fit_params)

            self.models[target_name] = model

            # Track training error for confidence bounds
            train_preds = model.predict(X_train[valid_mask])
            residuals = y_col[valid_mask] - train_preds
            self.training_errors[target_name] = {
                "mae": float(np.mean(np.abs(residuals))),
                "std": float(np.std(residuals)),
                "best_iteration": model.best_iteration if hasattr(model, 'best_iteration') and model.best_iteration is not None else params.get("n_estimators", 500),
            }

            elapsed = time.time() - start
            total_elapsed_so_far = time.time() - total_start
            avg_time_per_model = total_elapsed_so_far / (i + 1)
            est_remaining = avg_time_per_model * (n_targets - (i + 1))

            # Print progress every 10 models to avoid spam
            if (i + 1) % 10 == 0 or (i + 1) == n_targets or elapsed > 5:
                best_iter = self.training_errors[target_name]["best_iteration"]
                print(f"  [{i+1}/{n_targets}] {target_name: <30} | "
                      f"Best iter: {best_iter} | "
                      f"Took: {elapsed:.1f}s | "
                      f"Est. Remaining: {est_remaining/60:.1f} min")

        total_elapsed = time.time() - total_start
        print(f"\nTotal training time: {total_elapsed:.1f}s ({total_elapsed/60:.1f} min)")
        print(f"Models trained: {len(self.models)}/{n_targets} (skipped {skipped})")

    def predict(self, X):
        """
        Generate predictions for all targets.

        Args:
            X: np.ndarray of shape (n_samples, n_features)

        Returns:
            np.ndarray of shape (n_samples, n_targets)
        """
        predictions = np.full((X.shape[0], len(self.target_cols)), np.nan)

        for i, target_name in enumerate(self.target_cols):
            if target_name in self.models:
                predictions[:, i] = self.models[target_name].predict(X)

        return predictions

    def predict_with_confidence(self, X):
        """
        Generate predictions with confidence intervals based on training errors.

        Returns:
            predictions: np.ndarray of shape (n_samples, n_targets)
            lower_bound: np.ndarray (predictions - 1.96*std)
            upper_bound: np.ndarray (predictions + 1.96*std)
        """
        predictions = self.predict(X)
        lower = predictions.copy()
        upper = predictions.copy()

        for i, target_name in enumerate(self.target_cols):
            if target_name in self.training_errors:
                std = self.training_errors[target_name]["std"]
                lower[:, i] = predictions[:, i] - 1.96 * std
                upper[:, i] = predictions[:, i] + 1.96 * std

        return predictions, lower, upper

    def save(self, path=None):
        """Save all models to disk."""
        if path is None:
            path = config.MODEL_DIR
        os.makedirs(path, exist_ok=True)

        save_data = {
            "target_cols": self.target_cols,
            "xgb_params": self.xgb_params,
            "feature_names": self.feature_names,
            "models": self.models,
            "training_errors": self.training_errors,
        }
        filepath = os.path.join(path, "heatzone_xgb_model.pkl")
        joblib.dump(save_data, filepath)
        print(f"Model saved to {filepath}")
        return filepath

    @classmethod
    def load(cls, path=None):
        """Load models from disk."""
        if path is None:
            path = os.path.join(config.MODEL_DIR, "heatzone_xgb_model.pkl")
        elif os.path.isdir(path):
            path = os.path.join(path, "heatzone_xgb_model.pkl")

        save_data = joblib.load(path)
        model = cls(
            target_cols=save_data["target_cols"],
            xgb_params=save_data["xgb_params"],
        )
        model.feature_names = save_data["feature_names"]
        model.models = save_data["models"]
        model.training_errors = save_data.get("training_errors", {})
        print(f"Model loaded from {path} ({len(model.models)} sub-models)")
        return model

    def get_feature_importance(self, top_n=20):
        """Get average feature importance across all sub-models."""
        if not self.models or not self.feature_names:
            return {}

        importance_sum = np.zeros(len(self.feature_names))
        count = 0

        for model in self.models.values():
            imp = model.feature_importances_
            if len(imp) == len(self.feature_names):
                importance_sum += imp
                count += 1

        if count == 0:
            return {}

        avg_importance = importance_sum / count
        idx = np.argsort(avg_importance)[::-1][:top_n]

        return {self.feature_names[i]: float(avg_importance[i]) for i in idx}

    def get_per_day_errors(self):
        """
        Get prediction error statistics grouped by forecast day.
        Useful for understanding how accuracy degrades with horizon.
        """
        day_errors = {}
        for target_name, errors in self.training_errors.items():
            # Extract day number from target name (e.g., "Temp_Max_C_day3" → 3)
            parts = target_name.rsplit("_day", 1)
            if len(parts) == 2 and parts[1].isdigit():
                day = int(parts[1])
                base_target = parts[0]
                if day not in day_errors:
                    day_errors[day] = {}
                day_errors[day][base_target] = errors

        return day_errors
