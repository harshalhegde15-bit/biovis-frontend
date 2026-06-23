// ============================================================
// scheduler.js — Biovis Auto Follow-up Scheduler (PostgreSQL)
// Expert Vision Labs Pvt. Ltd.
// ============================================================
const cron       = require("node-cron");
const nodemailer = require("nodemailer");

// ── Sequence definitions (CommonJS, mirrors sequences.js) ─────
const SEQUENCES = {
  default: {
    id: "default",
    steps: [
      { step: 1, type: "initial",  templateId: "biovis_psa", delayDays: 0  },
      { step: 2, type: "followup", templateId: "biovis_psa", delayDays: 3  },
      { step: 3, type: "followup", templateId: "biovis_all", delayDays: 7  },
      { step: 4, type: "followup", templateId: "biovis_all", delayDays: 14 },
    ],
  },
  pharmaceutical: {
    id: "pharmaceutical",
    steps: [
      { step: 1, type: "initial",  templateId: "biovis_psa", delayDays: 0  },
      { step: 2, type: "followup", templateId: "biovis_fps", delayDays: 3  },
      { step: 3, type: "followup", templateId: "biovis_mp",  delayDays: 7  },
      { step: 4, type: "followup", templateId: "biovis_all", delayDays: 14 },
    ],
  },
  life_science: {
    id: "life_science",
    steps: [
      { step: 1, type: "initial",  templateId: "cell_analysis", delayDays: 0  },
      { step: 2, type: "followup", templateId: "biovis_psa",    delayDays: 3  },
      { step: 3, type: "followup", templateId: "biovis_ip",     delayDays: 7  },
      { step: 4, type: "followup", templateId: "biovis_all",    delayDays: 14 },
    ],
  },
  industrial: {
    id: "industrial",
    steps: [
      { step: 1, type: "initial",  templateId: "biovis_ip",  delayDays: 0  },
      { step: 2, type: "followup", templateId: "biovis_psa", delayDays: 3  },
      { step: 3, type: "followup", templateId: "biovis_mp",  delayDays: 7  },
      { step: 4, type: "followup", templateId: "biovis_all", delayDays: 14 },
    ],
  },
  human_science: {
    id: "human_science",
    steps: [
      { step: 1, type: "initial",  templateId: "cell_analysis", delayDays: 0  },
      { step: 2, type: "followup", templateId: "biovis_fps",    delayDays: 3  },
      { step: 3, type: "followup", templateId: "biovis_mp",     delayDays: 7  },
      { step: 4, type: "followup", templateId: "biovis_all",    delayDays: 14 },
    ],
  },
  agriculture: {
    id: "agriculture",
    steps: [
      { step: 1, type: "initial",  templateId: "biovis_psa", delayDays: 0  },
      { step: 2, type: "followup", templateId: "biovis_ip",  delayDays: 3  },
      { step: 3, type: "followup", templateId: "biovis_psa", delayDays: 7  },
      { step: 4, type: "followup", templateId: "biovis_all", delayDays: 14 },
    ],
  },
};

const SECTOR_SEQUENCE_MAP = {
  "Pharmaceutical": "pharmaceutical",
  "Life Science":   "life_science",
  "Industrial":     "industrial",
  "Human Science":  "human_science",
  "Agriculture":    "agriculture",
};

function getSequenceForSector(sector) {
  const id = SECTOR_SEQUENCE_MAP[(sector || "").trim()] || "default";
  return SEQUENCES[id] || SEQUENCES.default;
}

// ── Email builder ─────────────────────────────
const SIGNATURE = `Best Regards,
Harshal Hegde
Expert Vision Labs Pvt. Ltd.
Ground Floor, 102 Anandi Building, Dr. M.B. Raut Road, Dadar (West)
Mumbai – 400028, Maharashtra, India
Tel: +91 22 2444 2565 / +91 22 2444 2566
Mobile: +91 85915 86471
Website: www.expertvisionlabs.com
Email: harshalhegde@expertvisionlabs.com
Brand: Biovis® — Advanced Image Analysis Scientific Instruments`;

const PRODUCT_NAMES = {
  biovis_psa:    "Biovis® PSA 2000",
  biovis_fps:    "Biovis® FPS",
  biovis_mp:     "Biovis® MP",
  biovis_ip:     "Biovis® IP",
  cell_analysis: "Biovis® Cell Analysis Suite",
  biovis_all:    "Biovis® Product Range",
};

const SECTOR_CONTEXT = {
  Pharmaceutical:  "pharmaceutical research, quality control, and regulatory compliance",
  Industrial:      "industrial manufacturing, process quality control, and surface inspection",
  Agriculture:     "agricultural research, seed science, and agri-input quality control",
  "Human Science": "human science research, clinical diagnostics, and laboratory medicine",
  "Life Science":  "life science research, bioassay development, and drug discovery",
};

function buildFollowUpEmail(lead, stepDef) {
  const productName   = PRODUCT_NAMES[stepDef.templateId] || "Biovis® instruments";
  const sectorContext = SECTOR_CONTEXT[lead.sector] || "scientific research and quality control";
  const firstName     = (lead.person_name || "Sir/Madam")
    .replace(/^(dr\.|mr\.|ms\.|mrs\.|prof\.)\s*/i, "")
    .split(" ")[0];

  const subject = `Follow-up (Step ${stepDef.step}/4) — ${productName} for ${lead.company || "Your Organisation"}`;
  const body    = `Respected ${firstName},\n\nGreetings from Expert Vision Labs!\n\nI am following up on my earlier correspondence regarding our ${productName}, which I believe can bring meaningful value to your work in ${sectorContext}.\n\nWe would be delighted to arrange a product demonstration, share application notes, or answer any questions at your convenience.\n\n${SIGNATURE}`;
  const html    = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:680px;margin:0 auto;padding:20px"><pre style="white-space:pre-wrap;font-family:inherit;font-size:14px">${body}</pre></body></html>`;

  return { to: lead.to_email, subject, body, html };
}

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
}

// ─────────────────────────────────────────────
// SCHEDULER — receives the pg pool from server.js
// ─────────────────────────────────────────────
function initScheduler(pool) {

  // ── Run every 10 minutes ──────────────────────────────────────
  // For production daily sends change to: "0 9 * * *"
  const job = cron.schedule("*/10 * * * *", async () => {
    const ts = new Date().toISOString();
    console.log(`\n[Scheduler ${ts}] Checking for due follow-ups…`);

    let sent = 0, skipped = 0, errors = 0;

    try {
      // Fetch all active (not paused, not completed) sequences not yet at step 4
      const { rows: activeLeads } = await pool.query(`
        SELECT * FROM lead_sequences
        WHERE completed = FALSE
          AND paused    = FALSE
          AND current_step < 4
        ORDER BY last_sent_at ASC
      `);

      console.log(`[Scheduler] ${activeLeads.length} active sequence(s)`);

      for (const lead of activeLeads) {
        const sequence    = getSequenceForSector(lead.sector);
        const nextStep    = lead.current_step + 1;
        const nextDef     = sequence.steps.find(s => s.step === nextStep);

        if (!nextDef) { skipped++; continue; }

        // Check if delay has elapsed since last send
        const lastSent    = new Date(lead.last_sent_at).getTime();
        const delayMs     = nextDef.delayDays * 24 * 60 * 60 * 1000;
        const isDue       = Date.now() - lastSent >= delayMs;

        if (!isDue) {
          const dueAt = new Date(lastSent + delayMs).toLocaleDateString("en-IN");
          console.log(`[Scheduler] ${lead.to_email} — step ${nextStep} due ${dueAt}, skipping`);
          skipped++;
          continue;
        }

        console.log(`[Scheduler] Sending step ${nextStep} → ${lead.to_email} (${lead.sector})`);
        const emailData = buildFollowUpEmail(lead, nextDef);

        try {
          const transporter = createTransporter();
          await transporter.sendMail({
            from:    `"${process.env.SENDER_NAME || "Harshal Hegde | Expert Vision Labs"}" <${process.env.EMAIL_USER}>`,
            to:      emailData.to,
            subject: emailData.subject,
            html:    emailData.html,
          });

          const isCompleted = nextStep >= sequence.steps.length;

          // Update sequence state in PostgreSQL
          await pool.query(`
            UPDATE lead_sequences
            SET current_step = $1,
                last_sent_at = NOW(),
                completed    = $2,
                updated_at   = NOW()
            WHERE lead_id = $3
          `, [nextStep, isCompleted, lead.lead_id]);

          // Log to sent_emails
          await pool.query(`
            INSERT INTO sent_emails
              (lead_id, to_email, person_name, company, sector,
               template_id, sequence_step, subject, status, score)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'sent',10)
          `, [
            lead.lead_id, emailData.to, lead.person_name || "",
            lead.company || "", lead.sector || "",
            nextDef.templateId, nextStep, emailData.subject,
          ]);

          sent++;
          console.log(`[Scheduler] ✓ Step ${nextStep} sent to ${lead.to_email}${isCompleted ? " — SEQUENCE COMPLETE" : ""}`);

          // Small delay between sends
          await new Promise(r => setTimeout(r, 1500));

        } catch (sendErr) {
          // Log error but don't advance step — retries next run
          try {
            await pool.query(`
              INSERT INTO sent_emails
                (lead_id, to_email, person_name, company, sector,
                 template_id, sequence_step, subject, status, error_message, score)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'error',$9,0)
            `, [
              lead.lead_id, emailData.to, lead.person_name || "",
              lead.company || "", lead.sector || "",
              nextDef.templateId, nextStep, emailData.subject, sendErr.message,
            ]);
          } catch (dbErr) { console.error("[Scheduler] DB log error:", dbErr.message); }

          errors++;
          console.error(`[Scheduler] ✗ Step ${nextStep} failed for ${lead.to_email}: ${sendErr.message}`);
        }
      }

      console.log(`[Scheduler] Done — ${sent} sent, ${skipped} not due, ${errors} errors\n`);

    } catch (err) {
      console.error(`[Scheduler] Fatal error: ${err.message}`);
    }
  });

  console.log("⏱   Scheduler active — checking every 10 minutes for due follow-ups");
  return job;
}

module.exports = { initScheduler };
