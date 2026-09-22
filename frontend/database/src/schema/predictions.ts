import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { citiesTable } from "./cities";

export const heatPredictionsTable = sqliteTable("heat_predictions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cityId: integer("city_id").notNull().references(() => citiesTable.id),
  heatRiskScore: real("heat_risk_score").notNull(),
  heatZone: text("heat_zone").notNull(),
  temperature: real("temperature").notNull(),
  humidity: integer("humidity").notNull(),
  vehicleDensity: real("vehicle_density").notNull(),
  populationDensity: real("population_density").notNull(),
  greenCoverRatio: real("green_cover_ratio").notNull(),
  builtUpRatio: real("built_up_ratio").notNull(),
  ndvi: real("ndvi").notNull().default(0),
  ndwi: real("ndwi").notNull().default(0),
  ndbi: real("ndbi").notNull().default(0),
  emissionIndex: real("emission_index").notNull().default(0),
  primaryRiskDriver: text("primary_risk_driver"),
  riskExplanation: text("risk_explanation"),
  coolingIndex: real("cooling_index").notNull(),
  trafficHeatFactor: real("traffic_heat_factor").notNull(),
  avgBuildingHeight: real("avg_building_height").notNull().default(10),
  urbanCanyonIndex: real("urban_canyon_index").notNull().default(0.2),
  industrialHeatFactor: real("industrial_heat_factor").notNull().default(0.1),
  acThermalExhaust: real("ac_thermal_exhaust").notNull().default(0.2),
  confidenceScore: real("confidence_score").notNull().default(0.85),
  predictedAt: integer("predicted_at", { mode: 'timestamp' }).notNull().defaultNow(),
});

export const insertPredictionSchema = createInsertSchema(heatPredictionsTable).omit({ id: true, predictedAt: true });
export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type HeatPrediction = typeof heatPredictionsTable.$inferSelect;
