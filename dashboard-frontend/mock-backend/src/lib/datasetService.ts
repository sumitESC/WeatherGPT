import fs from "fs/promises";
import path from "path";

const DATASETS_DIR = path.resolve(process.cwd(), "data", "datasets");

/**
 * Ensures the datasets directory exists.
 */
async function ensureDir() {
  try {
    await fs.mkdir(DATASETS_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create datasets directory:", err);
  }
}

/**
 * Logs data to a JSON file (appends to a list).
 */
async function logToJson(filename: string, data: any) {
  await ensureDir();
  const filePath = path.join(DATASETS_DIR, filename);
  let currentData: any[] = [];

  try {
    const fileContent = await fs.readFile(filePath, "utf-8");
    currentData = JSON.parse(fileContent);
  } catch (err: any) {
    // If file doesn't exist, start with empty list
    if (err.code !== "ENOENT") {
      console.error(`Error reading ${filename}:`, err);
    }
  }

  currentData.push({
    ...data,
    loggedAt: new Date().toISOString(),
  });

  try {
    await fs.writeFile(filePath, JSON.stringify(currentData, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error writing to ${filename}:`, err);
  }
}

/**
 * Logs current weather data for a city.
 */
export async function logWeatherDataset(cityId: number, cityName: string, weather: any) {
  await logToJson("weather_history.json", { cityId, cityName, ...weather });
}

/**
 * Logs 5-day forecast data for a city.
 */
export async function logForecastDataset(cityId: number, cityName: string, forecast: any[]) {
  await logToJson("forecast_history.json", { cityId, cityName, forecast });
}

/**
 * Logs heat risk predictions.
 */
export async function logPredictionDataset(cityId: number, cityName: string, prediction: any) {
  await logToJson("prediction_history.json", { cityId, cityName, ...prediction });
}
