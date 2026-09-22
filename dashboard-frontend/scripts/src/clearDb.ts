import { db, citiesTable, weatherDataTable, heatPredictionsTable, recommendationsTable } from "@workspace/db";

async function clear() {
  await db.delete(recommendationsTable);
  await db.delete(heatPredictionsTable);
  await db.delete(weatherDataTable);
  await db.delete(citiesTable);
  console.log("DB Cleared!");
  process.exit(0);
}
clear();
