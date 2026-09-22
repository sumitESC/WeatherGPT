import { DetectedIntent } from "../../intent/intent.analyzer";
import { RenderContext } from "../render.dispatcher";
import { dataStore } from "../../data/cityData.store";

export async function handleWeatherRender(intent: DetectedIntent): Promise<RenderContext> {
  const renderTags: string[] = [];
  const contextParts: string[] = [];

  const cityName = intent.cityName;
  if (cityName) {
    renderTags.push(`[RENDER_CARD:weather:${cityName}]`);
    renderTags.push(`[RENDER_MAP:${cityName}]`);
    const ctx = dataStore.getInstantCityContext(cityName);
    if (ctx) contextParts.push(ctx);
  }

  return { dataContext: contextParts.join("\n"), renderTags };
}
