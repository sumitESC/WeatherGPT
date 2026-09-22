import { DetectedIntent } from "../../intent/intent.analyzer";
import { RenderContext } from "../render.dispatcher";
import { dataStore } from "../../data/cityData.store";

export async function handleComparisonRender(intent: DetectedIntent): Promise<RenderContext> {
  const renderTags: string[] = [];
  const contextParts: string[] = [];

  if (intent.cityNames && intent.cityNames.length > 1) {
    renderTags.push(`[RENDER_COMPARISON:${intent.cityNames.join(",")}]`);
    for (const name of intent.cityNames) {
      const ctx = dataStore.getInstantCityContext(name);
      if (ctx) contextParts.push(ctx);
    }
  } else {
    // Get top 4 cities
    const topCities = Array.from(dataStore.cityDataMap.keys()).slice(0, 4).map(k => dataStore.cityDataMap.get(k)!.name);
    renderTags.push(`[RENDER_COMPARISON:${topCities.join(",")}]`);
    contextParts.push(dataStore.getAllCitiesSummary());
  }

  return { dataContext: contextParts.join("\n"), renderTags };
}
