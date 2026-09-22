import { DetectedIntent } from "../../intent/intent.analyzer";
import { RenderContext } from "../render.dispatcher";
import { dataStore } from "../../data/cityData.store";

export async function handleMapRender(intent: DetectedIntent): Promise<RenderContext> {
  const renderTags: string[] = [];
  const contextParts: string[] = [];

  if (intent.cityNames && intent.cityNames.length > 0) {
    for (const name of intent.cityNames) {
      renderTags.push(`[RENDER_MAP:${name}]`);
      const ctx = dataStore.getInstantCityContext(name);
      if (ctx) contextParts.push(ctx);
    }
  } else {
    renderTags.push("[RENDER_NASA_MAP]");
    contextParts.push(dataStore.getAllCitiesSummary());
  }

  return { dataContext: contextParts.join("\n"), renderTags };
}
