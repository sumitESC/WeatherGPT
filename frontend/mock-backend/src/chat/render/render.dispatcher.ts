import { DetectedIntent } from "../intent/intent.analyzer";
import { handleReportRender } from "./routes/report.render";
import { handleMapRender } from "./routes/map.render";
import { handleComparisonRender } from "./routes/comparison.render";
import { handleForecastRender } from "./routes/forecast.render";
import { handleHistoryRender } from "./routes/history.render";
import { handleWeatherRender } from "./routes/weather.render";
import { handleOverviewRender } from "./routes/overview.render";
import { handleRecommendationsRender } from "./routes/recommendations.render";
import { handleHeatzoneRender } from "./routes/heatzone.render";
import { handleErrorRender } from "./routes/error.render";

export interface RenderContext {
  dataContext: string;
  renderTags: string[];
}

export async function dispatchRender(intent: DetectedIntent): Promise<RenderContext> {
  try {
    switch (intent.type) {
      case "report":
        return await handleReportRender(intent);
      case "map":
        return await handleMapRender(intent);
      case "comparison":
        return await handleComparisonRender(intent);
      case "forecast":
      case "chart":
        return await handleForecastRender(intent);
      case "history":
        return await handleHistoryRender(intent);
      case "weather":
        return await handleWeatherRender(intent);
      case "overview":
        return await handleOverviewRender(intent);
      case "recommendations":
        return await handleRecommendationsRender(intent);
      case "heatzone":
        return await handleHeatzoneRender(intent);
      case "error":
        return await handleErrorRender(intent);
      case "general":
      default:
        return await handleOverviewRender(intent); // Fallback overview
    }
  } catch (error) {
    console.error("[RenderDispatcher] Error dispatching render:", error);
    return handleErrorRender({ type: "error", errorMessage: "Failed to render dynamic content." });
  }
}
