import { Router, type Request, type Response } from "express";
import { GoogleGenAI, Type } from '@google/genai';

const router = Router();

// Safely initialize GenAI - if key is missing, it will throw when instantiated, 
// so we wrap it or instantiate it conditionally if needed, but per the snippet we assume it's in process.env.
// Fallback key behavior can be handled if needed.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

router.post("/advisory", async (req: Request, res: Response): Promise<void> => {
  const telemetry = req.body;

  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({ success: false, error: 'GEMINI_API_KEY not configured on server' });
    return;
  }

  const prompt = `
    You are an expert urban climate advisor. Analyze the following real-time environmental 
    telemetry for ${telemetry.city_name || 'the target city'} and construct an actionable, 
    human-like heat mitigation advisory.

    IMPORTANT INSTRUCTION: Even if the telemetry indicates the city is currently in an optimal 
    or low-risk state (e.g., "green zone", low temperature, high vegetation), you MUST STILL 
    provide proactive, preventative, and maintenance-focused suggestions to preserve this optimal state. 
    Do NOT return empty action arrays.

    Telemetry Data:
    ${JSON.stringify(telemetry, null, 2)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            assessment: {
              type: Type.STRING,
              description: "Brief human-like overview of the perceived heat and humidity impact."
            },
            primaryDrivers: {
              type: Type.STRING,
              description: "Explanation of concrete, solar, or vegetation causes."
            },
            immediateActions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3-4 immediate operational steps for municipal teams."
            },
            strategicInterventions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Long-term infrastructure or urban planning changes."
            }
          },
          required: ['assessment', 'primaryDrivers', 'immediateActions', 'strategicInterventions']
        }
      }
    });

    const advisory = JSON.parse(response.text || '{}');
    res.status(200).json({ success: true, data: advisory });

  } catch (error) {
    console.error('LLM Advisory Generation Error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate advisory' });
  }
});

export default router;
