import { Router } from "express";
import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { getBedrockRuntimeClient, sendWithTimeout } from "../utils/aws-client.js";
import { getSystemPrompt, type AnalysisResult } from "../utils/analysis-presets.js";

const router = Router();

const MODEL_ID = "eu.anthropic.claude-haiku-4-5-20251001-v1:0";
const ANALYZE_TIMEOUT = 120_000;

interface AnalyzeRequestBody {
  profile: string;
  region: string;
  logs: { timestamp: number; message: string; logStreamName: string; logGroupName: string; eventId: string }[];
  preset: string;
  customPrompt?: string;
}

router.post("/api/analyze", async (req, res) => {
  const { profile, region, logs, preset, customPrompt } = req.body as AnalyzeRequestBody;

  if (!profile || !region || !logs || !Array.isArray(logs) || logs.length === 0) {
    res.status(400).json({ error: "profile, region, and a non-empty logs array are required" });
    return;
  }

  const systemPrompt = getSystemPrompt(preset, customPrompt);

  // Format logs as a readable block for the LLM
  const logsText = logs
    .map((l) => `[${new Date(l.timestamp).toISOString()}] [${l.logStreamName}] [eventId:${l.eventId}] ${l.message}`)
    .join("\n");

  const userMessage = `Analyze these ${logs.length} log entries for anomalies:\n\n${logsText}`;

  const client = getBedrockRuntimeClient(profile, region);

  try {
    const command = new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: systemPrompt }],
      messages: [
        {
          role: "user",
          content: [{ text: userMessage }],
        },
      ],
      inferenceConfig: {
        maxTokens: 8192,
        temperature: 0,
      },
    });

    const response = await sendWithTimeout(client, command, ANALYZE_TIMEOUT);

    // Extract text from the response
    const outputContent = response.output?.message?.content;
    if (!outputContent || outputContent.length === 0) {
      throw new Error("Empty response from Bedrock");
    }

    const responseText = outputContent[0].text;
    if (!responseText) {
      throw new Error("No text content in Bedrock response");
    }

    // Parse the JSON response — strip markdown code fences if present
    const cleaned = responseText.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    let result: AnalysisResult;
    try {
      result = JSON.parse(cleaned);
    } catch {
      throw new Error("Failed to parse analysis results as JSON");
    }

    // Basic schema validation
    if (typeof result.summary !== "string" || !Array.isArray(result.anomalies)) {
      throw new Error("Invalid analysis result schema");
    }

    res.json(result);
  } catch (err: any) {
    const status = err.name === "AbortError" ? 504 : 500;
    res.status(status).json({ error: err.message });
  }
});

export default router;
