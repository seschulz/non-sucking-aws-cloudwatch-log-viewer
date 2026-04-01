# Non-Sucking AWS CloudWatch Log Viewer

A local web application that uses the AWS SDK to fetch and display CloudWatch logs with a modern, interactive UI. Built as a developer tool that's more productive than the AWS Console for log exploration.

![Dark theme](https://img.shields.io/badge/theme-dark%20%2B%20light-blue)
![Node](https://img.shields.io/badge/node-%3E%3D20.19-green)
![TypeScript](https://img.shields.io/badge/typescript-5.9-blue)

## Features

- **AWS Profile & Region Selector** — reads your local `~/.aws/credentials` and `~/.aws/config`, auto-selects the profile's configured region (SSO sessions are filtered out)
- **Searchable Multi-Select Log Groups** — type to filter, chips for selected groups, search across all your log groups
- **Stream Selector & Time Range Picker** — presets (5m, 15m, 1h, 6h, 24h, 3d, 7d) or custom date range
- **Filter Expressions** — full CloudWatch filter pattern syntax including JSON filters and wildcard matching
- **Query Presets** — dropdown with common queries (log levels, request ID, logger wildcard, exception search) for quick filtering
- **Log Distribution Histogram** — interactive stacked bar chart showing log levels over time, powered by CloudWatch Logs Insights
  - Drag-to-zoom for time range refinement
  - Midnight boundary lines for multi-day ranges
  - Per-level and total record counts in legend
  - Supports both text and JSON filter patterns
- **Virtualized Log Table** — smooth scrolling through thousands of log entries
- **Color-Coded Log Levels** — ERROR (red), WARN (yellow), INFO (teal), DEBUG (gray) with left border indicator
- **Nested JSON Log Level Detection** — correctly detects levels in nested/stringified JSON structures
- **Expandable JSON Pretty-Printing** — syntax-highlighted with collapsible rows
- **Click JSON Key to Add as Column** — dynamically extract fields into table columns
- **Click JSON Value to Add to Filter** — one-click filtering from any value
- **Search Term Highlighting** — matching text highlighted in log output
- **Live Tail Mode** — real-time log streaming via Server-Sent Events
- **AI-Powered Log Analysis** — analyze fetched logs for anomalies using Amazon Bedrock (Claude Haiku 4.5)
  - Built-in presets: General Anomalies, Error Spikes, Latency Issues, or Custom Prompt
  - Results shown in a split-pane view with severity-coded anomaly cards
  - Click an anomaly to highlight the related log entries
- **SSO Login** — in-app SSO device authorization flow, no need to leave the browser or use the CLI
- **Saved Filters** — save, update, and restore filter configurations (stored in browser localStorage)
- **Dark + Light Theme** — toggle with automatic persistence

## Quick Start

Multi-arch Docker images (`linux/amd64` + `linux/arm64`) are published to GitHub Container Registry on every push to `main` and on version tags.

```bash
docker pull ghcr.io/seschulz/non-sucking-aws-cloudwatch-log-viewer:latest
docker run -d --name non-sucking-aws-cloudwatch-log-viewer -v ~/.aws:/root/.aws -p 3001:3001 ghcr.io/seschulz/non-sucking-aws-cloudwatch-log-viewer
```

Open **http://localhost:3001** — the container serves both the API and frontend on a single port.

Available tags:
- `latest` — latest build from `main`
- `1.2.3` / `1.2` / `1` — specific version (from git tags like `v1.2.3`)
- `<commit-sha>` — pinned to an exact build

> **Note:** The `~/.aws` directory is mounted read-write so the SSO login flow can cache tokens. If you prefer read-only access, use `-v ~/.aws:/root/.aws:ro` — but you'll need to run `aws sso login` on your host machine when tokens expire.

## Prerequisites

- At least one AWS profile in `~/.aws/credentials` or `~/.aws/config`
- **For AI analysis:** Access to Amazon Bedrock with Claude Haiku 4.5 enabled in your AWS account

## Development

### Install dependencies

```bash
npm install
```

### Start development servers

```bash
npm run dev
```

This starts both servers concurrently:
- **Backend** (Express) on `http://localhost:3001`
- **Frontend** (Vite) on `http://localhost:5173`

Open **http://localhost:5173** in your browser.

### Production build

```bash
npm run build
```

This compiles both the server (TypeScript to `server/dist/`) and the client (Vite to `client/dist/`).

### Docker (build locally)

```bash
docker build -t non-sucking-aws-cloudwatch-log-viewer .
docker run -d --name non-sucking-aws-cloudwatch-log-viewer -v ~/.aws:/root/.aws -p 3001:3001 non-sucking-aws-cloudwatch-log-viewer
```

## Usage

1. **Select an AWS profile** from the dropdown (auto-populated from your AWS config)
2. **Select a region** (fetched dynamically or falls back to common regions)
3. **Search for log groups** — type in the log group picker to filter, click to add (supports multiple)
4. **Set a time range** — choose a preset or set a custom range
5. **Enter a filter pattern** (optional) — e.g., `ERROR` or `$.log_processed.level = "ERROR"`, or pick one from the **Presets** dropdown
6. **Click Search** to fetch logs

### Working with JSON logs

- **Click any log row** to expand and see the full JSON with syntax highlighting
- **Hover over a JSON key** and click to pin it as a table column
- **Click any JSON value** to automatically add it as a filter expression
- **Remove pinned columns** by clicking the X on the column chips

### Live Tail

Click the **Live Tail** button to stream new logs in real-time. New entries appear at the top with the filter pattern applied server-side. Click again to stop.

### Saved Filters

Click **Saved Filters** in the toolbar to save your current configuration (profile, region, log groups, filter pattern, time range, and pinned columns). Load them back with one click. Use the save icon to overwrite an existing filter with your current settings.

## Project Structure

```
aws-logs/
├── package.json              # npm workspaces root
├── server/
│   ├── package.json
│   └── src/
│       ├── index.ts          # Express server (port 3001)
│       ├── routes/
│       │   ├── profiles.ts      # GET /api/profiles, /api/regions
│       │   ├── logGroups.ts     # GET /api/log-groups
│       │   ├── logStreams.ts    # GET /api/log-streams
│       │   ├── logs.ts          # GET /api/logs
│       │   ├── histogram.ts     # GET /api/histogram
│       │   ├── queryPresets.ts  # GET /api/query-presets
│       │   ├── sso.ts            # GET /api/sso-sessions, /api/sso-login (SSE)
│       │   ├── analyze.ts        # POST /api/analyze (Bedrock)
│       │   └── tail.ts          # GET /api/tail (SSE)
│       └── utils/
│           ├── aws-client.ts     # AWS SDK v3 client factory with caching
│           ├── analysis-presets.ts # LLM analysis preset prompts
│           └── insights-filter.ts # CloudWatch Insights filter translation
├── client/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── components/
│       │   ├── Toolbar/      # Profile, log group, stream, time, filter, presets, analyze
│       │   ├── Histogram/    # Log distribution chart with zoom and legend
│       │   ├── LogViewer/    # Virtualized log table, JSON viewer, column chips
│       │   ├── AnomalyView/  # AI analysis results: anomaly cards + detail view
│       │   ├── SavedFilters.tsx
│       │   ├── ToastContainer.tsx
│       │   └── ThemeToggle.tsx
│       ├── hooks/            # useLiveTail
│       ├── stores/           # Zustand state management
│       └── utils/            # JSON detection, highlighting, log level parsing
```

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | React 19, TypeScript 5.9, Vite 8    |
| Styling   | Tailwind CSS 4, DaisyUI 5           |
| State     | Zustand 5                           |
| Scrolling | @tanstack/react-virtual 3           |
| Backend   | Express 5, TypeScript               |
| AWS       | AWS SDK v3 (CloudWatch Logs, EC2, Bedrock Runtime, SSO OIDC) |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/profiles` | List AWS profiles and their configured regions |
| `GET /api/regions?profile=X` | List regions for a profile |
| `GET /api/log-groups?profile&region&prefix&nextToken` | Search/paginate log groups |
| `GET /api/log-streams?profile&region&logGroup&nextToken` | List streams for a log group |
| `GET /api/logs?profile&region&logGroups&startTime&endTime&filterPattern&nextToken` | Fetch filtered log events (auto-paginates) |
| `GET /api/histogram?profile&region&logGroups&startTime&endTime&buckets&filterPattern` | Log distribution histogram via Insights |
| `GET /api/query-presets` | List available query preset templates |
| `GET /api/tail?profile&region&logGroups&filterPattern` | SSE stream for live tail |
| `POST /api/analyze` | Analyze logs for anomalies via Amazon Bedrock |
| `GET /api/sso-sessions` | List SSO sessions and their login status |
| `GET /api/sso-login?sessionName=X` | SSE-based SSO device authorization flow |

## License

MIT
