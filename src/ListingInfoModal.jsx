import React, { useEffect, useState } from "react";
const API = "https://liz-team-server-api-production.up.railway.app";

// In-app listing-agreement info form (Carlos 8/4): the agent answers these
// directly — right after creating a listing (skippable) or any time from the
// deal. Same questions/whitelist as the "Ask the agent" magic link, which
// stays for the TC/assistant case. The listing-package wizard picks every
// answer up automatically.
export default function ListingInfoModal({ txId, onClose }) {
  const token = localStorage.getItem("tp_token") || "";
  const [data, setData] = useState(null);
  const [values, setValues] = useState({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API}/transactions/${txId}/listing-info`, { headers: { Authorization: "Bearer " + token } })
      .then(r => r.json())
      .then(d => { if (d.success) setData(d); else setErr(d.error || "Could not load"); })
      .catch(() => setErr("Could not load — check your connection."));
  }, [txId]);

  const save = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${API}/transactions/${txId}/listing-info`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ values }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || "Could not save");
      window.dispatchEvent(new Event("tp:listing-info-saved"));
      onClose(d.applied?.length || 0);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const isDate = (k) => k === "terminationDate" || k === "beginDate";
  const isLong = (k) => k === "additionalTerms" || k === "personalProperty";
  const missing = data ? data.fields.filter(f => f.current == null || String(f.current).trim() === "").length : 0;

  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) e.currentTarget.dataset.dob = "1"; else delete e.currentTarget.dataset.dob; }}
      onClick={e => { if (e.target === e.currentTarget && e.currentTarget.dataset.dob === "1") onClose(0); delete e.currentTarget.dataset.dob; }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 10050, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 560, margin: "24px auto", overflow: "hidden", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <div style={{ background: "#0F2044", color: "#fff", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>📋 Listing agreement info</div>
            {data && <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{data.address}{missing > 0 ? ` · ${missing} answer${missing === 1 ? "" : "s"} still blank` : " · all filled in ✓"}</div>}
          </div>
          <button onClick={() => onClose(0)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.8)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 18, maxHeight: "70vh", overflowY: "auto" }}>
          {!data && !err && <div style={{ color: "#6b7280", padding: 20, textAlign: "center" }}>Loading…</div>}
          {err && !data && <div style={{ color: "#b91c1c", padding: 12 }}>⚠️ {err}</div>}
          {data && (
            <>
              <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 14, lineHeight: 1.5 }}>
                These answers go straight onto the listing agreement and the rest of the listing package. Fill what you know — everything is optional and you can come back any time.
              </div>
              {data.fields.map(f => (
                <div key={f.key} style={{ marginBottom: 13 }}>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBottom: 4, color: "#111" }}>{f.label}</label>
                  {isLong(f.key) ? (
                    <textarea defaultValue={f.current ?? ""} rows={2}
                      onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                      style={{ width: "100%", padding: "10px 12px", fontSize: 14, borderRadius: 9, border: "1px solid #d1d5db", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }} />
                  ) : (
                    <input type={isDate(f.key) ? "date" : "text"} defaultValue={f.current ?? ""}
                      placeholder={f.key === "price" ? "e.g. 450000" : /Pct|Comp/.test(f.key) ? "e.g. 2.5" : ""}
                      onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                      style={{ width: "100%", padding: "10px 12px", fontSize: 14, borderRadius: 9, border: "1px solid #d1d5db", boxSizing: "border-box" }} />
                  )}
                </div>
              ))}
              {err && <div style={{ color: "#b91c1c", marginBottom: 10 }}>⚠️ {err}</div>}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={() => onClose(0)} disabled={busy}
                  style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid #d1d5db", background: "#fff", color: "#374151", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                  Skip for now
                </button>
                <button onClick={save} disabled={busy}
                  style={{ flex: 2, padding: "12px 0", borderRadius: 10, border: "none", background: "#1E8449", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}>
                  {busy ? "Saving…" : "✓ Save answers"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Small card for a listing deal's Overview: shows how many agreement answers
// are still blank and opens the form. Hides itself once everything is filled.
export function ListingInfoCard({ txId }) {
  const token = localStorage.getItem("tp_token") || "";
  const [missing, setMissing] = useState(null);
  const [open, setOpen] = useState(false);
  const load = () => {
    fetch(`${API}/transactions/${txId}/listing-info`, { headers: { Authorization: "Bearer " + token } })
      .then(r => r.json()).then(d => { if (d.success) setMissing(d.missing); })
      .catch(() => {});
  };
  useEffect(() => { load(); }, [txId]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener("tp:listing-info-saved", h);
    return () => window.removeEventListener("tp:listing-info-saved", h);
  }, [txId]);
  if (missing == null || missing === 0) return null;
  return (
    <>
      <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "12px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13.5, color: "#78350f" }}>📋 Listing agreement info — {missing} answer{missing === 1 ? "" : "s"} needed</div>
          <div style={{ fontSize: 12, color: "#92400e", marginTop: 2 }}>Fill these in once and the listing package builds itself from them.</div>
        </div>
        <button onClick={() => setOpen(true)}
          style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "#b45309", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
          Complete listing info →
        </button>
      </div>
      {open && <ListingInfoModal txId={txId} onClose={() => setOpen(false)} />}
    </>
  );
}
