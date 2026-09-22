import { Router, type IRouter } from "express";
import { db, citiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { fetchCityForecast } from "../lib/forecastService.js";
import { fetchMLForecast } from "../lib/mlProxyService.js";

const router: IRouter = Router();

// GET /api/forecast/all/compare — 5-day forecast summary for all cities (parallel)
router.get("/forecast/all/compare", async (_req, res): Promise<void> => {
  try {
    const cities = await db.select().from(citiesTable);

    const results = await Promise.all(
      cities.map(async (city) => {
        const forecast = await fetchCityForecast(city.name, city.latitude, city.longitude);
        return {
          cityId: city.id,
          cityName: city.name,
          forecast,
        };
      })
    );

    res.json(results);
  } catch (err) {
    console.error("Forecast all/compare error:", err);
    res.status(500).json({ error: "Failed to fetch forecasts" });
  }
});

// GET /api/forecast/unified/:id — Combined OpenWeather 5-day + ML 16-day forecast
router.get("/forecast/unified/:id", async (req, res): Promise<void> => {
  try {
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

    // Fetch both forecasts in parallel
    const [openWeatherForecast, mlForecast] = await Promise.all([
      fetchCityForecast(city.name, city.latitude, city.longitude),
      fetchMLForecast(city.name),
    ]);

    // Build a combined timeline
    const combinedTimeline: Array<{
      date: string;
      source: string;
      openweather: Record<string, unknown> | null;
      ml_model: Record<string, unknown> | null;
    }> = [];

    // Create a date map from OpenWeather data
    const owByDate = new Map<string, (typeof openWeatherForecast)[number]>();
    for (const day of openWeatherForecast) {
      owByDate.set(day.date, day);
    }

    // Create a date map from ML data
    const mlByDate = new Map<string, Record<string, unknown>>();
    if (mlForecast?.predictions) {
      for (const pred of mlForecast.predictions) {
        mlByDate.set(pred.date, pred as unknown as Record<string, unknown>);
      }
    }

    // Collect all unique dates and sort them
    const allDates = new Set([...owByDate.keys(), ...mlByDate.keys()]);
    const sortedDates = [...allDates].sort();

    for (const date of sortedDates) {
      const owDay = owByDate.get(date);
      const mlDay = mlByDate.get(date);

      let source = "none";
      if (owDay && mlDay) source = "openweather+ml";
      else if (owDay) source = "openweather";
      else if (mlDay) source = "ml";

      combinedTimeline.push({
        date,
        source,
        openweather: owDay
          ? {
              tempMax: owDay.tempMax,
              tempMin: owDay.tempMin,
              tempAvg: owDay.tempAvg,
              humidity: owDay.humidity,
              windSpeed: owDay.windSpeed,
              rainfall: owDay.rainfall,
              weatherMain: owDay.weatherMain,
              weatherDescription: owDay.weatherDescription,
            }
          : null,
        ml_model: mlDay || null,
      });
    }

    res.json({
      cityId: city.id,
      cityName: city.name,
      latitude: city.latitude,
      longitude: city.longitude,
      openweather_5day: openWeatherForecast,
      ml_16day: mlForecast?.predictions ?? null,
      ml_available: mlForecast !== null,
      combined_timeline: combinedTimeline,
    });
  } catch (err) {
    console.error("Unified forecast error:", err);
    res.status(500).json({ error: "Failed to fetch unified forecast" });
  }
});

// GET /api/forecast/:id — 5-day OpenWeather forecast for a specific city
router.get("/forecast/:id", async (req, res): Promise<void> => {
  try {
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

    const forecast = await fetchCityForecast(city.name, city.latitude, city.longitude);

    res.json({
      cityId: city.id,
      cityName: city.name,
      latitude: city.latitude,
      longitude: city.longitude,
      forecast,
    });
  } catch (err) {
    console.error("Forecast error:", err);
    res.status(500).json({ error: "Failed to fetch forecast" });
  }
});

export default router;
