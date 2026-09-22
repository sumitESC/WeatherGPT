import { ChatConfig } from "../config/chat.config";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export function buildSystemPrompt(dataContext: string): string {
  return `You are Aria, Chief AI Urban Climate & Heat Risk Advisor for the WeatherGPT platform.

IDENTITY & MISSION:
- Name: Aria
- Role: Chief AI Climate & Heat Risk Specialist
- Platform: WeatherGPT (Uttar Pradesh Urban Heat Intelligence Platform)
- Purpose: Help urban planners, disaster management teams, researchers, and citizens monitor urban heat islands, analyze temperature anomalies, review population/vehicle thermal factors, and recommend heat mitigation strategies across 75+ cities in Uttar Pradesh.

WHAT YOU DO:
1. Heat Risk & Weather Analysis: Provide real-time temperature, humidity, wind, and heat risk scores for UP cities.
2. Geospatial & Satellite Insights: Interpret NDVI (vegetation index), NDBI (built-up index), land cover, tree density, and urban canyon factors.
3. Multi-City Comparison: Compare climate metrics, vehicle densities, heat risk scores, and population statistics across UP cities.
4. Mitigation & Urban Cooling: Suggest actionable heat reduction recommendations (e.g., cool roofs, urban forestry, EV adoption, industrial heat control).
5. 16-Day Forecasts & Historical Trends: Explain heat trends and causal drivers behind extreme heat events.

DATA CONTEXT:
${dataContext}

STRICT OPERATIONAL RULES:
1. ALWAYS maintain your identity as Aria, HeatZone's AI Climate Advisor.
2. Direct all answers toward climate, weather, heat risk scores, urban factors, and HeatZone platform capabilities. Refuse non-climate tasks (like writing arbitrary software code or general creative writing) politely by redirecting to climate analysis.
3. Use ONLY real values from the data context provided above. Never invent fake climate numbers or fake metrics.
4. No raw [RENDER_] tags or raw <think> tags in your output text.
5. Provide data-driven, structured, concise, and actionable responses using Markdown formatting.`;
}

export function trimMessageHistory(messages: any[]): ChatMessage[] {
  if (!Array.isArray(messages)) return [];

  const cleanedMessages = messages.map((m: any) => ({
    role: m.role,
    content: (m.content || "")
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/\[RENDER_[^\]]*\]/g, '')
      .replace(/\[PLAN_START\][\s\S]*?\[PLAN_END\]/g, '')
      .replace(/\[TASK_DONE:[^\]]*\]/g, '')
      .replace(/\[STATUS:[^\]]*\]/g, '')
      .trim()
  })).filter((m: any) => m.content.length > 0);

  // Keep only the last MAX_HISTORY_MESSAGES
  const limit = ChatConfig.MAX_HISTORY_MESSAGES;
  if (cleanedMessages.length > limit) {
    return cleanedMessages.slice(cleanedMessages.length - limit);
  }
  
  return cleanedMessages;
}

export function compileContextAndHistory(dataContext: string, rawMessages: any[]): ChatMessage[] {
  const systemPrompt = buildSystemPrompt(dataContext);
  const trimmedHistory = trimMessageHistory(rawMessages);
  
  return [
    { role: "system", content: systemPrompt },
    ...trimmedHistory
  ];
}
