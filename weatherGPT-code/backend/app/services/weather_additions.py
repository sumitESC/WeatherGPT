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
            "description": "NDVI is extremely low. Initiate aggressive planting of heat-resilient shade trees along major pedestrian corridors.",
            "priority": "critical",
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
            "description": f"High vehicle density ({vehicle_density} vehicles/km²) is compounding the urban heat island effect. Implement staggered commercial transport timings.",
            "priority": "high",
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
