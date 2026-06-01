import { useEffect, useState } from "react";

// Public, no-login page reached from a reminder email's "✓ Mark this done" link.
// Shows the milestone, a big Done button, and a "Still working on it" option.
const API = "https://liz-team-server-api-production.up.railway.app";

export default function MilestoneActionPublic({ urlToken }) {
  const token = urlToken || window.location.pathname.split("/milestone-action/")[1];
  const [state, setState] = useState("loading"); // loading | ready | done | working | expired | error
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(API + "/public/milestone-action/" + encodeURIComponent(token))
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok || !d.success) { setState("expired"); return; }
        setM(d.milestone);
        setState(d.milestone.completed ? "done" : "ready");
      })
      .catch(() => setState("error"));
  }, [token]);

  const act = async (action) => {
    setBusy(true); setMsg("");
    try {
      const r = await fetch(API + "/public/milestone-action/" + encodeURIComponent(token) + "/" + action, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({})
      });
      const d = await r.json();
      if (!r.ok || !d.success) { setMsg(d.message || d.error || "Something went wrong."); setBusy(false); return; }
      setState(action === "done" ? "done" : "working");
    } catch (e) { setMsg("Network error — please try again."); }
    setBusy(false);
  };

  const wrap = (children) => (
    <div style={{ minHeight: "100vh", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "-apple-system,Segoe UI,Roboto,Arial,sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 10px 40px rgba(0,0,0,0.12)", maxWidth: 460, width: "100%", padding: 28, textAlign: "center" }}>
        {children}
      </div>
    </div>
  );

  if (state === "loading") return wrap(<div style={{ color: "#64748B" }}>Loading…</div>);
  if (state === "expired") return wrap(<>
    <div style={{ fontSize: 44, marginBottom: 10 }}>🔗</div>
    <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>This link has expired</div>
    <div style={{ color: "#64748B", fontSize: 14 }}>Please contact your agent and they'll send a fresh one.</div>
  </>);
  if (state === "error") return wrap(<div style={{ color: "#991B1B" }}>Something went wrong. Please try again later.</div>);
  if (state === "done") return wrap(<>
    <div style={{ fontSize: 52, marginBottom: 10 }}>✅</div>
    <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>All set — thank you!</div>
    <div style={{ color: "#475569", fontSize: 14 }}>{m ? `"${m.name}" is marked done.` : ""} Everyone on the transaction has been updated.</div>
  </>);
  if (state === "working") return wrap(<>
    <div style={{ fontSize: 52, marginBottom: 10 }}>👍</div>
    <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Got it — thanks!</div>
    <div style={{ color: "#475569", fontSize: 14 }}>We let your agent know you're on it. We'll check back in a couple of days.</div>
  </>);

  // ready
  const fmt = (d) => d ? new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "TBD";
  return wrap(<>
    <div style={{ fontSize: 13, fontWeight: 700, color: "#64748B", letterSpacing: ".05em", marginBottom: 10 }}>TRANSACTION STEP</div>
    <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 6 }}>{m.name}</div>
    <div style={{ color: "#64748B", fontSize: 14, marginBottom: 2 }}>{m.address}</div>
    {m.due_date && <div style={{ color: "#C0392B", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Due {fmt(m.due_date)}</div>}
    {m.requires_document ? (
      <div style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 10, padding: 14, fontSize: 13, color: "#78350F", margin: "10px 0" }}>
        📎 This step needs a document{m.document_label ? ` (${m.document_label})` : ""}. Please open your portal or contact your agent to finish it.
      </div>
    ) : (
      <button onClick={() => act("done")} disabled={busy}
        style={{ width: "100%", background: "#1E8449", color: "#fff", border: "none", borderRadius: 12, padding: "15px 0", fontWeight: 800, fontSize: 17, cursor: "pointer", marginTop: 8 }}>
        {busy ? "Saving…" : "✓ Yes, this is done"}
      </button>
    )}
    <button onClick={() => act("working")} disabled={busy}
      style={{ width: "100%", background: "#fff", color: "#475569", border: "1.5px solid #CBD5E1", borderRadius: 12, padding: "13px 0", fontWeight: 700, fontSize: 15, cursor: "pointer", marginTop: 10 }}>
      Still working on it
    </button>
    {msg && <div style={{ color: "#991B1B", fontSize: 13, marginTop: 12 }}>{msg}</div>}
  </>);
}
