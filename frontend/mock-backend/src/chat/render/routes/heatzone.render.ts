import { DetectedIntent } from "../../intent/intent.analyzer";
import { RenderContext } from "../render.dispatcher";
import { dataStore } from "../../data/cityData.store";

export async function handleHeatzoneRender(intent: DetectedIntent): Promise<RenderContext> {
  const renderTags: string[] = [];
  const contextParts: string[] = [];

  const cityName = intent.cityName;
  if (cityName) {
    renderTags.push(`[RENDER_CARD:weather:${cityName}]`);
    const ctx = dataStore.getInstantCityContext(cityName);
    if (ctx) contextParts.push(ctx);
  } else {
    contextParts.push(dataStore.getAllCitiesSummary());
    renderTags.push("[RENDER_NASA_MAP]");
  }

  return { dataContext: contextParts.join("\n"), renderTags };
}
