import { Response } from "express";
import { ChatConfig } from "./config/chat.config";
import { compileContextAndHistory } from "./session/context.manager";

export async function streamGroqResponse(
  res: any, 
  dataContext: string, 
  rawMessages: any[], 
  renderTags: string[]
): Promise<void> {
  const formattedMessages = compileContextAndHistory(dataContext, rawMessages);

  const groqHeaders = {
    "Authorization": `Bearer ${ChatConfig.GROQ_API_KEY}`,
    "Content-Type": "application/json"
  };

  let groqPayload: any = {
    model: ChatConfig.GROQ_MODEL,
    messages: formattedMessages,
    stream: true,
    temperature: 0.7
  };

  let groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: groqHeaders,
    body: JSON.stringify(groqPayload)
  });

  if (!groqResponse.ok && groqPayload.model !== ChatConfig.GROQ_FALLBACK_MODEL) {
    console.warn(`[Groq] Primary model ${groqPayload.model} returned ${groqResponse.status}. Falling back to ${ChatConfig.GROQ_FALLBACK_MODEL}`);
    groqPayload.model = ChatConfig.GROQ_FALLBACK_MODEL;
    groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: groqHeaders,
      body: JSON.stringify(groqPayload)
    });
  }

  if (!groqResponse.ok) {
    const errText = await groqResponse.text();
    throw new Error(`Groq API error (${groqResponse.status}): ${errText}`);
  }

  const reader = groqResponse.body!.getReader();
  const decoder = new TextDecoder("utf-8");
  let lineBuffer = "";
  let tokenBuffer = "";
  let insideThink = false;
  let tokenCount = 0;
  const streamStartTime = Date.now();

  res.write("[STATUS: Generating response...]\n\n");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    lineBuffer += decoder.decode(value, { stream: true });
    const lines = lineBuffer.split("\n");
    lineBuffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      try {
        const parsed = JSON.parse(line.slice(6));
        let token = parsed.choices?.[0]?.delta?.content || "";
        tokenBuffer += token;
        if (token) tokenCount++;

        while (tokenBuffer.length > 0) {
          if (insideThink) {
            const endIdx = tokenBuffer.indexOf("</think>");
            if (endIdx !== -1) {
              insideThink = false;
              tokenBuffer = tokenBuffer.substring(endIdx + 8);
            } else {
              if (tokenBuffer.length > 7) tokenBuffer = tokenBuffer.substring(tokenBuffer.length - 7);
              break;
            }
          } else {
            const startIdx = tokenBuffer.indexOf("<think>");
            if (startIdx !== -1) {
              let safeStr = tokenBuffer.substring(0, startIdx);
              safeStr = safeStr.replace(/\[RENDER_[^\]]*\]/g, "");
              if (safeStr) res.write(safeStr);
              insideThink = true;
              tokenBuffer = tokenBuffer.substring(startIdx + 7);
            } else {
              if (tokenBuffer.length > 7) {
                const safeLen = tokenBuffer.length - 7;
                let safeStr = tokenBuffer.substring(0, safeLen);
                safeStr = safeStr.replace(/\[RENDER_[^\]]*\]/g, "");
                if (safeStr) res.write(safeStr);
                tokenBuffer = tokenBuffer.substring(safeLen);
              } else {
                break;
              }
            }
          }
        }
      } catch (err) { }
    }
  }

  if (!insideThink && tokenBuffer.length > 0) {
    let safeStr = tokenBuffer.replace(/\[RENDER_[^\]]*\]/g, "");
    safeStr = safeStr.replace(/<\/?think>?/g, "");
    if (safeStr) res.write(safeStr);
  }

  const finalElapsed = (Date.now() - streamStartTime) / 1000;
  const speed = finalElapsed > 0 ? (tokenCount / finalElapsed).toFixed(1) : "0.0";
  res.write(`\n\n[SPEED:${tokenCount} tokens|${finalElapsed.toFixed(1)}s|${speed} tok/s]`);

  if (renderTags.length > 0) res.write("\n\n" + renderTags.join("\n"));
  res.end();
}
