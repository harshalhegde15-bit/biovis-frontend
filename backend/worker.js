require('dotenv').config();
const pool = require('./db');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const RATE_PER_MIN = parseInt(process.env.RATE_LIMIT_PER_MIN || '40');
const POLL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS || '5000');
let sentThisMinute = 0, minuteStart = Date.now();

async function releaseStaleJobs() {
  const { rowCount } = await pool.query(`
    UPDATE email_jobs SET status='pending', locked_at=NULL
    WHERE status='processing' AND locked_at < NOW() - INTERVAL '10 minutes'
  `);
  if (rowCount > 0) console.log('[worker] released', rowCount, 'stale jobs');
}

async function claimJobs(limit) {
  const { rows } = await pool.query(`
    UPDATE email_jobs SET status='processing', locked_at=NOW(), attempts=attempts+1
    WHERE id IN (
      SELECT id FROM email_jobs
      WHERE status='pending' AND scheduled_at<=NOW()
      ORDER BY scheduled_at ASC LIMIT $1
      FOR UPDATE SKIP LOCKED
    ) RETURNING *`, [limit]);
  return rows;
}

async function processJob(job) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Harshal Hegde | Expert Vision Labs <harshalhegde@expertvisionlabs.com>',
      to: [job.email],
      subject: 'Following up — Biovis Scientific Instruments',
      html: '<p>Hello,</p><p>I wanted to follow up regarding Biovis image analysis instruments for your lab.</p><p>Best regards,<br>Harshal Hegde<br>Expert Vision Labs</p>'
    });
    if (error) throw new Error(error.message);

    await pool.query(
      `UPDATE email_jobs SET status='sent', completed_at=NOW() WHERE id=$1`,
      [job.id]
    );
    await pool.query(
      `INSERT INTO sent_emails(lead_id,to_email,template_id,sequence_step,subject,status,score)
       VALUES($1,$2,$3,$4,$5,'sent',10)`,
      [job.contact_id, job.email, job.template_key, job.step,
       'Following up — Biovis Scientific Instruments']
    );
    await pool.query(
      `UPDATE email_batches SET sent=sent+1 WHERE id=$1`,
      [job.batch_id]
    );
    console.log(JSON.stringify({
      event: 'job_sent', email: job.email, step: job.step,
      ts: new Date().toISOString()
    }));
  } catch(err) {
    const backoff = Math.pow(2, job.attempts);
    const isFinal = job.attempts >= job.max_attempts;
    await pool.query(
      `UPDATE email_jobs SET status=$1, error=$2,
       scheduled_at=NOW()+($3||' minutes')::interval WHERE id=$4`,
      [isFinal ? 'failed' : 'pending', err.message, backoff, job.id]
    );
    if (isFinal) {
      await pool.query(
        `UPDATE email_batches SET failed=failed+1 WHERE id=$1`,
        [job.batch_id]
      );
    }
    console.error(JSON.stringify({
      event: 'job_failed', email: job.email,
      error: err.message, attempts: job.attempts
    }));
  }
}

async function workerLoop() {
  if (Date.now() - minuteStart > 60000) {
    sentThisMinute = 0;
    minuteStart = Date.now();
  }
  const slots = RATE_PER_MIN - sentThisMinute;
  if (slots <= 0) {
    console.log('[worker] rate limit reached, sleeping...');
    setTimeout(workerLoop, POLL_MS);
    return;
  }

  const jobs = await claimJobs(Math.min(slots, 10));
  if (!jobs.length) {
    console.log('[worker] polling... no jobs found');
    setTimeout(workerLoop, POLL_MS);
    return;
  }

  for (const job of jobs) {
    await processJob(job);
    sentThisMinute++;
    await new Promise(r => setTimeout(r, 1500));
  }
  setImmediate(workerLoop);
}

console.log('[worker] starting...');
releaseStaleJobs().then(() => workerLoop()).catch(console.error);