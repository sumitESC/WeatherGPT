import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    GROQ_API_KEY: str = os.getenv("VITE_GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("VITE_GROQ_MODEL", "openai/gpt-oss-20b")
    GROQ_URL: str = "https://api.groq.com/openai/v1/chat/completions"
    OPENWEATHER_API_KEY: str = os.getenv("OPENWEATHER_API_KEY", "")
    HEATZONE_BASE_URL: str = os.getenv("HEATZONE_BASE_URL", "https://heatzone-backend.onrender.com")

config = Config()
