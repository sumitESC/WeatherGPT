from pydantic import BaseModel
from typing import List, Dict, Optional, Any

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    chat_history: List[Dict[str, Any]] = []

class ChatResponse(BaseModel):
    response: str

class IntentResponse(BaseModel):
    intent: str
    city: Optional[str] = None
