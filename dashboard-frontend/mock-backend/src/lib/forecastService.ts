import fs from "fs/promises";
import path from "path";

import { simulateForecast, type ForecastDay } from "./weatherUtils.js";

const FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast";

// OpenWeatherMap uses legacy names for some renamed cities
const CITY_API_ALIASES: Record<string, string> = {
  "Prayagraj": "Allahabad",
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const CSV_FILE = path.join(DATA_DIR, "forecasts.csv");

const storedRecords = new Set<string>();
let isInitialized = false;

async function initCSV() {
  if (isInitialized) return;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      const data = await fs.readFile(CSV_FILE, "utf-8");
      const lines = data.split("\n");
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(",");
        if (cols.length >= 2) {
          storedRecords.add(`${cols[0]}_${cols[1]}`);
        }
      }
    } catch (e: any) {
      if (e.code === "ENOENT") {
        await fs.writeFile(
          CSV_FILE,
          "City,Date,TempMin,TempMax,TempAvg,FeelsLike,Humidity,WindSpeed,Pressure,CloudCover,Rainfall,Weather\n",
          "utf-8"
        );
      }
    }
    isInitialized = true;
  } catch (err) {
    console.error("Failed to initialize CSV", err);
  }
}

async function saveForecastsToCSV(cityName: string, days: ForecastDay[]) {
  await initCSV();
  try {
    const recordsToAppend: string[] = [];
    for (const day of days) {
      const key = `${cityName}_${day.date}`;
      if (!storedRecords.has(key)) {
        storedRecords.add(key);
        recordsToAppend.push(
          `${cityName},${day.date},${day.tempMin},${day.tempMax},${day.tempAvg},${day.feelsLike},${day.humidity},${day.windSpeed},${day.pressure},${day.cloudCover},${day.rainfall},${day.weatherMain}`
        );
      }
    }
    if (recordsToAppend.length > 0) {
      await fs.appendFile(CSV_FILE, recordsToAppend.join("\n") + "\n", "utf-8");
    }
  } catch (err) {
    console.error("Failed to save forecasts to CSV", err);
  }
}

interface ForecastItem {
  dt: number;
  dt_txt: string;
  main: { temp: number; feels_like: number; temp_min: number; temp_max: number; humidity: number; pressure: number };
  wind: { speed: number };
  clouds: { all: number };
  weather: Array<{ main: string; description: string; icon: string }>;
  rain?: { "3h"?: number };
}

interface ForecastApiResponse {
  list: ForecastItem[];
  city: { name: string };
}

export async function fetchCityForecast(cityName: string, lat: number, lon: number): Promise<ForecastDay[]> {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    console.warn("OPENWEATHER_API_KEY not set, using simulated forecast");
    const days = simulateForecastLocal(cityName);
    saveForecastsToCSV(cityName, days).catch(console.error);
    return days;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const queryName = CITY_API_ALIASES[cityName] ?? cityName;
    const url = `${FORECAST_URL}?q=${encodeURIComponent(queryName)},IN&appid=${apiKey}&units=metric`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`Forecast API error for ${cityName}: ${response.status}`);
      const days = simulateForecastLocal(cityName);
      saveForecastsToCSV(cityName, days).catch(console.error);
      return days;
    }

    const data = (await response.json()) as ForecastApiResponse;
    const days = aggregateToDays(data.list);
    saveForecastsToCSV(cityName, days).catch(console.error);
    return days;
  } catch (err) {
    console.error(`Failed to fetch forecast for ${cityName}:`, err);
    const days = simulateForecastLocal(cityName);
    saveForecastsToCSV(cityName, days).catch(console.error);
    return days;
  }
}

function aggregateToDays(items: ForecastItem[]): ForecastDay[] {
  const dayMap = new Map<string, ForecastItem[]>();

  for (const item of items) {
    const date = item.dt_txt.split(" ")[0]; // "YYYY-MM-DD"
    if (!dayMap.has(date)) dayMap.set(date, []);
    dayMap.get(date)!.push(item);
  }

  const days: ForecastDay[] = [];

  for (const [date, entries] of dayMap) {
    if (days.length >= 5) break;

    const temps = entries.map(e => e.main.temp);
    const humidities = entries.map(e => e.main.humidity);
    const winds = entries.map(e => e.wind.speed);
    const pressures = entries.map(e => e.main.pressure);
    const clouds = entries.map(e => e.clouds.all);
    const rain = entries.reduce((sum, e) => sum + (e.rain?.["3h"] ?? 0), 0);

    // Pick the midday entry for weather description (or first if not available)
    const midday = entries.find(e => e.dt_txt.includes("12:00:00")) || entries[Math.floor(entries.length / 2)];

    days.push({
      date,
      tempMin: Math.round(Math.min(...temps) * 10) / 10,
      tempMax: Math.round(Math.max(...temps) * 10) / 10,
      tempAvg: Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10,
      temperature: Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10,
      feelsLike: Math.round((entries.reduce((s, e) => s + e.main.feels_like, 0) / entries.length) * 10) / 10,
      humidity: Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length),
      windSpeed: Math.round((winds.reduce((a, b) => a + b, 0) / winds.length) * 10) / 10,
      pressure: Math.round(pressures.reduce((a, b) => a + b, 0) / pressures.length),
      cloudCover: Math.round(clouds.reduce((a, b) => a + b, 0) / clouds.length),
      rainfall: Math.round(rain * 10) / 10,
      weatherMain: midday.weather[0]?.main ?? "Clear",
      weatherDescription: midday.weather[0]?.description ?? "clear sky",
      weatherIcon: midday.weather[0]?.icon ?? "01d",
    });
  }

  return days;
}

function simulateForecastLocal(cityName: string): ForecastDay[] {
  return simulateForecast(cityName);
}
