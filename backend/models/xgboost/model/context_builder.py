"""
HEATZONE-ML Context Builder
Connects india_context_satellite_indices.csv with india_context_forecast.csv
to build the "bigger picture of India" that affects Uttar Pradesh weather.

This module creates three types of context features:
1. Upstream weather signals (lagged sentinel city weather by climate event)
2. Satellite-derived surface signals (vegetation stress, moisture changes)
3. Forecast-time signals (what sentinel cities forecast for coming days)
"""
import numpy as np
import pandas as pd
import importlib.util
import os as _os

# Always load config.py from THIS directory (xgboost/model/config.py)
# to prevent picking up the wrong config when called from predict.py
_config_path = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "config.py")
_spec = importlib.util.spec_from_file_location("xgb_model_config", _config_path)
config = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(config)


def load_context_satellite():
    """
    Load india_context_satellite_indices.csv for the 19 sentinel cities.
    Contains NDVI, NDBI, NDWI, NDMI, SAVI, EVI, BSI, UI, MNDWI, Albedo
    mapped to Climate_Event groups.
    """
    df = pd.read_csv(config.CONTEXT_SATELLITE_CSV)
    df["Date"] = pd.to_datetime(df["Date"])
    # Drop LST_Celsius (>50% missing)
    if "LST_Celsius" in df.columns:
        df = df.drop(columns=["LST_Celsius"])
    # Drop rows with missing satellite features
    sat_cols = [c for c in config.SATELLITE_FEATURE_COLS if c in df.columns]
    df = df.dropna(subset=sat_cols)
    df = df.sort_values(["City", "Date"]).reset_index(drop=True)
    return df


def load_context_forecast():
    """
    Load india_context_forecast.csv — real-time 16-day forecasts from sentinel cities.
    Contains Forecast_Generated_UTC and Forecast_Day_Ahead columns.
    """
    df = pd.read_csv(config.CONTEXT_FORECAST_CSV)
    df["Date"] = pd.to_datetime(df["Date"])
    df = df.sort_values(["City", "Date"]).reset_index(drop=True)
    return df


def build_satellite_context_signals(context_satellite_df):
    """
    Build satellite-derived context signals from sentinel cities, grouped by
    Climate Event. These capture surface conditions (vegetation stress, moisture
    availability, urban heat) that precede weather changes in UP.

    Creates features like:
    - LOO_NDVI_mean: Average vegetation index for Loo heatwave cities
    - MON_NDWI_trend: Water index trend for monsoon cities
    - BAY_BSI_mean: Bare soil index for Bay depression cities
    """
    df = context_satellite_df.copy()
    sat_trend_cols = [c for c in config.SATELLITE_TREND_COLS if c in df.columns]

    if not sat_trend_cols:
        return pd.DataFrame()

    all_signals = []

    prefix_map = {
        "EVENT_1_LOO_HEATWAVE": "LOO",
        "EVENT_2_WESTERN_DISTURBANCE": "WD",
        "EVENT_3_SW_MONSOON": "MON",
        "EVENT_4_BAY_DEPRESSION": "BAY",
    }

    for event_name, event_cfg in config.CLIMATE_EVENT_GROUPS.items():
        cities = event_cfg["cities"]
        prefix = prefix_map.get(event_name, event_name[:3])

        # Filter to this event's sentinel cities
        event_df = df[df["City"].isin(cities)].copy()
        if event_df.empty:
            continue

        # Compute daily mean of satellite indices across the group
        daily_sat = event_df.groupby("Date")[sat_trend_cols].mean()
        daily_sat.columns = [f"{prefix}_SAT_{col}" for col in sat_trend_cols]

        all_signals.append(daily_sat)

    if not all_signals:
        return pd.DataFrame()

    # Combine all event-group satellite signals
    combined = pd.concat(all_signals, axis=1)

    # Forward-fill satellite to daily frequency (satellite obs are sparse ~16 days)
    date_range = pd.date_range(combined.index.min(), combined.index.max(), freq="D")
    combined = combined.reindex(date_range)
    combined = combined.ffill().bfill()
    combined.index.name = "Date"

    # Add satellite trend features (rate of change)
    trend_signals = []
    for col in combined.columns:
        # 30-day change (satellite captures slow surface changes)
        trend_30 = combined[col].diff(30)
        trend_30.name = f"{col}_trend30"
        trend_signals.append(trend_30)

        # 60-day change
        trend_60 = combined[col].diff(60)
        trend_60.name = f"{col}_trend60"
        trend_signals.append(trend_60)

    if trend_signals:
        trends = pd.concat(trend_signals, axis=1)
        combined = pd.concat([combined, trends], axis=1)

    combined = combined.reset_index().rename(columns={"index": "Date"})
    return combined


def build_upstream_weather_signals(context_weather_df):
    """
    Build upstream sentinel city weather signals grouped by climate event.
    Enhanced version: uses more features and more lag values than the original.

    For each climate event group, compute the mean of context weather features
    across the sentinel cities, then create lagged versions.
    """
    df = context_weather_df.copy()
    df["Date"] = pd.to_datetime(df["Date"])

    ctx_cols = [c for c in config.CONTEXT_FULL_WEATHER_COLS if c in df.columns]

    all_signals = []

    prefix_map = {
        "EVENT_1_LOO_HEATWAVE": "LOO",
        "EVENT_2_WESTERN_DISTURBANCE": "WD",
        "EVENT_3_SW_MONSOON": "MON",
        "EVENT_4_BAY_DEPRESSION": "BAY",
    }

    for event_name, event_cfg in config.CLIMATE_EVENT_GROUPS.items():
        cities = event_cfg["cities"]
        lag_min, lag_max = event_cfg["lead_time_days"]
        prefix = prefix_map.get(event_name, event_name[:3])

        # Filter to this event's cities
        event_df = df[df["City"].isin(cities)]
        if event_df.empty:
            continue

        # Compute daily mean across the group's cities for ALL context features
        daily_mean = event_df.groupby("Date")[ctx_cols].mean()

        # Create lagged versions for the event's lead time range
        for lag in range(lag_min, lag_max + 1):
            lagged = daily_mean.shift(lag)
            lagged.columns = [f"{prefix}_{col}_lag{lag}" for col in ctx_cols]
            all_signals.append(lagged)

        # Also add 7-day rolling mean for key features (captures momentum)
        key_feats = event_cfg["key_features"]
        key_feats_available = [f for f in key_feats if f in daily_mean.columns]
        if key_feats_available:
            rolling_7 = daily_mean[key_feats_available].rolling(7, min_periods=3).mean()
            rolling_7.columns = [f"{prefix}_{col}_roll7" for col in key_feats_available]
            all_signals.append(rolling_7)

    if not all_signals:
        return pd.DataFrame()

    signals_df = pd.concat(all_signals, axis=1)
    signals_df = signals_df.reset_index()  # Date becomes a column
    return signals_df


def build_forecast_context_signals(context_forecast_df):
    """
    Build forecast-time context signals from india_context_forecast.csv.

    This is the CRITICAL missing piece: what do the sentinel cities' forecasts
    say about the coming days? This data is available at prediction time and
    provides the strongest signal for future UP weather.

    Creates features like:
    - LOO_FC_Temp_Max_C_day3: What Loo heatwave cities forecast for 3 days ahead
    - MON_FC_Precipitation_mm_day7: What monsoon cities forecast for 7 days ahead
    """
    df = context_forecast_df.copy()
    df["Date"] = pd.to_datetime(df["Date"])

    # The forecast file has Forecast_Day_Ahead column (-3 to +15 or similar)
    # Negative values = past days (already observed), positive = future
    if "Forecast_Day_Ahead" not in df.columns:
        print("  WARNING: Forecast_Day_Ahead column missing from context forecast")
        return pd.DataFrame()

    # Weather columns available in forecast
    fc_weather_cols = [c for c in config.CONTEXT_FULL_WEATHER_COLS if c in df.columns]
    if not fc_weather_cols:
        return pd.DataFrame()

    prefix_map = {
        "EVENT_1_LOO_HEATWAVE": "LOO",
        "EVENT_2_WESTERN_DISTURBANCE": "WD",
        "EVENT_3_SW_MONSOON": "MON",
        "EVENT_4_BAY_DEPRESSION": "BAY",
    }

    all_signals = []

    for event_name, event_cfg in config.CLIMATE_EVENT_GROUPS.items():
        cities = event_cfg["cities"]
        prefix = prefix_map.get(event_name, event_name[:3])

        event_df = df[df["City"].isin(cities)]
        if event_df.empty:
            continue

        # Group by forecast day ahead and compute mean across sentinel cities
        for day_ahead in sorted(event_df["Forecast_Day_Ahead"].unique()):
            if day_ahead < 0:
                continue  # Skip retrospective entries
            day_df = event_df[event_df["Forecast_Day_Ahead"] == day_ahead]
            if day_df.empty:
                continue

            # Use the base date (Date minus day_ahead) as the reference date
            # This way the forecast signals align with the "today" date
            day_df = day_df.copy()
            day_df["BaseDate"] = day_df["Date"] - pd.Timedelta(days=int(day_ahead))

            daily_mean = day_df.groupby("BaseDate")[fc_weather_cols].mean()
            daily_mean.columns = [f"{prefix}_FC_{col}_day{int(day_ahead)}" for col in fc_weather_cols]
            daily_mean.index.name = "Date"
            all_signals.append(daily_mean)

    if not all_signals:
        return pd.DataFrame()

    signals_df = pd.concat(all_signals, axis=1)
    signals_df = signals_df.reset_index()
    return signals_df


def build_all_context_features(context_weather_df, context_satellite_df,
                                context_forecast_df=None):
    """
    Master function: build all India-wide context features.

    Returns a DataFrame indexed by Date with all context features:
    - Upstream weather signals (lagged by climate event lead times)
    - Satellite surface condition signals (event-group means + trends)
    - Forecast signals (what sentinel cities predict for coming days)
    """
    print("  Building upstream weather signals...")
    weather_signals = build_upstream_weather_signals(context_weather_df)
    print(f"    -> {len(weather_signals.columns) - 1} weather signal features")

    print("  Building satellite context signals...")
    satellite_signals = build_satellite_context_signals(context_satellite_df)
    print(f"    -> {len(satellite_signals.columns) - 1} satellite signal features")

    # Start with weather signals
    if weather_signals.empty:
        combined = pd.DataFrame()
    else:
        combined = weather_signals.copy()

    # Merge satellite signals
    if not satellite_signals.empty:
        if combined.empty:
            combined = satellite_signals.copy()
        else:
            combined = combined.merge(satellite_signals, on="Date", how="outer")

    # Merge forecast signals if available
    if context_forecast_df is not None and not context_forecast_df.empty:
        print("  Building forecast context signals...")
        forecast_signals = build_forecast_context_signals(context_forecast_df)
        if not forecast_signals.empty:
            print(f"    -> {len(forecast_signals.columns) - 1} forecast signal features")
            if combined.empty:
                combined = forecast_signals.copy()
            else:
                combined = combined.merge(forecast_signals, on="Date", how="outer")
        else:
            print("    -> 0 forecast signal features (no valid data)")
    else:
        print("  Skipping forecast signals (not provided)")

    if not combined.empty:
        combined = combined.sort_values("Date").reset_index(drop=True)

    return combined
