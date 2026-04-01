import { Router } from "express";
import { StartQueryCommand, GetQueryResultsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { getCloudWatchLogsClient, sendWithTimeout } from "../utils/aws-client.js";
import { buildInsightsFilter, buildStreamFilter } from "../utils/insights-filter.js";

const router = Router();

interface LogEvent {
  timestamp: number;
  message: string;
  logStreamName: string;
  logGroupName: string;
  eventId: string;
}

const DEFAULT_MAX_ITEMS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

router.get("/api/logs", async (req, res) => {
  const { profile, region, logGroups, logStreams, startTime, endTime, filterPattern, nextToken, limit } =
    req.query as Record<string, string | undefined>;

  if (!profile || !region || !logGroups) {
    res.status(400).json({ error: "profile, region, and logGroups query parameters are required" });
    return;
  }

  const groups = logGroups.split(",").filter(Boolean);
  const maxItems = parseInt(limit || String(DEFAULT_MAX_ITEMS), 10);

  // Build Insights query
  const queryParts: string[] = ["fields @timestamp, @message, @logStream, @log, @ptr"];

  if (logStreams) {
    queryParts.push(buildStreamFilter(logStreams));
  }

  if (filterPattern) {
    queryParts.push(buildInsightsFilter(filterPattern));
  }

  queryParts.push("sort @timestamp desc");
  queryParts.push(`limit ${maxItems}`);

  const queryString = queryParts.join(" | ");

  // For "load more", nextToken is the oldest timestamp from previous results
  const effectiveEndTime = nextToken ? parseInt(nextToken, 10) : parseInt(endTime || String(Date.now()), 10);
  const startEpoch = Math.floor(parseInt(startTime || "0", 10) / 1000);
  const endEpoch = Math.ceil(effectiveEndTime / 1000);

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

    // Poll for results
    const pollStart = Date.now();
    const POLL_TIMEOUT = 120_000;
    const POLL_INTERVAL = 500;
    let results: any[] | null = null;

    while (Date.now() - pollStart < POLL_TIMEOUT) {
      const pollResult = await sendWithTimeout(client, new GetQueryResultsCommand({ queryId }));

      if (pollResult.status === "Complete") {
        results = pollResult.results ?? [];
        break;
      }
      if (pollResult.status === "Failed" || pollResult.status === "Cancelled") {
        throw new Error(`Query ${pollResult.status.toLowerCase()}`);
      }
      await sleep(POLL_INTERVAL);
    }

    if (!results) {
      throw new Error("Query timed out");
    }

    // Parse results into LogEvent format
    const events: LogEvent[] = results.map((row) => {
      const fields: Record<string, string> = {};
      for (const { field, value } of row) {
        fields[field!] = value!;
      }
      const rawTs = fields["@timestamp"] || "";
      const ts = new Date(rawTs.endsWith("Z") ? rawTs : rawTs + "Z").getTime();
      const message = fields["@message"] || "";
      const logStream = fields["@logStream"] || "";
      // @log format: "accountId:logGroupName"
      const logField = fields["@log"] || "";
      const logGroup = logField.includes(":") ? logField.split(":").slice(1).join(":") : logField;
      const eventId = fields["@ptr"] || `${ts}-${logStream}`;

      return {
        timestamp: ts,
        message,
        logStreamName: logStream,
        logGroupName: logGroup || groups[0],
        eventId,
      };
    });

    // Check if Insights hit the limit (more results may exist)
    const hasMore = events.length >= maxItems;

    const response: { events: LogEvent[]; nextToken?: string } = { events };
    if (hasMore && events.length > 0) {
      // Cursor: oldest event's timestamp (next page fetches older events)
      const oldestTimestamp = events[events.length - 1].timestamp;
      response.nextToken = String(oldestTimestamp);
    }

    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
