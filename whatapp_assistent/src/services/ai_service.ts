import { Env, ChatMessage, IntentResult } from '../types';

export async function callGroq(messages: { role: string; content: string }[], jsonMode: boolean, env: Env): Promise<string | null> {
  const apiKey = env.VITE_GROQ_API_KEY || env.GROQ_API_KEY || '';
  if (!apiKey) {
    console.error('[!] GROQ_API_KEY is missing');
    return null;
  }

  const model = env.VITE_GROQ_MODEL || 'openai/gpt-oss-120b';
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const payload: any = {
    model,
    messages,
    temperature: jsonMode ? 0.3 : 0.7,
  };
  if (jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'WeatherGPT-WhatsApp-Bot',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error(`[!] Groq API Error: ${res.status} ${res.statusText}`);
      return null;
    }

    const data: any = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('[!] Groq fetch exception:', err);
    return null;
  }
}

export async function classifyIntent(userInput: string, history: ChatMessage[], env: Env): Promise<IntentResult> {
  const historyContext = history.slice(-4).map((m) => `${m.role}: ${m.content}`).join('\n');
  const systemPrompt = `You are an intent classifier for a WhatsApp weather chatbot.
Analyze the user's message and recent chat history to determine intent.

Allowed intents:
- "current": User wants current weather.
- "forecast": User wants 5-day or upcoming weather forecast.
- "pollution": User wants air pollution or AQI data.
- "general": User is greeting, chatting, or asking general non-weather questions.

Extract the target 'city'. If not in the latest message, search recent chat history. Return null if no city is found.

Return ONLY a valid JSON object:
{
  "intent": "current" | "forecast" | "pollution" | "general",
  "city": "CityName" | null
}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Chat History:\n${historyContext}\n\nLatest User Message: ${userInput}` },
  ];

  const raw = await callGroq(messages, true, env);
  if (!raw) return { intent: 'general', city: null };

  try {
    let clean = raw.trim();
    if (clean.startsWith('```json')) clean = clean.slice(7, -3).trim();
    else if (clean.startsWith('```')) clean = clean.slice(3, -3).trim();
    return JSON.parse(clean);
  } catch {
    return { intent: 'general', city: null };
  }
}
