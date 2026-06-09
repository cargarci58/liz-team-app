import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

const TIER_LABEL = { aplus: "A+ only", aplus_a: "A+ and A", aplus_a_b: "A+, A and B" };
const FREQ_LABEL = { 30: "Every month", 90: "Every 3 months", 180: "Every 6 months" };

const btn = (bg, color) => ({ background: bg, color, border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" });
const input = { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 15, fontFamily: "inherit" };
const lbl = { display: "block", fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 };
const stepBox = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginTop: 14 };
const stepTitle = { fontSize: 16, fontWeight: 800, color: "#111", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 };
const stepNum = { background: "#0c4a6e", color: "#fff", borderRadius: "50%", width: 24, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 };

// Miles between two lat/lng points (haversine).
function miles(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 3958.8, toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Parse the reliable parts of an address (the free geocoder is often fuzzy, but
// the address TEXT is exact). House number, street name, and zip.
function houseNum(addr) { const m = String(addr || "").match(/^\s*(\d+)/); return m ? parseInt(m[1], 10) : 999999; }
// Common street-suffix spellings → one canonical form, so "Alderley Dr" and
// "Alderley Drive" (or St/Street, Ave/Avenue, etc.) count as the SAME street.
const STREET_SUFFIX = {
  dr: "dr", drive: "dr", st: "st", street: "st", ave: "ave", av: "ave", avenue: "ave",
  rd: "rd", road: "rd", ln: "ln", lane: "ln", ct: "ct", court: "ct", cir: "cir", circle: "cir",
  blvd: "blvd", boulevard: "blvd", pl: "pl", place: "pl", ter: "ter", terrace: "ter",
  trl: "trl", trail: "trl", pkwy: "pkwy", parkway: "pkwy", pt: "pt", point: "pt",
  sq: "sq", square: "sq", hwy: "hwy", highway: "hwy", way: "way", loop: "loop", run: "run", path: "path",
};
function streetName(addr) {
  const base = String(addr || "")
    .split(",")[0]                                   // drop city/state/zip if present
    .replace(/^\s*\d+\s*/, "")                        // drop the house number
    .replace(/\s*(#|apt\.?|apartment|suite|ste\.?|unit|lot)\s*[\w-]+\s*$/i, "") // drop unit
    .toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
  // canonicalize the last word if it's a known suffix
  const parts = base.split(" ");
  if (parts.length > 1 && STREET_SUFFIX[parts[parts.length - 1]]) parts[parts.length - 1] = STREET_SUFFIX[parts[parts.length - 1]];
  return parts.join(" ");
}
function zipOf(s) {
  if (s && s.zip) return String(s.zip).trim().slice(0, 5);
  const m = String((s && s.fullAddress) || s || "").match(/(\d{5})(?:-\d{4})?\s*$/);
  return m ? m[1] : "";
}

// Order stops for the drive. Group houses on the SAME STREET together (from the
// address text, so it's exact), then visit the streets by true nearest-next:
// start at home, go to the closest street, then the closest street to THAT, etc.
// This follows real proximity across zip lines (Lake Waverly → nearby Okaloosa)
// while still keeping a neighbor on your own street right at the top.
function routeOrder(stops, start) {
  if (stops.length <= 1) return [...stops];
  const origin = (start && start.lat != null) ? { lat: start.lat, lng: start.lng } : null;
  // Your OWN street name (from the address text — reliable even if coords are fuzzy).
  const homeStreet = (start && start.address) ? streetName(start.address) : "";
  // Build street groups (zip + street), each sorted by house number.
  const groupsMap = {};
  stops.forEach(s => { const k = (zipOf(s) || "?") + "|" + (streetName(s.address) || "?"); (groupsMap[k] = groupsMap[k] || []).push(s); });
  const groups = Object.entries(groupsMap).map(([key, members]) => {
    members.sort((a, b) => houseNum(a.address) - houseNum(b.address));
    const geo = members.filter(m => m.hasCoords);
    const rep = geo.length
      ? (origin ? geo.reduce((best, m) => ((miles(origin, m) ?? Infinity) < (miles(origin, best) ?? Infinity) ? m : best), geo[0]) : geo[0])
      : null;
    return { key, streetNorm: streetName(members[0].address), members, rep };
  });
  const ordered = [];
  let current = origin;
  // 1. Anyone on your OWN street goes first, matched by street NAME (so "Dr" vs
  //    "Drive" or a missing zip can't break it), no matter what the coords say.
  const homeIdx = homeStreet ? groups.findIndex(g => g.streetNorm && g.streetNorm === homeStreet) : -1;
  if (homeIdx >= 0) {
    const hg = groups.splice(homeIdx, 1)[0];
    ordered.push(...hg.members);
    if (hg.rep) current = hg.rep;
  }
  // 2. Then nearest-next over the remaining streets.
  const remaining = [...groups];
  while (remaining.length) {
    let bestI = -1, bestD = Infinity;
    remaining.forEach((g, i) => {
      if (!g.rep) return;
      const d = current ? (miles(current, g.rep) ?? Infinity) : 0;
      if (d < bestD) { bestD = d; bestI = i; }
    });
    if (bestI === -1) break; // only coord-less groups left
    const g = remaining.splice(bestI, 1)[0];
    ordered.push(...g.members);
    current = g.rep;
  }
  remaining.forEach(g => ordered.push(...g.members)); // un-mappable streets last
  return ordered;
}

// Search link for a store the AI suggested — real store search pages, no
// guessed product URLs. Unknown stores fall back to a Google search.
function storeSearchUrl(store, gift) {
  const q = encodeURIComponent(gift);
  const s = store.toLowerCase();
  if (s.includes("target")) return `https://www.target.com/s?searchTerm=${q}`;
  if (s.includes("walmart")) return `https://www.walmart.com/search?q=${q}`;
  if (s.includes("amazon")) return `https://www.amazon.com/s?k=${q}`;
  if (s.includes("costco")) return `https://www.costco.com/CatalogSearch?keyword=${q}`;
  if (s.includes("sam")) return `https://www.samsclub.com/s/${q}`;
  if (s.includes("dollar tree")) return `https://www.dollartree.com/search?q=${q}`;
  if (s.includes("trader joe")) return `https://www.traderjoes.com/home/search?q=${q}`;
  if (s.includes("publix")) return `https://www.publix.com/search?query=${q}`;
  if (s.includes("home depot")) return `https://www.homedepot.com/s/${q}`;
  return `https://www.google.com/search?q=${encodeURIComponent(store + " " + gift)}`;
}

export default function PopBysPage({ token, onBack }) {
  const [data, setData] = useState(null);          // /popbys/due response
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("run");           // run | history
  const [selected, setSelected] = useState(new Set());
  const [showGuide, setShowGuide] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [form, setForm] = useState({ popByTiers: "aplus", popByFrequencyDays: 90, popByBudget: 10 });
  const [busy, setBusy] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [clusterMi, setClusterMi] = useState(5);   // nearby-group radius (1-10 mi)
  const [batchGift, setBatchGift] = useState({ gift: "", note: "", price: null, whereToBuy: "", stores: [] });
  const [rejectedGifts, setRejectedGifts] = useState([]);
  const [suggestingBatch, setSuggestingBatch] = useState(false);
  const [history, setHistory] = useState([]);

  const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(API + "/popbys/due", { headers });
      const d = await r.json();
      setData(d);
      if (d.settings) setForm({ popByTiers: d.settings.tiers, popByFrequencyDays: d.settings.frequencyDays, popByBudget: d.settings.budget });
      // Restore the previously-chosen gift so it doesn't vanish on return.
      if (d.currentGift && d.currentGift.gift) {
        setBatchGift({ gift: d.currentGift.gift, note: d.currentGift.note || "", price: d.currentGift.price ?? null, whereToBuy: d.currentGift.whereToBuy || "", stores: d.currentGift.stores || [] });
      }
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === "history") loadHistory(); }, [tab]);

  const loadHistory = async () => {
    try { const r = await fetch(API + "/popbys/history", { headers }); const d = await r.json(); setHistory(d.deliveries || []); } catch {}
  };

  const savePref = async (patch, reload = true) => {
    setBusy(true);
    try { await fetch(API + "/contacts/prefs", { method: "PUT", headers, body: JSON.stringify(patch) }); if (reload) await load(); }
    catch (e) { alert("Couldn't save: " + e.message); }
    finally { setBusy(false); }
  };

  const enable = () => savePref({ popBysEnabled: true });
  const saveSettings = async () => {
    setBusy(true);
    try {
      const body = { popBysEnabled: true, popByTiers: form.popByTiers, popByFrequencyDays: parseInt(form.popByFrequencyDays, 10) || 90, popByBudget: parseInt(form.popByBudget, 10) || 10 };
      await fetch(API + "/contacts/prefs", { method: "PUT", headers, body: JSON.stringify(body) });
      // Reflect immediately, then refresh the due list in the background.
      setData(prev => prev ? { ...prev, enabled: true, settings: { tiers: body.popByTiers, frequencyDays: body.popByFrequencyDays, budget: body.popByBudget } } : prev);
      setForm({ popByTiers: body.popByTiers, popByFrequencyDays: body.popByFrequencyDays, popByBudget: body.popByBudget });
      setSavedMsg(true); setTimeout(() => setSavedMsg(false), 2500);
      setShowSettings(false);
      load();
    } catch (e) { alert("Couldn't save: " + e.message); }
    finally { setBusy(false); }
  };

  const toggle = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ONE gift for the whole run (same gift for everyone — buy N of them).
  // "Suggest another" remembers what you rejected so it never repeats.
  const suggestBatch = async () => {
    setSuggestingBatch(true);
    try {
      const avoid = batchGift.gift ? [...rejectedGifts, batchGift.gift] : rejectedGifts;
      const r = await fetch(API + "/popbys/suggest-batch", { method: "POST", headers, body: JSON.stringify({ avoid }) });
      const d = await r.json();
      if (r.ok) {
        if (batchGift.gift) setRejectedGifts(avoid);
        setBatchGift({ gift: d.gift, note: d.note, price: d.price, whereToBuy: d.whereToBuy || "", stores: Array.isArray(d.stores) ? d.stores : [] });
      } else alert(d.error || "Couldn't get a suggestion.");
    } catch (e) { alert("Error: " + e.message); }
    finally { setSuggestingBatch(false); }
  };

  // Gifts are bought in bulk — one checkbox marks the whole run as purchased.
  const toggleAllPurchased = async (list, next) => {
    const ids = new Set(list.map(c => c.id));
    setData(prev => ({ ...prev, due: prev.due.map(x => ids.has(x.id) ? { ...x, purchased: next } : x) }));
    for (const c of list) {
      try { await fetch(API + "/popbys/" + c.id + "/purchased", { method: "POST", headers, body: JSON.stringify({ purchased: next }) }); } catch {}
    }
  };

  const markDelivered = async (c) => {
    if (!confirm(`Mark the pop-by for ${c.firstName || "this contact"} as delivered? It'll move to your history and reschedule for next time.`)) return;
    try {
      const r = await fetch(API + "/popbys/" + c.id + "/delivered", { method: "POST", headers, body: JSON.stringify({ gift: batchGift.gift, note: batchGift.note }) });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || "Failed"); }
      setData(prev => ({ ...prev, due: prev.due.filter(x => x.id !== c.id) }));
      setSelected(prev => { const n = new Set(prev); n.delete(c.id); return n; });
    } catch (e) { alert("Error: " + e.message); }
  };

  // Far contacts (~1 hr+ drive, incl. out-of-state) are excluded from the run
  // entirely — they get their own section below.
  const nearDue = (data?.due || []).filter(c => !c.far);
  const farDue = (data?.due || []).filter(c => c.far);
  const selectedList = nearDue.filter(c => selected.has(c.id));
  // "The run" = your selection if you made one, otherwise everyone nearby.
  const runList = selectedList.length ? selectedList : nearDue;
  const ordered = routeOrder(runList, data?.start);

  // Group due contacts into areas where everyone is within ~clusterMi of someone
  // else in the group — so each chip is a tight, gas-saving run. Radius is
  // agent-controlled (1-10 mi slider). Labeled by most-common city; singletons hidden.
  const CLUSTER_MI = clusterMi;
  const areaClusters = (() => {
    const unused = nearDue.filter(c => c.hasCoords);
    const clusters = [];
    while (unused.length) {
      const members = [unused.shift()];
      let grew = true;
      while (grew) {
        grew = false;
        for (let i = unused.length - 1; i >= 0; i--) {
          if (members.some(m => { const d = miles(m, unused[i]); return d != null && d <= CLUSTER_MI; })) {
            members.push(unused.splice(i, 1)[0]);
            grew = true;
          }
        }
      }
      const cityCount = {};
      members.forEach(m => { const city = (m.city || "").trim(); if (city) cityCount[city] = (cityCount[city] || 0) + 1; });
      const top = Object.entries(cityCount).sort((a, b) => b[1] - a[1]);
      clusters.push({ label: top.length ? top[0][0] : "Area", members });
    }
    return clusters.filter(c => c.members.length >= 2).sort((a, b) => b.members.length - a.members.length).slice(0, 8);
  })();

  const openMaps = () => {
    const stops = ordered.filter(c => c.fullAddress);
    if (!stops.length) { alert("Pick at least one contact with an address first."); return; }
    const origin = data?.start?.hasAddress ? data.start.address : null;
    const points = (origin ? [origin] : []).concat(stops.map(c => c.fullAddress));
    window.open("https://www.google.com/maps/dir/" + points.map(encodeURIComponent).join("/"), "_blank");
  };

  // Letter-portrait sheet, pre-formatted: 2 columns x 3 rows = 6 cards per page
  // (each 3.75in x 3.2in), dashed cut lines, auto page breaks. Each card is a
  // warm personal note: "Dear [First]," + message + signed by the agent.
  const printNotes = () => {
    if (!batchGift.note) { alert("Pick a gift first (Step 1, ✨ Suggest a gift) — that's what creates the note card."); return; }
    const list = ordered;
    if (!list.length) { alert("No contacts to print note cards for."); return; }
    const signature = (data && data.agentName) ? data.agentName : "Your Realtor";
    const PER_PAGE = 6;
    const pages = [];
    for (let i = 0; i < list.length; i += PER_PAGE) pages.push(list.slice(i, i + PER_PAGE));
    const pageHtml = pages.map(pg => `<div class="page">${pg.map(c => `
      <div class="card">
        <div class="greet">Dear ${escapeHtml(c.firstName || "friend")},</div>
        <div class="msg">${escapeHtml(batchGift.note)}</div>
        <div class="sign">With gratitude,<br><span class="name">${escapeHtml(signature)}</span></div>
      </div>`).join("")}</div>`).join("");
    const w = window.open("", "_blank");
    if (!w) { alert("Allow pop-ups to print."); return; }
    w.document.write(`<!doctype html><html><head><meta charset=utf-8><title>Pop-by note cards</title>
      <style>
        @page { size: letter portrait; margin: 0.5in; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Georgia, 'Times New Roman', serif; }
        .bar { padding: 12px 18px; background: #0c4a6e; color: #fff; font: 600 14px Arial; display: flex; align-items: center; gap: 12px; }
        .bar button { background: #fff; color: #0c4a6e; border: 0; border-radius: 6px; padding: 8px 16px; font: 700 14px Arial; cursor: pointer; }
        .bar span { font-weight: 400; opacity: .9; }
        .page { width: 7.5in; height: 9.9in; margin: 0 auto; display: grid;
                grid-template-columns: 3.75in 3.75in; grid-auto-rows: 3.2in;
                align-content: start; page-break-after: always; }
        .page:last-child { page-break-after: auto; }
        .card { border: 1px dashed #bbb; padding: 0.3in; display: flex; flex-direction: column; overflow: hidden; }
        .greet { font-size: 14pt; color: #0c4a6e; font-weight: 700; margin-bottom: 8px; }
        .msg { font-size: 12.5pt; color: #222; line-height: 1.45; flex: 1; }
        .sign { font-size: 12pt; color: #444; margin-top: 8px; }
        .sign .name { font-weight: 700; color: #0c4a6e; font-size: 13pt; }
        @media print { .bar { display: none; } }
      </style></head><body>
      <div class="bar"><button onclick="window.print()">🖨 Print</button>
        <span>${list.length} card${list.length === 1 ? "" : "s"} · ${pages.length} letter page${pages.length === 1 ? "" : "s"} (portrait) · print at 100% / Actual Size · cut along the dashed lines</span></div>
      ${pageHtml}
      <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>
      </body></html>`);
    w.document.close();
  };

  // ── render ──────────────────────────────────────────────────
  const wrap = { padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 1000, margin: "0 auto" };

  if (loading) return <div style={wrap}>Loading…</div>;

  return (
    <div style={wrap}>
      {onBack && <button onClick={onBack} style={{ background: "transparent", border: "none", color: "#0c4a6e", cursor: "pointer", fontSize: 14, fontWeight: 600, marginBottom: 12, padding: "4px 0" }}>← Back to Dashboard</button>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>🎁 Pop-Bys</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>Hand-deliver a small gift to your best clients — the #1 way to earn referrals.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowGuide(g => !g)} style={btn("#fef3c7", "#92400e")}>📖 How it works</button>
          <button onClick={() => setShowSettings(s => !s)} style={btn("#e5e7eb", "#374151")}>⚙ Settings</button>
        </div>
      </div>

      {showGuide && (
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: 16, marginTop: 12, fontSize: 14, color: "#78350f", lineHeight: 1.6 }}>
          <strong>What's a pop-by?</strong> It's when you personally drop off a small, thoughtful gift to a top client — a coffee mug, fresh-baked muffins, a little seasonal treat — just to say hello. No sales pitch. It keeps you top-of-mind so when real estate comes up, they think of <em>you</em> (and refer you).
          <br /><br />
          <strong>How this page helps:</strong> (1) it lists the clients <strong>due</strong> for a pop-by, (2) suggests a <strong>gift idea + a little note-card line</strong> for each, (3) groups people who live <strong>near each other</strong> so you save gas, (4) lets you <strong>print the note cards</strong>, (5) gives you a <strong>map & driving route</strong>, and (6) tracks <strong>who you've already delivered to</strong>. Do a batch every few months and watch your referrals grow.
        </div>
      )}

      {showSettings && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div><label style={lbl}>Who gets pop-bys</label>
            <select value={form.popByTiers} onChange={e => setForm(f => ({ ...f, popByTiers: e.target.value }))} style={{ ...input, width: 180 }}>
              {Object.entries(TIER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div><label style={lbl}>How often</label>
            <select value={form.popByFrequencyDays} onChange={e => setForm(f => ({ ...f, popByFrequencyDays: parseInt(e.target.value, 10) }))} style={{ ...input, width: 170 }}>
              {Object.entries(FREQ_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div><label style={lbl}>Budget per gift</label>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ fontSize: 16, color: "#6b7280" }}>$</span>
              <input type="number" min={1} max={500} value={form.popByBudget} onChange={e => setForm(f => ({ ...f, popByBudget: e.target.value }))} style={{ ...input, width: 90 }} /></div></div>
          <button onClick={saveSettings} disabled={busy} style={btn("#0c4a6e", "white")}>{busy ? "Saving…" : "Save settings"}</button>
        </div>
      )}

      {savedMsg && <div style={{ background: "#dcfce7", border: "1px solid #86efac", color: "#166534", borderRadius: 8, padding: "8px 12px", marginTop: 10, fontSize: 13, fontWeight: 700 }}>✓ Settings saved.</div>}

      {/* Not enabled yet */}
      {data && !data.enabled && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 28, marginTop: 16, textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Turn on Pop-Bys to get started</div>
          <div style={{ fontSize: 14, color: "#6b7280", maxWidth: 520, margin: "0 auto 16px", lineHeight: 1.6 }}>
            When it's on, the app schedules pop-bys for your chosen tiers and shows you who's due, with gift ideas and a delivery route. It's optional — leave it off if pop-bys aren't your style.
          </div>
          <button onClick={enable} disabled={busy} style={btn("#0c4a6e", "white")}>{busy ? "Turning on…" : "🎁 Turn on Pop-Bys"}</button>
          <div style={{ marginTop: 10 }}><button onClick={() => setShowGuide(true)} style={{ background: "none", border: "none", color: "#0c4a6e", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>What's a pop-by?</button></div>
        </div>
      )}

      {data && data.enabled && (
        <>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 8, marginTop: 18, borderBottom: "2px solid #e5e7eb" }}>
            {[["run", "This run"], ["history", "History"]].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} style={{ background: "none", border: "none", borderBottom: tab === k ? "3px solid #0c4a6e" : "3px solid transparent", padding: "10px 14px", marginBottom: -2, fontWeight: 700, fontSize: 14, color: tab === k ? "#0c4a6e" : "#6b7280", cursor: "pointer" }}>{label}</button>
            ))}
          </div>

          {tab === "run" && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>
                Showing <strong>{TIER_LABEL[data.settings.tiers]}</strong> contacts due for a pop-by ({FREQ_LABEL[data.settings.frequencyDays]?.toLowerCase()}). Budget ~${data.settings.budget}/gift.
              </div>
              {(() => {
                const total = nearDue.length + farDue.length + (data.noAddress || []).length;
                if (total === 0) return null;
                return (
                  <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 13, color: "#374151" }}>
                    <strong>{total}</strong> due this round: <strong style={{ color: "#166534" }}>{nearDue.length} nearby</strong> (your run)
                    {farDue.length > 0 && <span> · <strong style={{ color: "#991b1b" }}>{farDue.length} too far</strong></span>}
                    {(data.noAddress || []).length > 0 && <span> · <strong style={{ color: "#9a3412" }}>{data.noAddress.length} missing an address</strong></span>}
                    {(farDue.length > 0 || (data.noAddress || []).length > 0) && <span style={{ color: "#9ca3af" }}> — see the sections below.</span>}
                  </div>
                );
              })()}
              {data.geocoding > 0 && (
                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <span>📍 Locating {data.geocoding} address{data.geocoding === 1 ? "" : "es"} for the map… this runs in the background.</span>
                  <button onClick={load} style={btn("#dbeafe", "#1e3a8a")}>Refresh</button>
                </div>
              )}

              {!data.start.hasAddress && (data.due || []).length > 0 && (
                <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 13 }}>
                  ⚠️ Add your office/home address in <strong>My Profile</strong> — without it the app can't tell who's too far away or start your route from you.
                </div>
              )}
              {nearDue.length === 0 ? (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 20, color: "#166534" }}>
                  🎉 Nobody nearby is due for a pop-by right now. Check back later — or adjust your tiers/frequency in Settings.
                  {farDue.length > 0 && <div style={{ marginTop: 6, color: "#9a3412" }}>({farDue.length} due contact{farDue.length === 1 ? " is" : "s are"} 1 hr+ away — see below.)</div>}
                </div>
              ) : (
                <>
                  {/* ── STEP 1 — pick the gift ── */}
                  <div style={stepBox}>
                    <div style={stepTitle}><span style={stepNum}>1</span> Pick the gift &amp; go shopping</div>
                    <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>One gift for everyone — buy {runList.length} of the same thing.</div>
                    <button onClick={suggestBatch} disabled={suggestingBatch} style={btn("#fef9c3", "#854d0e")}>{suggestingBatch ? "Thinking…" : (batchGift.gift ? "↻ Suggest another gift" : "✨ Suggest a gift")}</button>
                    {batchGift.gift && (
                      <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: 14, marginTop: 10 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#92400e" }}>🛒 Buy {runList.length} × {batchGift.gift}</div>
                        <div style={{ fontSize: 13, color: "#78350f", marginTop: 4 }}>
                          {batchGift.price != null && <span>💵 <strong>est. ~${batchGift.price}</strong> each{runList.length > 1 ? <span> · ~<strong>${Math.round(batchGift.price * runList.length)}</strong> total</span> : null} <span style={{ color: "#b45309" }}>(rough estimate — prices vary, check the store)</span></span>}
                          {batchGift.stores.length > 0 && (
                            <span>{batchGift.price != null ? " · " : ""}🛍 buy it:{" "}
                              {batchGift.stores.map((s, i) => (
                                <span key={s}>
                                  {i > 0 && " · "}
                                  <a href={storeSearchUrl(s, batchGift.gift)} target="_blank" rel="noopener noreferrer" style={{ color: "#92400e", fontWeight: 700, textDecoration: "underline" }}>{s} ↗</a>
                                </span>
                              ))}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: "#78350f", marginTop: 6, paddingTop: 6, borderTop: "1px dashed #fcd34d" }}>💌 Note card message (each card opens "Dear [name]," and is signed by you):<br /><em>"{batchGift.note}"</em></div>
                      </div>
                    )}
                    <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 14, fontWeight: 700, color: "#166534", cursor: "pointer" }}>
                      <input type="checkbox" style={{ width: 18, height: 18, cursor: "pointer" }}
                        checked={runList.length > 0 && runList.every(c => c.purchased)}
                        onChange={e => toggleAllPurchased(runList, e.target.checked)} />
                      ✓ I bought the gifts — ready to deliver
                    </label>
                  </div>

                  {/* ── STEP 2 — print the notes ── */}
                  <div style={stepBox}>
                    <div style={stepTitle}><span style={stepNum}>2</span> Print the note cards</div>
                    <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>One card per person, ready to print on letter paper (8 per page) and cut out. Tape one to each gift.</div>
                    <button onClick={printNotes} style={btn("#e0e7ff", "#3730a3")}>🖨 Print {runList.length} note card{runList.length === 1 ? "" : "s"}</button>
                  </div>

                  {/* ── STEP 3 — pick who / which area ── */}
                  <div style={stepBox}>
                    <div style={stepTitle}><span style={stepNum}>3</span> Pick who's on today's run</div>
                    <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>Tap a <strong>nearby group</strong> below to knock out a tight, gas-saving run today — or check people one by one. Skip this step to do everyone.</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Group size:</span>
                      <input type="range" min={1} max={10} step={1} value={clusterMi} onChange={e => setClusterMi(parseInt(e.target.value, 10))} style={{ flex: 1, minWidth: 140, maxWidth: 260, accentColor: "#0c4a6e", cursor: "pointer" }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0c4a6e", whiteSpace: "nowrap" }}>within {clusterMi} mi</span>
                    </div>
                    {areaClusters.length > 0 ? (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#3730a3", marginBottom: 6 }}>📍 Nearby groups (within ~{clusterMi} mi):</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          {areaClusters.map((cl, i) => (
                            <button key={i} onClick={() => setSelected(new Set(cl.members.map(m => m.id)))} style={btn("#e0e7ff", "#3730a3")}>
                              {cl.label} ({cl.members.length})
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 10 }}>No clusters at {clusterMi} mi — slide right to widen the group, or pick people below.</div>
                    )}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
                      <button onClick={() => setSelected(new Set(nearDue.map(c => c.id)))} style={btn("#e5e7eb", "#374151")}>Select all</button>
                      {selected.size > 0 && <button onClick={() => setSelected(new Set())} style={btn("#e5e7eb", "#374151")}>Clear</button>}
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0c4a6e" }}>{selectedList.length > 0 ? `${selectedList.length} on this run` : `all ${nearDue.length} included`}</span>
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {nearDue.map(c => (
                        <div key={c.id} style={{ display: "flex", gap: 12, alignItems: "center", background: "#fff", border: "1px solid " + (selected.has(c.id) ? "#0c4a6e" : "#e5e7eb"), borderRadius: 10, padding: 12 }}>
                          <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} style={{ width: 18, height: 18, cursor: "pointer" }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700 }}>{c.firstName} {c.lastName} <span style={{ fontSize: 11, background: "#0c4a6e", color: "#fff", borderRadius: 6, padding: "1px 6px", marginLeft: 4 }}>{c.tier}</span></div>
                            <div style={{ fontSize: 12, color: "#6b7280" }}>{c.fullAddress}{!c.hasCoords && (data.geocoding > 0 ? <span style={{ color: "#2563eb" }}> · 📍 locating…</span> : <span style={{ color: "#b45309" }}> · ⚠️ couldn't pinpoint — still included; check the address spelling</span>)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── STEP 4 — drive & deliver ── */}
                  <div style={stepBox}>
                    <div style={stepTitle}><span style={stepNum}>4</span> Drive the route &amp; mark delivered</div>
                    <button onClick={openMaps} style={{ ...btn("#0c4a6e", "white"), marginBottom: 12 }}>🗺 Open the route in Google Maps</button>
                    <div style={{ fontSize: 13 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>🚗 Stop order {routeTotal(ordered) != null && <span style={{ color: "#6b7280", fontWeight: 400 }}>· ~{routeTotal(ordered)} mi total (straight-line)</span>}</div>
                      <div style={{ display: "grid", gap: 6 }}>
                        {ordered.map((c, i) => {
                          const prev = i === 0 ? (data.start?.lat != null ? data.start : null) : ordered[i - 1];
                          const leg = prev ? miles(prev, c) : null;
                          const legLabel = i === 0 ? "from home" : "from previous";
                          return (
                            <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "center", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px" }}>
                              <span style={{ fontWeight: 800, color: "#0c4a6e", width: 22, textAlign: "right" }}>{i + 1}.</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>{c.firstName} {c.lastName}</div>
                                <div style={{ fontSize: 12, color: "#9ca3af" }}>{c.fullAddress}{leg != null ? ` · ${leg.toFixed(1)} mi ${legLabel}` : ""}</div>
                              </div>
                              <button onClick={() => markDelivered(c)} style={btn("#dcfce7", "#166534")}>✓ Delivered</button>
                            </div>
                          );
                        })}
                      </div>
                      {!data.start.hasAddress && <div style={{ color: "#b45309", marginTop: 6 }}>Tip: add your office/home address in My Profile so the route starts from you.</div>}
                    </div>
                  </div>
                </>
              )}

              {/* Too-far list — excluded from the run */}
              {farDue.length > 0 && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 14, marginTop: 16 }}>
                  <div style={{ fontWeight: 700, color: "#991b1b", marginBottom: 6 }}>⏱ {farDue.length} due, but 1 hr+ away — left out of this run</div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {farDue.map(c => (
                      <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "center", background: "#fff", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{c.firstName} {c.lastName} <span style={{ fontSize: 11, background: "#0c4a6e", color: "#fff", borderRadius: 6, padding: "1px 6px", marginLeft: 4 }}>{c.tier}</span></div>
                          <div style={{ fontSize: 12, color: "#9ca3af" }}>{c.fullAddress} · {c.milesFromStart != null ? `~${c.milesFromStart} mi away` : "out of state"}</div>
                        </div>
                        <button onClick={() => markDelivered(c)} style={btn("#dcfce7", "#166534")} title="If you do visit them, mark it here">✓ Delivered</button>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: "#991b1b", marginTop: 8 }}>Too far to mix into a local gift run. Mail them something instead, plan a separate trip — or if the distance looks wrong, double-check their address in Contacts.</div>
                </div>
              )}

              {/* No-address list */}
              {(data.noAddress || []).length > 0 && (
                <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: 14, marginTop: 16 }}>
                  <div style={{ fontWeight: 700, color: "#9a3412", marginBottom: 6 }}>⚠️ {data.noAddress.length} due, but missing a street address (can't be mapped or routed)</div>
                  <div style={{ fontSize: 13, color: "#7c2d12" }}>{data.noAddress.map(c => `${c.firstName} ${c.lastName} (${c.tier})`).join(" · ")}</div>
                  <div style={{ fontSize: 12, color: "#9a3412", marginTop: 6 }}>Add their address in Contacts to include them in a route.</div>
                </div>
              )}
            </div>
          )}

          {tab === "history" && (
            <div style={{ marginTop: 16 }}>
              {history.length === 0 ? <div style={{ color: "#6b7280", padding: 20 }}>No pop-bys delivered yet. Once you mark some delivered, they'll show here.</div> : (
                <div style={{ display: "grid", gap: 6 }}>
                  {history.map(h => (
                    <div key={h.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }}>
                      <div><div style={{ fontWeight: 700 }}>{h.contact_name}</div><div style={{ fontSize: 12, color: "#6b7280" }}>🎁 {h.gift || "—"}{h.note ? ` · "${h.note}"` : ""}</div></div>
                      <div style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap" }}>{new Date(h.delivered_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function routeTotal(ordered) {
  let total = 0, any = false;
  for (let i = 1; i < ordered.length; i++) { const d = miles(ordered[i - 1], ordered[i]); if (d != null) { total += d; any = true; } }
  return any ? Math.round(total) : null;
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
