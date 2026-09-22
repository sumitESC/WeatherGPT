import { db, citiesTable } from "@workspace/db";
import { ChatConfig } from "../config/chat.config";

export interface DetectedIntent {
  type: "map" | "chart" | "report" | "forecast" | "comparison" | "recommendations" | "heatzone" | "weather" | "overview" | "history" | "general" | "error";
  cityId?: number;
  cityName?: string;
  cityIds?: number[];
  cityNames?: string[];
  year?: string;
  month?: string;
  errorMessage?: string;
}

export interface PlanTask { 
  id: string; 
  description: string; 
}

let cachedCities: any[] | null = null;
let lastCacheTime = 0;

export async function detectIntent(userMessage: string, contextCityId?: number): Promise<DetectedIntent> {
  const msg = userMessage.toLowerCase();

  try {
    if (!cachedCities || (Date.now() - lastCacheTime > ChatConfig.DB_CACHE_TTL)) {
      cachedCities = await db.select().from(citiesTable);
      lastCacheTime = Date.now();
    }
  } catch (err) {
    console.error("[IntentAnalyzer] DB fetch failed, using empty city cache", err);
    if (!cachedCities) cachedCities = [];
  }

  const matchedCities = (cachedCities || []).filter(c => c.name && msg.includes(c.name.toLowerCase()));
  const cityIds = matchedCities.map(c => c.id);
  const cityNames = matchedCities.map(c => c.name);
  const cityId = cityIds.length > 0 ? cityIds[0] : contextCityId ?? undefined;
  const cityName = cityNames.length > 0 ? cityNames[0] : undefined;
  
  const intentBase = { cityId, cityName, cityIds, cityNames };

  if (msg.match(/\b(report|full analysis|complete analytics|generate report|detailed report|full report)\b/)) return { type: "report", ...intentBase };
  if (msg.match(/\b(map|geospatial|location|satellite)\b/)) return { type: "map", ...intentBase };
  if (msg.match(/\b(compar|ranking|rank|versus|vs)\b/)) return { type: "comparison", ...intentBase };
  if (msg.match(/\b(forecast|16\.day|sixteen\.day|16-day|5\.day|five\.day|next.*days|upcoming|rain|rainfall)\b/)) return { type: "forecast", ...intentBase };
  if (msg.match(/\b(history|historical|past|previous|was the weather|in 202[0-5]|last year|last month)\b/)) {
    let year = "2023";
    let month = "01";
    const yearMatch = msg.match(/\b(202[0-5])\b/);
    if (yearMatch) year = yearMatch[1];
    const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    for (let i = 0; i < months.length; i++) {
      if (msg.includes(months[i])) { month = (i + 1).toString().padStart(2, '0'); break; }
    }
    return { type: "history", ...intentBase, year, month };
  }
  if (msg.match(/\b(trend|graph|chart|temperature trend|temp trend)\b/)) return { type: "chart", ...intentBase };
  if (msg.match(/\b(recommend|suggestion|reduc|solution|cool|action|mitigation)\b/)) return { type: "recommendations", ...intentBase };
  if (msg.match(/\b(heat.*score|heat.*zone|heat.*risk|heat.*index|urban heat)\b/)) return { type: "heatzone", ...intentBase };
  if (msg.match(/\b(weather|temperature|humidity|wind|current)\b/)) return { type: "weather", ...intentBase };
  if (msg.match(/\b(overview|summary|all cities|platform|dashboard)\b/)) return { type: "overview", ...intentBase };

  return { type: "general", ...intentBase };
}

export function generatePlanTasks(intent: DetectedIntent): PlanTask[] {
  const base: PlanTask[] = [{ id: "task_1", description: "Analyze query intent" }];
  const cityLabel = intent.cityName || "target area";
  switch (intent.type) {
    case "forecast": case "chart":
      return [...base, { id: "task_2", description: `Fetch forecast data for ${cityLabel}` }, { id: "task_3", description: "Generate analysis" }];
    case "weather":
      return [...base, { id: "task_2", description: `Fetch live weather for ${cityLabel}` }, { id: "task_3", description: "Analyze conditions" }];
    case "comparison":
      return [...base, { id: "task_2", description: "Fetch multi-city heat data" }, { id: "task_3", description: "Compare and rank" }];
    case "report":
      return [...base, { id: "task_2", description: `Compile full report for ${cityLabel}` }, { id: "task_3", description: "Generate insights" }];
    case "map":
      return [...base, { id: "task_2", description: `Load geospatial data for ${cityLabel}` }];
    case "heatzone":
      return [...base, { id: "task_2", description: `Fetch heat risk data for ${cityLabel}` }];
    case "history":
      return [...base, { id: "task_2", description: `Fetch historical data for ${cityLabel}` }];
    case "recommendations":
      return [...base, { id: "task_2", description: `Fetch recommendations for ${cityLabel}` }];
    case "overview":
      return [...base, { id: "task_2", description: "Load platform overview" }];
    case "error":
      return [...base, { id: "task_2", description: "Handling error state" }];
    default:
      return [...base, { id: "task_2", description: "Fetch climate data" }];
  }
}

// For unit testing purposes
export function _setCachedCities(cities: any[]) {
  cachedCities = cities;
  lastCacheTime = Date.now();
}
