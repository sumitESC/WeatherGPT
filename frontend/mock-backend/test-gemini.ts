import { GoogleGenAI, Type } from '@google/genai';
import * as dotenv from 'dotenv';
import path from 'path';

// Load the .env file from the mock-backend directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

async function testGemini() {
  console.log("🚀 Testing Gemini API Connection...");

  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ ERROR: GEMINI_API_KEY is not set in .env!");
    return;
  }

  // Sample telemetry data mimicking Lucknow
  const telemetry = {
    city_name: 'Lucknow',
    temperature: 34.5,
    heatRiskScore: 68,
    ndvi: 0.28,
    ndbi: 0.42,
    heatZone: 'HIGH',
    vehicleDensity: 1127
  };

  const prompt = `
    You are an expert urban climate advisor. Analyze the following real-time environmental 
    telemetry for ${telemetry.city_name || 'the target city'} and construct an actionable, 
    human-like heat mitigation advisory:

    Telemetry Data:
    ${JSON.stringify(telemetry, null, 2)}
  `;

  console.log("Sending prompt to Gemini... (This might take a few seconds)");
  
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

    console.log("\n✅ SUCCESS! Received this payload from Gemini:\n");
    
    // Parse and print the JSON exactly as the frontend will receive it
    const advisory = JSON.parse(response.text || '{}');
    console.log(JSON.stringify(advisory, null, 2));

  } catch (error) {
    console.error('\n❌ ERROR connecting to Gemini:');
    console.error(error);
  }
}

testGemini();
