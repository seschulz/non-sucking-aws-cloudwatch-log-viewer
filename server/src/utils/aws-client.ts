import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";
import { EC2Client } from "@aws-sdk/client-ec2";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { fromIni } from "@aws-sdk/credential-providers";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseIni } from "ini";

// --- Client caching ---

const cwlClients = new Map<string, CloudWatchLogsClient>();
const ec2Clients = new Map<string, EC2Client>();
const bedrockClients = new Map<string, BedrockRuntimeClient>();

export function clearCachedClients(): void {
  cwlClients.clear();
  ec2Clients.clear();
  bedrockClients.clear();
}

export function getCloudWatchLogsClient(profile: string, region: string): CloudWatchLogsClient {
  const key = `${profile}:${region}`;
  let client = cwlClients.get(key);
  if (!client) {
    client = new CloudWatchLogsClient({
      region,
      credentials: fromIni({ profile }),
    });
    cwlClients.set(key, client);
  }
  return client;
}

export function getEc2Client(profile?: string, region?: string): EC2Client {
  const key = `${profile ?? "default"}:${region ?? "default"}`;
  let client = ec2Clients.get(key);
  if (!client) {
    client = new EC2Client({
      ...(region ? { region } : {}),
      ...(profile ? { credentials: fromIni({ profile }) } : {}),
    });
    ec2Clients.set(key, client);
  }
  return client;
}

export function getBedrockRuntimeClient(profile: string, region: string): BedrockRuntimeClient {
  const key = `${profile}:${region}`;
  let client = bedrockClients.get(key);
  if (!client) {
    client = new BedrockRuntimeClient({
      region,
      credentials: fromIni({ profile }),
    });
    bedrockClients.set(key, client);
  }
  return client;
}

// --- Timeout helper ---

const DEFAULT_TIMEOUT = 30_000;

export function sendWithTimeout(
  client: { send: (command: any, options?: any) => Promise<any> },
  command: any,
  timeout: number = DEFAULT_TIMEOUT,
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return client.send(command, { abortSignal: controller.signal }).finally(() => clearTimeout(timer));
}

// --- Profile parsing ---

export interface ProfileInfo {
  name: string;
  region?: string;
}

export async function parseAwsProfiles(): Promise<ProfileInfo[]> {
  const profileMap = new Map<string, string | undefined>();

  const credentialsPath = join(homedir(), ".aws", "credentials");
  const configPath = join(homedir(), ".aws", "config");

  try {
    const credentialsContent = await readFile(credentialsPath, "utf-8");
    const credentialsIni = parseIni(credentialsContent);
    for (const section of Object.keys(credentialsIni)) {
      profileMap.set(section, credentialsIni[section]?.region);
    }
  } catch {
    // File may not exist
  }

  try {
    const configContent = await readFile(configPath, "utf-8");
    const configIni = parseIni(configContent);
    for (const section of Object.keys(configIni)) {
      if (section.startsWith("sso-session ")) continue;
      const name = section.startsWith("profile ")
        ? section.slice("profile ".length)
        : section;
      const region = configIni[section]?.region;
      profileMap.set(name, region ?? profileMap.get(name));
    }
  } catch {
    // File may not exist
  }

  return Array.from(profileMap.entries())
    .map(([name, region]) => ({ name, region }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface SsoSessionInfo {
  name: string;
  ssoStartUrl: string;
  ssoRegion: string;
  ssoRegistrationScopes?: string;
}

export async function parseSsoSessions(): Promise<{
  sessions: SsoSessionInfo[];
  profileSessionMap: Record<string, string>;
}> {
  const sessions: SsoSessionInfo[] = [];
  const profileSessionMap: Record<string, string> = {};

  const configPath = join(homedir(), ".aws", "config");

  try {
    const configContent = await readFile(configPath, "utf-8");
    const configIni = parseIni(configContent);

    // Extract sso-session sections
    for (const section of Object.keys(configIni)) {
      if (section.startsWith("sso-session ")) {
        const name = section.slice("sso-session ".length);
        const data = configIni[section];
        if (data?.sso_start_url && data?.sso_region) {
          sessions.push({
            name,
            ssoStartUrl: data.sso_start_url,
            ssoRegion: data.sso_region,
            ...(data.sso_registration_scopes && { ssoRegistrationScopes: data.sso_registration_scopes }),
          });
        }
      }
    }

    // Extract profile → sso-session mapping
    for (const section of Object.keys(configIni)) {
      if (section.startsWith("sso-session ")) continue;
      const profileName = section.startsWith("profile ")
        ? section.slice("profile ".length)
        : section;
      const data = configIni[section];
      if (data?.sso_session) {
        profileSessionMap[profileName] = data.sso_session;
      }
    }
  } catch {
    // Config file may not exist
  }

  return { sessions, profileSessionMap };
}
