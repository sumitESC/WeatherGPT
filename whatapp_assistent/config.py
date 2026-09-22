import os
from dotenv import load_dotenv

load_dotenv(override=True)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)

class Config:
    GROQ_API_KEY: str = os.getenv("VITE_GROQ_API_KEY", "") or os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("VITE_GROQ_MODEL", "openai/gpt-oss-120b")
    GROQ_URL: str = "https://api.groq.com/openai/v1/chat/completions"
    OPENWEATHER_API_KEY: str = os.getenv("OPENWEATHER_API_KEY", "")

    WHATSAPP_TOKEN: str = os.getenv("WHATSAPP_TOKEN", "")
    WHATSAPP_PHONE_NUMBER_ID: str = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    WHATSAPP_VERIFY_TOKEN: str = os.getenv("WHATSAPP_VERIFY_TOKEN", "weathergpt_verify_secret")
    META_APP_SECRET: str = os.getenv("META_APP_SECRET", "")

    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_WHATSAPP_NUMBER: str = os.getenv("TWILIO_WHATSAPP_NUMBER", "")

    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "production")
    IS_CLOUDFLARE: bool = os.getenv("CLOUDFLARE_WORKER", "false").lower() in ("true", "1")

config = Config()

