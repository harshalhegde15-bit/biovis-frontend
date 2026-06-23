import React, { useState, useRef, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import {
  buildEmailDraftFromLead,
  buildFollowUpDraftFromLead,
  getProductTemplateList,
} from "./agents/BiovisOutreachAgent";
import {
  getSequenceForLead,
  getStepDefinition,
  getSequenceList,
} from "./sequences";

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const MAX_BATCH_SIZE  = 50;
const SEND_DELAY_MS   = 1200;
const BACKEND_URL     = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";
const EMAIL_TEMPLATES = getProductTemplateList();

// ─────────────────────────────────────────────
// HEADER MAP BUILDER
// ─────────────────────────────────────────────
function buildHeaderMap(firstRow) {
  const headers = Object.keys(firstRow || {});
  const lowered = headers.map((h) => h.toLowerCase());
  const find = (preds) => {
    for (let i = 0; i < headers.length; i++)
      if (preds.some((p) => p(lowered[i]))) return headers[i];
    return null;
  };
  return {
    personNameHeader: find([
      (h) => h.includes("name of individual"),
      (h) => h.includes("contact name"),
      (h) => h.includes("person"),
      (h) => h.includes("name") && !h.includes("company"),
    ]),
    emailHeader: find([
      (h) => h.includes("email id"),
      (h) => h.includes("email"),
      (h) => h.includes("mail"),
    ]),
    companyHeader: find([
      (h) => h.includes("company"),
      (h) => h.includes("institute"),
      (h) => h.includes("organization"),
      (h) => h.includes("organisation"),
      (h) => h.includes("firm"),
    ]),
    sectorHeader: find([
      (h) => h.includes("industry"),
      (h) => h.includes("sector"),
      (h) => h.includes("segment"),
      (h) => h.includes("category"),
    ]),
    phoneHeader: find([
      (h) => h.includes("phone"),
      (h) => h.includes("mobile"),
      (h) => h.includes("contact no"),
      (h) => h.includes("tel"),
    ]),
    productHeader: find([
      (h) => h.includes("product"),
      (h) => h.includes("interest"),
      (h) => h.includes("biovis"),
    ]),
  };
}

function guessSectorFromCompany(company) {
  if (!company) return "";
  const c = company.toLowerCase();
  if (c.includes("pharma") || c.includes("laborator") || c.includes("herb")) return "Pharmaceutical";
  if (c.includes("chem") || c.includes("chemical")) return "Industrial";
  if (c.includes("seed") || c.includes("agro") || c.includes("farm")) return "Agriculture";
  if (c.includes("clinic") || c.includes("hospital")) return "Human Science";
  if (c.includes("bio") || c.includes("life")) return "Life Science";
  return "";
}

function makeLeadId(email) {
  return `email_${email.toLowerCase().trim().replace(/[^a-z0-9]/g, "_")}`;
}

// ─────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────
const SECTOR_COLORS = {
  Pharmaceutical: { bg: "#EFF6FF", text: "#1D4ED8" },
  Industrial:     { bg: "#FFFBEB", text: "#92400E" },
  Agriculture:    { bg: "#F0FDF4", text: "#166534" },
  "Human Science":{ bg: "#FDF2F8", text: "#9D174D" },
  "Life Science": { bg: "#F5F3FF", text: "#5B21B6" },
};

function SectorBadge({ sector }) {
  const c = SECTOR_COLORS[sector] || { bg: "#F3F4F6", text: "#374151" };
  return (
    <span style={{ background: c.bg, color: c.text, borderRadius: 20, fontSize: 10, fontWeight: 600, padding: "2px 8px", whiteSpace: "nowrap" }}>
      {sector || "—"}
    </span>
  );
}

const STATUS_MAP = {
  sent:        { bg: "#ECFDF5", text: "#059669", label: "Sent ✓" },
  "follow-up": { bg: "#FFFBEB", text: "#D97706", label: "Follow-up sent" },
  error:       { bg: "#FEF2F2", text: "#DC2626", label: "Error" },
  sending:     { bg: "#EFF6FF", text: "#2563EB", label: "Sending…" },
  retrying:    { bg: "#F5F3FF", text: "#7C3AED", label: "Retrying…" },
  pending:     { bg: "#F9FAFB", text: "#6B7280", label: "Pending" },
};

function StatusPill({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.pending;
  return (
    <span style={{ background: s.bg, color: s.text, borderRadius: 20, fontSize: 10, fontWeight: 600, padding: "2px 9px", whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

function SequenceBadge({ lead }) {
  if (!lead.current_step) return <span style={{ color: "#9CA3AF", fontSize: 11 }}>—</span>;
  const color = lead.completed ? "#059669" : lead.paused ? "#D97706" : "#1B2C6B";
  const label = lead.completed ? "✓ Done" : lead.paused ? `⏸ ${lead.current_step}/4` : `Step ${lead.current_step}/4`;
  return <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>;
}

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

function wrapHtml(body) {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:680px;margin:0 auto;padding:20px"><pre style="white-space:pre-wrap;font-family:inherit;font-size:14px">${body}</pre></body></html>`;
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function CampaignPreview() {
  const navigate = useNavigate();

  // ── Core state ────────────────────────────────────────────────
  const [contacts, setContacts]               = useState([]);  // loaded from DB
  const [localStatus, setLocalStatus]         = useState({});  // leadId → status (optimistic UI)
  const [loading, setLoading]                 = useState(true);
  const [importing, setImporting]             = useState(false);
  const [importResult, setImportResult]       = useState(null);
  const [error, setError]                     = useState("");
  const [headerMap, setHeaderMap]             = useState(null);
  const [draft, setDraft]                     = useState(null);
  const [sending, setSending]                 = useState(false);
  const [batchRunning, setBatchRunning]       = useState(false);
  const [batchProgress, setBatchProgress]     = useState({ done: 0, total: 0 });
  const [batchLog, setBatchLog]               = useState([]);
  const [selectedTemplates, setSelectedTemplates] = useState({});
  const [searchTerm, setSearchTerm]           = useState("");
  const [filterSector, setFilterSector]       = useState("All");
  const cancelRef                             = useRef(false);

  // ── Load contacts from DB on mount ───────────────────────────
  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/api/contacts`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setContacts(data);
        // Sync local status from DB
        const statusMap = {};
        data.forEach((c) => {
          if (c.last_status === "sent" && c.current_step > 1) statusMap[c.lead_id] = "follow-up";
          else if (c.last_status === "sent") statusMap[c.lead_id] = "sent";
          else if (c.last_status === "error") statusMap[c.lead_id] = "error";
        });
        setLocalStatus(statusMap);
      }
    } catch (err) {
      setError("Could not load contacts from database: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  // ── Helpers ───────────────────────────────────────────────────
  function setStatus(leadId, status) {
    setLocalStatus((p) => ({ ...p, [leadId]: status }));
  }

  function addLog(msg, type = "info") {
    const time = new Date().toTimeString().slice(0, 8);
    setBatchLog((l) => [...l, { time, msg, type }]);
  }

  // ── Excel file handler → parse + save to DB ───────────────────
  const handleFile = async (file) => {
    setError("");
    setImportResult(null);
    setImporting(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb   = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (!rows.length) {
          setError("Sheet appears to be empty.");
          setImporting(false);
          return;
        }

        const map = buildHeaderMap(rows[0]);
        setHeaderMap(map);

        // Map Excel rows to contact objects
        const mapped = rows
          .map((row) => {
            const personName = (map.personNameHeader && row[map.personNameHeader]) || "";
            const email      = (map.emailHeader && row[map.emailHeader]) || "";
            if (!email || !email.includes("@")) return null;

            const company         = (map.companyHeader && row[map.companyHeader]) || "";
            const phone           = (map.phoneHeader && row[map.phoneHeader]) || "";
            const productInterest = (map.productHeader && row[map.productHeader]) || "";
            let sector            = (map.sectorHeader && row[map.sectorHeader]) || "";
            if (!sector) sector   = guessSectorFromCompany(company);

            return {
              leadId: makeLeadId(email),
              personName,
              email:  email.trim(),
              company,
              phone,
              sector,
              productInterest,
            };
          })
          .filter(Boolean);

        if (!mapped.length) {
          setError("No valid email addresses found in the sheet.");
          setImporting(false);
          return;
        }

        // Save to PostgreSQL
        const res  = await fetch(`${BACKEND_URL}/api/contacts/bulk`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ contacts: mapped, sourceFile: file.name }),
        });
        const result = await res.json();

        if (result.error) {
          setError("Import failed: " + result.error);
        } else {
          setImportResult(result);
          // Reload contacts from DB so table shows fresh data with DB ids
          await loadContacts();
        }
      } catch (err) {
        setError("Failed to read Excel: " + err.message);
      } finally {
        setImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ── Core send function ────────────────────────────────────────
  async function sendEmail({ to, subject, body, leadId, lead, templateId, sequenceStep, isFollowUp }) {
    const sequence = lead ? getSequenceForLead(lead) : { id: "default" };
    const res = await fetch(`${BACKEND_URL}/send-email`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        to, subject,
        body:         wrapHtml(body),
        leadId:       leadId || null,
        personName:   lead?.person_name || lead?.personName || "",
        company:      lead?.company     || "",
        sector:       lead?.sector      || "",
        templateId,
        sequenceStep,
        sequenceId:   sequence.id,
      }),
    });
    return res.json();
  }

  // ── Single send (review pane) ─────────────────────────────────
  async function sendSingleEmail(draftObj) {
    setSending(true);
    try {
      const data = await sendEmail(draftObj);
      if (data.success) {
        setStatus(draftObj.leadId, draftObj.isFollowUp ? "follow-up" : "sent");
        setDraft(null);
        // Refresh contacts to get updated sequence state from DB
        await loadContacts();
        alert(`Email sent to ${draftObj.to}`);
      } else {
        setStatus(draftObj.leadId, "error");
        alert("Send failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      setStatus(draftObj.leadId, "error");
      alert("Error: " + err.message);
    } finally {
      setSending(false);
    }
  }

  // ── Retry errored lead ────────────────────────────────────────
  async function retryLead(lead) {
    const leadId     = lead.lead_id;
    const templateId = selectedTemplates[leadId] || "biovis_psa";
    const d          = buildEmailDraftFromLead(lead, templateId);
    setStatus(leadId, "retrying");
    try {
      const data = await sendEmail({ ...d, leadId, lead, templateId, sequenceStep: 1, isFollowUp: false });
      setStatus(leadId, data.success ? "sent" : "error");
      if (data.success) await loadContacts();
    } catch { setStatus(leadId, "error"); }
  }

  // ── Pause / Resume sequence ───────────────────────────────────
  async function togglePause(lead) {
    const isPaused = lead.paused;
    const action   = isPaused ? "resume" : "pause";
    try {
      await fetch(`${BACKEND_URL}/api/sequences/${lead.lead_id}/${action}`, { method: "POST" });
      await loadContacts();
    } catch (err) { alert("Could not update sequence: " + err.message); }
  }

  // ── Delete contact ────────────────────────────────────────────
  async function deleteContact(leadId) {
    if (!window.confirm("Remove this contact from the database?")) return;
    try {
      await fetch(`${BACKEND_URL}/api/contacts/${leadId}`, { method: "DELETE" });
      setContacts((p) => p.filter((c) => c.lead_id !== leadId));
    } catch (err) { alert("Delete failed: " + err.message); }
  }

  // ── Send All ──────────────────────────────────────────────────
  async function sendAll() {
    const pending = filteredContacts.filter(
      (c) => !["sent", "follow-up"].includes(localStatus[c.lead_id] || c.last_status)
    );
    if (!pending.length) { alert("No unsent contacts in current view."); return; }

    const batch   = pending.slice(0, MAX_BATCH_SIZE);
    const skipped = pending.length - batch.length;

    if (!window.confirm(
      `Send initial emails to ${batch.length} contact(s)?` +
      (skipped > 0 ? `\n\n${skipped} over batch cap — will send next run.` : "")
    )) return;

    setBatchRunning(true);
    cancelRef.current = false;
    setBatchProgress({ done: 0, total: batch.length });
    setBatchLog([]);
    addLog(`Batch started — ${batch.length} contacts · ${SEND_DELAY_MS}ms delay`, "info");

    let successCount = 0, errorCount = 0;

    for (let i = 0; i < batch.length; i++) {
      if (cancelRef.current) { addLog("Batch cancelled.", "warning"); break; }

      const lead       = batch[i];
      const leadId     = lead.lead_id;
      const templateId = selectedTemplates[leadId] || "biovis_psa";
      const sequence   = getSequenceForLead(lead);
      const step1Def   = getStepDefinition(sequence, 1);
      const effectiveTpl = step1Def?.templateId || templateId;

      // Build lead object that matches what BiovisOutreachAgent expects
      const leadObj = {
        ...lead,
        personName: lead.person_name,
        name:       lead.person_name,
        sector:     lead.sector,
        company:    lead.company,
      };

      const d = buildEmailDraftFromLead(leadObj, effectiveTpl);
      setStatus(leadId, "sending");
      addLog(`[${i+1}/${batch.length}] → ${lead.person_name} <${lead.email}> · ${effectiveTpl}`, "info");

      try {
        const data = await sendEmail({
          ...d, leadId, lead: leadObj,
          templateId: effectiveTpl, sequenceStep: 1, isFollowUp: false,
        });
        if (data.success) {
          setStatus(leadId, "sent");
          successCount++;
          addLog(`✓ Sent to ${lead.person_name || lead.email}`, "success");
        } else {
          setStatus(leadId, "error");
          errorCount++;
          addLog(`✗ Failed — ${lead.person_name}: ${data.error || "unknown"}`, "error");
        }
      } catch (err) {
        setStatus(leadId, "error");
        errorCount++;
        addLog(`✗ Error — ${lead.email}: ${err.message}`, "error");
      }

      setBatchProgress({ done: i + 1, total: batch.length });
      if (i < batch.length - 1 && !cancelRef.current) await delay(SEND_DELAY_MS);
    }

    addLog(`Complete — ${successCount} sent, ${errorCount} errors.`,
      successCount > 0 ? "success" : "error");
    setBatchRunning(false);
    // Refresh contacts to sync DB status
    await loadContacts();
  }

  // ── Filtering ─────────────────────────────────────────────────
  const sectors        = ["All", ...new Set(contacts.map((c) => c.sector).filter(Boolean))];
  const filteredContacts = contacts.filter((c) => {
    const matchSector = filterSector === "All" || c.sector === filterSector;
    const matchSearch = !searchTerm ||
      c.person_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.company?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSector && matchSearch;
  });

  // ── Counts ────────────────────────────────────────────────────
  const sentCount    = contacts.filter((c) => (localStatus[c.lead_id] || c.last_status) === "sent").length;
  const errorCount   = contacts.filter((c) => (localStatus[c.lead_id] || c.last_status) === "error").length;
  const pendingCount = filteredContacts.filter(
    (c) => !["sent","follow-up"].includes(localStatus[c.lead_id] || c.last_status)
  ).length;
  const batchPct = batchProgress.total > 0
    ? Math.round((batchProgress.done / batchProgress.total) * 100) : 0;

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div style={{ padding: 16, fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", alignItems: "flex-start", gap: 16, minHeight: "100vh", background: "#F0F4FF" }}>

      {/* ── LEFT: Main panel ── */}
      <div style={{ flex: 2, minWidth: 0 }}>

        {/* Header */}
        <div style={{ background: "#1B2C6B", borderRadius: 12, padding: "12px 18px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ background: "#fff", borderRadius: 8, padding: "3px 12px", fontStyle: "italic", fontWeight: 700, fontSize: 20, color: "#1B2C6B", fontFamily: "Georgia, serif" }}>
              Biovis<sup style={{ fontSize: 10 }}>®</sup>
            </span>
            <div>
              <div style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>Expert Vision Labs — Campaign</div>
              <div style={{ color: "#93A8DC", fontSize: 11 }}>
                Contacts saved to Supabase · Batch cap: {MAX_BATCH_SIZE} · Auto-sequences active
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {[
              [`${contacts.length} contacts`, "#2D3F8A", "#93A8DC"],
              [`${sentCount} sent`,           "#14532D", "#86EFAC"],
              [`${errorCount} errors`,         "#7F1D1D", "#FCA5A5"],
            ].map(([l, bg, c]) => (
              <span key={l} style={{ background: bg, color: c, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20 }}>{l}</span>
            ))}
            <button onClick={loadContacts}
              style={{ padding: "5px 12px", borderRadius: 8, background: "#2D3F8A", color: "#93A8DC", border: "1px solid #3D4F8A", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>
              ↻ Refresh
            </button>
            <button onClick={() => navigate("/dashboard")}
              style={{ padding: "5px 14px", borderRadius: 8, background: "transparent", color: "#93A8DC", border: "1px solid #2D3F8A", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>
              Dashboard →
            </button>
          </div>
        </div>

        {/* File upload */}
        <div style={{ background: "#F8FAFF", border: "1px dashed #C7D2FE", borderRadius: 10, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 22 }}>📊</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: "#1B2C6B" }}>
              Upload Excel sheet — contacts saved to Supabase automatically
            </div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>
              Auto-detects: Name · Email · Company · Phone · Sector · New contacts added, existing contacts updated
            </div>
          </div>
          <label style={{ padding: "6px 14px", borderRadius: 8, background: "#1B2C6B", color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
            {importing ? "Importing…" : "Choose file"}
            <input type="file" accept=".xlsx,.xls" style={{ display: "none" }}
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
              disabled={importing} />
          </label>
        </div>

        {/* Import result */}
        {importResult && (
          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#166534", marginBottom: 10, display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span>✓ Import complete</span>
            <span><strong>{importResult.inserted}</strong> new contacts added</span>
            <span><strong>{importResult.updated}</strong> existing contacts updated</span>
            {importResult.skipped > 0 && <span><strong>{importResult.skipped}</strong> rows skipped (no email)</span>}
          </div>
        )}

        {/* Column detection */}
        {headerMap && (
          <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#3730A3", marginBottom: 10 }}>
            <strong>Detected columns →</strong>{" "}
            Name: <em>{headerMap.personNameHeader || "not found"}</em> ·{" "}
            Email: <em>{headerMap.emailHeader || "not found"}</em> ·{" "}
            Company: <em>{headerMap.companyHeader || "not found"}</em> ·{" "}
            Sector: <em>{headerMap.sectorHeader || "guessed from company"}</em> ·{" "}
            Phone: <em>{headerMap.phoneHeader || "not found"}</em>
          </div>
        )}

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#DC2626", marginBottom: 10 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Search + filter bar */}
        {contacts.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              placeholder="Search name, email, company…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ flex: 1, minWidth: 180, fontSize: 12, border: "1px solid #E5E7EB", borderRadius: 8, padding: "6px 10px", background: "#fff" }}
            />
            <select value={filterSector} onChange={(e) => setFilterSector(e.target.value)}
              style={{ fontSize: 12, border: "1px solid #E5E7EB", borderRadius: 8, padding: "6px 10px", background: "#fff" }}>
              {sectors.map((s) => <option key={s}>{s}</option>)}
            </select>
            <span style={{ fontSize: 11, color: "#6B7280" }}>
              Showing {filteredContacts.length} of {contacts.length}
            </span>
          </div>
        )}

        {/* Batch controls */}
        {contacts.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
              <button onClick={sendAll} disabled={batchRunning || pendingCount === 0}
                style={{ padding: "7px 18px", borderRadius: 8, background: batchRunning || pendingCount === 0 ? "#9CA3AF" : "#1B2C6B", color: "#fff", border: "none", fontWeight: 600, fontSize: 12, cursor: batchRunning || pendingCount === 0 ? "not-allowed" : "pointer" }}>
                {batchRunning
                  ? `Sending… (${batchProgress.done}/${batchProgress.total})`
                  : `▶ Send All Pending (${Math.min(pendingCount, MAX_BATCH_SIZE)})`}
              </button>
              {batchRunning && (
                <button onClick={() => { cancelRef.current = true; }}
                  style={{ padding: "7px 14px", borderRadius: 8, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                  ✕ Cancel
                </button>
              )}
              <span style={{ fontSize: 11, color: "#6B7280" }}>
                {sentCount} sent · {errorCount} errors · {pendingCount} pending
                {pendingCount > MAX_BATCH_SIZE && ` · capped at ${MAX_BATCH_SIZE}`}
              </span>
            </div>

            {batchRunning && (
              <div style={{ background: "#E5E7EB", borderRadius: 4, height: 6, marginBottom: 8 }}>
                <div style={{ background: "#1B2C6B", borderRadius: 4, height: 6, width: `${batchPct}%`, transition: "width .3s" }} />
              </div>
            )}

            {batchLog.length > 0 && (
              <div style={{ background: "#0F172A", borderRadius: 10, padding: "10px 14px", maxHeight: 130, overflowY: "auto", marginBottom: 8 }}>
                {batchLog.map((l, i) => (
                  <div key={i} style={{ fontSize: 11, fontFamily: "monospace", padding: "1px 0", color: l.type === "success" ? "#34D399" : l.type === "error" ? "#F87171" : l.type === "warning" ? "#FCD34D" : "#7DD3FC" }}>
                    <span style={{ color: "#475569" }}>[{l.time}]</span> {l.msg}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Contacts table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#9CA3AF", fontSize: 13, background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB" }}>
            Loading contacts from database…
          </div>
        ) : contacts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#1B2C6B", marginBottom: 8 }}>No contacts yet</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Upload your Excel sheet — contacts will be saved to Supabase and persist across refreshes.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto", background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#F8FAFF" }}>
                  {["#", "Person", "Email", "Company", "Sector", "Template", "Seq", "Status", "Actions"].map((h) => (
                    <th key={h} style={{ border: "1px solid #E5E7EB", padding: "7px 10px", textAlign: "left", fontWeight: 600, color: "#374151", fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((lead, idx) => {
                  const leadId     = lead.lead_id;
                  const status     = localStatus[leadId] || lead.last_status || "pending";
                  const templateId = selectedTemplates[leadId] || "biovis_psa";
                  const isSent     = status === "sent" || status === "follow-up";
                  const isError    = status === "error";

                  // Build lead object compatible with template builders
                  const leadObj = {
                    ...lead,
                    personName: lead.person_name,
                    name:       lead.person_name,
                  };

                  return (
                    <tr key={leadId} style={{ background: isSent ? "#F0FDF4" : isError ? "#FEF2F2" : "transparent", borderBottom: "1px solid #F3F4F6" }}>
                      <td style={{ border: "1px solid #E5E7EB", padding: "6px 10px", color: "#9CA3AF" }}>{idx + 1}</td>
                      <td style={{ border: "1px solid #E5E7EB", padding: "6px 10px", fontWeight: 500 }}>{lead.person_name || "—"}</td>
                      <td style={{ border: "1px solid #E5E7EB", padding: "6px 10px", color: "#2563EB", fontSize: 11 }}>{lead.email}</td>
                      <td style={{ border: "1px solid #E5E7EB", padding: "6px 10px" }}>{lead.company || "—"}</td>
                      <td style={{ border: "1px solid #E5E7EB", padding: "6px 10px" }}><SectorBadge sector={lead.sector} /></td>

                      <td style={{ border: "1px solid #E5E7EB", padding: "6px 10px" }}>
                        <select value={templateId}
                          onChange={(e) => setSelectedTemplates((p) => ({ ...p, [leadId]: e.target.value }))}
                          style={{ fontSize: 11, border: "1px solid #E5E7EB", borderRadius: 5, padding: "2px 6px" }}>
                          {EMAIL_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </td>

                      <td style={{ border: "1px solid #E5E7EB", padding: "6px 10px" }}>
                        <SequenceBadge lead={lead} />
                      </td>

                      <td style={{ border: "1px solid #E5E7EB", padding: "6px 10px" }}>
                        <StatusPill status={status} />
                      </td>

                      <td style={{ border: "1px solid #E5E7EB", padding: "6px 10px" }}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {/* Review & Send */}
                          <button
                            onClick={() => {
                              const d = buildEmailDraftFromLead(leadObj, templateId);
                              setDraft({ ...d, leadId, lead: leadObj, templateId, sequenceStep: 1, isFollowUp: false });
                            }}
                            style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, border: "1px solid #C7D2FE", background: "#EEF2FF", color: "#3730A3", cursor: "pointer", fontWeight: 600 }}>
                            Review & Send
                          </button>

                          {/* Follow-up */}
                          {isSent && !lead.completed && (
                            <button
                              onClick={() => {
                                const d = buildFollowUpDraftFromLead(leadObj, templateId);
                                setDraft({ ...d, leadId, lead: leadObj, templateId, sequenceStep: (lead.current_step || 1) + 1, isFollowUp: true });
                              }}
                              style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, border: "1px solid #FDE68A", background: "#FFFBEB", color: "#92400E", cursor: "pointer", fontWeight: 600 }}>
                              Follow-up
                            </button>
                          )}

                          {/* Retry */}
                          {isError && (
                            <button onClick={() => retryLead(leadObj)}
                              style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, border: "1px solid #FECACA", background: "#FEF2F2", color: "#DC2626", cursor: "pointer", fontWeight: 600 }}>
                              Retry
                            </button>
                          )}

                          {/* Pause / Resume */}
                          {lead.current_step > 0 && !lead.completed && (
                            <button onClick={() => togglePause(lead)}
                              style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, border: `1px solid ${lead.paused ? "#BBF7D0" : "#FDE68A"}`, background: lead.paused ? "#F0FDF4" : "#FFFBEB", color: lead.paused ? "#166534" : "#92400E", cursor: "pointer", fontWeight: 600 }}>
                              {lead.paused ? "▶ Resume" : "⏸ Pause"}
                            </button>
                          )}

                          {/* Delete */}
                          <button onClick={() => deleteContact(leadId)}
                            style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#9CA3AF", cursor: "pointer", fontWeight: 600 }}>
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── RIGHT: Draft review pane ── */}
      {draft && (
        <div style={{ flex: 1, minWidth: 280, maxWidth: 380, border: "1px solid #E5E7EB", borderRadius: 12, background: "#F9FAFB", padding: 14, fontSize: 12, position: "sticky", top: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2C6B", marginBottom: 10 }}>
            {draft.isFollowUp ? "🔁 Follow-up" : "✉️ Initial"} — Step {draft.sequenceStep}/4
          </div>
          <div style={{ marginBottom: 4 }}><strong>To:</strong> <span style={{ color: "#2563EB" }}>{draft.to}</span></div>
          <div style={{ marginBottom: 8, fontSize: 11 }}><strong>Subject:</strong> {draft.subject}</div>
          <pre style={{ whiteSpace: "pre-wrap", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: 8, marginBottom: 10, fontSize: 11, lineHeight: 1.65, maxHeight: 380, overflowY: "auto" }}>
            {draft.body}
          </pre>
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={sending} onClick={() => sendSingleEmail(draft)}
              style={{ flex: 1, padding: 8, borderRadius: 8, background: sending ? "#9CA3AF" : "#1B2C6B", color: "#fff", border: "none", fontWeight: 600, fontSize: 12, cursor: sending ? "not-allowed" : "pointer" }}>
              {sending ? "Sending…" : "Send Email"}
            </button>
            <button onClick={() => setDraft(null)}
              style={{ padding: "8px 14px", borderRadius: 8, background: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
