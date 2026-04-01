import { Router } from "express";
import type { Request, Response } from "express";
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  SSOOIDCClient,
  RegisterClientCommand,
  StartDeviceAuthorizationCommand,
  CreateTokenCommand,
} from "@aws-sdk/client-sso-oidc";
import { parseSsoSessions, clearCachedClients } from "../utils/aws-client.js";

const router = Router();

router.get("/api/sso-sessions", async (_req, res) => {
  const { sessions, profileSessionMap } = await parseSsoSessions();

  // Check which sessions have valid (non-expired) cached tokens
  const ssoCacheDir = join(homedir(), ".aws", "sso", "cache");
  const activeSessions: string[] = [];
  for (const session of sessions) {
    const hash = createHash("sha1").update(session.name).digest("hex");
    try {
      const cached = JSON.parse(await readFile(join(ssoCacheDir, `${hash}.json`), "utf-8"));
      if (cached.accessToken && new Date(cached.expiresAt) > new Date()) {
        activeSessions.push(session.name);
      }
    } catch {
      // No cache or invalid
    }
  }

  res.json({ sessions, profileSessionMap, activeSessions });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

router.get("/api/sso-login", async (req: Request, res: Response) => {
  const sessionName = req.query.sessionName as string | undefined;

  if (!sessionName) {
    res.status(400).json({ error: "sessionName query parameter is required" });
    return;
  }

  const { sessions } = await parseSsoSessions();
  const session = sessions.find((s) => s.name === sessionName);

  if (!session) {
    res.status(404).json({ error: `SSO session "${sessionName}" not found` });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (data: Record<string, string>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const oidcClient = new SSOOIDCClient({ region: session.ssoRegion });

    const scopes = session.ssoRegistrationScopes
      ? session.ssoRegistrationScopes.split(",").map((s) => s.trim())
      : ["sso:account:access"];

    // Step 1: Register client (or reuse cached registration)
    let clientId!: string;
    let clientSecret!: string;

    const ssoCacheDir = join(homedir(), ".aws", "sso", "cache");
    await mkdir(ssoCacheDir, { recursive: true });

    const registrationCachePath = join(ssoCacheDir, `botocore-client-id-${session.ssoRegion}.json`);
    let registrationCached = false;

    try {
      const cached = JSON.parse(await readFile(registrationCachePath, "utf-8"));
      if (cached.clientId && cached.clientSecret && new Date(cached.expiresAt) > new Date()) {
        clientId = cached.clientId;
        clientSecret = cached.clientSecret;
        registrationCached = true;
      }
    } catch {
      // No valid cache
    }

    if (!registrationCached) {
      const registerResult = await oidcClient.send(new RegisterClientCommand({
        clientName: "aws-logs-viewer",
        clientType: "public",
        scopes,
      }));
      clientId = registerResult.clientId!;
      clientSecret = registerResult.clientSecret!;

      await writeFile(registrationCachePath, JSON.stringify({
        clientId,
        clientSecret,
        expiresAt: new Date(registerResult.clientSecretExpiresAt! * 1000).toISOString(),
      }));
    }

    // Step 2: Start device authorization
    const authResult = await oidcClient.send(new StartDeviceAuthorizationCommand({
      clientId,
      clientSecret,
      startUrl: session.ssoStartUrl,
    }));

    const deviceCode = authResult.deviceCode!;
    const verificationUri = authResult.verificationUriComplete || authResult.verificationUri!;
    const userCode = authResult.userCode!;
    let pollInterval = (authResult.interval || 5) * 1000;

    // Send waiting event (client opens the browser)
    sendEvent({ status: "waiting", verificationUri, userCode });

    // Step 5: Poll for token
    const expiresAt = Date.now() + (authResult.expiresIn || 600) * 1000;

    while (Date.now() < expiresAt) {
      await sleep(pollInterval);

      try {
        const tokenResult = await oidcClient.send(new CreateTokenCommand({
          clientId,
          clientSecret,
          grantType: "urn:ietf:params:oauth:grant-type:device_code",
          deviceCode,
        }));

        // Step 6: Cache the token (keyed by session name, matching AWS CLI convention)
        const sessionNameHash = createHash("sha1").update(session.name).digest("hex");
        const tokenCachePath = join(ssoCacheDir, `${sessionNameHash}.json`);
        const tokenExpiresAt = new Date(Date.now() + (tokenResult.expiresIn || 3600) * 1000).toISOString();

        await writeFile(tokenCachePath, JSON.stringify({
          startUrl: session.ssoStartUrl,
          region: session.ssoRegion,
          accessToken: tokenResult.accessToken,
          expiresAt: tokenExpiresAt,
          clientId,
          clientSecret,
          registrationExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          ...(tokenResult.refreshToken && { refreshToken: tokenResult.refreshToken }),
        }));

        // Clear cached SDK clients so they pick up the fresh token
        clearCachedClients();

        sendEvent({ status: "success" });
        res.end();
        return;
      } catch (err: any) {
        if (err.name === "AuthorizationPendingException") {
          continue;
        }
        if (err.name === "SlowDownException") {
          pollInterval += 5000;
          continue;
        }
        if (err.name === "ExpiredTokenException") {
          sendEvent({ status: "error", message: "SSO login timed out" });
          res.end();
          return;
        }
        throw err;
      }
    }

    sendEvent({ status: "error", message: "SSO login timed out" });
    res.end();
  } catch (err: any) {
    sendEvent({ status: "error", message: err.message || "SSO login failed" });
    res.end();
  }
});

export default router;
