import { DetectedIntent } from "../../intent/intent.analyzer";
import { RenderContext } from "../render.dispatcher";

export async function handleErrorRender(intent: DetectedIntent): Promise<RenderContext> {
  const renderTags: string[] = [];
  const contextParts: string[] = [];

  const errMsg = intent.errorMessage || "An unexpected error occurred while processing your request.";
  renderTags.push(`[RENDER_ERROR:${errMsg}]`);
  contextParts.push(`SYSTEM_ERROR:${errMsg}`);

  return { dataContext: contextParts.join("\n"), renderTags };
}
