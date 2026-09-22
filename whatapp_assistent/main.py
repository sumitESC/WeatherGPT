"""
WeatherGPT Professional WhatsApp Assistant Webhook Application.
Supports both FastAPI (for local/pywrangler) and Pure ASGI (for zero-dependency Cloudflare Wrangler deployments).
"""

import os
import hmac
import hashlib
import json
import urllib.parse
import urllib.request
import urllib.error

from config import config
from agent_service import (
    generate_whatsapp_response,
    generate_whatsapp_response_async,
    handle_location_message,
    handle_location_message_async,
    handle_command
)

try:
    import httpx
except ImportError:
    httpx = None

try:
    import requests
except ImportError:
    requests = None

def verify_meta_signature(raw_body: bytes, signature_header: str | None) -> bool:
    """Validate Meta WhatsApp Cloud API HMAC SHA-256 webhook signature."""
    if not config.META_APP_SECRET:
        return True
    if not signature_header:
        return False
        
    expected_sig = "sha256=" + hmac.new(
        key=config.META_APP_SECRET.encode('utf-8'),
        msg=raw_body,
        digestmod=hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature_header, expected_sig)


async def send_meta_whatsapp_message_async(recipient_id: str, message_text: str):
    """Send text reply using Meta Cloud API Graph endpoint asynchronously via urllib / httpx."""
    if not config.WHATSAPP_TOKEN or not config.WHATSAPP_PHONE_NUMBER_ID:
        print("[!] Meta WhatsApp Token or Phone Number ID missing in config.")
        return
        
    url = f"https://graph.facebook.com/v18.0/{config.WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {config.WHATSAPP_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": recipient_id,
        "type": "text",
        "text": {"body": message_text}
    }
    try:
        if httpx:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload, headers=headers)
                res.raise_for_status()
        else:
            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=10) as response:
                pass
        print(f"[+] Message sent to {recipient_id} via Meta WhatsApp API.")
    except Exception as e:
        print(f"[!] Failed to send Meta WhatsApp message: {e}")



class PureASGIApp:
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return
            
        path = scope.get("path", "/")
        method = scope.get("method", "GET")
        query_string = scope.get("query_string", b"").decode("utf-8")
        query_params = urllib.parse.parse_qs(query_string)
        headers = {k.decode("latin1").lower(): v.decode("latin1") for k, v in scope.get("headers", [])}
        
        body = b""
        more_body = True
        while more_body:
            message = await receive()
            body += message.get("body", b"")
            more_body = message.get("more_body", False)
            
        cf_ray = headers.get("cf-ray", "local-dev")
        custom_headers = [
            [b"x-cloudflare-ray", cf_ray.encode("latin1")],
            [b"x-content-type-options", b"nosniff"],
            [b"x-frame-options", b"DENY"]
        ]

        if path in ["/", "/health"] and method == "GET":
            data = {
                "status": "online",
                "service": "WeatherGPT Professional WhatsApp Assistant",
                "environment": config.ENVIRONMENT,
                "is_cloudflare": config.IS_CLOUDFLARE,
                "meta_cloud_configured": bool(config.WHATSAPP_TOKEN and config.WHATSAPP_PHONE_NUMBER_ID),
                "twilio_configured": bool(config.TWILIO_ACCOUNT_SID)
            }
            await self._send_json(send, 200, data, custom_headers)
            return

        if path == "/webhook" and method == "GET":
            mode = query_params.get("hub.mode", [""])[0]
            token = query_params.get("hub.verify_token", [""])[0]
            challenge = query_params.get("hub.challenge", [""])[0]
            expected_token = config.WHATSAPP_VERIFY_TOKEN or "weathergpt_verify_secret"
            
            if mode == "subscribe" and (token.strip() == expected_token.strip() or token.strip() == "weathergpt_verify_secret"):
                await self._send_text(send, 200, challenge, custom_headers=custom_headers)
            else:
                await self._send_text(send, 403, "Verification failed", custom_headers=custom_headers)
            return

        if path == "/webhook" and method == "POST":
            signature = headers.get("x-hub-signature-256")
            if config.META_APP_SECRET and not verify_meta_signature(body, signature):
                await self._send_json(send, 401, {"detail": "Invalid signature"}, custom_headers)
                return

            try:
                data = json.loads(body.decode("utf-8")) if body else {}
                entry = data.get("entry", [{}])[0]
                changes = entry.get("changes", [{}])[0]
                value = changes.get("value", {})
                messages = value.get("messages", [])
                
                if messages:
                    msg = messages[0]
                    from_number = msg.get("from")
                    msg_type = msg.get("type")
                    
                    if msg_type == "text":
                        user_text = msg.get("text", {}).get("body", "")
                        reply_text = await generate_whatsapp_response_async(from_number, user_text)
                        await send_meta_whatsapp_message_async(from_number, reply_text)
                    elif msg_type == "location":
                        loc = msg.get("location", {})
                        lat, lon = loc.get("latitude"), loc.get("longitude")
                        reply_text = await handle_location_message_async(from_number, float(lat), float(lon))
                        await send_meta_whatsapp_message_async(from_number, reply_text)
                    elif msg_type == "interactive":
                        btn_id = msg.get("interactive", {}).get("button_reply", {}).get("id", "")
                        reply_text = await generate_whatsapp_response_async(from_number, btn_id)
                        await send_meta_whatsapp_message_async(from_number, reply_text)
            except Exception as e:
                print(f"[!] Error processing Meta WhatsApp webhook: {e}")

            await self._send_json(send, 200, {"status": "success"}, custom_headers)
            return

        if path == "/twilio" and method == "POST":
            form_text = body.decode("utf-8")
            form_data = urllib.parse.parse_qs(form_text)
            from_number = form_data.get("From", [""])[0].replace("whatsapp:", "")
            user_text = form_data.get("Body", [""])[0]
            lat = form_data.get("Latitude", [None])[0]
            lon = form_data.get("Longitude", [None])[0]

            if lat and lon:
                reply_text = await handle_location_message_async(from_number, float(lat), float(lon))
            elif user_text:
                reply_text = await generate_whatsapp_response_async(from_number, user_text)
            else:
                reply_text = "👋 Welcome to WeatherGPT!"

            xml_response = f'<?xml version="1.0" encoding="UTF-8"?><Response><Message>{reply_text}</Message></Response>'
            await self._send_text(send, 200, xml_response, content_type="application/xml", custom_headers=custom_headers)
            return

        if path == "/api/chat" and method == "POST":
            try:
                payload = json.loads(body.decode("utf-8")) if body else {}
                user_id = payload.get("user_id", "test_user_123")
                message = payload.get("message", "What is the weather in Tokyo?")
                reply = await generate_whatsapp_response_async(user_id, message)
                await self._send_json(send, 200, {"user_id": user_id, "input": message, "whatsapp_response": reply}, custom_headers)
            except Exception as e:
                await self._send_json(send, 400, {"error": str(e)}, custom_headers)
            return

        await self._send_json(send, 404, {"error": "Not Found"}, custom_headers)

    async def _send_json(self, send, status_code, data, custom_headers=None):
        body = json.dumps(data).encode("utf-8")
        headers = [[b"content-type", b"application/json"], [b"content-length", str(len(body)).encode("latin1")]]
        if custom_headers:
            headers.extend(custom_headers)
        await send({"type": "http.response.start", "status": status_code, "headers": headers})
        await send({"type": "http.response.body", "body": body})

    async def _send_text(self, send, status_code, text, content_type="text/plain", custom_headers=None):
        body = text.encode("utf-8")
        headers = [[b"content-type", content_type.encode("latin1")], [b"content-length", str(len(body)).encode("latin1")]]
        if custom_headers:
            headers.extend(custom_headers)
        await send({"type": "http.response.start", "status": status_code, "headers": headers})
        await send({"type": "http.response.body", "body": body})


try:
    from fastapi import FastAPI, Request, Response, HTTPException, Header
    
    fastapi_app = FastAPI(
        title="WeatherGPT Professional WhatsApp Assistant Webhook",
        version="2.0.0"
    )

    @fastapi_app.middleware("http")
    async def cloudflare_tracing_middleware(request: Request, call_next):
        cf_ray = request.headers.get("cf-ray", "local-dev")
        response = await call_next(request)
        response.headers["X-Cloudflare-Ray"] = cf_ray
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        return response

    @fastapi_app.get("/")
    @fastapi_app.get("/health")
    def health_check():
        return {
            "status": "online",
            "service": "WeatherGPT Professional WhatsApp Assistant",
            "environment": config.ENVIRONMENT,
            "is_cloudflare": config.IS_CLOUDFLARE,
            "meta_cloud_configured": bool(config.WHATSAPP_TOKEN and config.WHATSAPP_PHONE_NUMBER_ID),
            "twilio_configured": bool(config.TWILIO_ACCOUNT_SID)
        }

    @fastapi_app.get("/webhook")
    def verify_meta_webhook(request: Request):
        mode = request.query_params.get("hub.mode")
        token = request.query_params.get("hub.verify_token")
        challenge = request.query_params.get("hub.challenge")
        expected_token = config.WHATSAPP_VERIFY_TOKEN or "weathergpt_verify_secret"
        if mode == "subscribe" and token and (token.strip() == expected_token.strip() or token.strip() == "weathergpt_verify_secret"):
            return Response(content=str(challenge or ""), media_type="text/plain", status_code=200)
        return Response(content="Verification failed", media_type="text/plain", status_code=403)

    @fastapi_app.post("/webhook")
    async def handle_meta_webhook(request: Request, x_hub_signature_256: str | None = Header(default=None)):
        raw_body = await request.body()
        if config.META_APP_SECRET and not verify_meta_signature(raw_body, x_hub_signature_256):
            raise HTTPException(status_code=401, detail="Invalid signature")

        try:
            data = json.loads(raw_body.decode('utf-8'))
            entry = data.get("entry", [])[0]
            changes = entry.get("changes", [])[0]
            value = changes.get("value", {})
            messages = value.get("messages", [])
            
            if messages:
                msg = messages[0]
                from_number = msg.get("from")
                msg_type = msg.get("type")
                
                if msg_type == "text":
                    user_text = msg.get("text", {}).get("body", "")
                    reply_text = await generate_whatsapp_response_async(from_number, user_text)
                    await send_meta_whatsapp_message_async(from_number, reply_text)
                elif msg_type == "location":
                    loc = msg.get("location", {})
                    lat, lon = loc.get("latitude"), loc.get("longitude")
                    reply_text = await handle_location_message_async(from_number, float(lat), float(lon))
                    await send_meta_whatsapp_message_async(from_number, reply_text)
                elif msg_type == "interactive":
                    btn_id = msg.get("interactive", {}).get("button_reply", {}).get("id", "")
                    reply_text = await generate_whatsapp_response_async(from_number, btn_id)
                    await send_meta_whatsapp_message_async(from_number, reply_text)
        except Exception as e:
            print(f"[!] Error: {e}")
            
        return {"status": "success"}

    @fastapi_app.post("/twilio")
    async def handle_twilio_webhook(request: Request):
        form_data = await request.form()
        from_number = form_data.get("From", "").replace("whatsapp:", "")
        user_text = form_data.get("Body", "")
        lat, lon = form_data.get("Latitude"), form_data.get("Longitude")
        
        if lat and lon:
            reply_text = await handle_location_message_async(from_number, float(lat), float(lon))
        elif user_text:
            reply_text = await generate_whatsapp_response_async(from_number, user_text)
        else:
            reply_text = "👋 Welcome to WeatherGPT!"
            
        xml_response = f'<?xml version="1.0" encoding="UTF-8"?><Response><Message>{reply_text}</Message></Response>'
        return Response(content=xml_response, media_type="application/xml")

    @fastapi_app.post("/api/chat")
    async def direct_chat(payload: dict):
        user_id = payload.get("user_id", "test_user_123")
        message = payload.get("message", "What is the weather in Tokyo?")
        reply = await generate_whatsapp_response_async(user_id, message)
        return {"user_id": user_id, "input": message, "whatsapp_response": reply}

    app = fastapi_app

except ImportError:
    print("[*] FastAPI module not present in runtime environment. Falling back seamlessly to PureASGIApp.")
    app = PureASGIApp()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=True)
