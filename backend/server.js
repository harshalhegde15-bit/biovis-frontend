// ============================================================
// server.js — Biovis Campaign Backend — PRODUCTION READY
// Days 16-21: Security, logging, rate limiting, health checks
// Expert Vision Labs Pvt. Ltd.
// ============================================================
require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const helmet     = require("helmet");
const nodemailer = require("nodemailer");
const pool       = require("./db");
const { initScheduler } = require("./scheduler");
const { apiLimiter, sendEmailLimiter, bulkImportLimiter } = require("./rateLimiter");
const { logger, requestLogger, errorHandler } = require("./logger");

const app  = express();
const PORT = process.env.PORT || 5000;

// ─────────────────────────────────────────────
// ENVIRONMENT VALIDATION — fail fast on missing config
// ─────────────────────────────────────────────
const REQUIRED_ENV = ["DATABASE_URL", "EMAIL_USER", "EMAIL_PASS"];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`❌  Missing required environment variables: ${missing.join(", ")}`);
  console.error(`    Check your .env file before starting the server.`);
  process.exit(1);
}

// ─────────────────────────────────────────────
// SECURITY MIDDLEWARE
// ─────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // API-only backend, no inline scripts to worry about
  })
);

// ─────────────────────────────────────────────
// CORS — temporarily allow all origins (debugging)
// ─────────────────────────────────────────────
app.use(
  cors({
    origin: true, // reflect the request origin
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(requestLogger);

// Apply general rate limit to all API routes
app.use("/api", apiLimiter);

// ─────────────────────────────────────────────
// NODEMAILER
// ─────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
}

// ─────────────────────────────────────────────
// DB HELPERS
// ─────────────────────────────────────────────
async function logSentEmail({
  leadId,
  toEmail,
  personName,
  company,
  sector,
  templateId,
  sequenceStep,
  subject,
  status,
  errorMessage,
  score,
}) {
  await pool.query(
    `INSERT INTO sent_emails
       (lead_id,to_email,person_name,company,sector,
        template_id,sequence_step,subject,status,error_message,score)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      leadId || null,
      toEmail,
      personName || "",
      company || "",
      sector || "",
      templateId || "biovis_psa",
      sequenceStep || 1,
      subject,
      status,
      errorMessage || null,
      score ?? 10,
    ]
  );
}

async function upsertLeadSequence({
  leadId,
  toEmail,
  personName,
  company,
  sector,
  templateId,
  sequenceId,
  currentStep,
}) {
  await pool.query(
    `INSERT INTO lead_sequences
       (lead_id,to_email,person_name,company,sector,template_id,sequence_id,current_step,last_sent_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
     ON CONFLICT (lead_id) DO UPDATE SET
       current_step = GREATEST(lead_sequences.current_step,$8),
       template_id  = $6, sequence_id = $7,
       last_sent_at = NOW(), updated_at = NOW()`,
    [
      String(leadId),
      toEmail,
      personName || "",
      company || "",
      sector || "",
      templateId || "biovis_psa",
      sequenceId || "default",
      currentStep || 1,
    ]
  );
}

// ─────────────────────────────────────────────
// HEALTH CHECK — used by Railway/uptime monitors
// ─────────────────────────────────────────────
app.get("/ping", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS now");
    res.json({
      status: "healthy",
      message: "Backend running",
      db: "PostgreSQL (Supabase) connected",
      db_time: result.rows[0].now,
      scheduler: "active",
      uptime_seconds: Math.floor(process.uptime()),
      env: process.env.NODE_ENV || "development",
    });
  } catch (err) {
    logger.error("Health check DB failure", err);
    res.status(503).json({
      status: "unhealthy",
      message: "Backend running but DB error",
      error: err.message,
    });
  }
});

// Deeper health check — verifies email transporter too
app.get("/health/deep", async (req, res) => {
  const checks = { database: false, email: false };
  try {
    await pool.query("SELECT 1");
    checks.database = true;
  } catch (err) {
    logger.error("DB health check failed", err);
  }

  try {
    await createTransporter().verify();
    checks.email = true;
  } catch (err) {
    logger.error("Email health check failed", err);
  }

  const allHealthy = Object.values(checks).every(Boolean);
  res
    .status(allHealthy ? 200 : 503)
    .json({ status: allHealthy ? "healthy" : "degraded", checks });
});

// ─────────────────────────────────────────────
// CONTACTS
// ─────────────────────────────────────────────
app.get("/api/contacts", async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT c.*,
        se.status AS last_status, se.sent_at AS last_sent_at, se.sequence_step AS last_step,
        ls.current_step, ls.paused, ls.completed,
        COALESCE(lsc.score,0) AS score
      FROM contacts c
      LEFT JOIN LATERAL (
        SELECT status,sent_at,sequence_step FROM sent_emails
        WHERE lead_id=c.lead_id ORDER BY sent_at DESC LIMIT 1
      ) se ON TRUE
      LEFT JOIN lead_sequences ls ON ls.lead_id=c.lead_id
      LEFT JOIN lead_scores lsc   ON lsc.lead_id=c.lead_id
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.post("/api/contacts/bulk", bulkImportLimiter, async (req, res, next) => {
  const { contacts, sourceFile = "" } = req.body;
  if (!Array.isArray(contacts) || !contacts.length)
    return res.status(400).json({ error: "contacts array required" });

  let inserted = 0,
    updated = 0,
    skipped = 0;
  try {
    for (const c of contacts) {
      if (!c.email || !c.email.includes("@")) {
        skipped++;
        continue;
      }
      const leadId =
        c.leadId ||
        c.id ||
        `email_${c.email.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
      const r = await pool.query(
        `INSERT INTO contacts (lead_id,person_name,email,company,phone,sector,product_interest,source_file)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (lead_id) DO UPDATE SET
           person_name=$2,email=$3,company=$4,phone=$5,
           sector=$6,product_interest=$7,source_file=$8,updated_at=NOW()
         RETURNING (xmax=0) AS is_insert`,
        [
          String(leadId),
          c.personName || c.name || "",
          c.email.trim(),
          c.company || "",
          c.phone || "",
          c.sector || "",
          c.productInterest || "",
          sourceFile,
        ]
      );
      r.rows[0].is_insert ? inserted++ : updated++;
    }
    logger.info("Bulk contact import completed", {
      inserted,
      updated,
      skipped,
      sourceFile,
    });
    res.json({
      success: true,
      inserted,
      updated,
      skipped,
      total: contacts.length,
    });
  } catch (err) {
    next(err);
  }
});

app.delete("/api/contacts/:leadId", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM contacts WHERE lead_id=$1", [
      req.params.leadId,
    ]);
    logger.info("Contact deleted", { leadId: req.params.leadId });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

app.get("/api/contacts/:leadId/history", async (req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT id,template_id,sequence_step,subject,status,opened,replied,sent_at
       FROM sent_emails WHERE lead_id=$1 ORDER BY sent_at DESC`,
      [req.params.leadId]
    );
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────
// SEND EMAIL — rate limited
// ─────────────────────────────────────────────
app.post("/send-email", sendEmailLimiter, async (req, res, next) => {
  const {
    to,
    subject,
    body,
    leadId = null,
    personName = "",
    company = "",
    sector = "",
    templateId = "biovis_psa",
    sequenceStep = 1,
    sequenceId = "default",
  } = req.body;

  if (!to || !subject || !body)
    return res
      .status(400)
      .json({ success: false, error: "Missing: to, subject, body" });
  if (!to.includes("@"))
    return res
      .status(400)
      .json({ success: false, error: `Invalid email: ${to}` });

  try {
    const info = await createTransporter().sendMail({
      from: `"${process.env.SENDER_NAME ||
        "Harshal Hegde | Expert Vision Labs"}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: body,
    });

    await logSentEmail({
      leadId,
      toEmail: to,
      personName,
      company,
      sector,
      templateId,
      sequenceStep,
      subject,
      status: "sent",
      errorMessage: null,
      score: 10,
    });

    if (leadId)
      await upsertLeadSequence({
        leadId,
        toEmail: to,
        personName,
        company,
        sector,
        templateId,
        sequenceId,
        currentStep: sequenceStep,
      });

    logger.email("sent", { to, templateId, sequenceStep, leadId });
    return res.json({ success: true, messageId: info.messageId });
  } catch (err) {
    try {
      await logSentEmail({
        leadId,
        toEmail: to,
        personName,
        company,
        sector,
        templateId,
        sequenceStep,
        subject,
        status: "error",
        errorMessage: err.message,
        score: 0,
      });
    } catch (dbErr) {
      logger.error("DB log error after send failure", dbErr);
    }

    logger.error("Email send failed", err, { to, templateId });
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────
// SEQUENCES
// ─────────────────────────────────────────────
app.get("/api/sequences", async (req, res, next) => {
  try {
    const r = await pool.query(`
      SELECT ls.*, (SELECT COUNT(*) FROM sent_emails se WHERE se.lead_id=ls.lead_id) AS total_emails_sent
      FROM lead_sequences ls ORDER BY ls.updated_at DESC
    `);
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});

app.get("/api/sequences/:leadId", async (req, res, next) => {
  try {
    const r = await pool.query(
      "SELECT * FROM lead_sequences WHERE lead_id=$1",
      [req.params.leadId]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Not found" });
    res.json(r.rows[0]);
  } catch (err) {
    next(err);
  }
});

app.post("/api/sequences/:leadId/pause", async (req, res, next) => {
  try {
    await pool.query(
      "UPDATE lead_sequences SET paused=TRUE,updated_at=NOW() WHERE lead_id=$1",
      [req.params.leadId]
    );
    res.json({ success: true, action: "paused" });
  } catch (err) {
    next(err);
  }
});

app.post("/api/sequences/:leadId/resume", async (req, res, next) => {
  try {
    await pool.query(
      "UPDATE lead_sequences SET paused=FALSE,updated_at=NOW() WHERE lead_id=$1",
      [req.params.leadId]
    );
    res.json({ success: true, action: "resumed" });
  } catch (err) {
    next(err);
  }
});

app.post("/api/sequences/:leadId/replied", async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE lead_sequences SET paused=TRUE,updated_at=NOW() WHERE lead_id=$1`,
      [req.params.leadId]
    );
    await pool.query(
      `UPDATE lead_scores SET replied=TRUE,score=score+50,last_activity=NOW(),updated_at=NOW() WHERE lead_id=$1`,
      [req.params.leadId]
    );
    await pool.query(
      `UPDATE sent_emails SET replied=TRUE WHERE lead_id=$1 AND id=(SELECT id FROM sent_emails WHERE lead_id=$1 ORDER BY sent_at DESC LIMIT 1)`,
      [req.params.leadId]
    );
    logger.info("Lead marked as replied", { leadId: req.params.leadId });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────
app.get("/api/stats/summary", async (req, res, next) => {
  const days = Math.min(Number(req.query.days) || 7, 365);
  try {
    const [
      sent,
      errors,
      allTime,
      today,
      activeSeq,
      completedSeq,
      totalContacts,
      replied,
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS c FROM sent_emails WHERE status='sent' AND sent_at>=NOW()-INTERVAL '${days} days'`
      ),
      pool.query(
        `SELECT COUNT(*) AS c FROM sent_emails WHERE status='error' AND sent_at>=NOW()-INTERVAL '${days} days'`
      ),
      pool.query(
        `SELECT COUNT(*) AS c FROM sent_emails WHERE status='sent'`
      ),
      pool.query(
        `SELECT COUNT(*) AS c FROM sent_emails WHERE status='sent' AND sent_at>=NOW()-INTERVAL '1 day'`
      ),
      pool.query(
        `SELECT COUNT(*) AS c FROM lead_sequences WHERE completed=FALSE AND paused=FALSE`
      ),
      pool.query(
        `SELECT COUNT(*) AS c FROM lead_sequences WHERE completed=TRUE`
      ),
      pool.query(`SELECT COUNT(*) AS c FROM contacts`),
      pool.query(
        `SELECT COUNT(*) AS c FROM lead_scores WHERE replied=TRUE`
      ),
    ]);
    res.json({
      sent_last_n_days: Number(sent.rows[0].c),
      errors_last_n_days: Number(errors.rows[0].c),
      sent_all_time: Number(allTime.rows[0].c),
      sent_today: Number(today.rows[0].c),
      active_sequences: Number(activeSeq.rows[0].c),
      completed_sequences: Number(completedSeq.rows[0].c),
      total_contacts: Number(totalContacts.rows[0].c),
      replied_leads: Number(replied.rows[0].c),
      days,
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/stats/templates", async (req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT template_id, COUNT(*) FILTER (WHERE status='sent') AS sent, COUNT(*) FILTER (WHERE status='error') AS errors FROM sent_emails GROUP BY template_id ORDER BY sent DESC`
    );
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});

app.get("/api/stats/sectors", async (req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT sector, COUNT(*) FILTER (WHERE status='sent') AS sent, COUNT(*) FILTER (WHERE status='error') AS errors FROM sent_emails WHERE sector IS NOT NULL AND sector<>'' GROUP BY sector ORDER BY sent DESC`
    );
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});

app.get("/api/stats/sequence", async (req, res, next) => {
  try {
    const [funnel, completed, paused, total] = await Promise.all([
      pool.query(
        `SELECT current_step, COUNT(*) AS count FROM lead_sequences WHERE completed=FALSE GROUP BY current_step ORDER BY current_step`
      ),
      pool.query(
        `SELECT COUNT(*) AS c FROM lead_sequences WHERE completed=TRUE`
      ),
      pool.query(
        `SELECT COUNT(*) AS c FROM lead_sequences WHERE paused=TRUE`
      ),
      pool.query(`SELECT COUNT(*) AS c FROM lead_sequences`),
    ]);
    res.json({
      funnel: funnel.rows.map((r) => ({
        current_step: Number(r.current_step),
        count: Number(r.count),
      })),
      completed: Number(completed.rows[0].c),
      paused: Number(paused.rows[0].c),
      total: Number(total.rows[0].c),
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/stats/recent", async (req, res, next) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  try {
    const r = await pool.query(
      `SELECT id,to_email,person_name,company,sector,template_id,sequence_step,status,opened,replied,sent_at FROM sent_emails ORDER BY sent_at DESC LIMIT $1`,
      [limit]
    );
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});

app.get("/api/stats/daily", async (req, res, next) => {
  const days = Math.min(Number(req.query.days) || 14, 90);
  try {
    const r = await pool.query(
      `SELECT DATE(sent_at) AS date, COUNT(*) FILTER (WHERE status='sent') AS sent, COUNT(*) FILTER (WHERE status='error') AS errors FROM sent_emails WHERE sent_at>=NOW()-INTERVAL '${days} days' GROUP BY DATE(sent_at) ORDER BY date ASC`
    );
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});

app.get("/api/stats/scores", async (req, res, next) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  try {
    const r = await pool.query(
      `SELECT ls.*, c.phone FROM lead_scores ls LEFT JOIN contacts c ON c.lead_id=ls.lead_id ORDER BY ls.score DESC LIMIT $1`,
      [limit]
    );
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});

app.get("/api/stats/sequence-detail", async (req, res, next) => {
  try {
    const r = await pool.query(`
      SELECT ls.lead_id, ls.person_name, ls.to_email, ls.company, ls.sector,
             ls.current_step, ls.paused, ls.completed, ls.last_sent_at,
             COALESCE(lsc.score,0) AS score,
             (SELECT COUNT(*) FROM sent_emails se WHERE se.lead_id=ls.lead_id) AS emails_sent
      FROM lead_sequences ls LEFT JOIN lead_scores lsc ON lsc.lead_id=ls.lead_id
      ORDER BY ls.current_step DESC, ls.last_sent_at DESC
    `);
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────
// 404 + ERROR HANDLING (must be last)
// ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});
app.use(errorHandler);

// ─────────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────
let server;
function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully…`);
  if (server) {
    server.close(() => {
      logger.info("HTTP server closed");
      pool.end().then(() => {
        logger.info("Database pool closed");
        process.exit(0);
      });
    });
    setTimeout(() => process.exit(1), 10000); // force exit after 10s
  } else {
    process.exit(0);
  }
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", err);
});
process.on("unhandledRejection", (reason) => {
  logger.error(
    "Unhandled rejection",
    reason instanceof Error ? reason : new Error(String(reason))
  );
});

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
server = app.listen(PORT, () => {
  logger.info(`Biovis Campaign Backend started`, {
    port: PORT,
    env: process.env.NODE_ENV || "development",
  });
  console.log(
    `\n🚀  Biovis Campaign Backend — port ${PORT} [${process.env.NODE_ENV ||
      "development"}]`
  );
  console.log(`📧  Sender   : ${process.env.EMAIL_USER}`);
  console.log(`🗄️   Database : PostgreSQL via Supabase`);
  console.log(`🔗  Health   : http://localhost:${PORT}/ping\n`);
  initScheduler(pool);
});