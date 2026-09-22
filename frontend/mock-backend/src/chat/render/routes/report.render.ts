import { DetectedIntent } from "../../intent/intent.analyzer";
import { RenderContext } from "../render.dispatcher";
import { dataStore } from "../../data/cityData.store";
import { db, recommendationsTable, eq } from "@workspace/db";

export async function handleReportRender(intent: DetectedIntent): Promise<RenderContext> {
  const renderTags: string[] = [];
  const contextParts: string[] = [];

  const cityName = intent.cityName;
  if (cityName) {
    renderTags.push(`[RENDER_REPORT:${cityName}]`);
    const ctx = dataStore.getInstantCityContext(cityName);
    if (ctx) contextParts.push(ctx);

    if (intent.cityId) {
      try {
        const recs = await db.select().from(recommendationsTable).where(eq(recommendationsTable.cityId, intent.cityId));
        if (recs.length > 0) {
          contextParts.push(`RECOMMENDATIONS:${recs.map((r: any) => r.title || r.description).join("|")}`);
        }
      } catch (err) {
        console.error("[ReportRender] Failed to fetch recommendations from DB", err);
      }
    }
  } else {
    renderTags.push("[RENDER_NASA_MAP]");
    contextParts.push(dataStore.getAllCitiesSummary());
  }

  return { dataContext: contextParts.join("\n"), renderTags };
}
