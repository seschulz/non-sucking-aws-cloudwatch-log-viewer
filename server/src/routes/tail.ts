import { Router } from "express";
import type { Request, Response } from "express";
import { FilterLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { getCloudWatchLogsClient, sendWithTimeout } from "../utils/aws-client.js";

const router = Router();

const POLL_INTERVAL = 2_000;
const HEARTBEAT_INTERVAL = 15_000;

router.get("/api/tail", (req: Request, res: Response) => {
  const { profile, region, logGroups, filterPattern } = req.query as Record<string, string | undefined>;

  if (!profile || !region || !logGroups) {
    res.status(400).json({ error: "profile, region, and logGroups query parameters are required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const groups = logGroups.split(",").filter(Boolean);
  let startTime = Date.now();
  const seenEventIds = new Set<string>();
  const client = getCloudWatchLogsClient(profile, region);

  async function poll() {
    try {
      const results = await Promise.all(
        groups.map(async (group) => {
          try {
            const data = await sendWithTimeout(client, new FilterLogEventsCommand({
              logGroupName: group,
              startTime,
              ...(filterPattern && { filterPattern }),
            }));
            return data.events ?? [];
          } catch {
            return [];
          }
        }),
      );

      const allEvents = results.flat();

      if (allEvents.length > 0) {
        for (const event of allEvents) {
          if (seenEventIds.has(event.eventId!)) continue;
          seenEventIds.add(event.eventId!);

          const payload = {
            timestamp: event.timestamp,
            message: event.message,
            logStreamName: event.logStreamName,
            logGroupName: event.logGroupName,
            eventId: event.eventId,
          };
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        }

        const maxTimestamp = Math.max(...allEvents.map((e) => e.timestamp!));
        startTime = maxTimestamp + 1;
      }
    } catch {
      // Swallow poll errors
    }
  }

  const pollTimer = setInterval(poll, POLL_INTERVAL);
  const heartbeatTimer = setInterval(() => { res.write(":\n\n"); }, HEARTBEAT_INTERVAL);
  poll();

  req.on("close", () => {
    clearInterval(pollTimer);
    clearInterval(heartbeatTimer);
  });
});

export default router;
