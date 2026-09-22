import json
import time
import urllib.request
import urllib.error
from backend.app.config import config
import backend.app.services.weather_service as weather

def call_groq(messages, json_mode=False, retries=3):
    if not config.GROQ_API_KEY:
        print("[!] Error: GROQ_API_KEY is not configured.")
        return None
        
    headers = {
        "Authorization": f"Bearer {config.GROQ_API_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "WeatherGPT-Agent"
    }
    payload = {
        "model": config.GROQ_MODEL,
        "messages": messages,
        "temperature": 0.3 if json_mode else 0.7
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    for attempt in range(retries):
        req = urllib.request.Request(config.GROQ_URL, data=json.dumps(payload).encode('utf-8'), headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
                return data["choices"][0]["message"]["content"]
        except urllib.error.URLError as e:
            error_msg = str(e)
            if hasattr(e, 'read'):
                try:
                    error_msg = e.read().decode('utf-8')
                except:
                    pass
            print(f"\n[!] Groq API (Attempt {attempt + 1}/{retries}) Error: {error_msg}")
            if ("rate_limit_exceeded" in error_msg or "429" in error_msg) and attempt < retries - 1:
                wait_time = 6 * (attempt + 1)
                print(f"[*] Rate limited by Groq API. Retrying in {wait_time}s...")
                time.sleep(wait_time)
            elif attempt < retries - 1:
                time.sleep(2)
            else:
                return None
    return None

def classify_intent(user_input, chat_history):
    history_context = "\n".join([f"{msg.get('role', 'user')}: {msg.get('content', '')}" for msg in (chat_history or [])[-4:] if isinstance(msg, dict)])
    
    system_prompt = """You are an intent classifier for WeatherGPT with WeatherGPT capabilities.
Analyze the user's latest message and recent chat history to determine their intent and target location/date.

Allowed intents:
- "current": User wants current weather or temperature for a city.
- "heat_risk": User wants heat risk score (0-100), risk zone (LOW/MODERATE/HIGH/EXTREME), primary heat drivers, or heatwave severity.
- "forecast": User wants 5-day or 16-day extended forecast, ensemble predictions, or upcoming heat trend.
- "live_alerts": User wants real-time weather updates, active multi-alert feed (heatwave, rain, wind, humidity, corridor).
- "satellite_telemetry": User wants satellite telemetry, Sentinel-2 indices (NDVI/NDWI/NDBI), or corridor signals.
- "history": User wants historical weather records for a past date (YYYY-MM-DD) or historical trend.
- "pollution": User wants air quality / AQI index / pollution data.
- "agriculture": User (farmer/agronomist) wants crop-weather advisories, pesticide/fertilizer spraying advice, or irrigation planning.
- "aviation": User (pilot/dispatcher) wants aviation weather briefing, wind vectors, visibility, barometric pressure (QNH), or cloud ceiling.
- "cyclone_alert": User (disaster manager/citizen) wants flood, cyclone, or severe weather early warning dissemination and evacuation steps.
- "smart_city": User (city official/urban planner) wants smart city environmental monitoring, heatwave mitigation, or urban heat island analysis.
- "climate_analytics": User (researcher/climatologist) wants 25-year ERA5 historical climate trends, anomaly analysis, or long-term temperature/monsoon dynamics.
- "general": User is casually chatting or asking general non-weather questions.

Extract:
- 'city': Target city name or region (e.g. Lucknow, Agra, Mumbai, Delhi, Odisha, Punjab). Check chat history if not mentioned in latest message. Return null if none found.
- 'date': Target date in YYYY-MM-DD format if user asks about a specific past date or year range. Return null if none.

You MUST return ONLY a valid JSON object matching this schema:
{
  "intent": "current" | "heat_risk" | "forecast" | "live_alerts" | "satellite_telemetry" | "history" | "pollution" | "agriculture" | "aviation" | "cyclone_alert" | "smart_city" | "climate_analytics" | "general",
  "city": "CityName" | null,
  "date": "YYYY-MM-DD" | null
}
"""
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Chat History:\n{history_context}\n\nLatest User Message: {user_input}"}
    ]
    
    response = call_groq(messages, json_mode=True)
    if not response:
        return {"intent": "general", "city": None, "date": None}
        
    try:
        clean_resp = response.strip()
        if clean_resp.startswith("```json"):
            clean_resp = clean_resp[7:-3].strip()
        elif clean_resp.startswith("```"):
            clean_resp = clean_resp[3:-3].strip()
            
        res = json.loads(clean_resp)
        if "intent" not in res:
            res["intent"] = "general"
        if "city" not in res:
            res["city"] = None
        if "date" not in res:
            res["date"] = None
        return res
    except json.JSONDecodeError:
        print(f"\n[!] Failed to parse classifier JSON: {response}")
        return {"intent": "general", "city": None, "date": None}

def check_voice_interruption(spoken_text: str, currently_speaking_text: str) -> bool:
    """Uses a fast LLM call to determine if the user is trying to interrupt the TTS."""
    if not spoken_text:
        return False
        
    system_prompt = """You are an ultra-fast interruption classifier for a voice assistant.
The assistant is currently speaking. The microphone just picked up some audio.
Your ONLY job is to determine if the user is genuinely trying to interrupt the assistant (e.g., asking a new question, saying 'stop', disagreeing, or changing the subject).
If the audio looks like background noise, random mumbling, or an exact echo/fragment of what the assistant is currently saying, you should classify it as NOT an interruption.

Output ONLY a valid JSON object:
{
  "is_interruption": true/false
}
"""
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Assistant is currently saying: '{currently_speaking_text}'\n\nMicrophone just heard: '{spoken_text}'\n\nIs this an interruption?"}
    ]
    
    response = call_groq(messages, json_mode=True, retries=1)
    if not response:
        return False
        
    try:
        clean_resp = response.strip()
        if clean_resp.startswith("```json"):
            clean_resp = clean_resp[7:-3].strip()
        elif clean_resp.startswith("```"):
            clean_resp = clean_resp[3:-3].strip()
            
        res = json.loads(clean_resp)
        return res.get("is_interruption", False)
    except Exception as e:
        print(f"[!] Failed to parse interruption classifier JSON: {e}")
        return False

UP_CITIES = {
    "lucknow", "agra", "varanasi", "prayagraj", "kanpur", "gorakhpur", "bareilly",
    "meerut", "aligarh", "jhansi", "noida", "ghaziabad", "ayodhya", "mathura",
    "moradabad", "saharanpur", "sultanpur", "firozabad", "muzaffarnagar", "bijnor",
    "etawah", "unnao", "rae bareli", "rampur", "mirzapur", "ballia", "deoria",
    "jaunpur", "ghazipur", "badaun", "sitapur", "hardoi", "lakhimpur", "shahjahanpur",
    "pilibhit", "sambhal", "amroha", "bulandshahr", "hapur", "baghpat", "shamli",
    "kanpur nagar", "kanpur dehat", "barabanki", "amethi", "pratapgarh", "fatehpur",
    "kaushambi", "banda", "chitrakoot", "hamirpur", "mahoba", "lalitpur", "jalaun",
    "auraiya", "farrukhabad", "kannauj", "mainpuri", "kasganj", "hathras",
    "etah", "basti", "sant kabir nagar", "siddharthnagar", "azamgarh", "mau",
    "chandauli", "bhadohi", "sonbhadra", "kushinagar", "maharajganj", "bahraich",
    "shravasti", "balrampur", "gonda"
}

def is_up_city(city: str) -> bool:
    if not city:
        return False
    return city.strip().lower() in UP_CITIES

def fetch_weather_context(intent, city, date=None):
    if not city and intent not in ["live_alerts", "general"]:
        return ""
        
    print(f"[*] Agent is fetching {intent} data for {city or 'all monitored regions'}...")
    try:
        in_up = is_up_city(city) if city else True
        
        if intent == "current":
            parts = []
            try:
                data = weather.get_current_weather(city)
                temp = data['main']['temp']
                cond = data['weather'][0]['description']
                hum = data['main']['humidity']
                wind = data['wind']['speed']
                parts.append(f"[OpenWeather Data] Current weather in {city}: {temp}°C, {cond}, Humidity: {hum}%, Wind: {wind}m/s.")
            except Exception as e:
                parts.append(f"[OpenWeather Data Status]: {e}")
            
            if in_up:
                try:
                    hz_curr = weather.get_heatzone_current_weather(city)
                    curr_obj = hz_curr.get("current", {})
                    score = curr_obj.get("heat_risk_score")
                    zone = curr_obj.get("heat_zone")
                    driver = curr_obj.get("primary_driver")
                    causal = curr_obj.get("causal_explanation")
                    if score is not None:
                        parts.append(f"[WeatherGPT Data for UP City] Heat Risk Score: {score:.1f}/100 ({str(zone).upper()} Risk Zone). Primary Heat Driver: {driver}. Causal Explanation: {causal}")
                except Exception:
                    pass
                
            return " ".join(parts)
            
        elif intent == "heat_risk":
            if in_up:
                try:
                    hz_curr = weather.get_heatzone_current_weather(city)
                    curr_obj = hz_curr.get("current", {})
                    score = curr_obj.get("heat_risk_score")
                    if score is not None:
                        zone = curr_obj.get("heat_zone", "N/A")
                        driver = curr_obj.get("primary_driver", "N/A")
                        causal = curr_obj.get("causal_explanation", "")
                        temp_max = curr_obj.get("Temp_Max_C", "N/A")
                        temp_min = curr_obj.get("Temp_Min_C", "N/A")
                        rain_prob = curr_obj.get("rain_probability", 0.0)
                        conf = curr_obj.get("confidence_score", 0.95)
                        return (f"[WeatherGPT Heat Risk Model Output for {city}, Uttar Pradesh]\n"
                                f"- Heat Risk Score: {score:.1f}/100\n"
                                f"- Heat Risk Zone: {str(zone).upper()}\n"
                                f"- Predicted Temperature (Max/Min): {temp_max}°C / {temp_min}°C\n"
                                f"- Primary Heat Driver: {driver}\n"
                                f"- Causal Explanation: {causal}\n"
                                f"- Rain Probability: {rain_prob}%\n"
                                f"- Model Confidence: {conf}")
                except Exception as e:
                    pass
            
            try:
                data = weather.get_current_weather(city)
                temp = data['main']['temp']
                cond = data['weather'][0]['description']
                hum = data['main']['humidity']
                return f"[OpenWeather Global Data for {city} (Outside Uttar Pradesh)] Temperature: {temp}°C, Condition: {cond}, Humidity: {hum}%. (Note: WeatherGPT detailed heat risk scores are specially focused on Uttar Pradesh cities)."
            except Exception as e:
                return f"[Error fetching weather for {city}] {e}"
                
        elif intent == "forecast":
            summary = []
            if in_up:
                try:
                    hz_fc = weather.get_heatzone_forecast(city)
                    fc_list = hz_fc.get("forecast", [])
                    if fc_list:
                        summary.append(f"[WeatherGPT 16-Day Unified Ensemble Forecast for {city}, Uttar Pradesh]")
                        for item in fc_list[:5]:
                            d_date = item.get("date")
                            t_max = item.get("Temp_Max_C")
                            t_min = item.get("Temp_Min_C")
                            h_score = item.get("heat_risk_score")
                            h_zone = item.get("heat_zone")
                            summary.append(f"• {d_date}: Max {t_max}°C, Min {t_min}°C | Heat Risk Score: {h_score:.1f} ({h_zone})")
                        return "\n".join(summary)
                except Exception:
                    pass
                
            try:
                data = weather.get_5_day_forecast(city)
                summary.append(f"[OpenWeather 5-Day Forecast for {city}]")
                for item in data['list'][:5]:
                    time = item['dt_txt']
                    temp = item['main']['temp']
                    cond = item['weather'][0]['description']
                    summary.append(f"• {time}: {temp}°C, {cond}")
                return "\n".join(summary)
            except Exception as e:
                return f"[Error fetching forecast data] {e}"

        elif intent == "live_alerts":
            try:
                alerts_data = weather.get_heatzone_live_update(city=city)
                summary_info = alerts_data.get("summary", {})
                alerts_list = alerts_data.get("alerts", [])
                cities_monitored = alerts_data.get("total_cities_monitored", 0)
                
                res_lines = [f"[WeatherGPT Live Weather & Multi-Alert Feed for Uttar Pradesh / Monitored Regions]"]
                res_lines.append(f"Monitored UP Cities: {cities_monitored} | Active Alert Summary: {summary_info}")
                if alerts_list:
                    res_lines.append("Active Alerts:")
                    for alt in alerts_list[:5]:
                        c = alt.get("city", "Regional")
                        atype = alt.get("alert_type")
                        sev = alt.get("severity")
                        msg = alt.get("message")
                        res_lines.append(f"• [{atype} - {sev}] {c}: {msg}")
                else:
                    res_lines.append("No active extreme weather alerts currently active.")
                return "\n".join(res_lines)
            except Exception as e:
                return f"[Error fetching live alerts] {e}"

        elif intent == "satellite_telemetry":
            if in_up:
                try:
                    sat_data = weather.get_heatzone_sat_model(city)
                    corridor = sat_data.get("upstream_corridor_analysis", {})
                    diag = sat_data.get("local_diagnostics", {})
                    met = sat_data.get("meteorological_summary", {})
                    
                    res_lines = [f"[WeatherGPT Sentinel-2 Satellite Telemetry for {city}, Uttar Pradesh]"]
                    if diag:
                        res_lines.append(f"Local Indices: NDVI (Vegetation): {diag.get('ndvi', 'N/A')}, NDWI (Water): {diag.get('ndwi', 'N/A')}, NDBI (Urban Build-up): {diag.get('ndbi', 'N/A')}")
                    if corridor:
                        res_lines.append(f"Upstream Heat Corridor Status: {corridor.get('corridor_summary', 'Monitored')}")
                    if met:
                        res_lines.append(f"Satellite Meteorological Summary: {met}")
                    return "\n".join(res_lines)
                except Exception as e:
                    pass
            
            return f"[Satellite Telemetry] Sentinel-2 satellite corridor telemetry is specialized for Uttar Pradesh regions."

        elif intent == "history":
            if in_up:
                try:
                    if date:
                        record = weather.get_heatzone_previous_weather(city, date)
                        return f"[WeatherGPT Historical Dataset for {city}, Uttar Pradesh on {date}]\nRecord: {record}"
                    else:
                        records = weather.get_heatzone_history(city, limit=5)
                        return f"[WeatherGPT Historical Dataset for {city}, Uttar Pradesh]\nRecent Records: {records}"
                except Exception as e:
                    pass
            
            return f"[Historical Weather] Historical regional dataset is available for Uttar Pradesh cities."

        elif intent == "pollution":
            geo = weather.get_geocoding(city)
            if not geo:
                return f"[Failed] Could not find coordinates for {city}."
            lat, lon = geo[0]['lat'], geo[0]['lon']
            pollution = weather.get_air_pollution(lat, lon)
            aqi = pollution['list'][0]['main']['aqi']
            pm25 = pollution['list'][0]['components']['pm2_5']
            return f"[OpenWeather Air Pollution] Air Quality in {city}: AQI Index {aqi} (1=Good, 5=Very Poor), PM2.5: {pm25} μg/m3."
            
    except Exception as e:
        return f"[Error fetching data] {str(e)}"
        
    return ""

def generate_response(user_input, chat_history):
    classification = classify_intent(user_input, chat_history)
    intent = classification.get("intent", "general")
    city = classification.get("city")
    date = classification.get("date")
    
    context = ""
    if intent != "general":
        if city or intent == "live_alerts":
            context = fetch_weather_context(intent, city, date)
        else:
            context = "[System Context] The user asked for weather or heat risk data but did not provide a city. Ask them which city they mean."
            
    agent_system_prompt = """You are WeatherGPT, an Indian-origin AI weather assistant created by WeatherGPT in India. You act like a helpful, knowledgeable, casual friend texting a buddy—warm, natural, human, and conversational.

SPECIALIZED DOMAIN EXPERTISE & USE-CASE HANDLERS:
1. 🌾 AGRICULTURAL CROP-WEATHER ADVISORY:
   - Provide clear, actionable advice to farmers regarding crop irrigation, pesticide/fertilizer application, sowing/harvesting schedules, and frost/heat protection based on rainfall probability, humidity, and wind speed.
2. ✈️ AVIATION WEATHER BRIEFING:
   - Format briefings professionally with wind velocity (knots/m-s), visibility (meters/km), cloud ceiling/base, barometric altimeter pressure (QNH in hPa), surface temperature, and convective thunderstorm hazards.
3. 🚨 FLOOD & CYCLONE EARLY WARNING DISSEMINATION:
   - Provide immediate hazard alerts, cyclone track updates, estimated rainfall intensity, wind gust severity, and emergency evacuation/disaster response protocols for citizens and disaster managers.
4. 🏙️ SMART CITY WEATHER & URBAN ENVIRONMENTAL MONITORING:
   - Provide real-time Air Quality Index (AQI PM2.5, PM10, NO2), urban heat island risk scores (0-100), and urban heat mitigation measures (cool roofs, shade corridors, misting fans, vehicular traffic advisories).
5. 📊 CLIMATE ANALYTICS FOR RESEARCHERS:
   - Provide authoritative decadal climate trend analysis (2000-2026 ERA5 Reanalysis dataset), temperature anomaly statistics, monsoonal precipitation shift patterns, and atmospheric NetCDF data summaries.

HUMAN CONVERSATIONAL TONE & BRANDING RULES:
- Keep responses natural, human-like, and conversational. Do NOT repeat a robotic disclaimer or identity line at the start of every message.
- If asked who you are, who created you, or about your origin, state naturally that you are WeatherGPT, an Indian-origin AI created by WeatherGPT.
- Do NOT mention "Render", "Render server", or technical server infrastructure details. Simply attribute data and models to WeatherGPT.
- For cities in Uttar Pradesh (UP, India) such as Lucknow, Agra, Varanasi, Prayagraj, Kanpur, etc., seamlessly incorporate WeatherGPT heat risk scores (0-100), risk zones, primary drivers, 16-day forecasts, satellite telemetry, and alerts.
- Specialized urban heat/rainfall mitigation suggestions are tailored for Indian cities and urban contexts.
- For cities outside Uttar Pradesh or general weather inquiries, use real-time OpenWeather API & ERA5 climate data seamlessly.

CRITICAL LANGUAGE RULES:
- STRICT NO HINGLISH POLICY: NEVER output Hinglish (mixing Hindi and English words together, e.g. "bhai", "yaar", "kya", etc.).
- If the user speaks in English, respond strictly in 100% pure English. No Hindi or slang words allowed.
- If the user speaks in Hindi, respond strictly in 100% pure Hindi (written in Devanagari script).
- If the user speaks in any other language, respond strictly in that target language.
- Never mix languages into Hinglish. Keep English responses pure English so speech synthesis can pronounce it clearly.
"""
    messages = [{"role": "system", "content": agent_system_prompt}]
    
    for msg in (chat_history or [])[-6:]:
        if isinstance(msg, dict) and msg.get("content"):
            messages.append({"role": msg.get("role", "user"), "content": str(msg.get("content", ""))})
        
    final_user_content = user_input
    if context:
        final_user_content += f"\n\n{context}"
        
    messages.append({"role": "user", "content": final_user_content})
    
    return call_groq(messages, json_mode=False)

def generate_session_title(user_input: str) -> str:
    """Generate a short 3-5 word title for a chat session based on user prompt."""
    if not user_input or not user_input.trim() if hasattr(user_input, 'trim') else not str(user_input).strip():
        return "New Weather Chat"
        
    system_prompt = """You are a session title generator for a weather AI chat application.
Generate a short, highly relevant 3 to 5 word title summarizing the conversation topic.
Rules:
- Do NOT use quotation marks.
- Do NOT add prefixes like "Title:".
- Keep it concise, descriptive, and human-friendly (e.g. "London Weekend Weather", "Tokyo Air Quality Check", "Rain Forecast Inquiry").
- Return ONLY the 3-5 word title string.
"""
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": str(user_input)}
    ]
    try:
        title = call_groq(messages, json_mode=False)
        if title:
            clean_title = title.strip().strip('"').strip("'")
            if len(clean_title) > 40:
                clean_title = clean_title[:40] + "..."
            return clean_title
    except Exception as e:
        print(f"[!] Title generation error: {e}")
        
    words = str(user_input).strip().split()
    fallback = " ".join(words[:4]).capitalize()
    return fallback if fallback else "New Weather Chat"

