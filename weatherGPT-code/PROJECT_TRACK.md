# 🛰️ WeatherGPT - Complete Project Specification & Tracking Blueprint

> **Self-Sufficient Blueprint**: Reading this single file allows any developer or AI agent to recreate the **entire** WeatherGPT project from scratch — including all file structures, API schemas, AI prompts, custom React hooks, Web Speech barge-in algorithms, and UI component specifications.

---

## 🎯 1. Project Aim & Architecture Blueprint

**WeatherGPT** is a full-stack AI Weather Assistant featuring:
1. **2-Layer AI Agent**: Intent Classifier + Context-Augmented Groq LLM Response Generator.
2. **OpenWeather API Client**: Fetches Current Weather, 5-Day Forecast, Air Quality (AQI & PM2.5), Historical Pollution, and UV Index.
3. **Continuous Voice Assistant**: Full-screen overlay with fluid glowing morphing visualizer orb (`VoiceOrb`).
4. **Explicit Barge-In Interruption**: Halts speech output instantly when explicit control words (*"stop"*, *"pause"*, *"be quiet"*, etc.) are spoken.
5. **Modal-Bound Microphone Lifecycle**: Mic stream turns ON **only** when Voice Mode is active and turns OFF **completely** when closed.

---

## 📐 2. Full-Stack Directory & File Blueprint

```
weatherGPT/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py              # Environment configuration loader
│   │   ├── schemas.py             # Pydantic schemas (ChatRequest, ChatResponse, ChatMessage)
│   │   ├── main.py                # FastAPI routes & CORS setup
│   │   └── services/
│   │       ├── weather_service.py # OpenWeather REST API HTTP functions
│   │       └── agent_service.py   # Intent classification & Groq LLM response generation
│   ├── cli.py                     # Interactive terminal CLI agent
│   └── requirements.txt           # Python backend dependencies
├── frontend/
│   ├── src/
│   │   ├── services/
│   │   │   └── api.js             # HTTP client for POST /api/chat
│   │   ├── constants/
│   │   │   └── suggestions.js     # Starter prompt cards array
│   │   ├── hooks/
│   │   │   ├── useChat.js         # Chat history state & backend dispatcher
│   │   │   └── useSpeechAssistant.js # SpeechRecognition, TTS, & Barge-In logic
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   └── Header.jsx     # Top app header with model tag & voice button
│   │   │   ├── chat/
│   │   │   │   ├── ChatContainer.jsx   # Scrollable messages container with auto-scroll
│   │   │   │   ├── ChatMessage.jsx     # Markdown message bubble renderer
│   │   │   │   ├── ChatInput.jsx       # Floating capsule text input bar
│   │   │   │   └── SuggestionCards.jsx # Empty state starter cards grid
│   │   │   └── voice/
│   │   │       ├── VoiceOrb.jsx   # Morphing animated visualizer orb
│   │   │       └── VoiceModal.jsx # Full-screen voice overlay modal
│   │   ├── App.jsx                # Clean ~60-line top composition component
│   │   ├── main.jsx               # React 19 root mount entrypoint
│   │   └── index.css              # Global styles & Tailwind CSS v4 directives
│   ├── package.json               # Frontend dependencies & Vite scripts
│   ├── vite.config.js             # Vite bundler config
│   ├── tailwind.config.js         # Tailwind CSS configuration
│   └── postcss.config.js          # PostCSS configuration
├── .env                           # API Keys & model parameters
├── package.json                   # Root ergonomics runner (npm run dev)
└── README.md                      # Developer setup & user guide
```

---

## 🧩 3. Detailed File Specifications & Logic Breakdown

### 🐍 Backend Specifications (`backend/`)

#### 1. `backend/app/config.py`
- **Purpose**: Loads `.env` environment variables into a single `config` object.
- **Variables**:
  - `GROQ_API_KEY` (from `VITE_GROQ_API_KEY`)
  - `GROQ_MODEL` (default: `"openai/gpt-oss-20b"`)
  - `GROQ_URL` (`"https://api.groq.com/openai/v1/chat/completions"`)
  - `OPENWEATHER_API_KEY` (from `OPENWEATHER_API_KEY`)

#### 2. `backend/app/schemas.py`
- **Data Models (Pydantic)**:
  - `ChatMessage`: `role: str`, `content: str`
  - `ChatRequest`: `message: str`, `chat_history: List[Dict[str, str]] = []`
  - `ChatResponse`: `response: str`
  - `IntentResponse`: `intent: str`, `city: Optional[str]`

#### 3. `backend/app/services/weather_service.py`
- **Functions**:
  - `get_current_weather(city: str) -> dict`: `GET https://api.openweathermap.org/data/2.5/weather?q={city}&appid={key}&units=metric`
  - `get_geocoding(city: str, limit: int = 1) -> list`: `GET http://api.openweathermap.org/geo/1.0/direct?q={city}&limit={limit}&appid={key}`
  - `get_5_day_forecast(city: str) -> dict`: `GET https://api.openweathermap.org/data/2.5/forecast?q={city}&appid={key}&units=metric`
  - `get_air_pollution(lat: float, lon: float) -> dict`: `GET http://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lon}&appid={key}`
  - `get_reverse_geocoding(lat: float, lon: float) -> list`
  - `get_nearby_cities_weather(lat: float, lon: float, cnt: int = 5) -> dict`
  - `get_uv_index(lat: float, lon: float) -> dict`
  - `get_historical_air_pollution(lat: float, lon: float, start: int, end: int) -> dict`

#### 4. `backend/app/services/agent_service.py`
- **Logic**:
  - `call_groq(messages, json_mode=False)`: Sends HTTP POST request to Groq API endpoint with Bearer auth token and JSON payloads.
  - `classify_intent(user_input, chat_history)`: Uses Groq JSON mode with system prompt to return `{"intent": "current" | "forecast" | "pollution" | "general", "city": "CityName" | null}`.
  - `fetch_weather_context(intent, city)`: Calls `weather_service` functions based on classified intent and formats a `[Real-time data fetched]` context string.
  - `generate_response(user_input, chat_history)`: Injects system prompt ("You are WeatherGPT, act like a helpful, casual friend..."), recent chat history, and system context, calling `call_groq` to generate the final response string.

#### 5. `backend/app/main.py`
- **FastAPI Application**:
  - Sets up `CORSMiddleware` (allowing all origins `*`).
  - Endpoints: `GET /`, `GET /api/weather/current`, `GET /api/weather/forecast`, `GET /api/weather/pollution`, `GET /api/weather/uv`, `POST /api/chat`.
  - Runs with `uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)`.

#### 6. `backend/cli.py`
- **Interactive CLI**: Runs terminal `while True` loop calling `agent.generate_response(user_input, chat_history)`.

---

### ⚛️ Frontend Specifications (`frontend/src/`)

#### 1. `frontend/src/services/api.js`
- `sendChatMessage(message, chatHistory)`: Posts `{ message, chat_history }` to `http://localhost:8000/api/chat` and returns string `data.response`.

#### 2. `frontend/src/constants/suggestions.js`
- Exports `SUGGESTIONS` array containing 4 card objects (`title`, `subtitle`, `prompt`).

#### 3. `frontend/src/hooks/useChat.js`
- **State**: `messages` (array), `input` (string), `isLoading` (boolean).
- **Ref**: `messagesRef` (synchronizes history for async voice loops).
- **Methods**: `handleSend(textToSend)`, `handleNewChat()`.

#### 4. `frontend/src/hooks/useSpeechAssistant.js`
- **State**: `isVoiceMode` (boolean), `voiceState` (`'connecting'` | `'listening'` | `'thinking'` | `'speaking'` | `'idle'`), `isMuted` (boolean), `voiceTranscript` (string), `voiceError` (string).
- **Mic Lifecycle**:
  - `useEffect([isVoiceMode])`: If `isVoiceMode` becomes `false`, immediately cancels `window.speechSynthesis` and stops/aborts `SpeechRecognition` instance completely.
  - `startRecognition()`: Starts `window.SpeechRecognition` with `continuous: true` and `interimResults: true`. Strictly verifies `if (!isVoiceModeRef.current || isMutedRef.current) return;`.
- **Explicit Stop-Word Barge-In Algorithm**:
  - Checks interim speech results against stop keywords: `['stop', 'pause', 'wait', 'hold on', 'be quiet', 'shut up', 'quiet', 'hush', 'silence', 'cancel', 'stop speaking', 'stop talking', 'stop it', 'dont speak', "don't speak", 'freeze']`.
  - If `isSpeaking` is true AND `isStopWord` is true:
    - Instantly calls `window.speechSynthesis.cancel()`.
    - Stops recognition temporarily and resets state to `'listening'`.
    - Updates transcript: `"Stopped speaking. Listening to you..."`.
- **Voice Commands**:
  - Close commands: *"close"*, *"exit"*, *"bye"*, *"turn off"* -> Calls `closeVoiceMode()`.
  - Stop/Pause commands: *"stop"*, *"pause"* -> Halts speech synthesis.
  - Continue commands: *"continue"*, *"resume"* -> Re-speaks `lastSpokenTextRef.current`.
  - New chat commands: *"new chat"*, *"clear conversation"* -> Resets messages history.

#### 5. UI Components
- **`Header.jsx`**: Props: `{ onOpenVoiceMode, onNewChat }`.
- **`ChatMessage.jsx`**: Props: `{ message }`. Renders markdown for assistant messages, pre-wrap text for user messages.
- **`ChatContainer.jsx`**: Props: `{ messages, isLoading, onSelectSuggestion, onOpenVoiceMode }`. Uses `messagesEndRef` to auto-scroll on new messages.
- **`ChatInput.jsx`**: Props: `{ input, setInput, onSubmit, isLoading, onOpenVoiceMode }`.
- **`SuggestionCards.jsx`**: Props: `{ onSelectSuggestion, onOpenVoiceMode }`.
- **`VoiceOrb.jsx`**: Props: `{ voiceState, onInterrupt }`. Renders morphing glowing orb with color states (listening=white pulse, thinking=blue spinning blob, speaking=emerald bouncing bars).
- **`VoiceModal.jsx`**: Props: `{ isOpen, voiceState, isMuted, voiceTranscript, voiceError, messages, onToggleMute, onInterrupt, onClose }`.

#### 6. `App.jsx`
- Orchestrates `useChat` and `useSpeechAssistant` hooks, passing props cleanly down to `Header`, `ChatContainer`, `ChatInput`, and `VoiceModal`.

---

## 🚀 4. Recreating the Project from Scratch

Yes! With this blueprint:
1. Initialize a Python environment with `fastapi uvicorn requests python-dotenv pydantic`.
2. Initialize a React Vite frontend with `lucide-react react-markdown tailwindcss`.
3. Create the backend services and schemas following Section 3 specifications.
4. Create the React custom hooks (`useChat`, `useSpeechAssistant`) and UI components following Section 3 logic.
5. Create root `package.json` with `"dev": "npm --prefix frontend run dev"`.
