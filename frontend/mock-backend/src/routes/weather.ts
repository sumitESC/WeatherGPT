import { Router } from "express";
import { db, citiesTable, weatherDataTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { fetchCityWeather } from "../lib/weatherService.js";
import { computeHeatRisk, generateRecommendations } from "../lib/heatEngine.js";
import { heatPredictionsTable, recommendationsTable } from "@workspace/db";

const router = Router();

router.get("/weather/current/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const cityId = parseInt(raw, 10);
  if (isNaN(cityId)) {
    res.status(400).json({ error: "Invalid city id" });
    return;
  }

  const [city] = await db.select().from(citiesTable).where(eq(citiesTable.id, cityId));
  if (!city) {
    res.status(404).json({ error: "City not found" });
    return;
  }

  const [latest] = await db
    .select()
    .from(weatherDataTable)
    .where(eq(weatherDataTable.cityId, cityId))
    .orderBy(desc(weatherDataTable.recordedAt))
    .limit(1);

  if (!latest) {
    res.status(404).json({ error: "No weather data available" });
    return;
  }

  res.json({ ...latest, cityName: city.name });
});

router.get("/weather/history/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const cityId = parseInt(raw, 10);
  if (isNaN(cityId)) {
    res.status(400).json({ error: "Invalid city id" });
    return;
  }

  const limitRaw = req.query.limit;
  const limit = limitRaw ? parseInt(String(limitRaw), 10) : 20;

  const [city] = await db.select().from(citiesTable).where(eq(citiesTable.id, cityId));
  if (!city) {
    res.status(404).json({ error: "City not found" });
    return;
  }

  const history = await db
    .select()
    .from(weatherDataTable)
    .where(eq(weatherDataTable.cityId, cityId))
    .orderBy(desc(weatherDataTable.recordedAt))
    .limit(limit);

  res.json(history.map((w) => ({ ...w, cityName: city.name })));
});

import { logWeatherDataset, logForecastDataset, logPredictionDataset } from "../lib/datasetService.js";
import { fetchCityForecast } from "../lib/forecastService.js";

export async function refreshWeatherForAllCities() {
  const cities = await db.select().from(citiesTable);
  let citiesUpdated = 0;

  for (const city of cities) {
    try {
      // Fetch 5-day forecast first to ensure alignment
      const forecast = await fetchCityForecast(city.name, city.latitude, city.longitude);
      if (!forecast || forecast.length === 0) {
        console.warn(`No forecast available for ${city.name}, falling back to current weather API`);
        const weatherData = await fetchCityWeather(city.name);
        if (!weatherData) continue;
        await processAndStore(city, weatherData, null);
      } else {
        // Use Day 0 forecast for current weather display consistency
        const today = forecast[0];
        const weatherData = {
          temperature: today.temperature, // Day's current-representative temp
          feelsLike: today.feelsLike,
          humidity: today.humidity,
          windSpeed: today.windSpeed,
          pressure: today.pressure,
          cloudCover: today.cloudCover,
          rainfall: today.rainfall,
          weatherMain: today.weatherMain,
          weatherDescription: today.weatherDescription,
        };
        await processAndStore(city, weatherData, forecast);
      }
      citiesUpdated++;
    } catch (err) {
      console.error(`Error refreshing weather for ${city.name}:`, err);
    }
  }
  return citiesUpdated;
}

async function processAndStore(city: any, weatherData: any, forecast: any[] | null) {
  const [inserted] = await db
    .insert(weatherDataTable)
    .values({ cityId: city.id, ...weatherData })
    .returning();

  if (!inserted) return;

  const heatResult = computeHeatRisk(city, inserted.temperature, inserted.humidity, inserted.windSpeed);

  const prediction = {
    cityId: city.id,
    heatRiskScore: heatResult.heatRiskScore,
    heatZone: heatResult.heatZone,
    temperature: inserted.temperature,
    humidity: inserted.humidity,
    vehicleDensity: heatResult.factors.vehicleDensity,
    populationDensity: heatResult.factors.populationDensity,
    greenCoverRatio: heatResult.factors.greenCoverRatio,
    builtUpRatio: heatResult.factors.builtUpRatio,
    coolingIndex: heatResult.factors.coolingIndex,
    trafficHeatFactor: heatResult.factors.trafficHeatFactor,
    ndvi: heatResult.ndvi,
    ndbi: heatResult.ndbi,
    emissionIndex: heatResult.emissionIndex,
    avgBuildingHeight: heatResult.avgBuildingHeight,
    urbanCanyonIndex: heatResult.urbanCanyonIndex,
    confidenceScore: heatResult.confidenceScore,
  };

  console.log(`DEBUG: Inserting prediction for ${city.name}:`, JSON.stringify(prediction, null, 2));

  await db.insert(heatPredictionsTable).values(prediction);

  await db.delete(recommendationsTable).where(eq(recommendationsTable.cityId, city.id));
  const recs = generateRecommendations(city.id, city, heatResult.factors, heatResult.heatRiskScore);
  if (recs.length > 0) {
    await db.insert(recommendationsTable).values(recs);
  }

  // --- AUTOMATED DATASET COLLECTION ---
  // Log into JSON for model training
  await logWeatherDataset(city.id, city.name, weatherData);
  if (forecast) {
    await logForecastDataset(city.id, city.name, forecast);
  }
  await logPredictionDataset(city.id, city.name, prediction);
}

router.post("/weather/refresh", async (_req, res): Promise<void> => {
  const count = await refreshWeatherForAllCities();
  res.json({ success: true, citiesUpdated: count, message: `Weather and heat predictions updated for ${count} cities. Dataset created.` });
});

export default router;
