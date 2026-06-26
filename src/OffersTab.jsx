import { useState, useEffect, useRef } from "react";
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

export default function OffersTab({ tx, token, currentUser }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [wizardOfferId, setWizardOfferId] = useState(null);
  const [sendModal, setSendModal] = useState(null);   // offer being sent to listing agent

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

  // View the generated offer packet PDF.
  const viewPacket = async (offerId) => {
    try {
      const r = await fetch(API + "/offers/" + offerId + "/packet-url", { headers: { Authorization: "Bearer " + token } });
      const data = await r.json();
      if (!r.ok || !data.url) throw new Error(data.error || "No packet yet — open the offer and finish the wizard to generate it.");
      window.open(data.url, "_blank");
    } catch (e) { alert(e.message); }
  };

  // Upload the buyer-signed offer (server-proxied), then it attaches when sending.
  const fileRef = useRef(null);
  const [signTarget, setSignTarget] = useState(null);
  const pickSigned = (o) => { setSignTarget(o); setTimeout(() => fileRef.current && fileRef.current.click(), 0); };
  const uploadSigned = async (file) => {
    const o = signTarget;
    setSignTarget(null);
    if (!file || !o) return;
    try {
      const base64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.onerror = rej; fr.readAsDataURL(file); });
      const r = await fetch(API + "/offers/" + o.id + "/upload-signed", {
        method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileType: file.type, base64 }),
      });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || "Upload failed");
      await load();
      // Chain straight into sending — no separate button to hunt for.
      await sendToListing({ ...o, signed_doc_id: data.docId });
    } catch (e) { alert("Error: " + e.message); }
  };

  // Open the approve-and-attach modal to send the offer to the listing agent.
  const sendToListing = (o) => {
    if (!o.signed_doc_id && !o.packet_pdf_key) {
      alert("Nothing to send yet — open the offer to generate the packet, or upload the signed offer first.");
      return;
    }
    setSendModal(o);
  };

  const setOfferStatus = async (offerId, status, label) => {
    if (!confirm("Mark this offer " + label + "?")) return;
    try {
      const r = await fetch(API + "/offers/" + offerId + "/status", {
        method: "PATCH", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || "Failed");
      await load();
    } catch (e) { alert("Error: " + e.message); }
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
            The offer wizard — write/build your buyer's offer (FAR/BAR AS-IS), assemble the packet, and send it to the listing agent.
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
                    <td style={{ padding: "10px 12px" }}>
                      {(() => {
                        const btn = (label, onClick, bg, color) => (
                          <button onClick={onClick} style={{ background: bg, color, border: "none", padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
                        );
                        const active = !["accepted", "rejected", "withdrawn"].includes(o.status);
                        return (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            {btn("Open", () => setWizardOfferId(o.id), "#e5e7eb", "#374151")}
                            {o.packet_pdf_key && btn("📄 Packet", () => viewPacket(o.id), "#e0f2fe", "#075985")}
                            {active && btn("📤 Upload Signed Offer", () => pickSigned(o), "#0c4a6e", "#fff")}
                            {active && o.signed_doc_id && btn(o.status === "sent" ? "📧 Re-send to listing agent" : "📧 Send to listing agent", () => sendToListing(o), "#ede9fe", "#5b21b6")}
                            {(o.status === "ready" || o.status === "sent" || o.status === "countered") && btn("✅ Accepted", () => acceptOffer(o.id), "#16a34a", "#fff")}
                            {(o.status === "sent" || o.status === "countered") && btn("Declined", () => setOfferStatus(o.id, "rejected", "DECLINED by the seller"), "#fee2e2", "#7f1d1d")}
                            {o.status === "accepted" && btn("Undo acceptance", () => unacceptOffer(o.id), "#fef3c7", "#92400e")}
                            {(o.status === "draft" || o.status === "ready") && btn("Delete", () => deleteOffer(o.id), "#fee2e2", "#7f1d1d")}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: "none" }}
        onChange={e => { const f = e.target.files && e.target.files[0]; if (f) uploadSigned(f); e.target.value = ""; }} />

      {sendModal && (
        <SendOfferModal
          offer={sendModal} tx={tx} token={token} currentUser={currentUser}
          onClose={() => setSendModal(null)}
          onSent={() => { setSendModal(null); load(); }}
        />
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

// Approve-and-attach send: review/edit the email to the listing agent, add more
// documents (from the deal or your computer), then send. The signed offer (or the
// packet) is always attached; the listing agent's reply is captured on the deal so
// the AI reads whether it was accepted/countered/rejected.
function SendOfferModal({ offer, tx, token, currentUser, onClose, onSent }) {
  const d = offer.offer_data || {};
  const addr = [d.property_address || tx.address, d.property_city || tx.city].filter(Boolean).join(", ");
  const price = d.purchase_price ? "$" + Number(d.purchase_price).toLocaleString() : "";
  const agentName = currentUser ? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(" ") : "";
  const firstName = (d.listing_agent_name || "there").split(" ")[0];
  const [toEmail, setToEmail] = useState(d.listing_agent_email || "");
  const [toName, setToName] = useState(d.listing_agent_name || "Listing Agent");
  const [subject, setSubject] = useState(`Offer — ${addr || "your listing"}${price ? " — " + price : ""}`);
  // Build a clean summary of the offer terms for the email body.
  const termsLines = (() => {
    const L = [];
    if (d.purchase_price) L.push("• Purchase Price: " + fmtMoney(d.purchase_price));
    if (d.initial_emd) L.push("• Earnest Money: " + fmtMoney(d.initial_emd) + (d.initial_emd_deadline_days ? " (within " + d.initial_emd_deadline_days + " business days)" : ""));
    if (d.additional_emd) L.push("• Additional Deposit: " + fmtMoney(d.additional_emd));
    const ft = d.financing_type || "";
    if (ft === "Cash") L.push("• Financing: Cash — no financing contingency");
    else if (ft) {
      let fin = "• Financing: " + ft;
      if (d.down_payment_pct) fin += " — " + d.down_payment_pct + "% down";
      if (d.down_payment || d.loan_amount) fin += " (" + [d.down_payment ? fmtMoney(d.down_payment) + " down" : null, d.loan_amount ? fmtMoney(d.loan_amount) + " loan" : null].filter(Boolean).join(", ") + ")";
      L.push(fin);
      L.push("• Financing Contingency: Yes");
    }
    if (d.appraisal_contingency) L.push("• Appraisal Contingency: " + (/^\s*no/i.test(d.appraisal_contingency) ? "Waived" : "Yes"));
    if (d.inspection_period_days) L.push("• Inspection Period: " + d.inspection_period_days + " days");
    if (Number(d.closing_costs_paid_by) > 0) L.push("• Seller Credit to Buyer's Closing Costs: " + fmtMoney(d.closing_costs_paid_by));
    if (d.closing_date) L.push("• Closing Date: " + fmtDate(d.closing_date));
    if (d.occupancy_type) L.push("• Possession: " + d.occupancy_type);
    if (d.offer_effective_date) L.push("• Offer Expires (seller to accept by): " + fmtDate(d.offer_effective_date));
    return L;
  })();
  const termsBlock = termsLines.length ? "\n\nSUMMARY OF KEY TERMS:\n" + termsLines.join("\n") + "\n" : "";
  const [message, setMessage] = useState(
    `Hi ${firstName},\n\nPlease find attached my buyer's offer on ${addr || "your listing"}${price ? " at " + price : ""}.${termsBlock}\nThe full offer is attached. I'd appreciate you presenting it to your seller.\n\nThank you,\n${agentName}\n\nP.S. Please reply to this email with your seller's response or any questions — that keeps everything for this offer in one place.`.trim()
  );
  const [attach, setAttach] = useState([]);      // extra docs [{id,name}]
  const [docList, setDocList] = useState(null);
  const [docPicker, setDocPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileRef = useRef(null);

  const baseAttach = offer.signed_doc_id ? "Buyer-signed offer" : offer.packet_pdf_key ? "Offer packet" : null;

  const openDocPicker = () => {
    setDocPicker(true);
    if (docList === null) {
      fetch(API + "/documents/" + tx.id, { headers: { Authorization: "Bearer " + token } })
        .then(r => r.json()).then(dd => setDocList(dd.documents || dd || [])).catch(() => setDocList([]));
    }
  };
  const toggleAttach = (doc) => setAttach(prev => prev.find(a => a.id === doc.id) ? prev.filter(a => a.id !== doc.id) : [...prev, { id: doc.id, name: doc.name }]);
  const uploadFromComputer = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.onerror = rej; fr.readAsDataURL(file); });
      const r = await fetch(API + "/documents/upload", {
        method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: tx.id, fileName: file.name, fileType: file.type, category: "Offer", base64 }),
      });
      const dd = await r.json();
      if (dd.success && dd.docId) { setAttach(prev => [...prev, { id: dd.docId, name: file.name }]); setDocList(null); }
      else alert("Upload failed: " + (dd.error || "unknown error"));
    } catch (e) { alert("Upload error: " + e.message); }
    setUploading(false);
  };

  const send = async () => {
    if (!toEmail.trim() || !/.+@.+\..+/.test(toEmail.trim())) { alert("Enter the listing agent's email."); return; }
    if (!message.trim()) { alert("Write a message."); return; }
    setSending(true);
    try {
      const r = await fetch(API + "/offers/" + offer.id + "/send-to-listing-agent", {
        method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: toEmail.trim(), toName: toName.trim(), subject, message, attachDocIds: attach.map(a => a.id) }),
      });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || "Send failed");
      const attached = Array.isArray(data.attached) ? data.attached.join(", ") : data.attached;
      alert("✅ Sent to " + data.sentTo + (attached ? "\nAttached: " + attached : "") + ".\n\nThe listing agent's reply will appear in this deal's Replies, and the AI will flag whether it's an acceptance. When the seller accepts, click ✅ Accepted to start the transaction.");
      onSent();
    } catch (e) { alert("Error: " + e.message); }
    setSending(false);
  };

  const lbl = { fontSize: 12, fontWeight: 700, color: "#374151", margin: "10px 0 4px" };
  const inp = { width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 4000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, maxWidth: 560, width: "100%", margin: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        <div style={{ background: "#0c4a6e", padding: "16px 20px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>📧 Send offer to listing agent</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>Review and approve before it goes out. {baseAttach ? <><b>{baseAttach}</b> is attached automatically.</> : "⚠️ No signed offer or packet on this offer yet."}</div>

          <div style={lbl}>To (listing agent)</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={toName} onChange={e => setToName(e.target.value)} placeholder="Name" style={{ ...inp, flex: "0 0 40%" }} />
            <input value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="email@brokerage.com" style={{ ...inp, flex: 1 }} />
          </div>

          <div style={lbl}>Subject</div>
          <input value={subject} onChange={e => setSubject(e.target.value)} style={inp} />

          <div style={lbl}>Message</div>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={7} style={{ ...inp, resize: "vertical" }} />

          {/* Attachments */}
          <div style={lbl}>Attachments</div>
          <div style={{ fontSize: 13, color: "#374151", marginBottom: 8 }}>
            {baseAttach && <div>📎 {baseAttach} <span style={{ color: "#16a34a" }}>(included)</span></div>}
            {attach.map(a => (
              <div key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#F0F4FF", border: "1px solid #C7D2FE", borderRadius: 6, padding: "3px 8px", fontSize: 12, color: "#0c4a6e", marginRight: 6, marginTop: 6 }}>
                📄 {a.name}
                <button onClick={() => setAttach(prev => prev.filter(x => x.id !== a.id))} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 14, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
          <input ref={fileRef} type="file" style={{ display: "none" }} onChange={e => { const f = e.target.files && e.target.files[0]; if (f) uploadFromComputer(f); e.target.value = ""; }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={openDocPicker} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid #0c4a6e", background: "#fff", color: "#0c4a6e", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📎 Attach from Documents</button>
            <button onClick={() => fileRef.current && fileRef.current.click()} disabled={uploading} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid #0c4a6e", background: "#fff", color: "#0c4a6e", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: uploading ? 0.5 : 1 }}>{uploading ? "Uploading…" : "💻 Upload from computer"}</button>
          </div>

          {docPicker && (
            <div style={{ marginTop: 10, border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, maxHeight: 220, overflowY: "auto" }}>
              {docList === null ? <div style={{ color: "#6b7280", fontSize: 13 }}>Loading documents…</div>
               : docList.length === 0 ? <div style={{ color: "#6b7280", fontSize: 13 }}>No documents on this deal yet.</div>
               : docList.map(doc => {
                const on = !!attach.find(a => a.id === doc.id);
                return (
                  <label key={doc.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 2px", fontSize: 13, cursor: "pointer" }}>
                    <input type="checkbox" checked={on} onChange={() => toggleAttach(doc)} />
                    <span>📄 {doc.name}{doc.category ? <span style={{ color: "#9ca3af" }}> · {doc.category}</span> : null}</span>
                  </label>
                );
              })}
              <button onClick={() => setDocPicker(false)} style={{ marginTop: 8, width: "100%", background: "#0c4a6e", color: "#fff", border: "none", borderRadius: 8, padding: "8px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Done</button>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button onClick={send} disabled={sending} style={{ flex: 1, background: sending ? "#9ca3af" : "#16a34a", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontWeight: 800, fontSize: 15, cursor: sending ? "wait" : "pointer", fontFamily: "inherit" }}>{sending ? "Sending…" : "📧 Approve & Send"}</button>
            <button onClick={onClose} style={{ background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 8, padding: "12px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
