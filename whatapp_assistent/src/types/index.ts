export interface Env {
  ENVIRONMENT?: string;
  CLOUDFLARE_WORKER?: string;

  OPENWEATHER_API_KEY?: string;

  VITE_GROQ_API_KEY?: string;
  GROQ_API_KEY?: string;
  VITE_GROQ_MODEL?: string;

  WHATSAPP_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  META_APP_SECRET?: string;

  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_WHATSAPP_NUMBER?: string;

  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SECRET_KEY?: string;

  CHAT_KV?: KVNamespace;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'admin';
  content: string;
  timestamp: string;
  senderName?: string;
  msgType?: 'text' | 'location' | 'command' | 'broadcast';
  fromAdmin?: boolean;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  location?: {
    latitude: number;
    longitude: number;
  };
  liked?: boolean;
  disliked?: boolean;
  saved?: boolean;
}

export interface ConversationSummary {
  phone: string;
  name: string;
  lastMessage: string;
  lastTimestamp: string;
  messageCount: number;
  unreadCount: number;
  lastMsgType?: string;
}

export interface SystemStats {
  totalConversations: number;
  totalMessages: number;
  userMessagesCount: number;
  aiMessagesCount: number;
  adminMessagesCount: number;
  openweatherConfigured: boolean;
  groqConfigured: boolean;
  metaConfigured: boolean;
  twilioConfigured: boolean;
  whatsappBotPhone: string;
  uptimeStart: string;
}

export interface AdminLogEntry {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  ip?: string;
}

export interface IntentResult {
  intent: 'current' | 'forecast' | 'pollution' | 'general';
  city: string | null;
}
