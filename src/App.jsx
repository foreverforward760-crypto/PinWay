import { useState, useEffect, useRef } from "react";

const MCC = [
  { id: "groceries", label: "Groceries", icon: "🛒" },
  { id: "gas", label: "Gas", icon: "⛽" },
  { id: "pharmacy", label: "Pharmacy", icon: "💊" },
  { id: "restaurants", label: "Dining", icon: "🍽" },
  { id: "hotels", label: "Hotels", icon: "🏨" },
  { id: "transport", label: "Transit", icon: "🚌" },
  { id: "atm", label: "ATM", icon: "🏧" },
  { id: "medical", label: "Medical", icon: "🏥" },
  { id: "clothing", label: "Clothing", icon: "👚" },
  { id: "utilities", label: "Utilities", icon: "💡" },
  { id: "education", label: "Education", icon: "📚" },
  { id: "hardware", label: "Hardware", icon: "🔧" },
];

const GEO = [
  { id: "us", label: "US Only", flag: "🇺🇸" },
  { id: "latam", label: "US + LatAm", flag: "🌎" },
  { id: "eu", label: "US + Europe", flag: "🇪🇺" },
  { id: "any", label: "Worldwide", flag: "🌐" },
];

const TEMPLATES = [
  { id: "emergency", name: "Emergency", icon: "🚨", desc: "Groceries, gas, pharmacy, ATM", amount: 200, categories: ["groceries","gas","pharmacy","atm"], geo: "us", maxUses: 10, expirationHours: 24, perTxLimit: 100, dailyLimit: 200 },
  { id: "college", name: "College Kid", icon: "🎓", desc: "Food, transport, education", amount: 150, categories: ["groceries","restaurants","transport","education"], geo: "us", maxUses: 25, expirationHours: 168, perTxLimit: 50, dailyLimit: 75 },
  { id: "travel", name: "Traveler", icon: "✈️", desc: "Hotels, food, ATM - intl", amount: 500, categories: ["hotels","transport","restaurants","atm"], geo: "any", maxUses: 20, expirationHours: 72, perTxLimit: 250, dailyLimit: 500 },
  { id: "caregiver", name: "Caregiver", icon: "🧓", desc: "Pharmacy, groceries, medical", amount: 300, categories: ["pharmacy","groceries","medical","utilities"], geo: "us", maxUses: 15, expirationHours: 168, perTxLimit: 75, dailyLimit: 150 },
  { id: "gig", name: "Gig Payout", icon: "💵", desc: "ATM + gas + food", amount: 250, categories: ["atm","gas","restaurants"], geo: "us", maxUses: 5, expirationHours: 12, perTxLimit: 250, dailyLimit: 250 },
  { id: "disaster", name: "Disaster", icon: "⛑️", desc: "All essentials", amount: 500, categories: ["groceries","gas","pharmacy","atm","medical","hardware","clothing"], geo: "us", maxUses: 30, expirationHours: 168, perTxLimit: 200, dailyLimit: 500 },
];

const CONTACTS = [
  { id: "c1", name: "Maria Stanfield", relation: "Mother", avatar: "👩‍🦳", totalSent: 2400, pinCount: 12 },
  { id: "c2", name: "Carlos Reyes", relation: "Friend", avatar: "👨", totalSent: 850, pinCount: 3 },
  { id: "c3", name: "Jessica Stanfield", relation: "Daughter", avatar: "👩", totalSent: 4200, pinCount: 28 },
  { id: "c4", name: "David Chen", relation: "Contractor", avatar: "👨‍💼", totalSent: 1500, pinCount: 6 },
];

const BLOCKED = [
  { name: "LiquorMart", mcc: "5921", reason: "Alcohol" },
  { name: "CasinoRoyale", mcc: "7995", reason: "Gambling" },
  { name: "VapeShop USA", mcc: "5993", reason: "Tobacco" },
];

const TX = [
  { type: "approved", merchant: "Publix #1247", city: "Tampa, FL", amount: 34.91, lat: 27.95, lng: -82.46 },
  { type: "approved", merchant: "Shell Station", city: "Orlando, FL", amount: 42.15, lat: 28.54, lng: -81.38 },
  { type: "declined", merchant: "Best Buy", city: "Miami, FL", amount: 299.99, lat: 25.76, lng: -80.19, reason: "MCC restricted" },
  { type: "approved", merchant: "CVS Pharmacy", city: "Jacksonville", amount: 18.42, lat: 30.33, lng: -81.66 },
  { type: "declined", merchant: "Amazon.co.uk", city: "London, UK", amount: 84.50, lat: 51.5, lng: -0.13, reason: "Geo restriction" },
  { type: "approved", merchant: "Walmart #5521", city: "Atlanta, GA", amount: 67.33, lat: 33.75, lng: -84.39 },
  { type: "declined", merchant: "Draft Kings", city: "Boston, MA", amount: 50.00, lat: 42.36, lng: -71.06, reason: "Merchant blocked" },
  { type: "approved", merchant: "Uber Trip", city: "New York", amount: 23.45, lat: 40.71, lng: -74.01 },
  { type: "alert", merchant: null, city: null, amount: null, reason: "Balance below 20%" },
  { type: "declined", merchant: "Total Wine", city: "Dallas, TX", amount: 45.99, lat: 32.78, lng: -96.8, reason: "Merchant blocked" },
];

const genPIN = () => Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join("");
const fmt = (p) => p.replace(/(.{4})/g, "$1 ").trim();
const usd = (v) => "$" + Number(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const ago = (d) => { const m = Math.floor((Date.now() - d) / 60000); if (m < 1) return "now"; if (m < 60) return m + "m"; const h = Math.floor(m / 60); return h < 24 ? h + "h" : Math.floor(h / 24) + "d"; };
const pct = (a, b) => Math.min(100, Math.round((a / Math.max(b, 1)) * 100));

function hs(pin) {
  if (pin.status !== "active") return 0;
  let s = 100;
  const bp = (pin.remaining / pin.amount) * 100;
  if (bp < 10) s -= 40; else if (bp < 25) s -= 20; else if (bp < 50) s -= 10;
  const up = ((pin.maxUses - pin.usesLeft) / pin.maxUses) * 100;
  if (up > 90) s -= 30; else if (up > 70) s -= 15;
  const dc = (pin.alerts || []).filter((a) => a.type === "declined").length;
  if (dc > 3) s -= 20; else if (dc > 1) s -= 10;
  return Math.max(0, Math.min(100, s));
}

function Badge({ children, color = "emerald" }) {
  const m = { emerald: "bg-emerald-500/20 text-emerald-400", amber: "bg-amber-500/20 text-amber-400", red: "bg-red-500/20 text-red-400", sky: "bg-sky-500/20 text-sky-400", violet: "bg-violet-500/20 text-violet-400", slate: "bg-slate-600/20 text-slate-400", orange: "bg-orange-500/20 text-orange-400", rose: "bg-rose-500/20 text-rose-400" };
  return <span className={"inline-block px-2 py-0.5 rounded-full text-[10px] font-bold " + (m[color] || m.slate)}>{children}</span>;
}

function Ring({ val = 0, sz = 48, sw = 4, color = "#34d399" }) {
  const r = (sz - sw) / 2, c = 2 * Math.PI * r, o = c - (Math.min(100, Math.max(0, val)) / 100) * c;
  return (
    <svg width={sz} height={sz} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={sz / 2} cy={sz / 2} r={r} fill="none" stroke="#1e293b" strokeWidth={sw} />
      <circle cx={sz / 2} cy={sz / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeDasharray={c} strokeDashoffset={o} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.6s" }} />
    </svg>
  );
}

function QR({ data }) {
  const g = 21, s = 5, cells = [];
  for (let r = 0; r < g; r++) for (let c = 0; c < g; c++) {
    const f = (r < 7 && c < 7) || (r < 7 && c >= g - 7) || (r >= g - 7 && c < 7);
    const inner = f && ((r >= 2 && r <= 4 && c >= 2 && c <= 4) || (r >= 2 && r <= 4 && c >= g - 5 && c <= g - 3) || (r >= g - 5 && r <= g - 3 && c >= 2 && c <= 4));
    const border = f && (r === 0 || r === 6 || c === 0 || c === 6 || r === g - 1 || r === g - 7 || c === g - 1 || c === g - 7);
    const h = (data.charCodeAt(r % data.length) * 31 + data.charCodeAt(c % data.length) * 17 + r * 7 + c * 13) % 100;
    if (f ? (border || inner) : h < 45) cells.push({ r, c });
  }
  return (
    <svg width={g * s + 16} height={g * s + 16} className="mx-auto">
      <rect width={g * s + 16} height={g * s + 16} rx={6} fill="#fff" />
      {cells.map((cell, i) => <rect key={i} x={cell.c * s + 8} y={cell.r * s + 8} width={s - 1} height={s - 1} rx={1} fill="#0f172a" />)}
    </svg>
  );
}

function Toggle({ on, onToggle, color = "bg-emerald-600" }) {
  return (
    <button onClick={onToggle} className={"w-11 h-6 rounded-full transition-all relative shrink-0 " + (on ? color : "bg-slate-700")}>
      <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all" style={{ left: on ? 22 : 2 }} />
    </button>
  );
}

// ==========================================

export default function PinWay() {
  const [view, setView] = useState("home");
  const [sel, setSel] = useState(null);
  const [notif, setNotif] = useState(null);
  const [sosOpen, setSosOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(null);
  const nRef = useRef(null);

  const [pins, setPins] = useState([
    { id: "p1", pin: genPIN(), amount: 200, remaining: 127.18, description: "Mom - groceries & gas", contact: "c1", categories: ["groceries", "gas", "pharmacy"], geo: "us", maxUses: 10, usesLeft: 6, expirationHours: 72, perTxLimit: 75, dailyLimit: 150, createdAt: new Date(Date.now() - 86400000), status: "active", rotate: true, rotateH: 6, lastRot: new Date(Date.now() - 10800000), autoReload: true, scheduled: false, alerts: [
      { type: "approved", merchant: "Publix #1247", city: "Tampa, FL", amount: 34.91, time: new Date(Date.now() - 3600000) },
      { type: "approved", merchant: "BP Gas", city: "Orlando, FL", amount: 37.91, time: new Date(Date.now() - 7200000) },
      { type: "declined", merchant: "Best Buy", city: "Miami, FL", amount: 149.99, time: new Date(Date.now() - 5400000), reason: "MCC restricted" },
    ] },
    { id: "p2", pin: genPIN(), amount: 500, remaining: 500, description: "Carlos - Mexico trip", contact: "c2", categories: ["hotels", "transport", "restaurants", "atm"], geo: "latam", maxUses: 15, usesLeft: 15, expirationHours: 168, perTxLimit: 200, dailyLimit: 400, createdAt: new Date(Date.now() - 14400000), status: "active", rotate: false, rotateH: 12, lastRot: null, autoReload: false, scheduled: false, alerts: [] },
  ]);

  const [alerts, setAlerts] = useState([]);
  const df = { amount: 100, description: "", categories: ["groceries"], geo: "us", maxUses: 5, expirationHours: 24, perTxLimit: 100, dailyLimit: 200, contact: "", rotate: false, rotateH: 6, autoReload: false, scheduled: false, schedInt: "weekly" };
  const [form, setForm] = useState({ ...df });

  // Live sim
  useEffect(() => {
    const iv = setInterval(() => {
      const act = pins.filter((p) => p.status === "active");
      if (!act.length) return;
      const tx = TX[Math.floor(Math.random() * TX.length)];
      const tgt = act[Math.floor(Math.random() * act.length)];
      const a = { ...tx, time: new Date(), pinId: tgt.id, pinDesc: tgt.description };
      setAlerts((prev) => [a, ...prev].slice(0, 60));
      setNotif(a);
      clearTimeout(nRef.current);
      nRef.current = setTimeout(() => setNotif(null), 4000);
    }, 7000);
    return () => clearInterval(iv);
  }, [pins]);

  // Rotation sim
  useEffect(() => {
    const iv = setInterval(() => {
      setPins((prev) => prev.map((p) => {
        if (!p.rotate || p.status !== "active") return p;
        const hrs = p.lastRot ? (Date.now() - p.lastRot.getTime()) / 3600000 : 999;
        return hrs >= p.rotateH ? { ...p, pin: genPIN(), lastRot: new Date() } : p;
      }));
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  const doCreate = () => {
    const n = { id: "p" + Date.now(), pin: genPIN(), amount: form.amount, remaining: form.amount, description: form.description || "Unnamed", contact: form.contact, categories: form.categories, geo: form.geo, maxUses: form.maxUses, usesLeft: form.maxUses, expirationHours: form.expirationHours, perTxLimit: form.perTxLimit, dailyLimit: form.dailyLimit, createdAt: new Date(), status: "active", rotate: form.rotate, rotateH: form.rotateH, lastRot: form.rotate ? new Date() : null, autoReload: form.autoReload, scheduled: form.scheduled, alerts: [] };
    setPins((prev) => [n, ...prev]); setSel(n); setView("detail"); setForm({ ...df });
  };

  const doSOS = () => {
    const t = TEMPLATES[0];
    const n = { id: "e" + Date.now(), pin: genPIN(), amount: t.amount, remaining: t.amount, description: "🚨 EMERGENCY", contact: "", categories: t.categories, geo: t.geo, maxUses: t.maxUses, usesLeft: t.maxUses, expirationHours: t.expirationHours, perTxLimit: t.perTxLimit, dailyLimit: t.dailyLimit, createdAt: new Date(), status: "active", rotate: true, rotateH: 1, lastRot: new Date(), autoReload: false, scheduled: false, alerts: [] };
    setPins((prev) => [n, ...prev]); setSel(n); setSosOpen(false); setView("detail");
  };

  const doRevoke = (id) => { setPins((prev) => prev.map((p) => p.id === id ? { ...p, status: "revoked" } : p)); if (sel && sel.id === id) setSel((s) => ({ ...s, status: "revoked" })); };
  const doFreeze = (id) => { setPins((prev) => prev.map((p) => p.id === id ? { ...p, status: p.status === "frozen" ? "active" : "frozen" } : p)); if (sel && sel.id === id) setSel((s) => ({ ...s, status: s.status === "frozen" ? "active" : "frozen" })); };
  const doRotate = (id) => { const np = genPIN(); setPins((prev) => prev.map((p) => p.id === id ? { ...p, pin: np, lastRot: new Date() } : p)); if (sel && sel.id === id) setSel((s) => ({ ...s, pin: np, lastRot: new Date() })); };
  const applyT = (t) => setForm((f) => ({ ...f, amount: t.amount, categories: t.categories, geo: t.geo, maxUses: t.maxUses, expirationHours: t.expirationHours, perTxLimit: t.perTxLimit, dailyLimit: t.dailyLimit, description: t.name }));
  const togCat = (id) => setForm((f) => ({ ...f, categories: f.categories.includes(id) ? f.categories.filter((c) => c !== id) : [...f.categories, id] }));

  const act = pins.filter((p) => p.status === "active" || p.status === "frozen");
  const tApp = alerts.filter((a) => a.type === "approved").length;
  const tDec = alerts.filter((a) => a.type === "declined").length;

  const hc = (s) => s >= 80 ? "#34d399" : s >= 50 ? "#fbbf24" : "#f87171";
  const htx = (s) => s >= 80 ? "text-emerald-400" : s >= 50 ? "text-amber-400" : "text-red-400";
  const hlbl = (s) => s >= 80 ? "Healthy" : s >= 50 ? "Caution" : "Critical";

  return (
    <div className="min-h-screen text-slate-100 pb-20" style={{ fontFamily: "system-ui, sans-serif", background: "linear-gradient(180deg, #020617, #0a0f1e)" }}>

      {/* Toast */}
      {notif && (
        <div className="fixed top-2 left-2 right-2 z-50">
          <div className={"rounded-xl px-3 py-2.5 shadow-xl border " + (notif.type === "approved" ? "bg-emerald-950/95 border-emerald-700/40" : notif.type === "declined" ? "bg-red-950/95 border-red-700/40" : "bg-amber-950/95 border-amber-700/40")}>
            <div className="flex items-center gap-2">
              <span>{notif.type === "approved" ? "✅" : notif.type === "declined" ? "🚫" : "⚠️"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{notif.type === "approved" ? "Approved" : notif.type === "declined" ? "BLOCKED" : "Alert"}{notif.merchant ? " - " + notif.merchant : ""}</p>
                <p className="text-[10px] opacity-60 truncate">{notif.amount ? usd(notif.amount) : ""} {notif.city || ""}{notif.reason ? " | " + notif.reason : ""}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SOS Overlay */}
      {sosOpen && (
        <div className="fixed inset-0 z-50 bg-red-950/95 flex items-center justify-center p-6" onClick={() => setSosOpen(false)}>
          <div className="text-center max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="text-5xl mb-3">🚨</div>
            <h2 className="text-2xl font-extrabold text-white mb-2">Emergency Mode</h2>
            <p className="text-red-300/80 text-sm mb-6">Instantly create a $200 PIN with groceries, gas, pharmacy, ATM. 24h. Auto-rotates hourly.</p>
            <button onClick={doSOS} className="bg-white text-red-950 font-bold px-6 py-3.5 rounded-2xl text-base w-full">Generate Emergency PIN</button>
            <p className="text-red-500/40 text-xs mt-4" onClick={() => setSosOpen(false)}>Cancel</p>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-6" onClick={() => setShareOpen(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-xs w-full text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-1">Share PIN</h3>
            <p className="text-[11px] text-slate-500 mb-4">Scan QR or type at any terminal</p>
            <QR data={shareOpen.pin} />
            <p className="font-mono text-lg tracking-widest text-white mt-3 font-bold">{fmt(shareOpen.pin)}</p>
            <p className="text-[11px] text-slate-500 mt-1">{shareOpen.description}</p>
            <div className="flex gap-2 mt-5">
              <button className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-bold" onClick={() => setShareOpen(null)}>Copy</button>
              <button className="flex-1 bg-sky-600 text-white py-2.5 rounded-xl text-sm font-bold" onClick={() => setShareOpen(null)}>SMS</button>
            </div>
            <button className="mt-2 text-xs text-slate-600" onClick={() => setShareOpen(null)}>Close</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-600 flex items-center justify-center font-extrabold text-slate-950 text-xs">PW</div>
            <div>
              <h1 className="text-sm font-extrabold text-white leading-none">PinWay</h1>
              <p className="text-[8px] text-slate-600 tracking-widest uppercase">Controlled Payouts</p>
            </div>
          </div>
          <button onClick={() => setSosOpen(true)} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-900/50 border border-red-500/30 text-red-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> SOS
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="px-4 pt-4">

        {/* ====== HOME ====== */}
        {view === "home" && (
          <div>
            <div className="grid grid-cols-3 gap-2 mb-5">
              {[
                { l: "Active", v: act.length, c: "text-emerald-400" },
                { l: "Loaded", v: usd(pins.reduce((s, p) => s + p.amount, 0)), c: "text-sky-400" },
                { l: "Left", v: usd(act.reduce((s, p) => s + p.remaining, 0)), c: "text-amber-400" },
              ].map((s, i) => (
                <div key={i} className="bg-slate-900/60 border border-slate-800/50 rounded-xl p-3 text-center">
                  <p className="text-[9px] text-slate-500 uppercase">{s.l}</p>
                  <p className={"text-lg font-bold " + s.c}>{s.v}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">Your PINs</h2>
              <button onClick={() => setView("create")} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">+ New PIN</button>
            </div>

            <div className="space-y-3">
              {pins.map((p) => {
                const h = hs(p);
                return (
                  <div key={p.id} className="bg-slate-900/60 border border-slate-800/50 rounded-2xl p-4" onClick={() => { setSel(p); setView("detail"); }}>
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        <Ring val={h} sz={44} sw={3.5} color={hc(h)} />
                        <span className={"absolute inset-0 flex items-center justify-center text-[10px] font-bold " + htx(h)}>{h}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-white truncate">{p.description}</p>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          <Badge color={p.status === "active" ? "emerald" : p.status === "frozen" ? "sky" : "red"}>{p.status}</Badge>
                          {p.rotate && <Badge color="violet">Rotating</Badge>}
                          {p.autoReload && <Badge color="amber">Reload</Badge>}
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono tracking-wider mt-1">{fmt(p.pin)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-bold text-white">{usd(p.remaining)}</p>
                        <p className="text-[10px] text-slate-600">of {usd(p.amount)}</p>
                        <div className="w-16 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden ml-auto">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: pct(p.remaining, p.amount) + "%" }} />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2 flex-wrap text-[10px] text-slate-600">
                      <span>🕐 {p.expirationHours}h</span>
                      <span>🔄 {p.usesLeft}/{p.maxUses}</span>
                      <span>{GEO.find((g) => g.id === p.geo)?.flag} {GEO.find((g) => g.id === p.geo)?.label}</span>
                      <span>Max {usd(p.perTxLimit)}/tx</span>
                    </div>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {p.categories.map((c) => {
                        const m = MCC.find((x) => x.id === c);
                        return m ? <span key={c} className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">{m.icon}</span> : null;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ====== CREATE ====== */}
        {view === "create" && (
          <div>
            <h2 className="text-lg font-bold mb-1">Create PIN</h2>
            <p className="text-xs text-slate-500 mb-4">Set every rule. Recipient just types the number.</p>

            <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-2">Templates</p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => applyT(t)} className={"text-left p-3 rounded-xl border transition-all " + (form.description === t.name ? "bg-slate-800 border-emerald-500/40" : "bg-slate-900/50 border-slate-800/50")}>
                  <span className="text-lg">{t.icon}</span>
                  <p className="text-xs font-bold text-white mt-1">{t.name}</p>
                  <p className="text-[10px] text-slate-500">{t.desc}</p>
                  <p className="text-[10px] text-emerald-500 font-bold mt-0.5">{usd(t.amount)}</p>
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Amount</label>
                <div className="flex gap-1.5 mb-2">{[50, 100, 200, 500, 1000].map((a) => (
                  <button key={a} onClick={() => setForm((f) => ({ ...f, amount: a }))} className={"flex-1 py-2 rounded-lg text-xs font-bold border " + (form.amount === a ? "bg-emerald-600 border-emerald-500 text-white" : "bg-slate-900 border-slate-700 text-slate-500")}>
                    ${a}
                  </button>
                ))}</div>
                <input type="range" min={10} max={2000} step={10} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: +e.target.value }))} className="w-full accent-emerald-500" />
                <p className="text-center text-lg font-bold text-emerald-400">{usd(form.amount)}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Label</label>
                <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Mom - groceries" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Categories ({form.categories.length})</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {MCC.map((cat) => (
                    <button key={cat.id} onClick={() => togCat(cat.id)} className={"flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] border " + (form.categories.includes(cat.id) ? "bg-emerald-900/30 border-emerald-500/40 text-emerald-300" : "bg-slate-900/50 border-slate-800/50 text-slate-500")}>
                      <span>{cat.icon}</span><span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Geo Lock</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {GEO.map((g) => (
                    <button key={g.id} onClick={() => setForm((f) => ({ ...f, geo: g.id }))} className={"flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border " + (form.geo === g.id ? "bg-sky-900/30 border-sky-500/40 text-sky-300" : "bg-slate-900/50 border-slate-800/50 text-slate-500")}>
                      <span>{g.flag}</span><span>{g.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 space-y-3">
                <p className="text-[10px] text-slate-600 uppercase tracking-widest">Velocity Controls</p>
                <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Per-Transaction</span><span className="text-white font-bold">{usd(form.perTxLimit)}</span></div>
                  <input type="range" min={10} max={form.amount} step={10} value={form.perTxLimit} onChange={(e) => setForm((f) => ({ ...f, perTxLimit: +e.target.value }))} className="w-full accent-sky-500" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Daily Limit</span><span className="text-white font-bold">{usd(form.dailyLimit)}</span></div>
                  <input type="range" min={10} max={form.amount} step={10} value={form.dailyLimit} onChange={(e) => setForm((f) => ({ ...f, dailyLimit: +e.target.value }))} className="w-full accent-amber-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Expires</label>
                  <select value={form.expirationHours} onChange={(e) => setForm((f) => ({ ...f, expirationHours: +e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white">
                    {[1, 6, 12, 24, 48, 72, 168, 720].map((h) => <option key={h} value={h}>{h < 24 ? h + "h" : h < 168 ? (h / 24) + "d" : h === 168 ? "1 wk" : "30d"}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Max Uses</label>
                  <select value={form.maxUses} onChange={(e) => setForm((f) => ({ ...f, maxUses: +e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white">
                    {[1, 3, 5, 10, 25, 99].map((u) => <option key={u} value={u}>{u === 99 ? "Unlimited" : u}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 space-y-4">
                <p className="text-[10px] text-slate-600 uppercase tracking-widest">Advanced</p>
                <div className="flex items-center justify-between">
                  <div><p className="text-xs font-semibold text-white">🔄 PIN Rotation</p><p className="text-[10px] text-slate-500">Auto-generates new number</p></div>
                  <Toggle on={form.rotate} onToggle={() => setForm((f) => ({ ...f, rotate: !f.rotate }))} />
                </div>
                {form.rotate && <select value={form.rotateH} onChange={(e) => setForm((f) => ({ ...f, rotateH: +e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white">{[1, 3, 6, 12, 24].map((h) => <option key={h} value={h}>Every {h}h</option>)}</select>}
                <div className="flex items-center justify-between">
                  <div><p className="text-xs font-semibold text-white">🔋 Auto-Reload Alert</p><p className="text-[10px] text-slate-500">Notify on low balance</p></div>
                  <Toggle on={form.autoReload} onToggle={() => setForm((f) => ({ ...f, autoReload: !f.autoReload }))} color="bg-amber-600" />
                </div>
                <div className="flex items-center justify-between">
                  <div><p className="text-xs font-semibold text-white">📅 Recurring</p><p className="text-[10px] text-slate-500">Auto-create on schedule</p></div>
                  <Toggle on={form.scheduled} onToggle={() => setForm((f) => ({ ...f, scheduled: !f.scheduled }))} color="bg-violet-600" />
                </div>
                {form.scheduled && <select value={form.schedInt} onChange={(e) => setForm((f) => ({ ...f, schedInt: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="biweekly">Bi-weekly</option><option value="monthly">Monthly</option></select>}
              </div>

              <button onClick={doCreate} disabled={form.categories.length === 0} className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 text-white py-3.5 rounded-2xl font-extrabold text-sm disabled:opacity-20">Generate Secure PIN</button>
            </div>
          </div>
        )}

        {/* ====== DETAIL ====== */}
        {view === "detail" && sel && (() => {
          const p = pins.find((x) => x.id === sel.id) || sel;
          const h = hs(p);
          return (
            <div>
              <button onClick={() => setView("home")} className="text-xs text-slate-500 mb-3 block">{"<"}- Back</button>
              <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl overflow-hidden">
                <div className="bg-gradient-to-br from-emerald-950/80 to-cyan-950/40 px-5 py-5 text-center relative">
                  <div className="absolute top-3 left-3">
                    <div className="relative"><Ring val={h} sz={38} sw={3} color={hc(h)} /><span className={"absolute inset-0 flex items-center justify-center text-[9px] font-bold " + htx(h)}>{h}</span></div>
                  </div>
                  <div className="absolute top-3 right-3 flex gap-1">
                    <Badge color={p.status === "active" ? "emerald" : p.status === "frozen" ? "sky" : "red"}>{p.status}</Badge>
                    {p.rotate && <Badge color="violet">Rotating</Badge>}
                  </div>
                  <p className="text-xs text-emerald-400/60 mb-1 mt-1">{p.description}</p>
                  <p className="font-mono text-xl tracking-widest text-white font-bold">{fmt(p.pin)}</p>
                  {p.rotate && <p className="text-[10px] text-teal-400/50 mt-1">🔄 Every {p.rotateH}h</p>}
                  <button onClick={() => setShareOpen(p)} className="mt-3 bg-white/10 border border-white/10 text-white text-xs px-4 py-1.5 rounded-xl">Share QR / SMS</button>
                </div>

                <div className="px-5 py-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/40 rounded-xl p-3">
                      <p className="text-[10px] text-slate-500">Balance</p>
                      <p className="text-lg font-bold text-emerald-400">{usd(p.remaining)}</p>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full mt-1"><div className="h-full bg-emerald-500 rounded-full" style={{ width: pct(p.remaining, p.amount) + "%" }} /></div>
                      <p className="text-[10px] text-slate-600 mt-0.5">{pct(p.remaining, p.amount)}% of {usd(p.amount)}</p>
                    </div>
                    <div className="bg-slate-800/40 rounded-xl p-3">
                      <p className="text-[10px] text-slate-500">Uses Left</p>
                      <p className="text-lg font-bold text-sky-400">{p.usesLeft}<span className="text-xs text-slate-500">/{p.maxUses}</span></p>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full mt-1"><div className="h-full bg-sky-500 rounded-full" style={{ width: pct(p.usesLeft, p.maxUses) + "%" }} /></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-800/30 rounded-lg py-2"><p className="text-[9px] text-slate-500">Per-Tx</p><p className="text-xs font-bold">{usd(p.perTxLimit)}</p></div>
                    <div className="bg-slate-800/30 rounded-lg py-2"><p className="text-[9px] text-slate-500">Daily</p><p className="text-xs font-bold">{usd(p.dailyLimit)}</p></div>
                    <div className="bg-slate-800/30 rounded-lg py-2"><p className="text-[9px] text-slate-500">Expires</p><p className="text-xs font-bold">{p.expirationHours}h</p></div>
                  </div>

                  <div className="flex justify-between text-xs"><span className="text-slate-500">Geo</span><span>{GEO.find((g) => g.id === p.geo)?.flag} {GEO.find((g) => g.id === p.geo)?.label}</span></div>

                  <div className="flex gap-1 flex-wrap">
                    {p.categories.map((c) => { const m = MCC.find((x) => x.id === c); return m ? <span key={c} className="text-[10px] bg-emerald-900/20 border border-emerald-800/30 px-2 py-0.5 rounded-lg text-emerald-400">{m.icon} {m.label}</span> : null; })}
                  </div>
                </div>

                {p.alerts.length > 0 && (
                  <div className="border-t border-slate-800/50 px-5 py-3">
                    <p className="text-[10px] text-slate-600 uppercase mb-2">Log</p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {p.alerts.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span>{a.type === "approved" ? "✅" : "🚫"}</span>
                          <span className="text-slate-400 flex-1 truncate">{a.merchant}</span>
                          <span className={a.type === "approved" ? "text-emerald-400" : "text-red-400"}>{a.amount ? usd(a.amount) : ""}</span>
                          <span className="text-slate-700 text-[10px]">{ago(a.time)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-800/50 px-5 py-3 grid grid-cols-2 gap-2">
                  <button onClick={() => doRotate(p.id)} className="bg-violet-900/30 border border-violet-500/20 text-violet-300 py-2 rounded-xl text-xs font-bold">🔄 Rotate</button>
                  <button onClick={() => doFreeze(p.id)} className="bg-sky-900/30 border border-sky-500/20 text-sky-300 py-2 rounded-xl text-xs font-bold">{p.status === "frozen" ? "☀️ Unfreeze" : "❄️ Freeze"}</button>
                  <button onClick={() => setShareOpen(p)} className="bg-slate-800 border border-slate-700 text-slate-300 py-2 rounded-xl text-xs font-bold">📤 Share</button>
                  {p.status !== "revoked" && <button onClick={() => doRevoke(p.id)} className="bg-red-900/30 border border-red-500/20 text-red-300 py-2 rounded-xl text-xs font-bold">🛑 Revoke</button>}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ====== ANALYTICS ====== */}
        {view === "analytics" && (
          <div>
            <h2 className="text-lg font-bold mb-4">Analytics</h2>
            <div className="space-y-3">
              <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4">
                <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-3">Approval Rate</p>
                <div className="flex items-center justify-center gap-5">
                  <div className="relative"><Ring val={alerts.length > 0 ? pct(tApp, Math.max(tApp + tDec, 1)) : 75} sz={70} sw={5} color="#34d399" /><span className="absolute inset-0 flex items-center justify-center text-base font-bold text-emerald-400">{alerts.length > 0 ? pct(tApp, Math.max(tApp + tDec, 1)) : 75}%</span></div>
                  <div className="space-y-1 text-xs"><p className="text-emerald-400">✅ {tApp} approved</p><p className="text-red-400">🚫 {tDec} blocked</p><p className="text-amber-400">⚠️ {alerts.filter((a) => a.type === "alert").length} alerts</p></div>
                </div>
              </div>
              <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4">
                <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-3">PIN Health</p>
                <div className="space-y-3">{pins.map((p) => { const h = hs(p); return (<div key={p.id} className="flex items-center gap-3"><div className="relative shrink-0"><Ring val={h} sz={34} sw={3} color={hc(h)} /><span className={"absolute inset-0 flex items-center justify-center text-[9px] font-bold " + htx(h)}>{h}</span></div><div className="flex-1 min-w-0"><p className="text-xs font-semibold truncate">{p.description}</p><p className="text-[10px] text-slate-500">{usd(p.remaining)} left</p></div><Badge color={h >= 80 ? "emerald" : h >= 50 ? "amber" : "red"}>{hlbl(h)}</Badge></div>); })}</div>
              </div>
            </div>
          </div>
        )}

        {/* ====== CONTACTS ====== */}
        {view === "contacts" && (
          <div>
            <h2 className="text-lg font-bold mb-4">Recipients</h2>
            <div className="space-y-3">{CONTACTS.map((c) => (
              <div key={c.id} className="bg-slate-900/60 border border-slate-800/50 rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3"><span className="text-2xl">{c.avatar}</span><div><p className="font-bold text-sm">{c.name}</p><p className="text-[10px] text-slate-500">{c.relation}</p></div></div>
                <div className="grid grid-cols-2 gap-2 mb-3"><div className="bg-slate-800/40 rounded-lg p-2 text-center"><p className="text-[9px] text-slate-500">Total Sent</p><p className="text-sm font-bold text-emerald-400">{usd(c.totalSent)}</p></div><div className="bg-slate-800/40 rounded-lg p-2 text-center"><p className="text-[9px] text-slate-500">PINs</p><p className="text-sm font-bold text-sky-400">{c.pinCount}</p></div></div>
                <button onClick={() => { setForm((f) => ({ ...f, contact: c.id, description: c.name.split(" ")[0] + " - " })); setView("create"); }} className="w-full bg-slate-800 border border-slate-700 text-slate-300 py-2 rounded-xl text-xs font-semibold">+ Send PIN</button>
              </div>
            ))}</div>
          </div>
        )}

        {/* ====== ALERTS ====== */}
        {view === "alerts" && (
          <div>
            <h2 className="text-lg font-bold mb-1">Live Feed</h2>
            <p className="text-xs text-slate-500 mb-4">Real-time alerts (~7s)</p>
            {alerts.length === 0 ? <div className="text-center py-12 text-slate-600"><p className="text-3xl mb-2">🔔</p><p className="text-sm">Waiting for transactions...</p></div> : (
              <div className="space-y-1.5">{alerts.map((a, i) => (
                <div key={i} className={"flex items-center gap-2 px-3 py-2 rounded-xl border " + (a.type === "approved" ? "bg-emerald-950/20 border-emerald-900/20" : a.type === "declined" ? "bg-red-950/20 border-red-900/20" : "bg-amber-950/20 border-amber-900/20")}>
                  <span>{a.type === "approved" ? "✅" : a.type === "declined" ? "🚫" : "⚠️"}</span>
                  <div className="flex-1 min-w-0"><p className="text-xs font-semibold truncate">{a.merchant || a.reason}</p><p className="text-[10px] text-slate-500 truncate">{a.city || ""}{a.reason ? " | " + a.reason : ""}</p></div>
                  <div className="text-right shrink-0">{a.amount && <p className={"text-xs font-bold " + (a.type === "approved" ? "text-emerald-400" : "text-red-400")}>{usd(a.amount)}</p>}<p className="text-[10px] text-slate-600">{ago(a.time)}</p></div>
                </div>
              ))}</div>
            )}
          </div>
        )}

        {/* ====== SECURITY ====== */}
        {view === "security" && (
          <div>
            <h2 className="text-lg font-bold mb-4">Security</h2>
            <div className="space-y-3">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-sm font-bold mb-2">🚫 Merchant Blocklist</h3>
                <p className="text-[10px] text-slate-500 mb-3">Auto-declined on ALL PINs</p>
                <div className="space-y-2">{BLOCKED.map((m, i) => (<div key={i} className="flex items-center justify-between bg-red-950/20 border border-red-900/20 rounded-xl px-3 py-2"><div><p className="text-xs font-semibold">{m.name}</p><p className="text-[10px] text-slate-500">{m.reason}</p></div><Badge color="red">Blocked</Badge></div>))}</div>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-sm font-bold mb-2">🔄 Rotation Status</h3>
                <div className="space-y-2">{pins.filter((p) => p.status === "active").map((p) => (<div key={p.id} className="flex items-center justify-between bg-slate-800/40 rounded-xl px-3 py-2"><div className="flex-1 min-w-0"><p className="text-xs font-semibold truncate">{p.description}</p><p className="text-[10px] text-slate-500 font-mono">{fmt(p.pin)}</p></div>{p.rotate ? <Badge color="violet">Every {p.rotateH}h</Badge> : <Badge color="slate">Static</Badge>}</div>))}</div>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-sm font-bold mb-2">🛡️ Threats</h3>
                <div className="grid grid-cols-2 gap-2">{[{ l: "Blocked", v: tDec, c: "text-red-400" }, { l: "Geo Violations", v: alerts.filter((a) => a.reason && a.reason.includes("Geo")).length, c: "text-amber-400" }, { l: "MCC Violations", v: alerts.filter((a) => a.reason && a.reason.includes("MCC")).length, c: "text-orange-400" }, { l: "Merchant Blocks", v: alerts.filter((a) => a.reason && a.reason.includes("Merchant")).length, c: "text-rose-400" }].map((s, i) => (<div key={i} className="bg-slate-800/40 rounded-xl p-3 text-center"><p className={"text-xl font-bold " + s.c}>{s.v}</p><p className="text-[10px] text-slate-500">{s.l}</p></div>))}</div>
              </div>
            </div>
          </div>
        )}

        {/* ====== DEMO ====== */}
        {view === "demo" && (
          <div className="text-center">
            <h2 className="text-lg font-bold mb-1">Recipient Side</h2>
            <p className="text-xs text-slate-500 mb-5"><span className="text-emerald-400 font-bold">ZERO tech needed</span></p>

            <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-5 mb-4">
              <div className="bg-slate-800 rounded-xl p-4 mb-3 border border-slate-700">
                <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Payment Terminal</p>
                <p className="text-slate-400 text-xs mb-2">Enter card number:</p>
                <div className="bg-slate-950 rounded-lg p-3 font-mono text-base tracking-widest text-emerald-400 border border-slate-600">{fmt(pins[0]?.pin || "4829105637284916")}</div>
              </div>
              <div className="bg-emerald-900/30 border border-emerald-500/20 rounded-xl p-3">
                <p className="text-emerald-400 font-extrabold">✅ APPROVED</p>
                <p className="text-[11px] text-emerald-300/60 mt-1">$47.82 at Publix - Tampa, FL</p>
                <div className="flex justify-center gap-1.5 mt-2"><Badge color="emerald">Groceries OK</Badge><Badge color="emerald">US OK</Badge></div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 mb-5">
              <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-3">
                <p className="text-red-400 font-extrabold">🚫 DECLINED</p>
                <p className="text-[11px] text-red-300/60 mt-1">$299.99 at Best Buy</p>
                <div className="flex justify-center gap-1.5 mt-2"><Badge color="red">Electronics blocked</Badge></div>
              </div>
            </div>

            <div className="space-y-2 text-left">
              {[
                { i: "📱", t: "No app needed", d: "Just type 16 digits at any prepaid terminal." },
                { i: "🌐", t: "45M+ merchant locations", d: "Works everywhere Visa/MC prepaid is accepted." },
                { i: "🔒", t: "Invisible security", d: "MCC, geo, velocity, blocklist - all server-side." },
                { i: "⚡", t: "Real-time control", d: "Revoke, freeze, rotate, reload instantly." },
                { i: "👨‍👩‍👧‍👦", t: "Built for real life", d: "Parents, caregivers, travelers, gig, disaster relief." },
              ].map((f, i) => (
                <div key={i} className="flex items-start gap-3 bg-slate-900/40 rounded-xl p-3 border border-slate-800/40">
                  <span className="text-lg">{f.i}</span>
                  <div><p className="text-xs font-bold text-white">{f.t}</p><p className="text-[10px] text-slate-500">{f.d}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/50 px-2 py-1.5 flex justify-around">
        {[
          { id: "home", icon: "🏠", label: "Home" },
          { id: "create", icon: "➕", label: "New" },
          { id: "analytics", icon: "📈", label: "Stats" },
          { id: "contacts", icon: "👥", label: "People" },
          { id: "alerts", icon: "🔔", label: "Alerts" },
          { id: "security", icon: "🛡️", label: "Security" },
          { id: "demo", icon: "📱", label: "Demo" },
        ].map((t) => (
          <button key={t.id} onClick={() => setView(t.id)} className={"flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-all " + (view === t.id ? "text-emerald-400" : "text-slate-600")}>
            <span className="text-base">{t.icon}</span>
            <span className="text-[9px] font-medium">{t.label}</span>
          </button>
        ))}
      </nav>

      <div className="h-4" />
      <footer className="text-center text-[9px] text-slate-800 pb-16 px-4">
        {"PinWay\u2122 \u2014 Patent Pending \u2014 \u00A9 " + new Date().getFullYear() + " Richard Stanfield / Meridian Axiom Alignment Technologies LLC"}
      </footer>
    </div>
  );
}
