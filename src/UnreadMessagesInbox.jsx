// Prominent "new messages" inbox for the home screen — so a user with many deal
// cards sees, in ONE place, every transaction that has an unread chat. Reuses the
// unread counts already polled in MainApp; opens the deal's chat on click.
export default function UnreadMessagesInbox({ unreadCounts, transactions, onOpen }) {
  const addr = {};
  (transactions || []).forEach(t => { addr[t.id] = t.address; });
  const inbox = Object.entries(unreadCounts || {})
    .filter(([, n]) => n > 0)
    .map(([txId, n]) => ({ txId, n, address: addr[txId] || "A transaction" }))
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
          <div key={it.txId} onClick={() => onOpen && onOpen(it.txId, "chat")}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#fff", border: "1px solid #FECACA", borderRadius: 10, marginBottom: 8, cursor: "pointer" }}>
            <span style={{ background: "#C0392B", color: "#fff", borderRadius: 20, minWidth: 24, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, padding: "0 7px" }}>{it.n}</span>
            <span style={{ flex: 1, minWidth: 0, fontWeight: 700, color: "#1a2332", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.address}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#B91C1C", whiteSpace: "nowrap" }}>Open chat →</span>
          </div>
        ))}
      </div>
    </div>
  );
}
