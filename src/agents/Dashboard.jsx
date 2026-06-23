import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

const TEMPLATE_NAMES = {
  biovis_psa:    "PSA 2000", biovis_fps: "FPS",
  biovis_mp:     "MP",       biovis_ip:  "IP",
  cell_analysis: "Cell Analysis", biovis_all: "All Products",
};
const SECTOR_COLORS = {
  Pharmaceutical:"#1D4ED8", Industrial:"#92400E",
  Agriculture:"#166534", "Human Science":"#9D174D", "Life Science":"#5B21B6",
};
const SECTOR_BG = {
  Pharmaceutical:"#EFF6FF", Industrial:"#FFFBEB",
  Agriculture:"#F0FDF4", "Human Science":"#FDF2F8", "Life Science":"#F5F3FF",
};

// ─────────────────────────────────────────────
// UI ATOMS
// ─────────────────────────────────────────────
function MetricCard({ label, value, sub, color="#1B2C6B", icon }) {
  return (
    <div style={{ background:"#fff", border:"1px solid #E5E7EB", borderRadius:12, padding:"16px 18px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
        <div style={{ fontSize:11, color:"#6B7280" }}>{label}</div>
        {icon && <span style={{ fontSize:18 }}>{icon}</span>}
      </div>
      <div style={{ fontSize:30, fontWeight:700, color, lineHeight:1 }}>{value??0}</div>
      {sub && <div style={{ fontSize:11, color:"#9CA3AF", marginTop:4 }}>{sub}</div>}
    </div>
  );
}

function SectorBadge({ sector }) {
  return (
    <span style={{ background:SECTOR_BG[sector]||"#F3F4F6", color:SECTOR_COLORS[sector]||"#374151",
      borderRadius:20, fontSize:10, fontWeight:600, padding:"2px 8px", whiteSpace:"nowrap" }}>
      {sector||"—"}
    </span>
  );
}

function ScoreBar({ score, max }) {
  const pct   = max>0 ? Math.min(Math.round((score/max)*100),100) : 0;
  const color = score>=100 ? "#059669" : score>=50 ? "#D97706" : "#1B2C6B";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ flex:1, background:"#F3F4F6", borderRadius:4, height:6 }}>
        <div style={{ background:color, borderRadius:4, height:6, width:`${pct}%`, transition:"width .4s" }} />
      </div>
      <span style={{ fontSize:11, fontWeight:700, color, minWidth:28, textAlign:"right" }}>{score}</span>
    </div>
  );
}

function FunnelStep({ step, label, count, total, color }) {
  const pct = total>0 ? Math.round((count/total)*100) : 0;
  const w   = Math.max(pct, 8);
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
        <div style={{ width:24, height:24, borderRadius:"50%", background:color, color:"#fff",
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, flexShrink:0 }}>{step}</div>
        <div style={{ flex:1, fontSize:12, color:"#374151" }}>{label}</div>
        <div style={{ fontSize:12, fontWeight:700, color }}>{count}</div>
        <div style={{ fontSize:10, color:"#9CA3AF", minWidth:36, textAlign:"right" }}>{pct}%</div>
      </div>
      <div style={{ background:"#F3F4F6", borderRadius:4, height:8, marginLeft:34 }}>
        <div style={{ background:color, borderRadius:4, height:8, width:`${w}%`, transition:"width .5s" }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TABS
// ─────────────────────────────────────────────
const TABS = [
  { id:"overview",  label:"Overview" },
  { id:"sequences", label:"Sequences" },
  { id:"leads",     label:"Lead Scores" },
  { id:"activity",  label:"Activity" },
];

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const [tab, setTab]           = useState("overview");
  const [days, setDays]         = useState(7);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  // Data state
  const [summary, setSummary]         = useState(null);
  const [templates, setTemplates]     = useState([]);
  const [sectors, setSectors]         = useState([]);
  const [sequence, setSequence]       = useState(null);
  const [recent, setRecent]           = useState([]);
  const [daily, setDaily]             = useState([]);
  const [scores, setScores]           = useState([]);
  const [seqDetail, setSeqDetail]     = useState([]);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [s,t,sec,seq,r,d,sc,sd] = await Promise.all([
        fetch(`${BACKEND_URL}/api/stats/summary?days=${days}`).then(r=>r.json()),
        fetch(`${BACKEND_URL}/api/stats/templates`).then(r=>r.json()),
        fetch(`${BACKEND_URL}/api/stats/sectors`).then(r=>r.json()),
        fetch(`${BACKEND_URL}/api/stats/sequence`).then(r=>r.json()),
        fetch(`${BACKEND_URL}/api/stats/recent?limit=30`).then(r=>r.json()),
        fetch(`${BACKEND_URL}/api/stats/daily?days=${days}`).then(r=>r.json()),
        fetch(`${BACKEND_URL}/api/stats/scores?limit=20`).then(r=>r.json()),
        fetch(`${BACKEND_URL}/api/stats/sequence-detail`).then(r=>r.json()),
      ]);
      setSummary(s); setTemplates(Array.isArray(t)?t:[]);
      setSectors(Array.isArray(sec)?sec:[]); setSequence(seq);
      setRecent(Array.isArray(r)?r:[]); setDaily(Array.isArray(d)?d:[]);
      setScores(Array.isArray(sc)?sc:[]); setSeqDetail(Array.isArray(sd)?sd:[]);
    } catch(err) {
      setError("Could not load dashboard. Is the backend running? " + err.message);
    } finally { setLoading(false); }
  }, [days]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function markReplied(leadId) {
    await fetch(`${BACKEND_URL}/api/sequences/${leadId}/replied`, { method:"POST" });
    fetchAll();
  }
  async function togglePause(leadId, isPaused) {
    await fetch(`${BACKEND_URL}/api/sequences/${leadId}/${isPaused?"resume":"pause"}`, { method:"POST" });
    fetchAll();
  }

  const maxScore     = Math.max(...scores.map(s=>s.score), 1);
  const maxTplSent   = Math.max(...templates.map(t=>Number(t.sent)), 1);
  const funnelColors = ["#1B2C6B","#2563EB","#059669","#D97706"];
  const stepLabels   = ["Initial email","Follow-up 1","Follow-up 2","Final follow-up"];

  const tabBtn = (id) => ({
    padding:"7px 16px", borderRadius:8, fontWeight:600, fontSize:12,
    cursor:"pointer", border:"none",
    background: tab===id ? "#1B2C6B" : "transparent",
    color: tab===id ? "#fff" : "#6B7280",
    transition:"all .15s",
  });

  return (
    <div style={{ padding:16, fontFamily:"'DM Sans',system-ui,sans-serif", background:"#F0F4FF", minHeight:"100vh" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* ── Header ── */}
      <div style={{ background:"#1B2C6B", borderRadius:12, padding:"12px 18px", marginBottom:16,
        display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ background:"#fff", borderRadius:8, padding:"3px 12px", fontStyle:"italic",
            fontWeight:700, fontSize:20, color:"#1B2C6B", fontFamily:"Georgia,serif" }}>
            Biovis<sup style={{ fontSize:10 }}>®</sup>
          </span>
          <div>
            <div style={{ color:"#fff", fontWeight:600, fontSize:13 }}>Campaign Dashboard</div>
            <div style={{ color:"#93A8DC", fontSize:11 }}>Expert Vision Labs Pvt. Ltd.</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <select value={days} onChange={e=>setDays(Number(e.target.value))}
            style={{ fontSize:11, border:"1px solid #2D3F8A", borderRadius:7, padding:"4px 8px",
              background:"#2D3F8A", color:"#93A8DC" }}>
            {[7,14,30,90].map(d=><option key={d} value={d}>Last {d} days</option>)}
          </select>
          <button onClick={fetchAll}
            style={{ padding:"5px 12px", borderRadius:8, background:"#2D3F8A", color:"#93A8DC",
              border:"1px solid #3D4F8A", fontWeight:600, fontSize:11, cursor:"pointer" }}>
            ↻ Refresh
          </button>
          <button onClick={()=>navigate("/")}
            style={{ padding:"5px 14px", borderRadius:8, background:"transparent", color:"#93A8DC",
              border:"1px solid #2D3F8A", fontWeight:600, fontSize:11, cursor:"pointer" }}>
            ← Campaign
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:10,
          padding:"10px 16px", marginBottom:14, fontSize:12, color:"#DC2626" }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Tab bar ── */}
      <div style={{ display:"flex", gap:4, background:"#E8EDF8", borderRadius:10, padding:4,
        marginBottom:16, width:"fit-content" }}>
        {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={tabBtn(t.id)}>{t.label}</button>)}
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:"4rem", color:"#9CA3AF", fontSize:13 }}>
          Loading dashboard…
        </div>
      ) : (
        <>
          {/* ════════════════════════════════
              OVERVIEW TAB
          ════════════════════════════════ */}
          {tab==="overview" && (
            <div>
              {/* Metric cards */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:16 }}>
                <MetricCard icon="✉️" label={`Emails sent (${days}d)`}  value={summary?.sent_last_n_days}  sub="successful" color="#059669" />
                <MetricCard icon="📅" label="Sent today"                value={summary?.sent_today}         sub="last 24 hrs" color="#1B2C6B" />
                <MetricCard icon="📊" label="All-time sends"            value={summary?.sent_all_time}      sub="since launch" color="#1B2C6B" />
                <MetricCard icon="👥" label="Total contacts"            value={summary?.total_contacts}     sub="in database" color="#5B21B6" />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:16 }}>
                <MetricCard icon="🔁" label="Active sequences"    value={summary?.active_sequences}    sub="running now" color="#2563EB" />
                <MetricCard icon="✅" label="Completed sequences" value={summary?.completed_sequences} sub="full 4/4" color="#059669" />
                <MetricCard icon="💬" label="Replies received"    value={summary?.replied_leads}       sub="marked replied" color="#D97706" />
                <MetricCard icon="❌" label={`Errors (${days}d)`} value={summary?.errors_last_n_days}  sub="failed sends" color="#DC2626" />
              </div>

              {/* Daily sends chart */}
              <div style={{ background:"#fff", border:"1px solid #E5E7EB", borderRadius:12,
                padding:"16px", marginBottom:14 }}>
                <div style={{ fontWeight:600, fontSize:13, color:"#1B2C6B", marginBottom:12 }}>
                  Daily send volume — last {days} days
                </div>
                {daily.length===0 ? (
                  <div style={{ fontSize:12, color:"#9CA3AF", padding:"2rem 0", textAlign:"center" }}>No data yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={daily.map(d=>({ date:d.date, Sent:Number(d.sent), Errors:Number(d.errors) }))}>
                      <defs>
                        <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1B2C6B" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#1B2C6B" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="date" tick={{ fontSize:10, fill:"#9CA3AF" }}
                        tickFormatter={d=>d?.slice(5)||""} />
                      <YAxis tick={{ fontSize:10, fill:"#9CA3AF" }} />
                      <Tooltip contentStyle={{ fontSize:11, borderRadius:8 }} />
                      <Legend wrapperStyle={{ fontSize:11 }} />
                      <Area type="monotone" dataKey="Sent" stroke="#1B2C6B" fill="url(#sentGrad)" strokeWidth={2} />
                      <Area type="monotone" dataKey="Errors" stroke="#DC2626" fill="#FEF2F2" strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Template + Sector charts */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
                <div style={{ background:"#fff", border:"1px solid #E5E7EB", borderRadius:12, padding:"16px" }}>
                  <div style={{ fontWeight:600, fontSize:13, color:"#1B2C6B", marginBottom:12 }}>Emails by template</div>
                  {templates.length===0 ? <div style={{ fontSize:12, color:"#9CA3AF" }}>No data yet.</div> : (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={templates.map(t=>({ name:TEMPLATE_NAMES[t.template_id]||t.template_id, Sent:Number(t.sent), Errors:Number(t.errors) }))}
                        layout="vertical" margin={{ left:10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                        <XAxis type="number" tick={{ fontSize:10 }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize:10 }} width={80} />
                        <Tooltip contentStyle={{ fontSize:11, borderRadius:8 }} />
                        <Bar dataKey="Sent" fill="#1B2C6B" radius={[0,4,4,0]} />
                        <Bar dataKey="Errors" fill="#FCA5A5" radius={[0,4,4,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div style={{ background:"#fff", border:"1px solid #E5E7EB", borderRadius:12, padding:"16px" }}>
                  <div style={{ fontWeight:600, fontSize:13, color:"#1B2C6B", marginBottom:12 }}>Emails by sector</div>
                  {sectors.length===0 ? <div style={{ fontSize:12, color:"#9CA3AF" }}>No data yet.</div> : (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={sectors.map(s=>({ name:s.sector||"Unknown", Sent:Number(s.sent) }))}
                        layout="vertical" margin={{ left:10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                        <XAxis type="number" tick={{ fontSize:10 }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize:10 }} width={100} />
                        <Tooltip contentStyle={{ fontSize:11, borderRadius:8 }} />
                        <Bar dataKey="Sent" fill="#5B21B6" radius={[0,4,4,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════
              SEQUENCES TAB
          ════════════════════════════════ */}
          {tab==="sequences" && (
            <div>
              {/* Funnel */}
              <div style={{ background:"#fff", border:"1px solid #E5E7EB", borderRadius:12,
                padding:"16px", marginBottom:14 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                  <div style={{ fontWeight:600, fontSize:13, color:"#1B2C6B" }}>Sequence funnel</div>
                  {sequence && (
                    <div style={{ display:"flex", gap:10, marginLeft:"auto", fontSize:11 }}>
                      <span style={{ color:"#059669", fontWeight:600 }}>✓ {sequence.completed} completed</span>
                      <span style={{ color:"#D97706", fontWeight:600 }}>⏸ {sequence.paused} paused</span>
                      <span style={{ color:"#6B7280" }}>{sequence.total} total leads</span>
                    </div>
                  )}
                </div>
                {!sequence||sequence.total===0 ? (
                  <div style={{ fontSize:12, color:"#9CA3AF", textAlign:"center", padding:"2rem" }}>
                    No sequences started yet. Send initial emails to begin.
                  </div>
                ) : (
                  <div style={{ maxWidth:600 }}>
                    {[1,2,3,4].map((step,i)=>{
                      const found = sequence.funnel?.find(f=>f.current_step===step);
                      return (
                        <FunnelStep key={step} step={step}
                          label={stepLabels[i]} count={found?.count||0}
                          total={sequence.total} color={funnelColors[i]} />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sequence detail table */}
              <div style={{ background:"#fff", border:"1px solid #E5E7EB", borderRadius:12, padding:"16px" }}>
                <div style={{ fontWeight:600, fontSize:13, color:"#1B2C6B", marginBottom:12 }}>
                  All leads in sequences ({seqDetail.length})
                </div>
                {seqDetail.length===0 ? (
                  <div style={{ fontSize:12, color:"#9CA3AF" }}>No sequence data yet.</div>
                ) : (
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                      <thead>
                        <tr style={{ background:"#F8FAFF" }}>
                          {["Name","Email","Company","Sector","Step","Emails","Score","Last sent","Status","Actions"].map(h=>(
                            <th key={h} style={{ padding:"7px 10px", textAlign:"left", fontWeight:600,
                              color:"#6B7280", borderBottom:"1px solid #E5E7EB", fontSize:11 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {seqDetail.map(lead=>(
                          <tr key={lead.lead_id} style={{ borderBottom:"1px solid #F3F4F6",
                            background:lead.completed?"#F0FDF4":lead.paused?"#FFFBEB":"transparent" }}>
                            <td style={{ padding:"6px 10px", fontWeight:500 }}>{lead.person_name||"—"}</td>
                            <td style={{ padding:"6px 10px", color:"#2563EB", fontSize:11 }}>{lead.to_email}</td>
                            <td style={{ padding:"6px 10px" }}>{lead.company||"—"}</td>
                            <td style={{ padding:"6px 10px" }}><SectorBadge sector={lead.sector} /></td>
                            <td style={{ padding:"6px 10px", fontWeight:700, color:"#1B2C6B", textAlign:"center" }}>
                              {lead.completed ? "✓" : `${lead.current_step}/4`}
                            </td>
                            <td style={{ padding:"6px 10px", textAlign:"center" }}>{lead.emails_sent}</td>
                            <td style={{ padding:"6px 10px", fontWeight:700,
                              color:lead.score>=100?"#059669":lead.score>=50?"#D97706":"#1B2C6B" }}>
                              {lead.score}
                            </td>
                            <td style={{ padding:"6px 10px", color:"#9CA3AF", fontSize:11 }}>
                              {lead.last_sent_at
                                ? new Date(lead.last_sent_at).toLocaleDateString("en-IN")
                                : "—"}
                            </td>
                            <td style={{ padding:"6px 10px" }}>
                              <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20,
                                background:lead.completed?"#ECFDF5":lead.paused?"#FFFBEB":"#EFF6FF",
                                color:lead.completed?"#059669":lead.paused?"#D97706":"#2563EB" }}>
                                {lead.completed?"Done":lead.paused?"Paused":"Active"}
                              </span>
                            </td>
                            <td style={{ padding:"6px 10px" }}>
                              <div style={{ display:"flex", gap:4 }}>
                                {!lead.completed && (
                                  <button onClick={()=>togglePause(lead.lead_id,lead.paused)}
                                    style={{ fontSize:10, padding:"2px 8px", borderRadius:5,
                                      border:`1px solid ${lead.paused?"#BBF7D0":"#FDE68A"}`,
                                      background:lead.paused?"#F0FDF4":"#FFFBEB",
                                      color:lead.paused?"#166534":"#92400E", cursor:"pointer", fontWeight:600 }}>
                                    {lead.paused?"▶ Resume":"⏸ Pause"}
                                  </button>
                                )}
                                <button onClick={()=>markReplied(lead.lead_id)}
                                  style={{ fontSize:10, padding:"2px 8px", borderRadius:5,
                                    border:"1px solid #BBF7D0", background:"#F0FDF4",
                                    color:"#166534", cursor:"pointer", fontWeight:600 }}>
                                  💬 Replied
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════
              LEAD SCORES TAB
          ════════════════════════════════ */}
          {tab==="leads" && (
            <div>
              <div style={{ background:"#fff", border:"1px solid #E5E7EB", borderRadius:12, padding:"16px" }}>
                <div style={{ fontWeight:600, fontSize:13, color:"#1B2C6B", marginBottom:6 }}>
                  Lead scoring — top {scores.length} leads
                </div>
                <div style={{ fontSize:11, color:"#9CA3AF", marginBottom:14 }}>
                  Score = +10 per email sent · +50 when reply marked · Updated automatically
                </div>
                {scores.length===0 ? (
                  <div style={{ fontSize:12, color:"#9CA3AF", textAlign:"center", padding:"3rem" }}>
                    No scores yet — send some emails first.
                  </div>
                ) : (
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                      <thead>
                        <tr style={{ background:"#F8FAFF" }}>
                          {["Rank","Name","Email","Company","Sector","Emails sent","Score","Replied"].map(h=>(
                            <th key={h} style={{ padding:"7px 10px", textAlign:"left", fontWeight:600,
                              color:"#6B7280", borderBottom:"1px solid #E5E7EB", fontSize:11 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {scores.map((lead,i)=>(
                          <tr key={lead.lead_id} style={{ borderBottom:"1px solid #F3F4F6",
                            background:i===0?"#FFFBEB":i===1?"#F8FAFF":i===2?"#F0FDF4":"transparent" }}>
                            <td style={{ padding:"6px 10px", fontWeight:700, color:"#1B2C6B" }}>
                              {i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}
                            </td>
                            <td style={{ padding:"6px 10px", fontWeight:500 }}>{lead.person_name||"—"}</td>
                            <td style={{ padding:"6px 10px", color:"#2563EB", fontSize:11 }}>{lead.email}</td>
                            <td style={{ padding:"6px 10px" }}>{lead.company||"—"}</td>
                            <td style={{ padding:"6px 10px" }}><SectorBadge sector={lead.sector} /></td>
                            <td style={{ padding:"6px 10px", textAlign:"center" }}>{lead.emails_sent}</td>
                            <td style={{ padding:"6px 10px", minWidth:120 }}>
                              <ScoreBar score={lead.score} max={maxScore} />
                            </td>
                            <td style={{ padding:"6px 10px", textAlign:"center" }}>
                              {lead.replied
                                ? <span style={{ color:"#059669", fontWeight:700 }}>✓ Yes</span>
                                : <span style={{ color:"#9CA3AF" }}>—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════
              ACTIVITY TAB
          ════════════════════════════════ */}
          {tab==="activity" && (
            <div style={{ background:"#fff", border:"1px solid #E5E7EB", borderRadius:12, padding:"16px" }}>
              <div style={{ fontWeight:600, fontSize:13, color:"#1B2C6B", marginBottom:12 }}>
                Recent email activity — last {recent.length} sends
              </div>
              {recent.length===0 ? (
                <div style={{ fontSize:12, color:"#9CA3AF", textAlign:"center", padding:"3rem" }}>
                  No activity yet.
                </div>
              ) : (
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                    <thead>
                      <tr style={{ background:"#F8FAFF" }}>
                        {["Time","Name","Email","Company","Sector","Template","Step","Status"].map(h=>(
                          <th key={h} style={{ padding:"7px 10px", textAlign:"left", fontWeight:600,
                            color:"#6B7280", borderBottom:"1px solid #E5E7EB" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map(r=>(
                        <tr key={r.id} style={{ borderBottom:"1px solid #F3F4F6" }}>
                          <td style={{ padding:"6px 10px", color:"#9CA3AF", whiteSpace:"nowrap" }}>
                            {new Date(r.sent_at).toLocaleString("en-IN",{
                              month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",hour12:false
                            })}
                          </td>
                          <td style={{ padding:"6px 10px", fontWeight:500 }}>{r.person_name||"—"}</td>
                          <td style={{ padding:"6px 10px", color:"#2563EB" }}>{r.to_email}</td>
                          <td style={{ padding:"6px 10px" }}>{r.company||"—"}</td>
                          <td style={{ padding:"6px 10px" }}><SectorBadge sector={r.sector} /></td>
                          <td style={{ padding:"6px 10px" }}>{TEMPLATE_NAMES[r.template_id]||r.template_id}</td>
                          <td style={{ padding:"6px 10px", textAlign:"center", fontWeight:700, color:"#1B2C6B" }}>
                            {r.sequence_step}
                          </td>
                          <td style={{ padding:"6px 10px" }}>
                            <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20,
                              background:r.status==="sent"?"#ECFDF5":"#FEF2F2",
                              color:r.status==="sent"?"#059669":"#DC2626" }}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
