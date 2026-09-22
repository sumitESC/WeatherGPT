// llmService.ts - Powered by Groq API
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_FALLBACK_MODEL = "groq/compound";

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

async function fetchWithGroqFallback(requestBody: any) {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const headers = {
    "Authorization": `Bearer ${GROQ_API_KEY}`,
    "Content-Type": "application/json"
  };

  let response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody)
  });

  if (!response.ok && requestBody.model !== GROQ_FALLBACK_MODEL) {
    console.warn(`[Groq] Model ${requestBody.model} returned status ${response.status}. Falling back to ${GROQ_FALLBACK_MODEL}...`);
    requestBody.model = GROQ_FALLBACK_MODEL;
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody)
    });
  }

  return response;
}

export async function generateResponseStream(
  systemPrompt: string,
  conversationHistory: Message[],
  options?: any
): Promise<AsyncGenerator<string, void, unknown>> {
  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
  ];

  const targetModel = options?.model || GROQ_MODEL;
  console.log(`[Groq] Generating STREAM response using model: ${targetModel}`);

  const requestBody: any = {
    model: targetModel,
    messages: messages,
    stream: true,
  };

  if (options?.temperature !== undefined) requestBody.temperature = options.temperature;
  if (options?.max_tokens !== undefined) requestBody.max_tokens = options.max_tokens;

  const response = await fetchWithGroqFallback(requestBody);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq HTTP error! status: ${response.status}, message: ${errText}`);
  }

  async function* streamGenerator() {
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            const parsed = JSON.parse(line.slice(6));
            const content = parsed.choices?.[0]?.delta?.content || "";
            if (content) yield content;
          } catch (e) {
            // ignore partial JSON parse errors
          }
        }
      }
    }
  }

  return streamGenerator();
}

export async function generateResponse(
  systemPrompt: string,
  conversationHistory: Message[],
  options?: any
): Promise<string> {
  try {
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
    ];

    const targetModel = options?.model || GROQ_MODEL;
    console.log(`[Groq] Generating response using model: ${targetModel}`);

    const requestBody: any = {
      model: targetModel,
      messages: messages,
      stream: false,
    };

    if (options?.temperature !== undefined) requestBody.temperature = options.temperature;
    if (options?.max_tokens !== undefined) requestBody.max_tokens = options.max_tokens;
    if (options?.format === "json") {
      requestBody.response_format = { type: "json_object" };
    }

    const response = await fetchWithGroqFallback(requestBody);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq HTTP error! status: ${response.status}, message: ${errText}`);
    }

    const result: any = await response.json();
    let content = result?.choices?.[0]?.message?.content || "";

    if (content) {
      content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    }

    return content;
  } catch (error: any) {
    console.error('[Groq] API Error:', error.message || error);
    throw new Error("Cannot reach Groq API or model failed.");
  }
}
