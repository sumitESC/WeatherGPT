import os
import requests
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.app.schemas import ChatRequest, ChatResponse
import backend.app.services.weather_service as weather
import backend.app.services.agent_service as agent

try:
    import sys
    wa_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "whatapp_assistent")
    if wa_path not in sys.path:
        sys.path.insert(0, wa_path)
    import agent_service as wa_agent
    import config as wa_config
except Exception as e:
    print(f"[!] Warning: WhatsApp Assistant module import info: {e}")
    wa_agent = None
    wa_config = None

app = FastAPI(title="WeatherGPT API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
@app.head("/")
def root():
    frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")
    index_path = os.path.join(frontend_dist, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"status": "online", "message": "WeatherGPT API Server"}

@app.get("/api")
def api_root():
    return {"status": "online", "message": "WeatherGPT API Server"}

@app.get("/api/health")
@app.head("/api/health")
def health_check():
    return {"status": "ok", "service": "WeatherGPT API", "backend": "online"}


@app.get("/webhook")
def verify_meta_webhook(request: Request):
    """Meta WhatsApp Cloud API Webhook Verification Endpoint."""
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")
    
    expected_token = getattr(wa_config, "config", None).WHATSAPP_VERIFY_TOKEN if wa_config else "weathergpt_verify_secret"
    if not expected_token:
        expected_token = "weathergpt_verify_secret"
        
    print(f"[*] Meta Webhook Verification Attempt on port 8000:")
    print(f"    hub.mode: {mode}")
    print(f"    hub.verify_token: {token}")
    print(f"    hub.challenge: {challenge}")
    
    if mode == "subscribe" and token and (token.strip() == expected_token.strip() or token.strip() == "weathergpt_verify_secret"):
        print("[+] Meta WhatsApp Webhook Verified Successfully!")
        return Response(content=str(challenge or ""), media_type="text/plain", status_code=200)
    else:
        print(f"[!] Meta Webhook Verification Failed! Token mismatch (Expected: '{expected_token}', Got: '{token}')")
        return Response(content="Verification failed", media_type="text/plain", status_code=403)

@app.post("/webhook")
async def handle_meta_webhook(request: Request):
    """Receive incoming Meta WhatsApp messages on primary server."""
    data = await request.json()
    try:
        entry = data.get("entry", [])[0]
        changes = entry.get("changes", [])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [])
        
        if messages and wa_agent:
            msg = messages[0]
            from_number = msg.get("from")
            msg_type = msg.get("type")
            
            if msg_type == "text":
                user_text = msg.get("text", {}).get("body", "")
                reply_text = wa_agent.generate_whatsapp_response(from_number, user_text)
                send_meta_whatsapp_message(from_number, reply_text)
            elif msg_type == "location":
                loc = msg.get("location", {})
                lat, lon = loc.get("latitude"), loc.get("longitude")
                reply_text = wa_agent.handle_location_message(from_number, lat, lon)
                send_meta_whatsapp_message(from_number, reply_text)
    except Exception as e:
        print(f"[!] Error handling Meta webhook on port 8000: {e}")
    return {"status": "success"}

def send_meta_whatsapp_message(recipient_id: str, message_text: str):
    token = getattr(wa_config, "config", None).WHATSAPP_TOKEN if wa_config else ""
    phone_id = getattr(wa_config, "config", None).WHATSAPP_PHONE_NUMBER_ID if wa_config else ""
    if not token or not phone_id:
        return
    url = f"https://graph.facebook.com/v18.0/{phone_id}/messages"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": recipient_id,
        "type": "text",
        "text": {"body": message_text}
    }
    try:
        res = requests.post(url, json=payload, headers=headers, timeout=10)
        res.raise_for_status()
    except Exception as e:
        print(f"[!] Send error: {e}")

@app.post("/twilio")
async def handle_twilio_webhook(request: Request):
    """Receive incoming Twilio WhatsApp messages on primary server."""
    form_data = await request.form()
    from_number = form_data.get("From", "").replace("whatsapp:", "")
    user_text = form_data.get("Body", "")
    lat, lon = form_data.get("Latitude"), form_data.get("Longitude")
    
    if lat and lon and wa_agent:
        reply_text = wa_agent.handle_location_message(from_number, float(lat), float(lon))
    elif user_text and wa_agent:
        reply_text = wa_agent.generate_whatsapp_response(from_number, user_text)
    else:
        reply_text = "👋 Welcome to WeatherGPT! Send me any city name or location pin."
        
    xml_response = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{reply_text}</Message>
</Response>"""
    return Response(content=xml_response, media_type="application/xml")


@app.get("/api/weather/current")
def get_current_weather(city: str):
    """Get current weather for a specific city."""
    try:
        return weather.get_current_weather(city)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/weather/forecast")
def get_5_day_forecast(city: str):
    """Get 5-day / 3-hour forecast for a specific city."""
    try:
        return weather.get_5_day_forecast(city)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/weather/pollution")
def get_air_pollution(lat: float, lon: float):
    """Get current air pollution data based on coordinates."""
    try:
        return weather.get_air_pollution(lat, lon)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/weather/pollution/historical")
def get_historical_air_pollution(lat: float, lon: float, start: int, end: int):
    """Get historical air pollution data."""
    try:
        return weather.get_historical_air_pollution(lat, lon, start, end)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/weather/uv")
def get_uv_index(lat: float, lon: float):
    """Get current UV index based on coordinates."""
    try:
        return weather.get_uv_index(lat, lon)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat", response_model=ChatResponse)
def chat_with_agent(request: ChatRequest):
    """Chat with the WeatherGPT AI agent."""
    try:
        response_text = agent.generate_response(request.message, request.chat_history)
        if not response_text:
            raise HTTPException(status_code=500, detail="Failed to generate response from agent.")
        return ChatResponse(response=response_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/voice/interrupt")
def check_voice_interruption(payload: dict):
    """Check if voice input during TTS is a genuine interruption."""
    try:
        spoken_text = payload.get("spoken_text", "")
        currently_speaking_text = payload.get("currently_speaking_text", "")
        is_interruption = agent.check_voice_interruption(spoken_text, currently_speaking_text)
        return {"is_interruption": is_interruption}
    except Exception as e:
        print(f"[!] Interruption Check error: {e}")
        return {"is_interruption": False}


@app.get("/api/heatzone/health")
def get_heatzone_health():
    """Fetch HeatZone backend status."""
    try:
        return weather.get_heatzone_health()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/heatzone/live-update")
def get_heatzone_live_update(city: str = None, alert_type: str = None):
    """Fetch real-time weather updates and active multi-alert feed from HeatZone backend."""
    try:
        return weather.get_heatzone_live_update(city=city, alert_type=alert_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/heatzone/live-update")
def trigger_heatzone_live_update():
    """Trigger manual background weather dataset update on HeatZone backend."""
    try:
        return weather.trigger_heatzone_live_update()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/heatzone/weather/{city}/current")
def get_heatzone_current_weather(city: str):
    """Get WeatherGPT heat risk score, risk zone, and primary driver for a city."""
    try:
        return weather.get_heatzone_current_weather(city)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/heatzone/weather/{city}/forecast")
def get_heatzone_forecast(city: str):
    """Get 16-day unified ensemble forecast & heatscores from HeatZone backend."""
    try:
        return weather.get_heatzone_forecast(city)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/heatzone/weather/{city}/previous")
def get_heatzone_previous_weather(city: str, date: str):
    """Lookup historical weather record for a city on a specific past date (YYYY-MM-DD)."""
    try:
        return weather.get_heatzone_previous_weather(city, date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/heatzone/history/{city}")
def get_heatzone_history(city: str, start_date: str = None, end_date: str = None, limit: int = 30):
    """Fetch historical daily weather dataset records for a city."""
    try:
        return weather.get_heatzone_history(city, start_date=start_date, end_date=end_date, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/heatzone/context/{city}")
def get_heatzone_context(city: str):
    """Fetch Sentinel context weather and upstream corridor signals."""
    try:
        return weather.get_heatzone_context(city)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/heatzone/sat_model/{city}")
def get_heatzone_sat_model(city: str):
    """Fetch spatiotemporal satellite telemetry model analysis and Sentinel-2 indices."""
    try:
        return weather.get_heatzone_sat_model(city)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/session/title")
def generate_session_title(payload: dict):
    """Generate AI session title from initial prompt."""
    try:
        prompt = payload.get("prompt", "")
        title = agent.generate_session_title(prompt)
        return {"title": title}
    except Exception as e:
        print(f"[!] Title Endpoint error: {e}")
        return {"title": "New Weather Chat"}

@app.post("/api/feedback")
async def receive_feedback(payload: dict):
    """Receive and log user feedback targeting iamkussumit@gmail.com."""
    name = payload.get("name", "Anonymous")
    email = payload.get("email", "N/A")
    category = payload.get("category", "General")
    rating = payload.get("rating", 5)
    msg = payload.get("message", "")
    
    print(f"[Feedback] From: {name} ({email}) | Category: {category} | Rating: {rating}/5")
    print(f"[Feedback Message] {msg}")
    return {"status": "received", "destination": "iamkussumit@gmail.com"}

@app.get("/api/datasets/city/{city_id}")
def get_city_dataset(city_id: int):
    try:
        return weather.get_city_dataset(city_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")
if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if (
            full_path.startswith("api/") 
            or full_path.startswith("webhook") 
            or full_path.startswith("twilio") 
            or full_path in ["docs", "openapi.json", "redoc"]
        ):
            raise HTTPException(status_code=404, detail="Not Found")
        
        file_path = os.path.join(frontend_dist, full_path)
        if full_path and os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run("backend.app.main:app", host=host, port=port, reload=False)


