import { Router, type IRouter } from "express";
import { db, citiesTable, heatPredictionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/heatzone/predict/:id", async (req, res): Promise<void> => {
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
    .from(heatPredictionsTable)
    .where(eq(heatPredictionsTable.cityId, cityId))
    .orderBy(desc(heatPredictionsTable.predictedAt))
    .limit(1);

  if (!latest) {
    res.status(404).json({ error: "No prediction available" });
    return;
  }

  res.json({ ...latest, cityName: city.name, latitude: city.latitude, longitude: city.longitude });
});

router.get("/heatzone/all", async (_req, res): Promise<void> => {
  const cities = await db.select().from(citiesTable);
  
  const predictions = await Promise.all(
    cities.map(async (city) => {
      const [latest] = await db
        .select()
        .from(heatPredictionsTable)
        .where(eq(heatPredictionsTable.cityId, city.id))
        .orderBy(desc(heatPredictionsTable.predictedAt))
        .limit(1);
      
      return latest ? {
        ...latest,
        cityName: city.name,
        latitude: city.latitude,
        longitude: city.longitude,
      } : null;
    })
  );

  res.json(predictions.filter(Boolean));
});

router.get("/heatzone/history/:id", async (req, res): Promise<void> => {
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
    .from(heatPredictionsTable)
    .where(eq(heatPredictionsTable.cityId, cityId))
    .orderBy(desc(heatPredictionsTable.predictedAt))
    .limit(limit);

  res.json(history.map((p) => ({ ...p, cityName: city.name, latitude: city.latitude, longitude: city.longitude })));
});

export default router;
