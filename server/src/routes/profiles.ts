import { Router } from "express";
import { DescribeRegionsCommand } from "@aws-sdk/client-ec2";
import { getEc2Client, parseAwsProfiles, sendWithTimeout } from "../utils/aws-client.js";

const router = Router();

const FALLBACK_REGIONS = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "ap-northeast-1", "ap-northeast-2", "ap-northeast-3",
  "ap-south-1", "ap-southeast-1", "ap-southeast-2",
  "ca-central-1", "eu-central-1", "eu-north-1",
  "eu-west-1", "eu-west-2", "eu-west-3", "sa-east-1",
];

router.get("/api/profiles", async (_req, res) => {
  const profileInfos = await parseAwsProfiles();
  res.json({ profiles: profileInfos.map((p) => p.name), profileRegions: Object.fromEntries(profileInfos.filter((p) => p.region).map((p) => [p.name, p.region])) });
});

router.get("/api/regions", async (req, res) => {
  const profile = req.query.profile as string | undefined;

  try {
    const client = getEc2Client(profile);
    const data = await sendWithTimeout(client, new DescribeRegionsCommand({}));
    const regions: string[] = (data.Regions ?? []).map((r: { RegionName?: string }) => r.RegionName!).sort();
    res.json({ regions });
  } catch {
    res.json({ regions: FALLBACK_REGIONS });
  }
});

export default router;
