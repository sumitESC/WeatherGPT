"""
Cloudflare Worker Python Entrypoint for WeatherGPT WhatsApp Assistant.
Bridges Cloudflare Workers HTTP events directly into the pure Python ASGI application.
"""

from main import app

try:
    from workers import asgi
    Default = asgi.entrypoint(app)
except ImportError:
    handler = app
