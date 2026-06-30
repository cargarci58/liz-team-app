// Prominent "new messages" inbox for the home screen — so a user with many deal
// cards sees, in ONE place, every transaction that has an unread chat. Reuses the
// unread counts already polled in MainApp; opens the deal's chat on click.
export default function UnreadMessagesInbox({ unreadCounts, inboundCounts = {}, transactions, onOpen }) {
  const addr = {};
  (transactions || []).forEach(t => { addr[t.id] = t.address; });
  // ANY message — in-app chat OR an inbound client reply. Only deals in the loaded
  // pipeline, so every row resolves to a real address and OPENS cleanly (an unread
  // on a deal the user can't open — e.g. a party-but-not-coordinator on a closed
  // deal — would otherwise dead-end on "couldn't open that transaction").
  const merged = {};
  for (const [id, n] of Object.entries(unreadCounts || {})) if (n > 0 && addr[id]) merged[id] = (merged[id] || 0) + n;
  for (const [id, n] of Object.entries(inboundCounts || {})) if (n > 0 && addr[id]) merged[id] = (merged[id] || 0) + n;
  const inbox = Object.entries(merged)
    .map(([txId, n]) => ({ txId, n, address: addr[txId], kind: (inboundCounts || {})[txId] > 0 ? "replies" : "chat" }))
    .sort((a, b) => b.n - a.n);
  if (inbox.length === 0) return null;
  const total = inbox.reduce((s, x) => s + x.n, 0);
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "8px 16px 0" }}>
      <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#B91C1C", marginBottom: 10 }}>
          💬 New messages — {total} unread across {inbox.length} deal{inbox.length === 1 ? "" : "s"}
        </div>
        {inbox.map(it => (
          <div key={it.txId} onClick={() => onOpen && onOpen(it.txId, it.kind)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#fff", border: "1px solid #FECACA", borderRadius: 10, marginBottom: 8, cursor: "pointer" }}>
            <span style={{ background: "#C0392B", color: "#fff", borderRadius: 20, minWidth: 24, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, padding: "0 7px" }}>{it.n}</span>
            <span style={{ flex: 1, minWidth: 0, fontWeight: 700, color: "#1a2332", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.address}{it.kind === "replies" ? " · 📥 client reply" : ""}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#B91C1C", whiteSpace: "nowrap" }}>Open →</span>
          </div>
        ))}
      </div>
    </div>
  );
}
