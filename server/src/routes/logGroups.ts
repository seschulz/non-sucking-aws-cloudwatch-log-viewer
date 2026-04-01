import { Router } from "express";
import { DescribeLogGroupsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { getCloudWatchLogsClient, sendWithTimeout } from "../utils/aws-client.js";

const router = Router();

router.get("/api/log-groups", async (req, res) => {
  const { profile, region, prefix, nextToken } = req.query as Record<string, string | undefined>;

  if (!profile || !region) {
    res.status(400).json({ error: "profile and region query parameters are required" });
    return;
  }

  try {
    const client = getCloudWatchLogsClient(profile, region);
    const data = await sendWithTimeout(client, new DescribeLogGroupsCommand({
      logGroupNamePrefix: prefix || undefined,
      nextToken: nextToken || undefined,
    }));

    const logGroups: string[] = (data.logGroups ?? []).map((g: { logGroupName?: string }) => g.logGroupName!);

    const result: { logGroups: string[]; nextToken?: string } = { logGroups };
    if (data.nextToken) {
      result.nextToken = data.nextToken;
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to describe log groups" });
  }
});

export default router;
