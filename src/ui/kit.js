// ═══════════════════════════════════════════════════════════════
// UI kit — ONE meaning per colour, ONE look per kind of button.
//
// Tester review (10/1): the same action looked different on different screens
// (green "Mark Done" here, red "Mark Complete" there), red was used for routine
// actions (red reads as danger/error), and "Waive" looked like a warning.
// The rules:
//   • Blue  (#0c4a6e)  = the normal "do it" action (primary) and links.
//   • Red   (#C0392B)  = the TransactPro brand, and DELETE / DESTRUCTIVE actions only.
//   • Green            = something is DONE (status), never a button colour.
//   • Amber            = needs attention soon (warnings), never a button colour.
//   • White + border   = secondary / alternative actions (Waive, Cancel, Skip).
// Text colours here all meet WCAG 2.2 AA (4.5:1) on white and on #F4F4F4.
// ═══════════════════════════════════════════════════════════════

export const UI = {
  blue: "#0c4a6e", blueHover: "#083344", blueBg: "#E0F2FE",
  red: "#C0392B", redDark: "#922B21", redBg: "#FDEDEC",
  green: "#1E7B45", greenBg: "#E8F5EC",
  amber: "#8A5A00", amberBg: "#FFF7E0", amberBorder: "#E8C163",
  text: "#1F2937", muted: "#4B5563", faint: "#5F6B7A",
  border: "#D1D5DB", gray: "#F4F4F4", white: "#FFFFFF", disabled: "#9CA3AF",
};

const base = (small) => ({
  padding: small ? "6px 12px" : "10px 16px",
  borderRadius: 8, fontSize: small ? 12.5 : 14, fontWeight: 700,
  cursor: "pointer", fontFamily: "inherit", lineHeight: 1.2,
});

// btn("primary" | "secondary" | "text" | "danger", { small, disabled })
export function btn(kind = "primary", { small = false, disabled = false } = {}) {
  const b = base(small);
  let s;
  if (kind === "secondary") s = { ...b, background: UI.white, color: UI.blue, border: `1.5px solid ${UI.blue}` };
  else if (kind === "text") s = { ...b, background: "none", color: UI.blue, border: "1.5px solid transparent", textDecoration: "underline", padding: small ? "6px 4px" : "10px 6px" };
  else if (kind === "danger") s = { ...b, background: UI.red, color: UI.white, border: `1.5px solid ${UI.red}` };
  else if (kind === "neutral") s = { ...b, background: UI.white, color: UI.text, border: `1.5px solid ${UI.border}` };
  else s = { ...b, background: UI.blue, color: UI.white, border: `1.5px solid ${UI.blue}` };
  if (disabled) {
    s = { ...s, cursor: "not-allowed", opacity: 1 };
    if (kind === "primary" || kind === "danger") s = { ...s, background: UI.disabled, border: `1.5px solid ${UI.disabled}`, color: UI.white };
    else s = { ...s, color: "#6B7280", border: `1.5px solid ${UI.border}` };
  }
  return s;
}

// notice("urgent" | "warning" | "info" | "success") — box style for messages.
// Only "urgent" is red. Plain information is calm gray/blue so it doesn't
// compete with the things that really need attention.
export function notice(kind = "info") {
  const b = { borderRadius: 10, padding: "10px 14px", fontSize: 13.5, lineHeight: 1.5 };
  if (kind === "urgent") return { ...b, background: UI.redBg, border: `1px solid #F5B7B1`, borderLeft: `4px solid ${UI.red}`, color: UI.redDark };
  if (kind === "warning") return { ...b, background: UI.amberBg, border: `1px solid ${UI.amberBorder}`, color: UI.amber };
  if (kind === "success") return { ...b, background: UI.greenBg, border: "1px solid #B7DFC4", color: UI.green };
  return { ...b, background: "#F8FAFC", border: `1px solid #E2E8F0`, color: UI.muted };
}

// The ONE label for finishing a step, everywhere in the app.
export const MARK_COMPLETE = "Mark Complete";
