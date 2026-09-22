"""
HEATZONE-ML Data Pipeline (Improved)
Loads raw CSVs, merges weather + satellite data, applies wind direction encoding,
adds rolling statistics, rate-of-change features, and builds the full India-wide
context using the context_builder module.
"""
import json
import pandas as pd
import numpy as np
try:
    from model import config
except ImportError:
    try:
        from . import config
    except ImportError:
        import config

try:
    from model.context_builder import load_context_satellite, build_all_context_features
except ImportError:
    try:
        from .context_builder import load_context_satellite, build_all_context_features
    except ImportError:
        from context_builder import load_context_satellite, build_all_context_features


def load_up_cities():
    """Load the 75 UP district cities with coordinates."""
    with open(config.ALL_UP_CITIES_JSON, "r") as f:
        data = json.load(f)
    cities = pd.DataFrame(data["cities"])
    return cities


def load_context_cities():
    """Load the 19 sentinel cities with climate event mapping."""
    with open(config.CONTEXT_CITIES_JSON, "r") as f:
        data = json.load(f)
    cities = pd.DataFrame(data["cities"])
    return cities


def load_weather(path, parse_dates=True):
    """Load a weather CSV, parse dates, sort by City+Date."""
    df = pd.read_csv(path)
    if parse_dates:
        df["Date"] = pd.to_datetime(df["Date"])
    df = df.sort_values(["City", "Date"]).reset_index(drop=True)
    return df


def load_satellite(path, parse_dates=True):
    """Load a satellite CSV, parse dates, sort by City+Date."""
    df = pd.read_csv(path)
    if parse_dates:
        df["Date"] = pd.to_datetime(df["Date"])
    # Drop LST_Celsius if present (>50% missing)
    if "LST_Celsius" in df.columns:
        df = df.drop(columns=["LST_Celsius"])
    # Drop rows with any remaining NaN in satellite features
    sat_cols = [c for c in config.SATELLITE_FEATURE_COLS if c in df.columns]
    df = df.dropna(subset=sat_cols)
    df = df.sort_values(["City", "Date"]).reset_index(drop=True)
    return df


def encode_wind_direction(df):
    """
    Fix wind direction encoding.

    Problem: Wind_Direction_Dominant_deg is circular (0-360°).
    350° and 10° are only 20° apart but the model sees a 340 difference.

    Solution:
    1. Decompose into sin/cos components (preserves circular nature)
    2. Create wind vector components (U/V) by combining with speed
    3. Drop the raw degree column
    """
    df = df.copy()
    wind_dir_col = config.WIND_DIR_COL

    if wind_dir_col not in df.columns:
        return df

    # Convert to radians
    wind_rad = np.deg2rad(df[wind_dir_col])

    # Sin/Cos decomposition — preserves circular geometry
    df["Wind_Dir_Sin"] = np.sin(wind_rad)
    df["Wind_Dir_Cos"] = np.cos(wind_rad)

    # Wind vector components (U = east-west, V = north-south)
    # Meteorological convention: wind direction is where wind comes FROM
    for speed_col in config.WIND_SPEED_COLS:
        if speed_col in df.columns:
            col_base = speed_col.replace("_kmh", "")
            # U component (positive = westerly/from west)
            df[f"{col_base}_U"] = -df[speed_col] * np.sin(wind_rad)
            # V component (positive = southerly/from south)
            df[f"{col_base}_V"] = -df[speed_col] * np.cos(wind_rad)

    # Drop the raw degree column — the sin/cos and U/V replacements are superior
    df = df.drop(columns=[wind_dir_col])

    return df


def forward_fill_satellite(weather_df, satellite_df):
    """
    For each city, forward-fill satellite indices to daily frequency by merging
    with the daily weather dataframe and using ffill.

    Returns the weather_df with satellite columns appended (forward-filled).
    """
    sat_cols = [c for c in config.SATELLITE_FEATURE_COLS if c in satellite_df.columns]
    # Keep only the needed columns from satellite
    sat_subset = satellite_df[["City", "Date"] + sat_cols].copy()

    # Merge on City+Date (left join to keep all weather days)
    merged = weather_df.merge(sat_subset, on=["City", "Date"], how="left")

    # Forward-fill satellite columns within each city
    merged = merged.sort_values(["City", "Date"])
    for col in sat_cols:
        merged[col] = merged.groupby("City")[col].ffill()

    # Backward-fill the initial NaN values (before the first satellite obs)
    for col in sat_cols:
        merged[col] = merged.groupby("City")[col].bfill()

    return merged


def add_temporal_features(df):
    """Add cyclical temporal features (sin/cos of day-of-year, month)."""
    df = df.copy()
    day_of_year = df["Date"].dt.dayofyear
    df["day_sin"] = np.sin(2 * np.pi * day_of_year / 365.25)
    df["day_cos"] = np.cos(2 * np.pi * day_of_year / 365.25)
    month = df["Date"].dt.month
    df["month_sin"] = np.sin(2 * np.pi * month / 12)
    df["month_cos"] = np.cos(2 * np.pi * month / 12)
    df["year_trend"] = (df["Date"].dt.year - 2000) / 26.0  # Normalized year
    df["is_monsoon"] = ((df["Date"].dt.month >= 6) & (df["Date"].dt.month <= 9)).astype(int)
    # Week of year (captures sub-monthly seasonality)
    week = df["Date"].dt.isocalendar().week.astype(int)
    df["week_sin"] = np.sin(2 * np.pi * week / 52)
    df["week_cos"] = np.cos(2 * np.pi * week / 52)
    return df


def add_lag_features(df, n_lags=None):
    """
    Add lagged weather features for each city.
    Creates lag1..lag_n for each weather feature.
    """
    if n_lags is None:
        n_lags = config.LOOKBACK_DAYS

    df = df.sort_values(["City", "Date"]).copy()

    # Use weather features + wind-encoded features (exclude the dropped raw direction)
    weather_cols = [c for c in config.WEATHER_FEATURE_COLS if c in df.columns]
    # Also include wind-encoded columns
    wind_encoded = [c for c in df.columns if c.startswith("Wind_Dir_") or c.endswith("_U") or c.endswith("_V")]
    lag_cols = list(set(weather_cols + wind_encoded))

    lag_dfs = []
    for lag in range(1, n_lags + 1):
        lagged = df.groupby("City")[lag_cols].shift(lag)
        lagged.columns = [f"{col}_lag{lag}" for col in lag_cols]
        lag_dfs.append(lagged)

    df = pd.concat([df] + lag_dfs, axis=1)
    return df


def add_rolling_features(df):
    """
    Add rolling mean and std for key weather features.
    Captures weather momentum and variability.
    """
    df = df.sort_values(["City", "Date"]).copy()
    rolling_cols = [c for c in config.ROLLING_FEATURE_COLS if c in df.columns]

    for window in config.ROLLING_WINDOWS:
        for col in rolling_cols:
            # Rolling mean
            df[f"{col}_rmean{window}"] = (
                df.groupby("City")[col]
                .transform(lambda x: x.rolling(window, min_periods=max(1, window // 2)).mean())
            )
            # Rolling std (captures variability/stability)
            df[f"{col}_rstd{window}"] = (
                df.groupby("City")[col]
                .transform(lambda x: x.rolling(window, min_periods=max(1, window // 2)).std())
            )

    return df


def add_delta_features(df):
    """
    Add rate-of-change features for key variables.
    Captures warming/cooling trends, pressure changes, moisture shifts.
    """
    df = df.sort_values(["City", "Date"]).copy()
    delta_cols = [c for c in config.DELTA_FEATURE_COLS if c in df.columns]

    for period in config.DELTA_PERIODS:
        for col in delta_cols:
            df[f"{col}_delta{period}"] = df.groupby("City")[col].diff(period)

    return df


def add_satellite_trend_features(df):
    """
    Add satellite index trends for UP cities.
    NDVI change = vegetation health change → rainfall predictor.
    NDWI change = water availability shift.
    """
    df = df.sort_values(["City", "Date"]).copy()
    sat_trend_cols = [c for c in config.SATELLITE_TREND_COLS if c in df.columns]

    for col in sat_trend_cols:
        # Rate of change (current - previous observation)
        df[f"{col}_delta"] = df.groupby("City")[col].diff()
        # 30-day trend (satellite obs are sparse, so longer window)
        df[f"{col}_trend30"] = (
            df.groupby("City")[col]
            .transform(lambda x: x.rolling(30, min_periods=5).mean())
        ) - df.groupby("City")[col].transform(lambda x: x.rolling(60, min_periods=10).mean())

    return df


def add_city_static_features(df, cities_df):
    """Merge city static features (lat, lon, area) into the main dataframe."""
    static_cols = ["name", "latitude", "longitude", "total_area_sqkm"]
    available_cols = [c for c in static_cols if c in cities_df.columns]
    if "name" not in available_cols:
        return df
    cities_subset = cities_df[available_cols].rename(columns={"name": "City"})
    df = df.merge(cities_subset, on="City", how="left")
    return df


def build_target_matrix(df, horizon=None):
    """
    For each row, create future target values for days +1 through +horizon.
    Returns X (features), y (targets), and metadata (City, Date).
    """
    if horizon is None:
        horizon = config.FORECAST_HORIZON

    df = df.sort_values(["City", "Date"]).copy()

    # Create future target columns
    target_dfs = []
    for day_ahead in range(1, horizon + 1):
        future = df.groupby("City")[config.TARGET_COLS].shift(-day_ahead)
        future.columns = [f"{col}_day{day_ahead}" for col in config.TARGET_COLS]
        target_dfs.append(future)

    targets = pd.concat(target_dfs, axis=1)
    return targets


def build_full_dataset(test_mode=False, include_forecast_context=False, recent_only=False):
    """
    Main entry point: build the complete ML-ready dataset.

    This improved pipeline:
    1. Loads UP weather + satellite data
    2. Encodes wind direction correctly (sin/cos + U/V vectors)
    3. Builds India-wide context features (weather + satellite + forecast)
    4. Adds temporal, lag, rolling, and rate-of-change features
    5. Builds the 16-day forecast target matrix

    Args:
        test_mode: If True, limit to 3 cities for quick testing
        include_forecast_context: If True, include forecast context signals
            (only useful when the forecast data is current/recent)
        recent_only: If True, truncates data to the last 100 days to save memory during inference

    Returns:
        df: DataFrame with features + targets, ready for train/val/test split
        feature_cols: list of feature column names
        target_cols: list of target column names
    """
    print("Loading datasets...")
    up_weather = load_weather(config.UP_WEATHER_CSV)
    up_satellite = load_satellite(config.UP_SATELLITE_CSV)
    context_weather = load_weather(config.CONTEXT_WEATHER_CSV)
    context_satellite = load_context_satellite()
    up_cities = load_up_cities()

    # Load forecast context if requested
    context_forecast = None
    if include_forecast_context:
        try:
            context_forecast = pd.read_csv(config.CONTEXT_FORECAST_CSV)
            context_forecast["Date"] = pd.to_datetime(context_forecast["Date"])
            print(f"  Context Forecast: {len(context_forecast)} rows")
        except Exception as e:
            print(f"  WARNING: Could not load forecast context: {e}")

    if test_mode:
        # Limit to 3 cities for quick testing
        test_cities = up_weather["City"].unique()[:3]
        up_weather = up_weather[up_weather["City"].isin(test_cities)]
        up_satellite = up_satellite[up_satellite["City"].isin(test_cities)]
        print(f"  TEST MODE: Using {len(test_cities)} cities: {list(test_cities)}")

    if recent_only:
        print("  RECENT ONLY MODE: Truncating raw data to last 100 days to save memory")
        up_weather = up_weather.groupby('City').tail(100).reset_index(drop=True)
        if not up_satellite.empty:
            up_satellite = up_satellite.groupby('City').tail(100).reset_index(drop=True)
        if not context_weather.empty:
            context_weather = context_weather.groupby('City').tail(100).reset_index(drop=True)
        if not context_satellite.empty:
            context_satellite = context_satellite.groupby('City').tail(100).reset_index(drop=True)

    print(f"  UP Weather: {len(up_weather)} rows")
    print(f"  UP Satellite: {len(up_satellite)} rows")
    print(f"  Context Weather: {len(context_weather)} rows")
    print(f"  Context Satellite: {len(context_satellite)} rows")

    # Step 1: Encode wind direction BEFORE any other processing
    print("Encoding wind direction (sin/cos + U/V vectors)...")
    up_weather = encode_wind_direction(up_weather)

    # Step 2: Forward-fill satellite into daily weather
    print("Forward-filling satellite indices to daily frequency...")
    df = forward_fill_satellite(up_weather, up_satellite)
    print(f"  Merged: {len(df)} rows, {len(df.columns)} columns")

    # Step 3: Build full India-wide context features
    print("Building India-wide context features...")
    context_features = build_all_context_features(
        context_weather, context_satellite, context_forecast
    )
    if not context_features.empty:
        df = df.merge(context_features, on="Date", how="left")
        ctx_cols = [c for c in context_features.columns if c != "Date"]
        # Forward-fill any NaN context signals
        for col in ctx_cols:
            df[col] = df[col].ffill().bfill()
        print(f"  Added {len(ctx_cols)} context features")
    else:
        print("  WARNING: No context features were built")

    # Step 4: Add temporal features
    print("Adding temporal features...")
    df = add_temporal_features(df)

    # Step 5: Add rolling statistics
    print("Adding rolling statistics...")
    df = add_rolling_features(df)

    # Step 6: Add rate-of-change features
    print("Adding rate-of-change features...")
    df = add_delta_features(df)

    # Step 7: Add satellite trend features for UP cities
    print("Adding satellite trend features...")
    df = add_satellite_trend_features(df)

    # Step 8: Add lag features
    print(f"Adding {config.LOOKBACK_DAYS}-day lag features...")
    df = add_lag_features(df)

    # Step 9: Add city static features
    print("Adding city static features...")
    df = add_city_static_features(df, up_cities)

    # Step 10: Build target matrix
    print(f"Building {config.FORECAST_HORIZON}-day forecast targets...")
    targets = build_target_matrix(df)
    df = pd.concat([df, targets], axis=1)

    # Step 11: Drop rows with NaN (from lagging/target creation)
    initial_len = len(df)
    target_col_names = [c for c in df.columns if any(c.startswith(t + "_day") for t in config.TARGET_COLS)]
    lag_col_names = [c for c in df.columns if "_lag" in c and c not in target_col_names]

    # Drop rows missing any lag or target features
    essential_cols = target_col_names + lag_col_names
    df = df.dropna(subset=essential_cols)
    print(f"  Dropped {initial_len - len(df)} rows with NaN from lag/target creation")
    print(f"  Final dataset: {len(df)} rows, {len(df.columns)} columns")

    # Step 12: Fill remaining NaN in non-essential columns (rolling, delta, etc.)
    non_essential = [c for c in df.columns if c not in essential_cols
                     and c not in ["City", "Date", "Year", "Month", "Day"]]
    df[non_essential] = df[non_essential].fillna(0)

    # Identify feature and target columns
    meta_cols = {"City", "Date", "Year", "Month", "Day"}
    exclude_cols = meta_cols | {"Platform", "Scene_ID", "Cloud_Cover",
                                "State", "Climate_Event",
                                "Forecast_Generated_UTC", "Forecast_Day_Ahead"}

    # Current-day target values ARE valid features (we know today's weather)
    # But the shifted target columns are what we predict
    feature_cols = [c for c in df.columns
                    if c not in exclude_cols
                    and c not in target_col_names]

    # Remove any remaining non-numeric columns
    numeric_check = df[feature_cols].select_dtypes(include=[np.number]).columns.tolist()
    dropped_non_numeric = set(feature_cols) - set(numeric_check)
    if dropped_non_numeric:
        print(f"  Dropped non-numeric feature columns: {dropped_non_numeric}")
    feature_cols = numeric_check

    return df, feature_cols, target_col_names


def split_data(df, feature_cols, target_cols):
    """
    Split data temporally into train/val/test.
    """
    train_mask = df["Year"] <= config.TRAIN_END_YEAR
    val_mask = (df["Year"] > config.TRAIN_END_YEAR) & (df["Year"] <= config.VAL_END_YEAR)
    test_mask = df["Year"] > config.VAL_END_YEAR

    X_train = df.loc[train_mask, feature_cols].values
    y_train = df.loc[train_mask, target_cols].values
    X_val = df.loc[val_mask, feature_cols].values
    y_val = df.loc[val_mask, target_cols].values
    X_test = df.loc[test_mask, feature_cols].values
    y_test = df.loc[test_mask, target_cols].values

    print(f"  Train: {X_train.shape[0]} samples ({df.loc[train_mask, 'Year'].min()}-{config.TRAIN_END_YEAR})")
    print(f"  Val:   {X_val.shape[0]} samples ({config.TRAIN_END_YEAR+1}-{config.VAL_END_YEAR})")
    print(f"  Test:  {X_test.shape[0]} samples ({config.VAL_END_YEAR+1}+)")

    return X_train, y_train, X_val, y_val, X_test, y_test


if __name__ == "__main__":
    import sys
    test_mode = "--test" in sys.argv
    df, feature_cols, target_cols = build_full_dataset(test_mode=test_mode)
    print(f"\nFeature columns ({len(feature_cols)}):")
    print(feature_cols[:20], "...")
    print(f"\nTarget columns ({len(target_cols)}):")
    print(target_cols[:10], "...")
