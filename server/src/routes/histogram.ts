import { Router } from "express";
import { StartQueryCommand, GetQueryResultsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { getCloudWatchLogsClient, sendWithTimeout } from "../utils/aws-client.js";
import { buildInsightsFilter, buildStreamFilter } from "../utils/insights-filter.js";

const router = Router();

const KNOWN_LEVELS = ["ERROR", "WARN", "INFO", "DEBUG"] as const;
type Level = (typeof KNOWN_LEVELS)[number] | "OTHER";

interface HistogramBucket {
  start: number;
  end: number;
  counts: Record<Level, number>;
}

export function formatInsightsInterval(ms: number): string {
  const units = [
    { suffix: "s", milliseconds: 1_000, maximum: 60 },
    { suffix: "m", milliseconds: 60_000, maximum: 60 },
    { suffix: "h", milliseconds: 3_600_000, maximum: 24 },
    { suffix: "d", milliseconds: 86_400_000, maximum: 7 },
  ] as const;

  for (const unit of units) {
    const value = Math.max(1, Math.round(ms / unit.milliseconds));
    if (value <= unit.maximum) return `${value}${unit.suffix}`;
  }

  return `${Math.max(1, Math.round(ms / 604_800_000))}w`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

router.get("/api/histogram", async (req, res) => {
  const { profile, region, logGroups, startTime, endTime, buckets: bucketsParam, filterPattern, logStreams } =
    req.query as Record<string, string | undefined>;

  if (!profile || !region || !logGroups || !startTime || !endTime) {
    res.status(400).json({ error: "profile, region, logGroups, startTime, and endTime are required" });
    return;
  }

  const startMs = parseInt(startTime, 10);
  const endMs = parseInt(endTime, 10);
  const numBuckets = Math.max(1, Math.min(200, parseInt(bucketsParam || "50", 10)));
  const intervalMs = (endMs - startMs) / numBuckets;
  const interval = formatInsightsInterval(intervalMs);

  const startEpoch = Math.floor(startMs / 1000);
  const endEpoch = Math.ceil(endMs / 1000);

  const groups = logGroups.split(",").filter(Boolean);

  const queryParts: string[] = [];

  if (logStreams) {
    queryParts.push(buildStreamFilter(logStreams));
  }

  if (filterPattern) {
    queryParts.push(buildInsightsFilter(filterPattern));
  }

  queryParts.push(`parse @message /(?i)(?<level>ERROR|WARN|INFO|DEBUG)/`);
  queryParts.push(`stats count(*) by bin(${interval}) as ts, level`);

  const queryString = queryParts.join(" | ");
  const client = getCloudWatchLogsClient(profile, region);

  try {
    const startResult = await sendWithTimeout(client, new StartQueryCommand({
      startTime: startEpoch,
      endTime: endEpoch,
      queryString,
      ...(groups.length === 1
        ? { logGroupName: groups[0] }
        : { logGroupNames: groups }),
    }));
    const queryId = startResult.queryId!;

    const pollStart = Date.now();
    const POLL_TIMEOUT = 15_000;
    const POLL_INTERVAL = 500;
    let results: any[] | null = null;

    while (Date.now() - pollStart < POLL_TIMEOUT) {
      const pollResult = await sendWithTimeout(client, new GetQueryResultsCommand({ queryId }));

      if (pollResult.status === "Complete") {
        results = pollResult.results ?? null;
        break;
      }
      if (pollResult.status === "Failed" || pollResult.status === "Cancelled") {
        res.json({ buckets: [], error: `Query ${pollResult.status.toLowerCase()}` });
        return;
      }
      await sleep(POLL_INTERVAL);
    }

    if (!results) {
      res.json({ buckets: [], error: "Query timed out after 15s" });
      return;
    }

    const bucketMap = new Map<number, Record<Level, number>>();
    for (let i = 0; i < numBuckets; i++) {
      const bucketStart = startMs + i * intervalMs;
      bucketMap.set(Math.floor(bucketStart), { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, OTHER: 0 });
    }

    for (const row of results) {
      const fields: Record<string, string> = {};
      for (const { field, value } of row) {
        fields[field!] = value!;
      }
      const rawTs = fields["ts"] || "";
      const ts = new Date(rawTs.endsWith("Z") ? rawTs : rawTs + "Z").getTime();
      const level = fields["level"]?.toUpperCase();
      const count = parseInt(fields["count(*)"] || "0", 10);

      const bucketIndex = Math.min(numBuckets - 1, Math.max(0, Math.floor((ts - startMs) / intervalMs)));
      const bucketStart = Math.floor(startMs + bucketIndex * intervalMs);
      const bucket = bucketMap.get(bucketStart);
      if (bucket) {
        const key: Level = KNOWN_LEVELS.includes(level as any) ? (level as Level) : "OTHER";
        bucket[key] += count;
      }
    }

    const bucketArray: HistogramBucket[] = [];
    for (let i = 0; i < numBuckets; i++) {
      const bucketStart = Math.floor(startMs + i * intervalMs);
      const bucketEnd = Math.floor(startMs + (i + 1) * intervalMs);
      const counts = bucketMap.get(bucketStart) || { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, OTHER: 0 };
      bucketArray.push({ start: bucketStart, end: bucketEnd, counts });
    }

    res.json({ buckets: bucketArray });
  } catch (err: any) {
    res.json({ buckets: [], error: err.message });
  }
});

export default router;
