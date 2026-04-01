import { Router } from "express";
import { DescribeLogStreamsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { getCloudWatchLogsClient, sendWithTimeout } from "../utils/aws-client.js";

const router = Router();

router.get("/api/log-streams", async (req, res) => {
  const { profile, region, logGroup, nextToken } = req.query as Record<string, string | undefined>;

  if (!profile || !region || !logGroup) {
    res.status(400).json({ error: "profile, region, and logGroup query parameters are required" });
    return;
  }

  try {
    const client = getCloudWatchLogsClient(profile, region);
    const data = await sendWithTimeout(client, new DescribeLogStreamsCommand({
      logGroupName: logGroup,
      orderBy: "LastEventTime",
      descending: true,
      nextToken: nextToken || undefined,
    }));

    const logStreams = (data.logStreams ?? []).map((s: { logStreamName?: string; lastEventTimestamp?: number }) => ({
      name: s.logStreamName!,
      ...(s.lastEventTimestamp !== undefined && { lastEventTimestamp: s.lastEventTimestamp }),
    }));

    const result: { logStreams: { name: string; lastEventTimestamp?: number }[]; nextToken?: string } = { logStreams };
    if (data.nextToken) {
      result.nextToken = data.nextToken;
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to describe log streams" });
  }
});

export default router;
