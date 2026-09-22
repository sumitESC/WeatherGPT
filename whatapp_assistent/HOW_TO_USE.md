# WeatherGPT WhatsApp Assistant - Complete Usage Guide 🚀

Welcome to your **WeatherGPT WhatsApp Assistant & Metoxi Control Panel**! This guide explains how to access the dashboard, send mass WhatsApp broadcasts, manage live user conversations, and call the REST API.

---

## 📌 1. Dashboard Access & Login

- **Dashboard Web URL:** `https://whatapp-assistent.esc-weathergpt.workers.dev/admin`  
- **Login Web URL:** `https://whatapp-assistent.esc-weathergpt.workers.dev/admin/login`  
- **Local Dev URL:** `http://localhost:8787/admin`

### Default Login Credentials
- **Username:** `admin` *(or whatever `ADMIN_USERNAME` is set to)*
- **Password:** `weathergpt_admin_pass` *(or whatever `ADMIN_PASSWORD` secret is set to)*

---

## 📢 2. How to Send Mass WhatsApp Broadcasts

You can send mass announcements to **all registered WhatsApp users** in two ways:

### Method A: Via Web Control Panel (UI)
1. Log in to the Metoxi Dashboard (`/admin`).
2. Click the bright blue **`📢 Broadcast Message`** button in the top right header (or sidebar).
3. Type your announcement message into the pop-up modal:
   > *"⛈️ Weather Warning: Severe thunderstorm expected tonight across northern regions!"*
4. Click **"Send Broadcast Now"**.
5. The message will be dispatched to all user WhatsApp numbers via Meta Cloud API / Twilio and recorded in their chat transcripts!

---

### Method B: Via REST API (cURL / Postman / Python / Node.js)

#### Step 1: Log in to get your API Token
```bash
curl -X POST https://whatapp-assistent.esc-weathergpt.workers.dev/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "weathergpt_admin_pass"
  }'
```
*Response returns:* `{"status":"success","token":"eyJhbGci..."}`

#### Step 2: Send Mass Broadcast
```bash
curl -X POST https://whatapp-assistent.esc-weathergpt.workers.dev/api/admin/broadcast \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "message": "🌤️ Good morning! Here is your daily WeatherGPT update. Type any city name to check live forecasts!"
  }'
```

*Response:*
```json
{
  "status": "success",
  "totalUsers": 12,
  "successCount": 12,
  "failedCount": 0,
  "message": "Broadcast dispatched to 12 users!"
}
```

---

## 💬 3. Live WhatsApp Chat & Manual Replies

Inside the Metoxi Control Panel (`/admin`):

1. **Active Users List:** The left sidebar shows every WhatsApp user who has messaged WeatherGPT, along with their last message and timestamp.
2. **View Transcript:** Click on any user to load their multi-turn conversation history.
3. **Send Direct Message:** Type a message in the bottom input bar and press **Send Message** — it sends a direct WhatsApp reply to that user's phone number!
4. **Clear History:** Click **Clear Thread** to reset chat memory for a user.

---

## 🧪 4. Testing WhatsApp AI Chat API

You can test how the bot responds to weather queries without sending real WhatsApp messages:

```bash
curl -X POST https://whatapp-assistent.esc-weathergpt.workers.dev/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "+919876543210",
    "message": "What is the 5-day forecast for Tokyo?"
  }'
```

---

## 🗄️ 5. Database Configuration (`wrangler.toml`)

Your persistent chat database uses Cloudflare KV (`CHAT_KV`):

```toml
[[kv_namespaces]]
binding = "CHAT_KV"
id = "ef7fabb1bc21475caf65eff581749427"
```

All conversation threads, user summaries, and analytics metrics persist permanently in Cloudflare's global KV database.
