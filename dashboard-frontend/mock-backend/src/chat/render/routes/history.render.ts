import { DetectedIntent } from "../../intent/intent.analyzer.js";
import { RenderContext } from "../render.dispatcher.js";
import { fetchMLHistory } from "../../../lib/mlProxyService";

export async function handleHistoryRender(intent: DetectedIntent): Promise<RenderContext> {
  const renderTags: string[] = [];
  const contextParts: string[] = [];

  const cityName = intent.cityName;
  if (cityName && intent.year && intent.month) {
    const startDate = `${intent.year}-${intent.month}-01`;
    const endDate = `${intent.year}-${intent.month}-28`;
    try {
      const historyData = await fetchMLHistory(cityName, startDate, endDate);
      if (historyData?.data) {
        const entries = Array.isArray(historyData.data) ? historyData.data.slice(0, 10) : [];
        contextParts.push(`HISTORY:${cityName}|${entries.map((e: any) => `${e.date}:${e.temperature || e.Temp_Max_C || '?'}°C`).join("|")}`);
      }
    } catch (err) {
      console.error("[HistoryRender] Failed to fetch history", err);
    }
  }

  return { dataContext: contextParts.join("\n"), renderTags };
}
