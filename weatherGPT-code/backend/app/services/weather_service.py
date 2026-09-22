import requests
from backend.app.config import config

def get_current_weather(city: str) -> dict:
    """Fetch current weather data for a given city."""
    url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={config.OPENWEATHER_API_KEY}&units=metric"
    response = requests.get(url)
    response.raise_for_status()
    return response.json()

def get_geocoding(city: str, limit: int = 1) -> list:
    """Fetch geographical coordinates (latitude, longitude) for a city name."""
    url = f"http://api.openweathermap.org/geo/1.0/direct?q={city}&limit={limit}&appid={config.OPENWEATHER_API_KEY}"
    response = requests.get(url)
    response.raise_for_status()
    return response.json()

def get_5_day_forecast(city: str) -> dict:
    """Fetch 5-day / 3-hour forecast data for a city."""
    url = f"https://api.openweathermap.org/data/2.5/forecast?q={city}&appid={config.OPENWEATHER_API_KEY}&units=metric"
    response = requests.get(url)
    response.raise_for_status()
    return response.json()

def get_air_pollution(lat: float, lon: float) -> dict:
    """Fetch current air pollution data for coordinates."""
    url = f"http://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lon}&appid={config.OPENWEATHER_API_KEY}"
    response = requests.get(url)
    response.raise_for_status()
    return response.json()

def get_reverse_geocoding(lat: float, lon: float, limit: int = 1) -> list:
    """Fetch city name and info based on coordinates."""
    url = f"http://api.openweathermap.org/geo/1.0/reverse?lat={lat}&lon={lon}&limit={limit}&appid={config.OPENWEATHER_API_KEY}"
    response = requests.get(url)
    response.raise_for_status()
    return response.json()

def get_nearby_cities_weather(lat: float, lon: float, cnt: int = 5) -> dict:
    """Fetch current weather for nearby cities around coordinates."""
    url = f"https://api.openweathermap.org/data/2.5/find?lat={lat}&lon={lon}&cnt={cnt}&appid={config.OPENWEATHER_API_KEY}&units=metric"
    response = requests.get(url)
    response.raise_for_status()
    return response.json()

def get_uv_index(lat: float, lon: float) -> dict:
    """Fetch the UV index for coordinates."""
    url = f"http://api.openweathermap.org/data/2.5/uvi?lat={lat}&lon={lon}&appid={config.OPENWEATHER_API_KEY}"
    response = requests.get(url)
    response.raise_for_status()
    return response.json()

def get_historical_air_pollution(lat: float, lon: float, start: int, end: int) -> dict:
    """Fetch historical air pollution data for coordinates within Unix timestamp range."""
    url = f"http://api.openweathermap.org/data/2.5/air_pollution/history?lat={lat}&lon={lon}&start={start}&end={end}&appid={config.OPENWEATHER_API_KEY}"
    response = requests.get(url)
    response.raise_for_status()
    return response.json()


def get_heatzone_base_url() -> str:
    return getattr(config, "HEATZONE_BASE_URL", "https://heatzone-backend.onrender.com").rstrip("/")

def get_heatzone_health() -> dict:
    """Fetch server health and status from HeatZone backend."""
    try:
        url = f"{get_heatzone_base_url()}/"
        response = requests.get(url, timeout=12)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return {"status": "offline", "error": str(e)}

def get_heatzone_live_update(city: str = None, alert_type: str = None) -> dict:
    """Fetch real-time weather updates and active multi-alert feed from HeatZone backend."""
    try:
        url = f"{get_heatzone_base_url()}/api/v1/live-update"
        params = {}
        if city:
            params["city"] = city
        if alert_type:
            params["alert_type"] = alert_type
        response = requests.get(url, params=params, timeout=12)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return {"status": "error", "error": str(e), "alerts": [], "summary": {}}

def trigger_heatzone_live_update() -> dict:
    """Trigger manual background weather dataset update on HeatZone backend."""
    try:
        url = f"{get_heatzone_base_url()}/api/v1/live-update"
        response = requests.post(url, timeout=12)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return {"status": "failed", "error": str(e)}

def get_heatzone_current_weather(city: str) -> dict:
    """Fetch current day weather, heat risk score (0-100), risk zone, and primary driver from HeatZone backend."""
    try:
        url = f"{get_heatzone_base_url()}/api/v1/weather/{city}/current"
        response = requests.get(url, timeout=12)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return {"city": city, "error": str(e), "current": {}}

def get_heatzone_forecast(city: str) -> dict:
    """Fetch 16-day unified ensemble forecast & heatscores from HeatZone backend."""
    try:
        url = f"{get_heatzone_base_url()}/api/v1/weather/{city}/forecast"
        response = requests.get(url, timeout=12)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return {"city": city, "error": str(e), "forecast": []}

def get_heatzone_previous_weather(city: str, date: str) -> dict:
    """Fetch historical weather record lookup for a city on a specific past date (YYYY-MM-DD)."""
    try:
        url = f"{get_heatzone_base_url()}/api/v1/weather/{city}/previous"
        params = {"date": date}
        response = requests.get(url, params=params, timeout=12)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return {"city": city, "date": date, "error": str(e)}

def get_heatzone_history(city: str, start_date: str = None, end_date: str = None, limit: int = 30) -> dict:
    """Fetch historical daily weather dataset records for a city."""
    try:
        url = f"{get_heatzone_base_url()}/api/v1/history/{city}"
        params = {
            "start_date": start_date or "2026-05-01",
            "end_date": end_date or "2026-05-30"
        }
        response = requests.get(url, params=params, timeout=12)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return {"city": city, "error": str(e), "data": []}

def get_heatzone_context(city: str, date: str = None) -> dict:
    """Fetch Sentinel context weather and upstream corridor signals from HeatZone backend."""
    base_url = get_heatzone_base_url()
    try:
        url = f"{base_url}/api/v1/context/{city}"
        response = requests.get(url, timeout=12)
        if response.status_code == 200:
            return response.json()
    except Exception:
        pass

    try:
        url = f"{base_url}/api/v1/context/india"
        params = {"date": date or "2026-05-15"}
        response = requests.get(url, params=params, timeout=12)
        if response.status_code == 200:
            return response.json()
    except Exception:
        pass

    return {"city": city, "context_signals": {}}

def get_heatzone_sat_model(city: str) -> dict:
    """Fetch spatiotemporal satellite telemetry model analysis and Sentinel-2 indices from HeatZone backend."""
    try:
        url = f"{get_heatzone_base_url()}/api/v1/sat_model/{city}"
        response = requests.get(url, timeout=12)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return {"city": city, "error": str(e)}



from backend.app.services.cities_db import CITIES_DB
from datetime import datetime, timedelta
import random

def generate_ai_interventions(city_id: int, city_name: str, metrics: dict) -> list:
    """Generate dynamic AI interventions based on real metrics."""
    recommendations = []
    
    zone = metrics.get('zone', 'moderate').lower()
    temp = metrics.get('temperature', 35)
    ndvi = metrics.get('ndvi', 0.25)
    vehicle_density = metrics.get('vehicle_density', 5000)
    
    idx = 1
    
    if ndvi < 0.25:
        recommendations.append({
            "id": city_id * 10 + idx,
            "cityId": city_id,
            "category": "Green Cover",
            "title": "Urban Canopy Expansion",
            "description": f"Vegetation cover is critically low (NDVI: {ndvi:.2f}). Initiate immediate planting of drought-resistant shade trees along major arterial roads.",
            "priority": "medium",
            "impact": "Very High",
            "icon": "TreePine",
            "createdAt": datetime.utcnow().isoformat() + "Z"
        })
        idx += 1
    
    if vehicle_density > 12000:
        recommendations.append({
            "id": city_id * 10 + idx,
            "cityId": city_id,
            "category": "Urban Planning",
            "title": "Traffic Thermal Rerouting",
            "description": f"High vehicular exhaust detected ({vehicle_density/1000:.1f}k density). Reroute commercial transport away from the urban canyon center",
            "priority": "medium",
            "impact": "High",
            "icon": "Car",
            "createdAt": datetime.utcnow().isoformat() + "Z"
        })
        idx += 1
        
    if zone in ["high", "extreme"]:
        recommendations.append({
            "id": city_id * 10 + idx,
            "cityId": city_id,
            "category": "Public Health",
            "title": "Emergency Cooling Centers",
            "description": f"Current heat risk zone is {zone.upper()}. Activate public cooling shelters and hydration stations across all vulnerable sectors.",
            "priority": "critical",
            "impact": "Very High",
            "icon": "Droplets",
            "createdAt": datetime.utcnow().isoformat() + "Z"
        })
        idx += 1
        
    if len(recommendations) < 3:
        recommendations.append({
            "id": city_id * 10 + idx,
            "cityId": city_id,
            "category": "Infrastructure",
            "title": "Cool Roof Protocol",
            "description": "Apply high-albedo reflective white coatings on residential roofs to lower surface temperature by 3-5°C.",
            "priority": "medium",
            "impact": "Medium",
            "icon": "Shield",
            "createdAt": datetime.utcnow().isoformat() + "Z"
        })
        idx += 1

    return recommendations

def get_city_dataset(city_id: int) -> dict:
    """Assemble CityDataset payload for the frontend."""
    city_info = next((c for c in CITIES_DB if c.get("id") == city_id), None)
    if not city_info:
        city_info = CITIES_DB[0]
        
    city_name = city_info.get("name")
    
    hz_weather = get_heatzone_current_weather(city_name)
    curr_data = hz_weather.get("current", {})
    
    temp = curr_data.get("Temp_Max_C", 35)
    humidity = curr_data.get("humidity", 50)
    score = curr_data.get("heat_risk_score", 50)
    zone = curr_data.get("heat_zone", "moderate")
    
    ndvi = city_info.get("ndvi", 0.25)
    sat_data = get_heatzone_sat_model(city_name)
    if "local_diagnostics" in sat_data and "ndvi" in sat_data["local_diagnostics"]:
        try:
            ndvi = float(sat_data["local_diagnostics"]["ndvi"])
        except:
            pass

    metrics = {
        "temperature": temp,
        "zone": zone,
        "ndvi": ndvi,
        "vehicle_density": city_info.get("totalVehicles", 10000) / max(city_info.get("builtUpArea", 1), 1)
    }

    recommendations = generate_ai_interventions(city_id, city_name, metrics)
    
    now = datetime.utcnow()
    latest_weather = {
        "id": city_id * 1000,
        "cityId": city_id,
        "cityName": city_name,
        "temperature": temp,
        "feelsLike": temp + 2.5,
        "humidity": humidity,
        "windSpeed": 4.5,
        "pressure": 1008,
        "cloudCover": 25,
        "rainfall": 0,
        "weatherMain": "Clear",
        "weatherDescription": "clear sky",
        "recordedAt": now.isoformat() + "Z"
    }
    
    latest_prediction = {
        "id": city_id * 100,
        "cityId": city_id,
        "cityName": city_name,
        "heatRiskScore": score,
        "heatZone": zone.lower(),
        "temperature": temp,
        "humidity": humidity,
        "vehicleDensity": int(metrics["vehicle_density"]),
        "populationDensity": city_info.get("populationDensity", 2000),
        "greenCoverRatio": 0.2,
        "builtUpRatio": 0.5,
        "ndvi": ndvi,
        "ndwi": 0.12,
        "ndbi": 0.35,
        "emissionIndex": 4.2,
        "urbanCanyonIndex": 0.45,
        "industrialHeatFactor": 0.2,
        "avgBuildingHeight": 12.5,
        "confidenceScore": 0.92,
        "primaryRiskDriver": curr_data.get("primary_driver", "Concrete & Built-up Density"),
        "riskExplanation": curr_data.get("causal_explanation", "High surface thermal absorption detected."),
        "coolingIndex": 0.25,
        "trafficHeatFactor": 850,
        "latitude": city_info.get("latitude", 0),
        "longitude": city_info.get("longitude", 0),
        "predictedAt": now.isoformat() + "Z"
    }

    weather_history = []
    heat_history = []
    
    for i in range(7):
        hours_ago = (6 - i) * 4
        past_time = now - timedelta(hours=hours_ago)
        iso = past_time.isoformat() + "Z"
        
        weather_history.append({
            **latest_weather,
            "id": latest_weather["id"] + i,
            "temperature": temp + (random.random() * 4 - 2),
            "recordedAt": iso
        })
        
        heat_history.append({
            **latest_prediction,
            "id": latest_prediction["id"] + i,
            "heatRiskScore": min(100, max(20, score + (random.random() * 8 - 4))),
            "predictedAt": iso
        })
        
    return {
        "city": city_info,
        "latestWeather": latest_weather,
        "latestPrediction": latest_prediction,
        "recommendations": recommendations,
        "weatherHistory": weather_history,
        "heatHistory": heat_history
    }
