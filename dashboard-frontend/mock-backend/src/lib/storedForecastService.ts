import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the ML project's generated forecast file
const ML_FORECAST_FILE_PATH = path.resolve(
  __dirname,
  "../../../../../heatzone-weather-api/dashboard/data/all_cities_heatscore_forecast.json"
);

// In-memory cache
let forecastCache: Record<string, any> = {};
let lastCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getStoredForecast(cityName: string): Promise<any | null> {
  const now = Date.now();

  // Refresh cache if empty or stale
  if (Object.keys(forecastCache).length === 0 || now - lastCacheTime > CACHE_TTL_MS) {
    try {
      if (fs.existsSync(ML_FORECAST_FILE_PATH)) {
        const fileData = await fs.promises.readFile(ML_FORECAST_FILE_PATH, "utf-8");
        const parsedData = JSON.parse(fileData);
        
        // Rebuild cache keyed by lowercase city name
        const newCache: Record<string, any> = {};
        if (Array.isArray(parsedData)) {
            for (const item of parsedData) {
                if (item.city) {
                    newCache[item.city.toLowerCase()] = item;
                }
            }
        }
        forecastCache = newCache;
        lastCacheTime = now;
      } else {
        console.warn(`[StoredForecast] File not found at ${ML_FORECAST_FILE_PATH}`);
      }
    } catch (error) {
      console.error("[StoredForecast] Failed to read forecast JSON:", error);
    }
  }

  // Look up city in cache
  const cityKey = cityName.toLowerCase();
  const cityData = forecastCache[cityKey];

  if (cityData) {
    return cityData;
  }

  return null;
}
