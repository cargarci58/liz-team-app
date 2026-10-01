// DEAL SHARING badge (co-shared / referral) — same rule as shareBadge() in
// App.jsx, for screens outside it (Win-the-Day, TC portal). Loud on purpose so a
// shared deal is never mistaken for a solo one.
export function shareBadge(x) {
  const t = x?.dealShareType || x?.deal_share_type;
  const ps = x?.sharePartners || x?.share_partners || [];
  const names = (kind) => ps.filter(p => p && p.kind === kind).map(p => p.name).filter(Boolean);
  if (t === "co_shared") { const n = names("co_agent"); return { label: `🤝 CO-SHARED${n.length ? " · with " + n.join(", ") : ""}`, color: "#FFFFFF", bg: "#0c4a6e" }; }
  if (t === "referral_in") { const n = names("referral_in"); return { label: `↘️ REFERRAL IN${n.length ? " · from " + n[0] : ""}`, color: "#FFFFFF", bg: "#922B21" }; }
  if (t === "referral_out") { const n = names("referral_out"); return { label: `↗️ REFERRAL OUT${n.length ? " · to " + n[0] : ""}`, color: "#FFFFFF", bg: "#922B21" }; }
  return null;
}
export function ShareBadge({ of, size = 10 }) {
  const b = shareBadge(of);
  if (!b) return null;
  return <span style={{ background: b.bg, color: b.color, fontSize: size, fontWeight: 800, padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap" }}>{b.label}</span>;
}
