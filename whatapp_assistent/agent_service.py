import json
import urllib.request
import urllib.error

from config import config
import weather_service as weather

USER_SESSIONS = {}

def get_user_history(phone_number: str) -> list:
    """Retrieve chat history for a given WhatsApp user phone number."""
    return USER_SESSIONS.get(phone_number, [])

def clear_user_history(phone_number: str):
    """Clear chat history for a given phone number."""
    if phone_number in USER_SESSIONS:
        USER_SESSIONS[phone_number] = []

def append_user_message(phone_number: str, role: str, content: str):
    """Add a message to a user's session history (keeping max 10 messages)."""
    if phone_number not in USER_SESSIONS:
        USER_SESSIONS[phone_number] = []
    USER_SESSIONS[phone_number].append({"role": role, "content": content})
    if len(USER_SESSIONS[phone_number]) > 10:
        USER_SESSIONS[phone_number] = USER_SESSIONS[phone_number][-10:]

try:
    import httpx
except ImportError:
    httpx = None

def call_groq(messages, json_mode=False):
    """Call Groq API using standard Python urllib library (sync compatibility)."""
    if not config.GROQ_API_KEY:
        print("[!] Error: GROQ_API_KEY is not configured.")
        return None
        
    headers = {
        "Authorization": f"Bearer {config.GROQ_API_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "WeatherGPT-WhatsApp-Bot"
    }
    payload = {
        "model": config.GROQ_MODEL,
        "messages": messages,
        "temperature": 0.3 if json_mode else 0.7
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    req = urllib.request.Request(config.GROQ_URL, data=json.dumps(payload).encode('utf-8'), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            data = json.loads(response.read().decode('utf-8'))
            return data["choices"][0]["message"]["content"]
    except urllib.error.URLError as e:
        error_msg = str(e)
        if hasattr(e, 'read'):
            try:
                error_msg = e.read().decode('utf-8')
            except:
                pass
        print(f"\n[!] Groq API Error: {error_msg}")
        return None

async def call_groq_async(messages, json_mode=False):
    """Call Groq API asynchronously using httpx or urllib for Cloudflare Workers."""
    if not config.GROQ_API_KEY:
        print("[!] Error: GROQ_API_KEY is not configured.")
        return None
        
    headers = {
        "Authorization": f"Bearer {config.GROQ_API_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "WeatherGPT-WhatsApp-Bot"
    }
    payload = {
        "model": config.GROQ_MODEL,
        "messages": messages,
        "temperature": 0.3 if json_mode else 0.7
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    try:
        if httpx:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(config.GROQ_URL, json=payload, headers=headers)
                res.raise_for_status()
                data = res.json()
                return data["choices"][0]["message"]["content"]
        else:
            req = urllib.request.Request(config.GROQ_URL, data=json.dumps(payload).encode('utf-8'), headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=15) as response:
                data = json.loads(response.read().decode('utf-8'))
                return data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"\n[!] Groq Async API Error: {e}")
        return None



def handle_command(phone_number: str, user_text: str) -> str | None:
    """Check if message is a system command (/start, /help, /menu, /reset)."""
    text = user_text.strip().lower()
    
    if text in ["/start", "/menu", "/help", "menu", "hi", "hello", "start"]:
        return (
            "👋 *Welcome to WeatherGPT AI Assistant!*\n\n"
            "I can assist you with real-time weather forecasts, air quality index, and travel weather advice globally.\n\n"
            "📌 *Quick Ways to Use Me:*\n"
            "• Ask naturally: _\"What is the weather in Tokyo?\"_\n"
            "• Ask forecast: _\"5-day forecast for London\"_\n"
            "• Check Air Quality: _\"Air pollution in Delhi\"_\n"
            "• *Send Location Pin:* Share your live GPS location on WhatsApp for instant weather updates!\n\n"
            "⚙️ *Commands:*\n"
            "• `/menu` - Show main menu\n"
            "• `/reset` - Clear chat history context"
        )
        
    if text in ["/reset", "reset", "/clear", "clear"]:
        clear_user_history(phone_number)
        return "🧹 *Chat context reset!* Ask me a new question about any city or share your location."

    return None

def handle_location_message(phone_number: str, lat: float, lon: float) -> str:
    """Process a WhatsApp GPS location pin sent by the user (sync)."""
    try:
        geo_info = weather.get_reverse_geocoding(lat, lon)
        city_name = geo_info[0]["name"] if geo_info else f"Location ({round(lat, 2)}, {round(lon, 2)})"
        
        weather_data = weather.get_current_weather_by_coords(lat, lon)
        weather_card = weather.format_weather_card(weather_data)
        
        try:
            aqi_data = weather.get_air_pollution(lat, lon)
            aqi_val = aqi_data["list"][0]["main"]["aqi"]
            aqi_labels = {1: "Good 🟢", 2: "Fair 🟡", 3: "Moderate 🟠", 4: "Poor 🔴", 5: "Very Poor 🟣"}
            aqi_str = f"\n🍃 *AQI Level:* {aqi_val} ({aqi_labels.get(aqi_val, 'Unknown')})"
        except:
            aqi_str = ""

        reply = (
            f"📍 *Weather Report for Pinned Location*\n\n"
            f"{weather_card}"
            f"{aqi_str}\n\n"
            f"💡 _Need a 5-day forecast for {city_name}? Just reply \"5-day forecast\"._"
        )
        
        append_user_message(phone_number, "user", f"[Sent Location Pin: {city_name}]")
        append_user_message(phone_number, "assistant", reply)
        return reply
        
    except Exception as e:
        print(f"[!] Error handling location pin: {e}")
        return "⚠️ *Location Error:* Could not fetch weather for the provided location. Please try sending a city name instead."

async def handle_location_message_async(phone_number: str, lat: float, lon: float) -> str:
    """Process a WhatsApp GPS location pin sent by the user asynchronously."""
    try:
        geo_info = await weather.get_reverse_geocoding_async(lat, lon)
        city_name = geo_info[0]["name"] if geo_info else f"Location ({round(lat, 2)}, {round(lon, 2)})"
        
        weather_data = await weather.get_current_weather_by_coords_async(lat, lon)
        weather_card = weather.format_weather_card(weather_data)
        
        try:
            aqi_data = await weather.get_air_pollution_async(lat, lon)
            aqi_val = aqi_data["list"][0]["main"]["aqi"]
            aqi_labels = {1: "Good 🟢", 2: "Fair 🟡", 3: "Moderate 🟠", 4: "Poor 🔴", 5: "Very Poor 🟣"}
            aqi_str = f"\n🍃 *AQI Level:* {aqi_val} ({aqi_labels.get(aqi_val, 'Unknown')})"
        except:
            aqi_str = ""

        reply = (
            f"📍 *Weather Report for Pinned Location*\n\n"
            f"{weather_card}"
            f"{aqi_str}\n\n"
            f"💡 _Need a 5-day forecast for {city_name}? Just reply \"5-day forecast\"._"
        )
        
        append_user_message(phone_number, "user", f"[Sent Location Pin: {city_name}]")
        append_user_message(phone_number, "assistant", reply)
        return reply
        
    except Exception as e:
        print(f"[!] Error handling location pin: {e}")
        return "⚠️ *Location Error:* Could not fetch weather for the provided location. Please try sending a city name instead."

def classify_intent(user_input: str, chat_history: list) -> dict:
    """Classify user query intent into current, forecast, pollution, or general."""
    history_context = "\n".join([f"{msg['role']}: {msg['content']}" for msg in chat_history[-4:]])
    
    system_prompt = """You are an intent classifier for a WhatsApp weather chatbot.
Analyze the user's message and recent chat history to determine intent.

Allowed intents:
- "current": User wants current weather.
- "forecast": User wants 5-day or upcoming weather forecast.
- "pollution": User wants air pollution or AQI data.
- "general": User is greeting, chatting, or asking general non-weather questions.

Extract the target 'city'. If not in the latest message, search recent chat history. Return null if no city is found.

Return ONLY a valid JSON object:
{
  "intent": "current" | "forecast" | "pollution" | "general",
  "city": "CityName" | null
}
"""
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Chat History:\n{history_context}\n\nLatest User Message: {user_input}"}
    ]
    
    response = call_groq(messages, json_mode=True)
    if not response:
        return {"intent": "general", "city": None}
        
    try:
        clean_resp = response.strip()
        if clean_resp.startswith("```json"):
            clean_resp = clean_resp[7:-3].strip()
        elif clean_resp.startswith("```"):
            clean_resp = clean_resp[3:-3].strip()
            
        return json.loads(clean_resp)
    except json.JSONDecodeError:
        return {"intent": "general", "city": None}

async def classify_intent_async(user_input: str, chat_history: list) -> dict:
    """Classify user query intent asynchronously."""
    history_context = "\n".join([f"{msg['role']}: {msg['content']}" for msg in chat_history[-4:]])
    
    system_prompt = """You are an intent classifier for a WhatsApp weather chatbot.
Analyze the user's message and recent chat history to determine intent.

Allowed intents:
- "current": User wants current weather.
- "forecast": User wants 5-day or upcoming weather forecast.
- "pollution": User wants air pollution or AQI data.
- "general": User is greeting, chatting, or asking general non-weather questions.

Extract the target 'city'. If not in the latest message, search recent chat history. Return null if no city is found.

Return ONLY a valid JSON object:
{
  "intent": "current" | "forecast" | "pollution" | "general",
  "city": "CityName" | null
}
"""
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Chat History:\n{history_context}\n\nLatest User Message: {user_input}"}
    ]
    
    response = await call_groq_async(messages, json_mode=True)
    if not response:
        return {"intent": "general", "city": None}
        
    try:
        clean_resp = response.strip()
        if clean_resp.startswith("```json"):
            clean_resp = clean_resp[7:-3].strip()
        elif clean_resp.startswith("```"):
            clean_resp = clean_resp[3:-3].strip()
            
        return json.loads(clean_resp)
    except json.JSONDecodeError:
        return {"intent": "general", "city": None}

def fetch_weather_context(intent: str, city: str) -> str:
    """Fetch live weather data from OpenWeather and format context string."""
    if not city:
        return ""
        
    try:
        if intent == "current":
            data = weather.get_current_weather(city)
            return f"[Real-time Weather Data]\n{weather.format_weather_card(data)}"
            
        elif intent == "forecast":
            data = weather.get_5_day_forecast(city)
            summary = []
            for item in data['list'][:4]:
                time = item['dt_txt']
                temp = round(item['main']['temp'], 1)
                cond = item['weather'][0]['description'].capitalize()
                summary.append(f"• *{time}*: {temp}°C, {cond}")
            return f"[Real-time Forecast for {city}]\n" + "\n".join(summary)
            
        elif intent == "pollution":
            geo = weather.get_geocoding(city)
            if not geo:
                return f"[Failed] Could not find coordinates for {city}."
            lat, lon = geo[0]['lat'], geo[0]['lon']
            pollution = weather.get_air_pollution(lat, lon)
            return f"[Real-time Air Quality]\n{weather.format_aqi_card(city, pollution)}"
            
    except Exception as e:
        return f"[Error fetching weather data] {str(e)}"
        
    return ""

async def fetch_weather_context_async(intent: str, city: str) -> str:
    """Fetch live weather data from OpenWeather asynchronously."""
    if not city:
        return ""
        
    try:
        if intent == "current":
            data = await weather.get_current_weather_async(city)
            return f"[Real-time Weather Data]\n{weather.format_weather_card(data)}"
            
        elif intent == "forecast":
            data = await weather.get_5_day_forecast_async(city)
            summary = []
            for item in data['list'][:4]:
                time = item['dt_txt']
                temp = round(item['main']['temp'], 1)
                cond = item['weather'][0]['description'].capitalize()
                summary.append(f"• *{time}*: {temp}°C, {cond}")
            return f"[Real-time Forecast for {city}]\n" + "\n".join(summary)
            
        elif intent == "pollution":
            geo = await weather.get_geocoding_async(city)
            if not geo:
                return f"[Failed] Could not find coordinates for {city}."
            lat, lon = geo[0]['lat'], geo[0]['lon']
            pollution = await weather.get_air_pollution_async(lat, lon)
            return f"[Real-time Air Quality]\n{weather.format_aqi_card(city, pollution)}"
            
    except Exception as e:
        return f"[Error fetching weather data] {str(e)}"
        
    return ""

def generate_whatsapp_response(phone_number: str, user_input: str) -> str:
    """Generate a response tailored for WhatsApp messaging (sync)."""
    command_reply = handle_command(phone_number, user_input)
    if command_reply:
        return command_reply

    chat_history = get_user_history(phone_number)
    classification = classify_intent(user_input, chat_history)
    intent = classification.get("intent", "general")
    city = classification.get("city")
    
    context = ""
    if intent != "general":
        if city:
            context = fetch_weather_context(intent, city)
        else:
            context = "[System Context] User requested weather info but specified no city. Ask politely which city they want to check."

    system_prompt = """You are WeatherGPT, a professional executive AI WhatsApp Weather & Climate Assistant.

CRITICAL WHATSAPP UI FORMATTING RULES:
- BOLD: Use SINGLE asterisks like *text* for bold headings, key values, and city names. NEVER use double asterisks (**text**) because WhatsApp UI does NOT support double asterisks.
- ITALIC: Use SINGLE underscores like _text_ for tips, advice, or secondary notes.
- EMOJIS: Use rich, relevant emojis (🌤️, 🌧️, 🌡️, 💨, 🍃, ☂️, ⚡, 📊, 📍, ☀️, ☁️).
- STRUCTURE: Use clean vertical line breaks and spacing to separate sections neatly. NEVER output full-width box lines (like ━ or ─) because they wrap into broken multi-line bars on mobile WhatsApp screens.
- BULLETS: Use bullet points (• ) for lists.
- NO RAW DATA: Never output raw JSON, internal system debug strings, or markdown headers like `#` or `##` (WhatsApp does not render `#` as headers).

CRITICAL LANGUAGE RULES:
- STRICT NO HINGLISH POLICY: NEVER output Hinglish (mixing Hindi and English words together like "bhai", "yaar", "kya", etc.).
- If the user speaks in English, respond strictly in pure English.
- If the user speaks in Hindi, respond strictly in pure Hindi (Devanagari script).
- If the user speaks in any other language, respond strictly in that language.
"""
    messages = [{"role": "system", "content": system_prompt}]
    
    for msg in chat_history[-6:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
        
    final_prompt = user_input
    if context:
        final_prompt += f"\n\n{context}"
        
    messages.append({"role": "user", "content": final_prompt})
    
    reply = call_groq(messages, json_mode=False)
    if not reply:
        reply = "Sorry, I couldn't process your request right now. Please try again in a moment! 🌤️"
        
    append_user_message(phone_number, "user", user_input)
    append_user_message(phone_number, "assistant", reply)
    
    return reply

async def generate_whatsapp_response_async(phone_number: str, user_input: str) -> str:
    """Generate a response tailored for WhatsApp messaging asynchronously."""
    command_reply = handle_command(phone_number, user_input)
    if command_reply:
        return command_reply

    chat_history = get_user_history(phone_number)
    classification = await classify_intent_async(user_input, chat_history)
    intent = classification.get("intent", "general")
    city = classification.get("city")
    
    context = ""
    if intent != "general":
        if city:
            context = await fetch_weather_context_async(intent, city)
        else:
            context = "[System Context] User requested weather info but specified no city. Ask politely which city they want to check."

    system_prompt = """You are WeatherGPT, a professional executive AI WhatsApp Weather & Climate Assistant.

CRITICAL WHATSAPP UI FORMATTING RULES:
- BOLD: Use SINGLE asterisks like *text* for bold headings, key values, and city names. NEVER use double asterisks (**text**) because WhatsApp UI does NOT support double asterisks.
- ITALIC: Use SINGLE underscores like _text_ for tips, advice, or secondary notes.
- EMOJIS: Use rich, relevant emojis (🌤️, 🌧️, 🌡️, 💨, 🍃, ☂️, ⚡, 📊, 📍, ☀️, ☁️).
- STRUCTURE: Use clean vertical line breaks and spacing to separate sections neatly. NEVER output full-width box lines (like ━ or ─) because they wrap into broken multi-line bars on mobile WhatsApp screens.
- BULLETS: Use bullet points (• ) for lists.
- NO RAW DATA: Never output raw JSON, internal system debug strings, or markdown headers like `#` or `##` (WhatsApp does not render `#` as headers).

CRITICAL LANGUAGE RULES:
- STRICT NO HINGLISH POLICY: NEVER output Hinglish (mixing Hindi and English words together like "bhai", "yaar", "kya", etc.).
- If the user speaks in English, respond strictly in pure English.
- If the user speaks in Hindi, respond strictly in pure Hindi (Devanagari script).
- If the user speaks in any other language, respond strictly in that language.
"""
    messages = [{"role": "system", "content": system_prompt}]
    
    for msg in chat_history[-6:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
        
    final_prompt = user_input
    if context:
        final_prompt += f"\n\n{context}"
        
    messages.append({"role": "user", "content": final_prompt})
    
    reply = await call_groq_async(messages, json_mode=False)
    if not reply:
        reply = "Sorry, I couldn't process your request right now. Please try again in a moment! 🌤️"
        
    append_user_message(phone_number, "user", user_input)
    append_user_message(phone_number, "assistant", reply)
    
    return reply

