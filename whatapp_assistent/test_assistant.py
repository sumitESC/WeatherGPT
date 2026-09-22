import os
import sys
import io
import json
import hmac
import hashlib
import unittest
import asyncio

if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

from fastapi.testclient import TestClient
from main import app, verify_meta_signature

from config import config
import weather_service as weather
from agent_service import (
    classify_intent,
    fetch_weather_context,
    generate_whatsapp_response,
    handle_location_message,
    generate_whatsapp_response_async
)

class TestWhatsAppAssistant(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_health_check_and_cloudflare_headers(self):
        """Test health check endpoint and Cloudflare headers middleware."""
        response = self.client.get("/health", headers={"cf-ray": "8f88123456789abc-SJC", "cf-connecting-ip": "203.0.113.195"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "online")
        self.assertEqual(data["service"], "WeatherGPT Professional WhatsApp Assistant")
        self.assertIn("X-Cloudflare-Ray", response.headers)
        self.assertEqual(response.headers["X-Cloudflare-Ray"], "8f88123456789abc-SJC")
        print("✅ GET /health & Cloudflare Tracing test passed")

    def test_02_meta_webhook_verification(self):
        """Test Meta WhatsApp webhook verification endpoint."""
        token = config.WHATSAPP_VERIFY_TOKEN or "weathergpt_verify_secret"
        params = {
            "hub.mode": "subscribe",
            "hub.verify_token": token,
            "hub.challenge": "test_challenge_1234"
        }
        res = self.client.get("/webhook", params=params)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.text, "test_challenge_1234")

        bad_params = {
            "hub.mode": "subscribe",
            "hub.verify_token": "wrong_token",
            "hub.challenge": "test_challenge_1234"
        }
        res_fail = self.client.get("/webhook", params=bad_params)
        self.assertEqual(res_fail.status_code, 403)
        print("✅ GET /webhook verification test passed")

    def test_03_hmac_signature_verification(self):
        """Test Meta HMAC SHA-256 webhook signature helper function."""
        secret = "test_secret_123"
        config.META_APP_SECRET = secret
        payload_bytes = b'{"test": "data"}'
        
        valid_sig = "sha256=" + hmac.new(secret.encode('utf-8'), payload_bytes, hashlib.sha256).hexdigest()
        self.assertTrue(verify_meta_signature(payload_bytes, valid_sig))
        self.assertFalse(verify_meta_signature(payload_bytes, "sha256=invalid_hash"))
        
        config.META_APP_SECRET = ""
        print("✅ HMAC SHA-256 signature verification test passed")

    def test_04_direct_chat_api(self):
        """Test direct chat REST endpoint (/api/chat)."""
        payload = {
            "user_id": "test_user_unit",
            "message": "What is the weather in Tokyo?"
        }
        response = self.client.post("/api/chat", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["user_id"], "test_user_unit")
        self.assertIn("whatsapp_response", data)
        self.assertIn("Tokyo", data["whatsapp_response"])
        print("✅ POST /api/chat test passed")

    def test_05_menu_and_command(self):
        """Test /menu and /reset commands."""
        res = generate_whatsapp_response("test_user_cmd", "/menu")
        self.assertIn("Welcome to WeatherGPT", res)

        res_reset = generate_whatsapp_response("test_user_cmd", "/reset")
        self.assertIn("reset", res_reset.lower())
        print("✅ Commands (/menu, /reset) test passed")

    def test_06_weather_service_live_api(self):
        """Test weather_service calls to OpenWeather API."""
        weather_data = weather.get_current_weather("London")
        self.assertEqual(weather_data["name"], "London")
        self.assertIn("main", weather_data)
        
        card = weather.format_weather_card(weather_data)
        self.assertIn("London", card)
        self.assertIn("Temperature:", card)
        print("✅ OpenWeather live API test passed for London")

    def test_07_async_weather_service(self):
        """Test async weather_service functions."""
        async def run_async_test():
            data = await weather.get_current_weather_async("Paris")
            self.assertEqual(data["name"], "Paris")
            card = weather.format_weather_card(data)
            self.assertIn("Paris", card)
            
        asyncio.run(run_async_test())
        print("✅ Async OpenWeather service test passed for Paris")

    def test_08_location_handling(self):
        """Test location pin handling (Tokyo coordinates: lat 35.6762, lon 139.6503)."""
        reply = handle_location_message("test_loc_user", 35.6762, 139.6503)
        self.assertIn("Weather Report for Pinned Location", reply)
        self.assertIn("Temperature:", reply)
        print("✅ Location pin handler test passed")

    def test_09_meta_webhook_post(self):
        """Test receiving Meta WhatsApp Cloud webhook POST request."""
        meta_payload = {
            "entry": [{
                "changes": [{
                    "value": {
                        "messages": [{
                            "from": "1234567890",
                            "type": "text",
                            "text": {"body": "Air pollution in Delhi"}
                        }]
                    }
                }]
            }]
        }
        res = self.client.post("/webhook", json=meta_payload)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"status": "success"})
        print("✅ POST /webhook (Meta payload) test passed")

    def test_10_twilio_webhook_post(self):
        """Test receiving Twilio WhatsApp webhook POST request."""
        twilio_form = {
            "From": "whatsapp:+1234567890",
            "Body": "5-day forecast for Paris"
        }
        res = self.client.post("/twilio", data=twilio_form)
        self.assertEqual(res.status_code, 200)
        self.assertIn("<Response>", res.text)
        self.assertIn("<Message>", res.text)
        print("✅ POST /twilio (Twilio payload) test passed")

if __name__ == "__main__":
    unittest.main()
