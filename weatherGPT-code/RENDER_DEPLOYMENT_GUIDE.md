# 🚀 WeatherGPT Render Deployment Guide

WeatherGPT is fully configured for seamless deployment on **[Render](https://render.com/)**. The application serves both the **FastAPI Backend REST API** and the **Vite React Frontend SPA** from a single unified web service.

---

## ⚡ Option 1: 1-Click Render Blueprint Deployment (Recommended)

1. Push your latest repository code to **GitHub**.
2. Log into your **[Render Dashboard](https://dashboard.render.com/)**.
3. Click **New +** → **Blueprint**.
4. Select your connected GitHub repository.
5. Render will automatically detect `render.yaml`.
6. Fill in your API Keys under Environment Variables when prompted:
   - `OPENWEATHER_API_KEY`
   - `VITE_GROQ_API_KEY`
   - `WHATSAPP_TOKEN` (Optional - for WhatsApp Bot)
   - `WHATSAPP_PHONE_NUMBER_ID` (Optional - for WhatsApp Bot)
7. Click **Apply**. Render will automatically run `build.sh` and launch WeatherGPT!

---

## 🛠️ Option 2: Manual Web Service Setup on Render

If you prefer to configure the Web Service manually:

1. In Render Dashboard, click **New +** → **Web Service**.
2. Select **Build and deploy from a Git repository**.
3. Configure the service settings:
   - **Name**: `weathergpt`
   - **Environment**: `Python 3`
   - **Region**: Oregon (US West) or Singapore
   - **Branch**: `main`
   - **Build Command**: `./build.sh`
   - **Start Command**: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
4. Add the following **Environment Variables**:

| Variable Key | Recommended / Example Value | Description |
|---|---|---|
| `OPENWEATHER_API_KEY` | `your_openweather_api_key_here` | OpenWeather API Key |
| `VITE_GROQ_API_KEY` | `your_groq_api_key_here` | Groq AI Model API Key |
| `VITE_GROQ_MODEL` | `openai/gpt-oss-20b` | Groq Model ID |
| `HEATZONE_BASE_URL` | `https://heatzone-backend.onrender.com` | HeatZone API Base URL |
| `WHATSAPP_VERIFY_TOKEN` | `weathergpt_verify_secret` | Meta WhatsApp Verification Secret |

5. Click **Create Web Service**.

---

## 📲 Meta WhatsApp Webhook Configuration (Optional)

Once your Render app is live (e.g. `https://weathergpt-app.onrender.com`):

1. Go to your **Meta Developer Console** → **WhatsApp** → **Configuration**.
2. Set **Callback URL**: `https://weathergpt-app.onrender.com/webhook`
3. Set **Verify Token**: `weathergpt_verify_secret`
4. Click **Verify and Save**.

---

## 🧪 Local Testing Before Deploy

You can test the unified server locally at any time:

```bash
# 1. Build the React frontend SPA
npm run build

# 2. Run the unified FastAPI server
python -m backend.app.main
```

Then visit `http://localhost:8000` in your browser!
