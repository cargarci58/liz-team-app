import { useState, useEffect, useRef } from "react";

// Shared home scorecard — the SAME card on the agent's 🏠 Showings tab and the
// buyer's 🗺 Showings portal tab. One scorecard per home; whoever fills it in
// (buyer or agent), both see it. Every tap saves on the spot; notes save as you
// type (short pause). `onSave(patch)` → PATCH …/feedback, returns saved row.

export const LIKE_TAGS = ["Kitchen", "Layout", "Natural light", "Big yard", "Pool", "Primary suite", "Updated", "Neighborhood",
  "Quiet street", "Garage", "Storage", "Bathrooms", "Great price", "Move-in ready", "Schools", "Commute"];
export const DISLIKE_TAGS = ["Needs work", "Small rooms", "Dated", "Busy road", "Small yard", "Smell", "Noise", "Odd layout",
  "Too pricey", "HOA", "Roof / AC age", "Dark", "Commute", "No garage", "Neighbors", "Flood zone"];

export const VERDICTS = [
  { id: "love", emoji: "😍", label: "Love it" },
  { id: "maybe", emoji: "🤔", label: "Maybe" },
  { id: "no", emoji: "👎", label: "Not for us" },
];
export const verdictOf = (id) => VERDICTS.find(v => v.id === id) || null;

const K = { red: "#C0392B", darkRed: "#922B21", lightRed: "#FADBD8", gray: "#555555", muted: "#6b7280",
  border: "#e5e7eb", lightGray: "#F9FAFB", blue: "#0c4a6e", lightBlue: "#EEF2F7", white: "#FFFFFF", navy: "#111111" };

function Chip({ on, label, onClick, tone }) {
  const onBg = tone === "like" ? K.blue : K.darkRed;
  return (
    <button type="button" onClick={onClick}
      style={{ padding: "6px 11px", borderRadius: 16, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        border: `1.5px solid ${on ? onBg : K.border}`, background: on ? onBg : K.white, color: on ? "#fff" : K.gray }}>
      {on ? "✓ " : ""}{label}
    </button>
  );
}

export default function HomeScorecard({ stop, onSave, viewer = "agent" }) {
  const [fb, setFb] = useState(() => pick(stop));
  const [saved, setSaved] = useState("");
  const [showNotes, setShowNotes] = useState(!!(stop.liked_notes || stop.disliked_notes));
  const timer = useRef(null);
  useEffect(() => { setFb(pick(stop)); /* refresh when the other side's edit arrives */ }, [stop.id, stop.feedback_at]);

  const push = async (patch) => {
    setSaved("Saving…");
    const row = await onSave(patch);
    setSaved(row ? "✓ Saved" : "Couldn't save — try again");
    if (row) setTimeout(() => setSaved(""), 1500);
  };
  const tap = (patch) => { setFb(f => ({ ...f, ...patch })); push(patch); };
  const toggle = (key, tag) => {
    const cur = fb[key] || [];
    tap({ [key]: cur.includes(tag) ? cur.filter(t => t !== tag) : [...cur, tag] });
  };
  const typeNote = (key, v) => {
    setFb(f => ({ ...f, [key]: v }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => push({ [key]: v }), 900);
  };

  const who = stop.feedback_by_role === "buyer"
    ? (viewer === "buyer" ? "you" : `${stop.feedback_by} (buyer)`)
    : (viewer === "buyer" ? `${stop.feedback_by} (your agent)` : stop.feedback_by);
  const by = stop.feedback_by
    ? `Last updated by ${who}`
    : (viewer === "buyer" ? "Tap as you walk through — your agent sees it too." : "Tap as you tour — your buyer sees these notes too.");

  return (
    <div style={{ marginTop: 10, background: K.lightGray, border: `1px solid ${K.border}`, borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: K.darkRed, textTransform: "uppercase", letterSpacing: "0.04em" }}>📝 Scorecard</div>
        <div style={{ fontSize: 11, color: saved.startsWith("Couldn") ? K.red : K.muted }}>{saved || by}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }} data-keep-grid>
        {VERDICTS.map(v => {
          const on = fb.verdict === v.id;
          return (
            <button type="button" key={v.id} onClick={() => tap({ verdict: on ? null : v.id })}
              style={{ padding: "9px 4px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                border: `2px solid ${on ? K.red : K.border}`, background: on ? K.lightRed : K.white,
                color: on ? K.darkRed : K.gray, fontWeight: 800, fontSize: 12.5, lineHeight: 1.2 }}>
              <div style={{ fontSize: 22 }}>{v.emoji}</div>{v.label}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, color: K.blue, margin: "12px 0 6px" }}>👍 What we liked</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {LIKE_TAGS.map(t => <Chip key={t} label={t} tone="like" on={(fb.liked_tags || []).includes(t)} onClick={() => toggle("liked_tags", t)} />)}
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, color: K.darkRed, margin: "12px 0 6px" }}>👎 What we didn't like</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {DISLIKE_TAGS.map(t => <Chip key={t} label={t} tone="dislike" on={(fb.disliked_tags || []).includes(t)} onClick={() => toggle("disliked_tags", t)} />)}
      </div>

      {!showNotes ? (
        <button type="button" onClick={() => setShowNotes(true)}
          style={{ marginTop: 10, background: "none", border: "none", color: K.blue, fontWeight: 700, fontSize: 12.5, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>✍️ Add notes</button>
      ) : (
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <textarea rows={2} value={fb.liked_notes || ""} onChange={e => typeNote("liked_notes", e.target.value)}
            placeholder="What we liked… (e.g. huge kitchen island, shady backyard)"
            style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${K.border}`, fontSize: 14, fontFamily: "inherit", resize: "vertical" }} />
          <textarea rows={2} value={fb.disliked_notes || ""} onChange={e => typeNote("disliked_notes", e.target.value)}
            placeholder="What we didn't like… (e.g. water stain on ceiling, AC looks old)"
            style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${K.border}`, fontSize: 14, fontFamily: "inherit", resize: "vertical" }} />
        </div>
      )}
    </div>
  );
}

// The closed state: one button that sits next to the offer buttons. Shows the
// verdict + how many things were tapped, so a scored home reads at a glance.
export function ScorecardButton({ stop, open, onClick }) {
  const v = verdictOf(stop.verdict);
  const n = (stop.liked_tags || []).length + (stop.disliked_tags || []).length + (stop.liked_notes ? 1 : 0) + (stop.disliked_notes ? 1 : 0);
  return (
    <button type="button" onClick={onClick}
      style={{ background: open ? K.lightRed : K.white, color: K.darkRed, border: `1.5px solid ${open ? K.red : K.border}`, borderRadius: 8,
        padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
      📝 Scorecard{v ? ` · ${v.emoji}` : ""}{n ? ` · ${n}` : ""} {open ? "▲" : "▼"}
    </button>
  );
}

function pick(s) {
  return { verdict: s.verdict || null, liked_tags: s.liked_tags || [], disliked_tags: s.disliked_tags || [],
    liked_notes: s.liked_notes || "", disliked_notes: s.disliked_notes || "" };
}

// "⭐ Favorites so far" — every toured home across ALL tour days, best first,
// so the buyer can decide at the end. `stops` items carry tour_date.
export function FavoritesSummary({ stops, title = "⭐ Favorites so far" }) {
  const rated = stops.filter(s => s.verdict || (s.liked_tags || []).length || (s.disliked_tags || []).length);
  if (!rated.length) return null;
  const rank = { love: 0, maybe: 1, undefined: 2, null: 2, no: 3 };
  const sorted = [...rated].sort((a, b) => (rank[a.verdict] ?? 2) - (rank[b.verdict] ?? 2)
    || ((b.liked_tags || []).length - (b.disliked_tags || []).length) - ((a.liked_tags || []).length - (a.disliked_tags || []).length));
  return (
    <div style={{ background: K.white, border: `2px solid ${K.red}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: K.navy }}>{title}</div>
      <div style={{ fontSize: 12, color: K.muted, marginTop: 2, marginBottom: 6 }}>Every home you've scored, best first — across all tour days.</div>
      {sorted.map((s, i) => {
        const v = verdictOf(s.verdict);
        return (
          <div key={s.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderTop: i ? `1px solid ${K.border}` : "none" }}>
            <div style={{ fontSize: 22, lineHeight: 1 }}>{v ? v.emoji : "•"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: K.navy, wordBreak: "break-word" }}>{s.address}</div>
              <div style={{ fontSize: 12, color: K.muted }}>{[s.city, s.list_price ? "$" + Number(s.list_price).toLocaleString() : null].filter(Boolean).join(" · ")}</div>
              {(s.liked_tags || []).length > 0 && <div style={{ fontSize: 12.5, color: K.blue, marginTop: 2 }}>👍 {(s.liked_tags || []).join(", ")}</div>}
              {(s.disliked_tags || []).length > 0 && <div style={{ fontSize: 12.5, color: K.darkRed, marginTop: 1 }}>👎 {(s.disliked_tags || []).join(", ")}</div>}
              {s.liked_notes && <div style={{ fontSize: 12.5, color: K.gray, marginTop: 2, fontStyle: "italic" }}>“{s.liked_notes}”</div>}
              {s.disliked_notes && <div style={{ fontSize: 12.5, color: K.gray, marginTop: 1, fontStyle: "italic" }}>“{s.disliked_notes}”</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
