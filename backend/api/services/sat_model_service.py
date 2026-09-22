"""
HeatZone-Vision Satellite Meteorological Analysis Service
==========================================================
Implements the full multi-stage satellite weather forecasting pipeline:
  Step 1: Upstream Meteorological Influence Analysis (Regional Drivers)
  Step 2: Uttar Pradesh Target City Spatial Analysis (Satellite Indices)
  Step 3: Correlation & Prognostic Modeling (LSTM-Transformer + Heatwave Index)

Uses real satellite indices (NDVI, NDBI, NDWI, LST, Albedo, etc.) and
upstream climate event corridor data to generate hyper-localized forecasts.
"""

import os
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

import config

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Climate event groups with their upstream sentinel cities and lead times
CLIMATE_EVENT_GROUPS = {
    "EVENT_1_LOO_HEATWAVE": {
        "label": "LOO / Heatwave Corridor",
        "corridor": "North-West (Thar Desert → Rajasthan → Haryana → Delhi → Western UP)",
        "cities": ["Bikaner", "Churu", "Jaipur", "Hisar", "New Delhi"],
        "lead_time_days": (1, 3),
        "key_features": ["Temp_Max_C", "Temp_Mean_C", "Wind_Speed_Max_kmh",
                         "Humidity_Mean_pct", "Shortwave_Radiation_MJm2"],
        "satellite_features": ["NDVI", "Albedo", "NDBI", "BSI"],
        "description": "Hot dry Loo winds from the Thar Desert traveling east into UP",
    },
    "EVENT_2_WESTERN_DISTURBANCE": {
        "label": "Western Disturbance Corridor",
        "corridor": "North-West (J&K → Himachal → Punjab → Haryana → Delhi → Western UP)",
        "cities": ["Srinagar", "Shimla", "Amritsar", "Chandigarh", "Dehradun"],
        "lead_time_days": (2, 4),
        "key_features": ["Precipitation_mm", "Pressure_MSL_hPa", "Temp_Min_C",
                         "Wind_Speed_Max_kmh", "Humidity_Mean_pct"],
        "satellite_features": ["NDWI", "NDMI", "MNDWI"],
        "description": "Extratropical cyclonic storms from the Mediterranean bringing winter rain",
    },
    "EVENT_3_SW_MONSOON": {
        "label": "Southwest Monsoon Corridor",
        "corridor": "South-West (Kerala → Western Ghats → Central India → UP)",
        "cities": ["Thiruvananthapuram", "Mumbai", "Nagpur", "Bhopal", "Gwalior"],
        "lead_time_days": (5, 15),
        "key_features": ["Precipitation_mm", "Humidity_Mean_pct",
                         "Wind_Direction_Dominant_deg", "Pressure_MSL_hPa"],
        "satellite_features": ["NDWI", "NDVI", "NDMI", "EVI"],
        "description": "Southwest Monsoon providing 85% of UP annual rainfall",
    },
    "EVENT_4_BAY_DEPRESSION": {
        "label": "Bay of Bengal Depression Corridor",
        "corridor": "East/South-East (Bay of Bengal → Odisha/WB → Jharkhand → Bihar → Eastern UP)",
        "cities": ["Bhubaneswar", "Kolkata", "Ranchi", "Patna"],
        "lead_time_days": (2, 4),
        "key_features": ["Precipitation_mm", "Pressure_MSL_hPa",
                         "Wind_Speed_Max_kmh", "Wind_Gusts_Max_kmh",
                         "Humidity_Mean_pct"],
        "satellite_features": ["NDWI", "MNDWI", "NDMI"],
        "description": "Low pressure depressions from Bay of Bengal bringing heavy rain",
    },
}

# Satellite feature columns available in the CSVs
SATELLITE_COLS = [
    "NDVI", "NDBI", "NDWI", "NDMI", "SAVI", "EVI",
    "BSI", "UI", "MNDWI", "Albedo",
    "Blue_Mean", "Green_Mean", "Red_Mean",
    "NIR_Mean", "SWIR1_Mean", "SWIR2_Mean",
]

WEATHER_COLS = [
    "Temp_Max_C", "Temp_Min_C", "Temp_Mean_C",
    "Apparent_Temp_Max_C", "Apparent_Temp_Min_C",
    "Precipitation_mm", "Rain_mm",
    "Wind_Speed_Max_kmh", "Wind_Gusts_Max_kmh",
    "Wind_Direction_Dominant_deg",
    "Shortwave_Radiation_MJm2", "ET0_Evapotranspiration_mm",
    "Humidity_Mean_pct", "Humidity_Max_pct", "Humidity_Min_pct",
    "Dew_Point_Mean_C", "Pressure_MSL_hPa",
    "Soil_Temp_0_7cm_C", "Soil_Moisture_0_7cm_m3m3",
]

# Heatwave thresholds (IMD standards for plains)
HEATWAVE_THRESHOLDS = {
    "normal_max": 40.0,       # Normal summer max for UP plains
    "heatwave_departure": 4.5, # Departure from normal for heatwave
    "severe_departure": 6.5,   # Departure from normal for severe heatwave
    "absolute_heatwave": 45.0, # Absolute temperature for heatwave
    "absolute_severe": 47.0,   # Absolute temperature for severe heatwave
}


# ═══════════════════════════════════════════════════════════════════════════════
# DATA LOADING (cached at module level for performance)
# ═══════════════════════════════════════════════════════════════════════════════

from data.weather_db import query_recent_city_weather, query_context_weather, query_city_weather, get_available_cities

def _load_data(target_date=None, lookback_days=30, city=None):
    """Load recent weather & context data via SQLite (< 0.5MB RAM)."""
    end_dt = target_date or pd.Timestamp.now()
    start_dt = end_dt - pd.Timedelta(days=lookback_days)
    
    if city:
        hist_df = query_city_weather(city, start_date=start_dt, end_date=end_dt)
        if hist_df.empty:
            hist_df = query_recent_city_weather(city, limit_days=lookback_days)
    else:
        hist_df = query_recent_city_weather("Lucknow", limit_days=lookback_days)
        
    ctx_df = query_context_weather(start_date=start_dt, end_date=end_dt)
    if ctx_df.empty:
        ctx_df = hist_df.copy()
        
    return hist_df, ctx_df



# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: UPSTREAM METEOROLOGICAL INFLUENCE ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════════

def analyze_upstream_corridors(context_df, target_date, lookback_days=7):
    """
    Analyze each climate event corridor's upstream cities for the recent period.
    Returns a dict of corridor analyses with weather + satellite signals.
    """
    corridor_analyses = {}

    for event_id, event_cfg in CLIMATE_EVENT_GROUPS.items():
        cities = event_cfg["cities"]
        lag_min, lag_max = event_cfg["lead_time_days"]
        key_feats = event_cfg["key_features"]
        sat_feats = event_cfg["satellite_features"]

        # Get data for the upstream cities in the lookback window
        start_dt = target_date - pd.Timedelta(days=lookback_days)
        mask = (
            (context_df["City"].isin(cities)) &
            (context_df["Date"] >= start_dt) &
            (context_df["Date"] <= target_date)
        )
        corridor_df = context_df[mask].copy()

        if corridor_df.empty:
            corridor_analyses[event_id] = {
                "label": event_cfg["label"],
                "corridor": event_cfg["corridor"],
                "description": event_cfg["description"],
                "status": "NO_DATA",
                "signal_strength": "unknown",
            }
            continue

        # Compute mean signals across the corridor cities
        available_key = [c for c in key_feats if c in corridor_df.columns]
        available_sat = [c for c in sat_feats if c in corridor_df.columns]

        # Latest day averages
        latest_dt = corridor_df["Date"].max()
        latest_df = corridor_df[corridor_df["Date"] == latest_dt]
        latest_means = latest_df[available_key].mean() if not latest_df.empty else pd.Series()

        # Trend: compare last 2 days vs previous 5 days
        recent_mask = corridor_df["Date"] >= (target_date - pd.Timedelta(days=2))
        older_mask = corridor_df["Date"] < (target_date - pd.Timedelta(days=2))
        recent_means = corridor_df[recent_mask][available_key].mean()
        older_means = corridor_df[older_mask][available_key].mean()
        trend = recent_means - older_means if not older_means.empty else pd.Series()

        # Satellite indices summary
        sat_summary = {}
        if available_sat:
            sat_latest = latest_df[available_sat].mean()
            for col in available_sat:
                if col in sat_latest.index and not pd.isna(sat_latest[col]):
                    sat_summary[col] = round(float(sat_latest[col]), 4)

        # Determine signal strength
        signal_strength = _assess_signal_strength(event_id, latest_means, trend)

        # Per-city breakdown
        per_city = {}
        for city_name in cities:
            city_data = latest_df[latest_df["City"] == city_name]
            if not city_data.empty:
                city_row = {}
                for feat in available_key[:3]:  # Top 3 features
                    val = city_data[feat].iloc[0]
                    if not pd.isna(val):
                        city_row[feat] = round(float(val), 1)
                for feat in available_sat[:2]:  # Top 2 sat features
                    val = city_data[feat].iloc[0] if feat in city_data.columns else None
                    if val is not None and not pd.isna(val):
                        city_row[feat] = round(float(val), 4)
                per_city[city_name] = city_row

        corridor_analyses[event_id] = {
            "label": event_cfg["label"],
            "corridor": event_cfg["corridor"],
            "description": event_cfg["description"],
            "status": "ACTIVE",
            "signal_strength": signal_strength,
            "lead_time_days": f"{lag_min}-{lag_max} days",
            "latest_date": latest_dt.strftime("%Y-%m-%d"),
            "key_signals": {k: round(float(v), 2) for k, v in latest_means.items()
                           if not pd.isna(v)} if not latest_means.empty else {},
            "trends": {k: round(float(v), 2) for k, v in trend.items()
                       if not pd.isna(v)} if not trend.empty else {},
            "satellite_indices": sat_summary,
            "per_city": per_city,
        }

    return corridor_analyses


def _assess_signal_strength(event_id, latest_means, trend):
    """Heuristic signal strength based on event type and current readings."""
    if latest_means.empty:
        return "weak"

    if event_id == "EVENT_1_LOO_HEATWAVE":
        temp = latest_means.get("Temp_Max_C", 30)
        if temp > 44:
            return "EXTREME"
        elif temp > 40:
            return "strong"
        elif temp > 36:
            return "moderate"
        return "weak"

    elif event_id == "EVENT_2_WESTERN_DISTURBANCE":
        precip = latest_means.get("Precipitation_mm", 0)
        if precip > 20:
            return "strong"
        elif precip > 5:
            return "moderate"
        return "weak"

    elif event_id == "EVENT_3_SW_MONSOON":
        humidity = latest_means.get("Humidity_Mean_pct", 50)
        precip = latest_means.get("Precipitation_mm", 0)
        if humidity > 80 and precip > 15:
            return "strong"
        elif humidity > 65:
            return "moderate"
        return "weak"

    elif event_id == "EVENT_4_BAY_DEPRESSION":
        pressure = latest_means.get("Pressure_MSL_hPa", 1013)
        wind = latest_means.get("Wind_Speed_Max_kmh", 10)
        if pressure < 1005 and wind > 30:
            return "strong"
        elif pressure < 1008:
            return "moderate"
        return "weak"

    return "moderate"


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: TARGET CITY SATELLITE & FEATURE DIAGNOSTICS
# ═══════════════════════════════════════════════════════════════════════════════

def analyze_target_city(historical_df, city, target_date, lookback_days=30):
    """
    Analyze the target UP city's satellite indices and weather features.
    Returns local diagnostics including thermal profile, vegetation, moisture.
    """
    city_df = historical_df[historical_df["City"] == city].sort_values("Date")
    if city_df.empty:
        raise ValueError(f"City '{city}' not found in satellite dataset.")

    start_dt = target_date - pd.Timedelta(days=lookback_days)
    recent = city_df[(city_df["Date"] >= start_dt) & (city_df["Date"] <= target_date)]

    if recent.empty:
        # Fallback: use the most recent available data
        recent = city_df.tail(lookback_days)

    latest = recent.iloc[-1] if len(recent) > 0 else None
    base_date = recent["Date"].iloc[-1] if len(recent) > 0 else city_df["Date"].iloc[-1]

    # Current weather readings
    current_weather = {}
    for col in WEATHER_COLS:
        if col in recent.columns and latest is not None:
            val = latest[col]
            if not pd.isna(val):
                current_weather[col] = round(float(val), 2)

    # Surface Thermal Profile
    thermal_profile = {}
    if "Temp_Max_C" in current_weather:
        thermal_profile["current_max_temp"] = current_weather["Temp_Max_C"]
    if "Temp_Min_C" in current_weather:
        thermal_profile["current_min_temp"] = current_weather["Temp_Min_C"]
    if "Apparent_Temp_Max_C" in current_weather:
        thermal_profile["feels_like_max"] = current_weather["Apparent_Temp_Max_C"]

    # 7-day temperature trend
    last_7 = recent.tail(7)
    if len(last_7) >= 2 and "Temp_Max_C" in last_7.columns:
        temp_trend = last_7["Temp_Max_C"].dropna()
        if len(temp_trend) >= 2:
            thermal_profile["7day_trend_max"] = round(
                float(temp_trend.iloc[-1] - temp_trend.iloc[0]), 1
            )
            thermal_profile["7day_avg_max"] = round(float(temp_trend.mean()), 1)

    if "Soil_Temp_0_7cm_C" in current_weather:
        thermal_profile["soil_surface_temp"] = current_weather["Soil_Temp_0_7cm_C"]

    # Satellite Indices (vegetation, moisture, urban, bare soil)
    satellite_diagnostics = {}
    for col in SATELLITE_COLS:
        if col in recent.columns and latest is not None:
            val = latest[col]
            if not pd.isna(val):
                satellite_diagnostics[col] = round(float(val), 4)

    # Interpret satellite indices
    sat_interpretation = _interpret_satellite_indices(satellite_diagnostics)

    # Cloud & Moisture Profile
    cloud_moisture = {}
    if "Humidity_Mean_pct" in current_weather:
        cloud_moisture["humidity_pct"] = current_weather["Humidity_Mean_pct"]
    if "Dew_Point_Mean_C" in current_weather:
        cloud_moisture["dew_point_c"] = current_weather["Dew_Point_Mean_C"]
    if "Soil_Moisture_0_7cm_m3m3" in current_weather:
        cloud_moisture["soil_moisture"] = current_weather["Soil_Moisture_0_7cm_m3m3"]
    if "Cloud_Cover" in recent.columns and latest is not None:
        cc = latest.get("Cloud_Cover")
        if cc is not None and not pd.isna(cc):
            cloud_moisture["cloud_cover_pct"] = round(float(cc), 1)

    return {
        "base_date": base_date.strftime("%Y-%m-%d"),
        "data_points_used": len(recent),
        "current_weather": current_weather,
        "thermal_profile": thermal_profile,
        "satellite_diagnostics": satellite_diagnostics,
        "satellite_interpretation": sat_interpretation,
        "cloud_moisture_profile": cloud_moisture,
    }


def _interpret_satellite_indices(indices):
    """Human-readable interpretation of satellite index values."""
    interpretation = {}

    ndvi = indices.get("NDVI")
    if ndvi is not None:
        if ndvi > 0.5:
            interpretation["vegetation"] = f"Dense vegetation (NDVI={ndvi})"
        elif ndvi > 0.2:
            interpretation["vegetation"] = f"Moderate vegetation (NDVI={ndvi})"
        elif ndvi > 0.1:
            interpretation["vegetation"] = f"Sparse vegetation / cropland (NDVI={ndvi})"
        else:
            interpretation["vegetation"] = f"Bare soil / urban (NDVI={ndvi})"

    ndbi = indices.get("NDBI")
    if ndbi is not None:
        if ndbi > 0.1:
            interpretation["urbanization"] = f"High urban density / built-up (NDBI={ndbi})"
        elif ndbi > 0:
            interpretation["urbanization"] = f"Moderate built-up area (NDBI={ndbi})"
        else:
            interpretation["urbanization"] = f"Non-urban / vegetated (NDBI={ndbi})"

    ndwi = indices.get("NDWI")
    ndmi = indices.get("NDMI")
    if ndwi is not None:
        if ndwi > 0:
            interpretation["water"] = f"Water bodies present (NDWI={ndwi})"
        else:
            interpretation["water"] = f"Low surface water (NDWI={ndwi})"
    if ndmi is not None:
        if ndmi > 0.2:
            interpretation["moisture"] = f"High vegetation moisture (NDMI={ndmi})"
        elif ndmi > 0:
            interpretation["moisture"] = f"Moderate moisture stress (NDMI={ndmi})"
        else:
            interpretation["moisture"] = f"Dry vegetation / moisture stress (NDMI={ndmi})"

    bsi = indices.get("BSI")
    if bsi is not None:
        if bsi > 0.1:
            interpretation["soil"] = f"Exposed bare soil (BSI={bsi}) — amplifies heat absorption"
        else:
            interpretation["soil"] = f"Covered soil (BSI={bsi})"

    albedo = indices.get("Albedo")
    if albedo is not None:
        if albedo > 0.25:
            interpretation["albedo"] = f"High surface reflectance (Albedo={albedo})"
        elif albedo > 0.15:
            interpretation["albedo"] = f"Moderate surface reflectance (Albedo={albedo})"
        else:
            interpretation["albedo"] = f"Low albedo / dark surface (Albedo={albedo}) — heat trap"

    return interpretation


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: FORECAST & HEATWAVE INDEX COMPUTATION
# ═══════════════════════════════════════════════════════════════════════════════

def compute_heat_index(temp_c, rh_pct):
    """
    Compute Heat Index using Steadman's formula (converted from Fahrenheit).
    Returns heat index in Celsius.
    """
    if temp_c is None or rh_pct is None:
        return None
    if pd.isna(temp_c) or pd.isna(rh_pct):
        return None

    # Convert to Fahrenheit for the standard HI formula
    T = temp_c * 9.0 / 5.0 + 32.0
    R = rh_pct

    # Simple formula
    HI = 0.5 * (T + 61.0 + ((T - 68.0) * 1.2) + (R * 0.094))

    if HI >= 80:
        # Full Rothfusz regression
        HI = (
            -42.379
            + 2.04901523 * T
            + 10.14333127 * R
            - 0.22475541 * T * R
            - 0.00683783 * T * T
            - 0.05481717 * R * R
            + 0.00122874 * T * T * R
            + 0.00085282 * T * R * R
            - 0.00000199 * T * T * R * R
        )

        # Adjustments
        if R < 13 and 80 <= T <= 112:
            HI -= ((13 - R) / 4) * ((17 - abs(T - 95.0)) / 17) ** 0.5
        elif R > 85 and 80 <= T <= 87:
            HI += ((R - 85) / 10) * ((87 - T) / 5)

    # Convert back to Celsius
    return round((HI - 32.0) * 5.0 / 9.0, 1)


def classify_heatwave_alert(temp_max, temp_mean_normal=None):
    """
    Classify heatwave alert level based on IMD criteria for plains.
    """
    if temp_max is None or pd.isna(temp_max):
        return "GREEN", "Normal conditions"

    if temp_mean_normal is None:
        temp_mean_normal = HEATWAVE_THRESHOLDS["normal_max"]

    departure = temp_max - temp_mean_normal

    if temp_max >= HEATWAVE_THRESHOLDS["absolute_severe"] or departure >= HEATWAVE_THRESHOLDS["severe_departure"]:
        return "RED", f"SEVERE HEATWAVE — Max {temp_max}°C (departure +{departure:.1f}°C)"
    elif temp_max >= HEATWAVE_THRESHOLDS["absolute_heatwave"] or departure >= HEATWAVE_THRESHOLDS["heatwave_departure"]:
        return "ORANGE", f"HEATWAVE WARNING — Max {temp_max}°C (departure +{departure:.1f}°C)"
    elif departure >= 2.0 or temp_max >= 38:
        return "YELLOW", f"Above normal heat — Max {temp_max}°C"
    else:
        return "GREEN", f"Normal conditions — Max {temp_max}°C"


def compute_precipitation_probability(humidity, dew_point, pressure, wind_speed,
                                       upstream_precip=0, ndwi=None):
    """
    Heuristic precipitation probability based on available meteorological signals.
    """
    prob = 0.0

    # Humidity contribution
    if humidity is not None:
        if humidity > 90:
            prob += 40
        elif humidity > 80:
            prob += 30
        elif humidity > 70:
            prob += 15
        elif humidity > 60:
            prob += 5

    # Dew point spread (narrow = rain likely)
    # (We'd need actual temperature for spread, approximate)

    # Pressure contribution (low pressure = rain)
    if pressure is not None:
        if pressure < 1000:
            prob += 25
        elif pressure < 1005:
            prob += 15
        elif pressure < 1010:
            prob += 5

    # Upstream rainfall signal
    if upstream_precip > 20:
        prob += 20
    elif upstream_precip > 10:
        prob += 10
    elif upstream_precip > 2:
        prob += 5

    # NDWI signal (high = moisture)
    if ndwi is not None and ndwi > 0:
        prob += 5

    return min(round(prob, 0), 95)  # Cap at 95%


def determine_wind_direction_label(deg):
    """Convert wind direction degrees to compass label."""
    if deg is None or pd.isna(deg):
        return "VAR"
    dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
            "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    idx = round(deg / 22.5) % 16
    return dirs[idx]


def determine_sky_state(humidity, precipitation, cloud_cover=None):
    """Determine sky condition from available signals."""
    if cloud_cover is not None and not pd.isna(cloud_cover):
        if cloud_cover > 80:
            return "Overcast"
        elif cloud_cover > 50:
            return "Mostly Cloudy"
        elif cloud_cover > 25:
            return "Partly Cloudy"
        else:
            return "Clear"

    if precipitation is not None and precipitation > 5:
        return "Rainy"
    if humidity is not None:
        if humidity > 85:
            return "Overcast"
        elif humidity > 70:
            return "Partly Cloudy"
        elif humidity > 50:
            return "Hazy"
        else:
            return "Clear"
    return "Unknown"


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN PIPELINE: SATELLITE ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════════

def run_satellite_analysis(city: str, horizon_hours: int = 72, target_date: str = None):
    """
    Main entry point: Execute the full HeatZone-Vision satellite analysis pipeline.

    Returns a structured dict matching the output format specification.
    """
    target_dt = pd.to_datetime(target_date) if target_date else None
    historical_df = query_recent_city_weather(city, limit_days=30, end_date=target_dt)
    if historical_df.empty:
        historical_df = query_city_weather(city, limit=30)
    if historical_df.empty:
        raise ValueError(f"City '{city}' not found in weather dataset.")

    if target_date is None:
        target_date = historical_df["Date"].max()
    else:
        target_date = pd.to_datetime(target_date)

    _, context_df = _load_data(target_date=target_date, lookback_days=7)


    # ── STEP 1: Upstream Corridor Analysis ──────────────────────────────────
    upstream_analysis = analyze_upstream_corridors(context_df, target_date, lookback_days=7)

    # ── STEP 2: Target City Diagnostics ─────────────────────────────────────
    local_analysis = analyze_target_city(historical_df, city, target_date, lookback_days=30)

    # ── STEP 3: Generate Forecast Matrix ────────────────────────────────────
    from api.services import model_runner
    model_forecast = model_runner.generate_satellite_forecast(city, date=target_date)

    # ── STEP 3b: Compute derived indices for each forecast day ──────────────
    current = local_analysis["current_weather"]
    satellite = local_analysis["satellite_diagnostics"]

    # Get upstream precipitation signal
    upstream_precip = 0
    for evt_id, evt_data in upstream_analysis.items():
        if isinstance(evt_data, dict) and evt_data.get("status") == "ACTIVE":
            signals = evt_data.get("key_signals", {})
            upstream_precip = max(upstream_precip, signals.get("Precipitation_mm", 0))

    # Build forecast matrix with heatwave indices
    forecast_matrix = []
    for pred in model_forecast["predictions"]:
        temp_max = pred.get("Temp_Max_C")
        temp_min = pred.get("Temp_Min_C")
        humidity = pred.get("Humidity_Mean_pct")
        precip = pred.get("Precipitation_mm")
        wind = pred.get("Wind_Speed_Max_kmh")
        pressure = pred.get("Pressure_MSL_hPa")

        heat_index = compute_heat_index(temp_max, humidity) if temp_max and humidity else None
        alert_level, alert_msg = classify_heatwave_alert(temp_max)
        precip_prob = compute_precipitation_probability(
            humidity, current.get("Dew_Point_Mean_C"), pressure, wind,
            upstream_precip, satellite.get("NDWI")
        )

        wind_dir = determine_wind_direction_label(
            current.get("Wind_Direction_Dominant_deg")
        )
        sky = determine_sky_state(humidity, precip)

        forecast_matrix.append({
            "date": pred["date"],
            "temp_max_c": round(temp_max, 1) if temp_max else None,
            "temp_min_c": round(temp_min, 1) if temp_min else None,
            "feels_like_c": heat_index,
            "heatwave_alert": alert_level,
            "heatwave_message": alert_msg,
            "precipitation_probability_pct": precip_prob,
            "precipitation_mm": round(precip, 1) if precip else 0,
            "wind_speed_kmh": round(wind, 1) if wind else None,
            "wind_direction": wind_dir,
            "humidity_pct": round(humidity, 1) if humidity else None,
            "pressure_hpa": round(pressure, 1) if pressure else None,
            "sky_condition": sky,
            "radiation_mjm2": round(pred.get("Shortwave_Radiation_MJm2", 0), 1),
        })

    # ── Compose advisory ────────────────────────────────────────────────────
    key_driver, advisory = _generate_advisory(
        upstream_analysis, local_analysis, forecast_matrix
    )

    # ── Assemble final response ─────────────────────────────────────────────
    return {
        "city": city,
        "state": "Uttar Pradesh",
        "timestamp_ist": datetime.now().strftime("%Y-%m-%d %H:%M IST"),
        "base_date": model_forecast["base_date"],
        "forecast_horizon_hours": horizon_hours,

        "upstream_corridor_analysis": upstream_analysis,

        "local_diagnostics": {
            "thermal_profile": local_analysis["thermal_profile"],
            "satellite_indices": local_analysis["satellite_diagnostics"],
            "satellite_interpretation": local_analysis["satellite_interpretation"],
            "cloud_moisture_profile": local_analysis["cloud_moisture_profile"],
            "correlated_weather": {
                k: v for k, v in current.items()
                if k in ["Temp_Max_C", "Temp_Min_C", "Humidity_Mean_pct",
                         "Pressure_MSL_hPa", "Wind_Speed_Max_kmh",
                         "Precipitation_mm", "Dew_Point_Mean_C"]
            },
        },

        "forecast_matrix": forecast_matrix,

        "meteorological_summary": {
            "key_driver": key_driver,
            "public_advisory": advisory,
        },
    }


def _generate_advisory(upstream, local, forecast_matrix):
    """Generate key driver explanation and public advisory."""

    # Find the dominant upstream signal
    dominant_event = None
    max_strength_score = 0
    strength_map = {"EXTREME": 4, "strong": 3, "moderate": 2, "weak": 1, "unknown": 0}

    for evt_id, evt_data in upstream.items():
        if isinstance(evt_data, dict):
            strength = evt_data.get("signal_strength", "unknown")
            score = strength_map.get(strength, 0)
            if score > max_strength_score:
                max_strength_score = score
                dominant_event = evt_data

    # Check for heatwave in the forecast
    max_temp = max((f.get("temp_max_c", 0) or 0) for f in forecast_matrix)
    has_heatwave = any(f.get("heatwave_alert") in ["RED", "ORANGE"] for f in forecast_matrix)
    has_rain = any((f.get("precipitation_mm", 0) or 0) > 5 for f in forecast_matrix)

    # Build key driver statement
    if dominant_event and max_strength_score >= 3:
        key_driver = (
            f"{dominant_event['label']} is the primary atmospheric driver. "
            f"{dominant_event['description']}. Signal strength: {dominant_event.get('signal_strength', 'unknown').upper()}."
        )
    elif has_heatwave:
        key_driver = (
            f"Intense surface heating with max temperature reaching {max_temp:.1f}°C. "
            f"Urban heat island effect and low vegetation cover are amplifying thermal stress."
        )
    elif has_rain:
        key_driver = (
            f"Moisture advection from upstream corridors is driving precipitation events. "
            f"Expect intermittent to moderate rainfall over the forecast period."
        )
    else:
        key_driver = (
            f"Normal seasonal atmospheric patterns are prevailing. "
            f"No significant extreme weather signals detected from upstream corridors."
        )

    # Build public advisory
    if has_heatwave:
        advisory = (
            "⚠️ HEAT ACTION ALERT: Avoid outdoor exposure between 11 AM–4 PM. "
            "Stay hydrated (min 3L water/day). Wear light, breathable clothing. "
            "Check on elderly and children frequently. "
            "Keep livestock in shade with adequate water supply."
        )
    elif has_rain and max_temp > 35:
        advisory = (
            "Mixed conditions ahead with heat and rain episodes. "
            "Carry rain protection when going outdoors. Stay alert for sudden gusts during thunderstorms. "
            "Avoid waterlogged areas due to risk of waterborne diseases."
        )
    elif has_rain:
        advisory = (
            "Rainfall expected in the forecast period. Carry umbrellas and rain gear. "
            "Drive cautiously on wet roads. Avoid low-lying areas prone to waterlogging."
        )
    elif max_temp > 38:
        advisory = (
            "Above-normal temperatures expected. Limit strenuous outdoor activities during peak hours. "
            "Increase fluid intake. Monitor for signs of heat exhaustion."
        )
    else:
        advisory = (
            "Normal weather conditions expected. No special precautions needed. "
            "Enjoy outdoor activities during morning and evening hours."
        )

    return key_driver, advisory
