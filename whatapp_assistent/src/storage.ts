import { Env, ChatMessage, ConversationSummary, SystemStats, AdminLogEntry } from './types';

const MEMORY_CONVERSATIONS = new Map<string, ChatMessage[]>();
const MEMORY_INDEX = new Map<string, ConversationSummary>();
const MEMORY_LOGS: AdminLogEntry[] = [];
let MEMORY_TOTAL_MESSAGES = 0;
let MEMORY_USER_MESSAGES = 0;
let MEMORY_AI_MESSAGES = 0;
let MEMORY_ADMIN_MESSAGES = 0;
const UPTIME_START = new Date().toISOString();

/**
 * Get full chat message history for a given phone number.
 */
export async function getChatHistory(phone: string, env: Env): Promise<ChatMessage[]> {
  const key = `history:${phone}`;

  if (env.CHAT_KV) {
    try {
      const raw = await env.CHAT_KV.get(key);
      if (raw) return JSON.parse(raw);
    } catch (err) {
      console.error(`[!] KV Error reading history for ${phone}:`, err);
    }
  }

  return MEMORY_CONVERSATIONS.get(phone) || [];
}

/**
 * Save a new chat message (from user, AI assistant, or admin) into history & update conversation index.
 * Concurrently writes to Cloudflare KV for ultra-fast response times.
 */
export async function saveChatMessage(phone: string, msg: ChatMessage, env: Env): Promise<void> {
  const history = await getChatHistory(phone, env);
  history.push(msg);

  if (history.length > 50) {
    history.splice(0, history.length - 50);
  }

  const key = `history:${phone}`;
  MEMORY_CONVERSATIONS.set(phone, history);

  const currentSummary = await getConversationSummary(phone, env);
  const updatedSummary: ConversationSummary = {
    phone,
    name: currentSummary?.name || `User (${phone.slice(-4)})`,
    lastMessage: msg.content.length > 80 ? msg.content.substring(0, 80) + '...' : msg.content,
    lastTimestamp: msg.timestamp,
    messageCount: history.length,
    unreadCount: msg.role === 'user' ? (currentSummary?.unreadCount || 0) + 1 : 0,
    lastMsgType: msg.msgType || 'text',
  };

  MEMORY_INDEX.set(phone, updatedSummary);

  MEMORY_TOTAL_MESSAGES++;
  if (msg.role === 'user') MEMORY_USER_MESSAGES++;
  else if (msg.role === 'assistant') MEMORY_AI_MESSAGES++;
  else if (msg.role === 'admin') MEMORY_ADMIN_MESSAGES++;

  if (env.CHAT_KV) {
    try {
      const kvTasks: Promise<any>[] = [
        env.CHAT_KV.put(key, JSON.stringify(history)),
        env.CHAT_KV.put(`summary:${phone}`, JSON.stringify(updatedSummary)),
        env.CHAT_KV.put('stats:total_messages', MEMORY_TOTAL_MESSAGES.toString()),
      ];

      const indexRaw = await env.CHAT_KV.get('conversations:index');
      let indexList: string[] = indexRaw ? JSON.parse(indexRaw) : [];
      if (!indexList.includes(phone)) {
        indexList.push(phone);
        kvTasks.push(env.CHAT_KV.put('conversations:index', JSON.stringify(indexList)));
      }

      await Promise.all(kvTasks);
    } catch (err) {
      console.error('[!] KV Error saving chat message:', err);
    }
  }
}

/**
 * Get conversation summary details for a single user.
 */
export async function getConversationSummary(phone: string, env: Env): Promise<ConversationSummary | null> {
  if (env.CHAT_KV) {
    try {
      const raw = await env.CHAT_KV.get(`summary:${phone}`);
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  return MEMORY_INDEX.get(phone) || null;
}

/**
 * Save conversation summary to index.
 */
async function saveConversationSummary(summary: ConversationSummary, env: Env): Promise<void> {
  MEMORY_INDEX.set(summary.phone, summary);

  if (env.CHAT_KV) {
    try {
      await env.CHAT_KV.put(`summary:${summary.phone}`, JSON.stringify(summary));

      const indexRaw = await env.CHAT_KV.get('conversations:index');
      let indexList: string[] = indexRaw ? JSON.parse(indexRaw) : [];
      if (!indexList.includes(summary.phone)) {
        indexList.push(summary.phone);
        await env.CHAT_KV.put('conversations:index', JSON.stringify(indexList));
      }
    } catch (err) {
      console.error('[!] KV Error saving conversation index:', err);
    }
  }
}

/**
 * Get all active user conversation summaries for the Admin Dashboard sidebar.
 */
export async function getAllConversations(env: Env): Promise<ConversationSummary[]> {
  if (env.CHAT_KV) {
    try {
      const indexRaw = await env.CHAT_KV.get('conversations:index');
      if (indexRaw) {
        const phoneList: string[] = JSON.parse(indexRaw);
        const summaries: ConversationSummary[] = [];
        for (const phone of phoneList) {
          const s = await getConversationSummary(phone, env);
          if (s) summaries.push(s);
        }
        return summaries.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
      }
    } catch (err) {
      console.error('[!] KV Error reading all conversations:', err);
    }
  }

  return Array.from(MEMORY_INDEX.values()).sort(
    (a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()
  );
}

/**
 * Clear chat history and summary for a given phone number.
 */
export async function clearChatHistory(phone: string, env: Env): Promise<void> {
  MEMORY_CONVERSATIONS.delete(phone);
  MEMORY_INDEX.delete(phone);

  if (env.CHAT_KV) {
    try {
      await env.CHAT_KV.delete(`history:${phone}`);
      await env.CHAT_KV.delete(`summary:${phone}`);

      const indexRaw = await env.CHAT_KV.get('conversations:index');
      if (indexRaw) {
        let indexList: string[] = JSON.parse(indexRaw);
        indexList = indexList.filter((p) => p !== phone);
        await env.CHAT_KV.put('conversations:index', JSON.stringify(indexList));
      }
    } catch (err) {
      console.error(`[!] KV Error clearing history for ${phone}:`, err);
    }
  }
}

/**
 * Mark unread messages count as zero when admin opens a conversation.
 */
export async function markAsRead(phone: string, env: Env): Promise<void> {
  const summary = await getConversationSummary(phone, env);
  if (summary) {
    summary.unreadCount = 0;
    await saveConversationSummary(summary, env);
  }
}

/**
 * Calculate system health & analytics stats for Admin Dashboard.
 */
export async function getSystemStats(env: Env): Promise<SystemStats> {
  const conversations = await getAllConversations(env);

  return {
    totalConversations: conversations.length,
    totalMessages: MEMORY_TOTAL_MESSAGES,
    userMessagesCount: MEMORY_USER_MESSAGES,
    aiMessagesCount: MEMORY_AI_MESSAGES,
    adminMessagesCount: MEMORY_ADMIN_MESSAGES,
    openweatherConfigured: Boolean(env.OPENWEATHER_API_KEY),
    groqConfigured: Boolean(env.VITE_GROQ_API_KEY || env.GROQ_API_KEY),
    metaConfigured: Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID),
    twilioConfigured: Boolean(env.TWILIO_ACCOUNT_SID),
    whatsappBotPhone: (env.WHATSAPP_PHONE_NUMBER_ID || (env as any).TWILIO_WHATSAPP_NUMBER || '1172736052599427').toString(),
    uptimeStart: UPTIME_START,
  };
}

/**
 * Log security and admin audit events.
 */
export async function logAdminAction(action: string, details: string, ip?: string, env?: Env): Promise<void> {
  const log: AdminLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    action,
    details,
    ip: ip || '127.0.0.1',
  };

  MEMORY_LOGS.unshift(log);
  if (MEMORY_LOGS.length > 100) MEMORY_LOGS.pop();

  if (env?.CHAT_KV) {
    try {
      await env.CHAT_KV.put('logs:admin_recent', JSON.stringify(MEMORY_LOGS));
    } catch {}
  }
}

/**
 * Get recent admin action logs.
 */
export async function getAdminLogs(env: Env): Promise<AdminLogEntry[]> {
  if (env.CHAT_KV) {
    try {
      const raw = await env.CHAT_KV.get('logs:admin_recent');
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  return MEMORY_LOGS;
}
