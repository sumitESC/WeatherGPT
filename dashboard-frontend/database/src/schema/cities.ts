import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const citiesTable = sqliteTable("cities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  population: integer("population").notNull(),
  populationDensity: real("population_density").notNull(),
  totalArea: real("total_area").notNull(),
  builtUpArea: real("built_up_area").notNull(),
  industrialArea: real("industrial_area").notNull(),
  residentialArea: real("residential_area").notNull(),
  roadArea: real("road_area").notNull(),
  openLand: real("open_land").notNull(),
  waterBodiesArea: real("water_bodies_area").notNull(),
  forestCover: real("forest_cover").notNull(),
  urbanGreenSpace: real("urban_green_space").notNull(),
  treeDensity: real("tree_density").notNull(),
  ndvi: real("ndvi").notNull(),
  ndwi: real("ndwi").notNull().default(0),
  ndbi: real("ndbi").notNull().default(0),
  rtoCode: text("rto_code"),
  emissionIndex: real("emission_index").notNull().default(0),
  totalVehicles: integer("total_vehicles").notNull(),
  petrolVehicles: integer("petrol_vehicles").notNull(),
  dieselVehicles: integer("diesel_vehicles").notNull(),
  electricVehicles: integer("electric_vehicles").notNull(),
  cngVehicles: integer("cng_vehicles").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().defaultNow(),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCitySchema = createInsertSchema(citiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCity = z.infer<typeof insertCitySchema>;
export type City = typeof citiesTable.$inferSelect;
