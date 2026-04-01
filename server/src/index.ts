import express from "express";
import cors from "cors";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import type { Request, Response, NextFunction } from "express";

import profilesRouter from "./routes/profiles.js";
import logGroupsRouter from "./routes/logGroups.js";
import logStreamsRouter from "./routes/logStreams.js";
import logsRouter from "./routes/logs.js";
import histogramRouter from "./routes/histogram.js";
import tailRouter from "./routes/tail.js";
import queryPresetsRouter from "./routes/queryPresets.js";
import ssoRouter from "./routes/sso.js";
import analyzeRouter from "./routes/analyze.js";

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Routes
app.use(profilesRouter);
app.use(logGroupsRouter);
app.use(logStreamsRouter);
app.use(logsRouter);
app.use(histogramRouter);
app.use(tailRouter);
app.use(queryPresetsRouter);
app.use(ssoRouter);
app.use(analyzeRouter);

// Serve client static files in production
const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDist = join(__dirname, "../../client/dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist, {
    setHeaders: (res, filePath) => {
      // Prevent caching index.html so users always get the latest version
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  }));
  // SPA fallback: serve index.html for non-API, non-file routes only
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api/") && !req.path.includes(".")) {
      res.sendFile(join(clientDist, "index.html"));
    } else {
      next();
    }
  });
}

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
