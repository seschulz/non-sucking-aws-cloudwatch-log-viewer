import { Router } from "express";

const router = Router();

const presets = [
  { label: "Errors & Warnings", pattern: '$.log_processed.level = "ERROR" || $.log_processed.level = "WARN"' },
  { label: "Errors", pattern: '$.log_processed.level = "ERROR"' },
  { label: "Warnings", pattern: '$.log_processed.level = "WARN"' },
  { label: "Info", pattern: '$.log_processed.level = "INFO"' },
  { label: "Debug", pattern: '$.log_processed.level = "DEBUG"' },
  { label: "Request ID", pattern: '$.log_processed.requestId = "x"' },
  { label: "Logger Wildcard", pattern: '$.log_processed.logger = "*x*"' },
  { label: "Message Exception", pattern: '$.log_processed.message = "*Exception*"' },
];

router.get("/api/query-presets", (_req, res) => {
  res.json({ presets });
});

export default router;
