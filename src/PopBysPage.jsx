import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

const TIER_LABEL = { aplus: "A+ only", aplus_a: "A+ and A", aplus_a_b: "A+, A and B" };
const FREQ_LABEL = { 30: "Every month", 90: "Every 3 months", 180: "Every 6 months" };

const btn = (bg, color) => ({ background: bg, color, border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" });
const input = { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 15, fontFamily: "inherit" };
const lbl = { display: "block", fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 };

// Miles between two lat/lng points (haversine).
function miles(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 3958.8, toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Greedy nearest-neighbor ordering of stops (those with coords first).
function routeOrder(stops) {
  const withGeo = stops.filter(s => s.hasCoords);
  const noGeo = stops.filter(s => !s.hasCoords);
  if (withGeo.length <= 2) return [...withGeo, ...noGeo];
  const remaining = [...withGeo];
  // start from the most south-west point (stable, no Date/random)
  let current = remaining.reduce((m, s) => (s.lat + s.lng < m.lat + m.lng ? s : m), remaining[0]);
  const ordered = [];
  remaining.splice(remaining.indexOf(current), 1);
  ordered.push(current);
  while (remaining.length) {
    let bestI = 0, bestD = Infinity;
    remaining.forEach((s, i) => { const d = miles(current, s); if (d != null && d < bestD) { bestD = d; bestI = i; } });
    current = remaining.splice(bestI, 1)[0];
    ordered.push(current);
  }
  return [...ordered, ...noGeo];
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
  const [batchGift, setBatchGift] = useState({ gift: "", note: "", price: null, whereToBuy: "" });
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
        setBatchGift({ gift: d.gift, note: d.note, price: d.price, whereToBuy: d.whereToBuy || "" });
      } else alert(d.error || "Couldn't get a suggestion.");
    } catch (e) { alert("Error: " + e.message); }
    finally { setSuggestingBatch(false); }
  };

  const togglePurchased = async (c) => {
    const next = !c.purchased;
    setData(prev => ({ ...prev, due: prev.due.map(x => x.id === c.id ? { ...x, purchased: next } : x) }));
    try { await fetch(API + "/popbys/" + c.id + "/purchased", { method: "POST", headers, body: JSON.stringify({ purchased: next }) }); } catch {}
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

  // Select a tight nearby cluster (everyone within 5 mi of the first geocoded stop).
  const selectCluster = () => {
    const geo = (data.due || []).filter(c => c.hasCoords && !c.far);
    if (geo.length === 0) { alert("No nearby contacts with a map location yet (they need a street address, and must be within ~1 hr)."); return; }
    const anchor = geo[0];
    const near = geo.filter(c => { const d = miles(anchor, c); return d != null && d <= 5; });
    setSelected(new Set(near.map(c => c.id)));
  };

  const selectedList = (data?.due || []).filter(c => selected.has(c.id));
  const ordered = routeOrder(selectedList);

  const openMaps = () => {
    const stops = ordered.filter(c => c.fullAddress);
    if (!stops.length) { alert("Pick at least one contact with an address first."); return; }
    const origin = data?.start?.hasAddress ? data.start.address : null;
    const points = (origin ? [origin] : []).concat(stops.map(c => c.fullAddress));
    window.open("https://www.google.com/maps/dir/" + points.map(encodeURIComponent).join("/"), "_blank");
  };

  const printNotes = () => {
    if (!batchGift.note) { alert("Pick a gift for the group first (✨ Suggest a gift) — that's what creates the note card."); return; }
    const list = selected.size ? ordered : routeOrder(data.due || []);
    const cards = list.map(c => `
      <div class="card"><div class="to">For ${escapeHtml(c.firstName || "")} ${escapeHtml(c.lastName || "")}</div>
      <div class="note">${escapeHtml(batchGift.note)}</div>
      <div class="gift">${escapeHtml(batchGift.gift || "")}</div></div>`).join("");
    if (!cards) { alert("No contacts to print note cards for."); return; }
    const w = window.open("", "_blank");
    if (!w) { alert("Allow pop-ups to print."); return; }
    w.document.write(`<!doctype html><meta charset=utf-8><title>Pop-by note cards</title>
      <style>@page{size:letter;margin:0.5in}*{box-sizing:border-box}body{margin:0;font-family:Georgia,serif}
      .bar{padding:12px 18px;background:#0c4a6e;color:#fff;font:600 14px Arial}.bar button{background:#fff;color:#0c4a6e;border:0;border-radius:6px;padding:7px 14px;font:700 13px Arial;cursor:pointer}
      .sheet{display:flex;flex-wrap:wrap;padding:8px}
      .card{width:3.5in;height:2.2in;border:1px dashed #bbb;margin:6px;padding:18px;display:flex;flex-direction:column;justify-content:center;break-inside:avoid}
      .to{font-size:12px;color:#888;margin-bottom:8px}.note{font-size:18px;font-weight:700;color:#0c4a6e;line-height:1.3}.gift{font-size:12px;color:#aaa;margin-top:10px;font-style:italic}
      @media print{.bar{display:none}}</style>
      <div class="bar"><button onclick="window.print()">🖨 Print note cards</button> &nbsp; Cut along the dashed lines.</div>
      <div class="sheet">${cards}</div>
      <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>`);
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
              {data.geocoding > 0 && (
                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <span>📍 Locating {data.geocoding} address{data.geocoding === 1 ? "" : "es"} for the map… this runs in the background.</span>
                  <button onClick={load} style={btn("#dbeafe", "#1e3a8a")}>Refresh</button>
                </div>
              )}

              {(data.due || []).length === 0 ? (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 20, color: "#166534" }}>🎉 Nobody's due for a pop-by right now. Check back later — or adjust your tiers/frequency in Settings.</div>
              ) : (
                <>
                  {/* Step toolbar */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
                    <button onClick={suggestBatch} disabled={suggestingBatch} style={btn("#fef9c3", "#854d0e")}>{suggestingBatch ? "Thinking…" : (batchGift.gift ? "↻ Suggest another gift" : "✨ Suggest a gift")}</button>
                    <button onClick={printNotes} style={btn("#e0e7ff", "#3730a3")}>🖨 Print note cards</button>
                    <span style={{ width: 1, height: 22, background: "#e5e7eb" }} />
                    <button onClick={selectCluster} style={btn("#e0e7ff", "#3730a3")}>📍 Select a nearby group</button>
                    <button onClick={() => setSelected(new Set(data.due.filter(c => !c.far).map(c => c.id)))} style={btn("#e5e7eb", "#374151")}>Select all nearby</button>
                    {selected.size > 0 && <button onClick={() => setSelected(new Set())} style={btn("#e5e7eb", "#374151")}>Clear</button>}
                    {selected.size > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: "#0c4a6e" }}>{selected.size} selected</span>}
                  </div>

                  {/* One gift for the whole run */}
                  {batchGift.gift && (() => {
                    const n = selected.size || data.due.length;
                    return (
                      <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: 14, marginBottom: 14 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#92400e" }}>🎁 Buy {n} × {batchGift.gift}</div>
                        <div style={{ fontSize: 13, color: "#78350f", marginTop: 4 }}>
                          {batchGift.price != null && <span>💵 about <strong>${batchGift.price}</strong> each{n > 1 ? <span> · ~<strong>${Math.round(batchGift.price * n)}</strong> total</span> : null} (your budget: ${data.settings.budget}/gift)</span>}
                          {batchGift.whereToBuy && <span>{batchGift.price != null ? " · " : ""}🛍 find it at: <strong>{batchGift.whereToBuy}</strong></span>}
                        </div>
                        <div style={{ fontSize: 13, color: "#78350f", marginTop: 4 }}>Note card for each: <em>"{batchGift.note}"</em></div>
                      </div>
                    );
                  })()}

                  {/* Due list */}
                  <div style={{ display: "grid", gap: 8 }}>
                    {data.due.map(c => (
                      <div key={c.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "#fff", border: "1px solid " + (selected.has(c.id) ? "#0c4a6e" : "#e5e7eb"), borderRadius: 10, padding: 12 }}>
                        <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} style={{ marginTop: 4, width: 18, height: 18, cursor: "pointer" }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700 }}>{c.firstName} {c.lastName} <span style={{ fontSize: 11, background: "#0c4a6e", color: "#fff", borderRadius: 6, padding: "1px 6px", marginLeft: 4 }}>{c.tier}</span></div>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>{c.fullAddress}{!c.hasCoords && <span style={{ color: "#b45309" }}> · ⚠️ couldn't map this address</span>}{c.far && <span style={{ color: "#b91c1c", fontWeight: 700 }}> · ⏱ ~1 hr+ away ({c.milesFromStart} mi)</span>}</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                          <label style={{ fontSize: 12, color: "#374151", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                            <input type="checkbox" checked={c.purchased} onChange={() => togglePurchased(c)} /> bought
                          </label>
                          <button onClick={() => markDelivered(c)} style={btn("#dcfce7", "#166534")}>✓ Delivered</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Selected-run tools */}
                  {selected.size > 0 && (
                    <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, marginTop: 16 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>Your run — {selected.size} stop{selected.size === 1 ? "" : "s"}</div>
                      {selectedList.some(c => c.far) && (
                        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 13 }}>
                          ⏱ Heads up: {selectedList.filter(c => c.far).length} selected stop{selectedList.filter(c => c.far).length === 1 ? " is" : "s are"} <strong>~1 hr+ away</strong> from your address — that's a long detour. Consider doing {selectedList.filter(c => c.far).length === 1 ? "it" : "them"} on a separate trip.
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                        <button onClick={openMaps} style={btn("#0c4a6e", "white")}>🗺 Open route in Google Maps</button>
                      </div>

                      {/* Shopping list */}
                      <div style={{ fontSize: 13, marginBottom: 10 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>🛒 Shopping list</div>
                        {batchGift.gift ? <div style={{ color: "#374151" }}>Buy <strong>{selected.size} × {batchGift.gift}</strong>{batchGift.price != null && <span> · ~${Math.round(batchGift.price * selected.size)} total</span>}{batchGift.whereToBuy && <span> · at {batchGift.whereToBuy}</span>}</div> :
                          <div style={{ color: "#9ca3af" }}>Tap "✨ Suggest a gift" up top to pick one gift for the whole run.</div>}
                      </div>

                      {/* Route preview */}
                      <div style={{ fontSize: 13 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>🚗 Suggested order {routeTotal(ordered) != null && <span style={{ color: "#6b7280", fontWeight: 400 }}>· ~{routeTotal(ordered)} mi total (straight-line)</span>}</div>
                        <ol style={{ margin: 0, paddingLeft: 20, color: "#374151" }}>
                          {ordered.map((c, i) => {
                            const prev = ordered[i - 1];
                            const leg = prev ? miles(prev, c) : null;
                            return <li key={c.id} style={{ marginBottom: 2 }}>{c.firstName} {c.lastName} <span style={{ color: "#9ca3af" }}>· {c.fullAddress}{leg != null ? ` · ${leg.toFixed(1)} mi from previous` : ""}</span></li>;
                          })}
                        </ol>
                        {!data.start.hasAddress && <div style={{ color: "#b45309", marginTop: 6 }}>Tip: add your office/home address in My Profile so the route starts from you.</div>}
                      </div>
                    </div>
                  )}
                </>
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
