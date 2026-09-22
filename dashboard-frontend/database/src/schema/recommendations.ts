import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { citiesTable } from "./cities";

export const recommendationsTable = sqliteTable("recommendations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cityId: integer("city_id").notNull().references(() => citiesTable.id),
  category: text("category").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  priority: text("priority").notNull(),
  impact: text("impact").notNull(),
  icon: text("icon").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().defaultNow(),
});

export const insertRecommendationSchema = createInsertSchema(recommendationsTable).omit({ id: true, createdAt: true });
export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;
export type Recommendation = typeof recommendationsTable.$inferSelect;
