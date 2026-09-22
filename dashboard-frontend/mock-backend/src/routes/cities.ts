import { Router } from "express";
import { db, citiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/cities", async (_req, res): Promise<void> => {
  const cities = await db.select().from(citiesTable).orderBy(citiesTable.name);
  res.json(cities);
});

router.get("/cities/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid city id" });
    return;
  }
  const [city] = await db.select().from(citiesTable).where(eq(citiesTable.id, id));
  if (!city) {
    res.status(404).json({ error: "City not found" });
    return;
  }
  res.json(city);
});

export default router;
