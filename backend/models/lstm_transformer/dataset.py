"""
LSTM-Transformer Dataset
Creates sliding-window time series samples for PyTorch training.
Each sample: [30 days of history + context] -> [16 days of future weather]
"""
import os
import sys
import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset, DataLoader

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from lstm_transformer import config



class WeatherSequenceDataset(Dataset):
    """
    PyTorch Dataset for weather time series forecasting.

    Each sample contains:
    - weather_seq: (seq_length, n_weather_features) — 30 days of local weather
    - context_seq: (seq_length, n_context_features) — 30 days of India-wide context
    - targets: (forecast_horizon, n_targets) — 16 days of future weather
    - target_mask: (forecast_horizon, n_targets) — 1 where target is valid, 0 for NaN
    """

    def __init__(self, weather_df, context_df=None, city_list=None,
                 seq_length=None, forecast_horizon=None, feature_stats=None):
        """
        Args:
            weather_df: DataFrame with Date, City, and weather columns
            context_df: DataFrame with Date and context features (optional)
            city_list: List of cities to include (None = all)
            seq_length: Number of past days (default from config)
            forecast_horizon: Number of future days (default from config)
            feature_stats: Dictionary of means/stds for scaling (None = compute from data)
        """
        self.seq_length = seq_length or config.SEQ_LENGTH
        self.forecast_horizon = forecast_horizon or config.FORECAST_HORIZON
        self.target_names = config.TARGET_COLS
        self.feature_stats = feature_stats

        # Identify feature columns
        self.weather_feature_cols = [c for c in config.WEATHER_FEATURE_COLS
                                      if c in weather_df.columns]

        # Wind encoding
        if config.WIND_DIR_COL in weather_df.columns:
            weather_df = weather_df.copy()
            wind_rad = np.deg2rad(weather_df[config.WIND_DIR_COL].fillna(0))
            weather_df["Wind_Dir_Sin"] = np.sin(wind_rad)
            weather_df["Wind_Dir_Cos"] = np.cos(wind_rad)
            self.weather_feature_cols += ["Wind_Dir_Sin", "Wind_Dir_Cos"]

        # Filter cities
        if city_list is not None:
            weather_df = weather_df[weather_df["City"].isin(city_list)].copy()

        weather_df = weather_df.sort_values(["City", "Date"]).reset_index(drop=True)

        # Build per-city sequence indices
        self.sample_indices = []
        self.city_weather_data = []
        self.city_context_data = []
        self.city_target_data = []
        self._build_samples(weather_df, context_df)

        print(f"  Dataset: {len(self.sample_indices)} samples, "
              f"seq_len={self.seq_length}, horizon={self.forecast_horizon}, "
              f"weather_feats={len(self.weather_feature_cols)}")

    def _build_samples(self, weather_df, context_df):
        """Build index pairs (city_idx, start_idx) over scaled data arrays."""

        context_features = None
        context_cols = []
        if context_df is not None and not context_df.empty:
            context_df = context_df.sort_values("Date").reset_index(drop=True)
            numeric_cols = context_df.select_dtypes(include=[np.number]).columns.tolist()
            context_cols = [c for c in numeric_cols if c != "Date"]
            context_df = context_df.set_index("Date")
            context_features = context_df

        self.n_weather_features = len(self.weather_feature_cols)
        self.n_context_features = len(context_cols)
        self.n_targets = len(self.target_names)

        all_weather_vals = []
        all_ctx_vals = []
        city_blocks = []

        for city, city_df in weather_df.groupby("City"):
            city_df = city_df.sort_values("Date").reset_index(drop=True)
            dates = city_df["Date"].values

            weather_vals = city_df[self.weather_feature_cols].values.astype(np.float32)
            for col_idx in range(weather_vals.shape[1]):
                col_data = weather_vals[:, col_idx]
                nan_mask = np.isnan(col_data)
                if nan_mask.any():
                    median_val = np.nanmedian(col_data)
                    if np.isnan(median_val):
                        median_val = 0.0
                    weather_vals[nan_mask, col_idx] = median_val

            target_cols_avail = [c for c in self.target_names if c in city_df.columns]
            target_vals = city_df[target_cols_avail].values.astype(np.float32)

            if "Precipitation_mm" in target_cols_avail:
                precip_idx = target_cols_avail.index("Precipitation_mm")
                target_vals[:, precip_idx] = np.log1p(np.maximum(target_vals[:, precip_idx], 0))
            if "Precipitation_mm" in self.weather_feature_cols:
                feat_precip_idx = self.weather_feature_cols.index("Precipitation_mm")
                weather_vals[:, feat_precip_idx] = np.log1p(np.maximum(weather_vals[:, feat_precip_idx], 0))

            n_days = len(city_df)
            ctx_array = None
            if context_features is not None and len(context_cols) > 0:
                ctx_array = np.zeros((n_days, len(context_cols)), dtype=np.float32)
                for i, d in enumerate(dates):
                    d_ts = pd.Timestamp(d)
                    if d_ts in context_features.index:
                        ctx_array[i] = np.nan_to_num(context_features.loc[d_ts, context_cols].values.astype(np.float32), nan=0.0)
            else:
                ctx_array = np.zeros((n_days, 1), dtype=np.float32)

            all_weather_vals.append(weather_vals)
            all_ctx_vals.append(ctx_array)
            city_blocks.append((weather_vals, ctx_array, target_vals, n_days))

        if self.feature_stats is None:
            stacked_weather = np.vstack(all_weather_vals)
            stacked_ctx = np.vstack(all_ctx_vals)
            self.feature_stats = {
                "weather_mean": np.nanmean(stacked_weather, axis=0),
                "weather_std": np.nanstd(stacked_weather, axis=0) + 1e-6,
                "context_mean": np.nanmean(stacked_ctx, axis=0),
                "context_std": np.nanstd(stacked_ctx, axis=0) + 1e-6,
            }

        total_window = self.seq_length + self.forecast_horizon
        for city_idx, (weather_vals, ctx_array, target_vals, n_days) in enumerate(city_blocks):
            scaled_weather = ((weather_vals - self.feature_stats["weather_mean"]) / self.feature_stats["weather_std"]).astype(np.float32)
            scaled_ctx = ((ctx_array - self.feature_stats["context_mean"]) / self.feature_stats["context_std"]).astype(np.float32)

            self.city_weather_data.append(scaled_weather)
            self.city_context_data.append(scaled_ctx)
            self.city_target_data.append(target_vals.astype(np.float32))

            for start_idx in range(0, n_days - total_window + 1, 1):
                self.sample_indices.append((city_idx, start_idx))

        self.sample_indices = np.array(self.sample_indices, dtype=np.int32)

    def __len__(self):
        return len(self.sample_indices)

    def __getitem__(self, idx):
        city_idx, start_idx = self.sample_indices[idx]
        end_input = start_idx + self.seq_length
        end_target = end_input + self.forecast_horizon

        weather_seq = self.city_weather_data[city_idx][start_idx:end_input]
        context_seq = self.city_context_data[city_idx][start_idx:end_input]
        target_seq = self.city_target_data[city_idx][end_input:end_target]

        target_mask = (~np.isnan(target_seq)).astype(np.float32)
        target_seq = np.nan_to_num(target_seq, nan=0.0)

        return {
            "weather_seq": torch.from_numpy(weather_seq),
            "context_seq": torch.from_numpy(context_seq),
            "targets": torch.from_numpy(target_seq),
            "target_mask": torch.from_numpy(target_mask),
        }

    def get_feature_dims(self):
        """Return input dimensions for model construction."""
        return {
            "n_weather_features": self.n_weather_features,
            "n_context_features": self.n_context_features,
            "n_targets": self.n_targets,
            "weather_mean": self.feature_stats["weather_mean"],
            "weather_std": self.feature_stats["weather_std"],
            "context_mean": self.feature_stats["context_mean"],
            "context_std": self.feature_stats["context_std"],
        }


def load_and_prepare_data(test_mode=False):
    """
    Load all datasets and prepare them for the LSTM-Transformer model via SQLite/Pandas.
    """
    print("Loading datasets for LSTM-Transformer...")

    from data.weather_db import query_recent_city_weather, query_context_weather
    
    # Load historical data
    weather_df = pd.read_csv(config.HISTORICAL_CSV)
    weather_df["Date"] = pd.to_datetime(weather_df["Date"])
    print(f"  Historical data (merged): {len(weather_df)} rows")

    # Compute staleness feature
    if "Scene_ID" in weather_df.columns:
        weather_df = weather_df.sort_values(["City", "Date"])
        is_new_image = weather_df["Scene_ID"] != weather_df.groupby("City")["Scene_ID"].shift(1)
        is_new_image = is_new_image & weather_df["Scene_ID"].notna()
        
        weather_df["last_update_date"] = weather_df["Date"].where(is_new_image).groupby(weather_df["City"]).ffill()
        weather_df["days_since_satellite_update"] = (weather_df["Date"] - weather_df["last_update_date"]).dt.days.fillna(0)
        weather_df = weather_df.drop(columns=["last_update_date"])
    else:
        weather_df["days_since_satellite_update"] = 0.0

    context_df = pd.DataFrame()
    context_csv_path = os.path.join(os.path.dirname(config.HISTORICAL_CSV), "ml_ready_context_data.csv")
    try:
        if os.path.exists(context_csv_path):
            raw_ctx = pd.read_csv(context_csv_path)
            raw_ctx["Date"] = pd.to_datetime(raw_ctx["Date"])
            agg_cols = raw_ctx.select_dtypes(include=[np.number]).columns.tolist()
            agg_cols = [c for c in agg_cols if c not in ["Year", "Month", "Day"]]
            context_df = raw_ctx.groupby("Date")[agg_cols].mean().reset_index()
    except Exception as e:
        print(f"  Context building skipped: {e}")

    all_cities = sorted(weather_df["City"].unique())
    if test_mode:
        city_list = all_cities[:3]
        print(f"  TEST MODE: Using {len(city_list)} cities: {city_list}")
    else:
        city_list = all_cities

    return weather_df, context_df, city_list


def create_dataloaders(test_mode=False, batch_size=None):
    batch_size = batch_size or config.BATCH_SIZE

    weather_df, context_df, city_list = load_and_prepare_data(test_mode=test_mode)

    weather_df["Year"] = weather_df["Date"].dt.year

    train_df = weather_df[weather_df["Year"] <= config.TRAIN_END_YEAR]
    val_df = weather_df[(weather_df["Year"] > config.TRAIN_END_YEAR) &
                         (weather_df["Year"] <= config.VAL_END_YEAR)]
    test_df = weather_df[weather_df["Year"] > config.VAL_END_YEAR]

    print(f"\n  Train: {len(train_df)} rows ({train_df['Year'].min()}-{train_df['Year'].max()})")
    print(f"  Val:   {len(val_df)} rows ({val_df['Year'].min()}-{val_df['Year'].max()})")
    print(f"  Test:  {len(test_df)} rows ({test_df['Year'].min()}-{test_df['Year'].max()})")

    print("\nBuilding training sequences...")
    train_dataset = WeatherSequenceDataset(
        train_df, context_df, city_list,
        seq_length=config.SEQ_LENGTH,
        forecast_horizon=config.FORECAST_HORIZON,
    )

    print("Building validation sequences...")
    val_dataset = WeatherSequenceDataset(
        val_df, context_df, city_list,
        seq_length=config.SEQ_LENGTH,
        forecast_horizon=config.FORECAST_HORIZON,
        feature_stats=train_dataset.feature_stats,
    )

    print("Building test sequences...")
    test_dataset = WeatherSequenceDataset(
        test_df, context_df, city_list,
        seq_length=config.SEQ_LENGTH,
        forecast_horizon=config.FORECAST_HORIZON,
        feature_stats=train_dataset.feature_stats,
    )

    # Use num_workers=0 to prevent process-forking RAM spikes on restricted RAM platforms
    train_loader = DataLoader(
        train_dataset, batch_size=batch_size, shuffle=True,
        num_workers=0, pin_memory=False, drop_last=True
    )
    val_loader = DataLoader(
        val_dataset, batch_size=batch_size, shuffle=False,
        num_workers=0, pin_memory=False
    )
    test_loader = DataLoader(
        test_dataset, batch_size=batch_size, shuffle=False,
        num_workers=0, pin_memory=False
    )

    feature_dims = train_dataset.get_feature_dims()
    return train_loader, val_loader, test_loader, feature_dims

