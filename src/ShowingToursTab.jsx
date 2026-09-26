import { useState, useEffect, useRef } from "react";
import { planRoute, simulate, fmtTime, toMin } from "./lib/tourRoute";
import { telHref } from "./lib/telHref";
import HomeScorecard, { FavoritesSummary, ScorecardButton } from "./components/HomeScorecard";

const API = "https://liz-team-server-api-production.up.railway.app";

// 🏠 Showings tab on buyer deals: plan a day of showings.
//   1. Upload the MLS report (Broker Full PDF / screenshots) → AI reads every home
//   2. Review/fix what it read
//   3. Plan my route → least back-and-forth, arrival times, appointment windows
//   4. Tour day → Navigate / Call listing agent / door codes on each stop
// Door & lockbox codes are agent/TC-only and erased 3 days after the tour
// (server purgeShowingAccessCodes). Route math: lib/tourRoute.js.

const C = {
  red: "#C0392B", darkRed: "#922B21", lightRed: "#FADBD8", navy: "#111111",
  gray: "#555555", muted: "#6b7280", border: "#e5e7eb", bg: "#F4F4F4",
  white: "#FFFFFF", lightGray: "#F9FAFB", blue: "#0c4a6e",
};
const btn = (bg, color = "#fff", extra = {}) => ({ background: bg, color, border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", ...extra });
const ghost = (extra = {}) => ({ background: C.white, color: C.gray, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", ...extra });
const input = { width: "100%", boxSizing: "border-box", padding: "9px 10px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", background: C.white };
const lbl = { display: "block", fontSize: 11.5, fontWeight: 700, color: C.gray, marginBottom: 3 };

const isMobileDevice = () => typeof window !== "undefined" && (window.innerWidth < 768 || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches));
const oneLine = (s) => [s.address, s.city, [s.state || "FL", s.zip].filter(Boolean).join(" ")].filter(x => x && String(x).trim()).join(", ");
const money = (n) => (n == null || n === "" || isNaN(Number(n))) ? "" : "$" + Number(n).toLocaleString();
const navUrl = (s) => "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" + encodeURIComponent(oneLine(s));
const fmtDate = (d) => { if (!d) return ""; const x = new Date(String(d).slice(0, 10) + "T12:00:00"); return x.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); };
const keyOf = (s) => (s.mls_number ? "m:" + String(s.mls_number).trim().toLowerCase() : "a:" + String(s.address || "").trim().toLowerCase().replace(/\s+/g, " "));

const fileToB64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(",")[1] || "");
  r.onerror = () => reject(new Error("Couldn't read " + file.name));
  r.readAsDataURL(file);
});

const EMPTY_STOP = { address: "", city: "", zip: "", mls_number: "", list_price: "", beds: "", baths: "", sqft: "",
  listing_agent_name: "", listing_agent_phone: "", listing_agent_email: "", listing_office: "", listing_office_phone: "",
  showing_instructions: "", access_info: "", appt_start: "", appt_end: "", occupancy: "", agent_notes: "" };

export default function ShowingToursTab({ tx, onOpenOffer }) {
  const token = localStorage.getItem("tp_token") || "";
  const hdrs = { "Content-Type": "application/json", Authorization: "Bearer " + token };
  const [tours, setTours] = useState(null);
  const [tourId, setTourId] = useState(null);
  const [busy, setBusy] = useState("");          // "" | "saving" | "reading" | "planning"
  const [err, setErr] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [justAdded, setJustAdded] = useState(new Set());
  const [editing, setEditing] = useState(null);  // stop id being edited, or "new"
  const [draft, setDraft] = useState(null);
  const [openInfo, setOpenInfo] = useState(new Set());
  const [copied, setCopied] = useState(false);
  const [offering, setOffering] = useState(null); // stop id while its offer is being created
  const [openCard, setOpenCard] = useState(new Set()); // stops whose scorecard is open
  const toggleCard = (id) => setOpenCard(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const fileRef = useRef(null);
  const offerAfterUpload = useRef(null); // stop id: "Write an offer" asked for the report first
  const mobile = isMobileDevice();

  const tour = (tours || []).find(t => t.id === tourId) || null;
  const stops = tour ? tour.stops || [] : [];

  const load = async (selectId) => {
    try {
      const r = await fetch(`${API}/transactions/${tx.id}/showing-tours`, { headers: hdrs });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Couldn't load tours");
      setTours(d.tours || []);
      setTourId(selectId || (d.tours && d.tours[0] ? d.tours[0].id : null));
    } catch (e) { setErr(e.message); setTours([]); }
  };
  useEffect(() => { load(); }, [tx.id]);
  // Pick up the buyer's scorecard taps: quietly re-fetch whenever the agent
  // comes back to the app/tab (keeps the selected tour day).
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      fetch(`${API}/transactions/${tx.id}/showing-tours`, { headers: hdrs }).then(r => r.ok ? r.json() : null)
        .then(d => { if (d && d.success) setTours(d.tours || []); }).catch(() => {});
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [tx.id]);

  const replaceTour = (t) => setTours(prev => (prev || []).map(x => x.id === t.id ? t : x));

  // Save settings and/or the full stop list (in order). Returns the saved tour.
  const save = async (patch = {}, stopList = null) => {
    setBusy(b => b || "saving"); setErr("");
    try {
      const body = { ...patch };
      if (stopList) body.stops = stopList;
      const r = await fetch(`${API}/showing-tours/${tour.id}`, { method: "PUT", headers: hdrs, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Couldn't save");
      replaceTour(d.tour);
      return d.tour;
    } catch (e) { setErr(e.message); return null; }
    finally { setBusy(""); }
  };

  const newTour = async () => {
    setBusy("saving"); setErr("");
    try {
      const r = await fetch(`${API}/transactions/${tx.id}/showing-tours`, { method: "POST", headers: hdrs, body: JSON.stringify({}) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Couldn't start a tour");
      setTours(prev => [d.tour, ...(prev || [])]); setTourId(d.tour.id); setWarnings([]); setJustAdded(new Set());
    } catch (e) { setErr(e.message); }
    setBusy("");
  };

  const deleteTour = async () => {
    if (!window.confirm(stops.length ? `Delete the ${fmtDate(tour.tour_date)} tour day and its ${stops.length} home(s)? Scorecards on those homes are deleted too.` : `Delete the ${fmtDate(tour.tour_date)} tour day?`)) return;
    await fetch(`${API}/showing-tours/${tour.id}`, { method: "DELETE", headers: hdrs }).catch(() => {});
    const rest = (tours || []).filter(t => t.id !== tour.id);
    setTours(rest); setTourId(rest[0] ? rest[0].id : null);
  };

  const opts = (t = tour) => ({
    start: t && t.start_lat != null ? { lat: t.start_lat, lng: t.start_lng } : null,
    startTime: (t && t.start_time) || "10:00",
    minutesPerStop: (t && t.minutes_per_stop) || 20,
  });

  const planAndSave = async (t = tour) => {
    if (!t || !t.stops || t.stops.length < 2) return t;
    setBusy("planning");
    const ordered = planRoute(t.stops, opts(t));
    return save({}, ordered);
  };

  // Upload → AI reads the homes → merged into the tour (duplicates skipped) → route planned.
  const onFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length || !tour) return;
    const total = files.reduce((n, f) => n + f.size, 0);
    if (total > 25 * 1024 * 1024) { setErr("Those files are too big together (25 MB max). Upload fewer homes at a time."); return; }
    setBusy("reading"); setErr(""); setWarnings([]);
    try {
      const payload = await Promise.all(files.map(async f => ({ name: f.name, type: f.type || (/\.pdf$/i.test(f.name) ? "application/pdf" : ""), data: await fileToB64(f) })));
      const r = await fetch(`${API}/showing-tours/${tour.id}/read-listings`, { method: "POST", headers: hdrs, body: JSON.stringify({ files: payload }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't read that report");
      const have = new Set(stops.map(keyOf));
      const fresh = (d.listings || []).filter(l => !have.has(keyOf(l)));
      // A home already on the tour isn't added twice — but anything it was
      // missing (offer details, a phone, a code…) is filled in from the new read.
      // Nothing the agent already has is overwritten.
      const byKey = new Map((d.listings || []).map(l => [keyOf(l), l]));
      let topped = 0;
      const merged = stops.map(st => {
        const l = byKey.get(keyOf(st));
        if (!l) return st;
        const out = { ...st };
        let changed = false;
        for (const [k, v] of Object.entries(l)) {
          if (k === "offer_details") {
            const cur = st.offer_details || {};
            const od = { ...v, ...Object.fromEntries(Object.entries(cur).filter(([, x]) => x !== "" && x != null)) };
            if (JSON.stringify(od) !== JSON.stringify(st.offer_details || null)) { out.offer_details = od; changed = true; }
          } else if ((st[k] == null || st[k] === "") && v !== "" && v != null) { out[k] = v; changed = true; }
        }
        if (changed) topped++;
        return out;
      });
      const w = [...(d.warnings || [])];
      if (!d.listings || !d.listings.length) w.unshift("No homes were found in that file. Make sure it's the agent/broker full report, not a client report.");
      if (topped) w.unshift(`${topped} home(s) already on this tour — filled in their missing details (offer info, phones, codes). Nothing you typed was changed.`);
      else if ((d.listings || []).length > fresh.length) w.unshift(`${(d.listings || []).length - fresh.length} home(s) were already on this tour with nothing new to add.`);
      setWarnings(w);
      if (topped && !fresh.length) { setBusy("saving"); await save({}, merged); }
      if (fresh.length) {
        setBusy("saving");
        const saved = await save({}, [...merged, ...fresh]);
        if (saved) {
          const before = new Set(stops.map(s => s.id));
          setJustAdded(new Set(saved.stops.filter(s => !before.has(s.id)).map(s => s.id)));
          await planAndSave(saved);
        }
      }
    } catch (e) { setErr(e.message); }
    setBusy("");
    if (fileRef.current) fileRef.current.value = "";
    // Came here from "Write an offer" on a home with no contract details →
    // the report is now read and merged, so start/top-up that offer.
    const pending = offerAfterUpload.current;
    offerAfterUpload.current = null;
    if (pending && Date.now() - pending.at < 10 * 60 * 1000) await writeOffer({ id: pending.id }, true);
  };

  const startEdit = (s) => { setEditing(s ? s.id : "new"); setDraft(s ? { ...EMPTY_STOP, ...Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v == null ? "" : v])) } : { ...EMPTY_STOP }); };
  const saveEdit = async () => {
    if (!draft.address.trim()) { alert("Add the street address first."); return; }
    const list = editing === "new" ? [...stops, draft] : stops.map(s => s.id === editing ? { ...s, ...draft } : s);
    const saved = await save({}, list);
    if (saved) { setEditing(null); setDraft(null); setJustAdded(prev => { const n = new Set(prev); n.delete(editing); return n; }); }
  };
  const removeStop = async (s) => {
    if (!window.confirm(`Remove ${s.address} from this tour?`)) return;
    await save({}, stops.filter(x => x.id !== s.id));
  };
  const move = async (i, dir) => {
    const j = i + dir; if (j < 0 || j >= stops.length) return;
    const list = stops.slice(); [list[i], list[j]] = [list[j], list[i]];
    replaceTour({ ...tour, stops: list });
    await save({}, list);
  };

  // Shared scorecard (buyer sees the same one in their portal). Merges the saved
  // row into whichever tour holds this home.
  const saveFeedback = async (t, s, patch) => {
    try {
      const r = await fetch(`${API}/showing-tours/${t.id}/stops/${s.id}/feedback`, { method: "PATCH", headers: hdrs, body: JSON.stringify(patch) });
      const d = await r.json();
      if (!r.ok || !d.feedback) return null;
      setTours(prev => (prev || []).map(x => x.id !== t.id ? x : { ...x, stops: (x.stops || []).map(y => y.id === s.id ? { ...y, ...d.feedback } : y) }));
      return d.feedback;
    } catch { return null; }
  };

  // 📝 Write an offer: server starts a draft already filled from the MLS report
  // (same fields as the wizard's own MLS upload), then we jump to Offers.
  const hasOfferDetails = (s) => s.offer_details && Object.values(s.offer_details).some(v => v !== "" && v != null && v !== false);
  const writeOffer = async (s, skipCheck = false) => {
    // No seller / legal / parcel / HOA on this home yet (added before the app
    // read them, or the report left them out) → read the report first.
    if (!skipCheck && s.address && !hasOfferDetails(s)) {
      if (window.confirm(`${s.address} doesn't have the contract details yet (seller, parcel ID, county, legal description, HOA, title company).\n\nOK = upload its MLS Broker Full report now — the app reads it and fills the offer.\nCancel = start the offer with the basics only.`)) {
        offerAfterUpload.current = { id: s.id, at: Date.now() };
        if (fileRef.current) fileRef.current.click();
        return;
      }
    }
    setOffering(s.id); setErr("");
    try {
      const r = await fetch(`${API}/showing-tours/${tour.id}/stops/${s.id}/offer`, { method: "POST", headers: hdrs });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Couldn't start the offer");
      // Functional update: this can run right after an upload re-saved the tour,
      // so never write back a stale copy of the stops (it would drop the new details).
      setTours(prev => (prev || []).map(t => ({ ...t, stops: (t.stops || []).map(x => x.id === s.id ? { ...x, offer_id: d.offerId } : x) })));
      if (onOpenOffer) onOpenOffer(d.offerId);
    } catch (e) { setErr(e.message); }
    setOffering(null);
  };

  const sched = tour ? simulate(stops, opts()) : null;
  const legById = new Map((sched ? sched.legs : []).map(l => [l.id, l]));
  const lateCount = sched ? sched.legs.filter(l => l.late > 0).length : 0;
  const unmapped = stops.filter(s => s.lat == null).length;

  const copyTimes = () => {
    const lines = stops.map((s, i) => { const l = legById.get(s.id); return `${i + 1}. ${oneLine(s)} — ${fmtTime(l.begin)} to ${fmtTime(l.depart)}${s.mls_number ? ` (MLS ${s.mls_number})` : ""}`; });
    const text = `Showings ${fmtDate(tour.tour_date)}:\n` + lines.join("\n");
    try { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (e) {}
  };
  const wholeRouteUrl = () => {
    const pts = stops.map(oneLine);
    const p = new URLSearchParams({ api: "1", travelmode: "driving", destination: pts[pts.length - 1] });
    if (tour.start_address) p.set("origin", tour.start_address);
    if (pts.length > 1) p.set("waypoints", pts.slice(0, -1).join("|"));
    return "https://www.google.com/maps/dir/?" + p.toString();
  };
  // Google allows 9 in-between stops on a computer (only 3 on phones — so phones navigate one home at a time).
  const canWholeRoute = !mobile && stops.length > 1 && stops.length <= 10;

  if (tours === null) return <div style={{ padding: 30, color: C.muted, textAlign: "center" }}>Loading showings…</div>;

  return (
    <div style={{ padding: "4px 0 40px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.navy }}>🏠 Showing Tours</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>Upload the MLS report for the day's homes — the app reads them and plans the shortest route.</div>
        </div>
        <button onClick={newTour} disabled={!!busy} style={btn(C.red)}>{tours.length ? "➕ Add another tour day" : "➕ Plan a tour"}</button>
      </div>

      {err && <div style={{ background: C.lightRed, color: C.darkRed, borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>⚠️ {err}</div>}

      {tours.length === 0 && (
        <div style={{ background: C.white, border: `2px dashed ${C.border}`, borderRadius: 12, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 30 }}>🗺</div>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.navy, marginTop: 6 }}>No showing tours yet</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>Tap <b>Plan a tour</b>, upload the Stellar MLS <b>Broker Full</b> report (or screenshots) for the homes you're showing, and the app does the rest.</div>
        </div>
      )}

      <FavoritesSummary stops={tours.flatMap(t => (t.stops || []).map(s => ({ ...s, tour_date: t.tour_date })))} />

      {tours.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>Tour days:</span>
          {[...tours].sort((a, b) => String(a.tour_date).localeCompare(String(b.tour_date))).map((t, di) => (
            <button key={t.id} onClick={() => { setTourId(t.id); setWarnings([]); setJustAdded(new Set()); setEditing(null); }}
              style={{ ...ghost(), border: `1.5px solid ${t.id === tourId ? C.red : C.border}`, background: t.id === tourId ? C.lightRed : C.white, color: t.id === tourId ? C.darkRed : C.gray }}>
              Day {di + 1} · {fmtDate(t.tour_date)} · {(t.stops || []).length} home{(t.stops || []).length === 1 ? "" : "s"}
            </button>
          ))}
        </div>
      )}

      {tour && (
        <>
          {/* SETTINGS */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
              <div><label style={lbl}>Tour date</label>
                <input type="date" defaultValue={String(tour.tour_date || "").slice(0, 10)} key={"d" + tour.id} style={input}
                  onChange={e => e.target.value && save({ tourDate: e.target.value })} /></div>
              <div><label style={lbl}>Start time</label>
                <input type="time" defaultValue={tour.start_time || "10:00"} key={"t" + tour.id} style={input}
                  onBlur={e => e.target.value && e.target.value !== tour.start_time && save({ startTime: e.target.value })} /></div>
              <div><label style={lbl}>Minutes per home</label>
                <select value={tour.minutes_per_stop || 20} style={input} onChange={e => save({ minutesPerStop: Number(e.target.value) })}>
                  {[10, 15, 20, 25, 30, 45, 60].map(n => <option key={n} value={n}>{n} min</option>)}
                </select></div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={lbl}>Start from (office, home, or your buyer's place)</label>
              <input defaultValue={tour.start_address || ""} key={"s" + tour.id} placeholder="e.g. 100 Main St, Kissimmee, FL 34741" style={input}
                onBlur={e => e.target.value.trim() !== (tour.start_address || "") && save({ startAddress: e.target.value.trim() })} />
              {!tour.start_address && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>Without a start address the route begins at the first home.</div>}
              {tour.start_address && tour.start_lat == null && <div style={{ fontSize: 11.5, color: C.darkRed, marginTop: 3 }}>Couldn't find that address on the map — check the spelling.</div>}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button onClick={deleteTour} disabled={!!busy} style={ghost({ color: C.darkRed, borderColor: "#FECACA" })}>🗑 Delete this tour day</button>
            </div>
          </div>

          {/* ADD HOMES */}
          <div style={{ background: C.white, border: `2px dashed ${C.red}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: C.navy }}>📄 Add homes from the MLS report</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>
              In Stellar MLS select the day's homes → <b>Broker Full</b> report → save as one PDF. Screenshots work too. The app reads the address, listing agent, showing instructions and lockbox/door codes.
            </div>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf,image/*" multiple style={{ display: "none" }} onChange={e => onFiles(e.target.files)} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <button onClick={() => fileRef.current && fileRef.current.click()} disabled={!!busy} style={btn(C.red)}>
                {busy === "reading" ? "📖 Reading the report…" : "⬆️ Upload MLS report"}
              </button>
              <button onClick={() => startEdit(null)} disabled={!!busy} style={ghost()}>➕ Add a home by hand</button>
            </div>
            {busy === "reading" && <div style={{ fontSize: 12.5, color: C.blue, marginTop: 8 }}>This takes about 15–30 seconds for a handful of homes…</div>}
          </div>

          {warnings.length > 0 && (
            <div style={{ background: C.lightGray, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.blue}`, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: C.blue, marginBottom: 4 }}>Check these</div>
              {warnings.map((w, i) => <div key={i} style={{ fontSize: 13, color: C.navy, lineHeight: 1.5 }}>• {w}</div>)}
            </div>
          )}
          {justAdded.size > 0 && (
            <div style={{ background: C.lightRed, borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 13, color: C.darkRed, fontWeight: 600 }}>
              ✅ Added {justAdded.size} home{justAdded.size === 1 ? "" : "s"} (marked NEW). Give them a quick look and tap ✏️ Edit to fix anything the reader got wrong.
            </div>
          )}

          {editing === "new" && <StopForm draft={draft} setDraft={setDraft} onSave={saveEdit} onCancel={() => { setEditing(null); setDraft(null); }} busy={busy} isNew />}

          {/* ROUTE SUMMARY */}
          {stops.length > 0 && (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>🚗 {fmtDate(tour.tour_date)} · {stops.length} home{stops.length === 1 ? "" : "s"}</div>
                  <div style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>
                    {fmtTime(sched.legs[0] ? sched.legs[0].begin : null)} → done ~{fmtTime(sched.finish)}{sched.miles > 0 ? ` · ~${Math.round(sched.miles)} mi driving` : ""}
                  </div>
                </div>
              </div>
              {lateCount > 0 && <div style={{ fontSize: 12.5, color: C.darkRed, fontWeight: 700, marginTop: 8 }}>⚠️ {lateCount} home{lateCount === 1 ? "" : "s"} can't make the appointment window with this plan — start earlier or remove a home.</div>}
              {unmapped > 0 && <div style={{ fontSize: 12.5, color: C.darkRed, marginTop: 6 }}>📍 {unmapped} home{unmapped === 1 ? "" : "s"} couldn't be found on the map — check the address (kept at the end).</div>}
              {/* Each action says what it does for the agent (Carlos 9/26: "doesn't say anything"). */}
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                {stops.length > 1 && (
                  <ActionRow button={<button onClick={() => planAndSave()} disabled={!!busy} style={btn(C.red, "#fff", { minWidth: 190 })}>{busy === "planning" ? "Planning…" : "🧭 Plan my route"}</button>}
                    text="Puts the homes in the order with the least driving and gives each one an arrival time. It respects any showing windows. Tap it again after you add or remove a home." />
                )}
                <ActionRow button={<button onClick={copyTimes} style={ghost({ minWidth: 190 })}>{copied ? "✓ Copied — now paste it" : "📋 Copy showing times"}</button>}
                  text="Copies each address with its time slot — paste it into ShowingTime or a text to the listing agents when you book the appointments." />
                {canWholeRoute ? (
                  <ActionRow button={<a href={wholeRouteUrl()} target="_blank" rel="noreferrer" style={{ ...ghost({ minWidth: 190 }), color: C.blue, textDecoration: "none", textAlign: "center", boxSizing: "border-box" }}>🗺 Open whole route in Google Maps</a>}
                    text="Opens all the homes as one trip in Google Maps, in this order, so you can see the whole day on a map." />
                ) : (
                  <div style={{ fontSize: 12.5, color: C.gray, lineHeight: 1.5 }}>🧭 On tour day, tap <b>Navigate</b> on each home — Google Maps takes you from wherever you are to that house.</div>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 10 }}>Times are estimates from distance. Google Maps shows real traffic when you navigate.</div>
            </div>
          )}

          {/* STOPS */}
          {stops.map((s, i) => {
            const l = legById.get(s.id) || {};
            const isNew = justAdded.has(s.id);
            const infoOpen = openInfo.has(s.id);
            if (editing === s.id) return <StopForm key={s.id} draft={draft} setDraft={setDraft} onSave={saveEdit} onCancel={() => { setEditing(null); setDraft(null); }} busy={busy} />;
            return (
              <div key={s.id}>
                {i > 0 && l.driveMin != null && (
                  <div style={{ fontSize: 11.5, color: C.muted, padding: "2px 0 6px 18px" }}>↓ ~{l.driveMin} min drive{l.wait > 0 ? ` · ${l.wait} min wait for the window` : ""}</div>
                )}
                <div style={{ background: C.white, border: `1.5px solid ${l.late > 0 ? C.red : isNew ? C.red : C.border}`, borderRadius: 12, padding: 14, marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.red, color: "#fff", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 15.5, fontWeight: 800, color: C.navy, wordBreak: "break-word" }}>
                          {s.address}{isNew && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 800, color: "#fff", background: C.red, borderRadius: 10, padding: "2px 7px", verticalAlign: "middle" }}>NEW</span>}
                        </div>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: l.late > 0 ? C.red : C.blue, whiteSpace: "nowrap" }}>{fmtTime(l.begin)} – {fmtTime(l.depart)}</div>
                      </div>
                      <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>
                        {[s.city, s.zip].filter(Boolean).join(" ")}{s.mls_number ? ` · MLS ${s.mls_number}` : ""}
                        {s.list_price ? ` · ${money(s.list_price)}` : ""}{s.beds ? ` · ${Number(s.beds)} bd` : ""}{s.baths ? ` / ${Number(s.baths)} ba` : ""}{s.sqft ? ` · ${Number(s.sqft).toLocaleString()} sf` : ""}
                        {s.occupancy ? ` · ${s.occupancy}` : ""}
                      </div>
                      {s.buyer_offer_interest_at && (
                        <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 800, color: C.darkRed, background: C.lightRed, borderRadius: 8, padding: "4px 9px", display: "inline-block" }}>❤️ Your buyer wants to make an offer on this one</div>
                      )}
                      {(s.appt_start || s.appt_end) && (
                        <div style={{ display: "inline-block", marginTop: 6, fontSize: 12, fontWeight: 700, color: l.late > 0 ? C.darkRed : C.blue, background: l.late > 0 ? C.lightRed : "#EEF2F7", borderRadius: 8, padding: "3px 8px" }}>
                          🕑 Window {fmtTime(toMin(s.appt_start))}{s.appt_end ? ` – ${fmtTime(toMin(s.appt_end))}` : ""}{l.late > 0 ? ` · ${l.late} min late!` : ""}
                        </div>
                      )}
                      {(s.listing_agent_name || s.listing_agent_phone || s.listing_office) && (
                        <div style={{ fontSize: 13, color: C.navy, marginTop: 8 }}>
                          👤 {s.listing_agent_name || "Listing agent"}{s.listing_office ? <span style={{ color: C.muted }}> · {s.listing_office}</span> : null}
                          <div style={{ marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
                            {s.listing_agent_phone && <a href={`tel:${telHref(s.listing_agent_phone)}`} style={{ color: C.blue, fontWeight: 700, textDecoration: "none" }}>📞 {s.listing_agent_phone}</a>}
                            {!s.listing_agent_phone && s.listing_office_phone && <a href={`tel:${telHref(s.listing_office_phone)}`} style={{ color: C.blue, fontWeight: 700, textDecoration: "none" }}>📞 Office {s.listing_office_phone}</a>}
                            {s.listing_agent_email && <a href={`mailto:${s.listing_agent_email}`} style={{ color: C.blue, textDecoration: "none", wordBreak: "break-all" }}>✉️ {s.listing_agent_email}</a>}
                          </div>
                        </div>
                      )}
                      {(s.access_info || s.showing_instructions || s.agent_notes) && (
                        <div style={{ marginTop: 8 }}>
                          <button onClick={() => setOpenInfo(prev => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })}
                            style={{ ...ghost({ padding: "5px 10px", fontSize: 12 }) }}>🔐 Access & instructions {infoOpen ? "▲" : "▼"}</button>
                          {infoOpen && (
                            <div style={{ background: C.lightGray, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", marginTop: 6, fontSize: 13.5, color: C.navy, lineHeight: 1.55 }}>
                              {s.access_info && <div><b>Access:</b> {s.access_info}</div>}
                              {s.showing_instructions && <div style={{ marginTop: s.access_info ? 6 : 0, whiteSpace: "pre-wrap" }}><b>Instructions:</b> {s.showing_instructions}</div>}
                              {s.agent_notes && <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}><b>My notes:</b> {s.agent_notes}</div>}
                            </div>
                          )}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                        <a href={navUrl(s)} target="_blank" rel="noreferrer" style={{ ...btn(C.blue), textDecoration: "none", padding: "7px 12px", fontSize: 12.5 }}>🧭 Navigate</a>
                        <ScorecardButton stop={s} open={openCard.has(s.id)} onClick={() => toggleCard(s.id)} />
                        <button onClick={() => writeOffer(s)} disabled={!!busy || offering === s.id} title="Start an offer already filled in from the MLS report"
                          style={{ ...btn(C.red), padding: "7px 12px", fontSize: 12.5 }}>{offering === s.id ? "Starting…" : s.offer_id ? "📝 Open offer" : "📝 Write an offer"}</button>
                        <button onClick={() => startEdit(s)} disabled={!!busy} style={ghost()}>✏️ Edit</button>
                        <button onClick={() => move(i, -1)} disabled={!!busy || i === 0} title="Move earlier" style={ghost({ opacity: i === 0 ? 0.4 : 1 })}>↑</button>
                        <button onClick={() => move(i, 1)} disabled={!!busy || i === stops.length - 1} title="Move later" style={ghost({ opacity: i === stops.length - 1 ? 0.4 : 1 })}>↓</button>
                        <button onClick={() => removeStop(s)} disabled={!!busy} style={ghost({ color: C.darkRed, borderColor: "#FECACA" })}>🗑</button>
                      </div>
                      {openCard.has(s.id) && <HomeScorecard stop={s} viewer="agent" onSave={(patch) => saveFeedback(tour, s, patch)} />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {stops.length > 0 && (
            <div style={{ fontSize: 12, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
              🔐 Door and lockbox codes are only visible to you{tx.coordinatorName ? " and your TC" : ""} — never sent to your buyer — and are erased automatically 3 days after the tour.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// A button with a one-line "what this does for you" next to it (stacks on phones).
function ActionRow({ button, text }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      {button}
      <div style={{ flex: "1 1 220px", fontSize: 12.5, color: C.gray, lineHeight: 1.45 }}>{text}</div>
    </div>
  );
}

function StopForm({ draft, setDraft, onSave, onCancel, busy, isNew }) {
  const f = (k, label, extra = {}) => (
    <div style={extra.full ? { gridColumn: "1 / -1" } : undefined}>
      <label style={lbl}>{label}</label>
      {extra.area
        ? <textarea rows={3} value={draft[k] ?? ""} onChange={e => setDraft(d => ({ ...d, [k]: e.target.value }))} style={{ ...input, resize: "vertical" }} />
        : <input type={extra.type || "text"} value={draft[k] ?? ""} onChange={e => setDraft(d => ({ ...d, [k]: e.target.value }))} style={input} />}
    </div>
  );
  return (
    <div style={{ background: C.white, border: `2px solid ${C.red}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: C.navy, marginBottom: 10 }}>{isNew ? "➕ Add a home" : "✏️ Edit home"}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        {f("address", "Street address *", { full: true })}
        {f("city", "City")}{f("zip", "ZIP")}{f("mls_number", "MLS #")}{f("list_price", "List price")}
        {f("beds", "Beds")}{f("baths", "Baths")}{f("sqft", "Sq ft")}{f("occupancy", "Occupancy")}
        {f("listing_agent_name", "Listing agent")}{f("listing_agent_phone", "Agent phone", { type: "tel" })}
        {f("listing_agent_email", "Agent email", { type: "email" })}{f("listing_office", "Office")}
        {f("appt_start", "Window starts", { type: "time" })}{f("appt_end", "Window ends", { type: "time" })}
        {f("access_info", "🔐 Lockbox / door / gate codes", { full: true })}
        {f("showing_instructions", "Showing instructions", { full: true, area: true })}
        {f("agent_notes", "My notes", { full: true, area: true })}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
        <button onClick={onCancel} style={ghost()}>Cancel</button>
        <button onClick={onSave} disabled={!!busy} style={btn(C.red)}>{busy === "saving" ? "Saving…" : "💾 Save"}</button>
      </div>
    </div>
  );
}
