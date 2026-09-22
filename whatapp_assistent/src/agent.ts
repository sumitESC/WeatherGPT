import { Env, ChatMessage, IntentResult } from './types';
import * as weather from './services/weather_service';
import * as storage from './services/storage_service';
import { callGroq, classifyIntent } from './services/ai_service';

export { callGroq, classifyIntent };

/**
 * Handle system commands & greeting triggers.
 */
export async function handleCommand(phone: string, text: string, env: Env): Promise<string | null> {
  const lower = text.trim().toLowerCase();
  if (['/start', '/menu', '/help', 'menu', 'hi', 'hello', 'start', 'hey', 'greetings'].includes(lower)) {
    return (
      '👋 *Welcome to WeatherGPT Executive AI Assistant!*\n\n' +
      'I am your 24/7 intelligent Weather & Climate companion powered by Groq LLM & OpenWeather API.\n\n' +
      '🌟 *What I can do for you:*\n' +
      '• 🌤️ *Real-Time Weather:* _"What is the weather in Tokyo?"_\n' +
      '• 📅 *5-Day Forecasts:* _"5-day forecast for London"_\n' +
      '• 🍃 *Air Quality Index (AQI):* _"Air pollution in Delhi"_\n' +
      '• 📍 *GPS Location Pin:* Share your live location on WhatsApp for instant reports!\n\n' +
      '⚙️ *Commands:*\n' +
      '• `/menu` - Show main menu & instructions\n' +
      '• `/reset` - Clear conversation context\n\n' +
      '💬 *Send a city name or location pin to begin!* 🚀'
    );
  }

  if (['/reset', 'reset', '/clear', 'clear'].includes(lower)) {
    await storage.clearChatHistory(phone, env);
    return '🧹 *Chat context reset!* Ask me a new question about any city or share your location pin.';
  }

  return null;
}

/**
 * Handle unsupported media messages (images, audio, voice notes, video, documents, stickers).
 */
export async function handleUnsupportedMedia(phone: string, mediaType: string, env: Env): Promise<string> {
  const mediaIcons: Record<string, string> = {
    image: '📷 *Image Received*',
    audio: '🎵 *Audio Received*',
    voice: '🎙️ *Voice Note Received*',
    video: '🎥 *Video Received*',
    document: '📄 *Document Received*',
    sticker: '👾 *Sticker Received*',
  };

  const title = mediaIcons[mediaType] || '📎 *Media Received*';
  const reply =
    `${title}\n\n` +
    `WeatherGPT currently processes *text messages* and *GPS location pins* for live weather & climate reports!\n\n` +
    `👉 *How to use WeatherGPT:*\n` +
    `• Type any city name: _"Weather in Paris"_\n` +
    `• Share your *Live GPS Location Pin* on WhatsApp! 📍`;

  const now = new Date().toISOString();
  await storage.saveChatMessage(phone, { id: `msg_${Date.now()}_u`, role: 'user', content: `[Sent ${mediaType}]`, timestamp: now, msgType: 'text' }, env);
  await storage.saveChatMessage(phone, { id: `msg_${Date.now()}_a`, role: 'assistant', content: reply, timestamp: new Date(Date.now() + 50).toISOString(), msgType: 'text' }, env);

  return reply;
}

export async function fetchWeatherContext(intent: string, city: string, env: Env): Promise<string> {
  if (!city) return '';
  try {
    if (intent === 'current') {
      const data = await weather.getCurrentWeather(city, env);
      return `[Real-time Weather Data]\n${weather.formatWeatherCard(data)}`;
    } else if (intent === 'forecast') {
      const data = await weather.get5DayForecast(city, env);
      const summary = data.list.slice(0, 4).map((item: any) => {
        const time = item.dt_txt;
        const temp = Math.round(item.main.temp);
        const cond = item.weather[0].description;
        return `• *${time}*: ${temp}°C, ${cond}`;
      });
      return `[Real-time Forecast for ${city}]\n` + summary.join('\n');
    } else if (intent === 'pollution') {
      const geo = await weather.getGeocoding(city, env);
      if (!geo.length) return `[Failed] Could not find coordinates for ${city}.`;
      const pollution = await weather.getAirPollution(geo[0].lat, geo[0].lon, env);
      return `[Real-time Air Quality]\n${weather.formatAqiCard(city, pollution)}`;
    }
  } catch (err: any) {
    return `[Error fetching weather data] ${err.message}`;
  }
  return '';
}

export async function handleLocationMessage(phone: string, lat: number, lon: number, env: Env): Promise<string> {
  try {
    const geo = await weather.getReverseGeocoding(lat, lon, env);
    const cityName = geo.length ? geo[0].name : `Location (${lat.toFixed(2)}, ${lon.toFixed(2)})`;

    const weatherData = await weather.getCurrentWeatherByCoords(lat, lon, env);
    const weatherCard = weather.formatWeatherCard(weatherData);

    let aqiStr = '';
    try {
      const aqiData = await weather.getAirPollution(lat, lon, env);
      const aqiVal = aqiData.list[0].main.aqi;
      const aqiLabels: Record<number, string> = { 1: 'Good 🟢', 2: 'Fair 🟡', 3: 'Moderate 🟠', 4: 'Poor 🔴', 5: 'Very Poor 🟣' };
      aqiStr = `\n🍃 *AQI Level:* ${aqiVal} (${aqiLabels[aqiVal] || 'Unknown'})`;
    } catch {}

    const reply =
      `📍 *Weather Report for Pinned Location*\n\n` +
      `${weatherCard}${aqiStr}\n\n` +
      `💡 _Need a 5-day forecast for ${cityName}? Just reply "5-day forecast"._`;

    const now = new Date().toISOString();
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content: `[Sent Location Pin: ${cityName}]`,
      timestamp: now,
      msgType: 'location',
      location: { latitude: lat, longitude: lon },
    };
    const aiMsg: ChatMessage = {
      id: `msg_${Date.now()}_a`,
      role: 'assistant',
      content: reply,
      timestamp: new Date(Date.now() + 50).toISOString(),
      msgType: 'text',
    };

    await storage.saveChatMessage(phone, userMsg, env);
    await storage.saveChatMessage(phone, aiMsg, env);

    return reply;
  } catch {
    return '⚠️ *Location Error:* Could not fetch weather for the provided location. Please try sending a city name instead.';
  }
}

export async function generateWhatsAppResponse(phone: string, userInput: string, env: Env): Promise<string> {
  const cmd = await handleCommand(phone, userInput, env);
  if (cmd) {
    const now = new Date().toISOString();
    await storage.saveChatMessage(phone, { id: `msg_${Date.now()}_u`, role: 'user', content: userInput, timestamp: now, msgType: 'command' }, env);
    await storage.saveChatMessage(phone, { id: `msg_${Date.now()}_a`, role: 'assistant', content: cmd, timestamp: new Date(Date.now() + 50).toISOString(), msgType: 'text' }, env);
    return cmd;
  }

  const history = await storage.getChatHistory(phone, env);
  const { intent, city } = await classifyIntent(userInput, history, env);

  let context = '';
  if (intent !== 'general') {
    if (city) {
      context = await fetchWeatherContext(intent, city, env);
    } else {
      context = '[System Context] User requested weather info but specified no city. Ask politely which city they want to check.';
    }
  }

  const systemPrompt = `You are WeatherGPT, a professional executive AI WhatsApp Weather & Climate Assistant.

CRITICAL WHATSAPP UI FORMATTING RULES:
- BOLD: Use SINGLE asterisks like *text* for bold headings, key values, and city names. NEVER use double asterisks (**text**) because WhatsApp UI does NOT support double asterisks.
- ITALIC: Use SINGLE underscores like _text_ for tips, advice, or secondary notes.
- EMOJIS: Use rich, relevant emojis (🌤️, 🌧️, 🌡️, 💨, 🍃, ☂️, ⚡, 📊, 📍, ☀️, ☁️).
- STRUCTURE: Use clean vertical line breaks and spacing to separate sections neatly. NEVER output full-width box lines (like ━ or ─) because they wrap into broken multi-line bars on mobile WhatsApp screens.
- BULLETS: Use bullet points (• ) for lists.
- NO RAW DATA: Never output raw JSON, internal system debug strings, or markdown headers like '#' or '##'.

CRITICAL LANGUAGE RULES:
- STRICT NO HINGLISH POLICY: NEVER output Hinglish (mixing Hindi and English words together like "bhai", "yaar", "kya", etc.).
- If the user speaks in English, respond strictly in pure English.
- If the user speaks in Hindi, respond strictly in pure Hindi (Devanagari script).
- If the user speaks in any other language, respond strictly in that language.`;

  const messages: { role: string; content: string }[] = [{ role: 'system', content: systemPrompt }];
  for (const m of history.slice(-6)) {
    messages.push({ role: m.role === 'admin' ? 'assistant' : m.role, content: m.content });
  }

  let finalPrompt = userInput;
  if (context) finalPrompt += `\n\n${context}`;
  messages.push({ role: 'user', content: finalPrompt });

  const reply = await callGroq(messages, false, env);
  const finalReply = reply || "Sorry, I couldn't process your request right now. Please try again in a moment! 🌤️";

  const now = new Date().toISOString();
  const userMsg: ChatMessage = { id: `msg_${Date.now()}_u`, role: 'user', content: userInput, timestamp: now, msgType: 'text' };
  const aiMsg: ChatMessage = { id: `msg_${Date.now()}_a`, role: 'assistant', content: finalReply, timestamp: new Date(Date.now() + 50).toISOString(), msgType: 'text' };

  await storage.saveChatMessage(phone, userMsg, env);
  await storage.saveChatMessage(phone, aiMsg, env);

  return finalReply;
}
