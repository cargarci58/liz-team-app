import { useState, useEffect, useRef } from "react";
import OfferWizard from "./OfferWizard";
import { WelcomeEmailPreview } from "./App"; // review-gated welcome emails after Accept (safe: OffersTab is lazy-loaded)

const API = "https://liz-team-server-api-production.up.railway.app";

// The contract only shows SIGNATURE dates — FL FAR/BAR says the clock starts when
// the fully-signed copy is DELIVERED to all parties, which only the agent knows.
// Ask, defaulting to what was read; applying recomputes the whole timeline.
function EffectiveDateConfirm({ txId, token, readDate }) {
  const [date, setDate] = useState((readDate || "").slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const apply = async () => {
    setBusy(true);
    try {
      const r = await fetch(API + "/transactions/" + txId + "/effective-date", {
        method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const d = await r.json(); if (!r.ok || !d.success) throw new Error(d.error || "Could not save");
      setDone(date);
    } catch (e) { alert("Error: " + e.message); }
    setBusy(false);
  };
  if (done) return <div style={{ color: "#065f46", fontWeight: 600 }}>✓ Effective date set to {fmtDate(done)} — deadlines and timeline recomputed.</div>;
  return (
    <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "10px 12px", margin: "6px 0" }}>
      <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 4 }}>⚠️ Confirm the effective date</div>
      <div style={{ fontSize: 12.5, color: "#78350f", marginBottom: 8 }}>
        The contract's last signature is dated <b>{readDate ? fmtDate(readDate) : "—"}</b>, but under FL FAR/BAR the contract becomes effective when <b>all parties receive the fully-signed copy</b>. When was that?
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }} />
        <button onClick={apply} disabled={busy || !date}
          style={{ background: "#b45309", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy ? "Saving…" : "✓ Set effective date"}
        </button>
      </div>
    </div>
  );
}

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

export default function OffersTab({ tx, token, currentUser, createSignal = 0 }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [wizardOfferId, setWizardOfferId] = useState(null);
  const [sendModal, setSendModal] = useState(null);   // offer being sent to listing agent
  const [signModal, setSignModal] = useState(null);   // offer being sent for buyer e-signature

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

  // The toolbar "📝 Create Offer" button (in the transaction header) drives offer
  // creation now — when it's clicked it bumps createSignal and we create here.
  useEffect(() => {
    if (createSignal > 0) createOffer();
    /* eslint-disable-next-line */
  }, [createSignal]);

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
    if (!confirm("Mark this offer ACCEPTED?\n\nThis will:\n• Move the transaction to UNDER CONTRACT\n• Copy the offer's price, closing date, and terms onto the transaction\n• Withdraw any other offers on this transaction\n\nNOTHING is emailed yet — next you'll REVIEW the welcome emails and choose exactly what goes out.")) return;
    try {
      const r = await fetch(API + "/offers/" + offerId + "/accept", {
        method: "POST", headers: { Authorization: "Bearer " + token },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Accept failed");
      await load();
      // Review-gated welcome emails: open the preview so the agent approves
      // each email before anything is sent (accept itself sends nothing).
      setShowWelcomePreview(true);
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  // Preview the SIGNED offer package (signatures + certificate) before sending.
  const viewSignedDoc = async (docId) => {
    try {
      const r = await fetch(API + "/documents/" + docId + "/view-url", { headers: { Authorization: "Bearer " + token } });
      const data = await r.json();
      if (!r.ok || !data.viewUrl) throw new Error(data.error || "Signed offer not available yet");
      window.open(data.viewUrl, "_blank");
    } catch (e) { alert(e.message); }
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
  const [showWelcomePreview, setShowWelcomePreview] = useState(false);
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

  // Upload the FULLY-EXECUTED contract on an accepted offer; the server has AI
  // re-read it (terms + dates applied, timeline rebuilt) and verify signatures.
  const execRef = useRef(null);
  const [execTarget, setExecTarget] = useState(null);
  const [execBusy, setExecBusy] = useState(false);
  const [execResult, setExecResult] = useState(null); // { offerId, verify }
  const pickExecuted = (o) => { setExecTarget(o); setTimeout(() => execRef.current && execRef.current.click(), 0); };
  const uploadExecuted = async (file) => {
    const o = execTarget;
    setExecTarget(null);
    if (!file || !o) return;
    setExecBusy(true); setExecResult(null);
    try {
      const base64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.onerror = rej; fr.readAsDataURL(file); });
      const r = await fetch(API + "/offers/" + o.id + "/upload-executed", {
        method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileType: file.type, base64 }),
      });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || "Upload failed");
      setExecResult({ offerId: o.id, verify: data.verify || null });
      await load();
    } catch (e) { alert("Error: " + e.message); }
    setExecBusy(false);
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
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>📝 Offers</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
          {creating ? "Creating your offer…" : "Build your buyer's offer (FAR/BAR AS-IS), assemble the packet, and send it to the listing agent. Use the 📝 Create Offer button at the top to start a new one."}
        </div>
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
          <div style={{ fontSize: 13 }}>Use the 📝 Create Offer button at the top of this transaction to build your first offer.</div>
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
                      {o.signing_status === "out_for_signature" && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#86198f", marginTop: 4 }}>✍️ awaiting buyer signature(s)</div>
                      )}
                      {o.signing_status === "signed" && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#15803d", marginTop: 4 }}>✍️ signed in-app</div>
                      )}
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
                            {o.signed_doc_id && btn("👀 View signed offer", () => viewSignedDoc(o.signed_doc_id), "#dcfce7", "#166534")}
                            {active && o.packet_pdf_key && !o.signed_doc_id &&
                              btn(o.signing_status === "out_for_signature" ? "✍️ Signature status" : "✍️ Get buyer signatures", () => setSignModal(o), "#86198f", "#fff")}
                            {active && btn("📤 Upload Signed Offer", () => pickSigned(o), "#0c4a6e", "#fff")}
                            {active && o.signed_doc_id && btn(o.status === "sent" ? "📧 Re-send to listing agent" : "📧 Send to listing agent", () => sendToListing(o), "#ede9fe", "#5b21b6")}
                            {(o.status === "ready" || o.status === "sent" || o.status === "countered") && btn("✅ Accepted", () => acceptOffer(o.id), "#16a34a", "#fff")}
                            {(o.status === "sent" || o.status === "countered") && btn("Declined", () => setOfferStatus(o.id, "rejected", "DECLINED by the seller"), "#fee2e2", "#7f1d1d")}
                            {o.status === "accepted" && btn(execBusy && execTarget?.id === o.id ? "Uploading…" : o.executed_doc_id ? "✅ Executed contract on file — replace" : "📜 Upload Executed Contract", () => pickExecuted(o), "#065f46", "#fff")}
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
      <input ref={execRef} type="file" accept=".pdf,image/*" style={{ display: "none" }}
        onChange={e => { const f = e.target.files && e.target.files[0]; if (f) uploadExecuted(f); e.target.value = ""; }} />

      {execBusy && (
        <div style={{ background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 10, padding: 14, marginTop: 14, fontSize: 13, color: "#1e40af" }}>
          🤖 AI is reading the executed contract — checking terms, dates, and signatures. This can take up to a minute…
        </div>
      )}
      {execResult && execResult.verify && (() => {
        const v = execResult.verify;
        if (v.error) return (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 14, marginTop: 14, fontSize: 13, color: "#991b1b" }}>⚠️ {v.error}</div>
        );
        const signedOk = /fully|all.*signed|complete/i.test(String(v.signatureStatus || ""));
        return (
          <div style={{ background: signedOk ? "#ecfdf5" : "#fffbeb", border: `1px solid ${signedOk ? "#6ee7b7" : "#fcd34d"}`, borderRadius: 10, padding: 16, marginTop: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: signedOk ? "#065f46" : "#92400e", marginBottom: 8 }}>
              {signedOk ? "✅ Executed contract verified — signed properly" : "⚠️ Executed contract read — check the signatures"}
            </div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
              <div><b>Signatures:</b> {v.signatureStatus || "unknown"}{v.missingSignatures ? ` — missing: ${v.missingSignatures}` : ""}</div>
              {v.executedDate && !v.effectiveDateUncertain && <div><b>Effective date:</b> {fmtDate(v.executedDate)}</div>}
              {v.effectiveDateUncertain && <EffectiveDateConfirm txId={tx.id} token={token} readDate={v.executedDate} />}
              {v.closingDate && <div><b>Closing date:</b> {fmtDate(v.closingDate)}</div>}
              {v.contractPrice && <div><b>Contract price:</b> {fmtMoney(v.contractPrice)}</div>}
              {v.applied && v.applied.length > 0 && <div><b>Applied to the deal:</b> {v.applied.length} field{v.applied.length === 1 ? "" : "s"} (dates, contingencies) — the timeline recomputed automatically.</div>}
              {v.partiesAdded > 0 && <div><b>People added from the contract:</b> {v.partiesAdded} (title company, lender, etc.) — check the People tab.</div>}
              {v.docsFiled > 0 && <div><b>Documents filed:</b> {v.docsFiled} — each contract, rider, and disclosure in the package was split out into Documents (Executed Contract Package folder).</div>}
              {v.notes && <div style={{ color: "#6b7280", marginTop: 4 }}>{v.notes}</div>}
            </div>
          </div>
        );
      })()}

      {showWelcomePreview && (
        <WelcomeEmailPreview txId={tx.id} onClose={() => setShowWelcomePreview(false)} />
      )}

      {sendModal && (
        <SendOfferModal
          offer={sendModal} tx={tx} token={token} currentUser={currentUser}
          onClose={() => setSendModal(null)}
          onSent={() => { setSendModal(null); load(); }}
        />
      )}

      {signModal && (
        <BuyerSignaturesModal
          offer={signModal} token={token}
          onClose={(changed) => { setSignModal(null); if (changed) load(); }}
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
    `Hi ${firstName},\n\nPlease find attached my buyer's offer on ${addr || "your listing"}${price ? " at " + price : ""}.${termsBlock}\nThe full offer is attached. I'd appreciate you presenting it to your seller.\n\nTwo quick asks:\n1. Please REPLY to this email to acknowledge receipt of this offer.\n2. Going forward, please keep all communication about this offer by replying to this same email — it keeps everything documented in one place for both of our clients.\n\nThank you,\n${agentName}`.trim()
  );
  const [attach, setAttach] = useState([]);      // extra docs [{id,name}]
  const [docList, setDocList] = useState(null);
  const [docPicker, setDocPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [ccSelf, setCcSelf] = useState(true);   // "Send me a copy" — CC, never the To field
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
    if (/[,;]/.test(toEmail)) { alert("Put only the LISTING AGENT's email in the To field — the deal's People syncs to it.\n\nTo get a copy yourself, leave the 'Send me a copy' box checked instead."); return; }
    if (!message.trim()) { alert("Write a message."); return; }
    setSending(true);
    try {
      const r = await fetch(API + "/offers/" + offer.id + "/send-to-listing-agent", {
        method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: toEmail.trim(), toName: toName.trim(), subject, message, attachDocIds: attach.map(a => a.id), ccSelf }),
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
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#374151", marginTop: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={ccSelf} onChange={e => setCcSelf(e.target.checked)} />
            📩 Send me a copy (don&apos;t type your own email in the To field — that changes the listing agent&apos;s contact info)
          </label>

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

// ────────────────────────────────────────────────────────────
// BUYER E-SIGNATURE MODAL — send private signing links to the buyer(s),
// watch who has signed, cancel a round. When the last buyer signs, the
// server stamps the packet + certificate and the offer shows "signed
// in-app" with the Send-to-Listing-Agent button ready.
// ────────────────────────────────────────────────────────────
function BuyerSignaturesModal({ offer, token, onClose }) {
  const [info, setInfo] = useState(null);        // { signers, suggested, signingStatus, ... }
  const [rows, setRows] = useState([]);          // editable signer rows for a new round
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [changed, setChanged] = useState(false);

  const loadInfo = async () => {
    try {
      const r = await fetch(API + "/offers/" + offer.id + "/signatures", { headers: { Authorization: "Bearer " + token } });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Couldn't load signature status");
      setInfo(b);
      if (!(b.signers || []).length) {
        const sug = (b.suggested || []).slice(0, 4);
        setRows(sug.length ? sug : [{ name: "", email: "" }]);
      }
      // Server self-heals a missed finalize on this fetch — reflect it.
      if (b.signingStatus === "signed") setChanged(true);
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { loadInfo(); /* eslint-disable-next-line */ }, [offer.id]);

  const setRow = (i, k, v) => setRows(rs => rs.map((r, j) => j === i ? { ...r, [k]: v } : r));

  const send = async () => {
    setErr(null);
    const clean = rows.map(r => ({ name: (r.name || "").trim(), email: (r.email || "").trim() })).filter(r => r.name || r.email);
    if (!clean.length || clean.some(r => !r.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email))) {
      setErr("Every signer needs a name and a valid email."); return;
    }
    setBusy(true);
    try {
      const r = await fetch(API + "/offers/" + offer.id + "/request-signatures", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ signers: clean }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Couldn't send signing links");
      setChanged(true);
      await loadInfo();
      alert("✍️ Signing links sent to " + clean.map(s => s.name).join(" and ") + ".\n\nYou'll get an email the moment everyone has signed — then just click 📧 Send to listing agent.");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const cancel = async () => {
    if (!confirm("Cancel the outstanding signing links?\n\nThe buyers' links will stop working. You can send a fresh round any time.")) return;
    setBusy(true);
    try {
      const r = await fetch(API + "/offers/" + offer.id + "/cancel-signatures", {
        method: "POST", headers: { Authorization: "Bearer " + token },
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Couldn't cancel");
      setChanged(true);
      setInfo(null);
      await loadInfo();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const pending = (info?.signers || []).filter(s => s.status === "pending");
  const signedRows = (info?.signers || []).filter(s => s.status === "signed");
  const roundOut = (info?.signers || []).length > 0 && info?.signingStatus !== "signed";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "40px 12px" }}
      onClick={() => onClose(changed)}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 560, boxShadow: "0 20px 60px rgba(2,6,23,0.35)" }} onClick={e => e.stopPropagation()}>
        <div style={{ background: "#86198f", color: "#fff", borderRadius: "14px 14px 0 0", padding: "16px 22px" }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>✍️ Buyer signatures — no DocuSign needed</div>
          <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 3 }}>Each buyer gets a private link to review the package and sign on their phone or computer.</div>
        </div>
        <div style={{ padding: 22 }}>
          {!info && !err && <div style={{ color: "#64748b", fontSize: 14 }}>Loading…</div>}
          {err && <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: 10, fontSize: 13, color: "#7f1d1d", marginBottom: 12 }}>⚠️ {err}</div>}

          {info && info.signingStatus === "signed" && (
            <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 10, padding: 14, fontSize: 14, color: "#14532d", marginBottom: 6 }}>
              ✅ <b>All signed!</b> The signed package (with its signature certificate) is on this offer — close this and click <b>📧 Send to listing agent</b>.
            </div>
          )}

          {info && roundOut && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#374151", marginBottom: 8 }}>Signing round in progress</div>
              {(info.signers || []).map(s => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: "#111" }}>{s.signer_name} <span style={{ color: "#64748b" }}>({s.signer_email})</span></span>
                  {s.status === "signed"
                    ? <span style={{ color: "#15803d", fontWeight: 700 }}>✅ Signed {s.signed_at ? new Date(s.signed_at).toLocaleDateString() : ""}</span>
                    : <span style={{ color: "#92400e", fontWeight: 700 }}>⏳ Waiting</span>}
                </div>
              ))}
              {pending.length > 0 && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={cancel} disabled={busy}
                    style={{ padding: "8px 16px", background: "#fee2e2", color: "#7f1d1d", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    Cancel signing links
                  </button>
                </div>
              )}
              {signedRows.length > 0 && pending.length === 0 && info.signingStatus !== "signed" && (
                <div style={{ fontSize: 12.5, color: "#92400e", marginTop: 8 }}>Finalizing the signed package… reopen this window in a moment if it doesn't complete.</div>
              )}
            </div>
          )}

          {info && !roundOut && info.signingStatus !== "signed" && (
            <div>
              {!info.hasPacket && (
                <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, padding: 10, fontSize: 13, color: "#78350f", marginBottom: 12 }}>
                  ⚠️ Generate the offer packet first (open the offer → Review step → Generate) — the buyers sign the final package.
                </div>
              )}
              <div style={{ fontSize: 13, fontWeight: 800, color: "#374151", marginBottom: 8 }}>Who needs to sign?</div>
              {rows.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input value={r.name} onChange={e => setRow(i, "name", e.target.value)} placeholder="Buyer full name"
                    style={{ flex: 1, padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, fontFamily: "inherit", minWidth: 0 }} />
                  <input value={r.email} onChange={e => setRow(i, "email", e.target.value)} placeholder="Email"
                    style={{ flex: 1, padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, fontFamily: "inherit", minWidth: 0 }} />
                  {rows.length > 1 && (
                    <button onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}
                      style={{ background: "none", border: "none", color: "#7f1d1d", fontSize: 16, cursor: "pointer" }}>✕</button>
                  )}
                </div>
              ))}
              {rows.length < 4 && (
                <button onClick={() => setRows(rs => [...rs, { name: "", email: "" }])}
                  style={{ background: "none", border: "1px dashed #94a3b8", color: "#475569", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}>
                  + Add another signer
                </button>
              )}
              <button onClick={send} disabled={busy || !info.hasPacket}
                style={{ width: "100%", padding: "12px 0", background: busy || !info.hasPacket ? "#94a3b8" : "#86198f", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: busy || !info.hasPacket ? "default" : "pointer", fontFamily: "inherit", marginTop: 4 }}>
                {busy ? "Sending links…" : "Send signing links ✍️"}
              </button>
              <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 8, textAlign: "center" }}>
                Signatures are stamped onto the contract, riders, and disclosures automatically, with a signature certificate attached.
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: "12px 22px", borderTop: "1px solid #e5e7eb", textAlign: "right" }}>
          <button onClick={() => onClose(changed)} style={{ padding: "8px 18px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Close</button>
        </div>
      </div>
    </div>
  );
}
