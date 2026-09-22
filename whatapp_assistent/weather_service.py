import json
import urllib.request
import urllib.error

try:
    import httpx
    HTTP_TIMEOUT = httpx.Timeout(10.0, connect=5.0)
except ImportError:
    httpx = None
    HTTP_TIMEOUT = None

try:
    import requests
except ImportError:
    requests = None

from config import config

def _http_get_json(url: str, timeout: int = 10) -> dict | list:
    """Universal HTTP GET helper using standard library urllib.request."""
    req = urllib.request.Request(url, headers={"User-Agent": "WeatherGPT-Bot"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode('utf-8'))


async def get_current_weather_async(city: str) -> dict:
    """Fetch current weather data for a given city asynchronously."""
    if not httpx:
        return get_current_weather(city)
    url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={config.OPENWEATHER_API_KEY}&units=metric"
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        res = await client.get(url)
        res.raise_for_status()
        return res.json()

async def get_current_weather_by_coords_async(lat: float, lon: float) -> dict:
    """Fetch current weather using latitude and longitude asynchronously."""
    if not httpx:
        return get_current_weather_by_coords(lat, lon)
    url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={config.OPENWEATHER_API_KEY}&units=metric"
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        res = await client.get(url)
        res.raise_for_status()
        return res.json()

async def get_geocoding_async(city: str, limit: int = 1) -> list:
    """Fetch geographical coordinates (lat, lon) for a city name asynchronously."""
    if not httpx:
        return get_geocoding(city, limit)
    url = f"http://api.openweathermap.org/geo/1.0/direct?q={city}&limit={limit}&appid={config.OPENWEATHER_API_KEY}"
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        res = await client.get(url)
        res.raise_for_status()
        return res.json()

async def get_reverse_geocoding_async(lat: float, lon: float, limit: int = 1) -> list:
    """Fetch city name and location info based on coordinates asynchronously."""
    if not httpx:
        return get_reverse_geocoding(lat, lon, limit)
    url = f"http://api.openweathermap.org/geo/1.0/reverse?lat={lat}&lon={lon}&limit={limit}&appid={config.OPENWEATHER_API_KEY}"
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        res = await client.get(url)
        res.raise_for_status()
        return res.json()

async def get_5_day_forecast_async(city: str) -> dict:
    """Fetch 5-day / 3-hour forecast data for a city asynchronously."""
    if not httpx:
        return get_5_day_forecast(city)
    url = f"https://api.openweathermap.org/data/2.5/forecast?q={city}&appid={config.OPENWEATHER_API_KEY}&units=metric"
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        res = await client.get(url)
        res.raise_for_status()
        return res.json()

async def get_5_day_forecast_by_coords_async(lat: float, lon: float) -> dict:
    """Fetch 5-day forecast using latitude and longitude asynchronously."""
    if not httpx:
        return get_5_day_forecast_by_coords(lat, lon)
    url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={config.OPENWEATHER_API_KEY}&units=metric"
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        res = await client.get(url)
        res.raise_for_status()
        return res.json()

async def get_air_pollution_async(lat: float, lon: float) -> dict:
    """Fetch current air pollution data for coordinates asynchronously."""
    if not httpx:
        return get_air_pollution(lat, lon)
    url = f"http://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lon}&appid={config.OPENWEATHER_API_KEY}"
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        res = await client.get(url)
        res.raise_for_status()
        return res.json()

async def get_uv_index_async(lat: float, lon: float) -> dict:
    """Fetch the UV index for coordinates asynchronously."""
    if not httpx:
        return get_uv_index(lat, lon)
    url = f"http://api.openweathermap.org/data/2.5/uvi?lat={lat}&lon={lon}&appid={config.OPENWEATHER_API_KEY}"
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        res = await client.get(url)
        res.raise_for_status()
        return res.json()



def get_current_weather(city: str) -> dict:
    url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={config.OPENWEATHER_API_KEY}&units=metric"
    if requests:
        try:
            res = requests.get(url, timeout=10)
            res.raise_for_status()
            return res.json()
        except Exception:
            pass
    return _http_get_json(url)

def get_current_weather_by_coords(lat: float, lon: float) -> dict:
    url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={config.OPENWEATHER_API_KEY}&units=metric"
    if requests:
        try:
            res = requests.get(url, timeout=10)
            res.raise_for_status()
            return res.json()
        except Exception:
            pass
    return _http_get_json(url)

def get_geocoding(city: str, limit: int = 1) -> list:
    url = f"http://api.openweathermap.org/geo/1.0/direct?q={city}&limit={limit}&appid={config.OPENWEATHER_API_KEY}"
    if requests:
        try:
            res = requests.get(url, timeout=10)
            res.raise_for_status()
            return res.json()
        except Exception:
            pass
    return _http_get_json(url)

def get_reverse_geocoding(lat: float, lon: float, limit: int = 1) -> list:
    url = f"http://api.openweathermap.org/geo/1.0/reverse?lat={lat}&lon={lon}&limit={limit}&appid={config.OPENWEATHER_API_KEY}"
    if requests:
        try:
            res = requests.get(url, timeout=10)
            res.raise_for_status()
            return res.json()
        except Exception:
            pass
    return _http_get_json(url)

def get_5_day_forecast(city: str) -> dict:
    url = f"https://api.openweathermap.org/data/2.5/forecast?q={city}&appid={config.OPENWEATHER_API_KEY}&units=metric"
    if requests:
        try:
            res = requests.get(url, timeout=10)
            res.raise_for_status()
            return res.json()
        except Exception:
            pass
    return _http_get_json(url)

def get_5_day_forecast_by_coords(lat: float, lon: float) -> dict:
    url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={config.OPENWEATHER_API_KEY}&units=metric"
    if requests:
        try:
            res = requests.get(url, timeout=10)
            res.raise_for_status()
            return res.json()
        except Exception:
            pass
    return _http_get_json(url)

def get_air_pollution(lat: float, lon: float) -> dict:
    url = f"http://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lon}&appid={config.OPENWEATHER_API_KEY}"
    if requests:
        try:
            res = requests.get(url, timeout=10)
            res.raise_for_status()
            return res.json()
        except Exception:
            pass
    return _http_get_json(url)

def get_uv_index(lat: float, lon: float) -> dict:
    url = f"http://api.openweathermap.org/data/2.5/uvi?lat={lat}&lon={lon}&appid={config.OPENWEATHER_API_KEY}"
    if requests:
        try:
            res = requests.get(url, timeout=10)
            res.raise_for_status()
            return res.json()
        except Exception:
            pass
    return _http_get_json(url)


def format_weather_card(data: dict) -> str:
    """Generate a clean, executive WhatsApp weather card."""
    city_name = data.get("name", "Target Location")
    country = data.get("sys", {}).get("country", "")
    temp = round(data["main"]["temp"], 1)
    feels_like = round(data["main"]["feels_like"], 1)
    condition = data["weather"][0]["description"].title()
    humidity = data["main"]["humidity"]
    wind_speed = data["wind"]["speed"]
    pressure = data["main"]["pressure"]
    
    location_str = f"*{city_name}, {country}*" if country else f"*{city_name}*"
    
    return (
        f"🌐 {location_str}\n\n"
        f"🌡️ *Temperature:* {temp}°C (Feels like {feels_like}°C)\n"
        f"🌤️ *Condition:* {condition}\n"
        f"💧 *Humidity:* {humidity}%\n"
        f"💨 *Wind Speed:* {wind_speed} m/s\n"
        f"📉 *Pressure:* {pressure} hPa"
    )

def format_aqi_card(city_name: str, aqi_data: dict) -> str:
    """Generate an executive WhatsApp AQI air quality card."""
    aqi_val = aqi_data["list"][0]["main"]["aqi"]
    components = aqi_data["list"][0]["components"]
    pm25 = components.get("pm2_5", "N/A")
    pm10 = components.get("pm10", "N/A")
    no2 = components.get("no2", "N/A")
    
    aqi_scale = {
        1: ("Good 🟢", "Air quality is satisfactory."),
        2: ("Fair 🟡", "Air quality is acceptable."),
        3: ("Moderate 🟠", "Sensitive groups may experience health effects."),
        4: ("Poor 🔴", "Health effects may affect everyone."),
        5: ("Very Poor 🟣", "Serious health risk for everyone.")
    }
    
    status, desc = aqi_scale.get(aqi_val, ("Unknown ⚪", "Air quality data available."))
    
    return (
        f"🍃 *Air Quality Index — {city_name}*\n\n"
        f"📊 *AQI Level:* {aqi_val} ({status})\n"
        f"💬 *Advice:* {desc}\n\n"
        f"🔬 *Key Pollutants:*\n"
        f"• PM2.5: *{pm25} µg/m³*\n"
        f"• PM10: *{pm10} µg/m³*\n"
        f"• NO₂: *{no2} µg/m³*"
    )
