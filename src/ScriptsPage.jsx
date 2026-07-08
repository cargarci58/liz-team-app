import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

// Agent scripts library. Two sides — these are for the PAYING agent, whichever
// side they're representing (buyer-rep or listing/seller). Brackets like
// [address] / [$405,000] are the agent's to fill in. Statewide-safe: nothing is
// hardcoded to a city, county, or tenant.
//
// NOTE: the listing "Price reduction" scripts are also surfaced as a Win-the-Day
// card (DailyDashboard PRICE_REDUCTION_SCRIPTS) and in agent emails
// (server.js priceReductionScriptsHtml). Keep wording in sync if edited.

const SCRIPT_LIBRARY = {
  listing: {
    label: "Listing agent",
    sub: "When you represent the seller",
    icon: "🏡",
    groups: [
      {
        situation: "Asking for a price reduction",
        why: "The listing has been sitting and the market is signaling the price is high.",
        scripts: [
          { title: "Let the market do the talking",
            body: "“When we listed, we priced on the best information we had at the time. Since then we’ve had [X showings] and [Y offers], and the homes that are selling around us are coming in lower. The market is giving us feedback — and right now it’s telling us we’re priced just ahead of where buyers are. A focused adjustment gets us back in line with what they’re actually paying.”" },
          { title: "The cost of waiting",
            body: "“Every month we hold out for the higher number, you’re still carrying the mortgage, taxes, insurance, and upkeep — and the longer a home sits, the more buyers assume something’s wrong with it. A meaningful reduction now usually nets you more than slowly chasing the market down over the next few months. Let’s get ahead of it instead of falling behind it.”" },
          { title: "Get back in front of buyers",
            body: "“Your listing already had its first big wave of attention, and that wave has passed. A strategic price drop puts you back at the top of buyers’ searches and triggers a fresh round of alerts. If we move from [$405,000] to [$399,000], we cross a search threshold and show up for a whole new set of buyers who never saw it before. Let’s create that second ‘just listed’ moment.”" },
        ],
      },
      {
        situation: "Responding to a low offer",
        why: "Keep the seller from rejecting outright — a live buyer is worth countering.",
        scripts: [
          { title: "Keep them at the table",
            body: "“I know this offer came in lower than we hoped, and it’s easy to feel insulted by it. But a buyer who writes an offer is a buyer who wants the house — that’s something to work with. Let’s counter strong and confident rather than say no. The worst they can do is walk, and right now they’re raising their hand.”" },
          { title: "Anchor to the data",
            body: "“Their number isn’t supported by what’s actually sold nearby — and I can show them that. Let’s counter at [$___], point to the comps, and let the facts do the pushing. We stay firm on value without slamming the door.”" },
        ],
      },
      {
        situation: "Inspection repairs the seller resists",
        why: "Reframe repairs/credits as protecting the closing, not losing money.",
        scripts: [
          { title: "Protect the deal you already have",
            body: "“I understand not wanting to pour money in on the way out. But this buyer is real, financed, and at the table — and if we lose them over [$___], the next buyer will run their own inspection and find the same things. A credit now keeps a sure thing together instead of starting over.”" },
        ],
      },
      {
        situation: "Renewing / extending the listing agreement",
        why: "The agreement (and MLS exposure) is about to lapse.",
        scripts: [
          { title: "Keep your momentum",
            body: "“Our agreement is coming up on [date]. We’ve built up real momentum — showings, feedback, search traffic — and if it lapses the listing drops off the MLS and we lose all of that visibility right when buyers are circling. Let’s extend so nothing goes dark, and I’ll keep doing what’s been working.”" },
        ],
      },
    ],
  },
  buyer: {
    label: "Buyer agent",
    sub: "When you represent the buyer",
    icon: "🔑",
    groups: [
      {
        situation: "Strengthening a competitive offer",
        why: "Multiple offers — help the buyer win without overpaying blindly.",
        scripts: [
          { title: "Win on terms, not just price",
            body: "“Price gets you noticed, but terms get you the house. If we shorten the inspection window, show flexibility on the closing date the seller wants, and put down a stronger deposit, we look like the safest path to closing — and sellers take the sure thing. Let’s make their decision easy.”" },
          { title: "Make a real, decisive move",
            body: "“There are [N] offers on this one, and a soft number just gets us a polite no. If this is the home, let’s come in clean and strong at [$___] so we’re in the final conversation — not the consolation round. I’d rather we win it than wonder about it.”" },
        ],
      },
      {
        situation: "Getting the buyer to act before they lose it",
        why: "Buyer is hesitating on a home that won't last.",
        scripts: [
          { title: "Don’t let the right one pass",
            body: "“This checks the boxes you told me mattered most — [feature], [feature], and the [area]. Homes like this don’t sit, and I’d hate for you to lose it over a day of hesitation and then compare everything else to it for the next three months. Let’s write it up, and we can still walk away during the inspection period if something turns up.”" },
        ],
      },
      {
        situation: "Buyer cold feet / reassurance",
        why: "Nerves before or during a deal — steady them with facts.",
        scripts: [
          { title: "Name the nerves, then the facts",
            body: "“What you’re feeling is completely normal — this is one of the biggest decisions you’ll make, and a little fear means you’re taking it seriously. So let’s look at the facts: the price is supported by the comps, the inspection gave us [result], and your payment fits the budget we set. The feeling is real, but the numbers say this is a sound move.”" },
        ],
      },
      {
        situation: "Low appraisal on the buyer side",
        why: "Appraisal came in under contract price — keep the deal alive.",
        scripts: [
          { title: "Three ways forward",
            body: "“The appraisal came in at [$___], which is [$___] under our price. We’ve got three real options: ask the seller to meet the appraised value, split the gap, or you cover the difference in cash if this is the one. Lenders only lend on the appraised number — so let’s decide which of these fits you and I’ll go negotiate it hard.”" },
        ],
      },
      {
        situation: "Setting expectations in a tight market",
        why: "Low inventory / rising prices — recalibrate early so they're ready.",
        scripts: [
          { title: "Be ready to move",
            body: "“Right now there are more buyers than homes, so the good ones go fast and sometimes over asking. That’s not pressure from me — it’s the market. The way we win in this is to get your financing fully ready, keep your search tight, and be willing to move the same day we find it. When the right one shows up, I want us first in line, not first to think about it.”" },
        ],
      },
    ],
  },
};

const C = {
  red: "#C0392B", darkRed: "#922B21", navy: "#111111",
  gray: "#555555", muted: "#6b7280", border: "#e5e7eb",
  bg: "#F4F4F4", white: "#FFFFFF", lightGray: "#F9FAFB",
};

function ScriptBlock({ s, idx }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try { navigator.clipboard.writeText(s.body); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (e) {}
  };
  return (
    <div style={{ background: C.lightGray, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.red}`,
      borderRadius: 8, padding: "12px 14px", marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.darkRed }}>Script {idx + 1} · {s.title}</div>
        <button onClick={copy} style={{ flexShrink: 0, background: C.white, border: `1px solid ${C.border}`,
          borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700,
          color: copied ? "#1E8449" : C.gray, cursor: "pointer", fontFamily: "inherit" }}>
          {copied ? "✓ Copied" : "📋 Copy"}
        </button>
      </div>
      <div style={{ fontSize: 14, color: C.navy, lineHeight: 1.6 }}>{s.body}</div>
    </div>
  );
}

export default function ScriptsPage({ token, onBack, currentUser }) {
  const [side, setSide] = useState("listing");
  const lib = SCRIPT_LIBRARY[side];
  // The agent's OWN scripts — private, editable, shown above the built-ins.
  const [mine, setMine] = useState([]);
  const [editing, setEditing] = useState(null); // {} = new, {id,...} = edit
  const [saving, setSaving] = useState(false);
  const hdrs = { "Content-Type": "application/json", Authorization: "Bearer " + (token || "") };
  const loadMine = () => fetch(API + "/scripts", { headers: hdrs }).then(r => r.json())
    .then(d => { if (d.success) setMine(d.scripts || []); }).catch(() => {});
  useEffect(() => { loadMine(); }, []);
  const saveScript = async () => {
    if (!editing.body || !editing.body.trim()) { alert("Write the script text first."); return; }
    setSaving(true);
    try {
      const url = editing.id ? API + "/scripts/" + editing.id : API + "/scripts";
      const r = await fetch(url, { method: editing.id ? "PUT" : "POST", headers: hdrs,
        body: JSON.stringify({ side, situation: editing.situation || "", title: editing.title || "", body: editing.body }) });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Save failed");
      setEditing(null); loadMine();
    } catch (e) { alert("Could not save: " + e.message); }
    setSaving(false);
  };
  const deleteScript = async (sc) => {
    if (!window.confirm(`Delete your script "${sc.title || "Untitled"}"?`)) return;
    try { await fetch(API + "/scripts/" + sc.id, { method: "DELETE", headers: hdrs }); loadMine(); } catch {}
  };
  const myScripts = mine.filter(m => m.side === side);

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: C.bg, minHeight: "100vh" }}>
      <div style={{ background: C.navy, padding: "16px 24px", display: "flex", alignItems: "center", gap: 16,
        position: "sticky", top: 0, zIndex: 100, flexWrap: "wrap" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 22, opacity: 0.7 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>📜 Agent Scripts</div>
          <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>Ready-to-use talking points for your side of the deal</div>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px 60px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }} data-keep-grid>
          {["listing", "buyer"].map(s => {
            const active = side === s;
            const o = SCRIPT_LIBRARY[s];
            return (
              <button key={s} onClick={() => setSide(s)} style={{ flex: 1, padding: "12px 10px", borderRadius: 10,
                border: `2px solid ${active ? C.red : C.border}`, background: active ? "#FADBD8" : C.white,
                color: active ? C.darkRed : C.gray, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                {o.icon} {o.label}
                <div style={{ fontSize: 11, fontWeight: 500, marginTop: 2, opacity: 0.85 }}>{o.sub}</div>
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
          These are for you — the agent who owns this account. Fill in the <b>[brackets]</b> with the deal’s details, then make it a conversation, not a pitch.
        </div>

        {/* MY SCRIPTS — the agent's own, above the built-in library */}
        <div style={{ background: C.white, border: `2px dashed ${C.red}`, borderRadius: 12, padding: "16px 18px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>⭐ My Scripts</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Your own words, saved for reuse — only you see these.</div>
            </div>
            <button onClick={() => setEditing({ situation: "", title: "", body: "" })}
              style={{ background: C.red, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              ➕ Add a script
            </button>
          </div>
          {myScripts.length === 0 && !editing && (
            <div style={{ fontSize: 13, color: C.muted, marginTop: 12, fontStyle: "italic" }}>Nothing saved yet — add the lines that work for YOU and they'll live here on both phone and desktop.</div>
          )}
          {myScripts.map((sc, i) => (
            <div key={sc.id}>
              {sc.situation && <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginTop: 12 }}>{sc.situation}</div>}
              <ScriptBlock s={sc} idx={i} />
              <div style={{ display: "flex", gap: 8, marginTop: 4, justifyContent: "flex-end" }}>
                <button onClick={() => setEditing({ ...sc })} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600, color: C.gray, cursor: "pointer", fontFamily: "inherit" }}>✏️ Edit</button>
                <button onClick={() => deleteScript(sc)} style={{ background: "none", border: "1px solid #FECACA", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600, color: "#B91C1C", cursor: "pointer", fontFamily: "inherit" }}>🗑 Delete</button>
              </div>
            </div>
          ))}
          {editing && (
            <div style={{ marginTop: 14, background: C.lightGray, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.navy, marginBottom: 8 }}>{editing.id ? "Edit script" : "New script"} · {lib.label}</div>
              <input value={editing.situation || ""} onChange={e => setEditing(v => ({ ...v, situation: e.target.value }))}
                placeholder="Situation (optional) — e.g. Seller wants to overprice"
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: "inherit", marginBottom: 8 }} />
              <input value={editing.title || ""} onChange={e => setEditing(v => ({ ...v, title: e.target.value }))}
                placeholder="Short name — e.g. The 90-day math"
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: "inherit", marginBottom: 8 }} />
              <textarea value={editing.body || ""} onChange={e => setEditing(v => ({ ...v, body: e.target.value }))} rows={5}
                placeholder="The script itself. Use [brackets] for the parts you'll customize per deal."
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", resize: "vertical", marginBottom: 10 }} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setEditing(null)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, color: C.gray, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                <button onClick={saveScript} disabled={saving} style={{ background: "#1E8449", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.6 : 1 }}>
                  {saving ? "Saving…" : "💾 Save script"}
                </button>
              </div>
            </div>
          )}
        </div>

        {lib.groups.map((g, gi) => (
          <div key={gi} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px", marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{g.situation}</div>
            {g.why && <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{g.why}</div>}
            {g.scripts.map((s, si) => <ScriptBlock key={si} s={s} idx={si} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
