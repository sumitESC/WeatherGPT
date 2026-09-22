import { Router } from "express";
import { db, citiesTable, weatherDataTable, heatPredictionsTable, recommendationsTable, eq, desc, avg, sum, count } from "@workspace/db";

const router = Router();

router.get("/datasets/city/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const cityId = parseInt(raw, 10);
  if (isNaN(cityId)) {
    res.status(400).json({ error: "Invalid city id" });
    return;
  }

  const [
    [city],
    [latestWeatherRow],
    [latestPredRow],
    recs,
    weatherHistory,
    heatHistory
  ] = await Promise.all([
    db.select().from(citiesTable).where(eq(citiesTable.id, cityId)),
    db.select().from(weatherDataTable).where(eq(weatherDataTable.cityId, cityId)).orderBy(desc(weatherDataTable.recordedAt)).limit(1),
    db.select().from(heatPredictionsTable).where(eq(heatPredictionsTable.cityId, cityId)).orderBy(desc(heatPredictionsTable.predictedAt)).limit(1),
    db.select().from(recommendationsTable).where(eq(recommendationsTable.cityId, cityId)),
    db.select().from(weatherDataTable).where(eq(weatherDataTable.cityId, cityId)).orderBy(desc(weatherDataTable.recordedAt)).limit(20),
    db.select().from(heatPredictionsTable).where(eq(heatPredictionsTable.cityId, cityId)).orderBy(desc(heatPredictionsTable.predictedAt)).limit(20)
  ]);

  if (!city) {
    res.status(404).json({ error: "City not found" });
    return;
  }

  const latestWeather = latestWeatherRow ? { ...latestWeatherRow, cityName: city.name } : undefined;
  const latestPrediction = latestPredRow
    ? { ...latestPredRow, cityName: city.name, latitude: city.latitude, longitude: city.longitude }
    : undefined;

  let finalRecs = recs;
  if (!finalRecs || finalRecs.length === 0) {
    finalRecs = [];
    const ndbi = latestPrediction?.ndbi ?? 0.35;
    const ndvi = latestPrediction?.ndvi ?? 0.22;
    const veh = latestPrediction?.vehicleDensity ?? 15000;
    const canyon = (latestPrediction as any)?.urbanCanyonIndex ?? 0.42;

    if (ndbi > 0.30) {
      finalRecs.push({
        id: 101,
        cityId,
        title: "Cool Roof Coating Initiative",
        description: `High NDBI concrete index (${ndbi.toFixed(3)}). Applying high-albedo reflective coatings on commercial roofs will lower surface temperature absorption by up to 4.5°C.`,
        priority: "high",
        category: "infrastructure"
      } as any);
    }

    if (ndvi < 0.25) {
      finalRecs.push({
        id: 102,
        cityId,
        title: "Urban Tree Canopy Target",
        description: `NDVI vegetation index is low (${ndvi.toFixed(3)}). Planting urban green corridors in high-density zones will restore natural evapotranspiration cooling.`,
        priority: "high",
        category: "greening"
      } as any);
    }

    if (veh > 12000) {
      finalRecs.push({
        id: 103,
        cityId,
        title: "EV Traffic Heat Reduction",
        description: `High vehicle density recorded (${(veh / 1000).toFixed(1)}k/km²). Accelerating EV adoption for public transport will lower internal combustion exhaust heat.`,
        priority: "medium",
        category: "emissions"
      } as any);
    }

    if (canyon > 0.35) {
      finalRecs.push({
        id: 104,
        cityId,
        title: "Building Canyon Heat Dispersion",
        description: `Urban Canyon Index is ${canyon.toFixed(2)}. Implementing vertical green walls and HVAC exhaust diverters will prevent heat trapping in building corridors.`,
        priority: "medium",
        category: "policy"
      } as any);
    }
  }

  res.json({
    city,
    latestWeather,
    latestPrediction,
    recommendations: finalRecs,
    weatherHistory: weatherHistory.map((w) => ({ ...w, cityName: city.name })),
    heatHistory: heatHistory.map((p) => ({
      ...p,
      cityName: city.name,
      latitude: city.latitude,
      longitude: city.longitude,
    })),
  });
});

router.get("/datasets/overview", async (_req, res): Promise<void> => {
  const cities = await db.select().from(citiesTable);
  const predictions = [];

  let totalHeatRisk = 0;
  let totalTemp = 0;
  let totalHumidity = 0;
  let totalVehicles = 0;
  let totalGreenCover = 0;
  let totalNDVI = 0;
  let totalNDBI = 0;
  let totalEmissionIndex = 0;
  let totalBuildingHeight = 0;
  let totalCanyonIndex = 0;
  let totalConfidence = 0;
  let extremeCount = 0;
  let highCount = 0;
  let moderateCount = 0;
  let coolCount = 0;
  let weatherCount = 0;

  const cityData = await Promise.all(
    cities.map(async (city) => {
      const [predPromise, weatherPromise] = await Promise.all([
        db.select().from(heatPredictionsTable).where(eq(heatPredictionsTable.cityId, city.id)).orderBy(desc(heatPredictionsTable.predictedAt)).limit(1),
        db.select().from(weatherDataTable).where(eq(weatherDataTable.cityId, city.id)).orderBy(desc(weatherDataTable.recordedAt)).limit(1)
      ]);
      return { city, pred: predPromise[0], weather: weatherPromise[0] };
    })
  );

  for (const { city, pred, weather } of cityData) {
    if (pred) {
      predictions.push({
        ...pred,
        cityName: city.name,
        latitude: city.latitude,
        longitude: city.longitude,
      });
      totalHeatRisk += pred.heatRiskScore;
      totalVehicles += city.totalVehicles;
      totalGreenCover += city.forestCover + city.urbanGreenSpace;
      totalNDVI += pred.ndvi || 0;
      totalNDBI += pred.ndbi || 0;
      totalEmissionIndex += pred.emissionIndex || 0;
      totalBuildingHeight += pred.avgBuildingHeight || 10;
      totalCanyonIndex += pred.urbanCanyonIndex || 0.2;
      totalConfidence += pred.confidenceScore || 0.85;

      if (pred.heatZone === "extreme") extremeCount++;
      else if (pred.heatZone === "high") highCount++;
      else if (pred.heatZone === "moderate") moderateCount++;
      else coolCount++;
    }

    if (weather) {
      totalTemp += weather.temperature;
      totalHumidity += weather.humidity;
      weatherCount++;
    }
  }

  const count = predictions.length;
  res.json({
    totalCities: cities.length,
    avgHeatRisk: count ? Math.round((totalHeatRisk / count) * 10) / 10 : 0,
    extremeHeatCities: extremeCount,
    highHeatCities: highCount,
    moderateHeatCities: moderateCount,
    coolCities: coolCount,
    avgTemperature: weatherCount ? Math.round((totalTemp / weatherCount) * 10) / 10 : 0,
    avgHumidity: weatherCount ? Math.round(totalHumidity / weatherCount) : 0,
    totalVehicles,
    avgGreenCover: count ? Math.round((totalGreenCover / (count * 2)) * 10) / 10 : 0,
    avgNDVI: count ? Math.round((totalNDVI / count) * 1000) / 1000 : 0,
    avgNDBI: count ? Math.round((totalNDBI / count) * 1000) / 1000 : 0,
    avgEmissionIndex: count ? Math.round((totalEmissionIndex / count) * 100) / 100 : 0,
    avgBuildingHeight: count ? Math.round((totalBuildingHeight / count) * 10) / 10 : 0,
    avgUrbanCanyonIndex: count ? Math.round((totalCanyonIndex / count) * 100) / 100 : 0,
    avgConfidenceScore: count ? Math.round((totalConfidence / count) * 100) / 100 : 0,
    lastUpdated: new Date().toISOString(),
    cityPredictions: predictions,
  });
});

export default router;
