/* ============================================================
   CLIENT UI/UX REFERENCE PROTOTYPE — saved verbatim, 2026-08-19
   ============================================================

   This is the reference prototype named in CLAUDE.md under "Scope decisions
   (binding until changed)":

     "A reference UX prototype exists (a heavily-themed single-file React
     demo covering all 5 domains) but should not be used as an
     implementation reference. It predates the ADRs, uses a hardcoded rank
     formula (not ADR-002's), has no grace/pause logic, uses per-domain
     progress functions that ADR-001 specifically avoids, and invests in
     visual novelty this project explicitly sequenced for later. Useful
     only for: the global date-filter interaction pattern, and the
     ingredient-based meal macro calculator UX."

   Saved here as-is (no edits) for reference, per the project owner's
   2026-08-19 request to treat its UI styles/components/navigation/UX flows
   as the target look-and-feel the client expects. This is a SCOPE CHANGE
   from the paragraph above, not a continuation of it — see the project
   owner's conversation on 2026-08-19 and CLAUDE.md's own note that these
   scope decisions are "binding until changed... or an explicit change from
   the project owner." Not yet reflected back into CLAUDE.md's prose above;
   do that in the same change that acts on this reference, so the doc and
   the decision don't drift apart.

   NOT wired into the app. Do not import this file. It predates every ADR
   in docs/adr/ and its data model, rank/streak math, and per-domain
   progress functions directly conflict with ADR-001/ADR-002 (see CLAUDE.md
   excerpt above and the review notes recorded separately). Architecture
   choices below (in-memory useReducer state, single-file component tree,
   Create React App-style JSX, no Next.js/Supabase) are not meant to carry
   over — only the visual/UX layer is in scope for reuse, per the project
   owner's request.
   ============================================================ */

import React, { useState, useReducer, createContext, useContext, useEffect, useMemo } from "react";
import {
  Home, Sparkles, Wallet, Dumbbell, GraduationCap, Swords, Flame, Trophy, Calendar,
  ChevronRight, ChevronLeft, Target, TrendingUp, Zap, Shield, Clock, Check, Activity,
  Apple, X, Plus, LogOut, Trash2, User, Camera, Scale, BarChart3, Utensils, CalendarRange, Eye
} from "lucide-react";

/* ============================================================
   SOLO LEVELING — INDIVIDUAL DEVELOPMENT SYSTEM  (build 4)
   Global date filter drives EVERY module. In-memory (resets on reload).
   Demo login: player@system.io / arise
   ============================================================ */

const TODAY = new Date(2026, 7, 9); // Aug 9, 2026
const dkey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fromKey = k => { const [y, m, dd] = k.split("-").map(Number); return new Date(y, m - 1, dd); };
const fmtDate = d => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const fmtShort = d => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const startOfWeek = d => { const x = fromKey(dkey(d)); const off = (x.getDay() + 6) % 7; return addDays(x, -off); };
const weekDays = d => { const m = startOfWeek(d); return Array.from({ length: 7 }, (_, i) => addDays(m, i)); };
const uid = () => Math.random().toString(36).slice(2, 9);
const inr = n => "₹" + Math.round(n).toLocaleString("en-IN");
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const TKEY = dkey(TODAY);

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=Rajdhani:wght@400;500;600;700&display=swap');
:root{--bg:#05070e;--sys:#38cfff;--sys-b:#8fe9ff;--sys-dim:rgba(56,207,255,.18);--monarch:#8b5cff;--monarch-b:#c3a8ff;--gold:#ffcf5c;--danger:#ff5a6e;--green:#48e6a0;--text:#dce8ff;--muted:#6f80a8;--line:rgba(84,150,235,.22);}
*{box-sizing:border-box;}
.sl-root{font-family:'Rajdhani',system-ui,sans-serif;color:var(--text);letter-spacing:.2px;background:radial-gradient(900px 500px at 78% -8%,rgba(139,92,255,.16),transparent 60%),radial-gradient(1100px 700px at 12% 110%,rgba(56,207,255,.12),transparent 55%),var(--bg);min-height:100vh;position:relative;overflow-x:hidden;}
.sl-root::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;background-image:linear-gradient(rgba(56,207,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(56,207,255,.035) 1px,transparent 1px);background-size:44px 44px;mask-image:radial-gradient(circle at 50% 30%,#000 0%,transparent 85%);}
.mono{font-family:'Chakra Petch',monospace;}.up{text-transform:uppercase;letter-spacing:2.5px;}
.panel{position:relative;background:linear-gradient(160deg,rgba(14,24,48,.82),rgba(8,13,28,.72));border:1px solid var(--line);border-radius:2px;box-shadow:0 0 0 1px rgba(56,207,255,.04) inset,0 18px 50px -30px rgba(0,0,0,.9);backdrop-filter:blur(6px);}
.panel>.c{position:absolute;width:14px;height:14px;border:2px solid var(--sys);opacity:.85;}
.panel>.c.tl{top:-1px;left:-1px;border-right:0;border-bottom:0;}.panel>.c.tr{top:-1px;right:-1px;border-left:0;border-bottom:0;}
.panel>.c.bl{bottom:-1px;left:-1px;border-right:0;border-top:0;}.panel>.c.br{bottom:-1px;right:-1px;border-left:0;border-top:0;}
.panel.mon{border-color:rgba(139,92,255,.32);}.panel.mon>.c{border-color:var(--monarch);}
.phead{display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid var(--line);color:var(--sys-b);font-family:'Chakra Petch',monospace;font-size:12px;text-transform:uppercase;letter-spacing:2px;}
.phead .dot{width:6px;height:6px;background:var(--sys);border-radius:50%;box-shadow:0 0 8px var(--sys);flex:0 0 auto;}
.bar{height:8px;background:rgba(56,207,255,.1);border-radius:2px;overflow:hidden;position:relative;}
.bar>i{display:block;height:100%;border-radius:2px;background:linear-gradient(90deg,var(--sys),var(--monarch));box-shadow:0 0 12px rgba(56,207,255,.5);transition:width .7s cubic-bezier(.2,.7,.2,1);}
.bar.g>i{background:linear-gradient(90deg,var(--green),var(--sys));}
.bar.gold>i{background:linear-gradient(90deg,var(--gold),#ff9d3c);}
.nav-item{display:flex;align-items:center;gap:12px;padding:11px 14px;cursor:pointer;border-left:2px solid transparent;color:var(--muted);position:relative;font-family:'Chakra Petch',monospace;font-size:13px;letter-spacing:1px;transition:.2s;text-transform:uppercase;}
.nav-item:hover{color:var(--sys-b);background:linear-gradient(90deg,var(--sys-dim),transparent);}
.nav-item.on{color:#eaf4ff;border-left-color:var(--sys);background:linear-gradient(90deg,rgba(56,207,255,.16),transparent);}
.qrow{display:flex;align-items:center;gap:12px;padding:11px 14px;border-bottom:1px solid rgba(84,150,235,.12);cursor:pointer;transition:.15s;}
.qrow:hover{background:rgba(56,207,255,.06);}
.qbox{width:20px;height:20px;flex:0 0 auto;border:1.5px solid var(--sys);border-radius:2px;display:flex;align-items:center;justify-content:center;color:var(--bg);transition:.2s;}
.qbox.done{background:var(--sys);box-shadow:0 0 12px var(--sys-dim);}
.qrow.done .qt{color:var(--muted);text-decoration:line-through;text-decoration-color:rgba(111,128,168,.6);}
.chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border:1px solid var(--line);border-radius:2px;font-family:'Chakra Petch',monospace;font-size:11px;letter-spacing:1px;color:var(--sys-b);background:rgba(56,207,255,.06);text-transform:uppercase;}
.glow-cyan{text-shadow:0 0 18px rgba(56,207,255,.6);}.glow-mon{text-shadow:0 0 20px rgba(139,92,255,.65);}.glow-gold{text-shadow:0 0 22px rgba(255,207,92,.6);}
.daybox{width:30px;height:34px;flex:0 0 auto;border:1px solid var(--line);border-radius:2px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Chakra Petch',monospace;font-size:10px;color:var(--muted);cursor:pointer;transition:.15s;line-height:1.1;}
.daybox:hover{border-color:var(--sys-b);}
.daybox.on{border-color:var(--sys);color:var(--sys);background:rgba(56,207,255,.12);box-shadow:0 0 10px var(--sys-dim);}
.daybox.sel{outline:1px solid var(--monarch);outline-offset:1px;}
.daybox .dn{font-size:8px;opacity:.7;}
.tab{padding:7px 14px;font-family:'Chakra Petch',monospace;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;transition:.2s;white-space:nowrap;}
.tab:hover{color:var(--sys-b);}.tab.on{color:#eaf4ff;border-bottom-color:var(--sys);}
.inp{width:100%;background:rgba(6,12,24,.72);border:1px solid var(--line);border-radius:2px;color:var(--text);font-family:'Rajdhani';font-size:15px;padding:10px 12px;outline:none;transition:.15s;}
.inp:focus{border-color:var(--sys);box-shadow:0 0 0 1px var(--sys-dim);}
select.inp{appearance:none;cursor:pointer;}
.lbl{font-family:'Chakra Petch';text-transform:uppercase;font-size:10px;letter-spacing:1.5px;color:var(--muted);margin-bottom:5px;display:block;}
.sysbtn{font-family:'Chakra Petch',monospace;text-transform:uppercase;letter-spacing:2px;font-size:13px;padding:11px 18px;border:1px solid var(--sys);color:#eaf4ff;background:rgba(56,207,255,.1);cursor:pointer;border-radius:2px;transition:.2s;white-space:nowrap;}
.sysbtn:hover{background:rgba(56,207,255,.22);box-shadow:0 0 24px rgba(56,207,255,.35);}
.sysbtn:disabled{opacity:.4;cursor:not-allowed;box-shadow:none;}
.sysbtn.mon{border-color:var(--monarch);background:rgba(139,92,255,.12);}
.sysbtn.mon:hover{background:rgba(139,92,255,.24);}
.sysbtn.ghost{border-color:var(--line);color:var(--muted);background:transparent;}
.sysbtn.ghost:hover{color:var(--sys-b);border-color:var(--sys);box-shadow:none;background:rgba(56,207,255,.06);}
.iconbtn{display:inline-flex;align-items:center;gap:6px;font-family:'Chakra Petch';text-transform:uppercase;font-size:11px;letter-spacing:1.5px;color:var(--sys-b);border:1px solid var(--line);background:rgba(56,207,255,.07);padding:6px 11px;border-radius:2px;cursor:pointer;transition:.15s;white-space:nowrap;}
.iconbtn:hover{border-color:var(--sys);}.iconbtn:disabled{opacity:.4;cursor:not-allowed;}
.overlay{position:fixed;inset:0;z-index:60;background:rgba(3,5,12,.74);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;}
.toasts{position:fixed;top:16px;right:16px;z-index:95;display:flex;flex-direction:column;gap:8px;max-width:340px;}
.rm{opacity:.55;transition:.15s;cursor:pointer;flex:0 0 auto;}.rm:hover{opacity:1;}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:none;}}
@keyframes scan{0%{transform:translateX(-120%);}100%{transform:translateX(320%);}}
@keyframes pulse{0%,100%{opacity:.55;}50%{opacity:1;}}
@keyframes slideIn{from{opacity:0;transform:translateX(30px);}to{opacity:1;transform:none;}}
.fadeUp{animation:fadeUp .5s ease both;}.slideIn{animation:slideIn .3s ease both;}
.scanline{position:absolute;top:0;left:0;height:100%;width:80px;background:linear-gradient(90deg,transparent,rgba(56,207,255,.14),transparent);animation:scan 4.5s linear infinite;pointer-events:none;}
::-webkit-scrollbar{width:9px;height:9px;}::-webkit-scrollbar-thumb{background:rgba(56,207,255,.25);border-radius:2px;}::-webkit-scrollbar-track{background:transparent;}
.grid{display:grid;gap:16px;}
.g-hero{grid-template-columns:minmax(280px,1fr) minmax(300px,1.15fr);}
.g-2{grid-template-columns:1fr 1fr;}.g-15{grid-template-columns:1.5fr 1fr;}.g-12{grid-template-columns:1.2fr 1fr;}.g-11{grid-template-columns:1.1fr 1fr;}
.auto{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));}
.auto-sm{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));}
.sidebar{width:210px;min-height:100vh;border-right:1px solid var(--line);background:rgba(6,10,20,.6);backdrop-filter:blur(6px);position:sticky;top:0;align-self:flex-start;flex:0 0 auto;}
.main-pad{padding:20px;}
.loangrid{display:grid;grid-template-columns:repeat(12,1fr);gap:5px;}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;border-bottom:1px solid var(--line);background:rgba(6,10,20,.5);}
.filterbar{padding:9px 20px;border-bottom:1px solid var(--line);background:rgba(6,10,20,.4);display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.datebar-wrap{display:flex;align-items:center;gap:8px;width:100%;max-width:440px;}
.iconbtn.arrow{padding:7px 9px;flex:0 0 auto;}
.datebtn{display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;border:1px solid var(--line);border-radius:2px;background:rgba(56,207,255,.05);color:#eaf4ff;font-size:13px;cursor:pointer;transition:.15s;font-family:'Rajdhani';}
.datebtn:hover{border-color:var(--sys);background:rgba(56,207,255,.1);}
.datepop{position:absolute;top:calc(100% + 8px);left:0;width:300px;max-width:88vw;z-index:25;}
.quickgrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;}
.tabrow{display:flex;gap:2px;overflow-x:auto;padding:0 8px;}
.tabrow .tab{flex:0 0 auto;}
.hdr-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;}
.bottomnav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:40;background:rgba(6,10,20,.94);backdrop-filter:blur(10px);border-top:1px solid var(--line);justify-content:space-around;padding:6px 2px;}
.bnav{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 2px;color:var(--muted);cursor:pointer;flex:1;font-family:'Chakra Petch';font-size:9px;letter-spacing:.5px;text-transform:uppercase;transition:.15s;}
.bnav.on{color:var(--sys);}.bnav.on svg{filter:drop-shadow(0 0 6px var(--sys));}
.sechead{display:flex;align-items:center;gap:14px;flex-wrap:wrap;}
.sechead-title{font-size:24px;}
.modalwrap{width:100%;max-width:470px;max-height:92vh;overflow:auto;}
@media (max-width:900px){.g-hero,.g-15,.g-12,.g-11{grid-template-columns:1fr;}}
@media (max-width:640px){
  .g-2{grid-template-columns:1fr;}
  .sidebar{display:none;}.bottomnav{display:flex;}
  .main-pad{padding:13px 13px calc(84px + env(safe-area-inset-bottom,0px));}
  .topbar{padding:10px 13px;}
  .filterbar{padding:8px 13px;gap:8px;}
  .datebar-wrap{max-width:none;}
  .loangrid{grid-template-columns:repeat(6,1fr);}
  .sechead-title{font-size:20px;}
  .sechead{gap:10px;}
  .sechead>.sysbtn{width:100%;}
  .hdr-actions{width:100%;justify-content:stretch;}
  .hdr-actions .sysbtn{flex:1;min-width:0;padding:11px 6px;}
  .bottomnav{padding-bottom:calc(6px + env(safe-area-inset-bottom,0px));}
  .overlay{align-items:flex-end;padding:0;}
  .modalwrap{max-width:none;max-height:88vh;}
  .hide-sm{display:none !important;}
  .datepop{width:auto;left:0;right:0;max-width:none;}
}
@media (max-width:400px){.quickgrid{grid-template-columns:1fr 1fr;}}
@media (prefers-reduced-motion:reduce){*{animation-duration:.001ms !important;}}
`;

const Ctx = createContext(null);
const useApp = () => useContext(Ctx);

const Panel = ({ children, className = "", mon = false, style }) => (
  <div className={`panel ${mon ? "mon" : ""} ${className}`} style={style}>
    <span className="c tl" /><span className="c tr" /><span className="c bl" /><span className="c br" />{children}
  </div>
);
const PHead = ({ children, icon: Ic, right }) => (
  <div className="phead" style={{ justifyContent: right ? "space-between" : "flex-start" }}>
    <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>{Ic && <Ic size={14} style={{ flex: "0 0 auto" }} />}<span className="dot" /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{children}</span></span>
    {right}
  </div>
);
const Bar = ({ pct, variant = "" }) => <div className={`bar ${variant}`}><i style={{ width: `${clamp(pct || 0, 0, 100)}%` }} /></div>;
const Chip = ({ children, style }) => <span className="chip" style={style}>{children}</span>;
const StatCell = ({ label, value, icon: Ic, color }) => (
  <div><div className="up" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1 }}>{label}</div>
    <div className="mono" style={{ fontSize: 16, color: "#eaf4ff", display: "flex", alignItems: "center", gap: 4 }}>{Ic && <Ic size={13} color={color || "#ff8a5c"} />}{value}</div></div>
);
const BigStat = ({ label, value, sub, danger, green }) => (
  <Panel><div style={{ padding: 16 }}>
    <div className="up" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1.5 }}>{label}</div>
    <div className="mono" style={{ fontSize: 24, color: danger ? "var(--danger)" : green ? "var(--green)" : "#eaf4ff", margin: "4px 0" }}>{value}</div>
    <div style={{ fontSize: 13, color: "var(--muted)" }}>{sub}</div>
  </div></Panel>
);
const MiniStat = ({ icon: Ic, label, value, color }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
    <div style={{ width: 30, height: 30, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)", borderRadius: 2, background: "rgba(56,207,255,.05)" }}><Ic size={15} color={color} /></div>
    <div style={{ minWidth: 0 }}><div className="mono" style={{ fontSize: 15, color: "#eaf4ff", lineHeight: 1 }}>{value}</div><div className="up" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1 }}>{label}</div></div>
  </div>
);
const SectionHead = ({ icon: Ic, title, sub, action }) => (
  <div className="sechead">
    <div style={{ width: 44, height: 44, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--sys)", borderRadius: 2, background: "rgba(56,207,255,.08)" }}><Ic size={22} color="var(--sys)" /></div>
    <div style={{ flex: 1, minWidth: 150 }}>
      <div className="mono up glow-cyan sechead-title" style={{ color: "#eaf4ff", letterSpacing: 2, lineHeight: 1 }}>{title}</div>
      <div style={{ color: "var(--muted)", fontSize: 14 }}>{sub}</div>
    </div>
    {action}
  </div>
);

const RANK_COLORS = { E: "#8a94ad", D: "#48e6a0", C: "#38cfff", B: "#8b5cff", A: "#ff8a5c", S: "#ffcf5c" };
const RANK_REQ = { S: "Maintain exceptional consistency for 2 years to reach S." };
function RankBadge({ rank = "A", pct = 82, size = 168 }) {
  const r = size / 2 - 12, C = 2 * Math.PI * r, col = RANK_COLORS[rank];
  const hex = (cx, cy, rr) => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 180 * (60 * i - 90); return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`; }).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", maxWidth: "100%" }}>
      <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#38cfff" /><stop offset="1" stopColor="#8b5cff" /></linearGradient></defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(56,207,255,.12)" strokeWidth="4" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#rg)" strokeWidth="4" strokeDasharray={C} strokeDashoffset={C - C * pct / 100} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset 1s ease" }} />
      <polygon points={hex(size / 2, size / 2, r - 18)} fill="rgba(8,13,28,.9)" stroke={col} strokeWidth="1.5" />
      <polygon points={hex(size / 2, size / 2, r - 26)} fill="none" stroke={col} strokeWidth="1" opacity=".35" />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fontFamily="Chakra Petch" fontWeight="700" fontSize={size * 0.36} fill={col} style={{ textShadow: `0 0 20px ${col}` }}>{rank}</text>
      <text x="50%" y="72%" textAnchor="middle" fontFamily="Chakra Petch" fontSize="10" letterSpacing="3" fill="#6f80a8">RANK</text>
    </svg>
  );
}
function Ring({ value, max, label, unit, color = "#38cfff", size = 88 }) {
  const r = size / 2 - 7, C = 2 * Math.PI * r, pct = Math.min(1, (value || 0) / (max || 1));
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(56,207,255,.1)" strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C - C * pct} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .8s ease" }} />
        <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" fontFamily="Chakra Petch" fontWeight="700" fontSize="17" fill="#eaf4ff">{Math.round(value)}</text>
        <text x="50%" y="64%" textAnchor="middle" fontFamily="Chakra Petch" fontSize="9" fill="#6f80a8">/{max}{unit}</text>
      </svg>
      <div className="mono up" style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, letterSpacing: 1.5 }}>{label}</div>
    </div>
  );
}
function Sparkline({ data, color = "#38cfff", h = 44 }) {
  const max = Math.max(...data, 1), w = 100, step = w / (data.length - 1 || 1);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      {data.map((v, i) => { const bh = (v / max) * (h - 6); return <rect key={i} x={i * step + 1} y={h - bh} width={Math.max(2, step - 3)} height={bh} rx="1" fill={color} opacity={.35 + .6 * (v / max)} />; })}
    </svg>
  );
}
function LineChart({ data, color = "#8b5cff", unit = "" }) {
  if (!data.length) return null;
  const w = 260, h = 90, pad = 8;
  const max = Math.max(...data.map(d => d.v)) * 1.1 || 1, min = Math.min(...data.map(d => d.v)) * 0.9;
  const x = i => pad + i * (w - pad * 2) / (data.length - 1 || 1);
  const y = v => h - pad - (v - min) / (max - min || 1) * (h - pad * 2);
  const pts = data.map((d, i) => `${x(i)},${y(d.v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.v)} r="2.6" fill={color} />)}
      {data.map((d, i) => <text key={"t" + i} x={x(i)} y={h - 1} textAnchor="middle" fontFamily="Chakra Petch" fontSize="7" fill="#6f80a8">{d.l}</text>)}
    </svg>
  );
}

const MODULES = [
  { key: "home", label: "Command", short: "Home", icon: Home },
  { key: "spirituality", label: "Spirituality", short: "Spirit", icon: Sparkles },
  { key: "finance", label: "Finance", short: "Finance", icon: Wallet },
  { key: "fitness", label: "Fitness", short: "Fitness", icon: Dumbbell },
  { key: "learning", label: "Learning", short: "Learn", icon: GraduationCap },
  { key: "quests", label: "Quests", short: "Quests", icon: Swords },
];
const AREAS = ["Spirituality", "Finance", "Fitness", "Learning", "Quests"];
const DAYS7 = ["M", "T", "W", "T", "F", "S", "S"];
const FREQ = ["Daily", "Weekly", "Monthly", "Yearly", "Custom"];
const CUSTOM = "＋ Add custom…";
const FOOD_DB = {
  "Chicken breast": { kcal: 1.65, p: .31, c: 0, fat: .036, fib: 0 }, "Cooked rice": { kcal: 1.30, p: .027, c: .28, fat: .003, fib: .004 },
  "Mixed vegetables": { kcal: .65, p: .025, c: .13, fat: .004, fib: .04 }, "Olive oil": { kcal: 8.84, p: 0, c: 0, fat: 1, fib: 0 },
  "Egg": { kcal: 1.55, p: .13, c: .011, fat: .11, fib: 0 }, "Oats": { kcal: 3.89, p: .17, c: .66, fat: .07, fib: .10 },
  "Banana": { kcal: .89, p: .011, c: .23, fat: .003, fib: .026 }, "Paneer": { kcal: 2.65, p: .18, c: .012, fat: .21, fib: 0 }, "Milk": { kcal: .42, p: .034, c: .05, fat: .01, fib: 0 },
};
const EXERCISES = ["Bench Press", "Squat", "Deadlift", "Overhead Press", "Pull-up", "Barbell Row", "Bicep Curl", "Leg Press", "Lunges", "Plank"];
const BODY_PARTS = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Full Body"];
const DAILY_DEFS = [
  { id: "d1", t: "Read 5 pages of scripture", area: "Spirituality" }, { id: "d2", t: "Meditate for 20 minutes", area: "Spirituality" },
  { id: "d3", t: "Complete today's workout", area: "Fitness" }, { id: "d4", t: "Track all meals & macros", area: "Fitness" },
  { id: "d5", t: "Video editing lesson", area: "Learning" }, { id: "d6", t: "Update expense log", area: "Finance" }, { id: "d7", t: "Wake up at 6:00 AM", area: "Quests" },
];
const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return (h % 1000) / 1000; };

function seedLogs() {
  const logs = {}, put = (k, id) => { (logs[k] = logs[k] || {})[id] = true; };
  const dids = DAILY_DEFS.map(d => d.id);
  for (let i = 0; i <= 44; i++) {
    const k = dkey(addDays(TODAY, -i));
    dids.forEach((id, idx) => { if (i === 0) { if (idx < 5) put(k, id); } else if (i <= 38) put(k, id); else if (hash(id + i) > .35) put(k, id); });
  }
  // recurring items: seed most-recent n days
  const recur = [
    { id: "sp1", n: 12, today: true }, { id: "sp2", n: 6, today: true }, { id: "sp3", n: 22, today: true },
    { id: "le1", n: 38 }, { id: "le2", n: 41 }, { id: "le3", n: 15 }, { id: "le4", n: 18 },
    { id: "qd1", n: 38, today: true },
    { id: "wo1", n: 10 }, { id: "wo2", n: 10 },
  ];
  recur.forEach(r => { const s = r.today ? 0 : 1; for (let i = s; i < s + r.n; i++) put(dkey(addDays(TODAY, -i)), r.id); });
  return logs;
}

const initialState = {
  view: "home",
  date: TKEY,
  range: null,
  logs: seedLogs(),
  dailyDefs: DAILY_DEFS,
  spirit: {
    cats: ["Scripture", "Prayer", "Meditation", "Gratitude", "Spiritual Learning", "Reflection", "Worship", "Mindfulness", "Personal Growth"],
    goals: [
      { id: "sp1", title: "Read 5 pages of scripture", cat: "Scripture", freq: "Daily", desc: "Daily reading practice" },
      { id: "sp2", title: "Meditate for 20 minutes", cat: "Meditation", freq: "Daily", desc: "" },
      { id: "sp3", title: "Practice gratitude each morning", cat: "Gratitude", freq: "Daily", desc: "" },
    ],
  },
  finance: {
    monthlyBudget: 25000,
    loans: [
      { id: uid(), title: "Home Loan", total: 300000, term: 12, months: [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0] },
      { id: uid(), title: "Car Loan", total: 120000, term: 24, months: Array.from({ length: 24 }, (_, i) => i < 7 ? 1 : 0) },
    ],
    goals: [
      { id: uid(), c: "Savings", now: 50000, total: 100000, target: "Dec 31, 2026", freq: "Monthly" },
      { id: uid(), c: "Education", now: 30000, total: 50000, target: "Oct 15, 2026", freq: "Monthly" },
      { id: uid(), c: "Travel", now: 20000, total: 40000, target: "Nov 30, 2026", freq: "Monthly" },
    ],
    expenses: [
      { id: uid(), title: "Groceries", cat: "Food", amount: 3200, date: TKEY }, { id: uid(), title: "Metro pass", cat: "Transport", amount: 1200, date: TKEY },
      { id: uid(), title: "Course subscription", cat: "Learning", amount: 999, date: dkey(addDays(TODAY, -2)) }, { id: uid(), title: "Dinner out", cat: "Food", amount: 1500, date: dkey(addDays(TODAY, -5)) },
      { id: uid(), title: "Gym supplement", cat: "Health", amount: 2400, date: dkey(addDays(TODAY, -12)) },
    ],
  },
  fitness: {
    targets: { kcal: 2400, p: 180, c: 260, fib: 35 },
    meals: {
      [TKEY]: [
        { id: uid(), m: "Breakfast", kcal: 420, p: 30, c: 45, fat: 12, fib: 8 }, { id: uid(), m: "Lunch", kcal: 680, p: 52, c: 70, fat: 18, fib: 10 },
        { id: uid(), m: "Post-workout", kcal: 310, p: 35, c: 40, fat: 5, fib: 4 }, { id: uid(), m: "Dinner", kcal: 450, p: 25, c: 55, fat: 14, fib: 6 },
      ],
      [dkey(addDays(TODAY, -1))]: [{ id: uid(), m: "Breakfast", kcal: 400, p: 28, c: 44, fat: 11, fib: 7 }, { id: uid(), m: "Lunch", kcal: 640, p: 48, c: 66, fat: 16, fib: 9 }],
    },
    workouts: [
      { id: "wo1", name: "Bench Press", part: "Chest", sets: 4, reps: 10, weight: 65, dur: 0, rest: 90, notes: "" },
      { id: "wo2", name: "Barbell Row", part: "Back", sets: 4, reps: 10, weight: 55, dur: 0, rest: 90, notes: "" },
      { id: "wo3", name: "Overhead Press", part: "Shoulders", sets: 3, reps: 12, weight: 35, dur: 0, rest: 60, notes: "Keep core tight" },
    ],
    bench: [{ l: "W1", v: 50 }, { l: "W2", v: 55 }, { l: "W3", v: 60 }, { l: "W4", v: 65 }],
    measures: [
      { id: uid(), name: "Weight", value: 78.4, unit: "kg", hist: [{ l: "Jun", v: 82 }, { l: "Jul", v: 80 }, { l: "Aug", v: 78.4 }] },
      { id: uid(), name: "Waist", value: 82, unit: "cm", hist: [{ l: "Jun", v: 86 }, { l: "Jul", v: 84 }, { l: "Aug", v: 82 }] },
      { id: uid(), name: "Body fat", value: 16.2, unit: "%", hist: [{ l: "Jun", v: 18 }, { l: "Jul", v: 17 }, { l: "Aug", v: 16.2 }] },
    ],
    photos: [{ id: uid(), label: "Week 1", angle: "Front" }, { id: uid(), label: "Week 2", angle: "Front" }, { id: uid(), label: "Week 3", angle: "Side" }],
  },
  learning: {
    cats: ["Learning", "Skills", "Study", "Design", "Technology", "Languages", "Career", "Personal Development", "Courses"],
    goals: [
      { id: "le1", title: "Learn Video Editing", cat: "Skills", desc: "Master editing fundamentals", daily: true, daysTotal: 90, target: "Nov 10, 2026", start: dkey(addDays(TODAY, -38)) },
      { id: "le2", title: "Learn Figma", cat: "Design", desc: "", daily: true, daysTotal: 60, target: "Sep 22, 2026", start: dkey(addDays(TODAY, -41)) },
      { id: "le3", title: "Digital Marketing Course", cat: "Career", desc: "", daily: false, daysTotal: 60, target: "Oct 30, 2026", start: dkey(addDays(TODAY, -15)) },
      { id: "le4", title: "Learn Spanish", cat: "Languages", desc: "", daily: true, daysTotal: 120, target: "Dec 15, 2026", start: dkey(addDays(TODAY, -18)) },
    ],
  },
  quests: {
    cats: ["Personal", "Career", "Family", "Travel", "Business", "Relationships", "Habits", "Lifestyle", "Hobbies", "Other"],
    list: [
      { id: uid(), title: "Read 20 books this year", cat: "Personal", pct: 60, daily: false, start: dkey(addDays(TODAY, -120)), target: "Dec 31, 2026", milestones: [] },
      { id: "qd1", title: "Wake up at 6 AM every day", cat: "Habits", pct: 0, daily: true, start: dkey(addDays(TODAY, -60)), target: "Ongoing", milestones: [] },
      { id: uid(), title: "Travel to 5 new places", cat: "Travel", pct: 40, daily: false, start: dkey(addDays(TODAY, -90)), target: "Dec 31, 2026", milestones: [] },
      {
        id: uid(), title: "Start my own business", cat: "Business", pct: 0, daily: false, start: dkey(addDays(TODAY, -30)), target: "Jun 2027",
        milestones: [
          { id: uid(), t: "Research the market", done: true }, { id: uid(), t: "Define the business idea", done: true }, { id: uid(), t: "Create a business plan", done: true },
          { id: uid(), t: "Build the website", done: false }, { id: uid(), t: "Launch the product", done: false }, { id: uid(), t: "Get the first customer", done: false },
        ],
      },
      { id: uid(), title: "Run a marathon", cat: "Habits", pct: 0, daily: false, start: dkey(addDays(TODAY, 20)), target: "2027", milestones: [] },
    ],
  },
};

/* ---------- reducer ---------- */
function toggleLog(logs, id, key) {
  const day = { ...(logs[key] || {}) };
  if (day[id]) delete day[id]; else day[id] = true;
  return { ...logs, [key]: day };
}
function reducer(s, a) {
  switch (a.type) {
    case "SET_VIEW": return { ...s, view: a.view };
    case "SET_DATE": return { ...s, date: a.date, range: a.range || null };
    case "TOGGLE_LOG": return { ...s, logs: toggleLog(s.logs, a.id, a.key || s.date) };
    case "ADD_DAILY": return { ...s, dailyDefs: [...s.dailyDefs, { id: uid(), t: a.t, area: a.area }] };

    case "ADD_SPIRIT": return { ...s, spirit: { ...s.spirit, cats: [...new Set([...s.spirit.cats, a.cat])], goals: [{ id: uid(), title: a.title, cat: a.cat, freq: a.freq || "Daily", desc: a.desc || "" }, ...s.spirit.goals] } };
    case "DEL_SPIRIT": return { ...s, spirit: { ...s.spirit, goals: s.spirit.goals.filter(g => g.id !== a.id) } };

    case "TOGGLE_LOAN": return { ...s, finance: { ...s.finance, loans: s.finance.loans.map(L => L.id === a.id ? { ...L, months: L.months.map((m, i) => i === a.i ? (m ? 0 : 1) : m) } : L) } };
    case "ADD_LOAN": { const term = clamp(Number(a.term) || 12, 1, 60); return { ...s, finance: { ...s.finance, loans: [...s.finance.loans, { id: uid(), title: a.title, total: Number(a.total) || 0, term, months: Array(term).fill(0) }] } }; }
    case "DEL_LOAN": return { ...s, finance: { ...s.finance, loans: s.finance.loans.filter(L => L.id !== a.id) } };
    case "ADD_FIN_GOAL": return { ...s, finance: { ...s.finance, goals: [...s.finance.goals, { id: uid(), c: a.c, now: Number(a.now) || 0, total: Number(a.total) || 0, target: a.target || "—", freq: a.freq || "Monthly" }] } };
    case "DEL_FIN_GOAL": return { ...s, finance: { ...s.finance, goals: s.finance.goals.filter(g => g.id !== a.id) } };
    case "ADD_EXPENSE": return { ...s, finance: { ...s.finance, expenses: [{ id: uid(), title: a.title, cat: a.cat, amount: Number(a.amount) || 0, date: a.date }, ...s.finance.expenses] } };
    case "DEL_EXPENSE": return { ...s, finance: { ...s.finance, expenses: s.finance.expenses.filter(e => e.id !== a.id) } };

    case "SET_TARGETS": return { ...s, fitness: { ...s.fitness, targets: { kcal: Number(a.kcal) || s.fitness.targets.kcal, p: Number(a.p) || s.fitness.targets.p, c: Number(a.c) || s.fitness.targets.c, fib: Number(a.fib) || s.fitness.targets.fib } } };
    case "ADD_MEAL": { const list = s.fitness.meals[a.date] || []; return { ...s, fitness: { ...s.fitness, meals: { ...s.fitness.meals, [a.date]: [...list, { id: uid(), m: a.m, kcal: a.kcal, p: a.p, c: a.c, fat: a.fat, fib: a.fib }] } } }; }
    case "DEL_MEAL": return { ...s, fitness: { ...s.fitness, meals: { ...s.fitness.meals, [a.date]: (s.fitness.meals[a.date] || []).filter(m => m.id !== a.id) } } };
    case "ADD_WORKOUT": return { ...s, fitness: { ...s.fitness, workouts: [...s.fitness.workouts, { id: uid(), name: a.name, part: a.part, sets: Number(a.sets) || 0, reps: Number(a.reps) || 0, weight: Number(a.weight) || 0, dur: Number(a.dur) || 0, rest: Number(a.rest) || 0, notes: a.notes || "" }] } };
    case "DEL_WORKOUT": return { ...s, fitness: { ...s.fitness, workouts: s.fitness.workouts.filter(w => w.id !== a.id) } };
    case "ADD_MEASURE": return { ...s, fitness: { ...s.fitness, measures: [...s.fitness.measures, { id: uid(), name: a.name, value: Number(a.value) || 0, unit: a.unit || "", hist: [{ l: "Now", v: Number(a.value) || 0 }] }] } };
    case "ADD_PHOTO": return { ...s, fitness: { ...s.fitness, photos: [...s.fitness.photos, { id: uid(), label: `Week ${s.fitness.photos.length + 1}`, angle: a.angle || "Front" }] } };

    case "ADD_LEARNING": return { ...s, learning: { ...s.learning, cats: [...new Set([...s.learning.cats, a.cat])], goals: [{ id: uid(), title: a.title, cat: a.cat, desc: a.desc || "", daily: a.daily === "Yes", daysTotal: Number(a.daysTotal) || 90, target: a.target || "—", start: s.date }, ...s.learning.goals] } };
    case "DEL_LEARNING": return { ...s, learning: { ...s.learning, goals: s.learning.goals.filter(g => g.id !== a.id) } };

    case "ADD_QUEST": return { ...s, quests: { ...s.quests, cats: [...new Set([...s.quests.cats, a.cat])], list: [{ id: uid(), title: a.title, cat: a.cat, desc: a.desc || "", pct: 0, daily: a.daily === "Yes", start: a.start || s.date, target: a.target || "—", milestones: [] }, ...s.quests.list] } };
    case "ADD_MILESTONE": return { ...s, quests: { ...s.quests, list: s.quests.list.map(q => q.id === a.id ? { ...q, milestones: [...q.milestones, { id: uid(), t: a.t, done: false }] } : q) } };
    case "TOGGLE_MILESTONE": return { ...s, quests: { ...s.quests, list: s.quests.list.map(q => q.id === a.id ? { ...q, milestones: q.milestones.map(m => m.id === a.mid ? { ...m, done: !m.done } : m) } : q) } };
    case "DEL_QUEST": return { ...s, quests: { ...s.quests, list: s.quests.list.filter(q => q.id !== a.id) } };
    default: return s;
  }
}

/* ---------- date-aware derived helpers ---------- */
const isDone = (logs, id, key) => !!(logs[key] && logs[key][id]);
function streakOf(logs, id, uptoKey) {
  const up = fromKey(uptoKey); let start = isDone(logs, id, uptoKey) ? 0 : 1, s = 0;
  for (let i = start; i < 400; i++) { if (isDone(logs, id, dkey(addDays(up, -i)))) s++; else break; }
  return s;
}
function longestOf(logs, id, window = 120) {
  let best = 0, run = 0;
  for (let i = window; i >= 0; i--) { if (isDone(logs, id, dkey(addDays(TODAY, -i)))) { run++; best = Math.max(best, run); } else run = 0; }
  return best;
}
const countOf = (logs, id) => Object.values(logs).filter(d => d[id]).length;
function weekPct(logs, id, dateKey) {
  const days = weekDays(fromKey(dateKey)).filter(d => dkey(d) <= TKEY);
  if (!days.length) return 0;
  return Math.round(days.filter(d => isDone(logs, id, dkey(d))).length / days.length * 100);
}
function monthPct(logs, id, dateKey) {
  let done = 0, total = 0; const end = fromKey(dateKey);
  for (let i = 0; i < 30; i++) { const k = dkey(addDays(end, -i)); if (k > TKEY) continue; total++; if (isDone(logs, id, k)) done++; }
  return total ? Math.round(done / total * 100) : 0;
}
function dailyFull(logs, defs, key) { const ids = defs.map(d => d.id); const day = logs[key]; return !!day && ids.every(id => day[id]); }
function dailyStreak(logs, defs, uptoKey = TKEY) {
  const up = fromKey(uptoKey); let start = dailyFull(logs, defs, uptoKey) ? 0 : 1, s = 0;
  for (let i = start; i < 500; i++) { if (dailyFull(logs, defs, dkey(addDays(up, -i)))) s++; else break; }
  return s;
}
function bestDailyStreak(logs, defs, window = 90) {
  let best = 0, run = 0;
  for (let i = window; i >= 0; i--) { if (dailyFull(logs, defs, dkey(addDays(TODAY, -i)))) { run++; best = Math.max(best, run); } else run = 0; }
  return best;
}
function dayCompletion(logs, defs, key) { const day = logs[key]; if (!day) return null; const total = defs.length, d = defs.filter(x => day[x.id]).length; return { d, total, pct: Math.round(d / total * 100) }; }
function areaCompletion(logs, defs, key) {
  const day = logs[key];
  return AREAS.map(area => { const list = defs.filter(x => x.area === area); const d = day ? list.filter(x => day[x.id]).length : 0; return { area, d, total: list.length, pct: list.length ? Math.round(d / list.length * 100) : 0 }; });
}
const daysBetween = (aKey, bKey) => Math.round((fromKey(bKey) - fromKey(aKey)) / 86400000);
const learnDone = (logs, g) => g.daily ? countOf(logs, g.id) : clamp(daysBetween(g.start, TKEY), 0, g.daysTotal);
const learnPct = (logs, g) => Math.min(100, Math.round(learnDone(logs, g) / (g.daysTotal || 1) * 100));

/* ---------- generic form modal ---------- */
function FormModal() {
  const { modal, closeModal } = useApp();
  const [v, setV] = useState({});
  useEffect(() => { if (modal) setV(modal.fields.reduce((o, f) => ({ ...o, [f.name]: f.default ?? (f.type === "toggle" ? "No" : "") }), {})); }, [modal]);
  if (!modal) return null;
  const set = (n, val) => setV(o => ({ ...o, [n]: val }));
  const resolve = () => { const out = { ...v }; modal.fields.forEach(f => { if (f.type === "customselect" && v[f.name] === CUSTOM) out[f.name] = (v[f.name + "_c"] || "").trim(); }); return out; };
  const missing = modal.fields.some(f => { if (!f.required) return false; const val = f.type === "customselect" && v[f.name] === CUSTOM ? v[f.name + "_c"] : v[f.name]; return !String(val || "").trim(); });
  return (
    <div className="overlay" onClick={closeModal}>
      <div className="modalwrap" onClick={e => e.stopPropagation()}>
        <Panel mon className="fadeUp">
          <PHead icon={Plus} right={<X size={15} style={{ cursor: "pointer", color: "var(--muted)" }} onClick={closeModal} />}>{modal.title}</PHead>
          <div style={{ padding: 20, display: "grid", gap: 13 }}>
            {modal.fields.map(f => (
              <div key={f.name}>
                <label className="lbl">{f.label}{f.required && <span style={{ color: "var(--danger)" }}> *</span>}</label>
                {f.type === "toggle" ? (
                  <div style={{ display: "flex", gap: 8 }}>{["Yes", "No"].map(o => <button key={o} onClick={() => set(f.name, o)} className={`sysbtn ${v[f.name] === o ? "" : "ghost"}`} style={{ flex: 1, padding: "9px 0" }}>{o}</button>)}</div>
                ) : f.type === "select" || f.type === "customselect" ? (
                  <>
                    <select className="inp" value={v[f.name] || ""} onChange={e => set(f.name, e.target.value)}>
                      <option value="" style={{ background: "#0a1020" }}>Select…</option>
                      {f.options.map(o => <option key={o} value={o} style={{ background: "#0a1020" }}>{o}</option>)}
                      {f.type === "customselect" && <option value={CUSTOM} style={{ background: "#0a1020" }}>{CUSTOM}</option>}
                    </select>
                    {f.type === "customselect" && v[f.name] === CUSTOM && <input className="inp" style={{ marginTop: 8 }} placeholder="New name" value={v[f.name + "_c"] || ""} onChange={e => set(f.name + "_c", e.target.value)} />}
                  </>
                ) : f.type === "textarea" ? (
                  <textarea className="inp" rows={2} value={v[f.name] || ""} onChange={e => set(f.name, e.target.value)} placeholder={f.placeholder} />
                ) : (
                  <input className="inp" type={f.type || "text"} value={v[f.name] || ""} onChange={e => set(f.name, e.target.value)} placeholder={f.placeholder} />
                )}
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
              <button className="sysbtn mon" disabled={missing} onClick={() => { modal.onSubmit(resolve()); closeModal(); }}>{modal.submitLabel || "Create"}</button>
              <button className="sysbtn ghost" onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ---------- meal modal (ingredient calculator) ---------- */
function MealModal() {
  const { mealModal, setMealModal, dispatch, notify, state } = useApp();
  const [name, setName] = useState("");
  const [rows, setRows] = useState([{ id: uid(), food: "Chicken breast", grams: 150 }]);
  useEffect(() => { if (mealModal) { setName(""); setRows([{ id: uid(), food: "Chicken breast", grams: 150 }]); } }, [mealModal]);
  if (!mealModal) return null;
  const totals = rows.reduce((t, r) => { const f = FOOD_DB[r.food]; const g = Number(r.grams) || 0; if (f) { t.kcal += f.kcal * g; t.p += f.p * g; t.c += f.c * g; t.fat += f.fat * g; t.fib += f.fib * g; } return t; }, { kcal: 0, p: 0, c: 0, fat: 0, fib: 0 });
  const rd = n => Math.round(n);
  return (
    <div className="overlay" onClick={() => setMealModal(false)}>
      <div className="modalwrap" onClick={e => e.stopPropagation()}>
        <Panel mon className="fadeUp">
          <PHead icon={Utensils} right={<X size={15} style={{ cursor: "pointer", color: "var(--muted)" }} onClick={() => setMealModal(false)} />}>Add Meal · {fmtShort(fromKey(state.date))}</PHead>
          <div style={{ padding: 20, display: "grid", gap: 12 }}>
            <div><label className="lbl">Meal name *</label><input className="inp" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Lunch" /></div>
            <label className="lbl">Ingredients (auto-calculates macros)</label>
            {rows.map(r => (
              <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select className="inp" style={{ flex: 2, minWidth: 0 }} value={r.food} onChange={e => setRows(rs => rs.map(x => x.id === r.id ? { ...x, food: e.target.value } : x))}>
                  {Object.keys(FOOD_DB).map(f => <option key={f} value={f} style={{ background: "#0a1020" }}>{f}</option>)}
                </select>
                <input className="inp" style={{ width: 74, flex: "0 0 auto" }} type="number" value={r.grams} onChange={e => setRows(rs => rs.map(x => x.id === r.id ? { ...x, grams: e.target.value } : x))} />
                <span className="mono" style={{ color: "var(--muted)", fontSize: 12 }}>g</span>
                {rows.length > 1 && <Trash2 size={15} className="rm" color="var(--danger)" onClick={() => setRows(rs => rs.filter(x => x.id !== r.id))} />}
              </div>
            ))}
            <button className="iconbtn" style={{ justifySelf: "start" }} onClick={() => setRows(rs => [...rs, { id: uid(), food: "Cooked rice", grams: 100 }])}><Plus size={12} /> Ingredient</button>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 2, background: "rgba(56,207,255,.05)" }}>
              {[["Cal", rd(totals.kcal)], ["Protein", rd(totals.p) + "g"], ["Carbs", rd(totals.c) + "g"], ["Fat", rd(totals.fat) + "g"], ["Fiber", rd(totals.fib) + "g"]].map(([l, val]) => (
                <div key={l}><div className="up" style={{ fontSize: 9, color: "var(--muted)" }}>{l}</div><div className="mono" style={{ color: "#eaf4ff", fontSize: 16 }}>{val}</div></div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="sysbtn mon" disabled={!name.trim()} onClick={() => { dispatch({ type: "ADD_MEAL", date: state.date, m: name.trim(), kcal: rd(totals.kcal), p: rd(totals.p), c: rd(totals.c), fat: rd(totals.fat), fib: rd(totals.fib) }); notify("Meal logged for " + fmtShort(fromKey(state.date)) + ".", "ok"); setMealModal(false); }}>Add Meal</button>
              <button className="sysbtn ghost" onClick={() => setMealModal(false)}>Cancel</button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Toasts({ toasts }) {
  return (
    <div className="toasts">
      {toasts.map(t => (
        <div key={t.id} className="slideIn">
          <Panel style={{ borderColor: t.type === "err" ? "rgba(255,90,110,.4)" : t.type === "ok" ? "rgba(72,230,160,.4)" : "var(--line)" }}>
            <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <Zap size={15} color={t.type === "err" ? "var(--danger)" : t.type === "ok" ? "var(--green)" : "var(--sys)"} />
              <div><div className="mono up" style={{ fontSize: 9, letterSpacing: 2, color: "var(--muted)" }}>⟨ System ⟩</div><div style={{ fontSize: 14 }}>{t.msg}</div></div>
            </div>
          </Panel>
        </div>
      ))}
    </div>
  );
}

/* ---------- shared week strip (date-aware) ---------- */
function WeekStrip({ id }) {
  const { state, dispatch } = useApp();
  const days = weekDays(fromKey(state.date));
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {days.map((d, j) => {
        const key = dkey(d), on = isDone(state.logs, id, key), future = key > TKEY, sel = key === state.date;
        return (
          <div key={key} className={`daybox ${on ? "on" : ""} ${sel ? "sel" : ""}`} title={fmtDate(d)}
            onClick={() => !future && dispatch({ type: "TOGGLE_LOG", id, key })}
            style={{ opacity: future ? .35 : 1, cursor: future ? "not-allowed" : "pointer" }}>
            <span>{DAYS7[j]}</span><span className="dn">{d.getDate()}</span>
          </div>
        );
      })}
    </div>
  );
}
function ViewingChip() {
  const { state } = useApp();
  const label = state.range ? state.range.label : (state.date === TKEY ? "Today" : fmtDate(fromKey(state.date)));
  return <Chip style={{ color: "var(--monarch-b)", borderColor: "rgba(139,92,255,.3)" }}><Eye size={11} /> {label}</Chip>;
}

/* ================= AUTH ================= */
const ALL_AREAS = [{ k: "Spirituality", i: Sparkles }, { k: "Finance", i: Wallet }, { k: "Fitness / Gym", i: Dumbbell }, { k: "Learning", i: GraduationCap }, { k: "Quests / Goals", i: Swords }];
function AuthFlow({ phase, setPhase, onAuth, users, addUser }) {
  const { notify } = useApp();
  const [tab, setTab] = useState("signup");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [areas, setAreas] = useState(ALL_AREAS.map(a => a.k));
  const set = (k, val) => setForm(f => ({ ...f, [k]: val }));
  const doSignup = () => {
    if (!form.name.trim() || !form.email.includes("@") || form.password.length < 3) return notify("Enter a name, valid email and a 3+ char password.", "err");
    if (users[form.email.toLowerCase()]) return notify("An account with that email already exists.", "err");
    addUser({ name: form.name.trim(), email: form.email.toLowerCase(), password: form.password });
    notify("Account created — configure your System.", "ok"); setPhase("setup");
  };
  const doLogin = () => { const u = users[form.email.toLowerCase()]; if (!u || u.password !== form.password) return notify("Invalid credentials. Try the demo account.", "err"); onAuth({ name: u.name, email: u.email }); };
  const provider = p => { const e = `hunter@${p.toLowerCase()}.io`; if (!users[e]) addUser({ name: `${p} Hunter`, email: e, password: "" }); onAuth({ name: `${p} Hunter`, email: e, provider: p }); };
  return (
    <div className="sl-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{CSS}</style>
      <div style={{ width: "100%", maxWidth: 560, position: "relative", zIndex: 1 }}>
        {phase === "welcome" && (
          <Panel mon className="fadeUp"><div className="scanline" /><PHead icon={Zap}>⟨ System ⟩ Notification</PHead>
            <div style={{ padding: 28 }}>
              <div className="mono up glow-mon" style={{ fontSize: 12, color: "var(--monarch-b)", letterSpacing: 3, marginBottom: 6 }}>You have been selected as a Player</div>
              <div className="mono glow-cyan" style={{ fontSize: 30, color: "#eaf4ff", lineHeight: 1.15, marginBottom: 14 }}>Individual Development System</div>
              <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.6, marginBottom: 8 }}>Track growth across Spirituality, Finance, Fitness, Learning and Quests. Clear daily quests to build streaks and rise <span style={{ color: "var(--sys-b)" }}>E → D → C → B → A → S</span>.</p>
              <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 22 }}>Consistency is everything — each completed goal advances your rank. Missing daily quests can cost your streak and progress.</p>
              <button className="sysbtn mon" onClick={() => setPhase("rules")}>Continue ▸</button>
            </div>
          </Panel>
        )}
        {phase === "rules" && (
          <Panel mon className="fadeUp"><PHead icon={Shield}>Rules & Warning</PHead>
            <div style={{ padding: 24 }}>
              {["You are responsible for setting realistic, achievable goals.", "This System rewards consistency and discipline above all.", "Do not create unrealistic or harmful goals to inflate your rank.", "Missing a daily quest may reduce your streak, progress, or rank.", "Financial data is for personal tracking only — not financial advice.", "Review your goals carefully before you begin the ascent."].map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(84,150,235,.1)" }}><span className="mono" style={{ color: "var(--sys)", fontSize: 13, minWidth: 22 }}>{String(i + 1).padStart(2, "0")}</span><span style={{ fontSize: 14, lineHeight: 1.45 }}>{r}</span></div>
              ))}
              <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}><button className="sysbtn" onClick={() => setPhase("auth")}>I Understand & Continue ▸</button><button className="sysbtn ghost" onClick={() => setPhase("welcome")}>Back</button></div>
            </div>
          </Panel>
        )}
        {phase === "auth" && (
          <Panel className="fadeUp"><div className="scanline" /><PHead icon={User}>{tab === "signup" ? "Register Player" : "Player Login"}</PHead>
            <div style={{ display: "flex", borderBottom: "1px solid var(--line)" }}>
              <div className={`tab ${tab === "signup" ? "on" : ""}`} style={{ flex: 1, textAlign: "center" }} onClick={() => setTab("signup")}>Sign Up</div>
              <div className={`tab ${tab === "login" ? "on" : ""}`} style={{ flex: 1, textAlign: "center" }} onClick={() => setTab("login")}>Log In</div>
            </div>
            <div style={{ padding: 24, display: "grid", gap: 14 }}>
              {tab === "signup" && <div><label className="lbl">Name</label><input className="inp" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Your name" /></div>}
              <div><label className="lbl">Email Address</label><input className="inp" type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="you@system.io" /></div>
              <div><label className="lbl">Password</label><input className="inp" type="password" value={form.password} onChange={e => set("password", e.target.value)} placeholder="••••••••" /></div>
              <button className="sysbtn" onClick={tab === "signup" ? doSignup : doLogin}>{tab === "signup" ? "Create Account ▸" : "Enter the System ▸"}</button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--muted)", fontSize: 12 }}><div style={{ flex: 1, height: 1, background: "var(--line)" }} /><span className="mono up" style={{ letterSpacing: 2 }}>or</span><div style={{ flex: 1, height: 1, background: "var(--line)" }} /></div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button className="sysbtn ghost" style={{ flex: 1, minWidth: 130 }} onClick={() => provider("Google")}>Continue with Google</button><button className="sysbtn ghost" style={{ flex: 1, minWidth: 130 }} onClick={() => provider("Apple")}>Continue with Apple</button></div>
              {tab === "login" && <div className="mono" style={{ fontSize: 12, color: "var(--muted)", textAlign: "center" }}>Demo: <span style={{ color: "var(--sys-b)" }}>player@system.io</span> / <span style={{ color: "var(--sys-b)" }}>arise</span></div>}
            </div>
          </Panel>
        )}
        {phase === "setup" && (
          <Panel mon className="fadeUp"><PHead icon={Target}>First-Time Setup</PHead>
            <div style={{ padding: 24 }}>
              <p style={{ color: "var(--muted)", fontSize: 15, marginBottom: 16 }}>Choose the development areas you want the System to track. You can create goals inside each module afterward.</p>
              <div style={{ display: "grid", gap: 10 }}>
                {ALL_AREAS.map(a => { const on = areas.includes(a.k); return (
                  <div key={a.k} onClick={() => setAreas(x => on ? x.filter(v => v !== a.k) : [...x, a.k])} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: "pointer", borderRadius: 2, border: `1px solid ${on ? "var(--sys)" : "var(--line)"}`, background: on ? "rgba(56,207,255,.1)" : "transparent" }}>
                    <a.i size={18} color={on ? "var(--sys)" : "var(--muted)"} /><span style={{ flex: 1, fontSize: 15, color: on ? "#eaf4ff" : "var(--muted)" }}>{a.k}</span><span className="qbox" style={{ background: on ? "var(--sys)" : "transparent" }}>{on && <Check size={13} strokeWidth={3} />}</span>
                  </div>); })}
              </div>
              <button className="sysbtn" style={{ marginTop: 20 }} disabled={!areas.length} onClick={() => onAuth({ name: form.name.trim() || "Player", email: form.email.toLowerCase() })}>Enter the System ▸</button>
            </div>
          </Panel>
        )}
        <div className="mono up" style={{ textAlign: "center", marginTop: 16, fontSize: 10, color: "var(--muted)", letterSpacing: 2, animation: "pulse 2.4s infinite" }}>Arise, Player</div>
      </div>
    </div>
  );
}

/* ================= GLOBAL DATE BAR ================= */
function DateBar() {
  const { state, dispatch } = useApp();
  const [open, setOpen] = useState(false);
  const [cr, setCr] = useState({ from: dkey(addDays(TODAY, -6)), to: TKEY });
  const cur = fromKey(state.date);
  const setSingle = d => { const k = dkey(d); if (k <= TKEY) dispatch({ type: "SET_DATE", date: k }); };
  const pick = d => { setSingle(d); setOpen(false); };
  const setRange = (label, from, to) => { dispatch({ type: "SET_DATE", date: TKEY, range: { label, from, to } }); setOpen(false); };
  const label = state.range ? state.range.label : (state.date === TKEY ? "Today" : state.date === dkey(addDays(TODAY, -1)) ? "Yesterday" : fmtDate(cur));
  const quick = [
    { l: "Today", on: state.date === TKEY && !state.range, fn: () => pick(TODAY) },
    { l: "Yesterday", on: state.date === dkey(addDays(TODAY, -1)) && !state.range, fn: () => pick(addDays(TODAY, -1)) },
    { l: "This Week", on: state.range?.label === "This Week", fn: () => setRange("This Week", dkey(addDays(TODAY, -6)), TKEY) },
    { l: "Last Week", on: state.range?.label === "Last Week", fn: () => setRange("Last Week", dkey(addDays(TODAY, -13)), dkey(addDays(TODAY, -7))) },
    { l: "This Month", on: state.range?.label === "This Month", fn: () => setRange("This Month", dkey(addDays(TODAY, -29)), TKEY) },
  ];
  return (
    <div className="datebar-wrap">
      <button className="iconbtn arrow" disabled={!!state.range} onClick={() => setSingle(addDays(cur, -1))} aria-label="Previous day"><ChevronLeft size={15} /></button>
      <div style={{ position: "relative", flex: "1 1 auto", minWidth: 0 }}>
        <button className="datebtn" onClick={() => setOpen(o => !o)}>
          <Calendar size={14} color="var(--sys)" style={{ flex: "0 0 auto" }} />
          <span className="mono" style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
          <ChevronRight size={14} style={{ transform: open ? "rotate(90deg)" : "rotate(90deg)", opacity: .6, flex: "0 0 auto" }} />
        </button>
        {open && <>
          <div style={{ position: "fixed", inset: 0, zIndex: 24 }} onClick={() => setOpen(false)} />
          <div className="datepop slideIn">
            <Panel mon>
              <div style={{ padding: 12 }}>
                <div className="lbl" style={{ marginBottom: 8 }}>Quick select</div>
                <div className="quickgrid">
                  {quick.map(q => <button key={q.l} onClick={q.fn} className={`sysbtn ${q.on ? "" : "ghost"}`} style={{ padding: "9px 6px", fontSize: 11 }}>{q.l}</button>)}
                </div>
                <div className="lbl" style={{ margin: "14px 0 6px" }}>Jump to a date</div>
                <input type="date" max={TKEY} value={state.range ? "" : state.date} onChange={e => e.target.value && pick(fromKey(e.target.value))} className="inp" style={{ fontSize: 13 }} />
                <div className="lbl" style={{ margin: "14px 0 6px" }}><CalendarRange size={12} style={{ verticalAlign: -2 }} /> Custom range</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="date" max={TKEY} value={cr.from} onChange={e => setCr(c => ({ ...c, from: e.target.value }))} className="inp" style={{ fontSize: 12, minWidth: 0 }} />
                  <span style={{ color: "var(--muted)", flex: "0 0 auto" }}>→</span>
                  <input type="date" max={TKEY} value={cr.to} onChange={e => setCr(c => ({ ...c, to: e.target.value }))} className="inp" style={{ fontSize: 12, minWidth: 0 }} />
                </div>
                <button className="sysbtn mon" style={{ width: "100%", marginTop: 10 }} disabled={!(cr.from && cr.to && cr.from <= cr.to)} onClick={() => setRange("Custom", cr.from, cr.to)}>Apply range</button>
              </div>
            </Panel>
          </div>
        </>}
      </div>
      <button className="iconbtn arrow" disabled={!!state.range || state.date === TKEY} onClick={() => setSingle(addDays(cur, 1))} aria-label="Next day"><ChevronRight size={15} /></button>
    </div>
  );
}

/* ================= HOME ================= */
function HomeView() {
  const { state, dispatch, notify, openForm } = useApp();
  const { logs, dailyDefs: defs } = state;
  const streak = useMemo(() => dailyStreak(logs, defs, state.date), [logs, defs, state.date]);
  const best = useMemo(() => bestDailyStreak(logs, defs), [logs, defs]);

  const rangeDays = useMemo(() => {
    if (!state.range) return null;
    const out = []; let d = fromKey(state.range.from);
    while (dkey(d) <= state.range.to) { out.push(dkey(d)); d = addDays(d, 1); }
    return out;
  }, [state.range]);

  let overallPct, overview, hasData, histLabel;
  if (rangeDays) {
    const comps = rangeDays.map(k => dayCompletion(logs, defs, k)).filter(Boolean);
    overallPct = comps.length ? Math.round(comps.reduce((x, c) => x + c.pct, 0) / comps.length) : 0;
    overview = AREAS.map(area => {
      const list = defs.filter(x => x.area === area);
      const vals = rangeDays.map(k => { const day = logs[k]; return day && list.length ? list.filter(x => day[x.id]).length / list.length : 0; });
      return { area, d: null, total: null, pct: Math.round((vals.reduce((a, b) => a + b, 0) / (vals.length || 1)) * 100) };
    });
    hasData = comps.length > 0; histLabel = `${state.range.label} · avg ${overallPct}%`;
  } else {
    const c = dayCompletion(logs, defs, state.date); overallPct = c ? c.pct : 0; hasData = !!c;
    overview = areaCompletion(logs, defs, state.date); histLabel = `${fmtDate(fromKey(state.date))} · ${overallPct}%`;
  }

  const dayDone = logs[state.date] || {};
  const doneCount = defs.filter(x => dayDone[x.id]).length;
  const allDone = doneCount === defs.length && defs.length > 0;
  const pendingToday = defs.length - doneCount;
  const toNext = clamp(82 + Math.round((overallPct - 71) * 0.1), 0, 99);

  const rateFor = n => { const cs = Array.from({ length: n }, (_, i) => dayCompletion(logs, defs, dkey(addDays(TODAY, -i)))).filter(Boolean); return cs.length ? Math.round(cs.reduce((x, c) => x + c.pct, 0) / cs.length) : 0; };
  const weekly = useMemo(() => rateFor(7), [logs, defs]);
  const monthly = useMemo(() => rateFor(30), [logs, defs]);
  const missed30 = useMemo(() => { let m = 0; for (let i = 0; i < 30; i++) { const c = dayCompletion(logs, defs, dkey(addDays(TODAY, -i))); if (c && c.pct < 100) m++; } return m; }, [logs, defs]);
  const daysConsistent = useMemo(() => bestDailyStreak(logs, defs), [logs, defs]);
  const last14 = useMemo(() => Array.from({ length: 14 }, (_, i) => { const c = dayCompletion(logs, defs, dkey(addDays(TODAY, -(13 - i)))); return c ? c.pct : 0; }), [logs, defs]);

  const loans = state.finance.loans;
  const loanTotal = loans.reduce((x, L) => x + L.total, 0);
  const loanPaid = loans.reduce((x, L) => x + (L.term ? L.months.filter(Boolean).length / L.term * L.total : 0), 0);
  const loanPct = loanTotal ? Math.round(loanPaid / loanTotal * 100) : 0;
  const completedCount = state.learning.goals.filter(g => learnPct(logs, g) >= 100).length + state.quests.list.filter(q => (questMPct(q) ?? q.pct) >= 100).length + state.spirit.goals.filter(g => weekPct(logs, g.id, state.date) >= 100).length + state.finance.goals.filter(g => g.total && g.now >= g.total).length + state.quests.list.reduce((x, q) => x + q.milestones.filter(m => m.done).length, 0);
  const allPcts = [...state.spirit.goals.map(g => weekPct(logs, g.id, state.date)), ...state.learning.goals.map(g => learnPct(logs, g)), ...state.quests.list.map(q => questMPct(q) ?? q.pct), loanPct, ...state.finance.goals.map(g => g.total ? Math.round(g.now / g.total * 100) : 0)];
  const overallCompletion = Math.round(allPcts.reduce((a, b) => a + b, 0) / (allPcts.length || 1));
  const score = streak * 100 + completedCount * 40 + best * 25;
  const activeQuests = state.quests.list.filter(q => q.start <= TKEY && (questMPct(q) ?? q.pct) < 100).length;

  const parseD = s => { const d = new Date(s); return isNaN(d.getTime()) ? null : d; };
  const daysUntil = d => Math.ceil((d - TODAY) / 86400000);
  const fmtUntil = n => n <= 0 ? "due" : n < 14 ? `${n} d` : n < 60 ? `${Math.round(n / 7)} wk` : `${Math.round(n / 30)} mo`;
  const deadlines = useMemo(() => [
    ...state.learning.goals.map(g => ({ name: g.title, date: parseD(g.target), pct: learnPct(logs, g) })),
    ...state.quests.list.map(q => ({ name: q.title, date: parseD(q.target), pct: questMPct(q) ?? q.pct })),
    ...state.finance.goals.map(g => ({ name: g.c + " goal", date: parseD(g.target), pct: g.total ? Math.round(g.now / g.total * 100) : 0 })),
  ].filter(x => x.date && daysUntil(x.date) >= 0).sort((a, b) => a.date - b.date).slice(0, 5), [logs, state.learning.goals, state.quests.list, state.finance.goals]);

  const toggle = id => { const was = dayDone[id]; dispatch({ type: "TOGGLE_LOG", id }); const now = defs.filter(x => (id === x.id ? !was : dayDone[x.id])).length; if (!was && now === defs.length) notify("Daily quest complete — the shadows grow.", "ok"); };
  const addTask = () => openForm({ title: "New Daily Task", submitLabel: "Add Task", fields: [{ name: "t", label: "Task", required: true, placeholder: "e.g. Drink 3L water" }, { name: "area", label: "Area", type: "select", options: AREAS, required: true }], onSubmit: v => { dispatch({ type: "ADD_DAILY", t: v.t, area: v.area }); notify("Daily task added."); } });

  const spiritAvg = Math.round(state.spirit.goals.reduce((x, g) => x + weekPct(logs, g.id, state.date), 0) / (state.spirit.goals.length || 1));
  const learnAvg = Math.round(state.learning.goals.reduce((x, g) => x + learnPct(logs, g), 0) / (state.learning.goals.length || 1));
  const questAvg = Math.round(state.quests.list.reduce((x, q) => x + (questMPct(q) ?? q.pct), 0) / (state.quests.list.length || 1));
  const meals = state.fitness.meals[state.date] || [];
  const wDone = state.fitness.workouts.filter(w => isDone(logs, w.id, state.date)).length;
  const dayExp = state.finance.expenses.filter(e => e.date === state.date).reduce((x, e) => x + e.amount, 0);

  return (
    <div className="fadeUp" style={{ display: "grid", gap: 16 }}>
      <div className="grid g-hero">
        <Panel mon>
          <PHead icon={Shield} right={<ViewingChip />}>Hunter Status</PHead>
          <div style={{ display: "flex", gap: 18, padding: 18, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <RankBadge rank="A" pct={toNext} />
            <div style={{ flex: 1, minWidth: 190 }}>
              <div className="mono up" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: 2 }}>Progress to S Rank</div>
              <div className="mono glow-mon" style={{ fontSize: 30, color: "var(--monarch-b)", lineHeight: 1.1, margin: "2px 0 8px" }}>{toNext}%</div>
              <Bar pct={toNext} variant="gold" />
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{RANK_REQ.S}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                <MiniStat icon={Flame} label="Streak" value={`${streak} d`} color="#ff8a5c" />
                <MiniStat icon={Trophy} label="Best" value={`${best} d`} color="var(--gold)" />
                <MiniStat icon={Target} label="Cleared" value={completedCount} color="var(--sys)" />
                <MiniStat icon={Zap} label="Score" value={score.toLocaleString()} color="var(--monarch-b)" />
              </div>
            </div>
          </div>
          <div style={{ padding: "0 18px 8px", display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[["Goals cleared", completedCount], ["Pending today", pendingToday], ["Missed (30d)", missed30], ["Days consistent", daysConsistent]].map(([l, v]) => (
              <div key={l}><div className="up" style={{ fontSize: 9, color: "var(--muted)" }}>{l}</div><div className="mono" style={{ fontSize: 16, color: "#eaf4ff" }}>{v}</div></div>
            ))}
          </div>
          <div style={{ padding: "6px 18px 16px" }}>
            <div className="mono up" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 2, marginBottom: 6 }}>Rank Path</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              {["E", "D", "C", "B", "A", "S"].map((rk, i) => (
                <React.Fragment key={rk}>
                  <span className="mono" style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${rk === "A" ? RANK_COLORS.A : "var(--line)"}`, color: i <= 4 ? RANK_COLORS[rk] : "var(--muted)", borderRadius: 2, fontWeight: 700, fontSize: 14, background: rk === "A" ? "rgba(255,138,92,.12)" : "transparent" }}>{rk}</span>
                  {i < 5 && <ChevronRight size={14} color={i < 4 ? "var(--sys)" : "var(--muted)"} />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </Panel>

        <Panel style={{ position: "relative", overflow: "hidden" }}>
          <div className="scanline" />
          <PHead icon={Swords} right={<button className="iconbtn" onClick={addTask}><Plus size={12} /> Add</button>}>Today's Tasks · {fmtShort(fromKey(state.date))}</PHead>
          <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", background: allDone ? "rgba(72,230,160,.06)" : "rgba(255,90,110,.05)" }}>
            <span className="mono up" style={{ fontSize: 11, color: allDone ? "var(--green)" : "var(--danger)", letterSpacing: 1.5 }}>{allDone ? "◈ Quest cleared — no penalty" : "⚠ Failure incurs a rank penalty"}</span>
            <span className="mono" style={{ fontSize: 13, color: "var(--sys-b)" }}>[{doneCount}/{defs.length}]</span>
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {defs.map(q => (
              <div key={q.id} className={`qrow ${dayDone[q.id] ? "done" : ""}`} onClick={() => toggle(q.id)}>
                <span className={`qbox ${dayDone[q.id] ? "done" : ""}`}>{dayDone[q.id] && <Check size={13} strokeWidth={3} />}</span>
                <span className="qt" style={{ flex: 1, fontSize: 15 }}>{q.t}</span><Chip>{q.area}</Chip>
              </div>
            ))}
          </div>
          <div style={{ padding: 12 }}><Bar pct={defs.length ? doneCount / defs.length * 100 : 0} variant={allDone ? "g" : ""} />
            {allDone && <div className="mono up fadeUp" style={{ textAlign: "center", marginTop: 10, color: "var(--green)", letterSpacing: 2, fontSize: 12 }}>⟨ System ⟩ Daily quest complete.</div>}
          </div>
        </Panel>
      </div>

      <Panel>
        <PHead icon={Activity} right={<ViewingChip />}>{rangeDays ? "Range Overview" : "Today's Overview"} — {histLabel}</PHead>
        {hasData ? (
          <div className="auto-sm" style={{ gap: 0 }}>
            {overview.map((o, i) => (
              <div key={o.area} style={{ padding: 16, borderRight: i < overview.length - 1 ? "1px solid rgba(84,150,235,.12)" : "none" }}>
                <div className="mono up" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: 1, marginBottom: 8 }}>{o.area}</div>
                <div className="mono glow-cyan" style={{ fontSize: 22, color: "#eaf4ff", marginBottom: 8 }}>{o.total != null ? `${o.d}/${o.total}` : `${o.pct}%`}</div>
                <Bar pct={o.pct} variant={o.pct >= 100 ? "g" : ""} />
              </div>
            ))}
          </div>
        ) : <div style={{ padding: 22, color: "var(--muted)" }}>No data recorded for this date. Future dates have no history yet.</div>}
      </Panel>

      <div className="grid g-15">
        <div style={{ display: "grid", gap: 16 }}>
          <Panel mon>
            <PHead icon={BarChart3}>Statistics & Insights</PHead>
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
                {[["Daily", overallPct], ["Weekly", weekly], ["Monthly", monthly]].map(([l, p]) => (
                  <div key={l} style={{ flex: 1, minWidth: 90 }}><div className="up" style={{ fontSize: 10, color: "var(--muted)" }}>{l} rate</div><div className="mono glow-cyan" style={{ fontSize: 22, color: "#eaf4ff" }}>{p}%</div><Bar pct={p} /></div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
                <StatCell label="In progress" value={activeQuests + state.learning.goals.filter(g => learnPct(logs, g) < 100).length} icon={Activity} color="var(--sys)" />
                <StatCell label="Completed" value={completedCount} icon={Check} color="var(--green)" />
                <StatCell label="Missed (30d)" value={missed30} icon={X} color="var(--danger)" />
              </div>
              <div className="up" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1, marginBottom: 4 }}>Last 14 days completion</div>
              <Sparkline data={last14} />
            </div>
          </Panel>
          <div className="grid g-2">
            <NavCard k="spirituality" title="Spirituality" icon={Sparkles} rows={[["Today", `${overview.find(o => o.area === "Spirituality")?.pct || 0}%`], ["Active goals", state.spirit.goals.length], ["Avg completion", `${spiritAvg}%`]]} />
            <NavCard k="finance" title="Finance" icon={Wallet} rows={[["Outstanding", inr(loanTotal - loanPaid)], ["Loans", `${loans.length} · ${loanPct}% paid`], ["Today's expenses", inr(dayExp)]]} />
            <NavCard k="fitness" title="Fitness" icon={Dumbbell} rows={[["Calories", `${meals.reduce((x, m) => x + m.kcal, 0)}`], ["Protein", `${meals.reduce((x, m) => x + m.p, 0)} g`], ["Workout", `${wDone}/${state.fitness.workouts.length}`]]} />
            <NavCard k="learning" title="Learning" icon={GraduationCap} rows={[["Active goals", state.learning.goals.length], ["Avg progress", `${learnAvg}%`], ["Streak", `${streakOf(logs, "le1", state.date)} d`]]} />
            <NavCard k="quests" title="Quests" icon={Swords} rows={[["Active quests", activeQuests], ["Completed", state.quests.list.filter(q => (questMPct(q) ?? q.pct) >= 100).length], ["Avg progress", `${questAvg}%`]]} />
          </div>
        </div>
        <div style={{ display: "grid", gap: 16 }}>
          <Panel mon>
            <PHead icon={Clock}>Upcoming Deadlines</PHead>
            <div>
              {deadlines.length ? deadlines.map((u, i) => (
                <div key={i} style={{ padding: "12px 14px", borderBottom: i < deadlines.length - 1 ? "1px solid rgba(84,150,235,.12)" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 10 }}><span style={{ fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</span><span className="mono" style={{ fontSize: 12, color: daysUntil(u.date) < 14 ? "var(--danger)" : "var(--monarch-b)", flex: "0 0 auto" }}>{fmtUntil(daysUntil(u.date))}</span></div><Bar pct={u.pct} />
                </div>
              )) : <div style={{ padding: 18, color: "var(--muted)", fontSize: 14 }}>No upcoming deadlines.</div>}
            </div>
          </Panel>
          <Panel>
            <PHead icon={Trophy}>Long-Term Progress</PHead>
            <div style={{ padding: 16, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>{["E", "D", "C", "B", "A", "S"].map((rk, i) => <React.Fragment key={rk}><span className="mono" style={{ fontSize: 12, color: i <= 4 ? RANK_COLORS[rk] : "var(--muted)" }}>{rk}</span>{i < 5 && <span style={{ color: "var(--muted)" }}>→</span>}</React.Fragment>)}</div>
              {[["Goals & milestones cleared", `${completedCount}`], ["Current streak", `${streak} days`], ["Best streak", `${best} days`], ["Overall completion", `${overallCompletion}%`]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ color: "var(--muted)" }}>{k}</span><span className="mono" style={{ color: "#eaf4ff" }}>{v}</span></div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
function NavCard({ k, title, icon: Ic, rows }) {
  const { dispatch } = useApp();
  return (
    <Panel><PHead icon={Ic}>{title}</PHead>
      <div style={{ padding: "12px 14px" }}>
        {rows.map(([a, b]) => <div key={a} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 14 }}><span style={{ color: "var(--muted)" }}>{a}</span><span className="mono" style={{ color: "#eaf4ff" }}>{b}</span></div>)}
        <div className="mono up" style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, color: "var(--sys-b)", fontSize: 12, cursor: "pointer" }} onClick={() => dispatch({ type: "SET_VIEW", view: k })}>View {title} <ChevronRight size={13} /></div>
      </div>
    </Panel>
  );
}
const questMPct = q => q.milestones.length ? Math.round(q.milestones.filter(m => m.done).length / q.milestones.length * 100) : null;

/* ================= SPIRITUALITY ================= */
function SpiritualityView() {
  const { state, dispatch, notify, openForm } = useApp();
  const { logs } = state;
  const { cats, goals } = state.spirit;
  const [catFilter, setCatFilter] = useState("All");
  const usedCats = cats.filter(c => goals.some(g => g.cat === c));
  const activeFilter = catFilter !== "All" && usedCats.includes(catFilter) ? catFilter : "All";
  const shown = activeFilter === "All" ? goals : goals.filter(g => g.cat === activeFilter);
  const add = () => openForm({ title: "New Spiritual Goal", fields: [
    { name: "title", label: "Goal / Task", required: true, placeholder: "e.g. Read one lesson daily" },
    { name: "cat", label: "Category", type: "customselect", options: cats, required: true },
    { name: "desc", label: "Description", type: "textarea", placeholder: "Optional" },
    { name: "freq", label: "Frequency", type: "select", options: FREQ, default: "Daily" },
    { name: "start", label: "Start date", type: "date" }, { name: "end", label: "End date", type: "date" },
    { name: "reminder", label: "Reminder", type: "toggle", default: "No" },
  ], onSubmit: v => { dispatch({ type: "ADD_SPIRIT", title: v.title, cat: v.cat, freq: v.freq, desc: v.desc }); notify("Spiritual goal created.", "ok"); } });
  const catProg = cats.map(c => { const gs = goals.filter(g => g.cat === c); return { c, n: gs.length, pct: gs.length ? Math.round(gs.reduce((x, g) => x + weekPct(logs, g.id, state.date), 0) / gs.length) : 0 }; }).filter(x => x.n);
  const doneToday = goals.filter(g => isDone(logs, g.id, state.date)).length;
  return (
    <div className="fadeUp" style={{ display: "grid", gap: 16 }}>
      <SectionHead icon={Sparkles} title="Spirituality" sub="You define what it means — the System tracks consistency." action={<button className="sysbtn" onClick={add}><Plus size={13} style={{ verticalAlign: -2 }} /> New Goal</button>} />
      <Panel>
        <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", borderBottom: "1px solid var(--line)" }}>
          <ViewingChip /><span style={{ color: "var(--muted)", fontSize: 14 }}>{doneToday}/{goals.length} completed today · {Math.round(doneToday / (goals.length || 1) * 100)}%</span>
        </div>
        <div className="tabrow">
          <div className={`tab ${activeFilter === "All" ? "on" : ""}`} onClick={() => setCatFilter("All")}>All · {goals.length}</div>
          {usedCats.map(c => <div key={c} className={`tab ${activeFilter === c ? "on" : ""}`} onClick={() => setCatFilter(c)}>{c} · {goals.filter(g => g.cat === c).length}</div>)}
        </div>
      </Panel>
      <div className="grid g-15">
        <div className="auto">
          {shown.map(g => { const st = streakOf(logs, g.id, state.date), lo = longestOf(logs, g.id), wk = weekPct(logs, g.id, state.date), mo = monthPct(logs, g.id, state.date); return (
            <Panel key={g.id}>
              <PHead icon={Sparkles} right={<Trash2 size={14} className="rm" color="var(--danger)" onClick={() => { dispatch({ type: "DEL_SPIRIT", id: g.id }); notify("Goal removed."); }} />}>{g.cat}</PHead>
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 17, marginBottom: 4 }}>{g.title}</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}><Chip>{g.freq}</Chip>{isDone(logs, g.id, state.date) ? <Chip style={{ color: "var(--green)", borderColor: "rgba(72,230,160,.3)" }}>Done</Chip> : <Chip style={{ color: "var(--danger)", borderColor: "rgba(255,90,110,.3)" }}>Pending</Chip>}</div>
                <div className="up" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, marginBottom: 6 }}>Week of {fmtShort(startOfWeek(fromKey(state.date)))} — tap to log</div>
                <WeekStrip id={g.id} />
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 14 }}>
                  <StatCell label="Streak" value={`${st} d`} icon={Flame} />
                  <StatCell label="Longest" value={`${lo} d`} icon={Trophy} color="var(--gold)" />
                  <StatCell label="Weekly" value={`${wk}%`} />
                  <StatCell label="Monthly" value={`${mo}%`} />
                </div>
                <div style={{ marginTop: 12 }}><Bar pct={wk} /></div>
              </div>
            </Panel>
          ); })}
          {!shown.length && <Panel><div style={{ padding: 24, color: "var(--muted)", textAlign: "center" }}>{goals.length ? `No goals in “${activeFilter}”.` : "No goals yet — create your first spiritual practice."}</div></Panel>}
        </div>
        <Panel mon>
          <PHead icon={Target}>Category-Wise Progress</PHead>
          <div style={{ padding: "12px 16px" }}>
            {catProg.map((c, i) => (
              <div key={c.c} onClick={() => setCatFilter(activeFilter === c.c ? "All" : c.c)} style={{ padding: "9px 0", borderBottom: i < catProg.length - 1 ? "1px solid rgba(84,150,235,.1)" : "none", cursor: "pointer", opacity: activeFilter === "All" || activeFilter === c.c ? 1 : .45 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 14 }}><span>{c.c} <span style={{ color: "var(--muted)" }}>· {c.n}</span></span><span className="mono" style={{ color: "var(--sys-b)" }}>{c.pct}%</span></div>
                <Bar pct={c.pct} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ================= FINANCE ================= */
function FinanceView() {
  const { state, dispatch, notify, openForm } = useApp();
  const f = state.finance;
  const loanPaidOf = L => L.term ? L.months.filter(Boolean).length / L.term * L.total : 0;
  const loanTotal = f.loans.reduce((x, L) => x + L.total, 0);
  const loanPaid = f.loans.reduce((x, L) => x + loanPaidOf(L), 0);
  const loanPct = loanTotal ? Math.round(loanPaid / loanTotal * 100) : 0;
  const periodLabel = state.range ? state.range.label : fmtDate(fromKey(state.date));
  const inPeriod = e => state.range ? (e.date >= state.range.from && e.date <= state.range.to) : e.date === state.date;
  const periodExp = f.expenses.filter(inPeriod);
  const monthKey = state.date.slice(0, 7), yearKey = state.date.slice(0, 4);
  const monthSpend = f.expenses.filter(e => e.date.slice(0, 7) === monthKey).reduce((x, e) => x + e.amount, 0);
  const yearSpend = f.expenses.filter(e => e.date.slice(0, 4) === yearKey).reduce((x, e) => x + e.amount, 0);
  const byCat = {}; periodExp.forEach(e => { byCat[e.cat] = (byCat[e.cat] || 0) + e.amount; });
  const addGoal = () => openForm({ title: "New Financial Goal", fields: [
    { name: "c", label: "Title", required: true, placeholder: "e.g. Emergency Fund" },
    { name: "now", label: "Amount saved so far (₹)", type: "number", placeholder: "0" },
    { name: "total", label: "Target amount (₹)", type: "number", required: true, placeholder: "50000" },
    { name: "freq", label: "Frequency", type: "select", options: ["Monthly", "Yearly", "Custom"], default: "Monthly" },
    { name: "start", label: "Start date", type: "date" }, { name: "target", label: "Target date", type: "date" },
  ], onSubmit: v => { dispatch({ type: "ADD_FIN_GOAL", c: v.c, now: v.now, total: v.total, target: v.target, freq: v.freq }); notify("Financial goal added.", "ok"); } });
  const addExpense = () => openForm({ title: "Log Expense", submitLabel: "Add Expense", fields: [
    { name: "title", label: "Title", required: true, placeholder: "e.g. Groceries" },
    { name: "cat", label: "Category", type: "customselect", options: ["Food", "Transport", "Learning", "Bills", "Health", "Leisure"], required: true },
    { name: "amount", label: "Amount (₹)", type: "number", required: true, placeholder: "500" },
  ], onSubmit: v => { dispatch({ type: "ADD_EXPENSE", title: v.title, cat: v.cat, amount: v.amount, date: state.date }); notify("Expense logged for " + fmtShort(fromKey(state.date)) + "."); } });
  const addLoan = () => openForm({ title: "New Loan", fields: [
    { name: "title", label: "Loan name", required: true, placeholder: "e.g. Education Loan" },
    { name: "total", label: "Total amount (₹)", type: "number", required: true, placeholder: "150000" },
    { name: "term", label: "Repayment term (months)", type: "number", required: true, placeholder: "12" },
  ], onSubmit: v => { dispatch({ type: "ADD_LOAN", title: v.title, total: v.total, term: v.term }); notify("Loan added — tap periods to mark paid.", "ok"); } });
  return (
    <div className="fadeUp" style={{ display: "grid", gap: 16 }}>
      <SectionHead icon={Wallet} title="Finance" sub="Personal tracking only — not financial advice." action={<div className="hdr-actions"><button className="sysbtn ghost" onClick={addLoan}><Plus size={13} style={{ verticalAlign: -2 }} /> Loan</button><button className="sysbtn ghost" onClick={addExpense}><Plus size={13} style={{ verticalAlign: -2 }} /> Expense</button><button className="sysbtn" onClick={addGoal}><Plus size={13} style={{ verticalAlign: -2 }} /> Goal</button></div>} />
      <Panel><div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}><ViewingChip /><span style={{ color: "var(--muted)", fontSize: 14 }}>{periodExp.length} expense(s) · {inr(periodExp.reduce((x, e) => x + e.amount, 0))} spent this period</span></div></Panel>
      <div className="auto-sm">
        <BigStat label={`Total loans · ${f.loans.length}`} value={inr(loanTotal)} sub={`${inr(loanPaid)} paid`} />
        <BigStat label="Loan remaining" value={inr(loanTotal - loanPaid)} sub={`${100 - loanPct}% outstanding`} danger />
        <BigStat label="Spent this month" value={inr(monthSpend)} sub={`Year: ${inr(yearSpend)}`} />
        <BigStat label="Budget left" value={inr(Math.max(0, f.monthlyBudget - monthSpend))} sub={monthSpend > f.monthlyBudget ? "over budget" : `of ${inr(f.monthlyBudget)}`} green={monthSpend <= f.monthlyBudget} danger={monthSpend > f.monthlyBudget} />
      </div>
      <div className="grid g-11">
        <Panel>
          <PHead icon={TrendingUp} right={<button className="iconbtn" onClick={addLoan}><Plus size={12} /> Loan</button>}>Loan Repayment · tap a period to mark paid</PHead>
          <div style={{ padding: 16, display: "grid", gap: 18 }}>
            {f.loans.map(L => { const pm = L.months.filter(Boolean).length, pct = Math.round(pm / L.term * 100); return (
              <div key={L.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 10 }}>
                  <div style={{ minWidth: 0 }}><div style={{ fontSize: 15, color: "#eaf4ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{L.title}</div><div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{inr(loanPaidOf(L))} / {inr(L.total)} · {L.term} mo</div></div>
                  <span style={{ display: "flex", gap: 8, alignItems: "center", flex: "0 0 auto" }}><span className="mono" style={{ color: "var(--sys-b)", fontSize: 13 }}>{pm}/{L.term} · {pct}%</span><Trash2 size={13} className="rm" color="var(--danger)" onClick={() => { dispatch({ type: "DEL_LOAN", id: L.id }); notify("Loan removed."); }} /></span>
                </div>
                <div className="loangrid" style={{ marginBottom: 10 }}>
                  {L.months.map((m, i) => (
                    <div key={i} onClick={() => dispatch({ type: "TOGGLE_LOAN", id: L.id, i })} title={`Month ${i + 1}`} style={{ height: 30, border: `1px solid ${m ? "var(--sys)" : "var(--line)"}`, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: m ? "rgba(56,207,255,.14)" : "transparent" }}>{m ? <Check size={12} color="var(--sys)" /> : <span className="mono" style={{ fontSize: 9, color: "var(--muted)" }}>{i + 1}</span>}</div>
                  ))}
                </div>
                <Bar pct={pct} />
              </div>
            ); })}
            {!f.loans.length && <div style={{ color: "var(--muted)", padding: "6px 0" }}>No loans tracked. Use “Loan” to add one.</div>}
          </div>
        </Panel>
        <Panel mon>
          <PHead icon={Target}>Goals & Savings</PHead>
          <div style={{ padding: "12px 16px" }}>
            {f.goals.map((c, i) => { const p = c.total ? Math.round(c.now / c.total * 100) : 0; return (
              <div key={c.id} style={{ padding: "9px 0", borderBottom: i < f.goals.length - 1 ? "1px solid rgba(84,150,235,.1)" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 14 }}><span>{c.c} <span style={{ color: "var(--muted)", fontSize: 12 }}>· {c.target}</span></span><span style={{ display: "flex", gap: 8, alignItems: "center" }}><span className="mono" style={{ color: "var(--sys-b)" }}>{inr(c.now)}/{inr(c.total)}</span><Trash2 size={12} className="rm" color="var(--danger)" onClick={() => dispatch({ type: "DEL_FIN_GOAL", id: c.id })} /></span></div>
                <Bar pct={p} />
              </div>); })}
            {!f.goals.length && <div style={{ color: "var(--muted)", padding: "10px 0" }}>No goals yet.</div>}
          </div>
        </Panel>
      </div>
      <div className="grid g-11">
        <Panel>
          <PHead icon={Wallet} right={<span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{periodLabel}</span>}>Expenses · {periodLabel}</PHead>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {periodExp.map(e => (
              <div key={e.id} className="qrow" style={{ cursor: "default" }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 15 }}>{e.title}</div><div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{e.cat} · {fmtShort(fromKey(e.date))}</div></div>
                <span className="mono" style={{ color: "#eaf4ff" }}>{inr(e.amount)}</span>
                <Trash2 size={13} className="rm" color="var(--danger)" onClick={() => dispatch({ type: "DEL_EXPENSE", id: e.id })} />
              </div>
            ))}
            {!periodExp.length && <div style={{ padding: 16, color: "var(--muted)" }}>No expenses in this period. Use “Expense” to log one on {fmtShort(fromKey(state.date))}.</div>}
          </div>
        </Panel>
        <Panel mon>
          <PHead icon={BarChart3}>Spending by Category</PHead>
          <div style={{ padding: "12px 16px" }}>
            {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, amt], i, arr) => (
              <div key={c} style={{ padding: "8px 0", borderBottom: i < arr.length - 1 ? "1px solid rgba(84,150,235,.1)" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 14 }}><span>{c}</span><span className="mono" style={{ color: "var(--sys-b)" }}>{inr(amt)}</span></div>
                <Bar pct={Math.round(amt / Math.max(...Object.values(byCat), 1) * 100)} />
              </div>
            ))}
            {!Object.keys(byCat).length && <div style={{ color: "var(--muted)", padding: "10px 0" }}>No spending in this period.</div>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ================= FITNESS ================= */
function FitnessView() {
  const { state, dispatch, notify, openForm, setMealModal } = useApp();
  const fit = state.fitness, logs = state.logs;
  const meals = fit.meals[state.date] || [];
  const sum = k => meals.reduce((x, m) => x + (m[k] || 0), 0);
  const editTargets = () => openForm({ title: "Daily Nutrition Targets", submitLabel: "Save", fields: [
    { name: "kcal", label: "Calories", type: "number", default: String(fit.targets.kcal) }, { name: "p", label: "Protein (g)", type: "number", default: String(fit.targets.p) },
    { name: "c", label: "Carbs (g)", type: "number", default: String(fit.targets.c) }, { name: "fib", label: "Fiber (g)", type: "number", default: String(fit.targets.fib) },
  ], onSubmit: v => { dispatch({ type: "SET_TARGETS", ...v }); notify("Targets updated.", "ok"); } });
  const addWorkout = () => openForm({ title: "Add Workout", submitLabel: "Add", fields: [
    { name: "name", label: "Exercise", type: "customselect", options: EXERCISES, required: true }, { name: "part", label: "Target body part", type: "customselect", options: BODY_PARTS, required: true },
    { name: "sets", label: "Sets", type: "number", placeholder: "4" }, { name: "reps", label: "Reps", type: "number", placeholder: "10" },
    { name: "weight", label: "Weight (kg)", type: "number", placeholder: "60" }, { name: "dur", label: "Duration (min, optional)", type: "number", placeholder: "0" },
    { name: "rest", label: "Rest (sec)", type: "number", placeholder: "90" }, { name: "notes", label: "Notes", type: "textarea", placeholder: "Optional" },
  ], onSubmit: v => { dispatch({ type: "ADD_WORKOUT", ...v }); notify("Workout added to plan.", "ok"); } });
  const addMeasure = () => openForm({ title: "Add Measurement", submitLabel: "Save", fields: [
    { name: "name", label: "Measurement", type: "customselect", options: ["Weight", "Chest", "Waist", "Abdomen", "Hips", "Arms", "Thighs", "Calves", "Neck", "Body fat"], required: true },
    { name: "value", label: "Value", type: "number", required: true }, { name: "unit", label: "Unit", type: "select", options: ["kg", "cm", "%"], default: "cm" },
  ], onSubmit: v => { dispatch({ type: "ADD_MEASURE", ...v }); notify("Measurement recorded.", "ok"); } });
  const addPhoto = () => openForm({ title: "Add Progress Picture", submitLabel: "Add", fields: [{ name: "angle", label: "Angle", type: "select", options: ["Front", "Side", "Back"], default: "Front" }], onSubmit: v => { dispatch({ type: "ADD_PHOTO", angle: v.angle }); notify("Progress slot added (private)."); } });
  const doneW = fit.workouts.filter(w => isDone(logs, w.id, state.date)).length;
  const woStreak = useMemo(() => { let s = 0; const anyDone = k => fit.workouts.some(w => isDone(logs, w.id, k)); let start = anyDone(state.date) ? 0 : 1; for (let i = start; i < 120; i++) { if (anyDone(dkey(addDays(fromKey(state.date), -i)))) s++; else break; } return s; }, [logs, fit.workouts, state.date]);
  const weight = fit.measures.find(m => m.name === "Weight");
  return (
    <div className="fadeUp" style={{ display: "grid", gap: 16 }}>
      <SectionHead icon={Dumbbell} title="Fitness" sub="Nutrition, workouts and physical progress — level up the vessel." action={<div className="hdr-actions"><button className="sysbtn ghost" onClick={addWorkout}><Plus size={13} style={{ verticalAlign: -2 }} /> Workout</button><button className="sysbtn" onClick={() => setMealModal(true)}><Plus size={13} style={{ verticalAlign: -2 }} /> Meal</button></div>} />
      <div className="auto-sm">
        <MiniStat icon={Flame} label="Calories today" value={`${sum("kcal")} / ${fit.targets.kcal}`} color="#38cfff" />
        <MiniStat icon={Activity} label="Protein" value={`${sum("p")} / ${fit.targets.p}g`} color="#8b5cff" />
        <MiniStat icon={Dumbbell} label="Workout" value={`${doneW}/${fit.workouts.length} done`} color="var(--green)" />
        <MiniStat icon={Trophy} label="Workout streak" value={`${woStreak} d`} color="var(--gold)" />
      </div>
      <Panel><div style={{ padding: "9px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}><ViewingChip /><span style={{ color: "var(--muted)", fontSize: 14 }}>Showing meals & workouts for {fmtShort(fromKey(state.date))}</span></div></Panel>
      <div className="grid g-12">
        <Panel>
          <PHead icon={Apple} right={<button className="iconbtn" onClick={editTargets}>Edit targets</button>}>Nutrition · {fmtShort(fromKey(state.date))}</PHead>
          <div style={{ display: "flex", justifyContent: "space-around", padding: "18px 12px", flexWrap: "wrap", gap: 12 }}>
            <Ring value={sum("kcal")} max={fit.targets.kcal} unit="" label="Calories" color="#38cfff" />
            <Ring value={sum("p")} max={fit.targets.p} unit="g" label="Protein" color="#8b5cff" />
            <Ring value={sum("c")} max={fit.targets.c} unit="g" label="Carbs" color="#48e6a0" />
            <Ring value={sum("fib")} max={fit.targets.fib} unit="g" label="Fiber" color="#ffcf5c" />
          </div>
          <div style={{ padding: "4px 14px 8px", display: "flex", gap: 14, flexWrap: "wrap", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
            {[["Calories left", Math.max(0, fit.targets.kcal - sum("kcal"))], ["Protein left", Math.max(0, fit.targets.p - sum("p")) + "g"], ["Fat", sum("fat") + "g"]].map(([l, v]) => (
              <div key={l} style={{ padding: "8px 0" }}><div className="up" style={{ fontSize: 9, color: "var(--muted)" }}>{l}</div><div className="mono" style={{ fontSize: 15, color: "#eaf4ff" }}>{v}</div></div>
            ))}
          </div>
          <div style={{ padding: "6px 14px 14px" }}>
            <div className="up" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, margin: "6px 0" }}>Meals · {meals.length}</div>
            {meals.map(m => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", marginBottom: 6, border: "1px solid var(--line)", borderRadius: 2, background: "rgba(56,207,255,.04)" }}>
                <Utensils size={15} color="var(--sys)" style={{ flex: "0 0 auto" }} />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, color: "#eaf4ff" }}>{m.m}</div><div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{m.p}g P · {m.c}g C · {m.fat}g F</div></div>
                <span className="mono" style={{ color: "var(--sys-b)", fontSize: 14, flex: "0 0 auto" }}>{m.kcal} kcal</span>
                <Trash2 size={13} className="rm" color="var(--danger)" onClick={() => dispatch({ type: "DEL_MEAL", date: state.date, id: m.id })} />
              </div>
            ))}
            {!meals.length && <div style={{ color: "var(--muted)", padding: "8px 0", fontSize: 14 }}>No meals logged for {fmtShort(fromKey(state.date))}. Tap “Meal” to add one.</div>}
          </div>
        </Panel>
        <Panel mon>
          <PHead icon={Dumbbell} right={<button className="iconbtn" onClick={addWorkout}><Plus size={12} /> Add</button>}>Workout · {doneW}/{fit.workouts.length} done</PHead>
          <div style={{ padding: 12, display: "grid", gap: 10, maxHeight: 420, overflowY: "auto" }}>
            {fit.workouts.map(w => { const done = isDone(logs, w.id, state.date); return (
              <div key={w.id} style={{ border: `1px solid ${done ? "rgba(72,230,160,.35)" : "var(--line)"}`, borderRadius: 2, background: done ? "rgba(72,230,160,.05)" : "rgba(56,207,255,.03)", padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => dispatch({ type: "TOGGLE_LOG", id: w.id })}>
                  <span className={`qbox ${done ? "done" : ""}`} style={{ background: done ? "var(--green)" : "transparent", borderColor: done ? "var(--green)" : "var(--sys)" }}>{done && <Check size={13} strokeWidth={3} />}</span>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 16, color: done ? "var(--muted)" : "#eaf4ff", textDecoration: done ? "line-through" : "none" }}>{w.name}</div></div>
                  <Chip>{w.part}</Chip>
                  <Trash2 size={13} className="rm" color="var(--danger)" onClick={e => { e.stopPropagation(); dispatch({ type: "DEL_WORKOUT", id: w.id }); }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 10 }}>
                  {[["Sets", w.sets], ["Reps", w.reps], ["Weight", w.weight ? w.weight + "kg" : "—"], [w.dur ? "Duration" : "Rest", w.dur ? w.dur + "min" : w.rest + "s"]].map(([l, v]) => (
                    <div key={l} style={{ textAlign: "center", padding: "6px 2px", border: "1px solid var(--line)", borderRadius: 2 }}><div className="mono" style={{ fontSize: 15, color: "#eaf4ff" }}>{v}</div><div className="up" style={{ fontSize: 8, color: "var(--muted)", letterSpacing: 1 }}>{l}</div></div>
                  ))}
                </div>
                {w.notes && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, fontStyle: "italic" }}>“{w.notes}”</div>}
              </div>
            ); })}
            {!fit.workouts.length && <div style={{ padding: 16, color: "var(--muted)" }}>No workouts planned for this day. Tap “Add”.</div>}
          </div>
        </Panel>
      </div>
      <div className="grid g-12">
        <Panel>
          <PHead icon={TrendingUp}>Bench Press — Strength Progression</PHead>
          <div style={{ padding: 18 }}><LineChart data={fit.bench} color="#8b5cff" /><div className="mono up" style={{ fontSize: 11, color: "var(--green)", letterSpacing: 1.5, marginTop: 8 }}>+15 kg in 4 weeks · new PR</div></div>
        </Panel>
        <Panel mon>
          <PHead icon={Scale} right={<button className="iconbtn" onClick={addMeasure}><Plus size={12} /> Add</button>}>Body Measurements</PHead>
          <div style={{ padding: 14 }}>
            <div className="auto-sm" style={{ gap: 12, marginBottom: 10 }}>
              {fit.measures.map(b => { const first = b.hist[0]?.v ?? b.value, diff = (b.value - first).toFixed(1), down = b.value <= first; return (
                <div key={b.id}><div className="up" style={{ fontSize: 10, color: "var(--muted)" }}>{b.name}</div><div className="mono" style={{ fontSize: 19, color: "#eaf4ff" }}>{b.value}{b.unit}</div><div className="mono" style={{ fontSize: 11, color: down ? "var(--green)" : "#ff8a5c" }}>{down ? "" : "+"}{diff}</div></div>
              ); })}
            </div>
            {weight && <><div className="up" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1, marginBottom: 4 }}>Weight trend</div><LineChart data={weight.hist} color="#38cfff" /></>}
          </div>
        </Panel>
      </div>
      <Panel>
        <PHead icon={Camera} right={<button className="iconbtn" onClick={addPhoto}><Plus size={12} /> Add photo</button>}>Progress Pictures · private to you</PHead>
        <div style={{ display: "flex", gap: 12, padding: 16, overflowX: "auto" }}>
          {fit.photos.map(p => (
            <div key={p.id} style={{ flex: "0 0 auto", width: 110, textAlign: "center" }}>
              <div style={{ height: 140, border: "1px dashed var(--line)", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(56,207,255,.04)" }}><Camera size={26} color="var(--muted)" /></div>
              <div className="mono up" style={{ fontSize: 10, color: "var(--muted)", marginTop: 6, letterSpacing: 1 }}>{p.label} · {p.angle}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ================= LEARNING ================= */
function LearningView() {
  const { state, dispatch, notify, openForm } = useApp();
  const { logs } = state;
  const { cats, goals } = state.learning;
  const add = () => openForm({ title: "New Learning Goal", fields: [
    { name: "title", label: "Title", required: true, placeholder: "e.g. Learn 3D Modeling" },
    { name: "cat", label: "Category", type: "customselect", options: cats, required: true },
    { name: "desc", label: "Description", type: "textarea", placeholder: "Optional" },
    { name: "daysTotal", label: "Duration (days)", type: "number", placeholder: "90" }, { name: "target", label: "Target date", type: "date" },
    { name: "daily", label: "Daily tracking", type: "toggle", default: "Yes" }, { name: "reminder", label: "Reminder", type: "toggle", default: "No" },
  ], onSubmit: v => { dispatch({ type: "ADD_LEARNING", ...v }); notify("Learning goal created.", "ok"); } });
  const catProg = cats.map(c => { const gs = goals.filter(g => g.cat === c); return { c, n: gs.length, pct: gs.length ? Math.round(gs.reduce((x, g) => x + learnPct(logs, g), 0) / gs.length) : 0 }; }).filter(x => x.n);
  return (
    <div className="fadeUp" style={{ display: "grid", gap: 16 }}>
      <SectionHead icon={GraduationCap} title="Learning" sub="You decide what to learn — the System keeps you consistent." action={<button className="sysbtn" onClick={add}><Plus size={13} style={{ verticalAlign: -2 }} /> New Learning</button>} />
      <div className="grid g-15">
        <div className="auto">
          {goals.map((g, idx) => { const done = learnDone(logs, g), pct = learnPct(logs, g), rem = g.daysTotal - done, st = g.daily ? streakOf(logs, g.id, state.date) : 0, lo = g.daily ? longestOf(logs, g.id) : 0, elapsed = clamp(daysBetween(g.start, state.date), 0, g.daysTotal); return (
            <Panel key={g.id} mon={idx === 0}>
              <PHead icon={GraduationCap} right={<Trash2 size={14} className="rm" color="var(--danger)" onClick={() => { dispatch({ type: "DEL_LEARNING", id: g.id }); notify("Learning goal removed."); }} />}>{g.cat}</PHead>
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 17, marginBottom: 4 }}>{g.title}</div>
                <div className="up" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1, marginBottom: 12 }}>Target · {g.target} {g.daily ? "· Daily" : "· Overall"}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}><span className="mono glow-cyan" style={{ fontSize: 28, color: "#eaf4ff" }}>{pct}%</span><span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{done}/{g.daysTotal} days</span></div>
                <Bar pct={pct} />
                {g.daily ? (
                  <div style={{ marginTop: 14 }}>
                    <div className="up" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1, marginBottom: 6 }}>Week of {fmtShort(startOfWeek(fromKey(state.date)))} — tap to log</div>
                    <WeekStrip id={g.id} />
                  </div>
                ) : <div className="mono" style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>Overall tracking · {elapsed}/{g.daysTotal} days elapsed</div>}
                <div style={{ display: "flex", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
                  {g.daily && <StatCell label="Streak" value={`${st} d`} icon={Flame} />}
                  {g.daily && <StatCell label="Longest" value={`${lo} d`} icon={Trophy} color="var(--gold)" />}
                  <StatCell label="Days left" value={rem} icon={Clock} color="var(--sys)" />
                  <StatCell label="Elapsed" value={`${elapsed} d`} icon={Activity} color="var(--monarch-b)" />
                </div>
              </div>
            </Panel>
          ); })}
          {!goals.length && <Panel><div style={{ padding: 24, color: "var(--muted)", textAlign: "center" }}>No learning goals yet — create one to begin.</div></Panel>}
        </div>
        <Panel mon>
          <PHead icon={Target}>Category-Wise Progress</PHead>
          <div style={{ padding: "12px 16px" }}>
            {catProg.map((c, i) => (
              <div key={c.c} style={{ padding: "9px 0", borderBottom: i < catProg.length - 1 ? "1px solid rgba(84,150,235,.1)" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 14 }}><span>{c.c} <span style={{ color: "var(--muted)" }}>· {c.n}</span></span><span className="mono" style={{ color: "var(--sys-b)" }}>{c.pct}%</span></div>
                <Bar pct={c.pct} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ================= QUESTS ================= */
function QuestsView() {
  const { state, dispatch, notify, openForm } = useApp();
  const { logs } = state;
  const { cats, list } = state.quests;
  const [tab, setTab] = useState("active");
  const [sel, setSel] = useState(null);
  const pctOf = q => questMPct(q) ?? (q.daily ? weekPct(logs, q.id, state.date) : q.pct);
  const addQuest = () => openForm({ title: "New Quest", fields: [
    { name: "title", label: "Quest / Goal", required: true, placeholder: "e.g. Run a marathon" },
    { name: "cat", label: "Category", type: "customselect", options: cats, required: true },
    { name: "desc", label: "Description", type: "textarea", placeholder: "Optional" },
    { name: "start", label: "Start date", type: "date" }, { name: "target", label: "Target date", type: "date" },
    { name: "daily", label: "Daily tracking", type: "toggle", default: "No" }, { name: "freq", label: "Frequency", type: "select", options: FREQ, default: "Daily" },
  ], onSubmit: v => { dispatch({ type: "ADD_QUEST", title: v.title, cat: v.cat, daily: v.daily, target: v.target, start: v.start, desc: v.desc }); notify("Quest created — raise it, Player.", "ok"); } });
  const addMs = id => openForm({ title: "Add Milestone", submitLabel: "Add", fields: [{ name: "t", label: "Milestone", required: true, placeholder: "e.g. Build the website" }], onSubmit: v => { dispatch({ type: "ADD_MILESTONE", id, t: v.t }); notify("Milestone added."); } });
  const upcoming = list.filter(q => q.start > TKEY);
  const active = list.filter(q => q.start <= TKEY && pctOf(q) < 100);
  const completed = list.filter(q => q.start <= TKEY && pctOf(q) >= 100);
  const shown = tab === "completed" ? completed : tab === "upcoming" ? upcoming : active;
  const detail = list.find(q => q.id === sel) || list.find(q => q.milestones.length) || list[0];
  const catProg = cats.map(c => { const gs = list.filter(q => q.cat === c); return { c, n: gs.length, pct: gs.length ? Math.round(gs.reduce((x, q) => x + pctOf(q), 0) / gs.length) : 0 }; }).filter(x => x.n);
  return (
    <div className="fadeUp" style={{ display: "grid", gap: 16 }}>
      <SectionHead icon={Swords} title="Quests" sub="If you can define it as a goal, you can raise it as a quest." action={<button className="sysbtn" onClick={addQuest}><Plus size={13} style={{ verticalAlign: -2 }} /> New Quest</button>} />
      <Panel><div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}><ViewingChip /><span style={{ color: "var(--muted)", fontSize: 14 }}>{active.length} active · {completed.length} completed · {upcoming.length} upcoming</span></div></Panel>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)", overflowX: "auto" }}>
        {[["active", `Active (${active.length})`], ["completed", `Completed (${completed.length})`], ["upcoming", `Upcoming (${upcoming.length})`]].map(([k, l]) => <div key={k} className={`tab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{l}</div>)}
      </div>
      <div className="grid g-12">
        <div style={{ display: "grid", gap: 12 }}>
          {shown.map(q => { const p = pctOf(q); return (
            <Panel key={q.id} style={{ cursor: "pointer", borderColor: detail && detail.id === q.id ? "var(--sys)" : undefined }}>
              <div style={{ padding: 16 }} onClick={() => setSel(q.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10 }}>
                  <div style={{ minWidth: 0 }}><div style={{ fontSize: 16 }}>{q.title}</div><div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}><Chip>{q.cat}</Chip>{q.daily && <Chip style={{ color: "var(--monarch-b)", borderColor: "rgba(139,92,255,.3)" }}>Daily</Chip>}{q.milestones.length > 0 && <Chip>{q.milestones.filter(m => m.done).length}/{q.milestones.length} milestones</Chip>}</div></div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flex: "0 0 auto" }}><span className="mono glow-cyan" style={{ fontSize: 22, color: "#eaf4ff" }}>{p}%</span><Trash2 size={13} className="rm" color="var(--danger)" onClick={e => { e.stopPropagation(); dispatch({ type: "DEL_QUEST", id: q.id }); notify("Quest removed."); }} /></div>
                </div>
                <Bar pct={p} />
                <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>{q.start > TKEY ? `Starts ${fmtShort(fromKey(q.start))}` : `Since ${fmtShort(fromKey(q.start))}`} · Target {q.target}{q.daily ? ` · Streak ${streakOf(logs, q.id, state.date)}d` : ""}</div>
                {q.daily && q.start <= TKEY && <div style={{ marginTop: 10 }}><WeekStrip id={q.id} /></div>}
              </div>
            </Panel>
          ); })}
          {!shown.length && <Panel><div style={{ padding: 24, color: "var(--muted)", textAlign: "center" }}>{tab === "upcoming" ? "No upcoming quests." : tab === "completed" ? "No quests completed yet." : "No active quests. Raise a new one."}</div></Panel>}
          <Panel mon>
            <PHead icon={BarChart3}>Category-Wise Progress</PHead>
            <div style={{ padding: "10px 16px" }}>
              {catProg.map((c, i) => (
                <div key={c.c} style={{ padding: "8px 0", borderBottom: i < catProg.length - 1 ? "1px solid rgba(84,150,235,.1)" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 14 }}><span>{c.c} <span style={{ color: "var(--muted)" }}>· {c.n}</span></span><span className="mono" style={{ color: "var(--sys-b)" }}>{c.pct}%</span></div><Bar pct={c.pct} />
                </div>
              ))}
            </div>
          </Panel>
        </div>
        {detail && (
          <Panel mon>
            <PHead icon={Target} right={<button className="iconbtn" onClick={() => addMs(detail.id)}><Plus size={12} /> Milestone</button>}>{detail.title}</PHead>
            <div style={{ padding: 16 }}>
              {detail.desc && <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 12 }}>{detail.desc}</div>}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
                <StatCell label="Progress" value={`${pctOf(detail)}%`} icon={Target} color="var(--sys)" />
                {detail.daily && <StatCell label="Streak" value={`${streakOf(logs, detail.id, state.date)} d`} icon={Flame} />}
                {detail.daily && <StatCell label="Longest" value={`${longestOf(logs, detail.id)} d`} icon={Trophy} color="var(--gold)" />}
                <StatCell label="Target" value={detail.target} icon={Clock} color="var(--monarch-b)" />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><span className="mono" style={{ color: "var(--monarch-b)" }}>Milestones</span><span className="mono" style={{ color: "var(--sys-b)" }}>{detail.milestones.filter(m => m.done).length}/{detail.milestones.length}</span></div>
              {detail.milestones.map((m, i) => (
                <div key={m.id} className={`qrow ${m.done ? "done" : ""}`} onClick={() => dispatch({ type: "TOGGLE_MILESTONE", id: detail.id, mid: m.id })} style={{ borderBottom: i < detail.milestones.length - 1 ? "1px solid rgba(84,150,235,.1)" : "none" }}>
                  <span className={`qbox ${m.done ? "done" : ""}`}>{m.done && <Check size={13} strokeWidth={3} />}</span><span className="qt" style={{ fontSize: 15 }}>{m.t}</span>
                </div>
              ))}
              {!detail.milestones.length && <div style={{ color: "var(--muted)", fontSize: 14, padding: "8px 0" }}>No milestones yet — break this quest into steps.</div>}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

/* ================= ROOT ================= */
export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [user, setUser] = useState(null);
  const [phase, setPhase] = useState("welcome");
  const [users, setUsers] = useState({ "player@system.io": { name: "Sung Jinwoo", email: "player@system.io", password: "arise" } });
  const [modal, setModal] = useState(null);
  const [mealModal, setMealModal] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [menu, setMenu] = useState(false);

  const notify = (msg, type = "info") => { const id = uid(); setToasts(t => [...t, { id, msg, type }]); setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200); };
  const addUser = u => setUsers(m => ({ ...m, [u.email]: u }));
  const openForm = cfg => setModal(cfg);
  const closeModal = () => setModal(null);
  const onAuth = u => { setUser(u); setPhase("app"); notify(`Welcome, ${u.name}.`, "ok"); };
  const logout = () => { setUser(null); setPhase("auth"); setMenu(false); notify("You have logged out."); };
  const ctx = { state, dispatch, notify, openForm, closeModal, modal, mealModal, setMealModal };

  if (phase !== "app") return (<Ctx.Provider value={ctx}><AuthFlow phase={phase} setPhase={setPhase} onAuth={onAuth} users={users} addUser={addUser} /><Toasts toasts={toasts} /></Ctx.Provider>);

  const active = MODULES.find(m => m.key === state.view) || MODULES[0];
  const V = { home: HomeView, spirituality: SpiritualityView, finance: FinanceView, fitness: FitnessView, learning: LearningView, quests: QuestsView }[state.view] || HomeView;

  return (
    <Ctx.Provider value={ctx}>
      <div className="sl-root">
        <style>{CSS}</style>
        <FormModal /><MealModal /><Toasts toasts={toasts} />
        <div style={{ display: "flex", position: "relative", zIndex: 1 }}>
          <aside className="sidebar">
            <div style={{ padding: "20px 16px", borderBottom: "1px solid var(--line)" }}><div className="mono glow-mon" style={{ fontSize: 15, color: "var(--monarch-b)", letterSpacing: 1, lineHeight: 1.1 }}>SYSTEM</div><div className="up" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 2 }}>Dev. Dashboard</div></div>
            <nav style={{ padding: "8px 0" }}>{MODULES.map(m => <div key={m.key} className={`nav-item ${state.view === m.key ? "on" : ""}`} onClick={() => dispatch({ type: "SET_VIEW", view: m.key })}><m.icon size={17} /> {m.label}</div>)}</nav>
            <div style={{ margin: 12, marginTop: 20 }}><Panel style={{ padding: 0 }}><div style={{ padding: 12, textAlign: "center" }}><div className="mono glow-gold" style={{ fontSize: 34, color: "var(--gold)", lineHeight: 1 }}>A</div><div className="up" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 2, margin: "4px 0 8px" }}>Current Rank</div><Bar pct={82} variant="gold" /><div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>82% → S</div></div></Panel></div>
          </aside>

          <main style={{ flex: 1, minWidth: 0 }}>
            <header className="topbar">
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto", minWidth: 0 }}><active.icon size={18} color="var(--sys)" /><span className="mono up" style={{ letterSpacing: 2, color: "#eaf4ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{active.label}</span></div>
              <div style={{ position: "relative", flex: "0 0 auto" }}>
                <div onClick={() => setMenu(m => !m)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", border: "1px solid var(--line)", borderRadius: 2, padding: "5px 10px", background: "rgba(56,207,255,.05)" }}>
                  <div className="mono" style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg,var(--sys),var(--monarch))", display: "flex", alignItems: "center", justifyContent: "center", color: "#05070e", fontWeight: 700 }}>{user?.name?.[0] || "P"}</div>
                  <span className="mono hide-sm" style={{ fontSize: 13, color: "#eaf4ff" }}>{user?.name?.split(" ")[0]}</span>
                </div>
                {menu && (
                  <div className="slideIn" style={{ position: "absolute", right: 0, top: 44, width: 220, zIndex: 30 }}>
                    <Panel><div style={{ padding: 12, borderBottom: "1px solid var(--line)" }}><div className="mono" style={{ fontSize: 14, color: "#eaf4ff" }}>{user?.name}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>{user?.email}</div>{user?.provider && <Chip style={{ marginTop: 6 }}>via {user.provider}</Chip>}</div><div className="nav-item" onClick={logout} style={{ color: "var(--danger)" }}><LogOut size={16} /> Log Out</div></Panel>
                  </div>
                )}
              </div>
            </header>
            <div className="filterbar"><DateBar /></div>
            <div className="main-pad"><V /></div>
          </main>
        </div>

        <nav className="bottomnav">{MODULES.map(m => <div key={m.key} className={`bnav ${state.view === m.key ? "on" : ""}`} onClick={() => dispatch({ type: "SET_VIEW", view: m.key })}><m.icon size={19} /> {m.short}</div>)}</nav>
      </div>
    </Ctx.Provider>
  );
}
