# 📲 WeatherGPT Executive WhatsApp AI Assistant — Cloudflare Deployment Guide

An enterprise-grade, high-performance, asynchronous WhatsApp Webhook Assistant for **WeatherGPT**, built with **FastAPI**, **Groq LLM (gpt-oss-120b)**, **OpenWeather API**, and fully optimized for **Cloudflare Workers** & **Cloudflare Tunnel**.

---

## 🚀 Cloudflare Deployment Options

### Option 1: Cloudflare Workers (Serverless Edge Deployment)

Deploy your WhatsApp Webhook globally across Cloudflare's edge network in seconds using Python Workers runtime.

#### 1. Install Wrangler CLI
```bash
npm install -g wrangler
```

#### 2. Authenticate with Cloudflare
```bash
wrangler login
```

#### 3. Store Production Secrets in Cloudflare Workers
Run the following commands in the `whatapp_assistent` directory to set your production API secrets securely:

```bash
wrangler secret put OPENWEATHER_API_KEY
wrangler secret put VITE_GROQ_API_KEY
wrangler secret put WHATSAPP_TOKEN
wrangler secret put WHATSAPP_PHONE_NUMBER_ID
wrangler secret put WHATSAPP_VERIFY_TOKEN
wrangler secret put META_APP_SECRET
wrangler secret put TWILIO_ACCOUNT_SID
wrangler secret put TWILIO_AUTH_TOKEN
```

#### 4. Deploy to Cloudflare Workers
```bash
wrangler deploy
```

Once deployed, Cloudflare will output your worker URL (e.g. `https://weathergpt-whatsapp-assistant.<your-subdomain>.workers.dev`).

---

### Option 2: Cloudflare Tunnel (`cloudflared` + Docker)

Connect your containerized FastAPI server securely to Cloudflare Edge using custom domains without exposing public IP addresses or opening router ports.

#### 1. Launch with Docker Compose & Cloudflare Tunnel
```bash
# Set your Cloudflare Tunnel Token in environment
export CLOUDFLARE_TUNNEL_TOKEN="your_cloudflare_tunnel_token"

# Start the stack
docker-compose up -d --build
```

#### 2. Configure Ingress Rules (`cloudflared.yml`)
Edit `cloudflared.yml`:
```yaml
tunnel: YOUR_CLOUDFLARE_TUNNEL_ID
credentials-file: /etc/cloudflared/YOUR_CLOUDFLARE_TUNNEL_ID.json

ingress:
  - hostname: whatsapp.yourdomain.com
    service: http://whatsapp-assistant:8001
  - service: http_status:404
```

---

## 🔒 Webhook Configuration & Security

### 1. Meta WhatsApp Cloud API Setup
1. Open [Meta Developer Console](https://developers.facebook.com/) -> Select App -> **WhatsApp** -> **Configuration**.
2. Set **Callback URL**: `https://<your-cloudflare-domain-or-worker>/webhook`
3. Set **Verify Token**: `weathergpt_verify_secret` (or matching `WHATSAPP_VERIFY_TOKEN`).
4. Enable **HMAC SHA-256 Signature Verification** by providing your Meta App Secret via `META_APP_SECRET`.
5. Under **Webhook Fields**, subscribe to `messages`.

### 2. Twilio WhatsApp Sandbox Setup
1. Open [Twilio Console](https://console.twilio.com/) -> **Messaging** -> **Settings** -> **WhatsApp Sandbox**.
2. Set **WHEN A MESSAGE COMES IN**: `https://<your-cloudflare-domain-or-worker>/twilio` (HTTP POST).

---

## 🧪 Running Automated Unit Tests

Run the comprehensive 10-point test suite (testing endpoints, Cloudflare headers, HMAC signatures, async services, and location pins):

```bash
python whatapp_assistent/test_assistant.py
```

---

## 🛠️ Architecture & Security Summary

| Feature | Implementation | Benefit |
| :--- | :--- | :--- |
| **Async Network Engine** | `httpx.AsyncClient` | Sub-second response times preventing webhook timeouts |
| **Edge Tracing** | `CF-Connecting-IP`, `CF-Ray` | Enterprise request tracing and real client IP extraction |
| **Security Validation** | HMAC SHA-256 (`X-Hub-Signature-256`) | Blocks unauthorized forged webhook requests |
| **Serverless Deployment** | Cloudflare Workers (`wrangler.toml`) | Global edge deployment with zero server maintenance |
| **Zero Trust Tunnel** | Cloudflare Tunnel (`cloudflared`) | Encrypted ingress tunnel with custom domain support |
| **CI/CD Pipeline** | GitHub Actions (`deploy-cloudflare.yml`) | Automated unit testing and wrangler deployment on `git push` |

---

## 📱 Interactive User Features
- 🌤️ **Real-time Weather:** `"What's the weather in Tokyo?"`
- 📅 **5-Day Forecast:** `"5-day forecast for London"`
- 🍃 **Air Quality Index (AQI):** `"Air pollution in Delhi"`
- 📍 **GPS Location Pin Support:** Send any WhatsApp GPS location pin for instant localized weather report.
- ⚙️ **Commands:** `/menu` to view options, `/reset` to clear chat context memory.
