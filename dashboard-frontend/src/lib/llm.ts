export interface TelemetryData {
  city_name?: string;
  temperature?: number;
  heatRiskScore?: number;
  ndvi?: number;
  ndbi?: number;
  heatZone?: string;
  vehicleDensity?: number;
  populationDensity?: number;
  waterIndex?: number;
}

export interface LlmAdvisory {
  assessment: string;
  primaryDrivers: string;
  immediateActions: string[];
  strategicInterventions: string[];
}

export async function generateLlmAdvisory(telemetry: TelemetryData): Promise<LlmAdvisory> {
  const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!groqApiKey) {
    throw new Error("Missing API Key: Please add VITE_GROQ_API_KEY to heatzone-frontend/.env");
  }

  const model = import.meta.env.VITE_GROQ_MODEL || "llama3-70b-8192";

  const systemPrompt = `You are an expert urban climate advisor. Analyze the real-time environmental telemetry and construct an actionable, human-like heat mitigation advisory.

IMPORTANT INSTRUCTION: Even if the telemetry indicates the city is currently in an optimal or low-risk state (e.g., "green zone", low temperature, high vegetation), you MUST STILL provide proactive, preventative, and maintenance-focused suggestions to preserve this optimal state. Do NOT return empty action arrays.

You MUST respond strictly in valid JSON format matching this structure exactly:
{
  "assessment": "Brief human-like overview of the perceived heat and humidity impact.",
  "primaryDrivers": "Explanation of concrete, solar, or vegetation causes.",
  "immediateActions": ["Action 1", "Action 2", "Action 3"],
  "strategicInterventions": ["Intervention 1", "Intervention 2"]
}`;

  const userPrompt = `Telemetry Data for ${telemetry.city_name || 'target city'}:\n${JSON.stringify(telemetry, null, 2)}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${groqApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    })
  });

  const result = await res.json();
  if (!res.ok) {
    throw new Error(result.error?.message || "Unknown API Error from AI Provider");
  }

  const content = result.choices?.[0]?.message?.content || "{}";
  return JSON.parse(content) as LlmAdvisory;
}
