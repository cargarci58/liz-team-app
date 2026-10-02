// ═══════════════════════════════════════════════════════════════
// BackButton — the ONE way to leave a page, everywhere in the app.
//
// Carlos 10/1: some pages had a bare "←", Money had a boxed "← Back", others a
// blue "← Back to Dashboard" link, the TC portal a gray "← All deals" — six
// styles for one job, and the bare arrow was easy to miss. Rules:
//   • Same look: arrow + words in an outlined box. Same place: top-left, first
//     thing on the page. Big enough to tap on a phone (40px tall).
//   • It names where it goes when that's fixed ("← My Deals"); plain "← Back"
//     only for screens that close back to whatever page was underneath.
//   • tone="dark" on dark headers (white outline), "light" on light pages (blue).
//   • NOT for steps inside a form/wizard ("previous step") or for closing a
//     pop-up (×) — those are different jobs and must not look like this.
// ═══════════════════════════════════════════════════════════════
import { UI } from "./kit";

export default function BackButton({ onClick, to = "", tone = "light", style = {} }) {
  const dark = tone === "dark";
  const label = to ? to : "Back";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={to ? `Back to ${to}` : "Go back"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, whiteSpace: "nowrap",
        minHeight: 40, padding: "8px 14px", borderRadius: 8, cursor: "pointer",
        fontFamily: "inherit", fontSize: 14, fontWeight: 700, lineHeight: 1.1,
        background: dark ? "rgba(255,255,255,0.10)" : UI.white,
        color: dark ? "#ffffff" : UI.blue,
        border: `1.5px solid ${dark ? "rgba(255,255,255,0.55)" : UI.blue}`,
        ...style,
      }}>
      <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>←</span>
      <span>{label}</span>
    </button>
  );
}
