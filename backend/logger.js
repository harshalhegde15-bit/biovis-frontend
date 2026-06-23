// ============================================================
// logger.js — Day 17: Production error logging
// Expert Vision Labs Pvt. Ltd.
// ============================================================
// Structured logging that works in dev (console) and production
// (file + ready for Sentry/Logtail integration).
// No external service required to start — upgrade later by
// adding SENTRY_DSN or LOGTAIL_TOKEN to .env.
// ============================================================
const fs   = require("fs");
const path = require("path");

const LOG_DIR = path.join(__dirname, "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const LOG_FILE       = path.join(LOG_DIR, "app.log");
const ERROR_LOG_FILE = path.join(LOG_DIR, "error.log");

function timestamp() {
  return new Date().toISOString();
}

function writeLine(file, line) {
  fs.appendFile(file, line + "\n", (err) => {
    if (err) console.error("Failed to write log:", err.message);
  });
}

function formatLog(level, message, meta) {
  const entry = { time: timestamp(), level, message, ...(meta || {}) };
  return JSON.stringify(entry);
}

const logger = {
  info(message, meta) {
    const line = formatLog("INFO", message, meta);
    console.log(`ℹ️  ${message}`, meta || "");
    writeLine(LOG_FILE, line);
  },

  warn(message, meta) {
    const line = formatLog("WARN", message, meta);
    console.warn(`⚠️  ${message}`, meta || "");
    writeLine(LOG_FILE, line);
  },

  error(message, error, meta) {
    const errorDetails = error ? { errorMessage: error.message, stack: error.stack } : {};
    const line = formatLog("ERROR", message, { ...errorDetails, ...(meta || {}) });
    console.error(`❌  ${message}`, error?.message || "", meta || "");
    writeLine(LOG_FILE, line);
    writeLine(ERROR_LOG_FILE, line);

    // ── Optional: forward to Sentry if configured ──────────────
    if (process.env.SENTRY_DSN && global.Sentry) {
      global.Sentry.captureException(error || new Error(message), { extra: meta });
    }
  },

  email(action, details) {
    const line = formatLog("EMAIL", action, details);
    writeLine(LOG_FILE, line);
  },
};

// ── Express middleware: log every request ─────────────────────
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (res.statusCode >= 400) {
      logger.warn(`${req.method} ${req.path} → ${res.statusCode}`, { duration_ms: duration, ip: req.ip });
    } else {
      logger.info(`${req.method} ${req.path} → ${res.statusCode}`, { duration_ms: duration });
    }
  });
  next();
}

// ── Express error handler (must be last middleware) ───────────
function errorHandler(err, req, res, next) {
  logger.error(`Unhandled error on ${req.method} ${req.path}`, err, { ip: req.ip, body: req.body });
  res.status(500).json({ success: false, error: "Internal server error. Our team has been notified." });
}

module.exports = { logger, requestLogger, errorHandler };
