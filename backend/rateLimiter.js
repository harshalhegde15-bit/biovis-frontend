// ============================================================
// rateLimiter.js — Day 16: Production rate limiting
// Expert Vision Labs Pvt. Ltd.
// ============================================================
// Protects against abuse: too many emails sent too fast,
// API hammering, accidental infinite loops from the frontend.
// ============================================================
const rateLimit = require("express-rate-limit");

// ── General API rate limit ────────────────────────────────────
// 100 requests per 15 minutes per IP for normal API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a few minutes and try again." },
});

// ── Strict limit for email sending ────────────────────────────
// Prevents accidental mass-send loops or abuse of your Gmail account.
// Gmail itself caps free accounts at ~500/day, so this is a safety net.
const sendEmailLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute window
  max: 20,                   // max 20 send-email calls per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Send rate limit reached. Please wait a minute before sending more emails." },
});

// ── Bulk import limit ─────────────────────────────────────────
// Prevents repeated large Excel uploads from overwhelming the DB
const bulkImportLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,   // 5 minutes
  max: 10,                   // max 10 bulk imports per 5 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many import attempts. Please wait a few minutes." },
});

module.exports = { apiLimiter, sendEmailLimiter, bulkImportLimiter };
