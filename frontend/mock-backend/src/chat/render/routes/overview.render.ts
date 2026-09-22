import { DetectedIntent } from "../../intent/intent.analyzer";
import { RenderContext } from "../render.dispatcher";
import { dataStore } from "../../data/cityData.store";

export async function handleOverviewRender(_intent: DetectedIntent): Promise<RenderContext> {
  const renderTags: string[] = [];
  const contextParts: string[] = [];

  contextParts.push(dataStore.getAllCitiesSummary());
  
  const cityCount = dataStore.cityDataMap.size;
  if (cityCount > 0) {
    contextParts.push(`PLATFORM:${cityCount} UP cities tracked with ML forecasts, heat scores, vehicle data, vegetation indices`);
  }

  renderTags.push("[RENDER_NASA_MAP]");

  return { dataContext: contextParts.join("\n"), renderTags };
}
