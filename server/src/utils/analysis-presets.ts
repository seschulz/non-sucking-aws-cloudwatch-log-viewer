export interface AnalysisResult {
  summary: string;
  anomalies: Anomaly[];
}

export interface Anomaly {
  title: string;
  severity: "critical" | "warning" | "info";
  description: string;
  eventIds: string[];
  recommendation: string;
}

const JSON_SCHEMA = `{
  "summary": "string — high-level overview of findings",
  "anomalies": [
    {
      "title": "string — short description",
      "severity": "critical | warning | info",
      "description": "string — explanation of why this is anomalous",
      "eventIds": ["string — eventId values from the log data"],
      "recommendation": "string — suggested next step"
    }
  ]
}`;

const BASE_INSTRUCTIONS = `You are a log analysis expert. Analyze the provided log entries and identify anomalies.

Return ONLY valid JSON matching this exact schema (no markdown, no explanation, no wrapping):
${JSON_SCHEMA}

Rules:
- Use the "eventId" field from each log entry to populate the "eventIds" array
- Assign severity: "critical" for errors requiring immediate attention, "warning" for concerning patterns, "info" for notable but non-urgent observations
- If no anomalies are found, return {"summary": "No anomalies detected.", "anomalies": []}
- Keep descriptions concise but specific — reference actual values from the logs
- Group related log entries into a single anomaly rather than creating one per log line`;

export const ANALYSIS_PRESETS: Record<string, { label: string; prompt: string }> = {
  general: {
    label: "General Anomalies",
    prompt: `${BASE_INSTRUCTIONS}

Focus on:
- Unusual error patterns or unexpected error types
- Sudden changes in log volume or frequency
- Correlations between failures across services
- Outlier log entries that don't match normal patterns
- Repeated failures that suggest systemic issues`,
  },
  "error-spikes": {
    label: "Error Spikes",
    prompt: `${BASE_INSTRUCTIONS}

Focus specifically on:
- Spikes in error frequency compared to normal baseline
- Repeated identical errors in short time windows
- Cascading failures (one error triggering others)
- Error rate changes over the time window
- New error types that haven't appeared before in the dataset`,
  },
  latency: {
    label: "Latency Issues",
    prompt: `${BASE_INSTRUCTIONS}

Focus specifically on:
- Timeout errors and deadline exceeded patterns
- Slow operation indicators (high duration values)
- Performance degradation over time
- Connection pool exhaustion or resource starvation
- Retry storms caused by slow upstream dependencies`,
  },
};

export function getSystemPrompt(preset: string, customPrompt?: string): string {
  if (preset === "custom" && customPrompt) {
    return `${BASE_INSTRUCTIONS}\n\n${customPrompt}`;
  }
  const presetConfig = ANALYSIS_PRESETS[preset];
  if (!presetConfig) {
    return ANALYSIS_PRESETS.general.prompt;
  }
  return presetConfig.prompt;
}
