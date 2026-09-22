const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const isLocal = currentHostname === 'localhost' || currentHostname === '127.0.0.1' || currentHostname.startsWith('192.168.') || currentHostname.startsWith('10.') || currentHostname.startsWith('172.');
const networkBackendUrl = isLocal ? `http://${currentHostname}:8000` : currentOrigin;

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || networkBackendUrl || 'http://localhost:8000').replace(/\/+$/, '');

const CANDIDATE_URLS = Array.from(new Set([
  API_BASE_URL,
  networkBackendUrl,
  currentOrigin,
  'http://localhost:8000',
  'http://127.0.0.1:8000'
].filter(Boolean)));

/**
 * Health check ping to wake up Render free hosting instance or verify backend availability.
 */
export async function checkBackendHealth() {
  for (const baseUrl of CANDIDATE_URLS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(`${baseUrl}/api/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response && response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          if (data && (data.status === 'ok' || data.backend === 'online' || data.status === 'online' || data.service)) {
            return { online: true, data, activeUrl: baseUrl };
          }
        }
      }
    } catch (err) {
    }
  }

  return { online: false, error: "Backend Unreachable" };
}

export async function sendChatMessage(message, chatHistory = []) {
  let lastError = null;

  const sanitizedHistory = (chatHistory || []).map(msg => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: typeof msg.content === 'string' ? msg.content : String(msg.content || '')
  }));

  for (const baseUrl of CANDIDATE_URLS) {
    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          chat_history: sanitizedHistory
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.response;
      } else {
        const errJson = await response.json().catch(() => ({}));
        console.warn(`[WeatherGPT API] Request to ${baseUrl}/api/chat returned status ${response.status}:`, errJson);
        lastError = new Error(errJson.detail || `Backend API error (${response.status})`);
      }
    } catch (err) {
      lastError = err;
      console.warn(`[WeatherGPT API] Could not reach ${baseUrl}/api/chat:`, err);
    }
  }

  throw lastError || new Error("Failed to connect to WeatherGPT backend API.");
}

export async function fetchSessionTitle(prompt) {
  for (const baseUrl of CANDIDATE_URLS) {
    try {
      const response = await fetch(`${baseUrl}/api/session/title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (response.ok) {
        const data = await response.json();
        return data.title;
      }
    } catch (e) {
    }
  }
  return null;
}

export async function checkVoiceInterruption(spokenText, currentlySpeakingText) {
  for (const baseUrl of CANDIDATE_URLS) {
    try {
      const response = await fetch(`${baseUrl}/api/voice/interrupt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spoken_text: spokenText,
          currently_speaking_text: currentlySpeakingText
        })
      });
      if (response.ok) {
        const data = await response.json();
        return data.is_interruption === true;
      }
    } catch (e) {
    }
  }
  return false;
}
