import React, { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

const COLORS = {
  navy: "#1a2332", red: "#c8102e", green: "#1e8449", amber: "#b7770d",
  bg: "#f7f8fa", border: "#e3e6eb", text: "#1a2332", muted: "#6b7280"
};

const money = (n) => (n || n === 0) ? "$" + Number(n).toLocaleString() : "—";
const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  catch { return d; }
};

// Public page — sellers open the secure link to review all offers on their
// listing side-by-side and Accept/Decline each. No login. Nothing here changes
// the transaction; the agent makes the final acceptance in the app.
export default function OfferReviewPublic({ token: urlToken }) {
  const token = urlToken || window.location.pathname.split("/review-offers/")[1];
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    fetch(`${API}/public/offer-review/${token}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) throw new Error(d.error || "Could not load offers");
        setData(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [token]);

  const decide = async (offerId, decision) => {
    const verb = decision === "accepted" ? "ACCEPT" : "DECLINE";
    if (!window.confirm(`${verb} this offer?\n\nThis lets your agent know your choice. Your agent will finalize the acceptance.`)) return;
    setBusyId(offerId);
    try {
      const r = await fetch(`${API}/public/offer-review/${token}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId, decision })
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || "Could not save your choice");
      load();
    } catch (e) { alert(e.message); }
    finally { setBusyId(null); }
  };

  const wrap = { fontFamily: "'Segoe UI', system-ui, sans-serif", background: COLORS.bg, minHeight: "100vh", padding: 20 };

  if (loading) return <div style={wrap}><div style={{ maxWidth: 760, margin: "40px auto", textAlign: "center", color: COLORS.muted }}>Loading offers…</div></div>;
  if (error) return <div style={wrap}><div style={{ maxWidth: 560, margin: "40px auto", background: "#fff", border: "1px solid " + COLORS.border, borderRadius: 12, padding: 28, textAlign: "center" }}>
    <div style={{ fontSize: 40, marginBottom: 10 }}>🔒</div>
    <div style={{ fontWeight: 700, color: COLORS.navy, fontSize: 18, marginBottom: 6 }}>Can't open this link</div>
    <div style={{ color: COLORS.muted, fontSize: 14 }}>{error}</div>
  </div></div>;

  const offers = data.offers || [];
  const prop = data.property || {};

  return (
    <div style={wrap}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ background: COLORS.navy, color: "#fff", borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, opacity: 0.8, letterSpacing: 1, fontWeight: 600 }}>OFFERS FOR YOUR REVIEW</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{prop.address || "Your listing"}</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>{[prop.city, prop.state, prop.zip].filter(Boolean).join(", ")}</div>
        </div>

        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#1E3A8A" }}>
          Below are the offers received on your property. Review them and mark each <strong>Accept</strong> or <strong>Decline</strong>. This notifies your agent of your choice — your agent finalizes the acceptance.
        </div>

        {offers.length === 0 && (
          <div style={{ background: "#fff", border: "1px solid " + COLORS.border, borderRadius: 12, padding: 28, textAlign: "center", color: COLORS.muted }}>
            No offers to review yet. Your agent will let you know when one arrives.
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {offers.map((o, i) => {
            const decided = o.sellerDecision;
            return (
              <div key={o.id} style={{ background: "#fff", border: "1px solid " + COLORS.border, borderRadius: 12, padding: 18, borderTop: `4px solid ${decided === "accepted" ? COLORS.green : decided === "declined" ? COLORS.red : COLORS.amber}` }}>
                <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Offer {i + 1}{o.buyerName ? " · " + o.buyerName : ""}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: COLORS.navy, margin: "6px 0 12px" }}>{money(o.contractPrice)}</div>
                <table style={{ width: "100%", fontSize: 13, color: COLORS.text, borderCollapse: "collapse" }}>
                  <tbody>
                    <tr><td style={{ color: COLORS.muted, padding: "3px 0" }}>Closing</td><td style={{ textAlign: "right", fontWeight: 600 }}>{fmtDate(o.closingDate)}</td></tr>
                    <tr><td style={{ color: COLORS.muted, padding: "3px 0" }}>Earnest money</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(o.earnestMoney)}</td></tr>
                    <tr><td style={{ color: COLORS.muted, padding: "3px 0" }}>Financing</td><td style={{ textAlign: "right", fontWeight: 600 }}>{o.isCash ? "Cash" : (o.loanType || "Financed")}</td></tr>
                    <tr><td style={{ color: COLORS.muted, padding: "3px 0" }}>Inspection</td><td style={{ textAlign: "right", fontWeight: 600 }}>{o.inspectionPeriodDays ? o.inspectionPeriodDays + " days" : "—"}</td></tr>
                    <tr><td style={{ color: COLORS.muted, padding: "3px 0" }}>Appraisal contingency</td><td style={{ textAlign: "right", fontWeight: 600 }}>{o.appraisalContingency ? "Yes" : "No"}</td></tr>
                    <tr><td style={{ color: COLORS.muted, padding: "3px 0" }}>Financing contingency</td><td style={{ textAlign: "right", fontWeight: 600 }}>{o.financingContingency ? "Yes" : "No"}</td></tr>
                  </tbody>
                </table>
                {o.additionalTerms && (
                  <div style={{ marginTop: 10, fontSize: 12, color: COLORS.text, background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, padding: "8px 10px", whiteSpace: "pre-wrap" }}>
                    <strong>Additional terms:</strong> {o.additionalTerms}
                  </div>
                )}
                {decided ? (
                  <div style={{ marginTop: 14, textAlign: "center", fontWeight: 700, color: decided === "accepted" ? COLORS.green : COLORS.red }}>
                    You {decided === "accepted" ? "accepted" : "declined"} this offer
                    <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 400, marginTop: 2 }}>You can change your choice below</div>
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button disabled={busyId === o.id} onClick={() => decide(o.id, "accepted")} style={{ flex: 1, background: COLORS.green, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: busyId === o.id ? 0.6 : 1 }}>✓ Accept</button>
                  <button disabled={busyId === o.id} onClick={() => decide(o.id, "declined")} style={{ flex: 1, background: "#fff", color: COLORS.red, border: "1px solid " + COLORS.border, borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: busyId === o.id ? 0.6 : 1 }}>Decline</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
