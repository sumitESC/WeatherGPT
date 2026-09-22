import { Request, Response } from "express";
import { detectIntent, generatePlanTasks } from "./intent/intent.analyzer";
import { dispatchRender } from "./render/render.dispatcher";
import { streamGroqResponse } from "./chat.service";

export async function chatController(req: Request, res: Response): Promise<void> {
  try {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.write(" "); // Initial connection byte

    const { messages, context } = req.body;
    const userMessages = Array.isArray(messages) ? messages.filter((m: any) => m.role === "user") : [];
    const lastUserMessage = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : "";

    res.write("[STATUS: Analyzing request...]\n\n");

    const contextCityId = Array.isArray(context) && context.length > 0 && context[0].id ? parseInt(context[0].id, 10) : (context?.id ? parseInt(context.id, 10) : undefined);
    
    // 1. Detect Intent
    const intent = await detectIntent(lastUserMessage, contextCityId);
    
    // 2. Generate Plan Tasks
    const tasks = generatePlanTasks(intent);

    // Stream the plan
    res.write(`[PLAN_START]${JSON.stringify(tasks)}[PLAN_END]\n\n`);

    const targetStr = intent.cityNames && intent.cityNames.length > 0 ? intent.cityNames.join(", ") : "context data";
    res.write(`[STATUS: Fetching data for ${targetStr}...]\n\n`);

    // 3. Dispatch Render (Strategy Pattern)
    const { dataContext, renderTags } = await dispatchRender(intent);

    // Tick off all tasks immediately
    for (const task of tasks) {
      res.write(`[TASK_DONE:${task.id}]\n\n`);
    }

    // 4. Stream Response from Groq
    await streamGroqResponse(res, dataContext, messages, renderTags);

  } catch (error) {
    console.error("[ChatController] Fatal error", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to communicate with AI Advisor" });
    } else {
      res.end("\n[Error: Connection Interrupted]");
    }
  }
}
