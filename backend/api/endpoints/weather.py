import os
import json
import pandas as pd
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from api.services import model_runner, sat_model_service
from api.services.heatscore_service import predict_heatscores

router = APIRouter()

def get_forecast_data():
    data_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "all_cities_heatscore_forecast.json")
    if not os.path.exists(data_path):
        return []
    try:
        with open(data_path, "r") as f:
            return json.load(f)
    except Exception:
        return []

def get_historical_data():
    data_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "temperature_data.csv")
    if not os.path.exists(data_path):
        return pd.DataFrame()
    return pd.read_csv(data_path)

def generate_city_unified_forecast(city: str):
    """Dynamically generate forecast & heatscores for a city if not cached."""
    try:
        result = model_runner.generate_forecast(city)
        predictions_with_scores = predict_heatscores(city, result["predictions"])
        return {
            "city": city,
            "base_date": result["base_date"],
            "forecast": predictions_with_scores
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate forecast for {city}: {e}")

def extract_all_alerts(forecasts: list, target_city: Optional[str] = None, alert_type_filter: Optional[str] = None) -> dict:
    """Extract and categorize all active alerts (HEAT, RAIN, WIND, HUMIDITY, CORRIDOR) dynamically from predicted model outputs & satellite context telemetry."""
    alerts = []
    heat_count = 0
    rain_count = 0
    wind_count = 0
    humidity_count = 0
    corridor_count = 0

    base_date = forecasts[0].get("base_date", "") if forecasts else ""
    city_updates = []

    for item in forecasts:
        city_name = item.get("city", "")
        if target_city and city_name.lower() != target_city.lower():
            continue
            
        preds = item.get("forecast", [])
        if not preds:
            continue
            
        curr = preds[0]
        date_str = curr.get("date", base_date)
        
        # Standardize field names (handling uppercase/lowercase differences in json)
        temp_max = curr.get("Temp_Max_C") or curr.get("temp_max_c") or 0.0
        temp_min = curr.get("Temp_Min_C") or curr.get("temp_min_c") or 0.0
        precip = curr.get("Precipitation_mm") or curr.get("precipitation_mm") or curr.get("rainfall_mm") or 0.0
        rain_prob = curr.get("rain_probability") or curr.get("precipitation_probability_pct", 0.0)
        if rain_prob > 1.0:
            rain_prob = rain_prob / 100.0  # normalize percentage if > 1
        humidity = curr.get("Humidity_Mean_pct") or curr.get("humidity_pct") or 0.0
        wind_speed = curr.get("Wind_Speed_Max_kmh") or curr.get("wind_speed_kmh") or 0.0
        heat_score = curr.get("heat_risk_score") or 0.0
        heat_zone = str(curr.get("heat_zone", "low")).lower()
        primary_driver = curr.get("primary_driver", "Normal Atmospheric Conditions")
        causal_exp = curr.get("causal_explanation", "")

        ndvi_val = curr.get("ndvi") or curr.get("NDVI")
        ndbi_val = curr.get("ndbi") or curr.get("NDBI")
        ndwi_val = curr.get("ndwi") or curr.get("NDWI")

        city_updates.append({
            "city": city_name,
            "date": date_str,
            "temp_max_c": round(temp_max, 1),
            "temp_min_c": round(temp_min, 1),
            "precipitation_mm": round(precip, 2),
            "rain_probability_pct": round(rain_prob * 100, 1),
            "humidity_pct": round(humidity, 1),
            "wind_speed_kmh": round(wind_speed, 1),
            "heat_risk_score": round(heat_score, 1),
            "heat_zone": heat_zone,
            "primary_driver": primary_driver,
            "ndvi": ndvi_val,
            "ndbi": ndbi_val,
            "ndwi": ndwi_val
        })

        # Evaluate across predicted forecast days for dynamic alert generation
        for pred_day in preds[:3]:
            d_str = pred_day.get("date", date_str)
            t_max = pred_day.get("Temp_Max_C") or pred_day.get("temp_max_c") or 0.0
            p_mm = pred_day.get("Precipitation_mm") or pred_day.get("precipitation_mm") or pred_day.get("rainfall_mm") or 0.0
            r_prob = pred_day.get("rain_probability") or pred_day.get("precipitation_probability_pct", 0.0)
            if r_prob > 1.0:
                r_prob = r_prob / 100.0
            hum = pred_day.get("Humidity_Mean_pct") or pred_day.get("humidity_pct") or 0.0
            w_spd = pred_day.get("Wind_Speed_Max_kmh") or pred_day.get("wind_speed_kmh") or 0.0
            h_score = pred_day.get("heat_risk_score") or 0.0
            h_zone = str(pred_day.get("heat_zone", "low")).lower()
            p_driver = pred_day.get("primary_driver", primary_driver)
            c_exp = pred_day.get("causal_explanation", causal_exp)

            # 1. HEAT RISK ALERTS (Dynamic ML predicted)
            if h_zone in ["extreme", "high"] or h_score >= 45.0 or t_max >= 38.0:
                heat_count += 1
                severity = "RED" if (h_zone == "extreme" or h_score >= 60.0 or t_max >= 42.0) else ("ORANGE" if (h_zone == "high" or h_score >= 50.0) else "YELLOW")
                alerts.append({
                    "id": f"ALERT-HEAT-{city_name.upper()}-{d_str}",
                    "city": city_name,
                    "alert_type": "HEAT",
                    "severity": severity,
                    "title": f"Heatwave & High Thermal Alert — {city_name}",
                    "message": f"Elevated predicted heat risk score ({h_score:.1f}/100) with predicted max temperature of {t_max:.1f}°C. Primary driver: {p_driver}. {c_exp}".strip(),
                    "metric": f"{h_score:.1f} Heat Risk Score, {t_max:.1f}°C Max Temp",
                    "date": d_str
                })

            # 2. RAIN & STORM ALERTS (Dynamic ML predicted)
            if r_prob >= 0.50 or p_mm >= 1.0:
                rain_count += 1
                severity = "RED" if (p_mm >= 10.0 or r_prob >= 0.80) else ("ORANGE" if (p_mm >= 3.0 or r_prob >= 0.65) else "YELLOW")
                alerts.append({
                    "id": f"ALERT-RAIN-{city_name.upper()}-{d_str}",
                    "city": city_name,
                    "alert_type": "RAIN",
                    "severity": severity,
                    "title": f"Precipitation & Rain Alert — {city_name}",
                    "message": f"Predicted rainfall probability of {r_prob * 100:.0f}% with estimated precipitation of {p_mm:.2f}mm.",
                    "metric": f"{r_prob * 100:.0f}% Rain Probability, {p_mm:.2f}mm Rainfall",
                    "date": d_str
                })

            # 3. WIND & LOO GUST ALERTS (Dynamic ML predicted)
            if w_spd >= 12.5:
                wind_count += 1
                severity = "RED" if w_spd >= 25.0 else ("ORANGE" if w_spd >= 18.0 else "YELLOW")
                alerts.append({
                    "id": f"ALERT-WIND-{city_name.upper()}-{d_str}",
                    "city": city_name,
                    "alert_type": "WIND",
                    "severity": severity,
                    "title": f"Wind & Loo Velocity Alert — {city_name}",
                    "message": f"Predicted surface wind velocity of {w_spd:.1f} km/h detected in regional corridor.",
                    "metric": f"{w_spd:.1f} km/h Wind Speed",
                    "date": d_str
                })

            # 4. HUMIDITY & MUGGY HEAT INDEX ALERTS (Dynamic ML predicted)
            if hum >= 68.0 and t_max >= 32.0:
                humidity_count += 1
                severity = "ORANGE" if hum >= 75.0 else "YELLOW"
                alerts.append({
                    "id": f"ALERT-HUMIDITY-{city_name.upper()}-{d_str}",
                    "city": city_name,
                    "alert_type": "HUMIDITY",
                    "severity": severity,
                    "title": f"High Relative Humidity Advisory — {city_name}",
                    "message": f"Predicted humidity level of {hum:.1f}% combining with max temperature {t_max:.1f}°C creating muggy heat index discomfort.",
                    "metric": f"{hum:.1f}% Relative Humidity",
                    "date": d_str
                })

    # 5. SATELLITE CORRIDOR ALERTS (Dynamic Upstream Sentinel Data Analysis)
    try:
        _, ctx_df = sat_model_service._load_data()
        target_dt = pd.to_datetime(base_date) if base_date else pd.to_datetime("today")
        corridor_data = sat_model_service.analyze_upstream_corridors(ctx_df, target_dt)
        
        for evt_id, evt in corridor_data.items():
            if isinstance(evt, dict) and evt.get("status") == "ACTIVE":
                str_label = evt.get("signal_strength", "weak").lower()
                if str_label in ["extreme", "strong", "moderate"]:
                    corridor_count += 1
                    label = evt.get("label", evt_id)
                    corridor_name = evt.get("corridor", "Regional Corridor")
                    desc = evt.get("description", "")
                    lead = evt.get("lead_time_days", "")
                    sigs = evt.get("key_signals", {})
                    sig_str = ", ".join(f"{k}: {v}" for k, v in sigs.items()) if sigs else "Telemetry active"
                    
                    alerts.append({
                        "id": f"ALERT-CORRIDOR-{evt_id}-{base_date}",
                        "city": f"Corridor ({corridor_name.split('(')[0].strip()})",
                        "alert_type": "CORRIDOR",
                        "severity": "RED" if str_label == "extreme" else ("ORANGE" if str_label == "strong" else "YELLOW"),
                        "title": f"Active Upstream Satellite Corridor: {label}",
                        "message": f"{desc}. Real-time satellite corridor readings: {sig_str}. Estimated lead time to UP: {lead}.",
                        "metric": f"{str_label.upper()} Corridor Signal ({lead})",
                        "date": base_date
                    })
    except Exception as e:
        print(f"Dynamic corridor analysis error: {e}")

    # Filter by alert_type if requested
    if alert_type_filter:
        flt = alert_type_filter.upper()
        alerts = [a for a in alerts if a.get("alert_type") == flt]

    return {
        "base_date": base_date,
        "summary": {
            "total_active_alerts": len(alerts),
            "heat_alerts_count": heat_count,
            "rain_alerts_count": rain_count,
            "wind_alerts_count": wind_count,
            "humidity_alerts_count": humidity_count,
            "corridor_alerts_count": corridor_count
        },
        "alerts": alerts,
        "live_city_updates": city_updates
    }


    # Filter by alert_type if requested
    if alert_type_filter:
        flt = alert_type_filter.upper()
        alerts = [a for a in alerts if a.get("alert_type") == flt]

    return {
        "base_date": base_date,
        "summary": {
            "total_active_alerts": len(alerts),
            "heat_alerts_count": heat_count,
            "rain_alerts_count": rain_count,
            "wind_alerts_count": wind_count,
            "humidity_alerts_count": humidity_count,
            "corridor_alerts_count": corridor_count
        },
        "alerts": alerts,
        "live_city_updates": city_updates
    }

@router.get("/live-update")
@router.get("/live")
async def get_live_updates(
    city: Optional[str] = Query(None, description="Optional city name filter (e.g. Lucknow, Agra)"),
    alert_type: Optional[str] = Query(None, description="Optional alert type filter: HEAT, RAIN, WIND, HUMIDITY, CORRIDOR")
):
    """
    ⚡ Live Updates & Comprehensive Multi-Alert Feed API
    Returns real-time weather updates, dataset refresh status, and all active alerts (Heat, Rain, Wind, Humidity, Satellite Corridors).
    """
    forecasts = get_forecast_data()
    if not forecasts:
        # Fallback to single city dynamic execution if cache unavailable
        fallback_city = city or "Lucknow"
        dyn = generate_city_unified_forecast(fallback_city)
        forecasts = [dyn]

    alert_payload = extract_all_alerts(forecasts, target_city=city, alert_type_filter=alert_type)
    
    return {
        "status": "online",
        "timestamp": datetime.now().isoformat(),
        "base_date": alert_payload["base_date"],
        "total_cities_monitored": len(forecasts),
        "filter": {
            "city": city,
            "alert_type": alert_type
        },
        "summary": alert_payload["summary"],
        "alerts": alert_payload["alerts"],
        "live_city_updates": alert_payload["live_city_updates"],
        "background_task": {
            "status": "ready",
            "last_synced": alert_payload["base_date"],
            "manual_trigger_endpoint": "POST /api/v1/weather/live-update"
        }
    }

@router.post("/live-update")
async def trigger_live_update(background_tasks: BackgroundTasks):
    import sys
    import os
    # Ensure root directory is in sys.path
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    
    import update_latest_weather
    import generate_all_heatscores
    
    def run_update():
        try:
            print("=== Running Manual Live Update ===")
            update_latest_weather.main()
            generate_all_heatscores.generate_all()
            print("=== Live Update Complete ===")
        except Exception as e:
            print(f"Live update failed: {e}")
            
    background_tasks.add_task(run_update)
    return {
        "status": "started",
        "timestamp": datetime.now().isoformat(),
        "message": "Live update process has been started in the background. It will fetch the latest Open-Meteo weather data and regenerate 16-day AI heatwave forecasts."
    }

@router.get("/{city}/current")
async def get_current_weather(city: str):
    """Get the current day's unified weather & heatscore prediction."""
    forecasts = get_forecast_data()
    for f in forecasts:
        if f.get("city", "").lower() == city.lower():
            preds = f.get("forecast", [])
            if preds:
                return {
                    "city": f.get("city"),
                    "base_date": f.get("base_date"),
                    "current": preds[0]
                }
    
    # Fallback to dynamic model execution
    dynamic_f = generate_city_unified_forecast(city)
    preds = dynamic_f.get("forecast", [])
    if not preds:
        raise HTTPException(status_code=404, detail="No forecast data found for city")
    return {
        "city": dynamic_f.get("city"),
        "base_date": dynamic_f.get("base_date"),
        "current": preds[0]
    }

@router.get("/{city}/forecast")
async def get_forecast_weather(city: str):
    """Get the full 16-day unified weather & heatscore prediction."""
    forecasts = get_forecast_data()
    for f in forecasts:
        if f.get("city", "").lower() == city.lower():
            return f
            
    # Fallback to dynamic model execution
    return generate_city_unified_forecast(city)

from data.weather_db import query_city_weather

@router.get("/{city}/previous")
async def get_previous_weather(city: str, date: str = Query(..., description="Date in YYYY-MM-DD format")):
    """Get historical weather data from the dataset."""
    try:
        dt = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
    match_df = query_city_weather(city, start_date=date, end_date=date)
    if match_df.empty:
        # Fallback: query recent weather for that city and pick the closest matching row
        match_df = query_city_weather(city, limit=30)
        
    if match_df.empty:
        raise HTTPException(status_code=404, detail=f"No historical data found for city '{city}' and date '{date}'.")
        
    match_df['Date'] = match_df['Date'].dt.strftime('%Y-%m-%d')
    match_df = match_df.where(pd.notnull(match_df), None)
    return match_df.iloc[0].to_dict()


