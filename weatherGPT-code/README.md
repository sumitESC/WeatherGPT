# WeatherGPT: Conversational Meteorological Intelligence Platform 🌦️

> **Real-time weather insights, 30-day multi-horizon ML forecasting, and automated emergency alerts — accessible via Web Voice, WhatsApp, and SMS.**

Built for **Smart India Hackathon (SIH) Problem Statement 26068**: *Conversational AI for Weather Forecasting, Alerts, and Climate Information*.

**Developer & Lead Engineer**: Sumit Kushwaha  
**Live Web Application**: [weathergpt-q3w1.onrender.com](https://weathergpt-q3w1.onrender.com) | **Email**: [iamkussumit@gmail.com](mailto:iamkussumit@gmail.com) | **LinkedIn**: [sumit-kushwaha](https://www.linkedin.com/in/sumit-kushwaha-) | **WhatsApp Bot**: [+91 9125600020](https://api.whatsapp.com/send/?phone=9125600020&text=Hi+WeatherGPT!+I+want+to+know+the+weather)

---

## What is WeatherGPT?

Most weather apps force you to navigate rigid menus, click through satellite overlays, or decipher complex weather metrics. On the flip side, generic AI chatbots hallucinate fake weather numbers because they don't fetch real meteorological data.

**WeatherGPT solves both problems.**

It combines a real-time conversational agent with **HeatZone**, a **4.17M-parameter Temporal Fusion Transformer (TFT)** deep learning engine. Instead of sending raw user prompts straight to an LLM, WeatherGPT uses a custom **Sense Layer** to extract the user's intent, target city, and time window. It then retrieves real-time weather feeds, 10-year historical climate baselines, and satellite-derived land surface indices before generating a grounded, accurate response.

---

## 🎯 Alignment with SIH Problem Statement 26068

Here is how WeatherGPT addresses each requirement in SIH Problem Statement 26068:

| PS 26068 Requirement | How WeatherGPT Solves It | Implementation Status |
| :--- | :--- | :---: |
| **Real-Time Weather Data** | Live OpenWeather API ingestion (temperature, humidity, wind, pressure, UV index) | ✅ Supported |
| **Conversational Querying** | Sense Layer + LLM engine with 6-turn sliding memory buffer | ✅ Supported |
| **Multi-Horizon Forecasting** | HeatZone TFT model predicting 30-day (720-hour) P10/P50/P90 quantiles | ✅ Supported |
| **Extreme Weather Alerts** | Automated trigger engine for extreme heat (Score > 85) and heavy rain (>50 mm/hr) | ✅ Supported |
| **Location-Based Weather** | Automatic city geocoding + WhatsApp GPS pin decoding | ✅ Supported |
| **Historical Climate Analysis** | 10-year month-isolated ERA5 historical climate baselines | ✅ Supported |
| **Voice Interaction & Barge-In** | Web Speech API continuous recognition with client-side speech cancellation | ✅ Supported |
| **Multilingual Indian Context** | Query parsing and advisory responses tailored for Indian regional queries (Hindi, Hinglish, English) | 🟡 Partial / Extension |
| **Agricultural Advisories** | Weather-grounded pesticide timing, irrigation guidance, and sowing windows | ✅ Supported |
| **Urban Heat & GIS Analysis** | Sentinel-2 indices (NDVI, NDWI, NDBI, SAVI, BSI) & Urban Heat Island scoring | ✅ Supported |
| **Multi-Channel Alert Dispatch** | HMAC-authenticated WhatsApp and SMS broadcast delivery | ✅ Supported |
| **Scalable Data Ingestion** | Async background synchronization pipeline for real-time weather feeds | ✅ Supported |
| **NWP Model Ingestion (GFS/WRF)** | Modular ingestion routing designed to plug in gridded GFS/WRF model streams | ⏳ Planned Extension |

---

## 🚀 How It Works (Architecture Flow)

```text
User Query (Web Voice / WhatsApp Text / GPS Pin)
                      │
                      ▼
               ┌─────────────┐
               │ Sense Layer │  <-- Extracts Intent, City & Time
               └──────┬──────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
  Live Weather    HeatZone TFT   Historical
  (OpenWeather)   (30-Day ML)    (ERA5 Baseline)
        │             │             │
        └─────────────┼─────────────┘
                      ▼
               Grounded Context
                      │
                      ▼
               Language Model  <-- Generates factual response
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
     Web UI       Voice Assistant  WhatsApp Bot
                                    │
                                    ▼
                             Automated Alerts (SMS/WhatsApp)
```

---

## ✨ Key Highlights

* **Sense-Layer Architecture**: Keeps LLM responses accurate by fetching verified weather context first.
* **HeatZone TFT Engine**: Built with **4,165,362 trainable parameters (~4.17M)** using PyTorch.
* **78 Model Input Features**: Combines 59 weather variables, 13 satellite/terrain features (Sentinel-2 NDVI, NDWI, NDBI, SAVI, BSI), and 6 cyclic temporal encodings.
* **30-Day Multi-Horizon Forecasts**: Generates 720-hour forward forecasts with P10, P50, and P90 quantile uncertainty bounds.
* **Smart Voice Assistant with Barge-In**: Intercepts stop keywords (`stop`, `wait`, `ruko`, `chup`) and instantly calls `window.speechSynthesis.cancel()` to stop talking when you speak.
* **Zero-Install WhatsApp Assistant**: Send text, voice notes, or drop a GPS location pin directly on WhatsApp.
* **Automated Emergency Alerts**: Sends SMS and WhatsApp advisories when heat or rainfall cross safety thresholds.
* **Lightweight Memory Footprint**: Runs efficiently on **~50 MB to 80 MB Python process RSS**.
* **Model-Agnostic Backend**: Swap LLM providers anytime without modifying the weather ingestion pipeline.

---

## 🧠 The Sense Layer

Standard language models often make up weather figures when asked directly. The **Sense Layer** acts as a smart proxy between the user and the LLM:

1. **Intent & Entity Extraction**: Uses structured JSON schemas to extract the target city, date range, and question type (e.g. current weather, 30-day forecast, air quality, or agricultural guidance).
2. **Multi-Turn Memory**: Preserves context across 6 conversation turns. Asking *"How is the weather in Lucknow?"* followed by *"What about tomorrow?"* automatically carries forward *Lucknow*.
3. **Context Injection**: Injects live weather, HeatZone TFT predictions, and satellite indices into the LLM prompt, ensuring the final output is 100% grounded in real data.

---

## 🔮 HeatZone Forecasting Engine

HeatZone is a custom time-series model built on the **Temporal Fusion Transformer (TFT)** architecture.

### Model Breakdown

| Component / Layer Group | Trainable Parameters |
| :--- | ---: |
| Variable Selection Networks (VSN) & Embeddings | 642,816 |
| Gated Residual Networks (GRN) & Encoders | 1,124,352 |
| Temporal Multi-Head Self-Attention (8 Heads, $d_{\text{model}}=256$) | 525,824 |
| Position-Wise Feed-Forward & Gated Layer Norms | 984,064 |
| Multi-Quantile Linear Output Heads (P10, P50, P90) | 888,306 |
| **Total Trainable Parameters** | **4,165,362 (~4.17M)** |

### Input Features (78 Total)
* **59 Weather Features**: Temperature, dew point, humidity, surface pressure, wind vectors, precipitation, solar radiation, soil temperature, and moisture across soil depth layers.
* **13 Satellite & Terrain Features**: Sentinel-2 multispectral bands (Blue, Green, Red, NIR, SWIR), environmental indices (NDVI, NDWI, NDBI, SAVI, BSI), surface albedo, digital elevation model (DEM), and cloud cover.
* **6 Cyclic Temporal Encodings**: Sine and cosine transformations of day-of-year, hour-of-day, and month-of-year.

$$\text{Model Inputs} = 59 \text{ Weather} + 13 \text{ Satellite/Terrain} + 6 \text{ Temporal} = 78$$

### Forecast Target Specifications

The model predicts multi-horizon trajectories over 720 forecast steps (30 days):

| Target Variable | Unit | Horizon | Outputs |
| :--- | :---: | :---: | :---: |
| **Max Surface Temperature ($T_{\text{max}}$)** | °C | 720 hours (30 days) | P10, P50, P90 |
| **Min Surface Temperature ($T_{\text{min}}$)** | °C | 720 hours (30 days) | P10, P50, P90 |
| **Mean Surface Temperature ($T_{\text{mean}}$)** | °C | 720 hours (30 days) | Derived: $(T_{\text{max}} + T_{\text{min}}) / 2$ |
| **Heat Risk Index Score** | 0–100 | 720 hours (30 days) | P10, P50, P90 |

### Training Setup

* **Lookback Window ($H$)**: 168 hours (7 days)
* **Forecast Horizon ($F$)**: 720 hours (30 days)
* **Dataset Split**: Chronological 85% train / 15% validation split per region
* **Loss Function**: Quantile Pinball Loss + Quantile Ordering Penalty ($\mathcal{L}_{\text{total}} = \mathcal{L}_{\text{pinball}} + 0.1 \times \mathcal{L}_{\text{ordering}}$)
* **Optimizer**: AdamW (Learning Rate: 0.0015, Batch Size: 128, Weight Decay: 1e-5)
* **Hardware & Precision**: NVIDIA Tesla T4 GPU with FP16 Mixed Precision (AMP)

---

## 🛰️ Sentinel-2 Satellite Environmental Features

HeatZone uses Sentinel-2 multispectral satellite observations to calculate key land surface indices:

* **NDVI (Vegetation Cover)**: $\frac{\text{NIR} - \text{Red}}{\text{NIR} + \text{Red}}$ (Evaluates crop stress & vegetation health)
* **NDWI (Water Index)**: $\frac{\text{Green} - \text{NIR}}{\text{Green} + \text{NIR}}$ (Monitors soil moisture retention & surface water)
* **NDBI (Built-Up Index)**: $\frac{\text{SWIR} - \text{NIR}}{\text{SWIR} + \text{NIR}}$ (Measures urban concrete density for Urban Heat Island analysis)
* **SAVI**: Soil-Adjusted Vegetation Index ($L=0.5$)
* **BSI**: Bare Soil Index for agricultural land preparation tracking

---

## 💡 Practical Application Domains

* **Agriculture**: Gives farmers practical guidance on pesticide application timing (avoiding wash-off from sudden rain), irrigation scheduling, and crop sowing windows.
* **Smart Cities & Urban Management**: Tracks Urban Heat Island (UHI) intensity using Sentinel-2 NDBI/NDVI indices to support cool-roof planning and emergency thermal advisories.

*Note: Implemented decision-support capabilities currently focus on Agriculture and Urban Heat Management. Aviation and Marine intelligence are identified as extensible domains for future NWP and data stream integration.*

---

## 🚨 Emergency Alerts & Thresholds

When HeatZone models or data feeds detect critical weather conditions:
* **Heat Risk Threshold**: Heat Risk Score $> 85.0$
* **Heavy Rainfall Threshold**: Precipitation $> 50.0 \text{ mm/hr}$

The system automatically prepares localized alert payloads and dispatches them over **SMS and WhatsApp**.

*Operational Note: These thresholds are configurable application parameters designed for demonstration and operational routing. Official warnings from national meteorological agencies remain the authoritative source for public safety decisions.*

---

## 🔐 Security & Privacy

1. **HMAC SHA-256 Webhook Verification**: Rejects unauthorized third-party requests by verifying incoming WhatsApp payload signatures (`X-Hub-Signature-256`).
2. **Environment Variable Isolation**: API keys and database credentials remain strictly in `.env` configuration.
3. **Honeypot Anti-Spam Trap**: Public feedback forms use invisible fields (`hp_field`) to block automated bot submissions.
4. **Client-Side Audio Privacy**: All Web Speech voice processing runs locally inside the user's browser. No raw voice recordings are stored on the server.

---

## 📁 Repository Structure

```
weatherGPT/
├── backend/
│   ├── app/
│   │   ├── config.py              # Environment configuration loader
│   │   ├── schemas.py             # Pydantic API response schemas
│   │   ├── main.py                # FastAPI entrypoint, Webhooks & Static SPA server
│   │   └── services/
│   │       ├── weather_service.py # OpenWeather & HeatZone ML API wrapper
│   │       └── agent_service.py   # Sense Layer classifier & context builder
│   ├── cli.py                     # Terminal CLI testing tool
│   └── requirements.txt           # Python backend dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── landing/           # HeroSection, FeaturesSection, DeviceShowcase, FeedbackModal
│   │   │   ├── layout/            # Header & Mobile Navigation
│   │   │   ├── chat/              # ChatContainer, ChatMessage, ChatInput
│   │   │   └── voice/             # VoiceModal & 3D Glowing VoiceOrb
│   │   ├── hooks/
│   │   │   ├── useChat.js         # Chat state manager & memory buffer
│   │   │   └── useSpeechAssistant.js # Web Speech voice assistant & barge-in hook
│   │   ├── services/api.js        # API failover & backend client
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
├── .env.example                   # Environment variable template
├── build.sh                       # Render deployment script
├── render.yaml                    # Render Blueprint configuration
├── run.py                         # Cross-platform local server runner
└── README.md                      # Project Technical Documentation
```

---

## ⚙️ Quickstart & Local Setup

### Prerequisites
* **Python**: 3.9+
* **Node.js**: 18.0+

### 1. Clone & Configure Environment
```bash
git clone https://github.com/sumit-kushwaha/weatherGPT.git
cd weatherGPT
cp .env.example .env
```

Edit `.env` and add your API keys:
```env
OPENWEATHER_API_KEY=your_openweather_api_key
VITE_GROQ_API_KEY=your_llm_api_key
VITE_GROQ_MODEL=openai/gpt-oss-20b
VITE_API_BASE_URL=http://localhost:8000
HEATZONE_BASE_URL=https://heatzone-backend.onrender.com
WHATSAPP_VERIFY_TOKEN=weathergpt_verify_secret
```

### 2. Run WeatherGPT
```bash
# Starts both FastAPI backend and Vite frontend server
python run.py
```

* **Web UI**: `http://localhost:5173`
* **FastAPI Docs**: `http://localhost:8000/docs`

---

## 📬 Contact & Live Links

* **Live Web Application**: https://weathergpt-q3w1.onrender.com
* **FastAPI Docs**: https://weathergpt-q3w1.onrender.com/docs
* **Developer**: Sumit Kushwaha
* **Email**: [iamkussumit@gmail.com](mailto:iamkussumit@gmail.com)
* **LinkedIn**: [sumit-kushwaha](https://www.linkedin.com/in/sumit-kushwaha-)
* **WhatsApp Assistant Bot**: [+91 9125600020](https://api.whatsapp.com/send/?phone=9125600020&text=Hi+WeatherGPT!+I+want+to+know+the+weather)

---

## 📚 References

1. Lim, B., et al. (2021). *Temporal Fusion Transformers for interpretable multi-horizon time series forecasting*. International Journal of Forecasting.
2. Hersbach, H., et al. (2020). *The ERA5 global reanalysis*. Quarterly Journal of the Royal Meteorological Society.
3. European Space Agency (ESA). (2021). *Sentinel-2 User Handbook*.
4. OpenWeather Ltd. (2024). *OpenWeather One Call & Air Pollution API Documentation*.

---

*Copyright © 2026 Sumit Kushwaha. WeatherGPT Project.*
