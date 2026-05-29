import { useState, useEffect } from "react";
import OfferWizard from "./OfferWizard";

const API = "https://liz-team-server-api-production.up.railway.app";

const STATUS_META = {
  draft:      { label: "Draft",      color: "#92400e", bg: "#fef3c7" },
  ready:      { label: "Ready",      color: "#065f46", bg: "#d1fae5" },
  sent:       { label: "Sent",       color: "#1e3a8a", bg: "#dbeafe" },
  countered:  { label: "Countered",  color: "#7c2d12", bg: "#fed7aa" },
  accepted:   { label: "Accepted",   color: "#064e3b", bg: "#a7f3d0" },
  rejected:   { label: "Rejected",   color: "#7f1d1d", bg: "#fecaca" },
  withdrawn:  { label: "Withdrawn",  color: "#374151", bg: "#e5e7eb" },
};

function fmtMoney(n) {
  if (n == null || n === "") return "—";
  const num = Number(n);
  if (!isFinite(num)) return "—";
  return "$" + num.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function OffersTab({ tx, token }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [wizardOfferId, setWizardOfferId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(API + "/transactions/" + tx.id + "/offers", {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed to load offers");
      setOffers(data.offers || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tx.id]);

  const createOffer = async () => {
    setCreating(true);
    setError(null);
    try {
      const r = await fetch(API + "/transactions/" + tx.id + "/offers", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ baseContractType: "as_is" }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed to create offer");
      await load();
      // Open the wizard on the newly-created draft
      if (data.offer && data.offer.id) setWizardOfferId(data.offer.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const deleteOffer = async (offerId) => {
    if (!confirm("Delete this draft offer?")) return;
    try {
      const r = await fetch(API + "/offers/" + offerId, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Delete failed");
      await load();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const acceptOffer = async (offerId) => {
    if (!confirm("Mark this offer ACCEPTED?\n\nThis will:\n• Move the transaction to UNDER CONTRACT\n• Copy the offer's price, closing date, and terms onto the transaction\n• Withdraw any other offers on this transaction\n• Send the welcome emails to ALL assigned parties\n\nMake sure every party (buyer, seller, title, lender…) is assigned with a valid email first.")) return;
    try {
      const r = await fetch(API + "/offers/" + offerId + "/accept", {
        method: "POST", headers: { Authorization: "Bearer " + token },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Accept failed");
      await load();
      alert("✅ Accepted. Transaction is now Under Contract.\nWelcome emails sent: " + (data.emailsSent || 0) + (data.emailsFailed ? " (" + data.emailsFailed + " failed)" : ""));
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const unacceptOffer = async (offerId) => {
    if (!confirm("Undo this acceptance?\n\nThe transaction will revert to its prior status and the other offers will be restored.\n\nNote: welcome emails already sent CANNOT be recalled.")) return;
    try {
      const r = await fetch(API + "/offers/" + offerId + "/unaccept", {
        method: "POST", headers: { Authorization: "Bearer " + token },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Undo failed");
      await load();
      alert(data.note || "Acceptance reverted.");
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>📝 Create Offer</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
            Build buyer offers (FAR/BAR AS-IS), assemble the packet, send to the listing agent.
          </div>
        </div>
        <button onClick={createOffer} disabled={creating}
          style={{ background: creating ? "#9ca3af" : "#0c4a6e", color: "white", border: "none", padding: "10px 18px", borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: creating ? "wait" : "pointer", fontFamily: "inherit" }}>
          {creating ? "Creating..." : "Create Offer"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: 12, fontSize: 13, color: "#7f1d1d", marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>Loading…</div>
      ) : offers.length === 0 ? (
        <div style={{ background: "#f9fafb", border: "2px dashed #d1d5db", borderRadius: 8, padding: 40, textAlign: "center", color: "#6b7280" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
          <div style={{ fontWeight: 700, color: "#374151", marginBottom: 4 }}>No offers yet</div>
          <div style={{ fontSize: 13 }}>Click "Create Offer" to build your first offer for this buyer.</div>
        </div>
      ) : (
        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, color: "#374151" }}>Status</th>
                <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, color: "#374151" }}>Property</th>
                <th style={{ textAlign: "right", padding: "10px 12px", fontWeight: 700, color: "#374151" }}>Offer Price</th>
                <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, color: "#374151" }}>Step</th>
                <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, color: "#374151" }}>Updated</th>
                <th style={{ textAlign: "right", padding: "10px 12px", fontWeight: 700, color: "#374151" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {offers.map(o => {
                const meta = STATUS_META[o.status] || STATUS_META.draft;
                const data = o.offer_data || {};
                return (
                  <tr key={o.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ background: meta.bg, color: meta.color, padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#374151" }}>
                      {data.property_address || tx.address || "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "#111", fontWeight: 600 }}>
                      {fmtMoney(data.purchase_price)}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#6b7280" }}>{o.current_step}/12</td>
                    <td style={{ padding: "10px 12px", color: "#6b7280" }}>{fmtDate(o.updated_at)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <button onClick={() => setWizardOfferId(o.id)}
                        style={{ background: "#e5e7eb", color: "#374151", border: "none", padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginRight: 6 }}>
                        Open
                      </button>
                      {(o.status === "ready" || o.status === "sent" || o.status === "countered") && (
                        <button onClick={() => acceptOffer(o.id)}
                          style={{ background: "#16a34a", color: "white", border: "none", padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginRight: 6 }}>
                          Accepted
                        </button>
                      )}
                      {o.status === "accepted" && (
                        <button onClick={() => unacceptOffer(o.id)}
                          style={{ background: "#fef3c7", color: "#92400e", border: "none", padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginRight: 6 }}>
                          Undo acceptance
                        </button>
                      )}
                      {(o.status === "draft" || o.status === "ready") && (
                        <button onClick={() => deleteOffer(o.id)}
                          style={{ background: "#fee2e2", color: "#7f1d1d", border: "none", padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {wizardOfferId && (
        <OfferWizard
          offerId={wizardOfferId}
          token={token}
          onClose={() => { setWizardOfferId(null); load(); }}
          onSaved={() => load()}
        />
      )}
    </div>
  );
}
