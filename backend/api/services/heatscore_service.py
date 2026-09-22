import os
import sys
import json

# Use the local model in models/heatscore
from models.heatscore.heatwave_model import HeatwaveModel

_heatwave_model = None
_city_data = None

def get_city_data(city_name: str):
    global _city_data
    if _city_data is None:
        data_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "all_up_cities.json")
        try:
            with open(data_path, "r") as f:
                _city_data = json.load(f).get("cities", [])
        except Exception:
            _city_data = []
            
    for city in _city_data:
        if city.get("name", "").lower() == city_name.lower():
            return city
    return None

def predict_heatscores(city_name: str, forecast_predictions: list):
    global _heatwave_model
    
    city = get_city_data(city_name)
    if not city:
        print(f"City data not found for {city_name}, skipping heatscore prediction.")
        return forecast_predictions
        
    if _heatwave_model is None:
        try:
            _heatwave_model = HeatwaveModel()
            models_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "heatscore")
            if not os.path.exists(models_dir):
                models_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "models", "heatscore")
            _heatwave_model.load_model(models_dir)
        except Exception as e:
            print(f"Failed to load HeatwaveModel: {e}")
            return forecast_predictions
            
    # Calculate static features for the city
    emission_index = (
        city.get("heavy_commercial", 0) * 5.0 +
        city.get("light_commercial", 0) * 3.0 +
        city.get("buses", 0) * 4.0 +
        city.get("four_wheelers_diesel", 0) * 2.0 +
        city.get("four_wheelers_petrol", 0) * 1.5 +
        city.get("two_wheelers", 0) * 1.0 +
        city.get("three_wheelers", 0) * 1.2 +
        city.get("electric_vehicles", 0) * 0.0 +
        city.get("cng_vehicles", 0) * 0.3
    ) / 1_000_000
    
    total_area = city.get("total_area_sqkm", 1)
    built_up_ratio = city.get("built_up_area_sqkm", 0) / total_area
    green_cover_ratio = (city.get("forest_cover_pct", 0) + city.get("urban_green_space_pct", 0)) / 100.0
    water_cover_ratio = city.get("water_bodies_area_sqkm", 0) / total_area
    
    for day_idx, day in enumerate(forecast_predictions):
        # Extract forecast variables
        date_str = day.get("date", "")
        month = 5 # default
        try:
            if "-" in date_str:
                month = int(date_str.split("-")[1])
        except:
            pass
            
        humidity = day.get("Humidity_Mean_pct", 50)
        wind_speed_kmh = day.get("Wind_Speed_Max_kmh", 10)
        wind_speed_ms = wind_speed_kmh * (1000 / 3600)
        temp_max = day.get("Temp_Max_C", 35)
        temp_min = day.get("Temp_Min_C", 25)
        precip = day.get("Precipitation_mm", 0.0)
        
        # Get dynamic confidence from the forecast pipeline
        # This comes from MC dropout + validation metrics + horizon decay
        forecast_confidence = day.get("confidence", None)
        
        features = {
            "precipitation_mm": precip,
            "ndvi": city.get("ndvi_mean", (green_cover_ratio * 0.8) + 0.1),
            "ndwi": city.get("ndwi_mean", water_cover_ratio),
            "ndbi": city.get("ndbi_mean", (built_up_ratio * 0.7) + 0.2),
            "emission_index": emission_index,
            "population_density": city.get("population_density", 5000),
            "built_up_ratio": built_up_ratio,
            "green_cover_ratio": green_cover_ratio,
            "water_cover_ratio": water_cover_ratio,
            "elevation_m": city.get("elevation_m", 100),
            "month": month,
            "humidity_pct": humidity,
            "wind_speed_ms": wind_speed_ms,
            "avg_building_height": city.get("avg_building_height_m", 12.0),
            "urban_canyon_index": city.get("urban_canyon_index", 0.5),
            "industrial_heat_factor": city.get("industrial_heat_factor", 0.1),
            "ac_thermal_exhaust": city.get("ac_thermal_exhaust_index", 0.2),
            "lst_day_mean": temp_max,
            "lst_night_mean": temp_min,
            "viirs_avg_radiance": (built_up_ratio * 100) + 10,
            # Pass the dynamic confidence through to the heatscore model
            "confidence_score": forecast_confidence,
        }
        
        try:
            prediction = _heatwave_model.predict_city(features)
            day["heat_risk_score"] = prediction.get("heat_risk_score", 0)
            day["heat_zone"] = prediction.get("heat_zone", "unknown")
            driver = prediction.get("primary_driver")
            if driver and isinstance(driver, dict):
                day["primary_driver"] = driver.get("factor", "unknown")
            else:
                day["primary_driver"] = "unknown"
                
            day["causal_explanation"] = prediction.get("explanation", {}).get("text", "")
            
            # Use dynamic confidence from forecast pipeline (not hardcoded 0.85)
            # Priority: forecast pipeline confidence > heatscore model confidence
            if forecast_confidence is not None:
                day["confidence_score"] = forecast_confidence
            else:
                # Fallback: compute from day index with horizon decay
                day["confidence_score"] = round(0.95 * (0.955 ** day_idx), 3)
        except Exception as e:
            print(f"Error predicting heatscore for {date_str}: {e}")
            day["heat_risk_score"] = None
            day["heat_zone"] = None
            day["primary_driver"] = None
            day["causal_explanation"] = None
            day["confidence_score"] = None
            
    return forecast_predictions
