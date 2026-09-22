import { Router, type IRouter } from "express";
import { db, citiesTable, recommendationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/recommendations/:id", async (req, res): Promise<void> => {
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

  const recs = await db
    .select()
    .from(recommendationsTable)
    .where(eq(recommendationsTable.cityId, cityId))
    .orderBy(recommendationsTable.priority);

  res.json(recs);
});

export default router;
