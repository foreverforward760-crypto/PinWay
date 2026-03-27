import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "./context/AuthContext";
import { pins as pinsApi, transactions as txApi, contacts as contactsApi } from "./services/api";

// ─── Constants ────────────────────────────────────────────────────────────────
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

// ─── Utilities ────────────────────────────────────────────────────────────────
const fmt = (p) => p.replace(/(.{4})/g, "$1 ").trim();
const usd = (v) => "$" + Number(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const ago = (d) => { const m = Math.floor((Date.now() - new Date(d)) / 60000); if (m < 1) return "now"; if (m < 60) return m + "m"; const h = Math.floor(m / 60); return h < 24 ? h + "h" : Math.floor(h / 24) + "d"; };

// ─── UI Components ────────────────────────────────────────────────────────────
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PinWay() {
  const { user, logout } = useAuth();
  const [view, setView] = useState("home");
  const [sel, setSel] = useState(null);
  const [notif, setNotif] = useState(null);
  const [sosOpen, setSosOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const nRef = useRef(null);
  const lastTxRef = useRef(null);

  // Real data state
  const [pins, setPins] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [pinsLoading, setPinsLoading] = useState(true);

  const df = { amount: 100, description: "", categories: ["groceries"], geo: "us", maxUses: 5, expirationHours: 24, perTxLimit: 100, dailyLimit: 200, contactId: "", rotate: false, rotateH: 6, autoReload: false, deliveryMethod: "none" };
  const [form, setForm] = useState({ ...df });

  // ─── Load initial data ──────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      pinsApi.list(),
      contactsApi.list(),
      txApi.list({ limit: 50 }),
    ])
      .then(([pinsData, contactsData, txData]) => {
        // Normalise field names from DB snake_case → camelCase for UI compat
        setPins(pinsData.map(normalizePin));
        setContacts(contactsData);
        setAlerts(txData.map(normalizeTx));
        if (txData.length) lastTxRef.current = txData[0].created_at;
      })
      .catch((err) => setApiError(err.message))
      .finally(() => setPinsLoading(false));
  }, []);

  // ─── Poll for new transactions ──────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const fresh = await txApi.list({ limit: 20 });
        if (!fresh.length) return;
        const newest = fresh[0].created_at;
        if (newest !== lastTxRef.current) {
          const newOnes = lastTxRef.current
            ? fresh.filter((t) => new Date(t.created_at) > new Date(lastTxRef.current))
            : [];
          if (newOnes.length) {
            const a = normalizeTx(newOnes[0]);
            setAlerts((prev) => [a, ...newOnes.map(normalizeTx), ...prev].slice(0, 60));
            setNotif(a);
            clearTimeout(nRef.current);
            nRef.current = setTimeout(() => setNotif(null), 4000);
          }
          lastTxRef.current = newest;
        }
      } catch {}
    }, 10000);
    return () => clearInterval(iv);
  }, []);

  // ─── Field normalisation ────────────────────────────────────────────────────
  function normalizePin(p) {
    return {
      id: p.id,
      pin: p.pin || null,          // Only present right after creation
      amount: parseFloat(p.amount),
      remaining: parseFloat(p.remaining_amount ?? p.amount),
      description: p.description,
      contact: p.contact_id,
      contactName: p.contact_name,
      categories: typeof p.categories === "string" ? JSON.parse(p.categories) : (p.categories || []),
      geo: p.geo_restriction ?? p.geo,
      maxUses: p.max_uses,
      usesLeft: p.uses_left,
      expirationHours: p.expiration_hours ?? 24,
      perTxLimit: parseFloat(p.per_tx_limit),
      dailyLimit: parseFloat(p.daily_limit),
      createdAt: new Date(p.created_at),
      expiresAt: p.expires_at ? new Date(p.expires_at) : null,
      status: p.status,
      rotate: p.rotate_enabled ?? false,
      rotateH: p.rotate_hours ?? 6,
      lastRot: p.last_rotated_at ? new Date(p.last_rotated_at) : null,
      autoReload: p.auto_reload ?? false,
      healthScore: p.health_score ?? 100,
      declineCount: parseInt(p.decline_count || 0),
    };
  }

  function normalizeTx(t) {
    return {
      type: t.type,
      merchant: t.merchant_name,
      city: t.merchant_city,
      amount: t.amount ? parseFloat(t.amount) : null,
      reason: t.reason,
      time: new Date(t.created_at),
      pinId: t.pin_id,
      pinDesc: t.pin_description,
    };
  }

  // ─── Actions ────────────────────────────────────────────────────────────────
  const doCreate = async () => {
    setApiLoading(true);
    setApiError(null);
    try {
      const payload = {
        amount: parseFloat(form.amount),
        description: form.description || "Unnamed",
        categories: form.categories,
        geo: form.geo,
        maxUses: parseInt(form.maxUses),
        expirationHours: parseInt(form.expirationHours),
        perTxLimit: parseFloat(form.perTxLimit),
        dailyLimit: parseFloat(form.dailyLimit),
        contactId: form.contactId || undefined,
        deliveryMethod: form.deliveryMethod,
        autoReload: form.autoReload,
        rotate: form.rotate,
        rotateHours: parseInt(form.rotateH),
      };
      const created = await pinsApi.create(payload);
      const n = normalizePin(created);
      setPins((prev) => [n, ...prev]);
      setSel(n);
      setView("detail");
      setForm({ ...df });
    } catch (err) {
      setApiError(err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const doSOS = async () => {
    setApiLoading(true);
    try {
      const t = TEMPLATES[0];
      const created = await pinsApi.create({
        amount: t.amount,
        description: "🚨 EMERGENCY",
        categories: t.categories,
        geo: t.geo,
        maxUses: t.maxUses,
        expirationHours: t.expirationHours,
        perTxLimit: t.perTxLimit,
        dailyLimit: t.dailyLimit,
        rotate: true,
        rotateHours: 1,
      });
      const n = normalizePin(created);
      setPins((prev) => [n, ...prev]);
      setSel(n);
      setSosOpen(false);
      setView("detail");
    } catch (err) {
      setApiError(err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const doRevoke = useCallback(async (id) => {
    try {
      await pinsApi.revoke(id);
      setPins((prev) => prev.map((p) => p.id === id ? { ...p, status: "revoked" } : p));
      if (sel?.id === id) setSel((s) => ({ ...s, status: "revoked" }));
    } catch (err) {
      setApiError(err.message);
    }
  }, [sel]);

  const doFreeze = useCallback(async (id) => {
    try {
      const result = await pinsApi.freeze(id);
      setPins((prev) => prev.map((p) => p.id === id ? { ...p, status: result.status } : p));
      if (sel?.id === id) setSel((s) => ({ ...s, status: result.status }));
    } catch (err) {
      setApiError(err.message);
    }
  }, [sel]);

  const doRotate = useCallback(async (id) => {
    try {
      const result = await pinsApi.rotate(id);
      setPins((prev) => prev.map((p) => p.id === id ? { ...p, pin: result.pin, lastRot: new Date(result.rotated_at) } : p));
      if (sel?.id === id) setSel((s) => ({ ...s, pin: result.pin, lastRot: new Date(result.rotated_at) }));
    } catch (err) {
      setApiError(err.message);
    }
  }, [sel]);

  const applyT = (t) => setForm((f) => ({ ...f, amount: t.amount, categories: t.categories, geo: t.geo, maxUses: t.maxUses, expirationHours: t.expirationHours, perTxLimit: t.perTxLimit, dailyLimit: t.dailyLimit, description: t.name }));
  const togCat = (id) => setForm((f) => ({ ...f, categories: f.categories.includes(id) ? f.categories.filter((c) => c !== id) : [...f.categories, id] }));

  // ─── Derived state ──────────────────────────────────────────────────────────
  const act = pins.filter((p) => p.status === "active" || p.status === "frozen");
  const tApp = alerts.filter((a) => a.type === "approved").length;
  const tDec = alerts.filter((a) => a.type === "declined").length;
  const hc = (s) => s >= 80 ? "#34d399" : s >= 50 ? "#fbbf24" : "#f87171";
  const htx = (s) => s >= 80 ? "text-emerald-400" : s >= 50 ? "text-amber-400" : "text-red-400";
  const hlbl = (s) => s >= 80 ? "Healthy" : s >= 50 ? "Caution" : "Critical";
  const pct = (a, b) => Math.min(100, Math.round((a / Math.max(b, 1)) * 100));

  // ─── Render ─────────────────────────────────────────────────────────────────
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

      {/* API Error Banner */}
      {apiError && (
        <div className="fixed bottom-24 left-2 right-2 z-50">
          <div className="bg-red-900/90 border border-red-600/40 rounded-xl px-4 py-2.5 flex items-center justify-between">
            <p className="text-red-200 text-xs">{apiError}</p>
            <button onClick={() => setApiError(null)} className="text-red-400 text-xs ml-3">✕</button>
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
            <button onClick={doSOS} disabled={apiLoading} className="bg-white text-red-950 font-bold px-6 py-3.5 rounded-2xl text-base w-full disabled:opacity-50">
              {apiLoading ? "Generating…" : "Generate Emergency PIN"}
            </button>
            <p className="text-red-500/40 text-xs mt-4 cursor-pointer" onClick={() => setSosOpen(false)}>Cancel</p>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-6" onClick={() => setShareOpen(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-xs w-full text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-1">Share PIN</h3>
            <p className="text-[11px] text-slate-500 mb-4">Scan QR or type at any terminal</p>
            {shareOpen.pin ? (
              <>
                <QR data={shareOpen.pin} />
                <p className="font-mono text-lg tracking-widest text-white mt-3 font-bold">{fmt(shareOpen.pin)}</p>
              </>
            ) : (
              <p className="text-slate-400 text-sm py-4">PIN is hidden for security.<br/>Rotate to reveal a new PIN.</p>
            )}
            <p className="text-[11px] text-slate-500 mt-1">{shareOpen.description}</p>
            <div className="flex gap-2 mt-5">
              <button
                className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-bold"
                onClick={() => { if (shareOpen.pin) navigator.clipboard?.writeText(shareOpen.pin); setShareOpen(null); }}
              >Copy</button>
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
              <p className="text-[8px] text-slate-600 tracking-widest uppercase">{user?.name || "Controlled Payouts"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSosOpen(true)} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-900/50 border border-red-500/30 text-red-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> SOS
            </button>
            <button onClick={logout} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-400 hover:text-white transition-colors">
              Out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="px-4 pt-4">

        {/* ====== HOME ====== */}
        {view === "home" && (
          <div>
            {pinsLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-slate-500 text-sm">Loading your PINs…</div>
              </div>
            ) : (
              <>
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
                  <button onClick={() => setView("create")} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors">+ New PIN</button>
                </div>

                {pins.length === 0 ? (
                  <div className="bg-slate-900/40 border border-slate-800/50 rounded-2xl p-8 text-center">
                    <p className="text-3xl mb-2">🔐</p>
                    <p className="text-slate-400 text-sm">No PINs yet</p>
                    <button onClick={() => setView("create")} className="mt-3 bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg">Create your first PIN</button>
                  </div>
                ) : (
                  <div className="space-y-3 mb-6">
                    {pins.map((p) => {
                      const hs = p.healthScore ?? 100;
                      const bp = pct(p.remaining, p.amount);
                      return (
                        <div key={p.id} onClick={() => { setSel(p); setView("detail"); }} className="bg-slate-900/60 border border-slate-800/50 rounded-2xl p-4 active:scale-[0.98] transition-transform cursor-pointer">
                          <div className="flex items-start gap-3">
                            <Ring val={hs} color={hc(hs)} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-sm font-bold truncate">{p.description}</p>
                                <Badge color={p.status === "active" ? "emerald" : p.status === "frozen" ? "sky" : "red"}>{p.status}</Badge>
                              </div>
                              <p className={"text-[10px] font-semibold " + htx(hs)}>{hlbl(hs)} · {p.categories?.length} categories · {GEO.find(g=>g.id===p.geo)?.flag}</p>
                              <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: bp + "%", background: hc(hs) }} />
                              </div>
                              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                                <span>{usd(p.remaining)} left</span>
                                <span>{p.usesLeft}/{p.maxUses} uses</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Live Feed */}
                {alerts.length > 0 && (
                  <div className="mb-4">
                    <h2 className="text-base font-bold mb-3">Live Feed</h2>
                    <div className="space-y-2">
                      {alerts.slice(0, 10).map((a, i) => (
                        <div key={i} className={"rounded-xl px-3 py-2 border text-xs " + (a.type === "approved" ? "bg-emerald-950/30 border-emerald-800/30" : a.type === "declined" ? "bg-red-950/30 border-red-800/30" : "bg-amber-950/30 border-amber-800/30")}>
                          <div className="flex items-center justify-between">
                            <span className="font-bold">{a.type === "approved" ? "✅" : a.type === "declined" ? "🚫" : "⚠️"} {a.merchant || "System"}</span>
                            <span className="text-slate-500">{ago(a.time)}</span>
                          </div>
                          <div className="text-slate-400 mt-0.5">
                            {a.amount ? usd(a.amount) : ""}{a.city ? " · " + a.city : ""}{a.reason ? " · " + a.reason : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ====== CREATE ====== */}
        {view === "create" && (
          <div>
            <button onClick={() => setView("home")} className="text-slate-400 text-sm mb-4 flex items-center gap-1">← Back</button>
            <h2 className="text-xl font-bold mb-4">New PinWay</h2>

            {/* Templates */}
            <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Quick Templates</p>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
              {TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => applyT(t)} className="shrink-0 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2 text-left hover:border-emerald-600/50 transition-colors">
                  <div className="text-lg">{t.icon}</div>
                  <div className="text-xs font-bold text-white mt-0.5">{t.name}</div>
                  <div className="text-[10px] text-slate-400">${t.amount}</div>
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {/* Amount */}
              <div>
                <label className="text-xs text-slate-400 font-semibold uppercase mb-1.5 block">Amount</label>
                <input type="number" value={form.amount} onChange={(e) => setForm(f=>({...f,amount:e.target.value}))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500" />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-slate-400 font-semibold uppercase mb-1.5 block">Description</label>
                <input type="text" placeholder="Mom - groceries & gas" value={form.description} onChange={(e) => setForm(f=>({...f,description:e.target.value}))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500" />
              </div>

              {/* Recipient */}
              <div>
                <label className="text-xs text-slate-400 font-semibold uppercase mb-1.5 block">Recipient (optional)</label>
                <select value={form.contactId} onChange={(e) => setForm(f=>({...f,contactId:e.target.value}))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500">
                  <option value="">No contact</option>
                  {contacts.map((c) => <option key={c.id} value={c.id}>{c.name} {c.relation ? `(${c.relation})` : ""}</option>)}
                </select>
              </div>

              {/* Delivery */}
              {form.contactId && (
                <div>
                  <label className="text-xs text-slate-400 font-semibold uppercase mb-1.5 block">Deliver PIN via</label>
                  <div className="flex gap-2">
                    {["none","sms","email"].map((m) => (
                      <button key={m} onClick={() => setForm(f=>({...f,deliveryMethod:m}))}
                        className={"flex-1 py-2 rounded-xl text-xs font-semibold capitalize border transition-colors " + (form.deliveryMethod===m ? "bg-emerald-600 border-emerald-500 text-white" : "bg-slate-900 border-slate-700 text-slate-400")}>
                        {m === "none" ? "Manual" : m.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories */}
              <div>
                <label className="text-xs text-slate-400 font-semibold uppercase mb-1.5 block">Allowed Categories</label>
                <div className="grid grid-cols-4 gap-2">
                  {MCC.map((m) => (
                    <button key={m.id} onClick={() => togCat(m.id)}
                      className={"rounded-xl p-2 text-center border transition-colors " + (form.categories.includes(m.id) ? "bg-emerald-600/20 border-emerald-500/50 text-emerald-300" : "bg-slate-900 border-slate-700 text-slate-400")}>
                      <div className="text-lg">{m.icon}</div>
                      <div className="text-[9px] mt-0.5">{m.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Geography */}
              <div>
                <label className="text-xs text-slate-400 font-semibold uppercase mb-1.5 block">Geography</label>
                <div className="grid grid-cols-2 gap-2">
                  {GEO.map((g) => (
                    <button key={g.id} onClick={() => setForm(f=>({...f,geo:g.id}))}
                      className={"rounded-xl px-3 py-2.5 border text-sm transition-colors flex items-center gap-2 " + (form.geo===g.id ? "bg-sky-600/20 border-sky-500/50 text-sky-300" : "bg-slate-900 border-slate-700 text-slate-400")}>
                      <span>{g.flag}</span><span className="text-xs">{g.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Limits */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold mb-1 block">Max Uses</label>
                  <input type="number" min="1" max="100" value={form.maxUses} onChange={(e)=>setForm(f=>({...f,maxUses:e.target.value}))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold mb-1 block">Expires (hrs)</label>
                  <input type="number" min="1" max="720" value={form.expirationHours} onChange={(e)=>setForm(f=>({...f,expirationHours:e.target.value}))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold mb-1 block">Per-Tx Limit $</label>
                  <input type="number" value={form.perTxLimit} onChange={(e)=>setForm(f=>({...f,perTxLimit:e.target.value}))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold mb-1 block">Daily Limit $</label>
                  <input type="number" value={form.dailyLimit} onChange={(e)=>setForm(f=>({...f,dailyLimit:e.target.value}))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500" />
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-slate-900/60 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">Auto-rotate PIN</p>
                    <p className="text-[11px] text-slate-500">Issue new PIN number on a schedule</p>
                  </div>
                  <Toggle on={form.rotate} onToggle={() => setForm(f=>({...f,rotate:!f.rotate}))} />
                </div>
                {form.rotate && (
                  <div className="bg-slate-900/40 rounded-xl px-4 py-3">
                    <label className="text-[10px] text-slate-500 uppercase font-semibold mb-1 block">Rotate every (hrs)</label>
                    <input type="number" min="1" max="168" value={form.rotateH} onChange={(e)=>setForm(f=>({...f,rotateH:e.target.value}))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none" />
                  </div>
                )}
                <div className="flex items-center justify-between bg-slate-900/60 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">Auto-reload</p>
                    <p className="text-[11px] text-slate-500">Replenish when balance hits 20%</p>
                  </div>
                  <Toggle on={form.autoReload} onToggle={() => setForm(f=>({...f,autoReload:!f.autoReload}))} />
                </div>
              </div>

              <button onClick={doCreate} disabled={apiLoading || form.categories.length === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl text-base transition-colors mt-2">
                {apiLoading ? "Creating…" : "Generate Secure PIN"}
              </button>
            </div>
          </div>
        )}

        {/* ====== DETAIL ====== */}
        {view === "detail" && sel && (
          <div>
            <button onClick={() => setView("home")} className="text-slate-400 text-sm mb-4 flex items-center gap-1">← Back</button>

            {/* PIN Card */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-2xl p-5 mb-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-slate-400">{sel.description}</p>
                  <p className="text-2xl font-bold text-white">{usd(sel.remaining)}</p>
                  <p className="text-xs text-slate-500">of {usd(sel.amount)} loaded</p>
                </div>
                <Badge color={sel.status === "active" ? "emerald" : sel.status === "frozen" ? "sky" : "red"}>{sel.status}</Badge>
              </div>

              {/* PIN Display */}
              {sel.pin ? (
                <div className="bg-slate-950/60 rounded-xl p-3 mb-3 text-center">
                  <p className="text-[9px] text-slate-500 uppercase mb-1 tracking-widest">16-Digit PIN</p>
                  <p className="font-mono text-xl tracking-[0.3em] font-bold text-emerald-400">{fmt(sel.pin)}</p>
                  <p className="text-[9px] text-slate-600 mt-1">Shown once · rotate to refresh</p>
                </div>
              ) : (
                <div className="bg-slate-950/60 rounded-xl p-3 mb-3 text-center">
                  <p className="text-[9px] text-slate-500 uppercase mb-1">PIN Hidden</p>
                  <p className="text-slate-500 text-sm">Tap "Rotate" to issue a new PIN</p>
                </div>
              )}

              {/* Categories */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {sel.categories?.map((c) => {
                  const m = MCC.find(x=>x.id===c);
                  return m ? <span key={c} className="bg-emerald-900/30 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full">{m.icon} {m.label}</span> : null;
                })}
                <span className="bg-sky-900/30 text-sky-300 text-[10px] px-2 py-0.5 rounded-full">
                  {GEO.find(g=>g.id===sel.geo)?.flag} {GEO.find(g=>g.id===sel.geo)?.label}
                </span>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-4 gap-2">
                <button onClick={() => setShareOpen(sel)} className="bg-slate-800 rounded-xl py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors">Share</button>
                <button onClick={() => doRotate(sel.id)} className="bg-slate-800 rounded-xl py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors">Rotate</button>
                <button onClick={() => doFreeze(sel.id)} disabled={sel.status === "revoked"}
                  className={"rounded-xl py-2.5 text-xs font-semibold transition-colors " + (sel.status === "frozen" ? "bg-sky-700 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700")}>
                  {sel.status === "frozen" ? "Unfreeze" : "Freeze"}
                </button>
                <button onClick={() => doRevoke(sel.id)} disabled={sel.status === "revoked"}
                  className="bg-red-900/40 rounded-xl py-2.5 text-xs font-semibold text-red-400 hover:bg-red-900/60 disabled:opacity-40 transition-colors">
                  Revoke
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { l: "Uses Left", v: `${sel.usesLeft}/${sel.maxUses}` },
                { l: "Per Tx", v: usd(sel.perTxLimit) },
                { l: "Daily Cap", v: usd(sel.dailyLimit) },
              ].map((s, i) => (
                <div key={i} className="bg-slate-900/60 border border-slate-800/50 rounded-xl p-3 text-center">
                  <p className="text-[9px] text-slate-500 uppercase">{s.l}</p>
                  <p className="text-sm font-bold text-white">{s.v}</p>
                </div>
              ))}
            </div>

            {/* Transaction history for this PIN */}
            <PinTransactions pinId={sel.id} />
          </div>
        )}

      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur border-t border-slate-800/50 flex">
        {[
          { id: "home", icon: "🏠", label: "Home" },
          { id: "create", icon: "➕", label: "New PIN" },
          { id: "feed", icon: "📡", label: "Activity" },
        ].map((n) => (
          <button key={n.id} onClick={() => setView(n.id)}
            className={"flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors " + (view === n.id ? "text-emerald-400" : "text-slate-500")}>
            <span className="text-lg">{n.icon}</span>
            <span className="text-[9px] font-semibold">{n.label}</span>
          </button>
        ))}
      </nav>

    </div>
  );
}

// ─── Per-PIN transaction sub-component ───────────────────────────────────────
function PinTransactions({ pinId }) {
  const [txs, setTxs] = useState([]);
  const usd = (v) => "$" + Number(v).toFixed(2);
  const ago = (d) => { const m = Math.floor((Date.now() - new Date(d)) / 60000); if (m < 1) return "now"; if (m < 60) return m + "m"; const h = Math.floor(m / 60); return h < 24 ? h + "h" : Math.floor(h / 24) + "d"; };

  useEffect(() => {
    txApi.list({ pinId, limit: 20 })
      .then(setTxs)
      .catch(() => {});
  }, [pinId]);

  if (!txs.length) return <p className="text-xs text-slate-600 text-center py-4">No transactions yet</p>;

  return (
    <div>
      <h3 className="text-sm font-bold text-slate-400 mb-2">Transactions</h3>
      <div className="space-y-2">
        {txs.map((t, i) => (
          <div key={i} className={"rounded-xl px-3 py-2.5 border text-xs " + (t.type === "approved" ? "bg-emerald-950/20 border-emerald-800/20" : "bg-red-950/20 border-red-800/20")}>
            <div className="flex justify-between">
              <span className="font-semibold">{t.type === "approved" ? "✅" : "🚫"} {t.merchant_name || "Unknown"}</span>
              <span className="text-slate-500">{ago(t.created_at)}</span>
            </div>
            <div className="text-slate-400 mt-0.5">
              {t.amount ? usd(t.amount) : ""}{t.merchant_city ? " · " + t.merchant_city : ""}{t.reason ? " · " + t.reason : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
