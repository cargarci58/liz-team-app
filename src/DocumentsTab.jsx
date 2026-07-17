import { useState, useEffect, useRef } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

const COLORS = {
  navy: "#111111", gold: "#C0392B", text: "#111111", muted: "#666666",
  border: "#DDDDDD", danger: "#C0392B", info: "#1A5276",
};

const CATEGORIES = ["General", "Contract", "Inspection", "Title", "Loan", "Closing", "Other"];
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB matches the UI hint
const ALLOWED_UPLOAD_TYPES = [
  "application/pdf",
  "image/jpeg", "image/png", "image/heic", "image/heif", "image/gif", "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
];

// One-time 1-2-3 explainer for this screen (per browser, dismissible).
function DocsFirstTimeTip() {
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem("tp_tip_docs") === "1"; } catch { return false; } });
  if (hidden) return null;
  return (
    <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span style={{ fontSize: 20 }}>👋</span>
      <div style={{ flex: 1, fontSize: 13, color: "#1E3A8A", lineHeight: 1.6 }}>
        <b>Paperwork, handled — 1, 2, 3:</b> ① The <b>checklist below</b> tells you exactly which documents this deal still needs. ② <b>Upload</b> straight into a checklist slot (or use the general upload). ③ Need it signed? <b>✍️ Get signature</b> emails a private signing link and files the signed copy back here by itself.
      </div>
      <button onClick={() => { setHidden(true); try { localStorage.setItem("tp_tip_docs", "1"); } catch {} }}
        style={{ background: "#1E40AF", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
        Got it
      </button>
    </div>
  );
}

export default function DocumentsTab({ tx, coordinatorMode = false }) {
  // Coordinators open files through the money-free /tc view endpoint (the agent
  // view/download routes are tenant-scoped and 404 cross-tenant). Listing and
  // uploading already work for them (party-authorized, deal-tenant-tagged).
  const viewUrlBase = (id) => `${API}${coordinatorMode ? "/tc/documents/" : "/documents/"}${id}/view-url`;
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("General");
  // Required Documents checklist (deal-aware, from the compliance engine).
  const [required, setRequired] = useState([]);
  const [reqSummary, setReqSummary] = useState(null);
  const [slotUploading, setSlotUploading] = useState(null); // documentType currently uploading
  const [preview, setPreview] = useState(null); // { loading, doc, url, mime }
  const [share, setShare] = useState(null); // { doc } — share-with-party modal
  const [signDoc, setSignDoc] = useState(null); // { doc } — request e-signature modal
  const [rowMenu, setRowMenu] = useState(null);  // doc.id whose ⋯ menu is open
  const [signStatus, setSignStatus] = useState({}); // docId → {pending, signed}
  const [showLOI, setShowLOI] = useState(false); // Letter of Intent generator (commercial only)
  const isCommercial = /commercial/i.test(`${tx.propertyType || ""} ${tx.constructionType || ""}`);
  const isBuyerDeal = /buyer|dual/i.test(tx.transaction_type || tx.transactionType || tx.type || "");
  const [waiverBusy, setWaiverBusy] = useState(false); // generating the inspection waiver
  const tok = localStorage.getItem("tp_token") || "";
  const headers = { "Content-Type": "application/json", "Authorization": "Bearer " + tok };
  const [readingDates, setReadingDates] = useState(null); // doc.id being read

  // AI: pull the contract's dates onto this deal + recompute the milestone timeline.
  const readContractDates = async (doc) => {
    setReadingDates(doc.id);
    try {
      const r = await fetch(`${API}/transactions/${tx.id}/read-contract-dates`, {
        method: "POST", headers, body: JSON.stringify({ docId: doc.id })
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Could not read the contract");
      const sigLine = d.signatureStatus === "fully_executed" ? "✅ Contract appears fully signed."
        : d.signatureStatus === "partially_signed" ? `⚠️ Not fully signed yet${d.missingSignatures ? " — " + d.missingSignatures : "."}`
        : d.signatureStatus === "unsigned" ? "⚠️ This copy looks unsigned."
        : "";
      // No dates found is the common "it isn't working" case — usually an unsigned
      // offer or a doc without firm dates. Say so clearly instead of "0 milestones".
      if (!d.milestonesDated && !d.executedDate && !d.closingDate) {
        alert(
          `📅 No firm dates found in "${doc.name}".\n\n` +
          `This usually means it's an unsigned offer, or the contract dates (executed date, closing date) aren't filled in yet. ` +
          `"Read dates" works best on the fully-signed contract.\n` +
          (sigLine ? `\n${sigLine}\n` : "") +
          (d.notes ? `\nNote: ${d.notes}` : "")
        );
      } else {
        alert(
          `📅 Dates read from "${doc.name}"\n\n` +
          `${d.milestonesDated} milestone${d.milestonesDated === 1 ? "" : "s"} dated on your timeline.\n` +
          (d.executedDate ? `Executed: ${d.executedDate}\n` : "") +
          (d.closingDate ? `Closing: ${d.closingDate}\n` : "") +
          (sigLine ? `\n${sigLine}\n` : "") +
          (d.notes ? `\nNote: ${d.notes}` : "")
        );
      }
    } catch (e) {
      alert("Couldn't read the contract: " + e.message);
    } finally { setReadingDates(null); }
  };
  // "Read dates" must ONLY appear on the actual purchase contract — never on
  // disclosures/addenda. Reading dates off the wrong doc could overwrite good
  // dates and recompute the whole timeline. A contract package explodes into many
  // docs (HOA addendum, disclosures, …) all under category "Contract Package", so
  // we gate on the document TYPE, not the category.
  const CONTRACT_DOC_TYPES = new Set([
    "FAR_BAR_Contract", "AS_IS_Contract", "Vacant_Land_Contract",
    "Commercial_Contract", "Lease_Contract", "original_upload",
  ]);
  const isContract = (doc) => {
    const dt = String(doc.document_type || "");
    const cat = String(doc.category || "");
    const nm = String(doc.name || "");
    return CONTRACT_DOC_TYPES.has(dt) || cat === "Contract" || /\bcontract\b/i.test(nm);
  };
  const isContractReadable = (doc) => {
    const mt = doc.mime_type || "";
    const fileReadable = /pdf$/i.test(mt) || String(mt).startsWith("image/");
    return fileReadable && isContract(doc);
  };

  const loadDocs = () =>
    fetch(`${API}/documents/${tx.id}`, { headers })
      .then(r => r.json())
      .then(d => { if (d.documents) setDocs(d.documents); })
      .catch(e => console.error("Load docs failed:", e));

  const loadRequired = () =>
    fetch(`${API}/transactions/${tx.id}/required-documents`, { headers })
      .then(r => r.json())
      .then(d => { if (d.success && !d.guest) { setRequired(d.items || []); setReqSummary(d.summary || null); } })
      .catch(e => console.error("Load required docs failed:", e));

  // Per-document e-sign status ({docId: {pending, signed}}) → row badges, so
  // the agent can SEE a signing round is out without reopening the modal.
  const loadSignStatus = () =>
    fetch(`${API}/transactions/${tx.id}/doc-signature-status`, { headers })
      .then(r => r.json())
      .then(d => { if (d.byDoc) setSignStatus(d.byDoc); })
      .catch(() => { /* badges are progressive enhancement */ });

  useEffect(() => {
    loadDocs().finally(() => setLoading(false));
    loadRequired();
    loadSignStatus();
  }, [tx.id]);

  // Upload a file straight into a checklist slot — tagged with the canonical
  // document type so it ticks that requirement.
  const handleSlotUpload = async (documentType, label, e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) { alert(`File too large. Max 50 MB.`); e.target.value = ""; return; }
    if (file.type && !ALLOWED_UPLOAD_TYPES.includes(file.type)) { alert(`File type "${file.type}" not allowed.`); e.target.value = ""; return; }
    setSlotUploading(documentType);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      const res = await fetch(`${API}/documents/upload`, {
        method: "POST", headers,
        body: JSON.stringify({ transactionId: tx.id, fileName: file.name, fileType: file.type, category: documentType, documentType, base64 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || ("Upload failed (" + res.status + ")"));
      await Promise.all([loadDocs(), loadRequired()]);
    } catch (err) {
      console.error("Slot upload failed:", err);
      alert("Upload failed: " + err.message);
    } finally { setSlotUploading(null); e.target.value = ""; }
  };

  // Mark a required document as Not Applicable for this deal, with a reason on record.
  const waiveSlot = async (documentType, label) => {
    const reason = window.prompt(`Mark "${label}" as Not Applicable for this deal.\n\nReason (required) — e.g. "Transaction broker — no disclosure needed":`, "");
    if (reason == null) return;            // cancelled
    if (!reason.trim()) { alert("A reason is required to waive a document."); return; }
    setSlotUploading(documentType);
    try {
      const res = await fetch(`${API}/transactions/${tx.id}/doc-waiver`, {
        method: "POST", headers,
        body: JSON.stringify({ documentType, reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Waive failed");
      await loadRequired();
    } catch (err) { alert("Waive failed: " + err.message); }
    finally { setSlotUploading(null); }
  };

  const unwaiveSlot = async (documentType) => {
    setSlotUploading(documentType);
    try {
      await fetch(`${API}/transactions/${tx.id}/doc-waiver/${encodeURIComponent(documentType)}`, { method: "DELETE", headers });
      await loadRequired();
    } catch (err) { alert("Undo failed: " + err.message); }
    finally { setSlotUploading(null); }
  };

  // Point an already-uploaded document at a checklist slot (no re-upload).
  const assignExisting = async (documentType, docId) => {
    if (!docId) return;
    setSlotUploading(documentType);
    try {
      const res = await fetch(`${API}/documents/${docId}/document-type`, {
        method: "PATCH", headers,
        body: JSON.stringify({ documentType }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Assign failed");
      await Promise.all([loadDocs(), loadRequired()]);
    } catch (err) {
      console.error("Assign failed:", err);
      alert("Assign failed: " + err.message);
    } finally { setSlotUploading(null); }
  };

  // Picked the wrong file for a slot? Un-assign it (that slot only — the doc
  // keeps any other slots it satisfies).
  const unassignExisting = async (documentType, docId, docName, slotLabel) => {
    if (!window.confirm(`Remove "${docName}" from the ${slotLabel} slot?\n\nThe file stays in Documents — this only un-fills this checklist item so you can pick the right one.`)) return;
    setSlotUploading(documentType);
    try {
      const res = await fetch(`${API}/documents/${docId}/document-type/${encodeURIComponent(documentType)}`, { method: "DELETE", headers });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Remove failed");
      await Promise.all([loadDocs(), loadRequired()]);
    } catch (err) { alert("Remove failed: " + err.message); }
    finally { setSlotUploading(null); }
  };

  const readAsBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const ok = [], failed = [];
    try {
      // Upload each selected file (sequentially, so a big batch can't hammer the
      // server). Skip + report oversized / unsupported files instead of aborting
      // the whole batch. Refresh the list once at the end.
      for (const file of files) {
        if (file.size > MAX_UPLOAD_BYTES) {
          failed.push(`${file.name} (over 50 MB)`); continue;
        }
        if (file.type && !ALLOWED_UPLOAD_TYPES.includes(file.type)) {
          failed.push(`${file.name} (unsupported type)`); continue;
        }
        try {
          const base64 = await readAsBase64(file);
          const res = await fetch(`${API}/documents/upload`, {
            method: "POST", headers,
            body: JSON.stringify({ transactionId: tx.id, fileName: file.name, fileType: file.type, category, base64 }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || ("Upload failed (" + res.status + ")"));
          ok.push(file.name);
        } catch (err) {
          failed.push(`${file.name} (${err.message})`);
        }
      }
      // Refresh once after the batch.
      const docsRes = await fetch(`${API}/documents/${tx.id}`, { headers });
      const docsData = await docsRes.json();
      if (docsData.documents) setDocs(docsData.documents);
      loadRequired();
      if (ok.length && !failed.length) alert(`✅ ${ok.length} document${ok.length === 1 ? "" : "s"} uploaded!`);
      else if (ok.length && failed.length) alert(`✅ ${ok.length} uploaded.\n\n⚠️ Couldn't upload:\n- ${failed.join("\n- ")}`);
      else alert(`⚠️ Couldn't upload:\n- ${failed.join("\n- ")}`);
    } catch (e) {
      console.error("Upload failed:", e);
      alert("Upload failed: " + e.message);
    }
    finally { setUploading(false); e.target.value = ""; }
  };

  const handleDownload = async (doc) => {
    try {
      // Coordinators have no tenant-scoped download route — open the inline view
      // URL (they can save from there).
      if (coordinatorMode) {
        const res = await fetch(viewUrlBase(doc.id), { headers });
        const data = await res.json();
        if (data.viewUrl) window.open(data.viewUrl, "_blank");
        else throw new Error(data.error || "Could not open file");
        return;
      }
      const res = await fetch(`${API}/documents/download/${doc.id}`, { headers });
      const data = await res.json();
      if (data.downloadUrl) window.open(data.downloadUrl, "_blank");
    } catch (e) { alert("Download failed: " + e.message); }
  };

  // In-app preview: fetch a signed inline URL and show it in a modal (PDF viewer
  // / image). Non-previewable types fall back to opening in a new tab.
  const openPreview = async (doc) => {
    setPreview({ loading: true, doc });
    try {
      const res = await fetch(viewUrlBase(doc.id), { headers });
      const data = await res.json();
      if (!res.ok || !data.viewUrl) throw new Error(data.error || "Could not load preview");
      const mime = data.mimeType || doc.mime_type || "";
      const previewable = /pdf|image\//i.test(mime);
      if (!previewable) { window.open(data.viewUrl, "_blank"); setPreview(null); return; }
      setPreview({ loading: false, doc, url: data.viewUrl, mime });
    } catch (e) {
      setPreview(null);
      alert("Preview failed: " + e.message);
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.name}"?`)) return;
    try {
      await fetch(`${API}/documents/${doc.id}`, { method: "DELETE", headers });
      setDocs(prev => prev.filter(d => d.id !== doc.id));
      loadRequired();
    } catch (e) { alert("Delete failed: " + e.message); }
  };

  const toggleVisibility = async (doc) => {
    try {
      await fetch(`${API}/documents/${doc.id}/visibility`, {
        method: "PUT", headers,
        body: JSON.stringify({ visible: !doc.is_visible_to_client }),
      });
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, is_visible_to_client: !d.is_visible_to_client } : d));
    } catch (e) { alert("Update failed: " + e.message); }
  };

  const getIcon = (mime) => {
    if (!mime) return "📎";
    if (mime.includes("pdf")) return "📄";
    if (mime.includes("image")) return "🖼️";
    if (mime.includes("word") || mime.includes("document")) return "📝";
    if (mime.includes("excel") || mime.includes("sheet")) return "📊";
    return "📎";
  };

  // Show uploaded (on-file) items at the top, then still-missing, then waived
  // last — testers expected the done ones surfaced first. Stable within each group.
  const checklistRank = (i) => i.waived ? 2 : (i.present ? 0 : 1);
  const byUploadedFirst = (a, b) => checklistRank(a) - checklistRank(b);
  const reqItems = required.filter(i => i.required).slice().sort(byUploadedFirst);
  const recItems = required.filter(i => !i.required).slice().sort(byUploadedFirst);
  const pct = reqSummary && reqSummary.requiredTotal > 0
    ? Math.round((reqSummary.requiredPresent / reqSummary.requiredTotal) * 100) : 100;
  const allIn = reqSummary && reqSummary.requiredMissing === 0;

  const ChecklistRow = (item) => {
    const border = item.waived ? "#D5D5D5" : (item.present ? "#A7E0BE" : "#EEDD9E");
    const icon = item.waived ? "⊘" : (item.present ? "✅" : (item.required ? "⬜" : "▫️"));
    return (
    <div key={item.documentType} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
      background: item.waived ? "#FAFAFA" : "#fff", border: "1px solid " + border,
      borderRadius: 8, marginBottom: 6, opacity: item.waived ? 0.85 : 1 }}>
      <div style={{ fontSize: 16, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: COLORS.text, textDecoration: item.waived ? "line-through" : "none" }}>
          {item.label}
          {!item.required && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#92400E", background: "#FEF3C7", padding: "1px 6px", borderRadius: 10 }}>OPTIONAL</span>}
          {item.custom && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#1A5276", background: "#D6EAF8", padding: "1px 6px", borderRadius: 10 }}>BROKER</span>}
        </div>
        {item.waived ? (
          <div style={{ fontSize: 11, color: "#7A7A7A", marginTop: 1 }}>N/A — {item.waiveReason}{item.waivedBy ? ` (${item.waivedBy})` : ""}</div>
        ) : (
          <>
            {item.description && (
              <div style={{ fontSize: 12, color: "#4B5563", marginTop: 2, lineHeight: 1.45 }}>💡 {item.description}</div>
            )}
            <div style={{ fontSize: 10.5, color: COLORS.muted, marginTop: 2 }}>
              {item.condition && item.condition !== "always" ? `Applies because: ${item.condition.replace(/_/g, " ")} · ` : ""}{item.statute || ""}
            </div>
          </>
        )}
      </div>
      {item.waived ? (
        <button onClick={() => unwaiveSlot(item.documentType)} disabled={!!slotUploading}
          style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 7, border: "1px solid #CCC", background: "#fff", color: COLORS.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          ↩ Undo N/A
        </button>
      ) : item.present ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0, alignItems: "flex-end", maxWidth: 230 }}>
          {(item.documents || []).map(d => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
              <span title={d.name} style={{ fontSize: 11, color: "#1E8449", fontWeight: 600, maxWidth: 150, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>📄 {d.name}</span>
              <button onClick={() => openPreview({ id: d.id, name: d.name, mime_type: d.mimeType })}
                style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #A7E0BE", background: "#fff", color: "#1E8449", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                👁 View
              </button>
              <button onClick={() => unassignExisting(item.documentType, d.id, d.name, item.label)} disabled={!!slotUploading}
                title="Wrong file? Remove it from this slot (the file itself stays in Documents)"
                style={{ padding: "3px 7px", borderRadius: 6, border: "1px solid #FECACA", background: "#fff", color: "#B91C1C", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {docs.length > 0 && (
            <select value="" disabled={!!slotUploading}
              onChange={(e) => assignExisting(item.documentType, e.target.value)}
              title="Use a document you've already uploaded"
              style={{ padding: "5px 8px", borderRadius: 7, border: "1px solid #CCC", fontSize: 12, fontFamily: "inherit", maxWidth: 150, background: "#fff", cursor: "pointer" }}>
              <option value="">Use existing…</option>
              {docs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          <label style={{ padding: "5px 12px", background: "#C0392B", color: "#fff", borderRadius: 7,
            cursor: slotUploading ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 12, opacity: slotUploading === item.documentType ? 0.6 : 1 }}>
            {slotUploading === item.documentType ? "Saving…" : "📎 Upload"}
            <input type="file" disabled={!!slotUploading} style={{ display: "none" }}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.txt"
              onChange={(e) => handleSlotUpload(item.documentType, item.label, e)} />
          </label>
          <button onClick={() => waiveSlot(item.documentType, item.label)} disabled={!!slotUploading} title="Not applicable to this deal"
            style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #CCC", background: "#fff", color: COLORS.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            ⊘ N/A
          </button>
        </div>
      )}
    </div>
    );
  };

  const generateInspectionWaiver = async () => {
    if (waiverBusy) return;
    setWaiverBusy(true);
    try {
      const r = await fetch(`${API}/transactions/${tx.id}/inspection-waiver/generate`, { method: "POST", headers });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Could not generate the waiver");
      await Promise.all([loadDocs(), loadRequired()]);
      alert(`✅ "${d.name}" is in this deal's Documents below.\n\nNext: find it in the list and click "✍️ Get signature" to email it to the buyer to sign. The signed copy files back here automatically.`);
    } catch (e) { alert("⚠️ " + e.message); }
    setWaiverBusy(false);
  };

  return (
    <div style={{ padding: 24 }}>
      {!coordinatorMode && <DocsFirstTimeTip />}
      {/* Home-inspection waiver — buyer deals only */}
      {isBuyerDeal && !coordinatorMode && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: 16, marginBottom: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 220, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#92400E" }}>🏠 Buyer declining a home inspection?</div>
            <div style={{ fontSize: 12.5, color: "#78350F", marginTop: 3, lineHeight: 1.45 }}>
              Generate a Home Inspection Waiver — it records that you recommended an inspection and the buyer chose to decline, which protects you. Then click <b>✍️ Get signature</b> on it below to have the buyer sign.
            </div>
          </div>
          <button onClick={generateInspectionWaiver} disabled={waiverBusy}
            style={{ background: "#B45309", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: waiverBusy ? "default" : "pointer", whiteSpace: "nowrap", opacity: waiverBusy ? 0.6 : 1 }}>
            {waiverBusy ? "Generating…" : "Generate Waiver"}
          </button>
        </div>
      )}
      {/* Letter of Intent generator — commercial deals only */}
      {isCommercial && (
        <div style={{ background: "#ECFEFF", border: "1px solid #67E8F9", borderRadius: 12, padding: 16, marginBottom: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 220, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#0E7490" }}>📝 Letter of Intent (LOI)</div>
            <div style={{ fontSize: 12.5, color: "#155E63", marginTop: 3, lineHeight: 1.45 }}>
              The standard non-binding first step on a commercial deal. Generate a ready-to-send draft from this deal's details — every clause is pre-written, just confirm the numbers.
            </div>
          </div>
          <button onClick={() => setShowLOI(true)} style={{ background: "#0E7490", color: "#fff", border: "none",
            padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
            Create Letter of Intent
          </button>
        </div>
      )}
      {showLOI && (
        <LetterOfIntentModal tx={tx} headers={headers} onClose={() => setShowLOI(false)}
          onSaved={() => { setShowLOI(false); loadDocs(); loadRequired(); }} />
      )}

      {/* Required Documents checklist — what THIS deal needs to be compliant */}
      {required.length > 0 && (
        <div style={{ background: allIn ? "#EAF7EF" : "#FFFDF5", border: "1px solid " + (allIn ? "#A7E0BE" : "#F1D98A"),
          borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.text }}>
              {allIn ? "✅ Required Documents — all on file" : "📋 Required Documents for this deal"}
            </div>
            {reqSummary && (
              <div style={{ fontWeight: 700, fontSize: 13, color: allIn ? "#1E8449" : "#92400E" }}>
                {reqSummary.requiredPresent}/{reqSummary.requiredTotal} on file
              </div>
            )}
          </div>
          <div style={{ background: "#EFEFEF", borderRadius: 20, height: 8, overflow: "hidden", marginBottom: 14 }}>
            <div style={{ width: pct + "%", height: "100%", background: pct === 100 ? "#1E8449" : "#C0392B", transition: "width .4s" }} />
          </div>
          {reqItems.map(ChecklistRow)}
          {recItems.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5, margin: "12px 0 6px" }}>Recommended (optional)</div>
              {recItems.map(ChecklistRow)}
            </>
          )}
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 10, lineHeight: 1.5 }}>
            This list adjusts automatically to the deal (HOA, condo, age of home, financing, coastal, foreign seller, etc.).
            Uploading here labels the file so it's filed correctly. Missing the right trigger? Update the deal's details.
            To add or reorder your brokerage's required documents, go to <b>Settings → ⚖️ Doc Requirements</b>.
          </div>
        </div>
      )}

      {/* Upload area */}
      <div style={{ background: "#F8F9FA", border: "2px dashed #DDDDDD", borderRadius: 12, padding: 24, marginBottom: 24, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📎</div>
        <div style={{ fontWeight: 700, marginBottom: 4, color: COLORS.text }}>Upload Document</div>
        <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 16 }}>PDF, Word, Excel, Images up to 50MB — you can pick several at once</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
          <select value={category} onChange={e => setCategory(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #DDDDDD", fontSize: 13, fontFamily: "inherit" }}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <label style={{ padding: "8px 20px", background: "#C0392B", color: "#fff", borderRadius: 8, cursor: uploading ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 13, opacity: uploading ? 0.7 : 1 }}>
            {uploading ? "Uploading..." : "Choose Files"}
            <input type="file" multiple onChange={handleUpload} disabled={uploading} style={{ display: "none" }}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.txt" />
          </label>
        </div>
      </div>

      {/* Documents list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>Loading documents...</div>
      ) : docs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📂</div>
          <div style={{ fontWeight: 600 }}>No documents yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Upload your first document above</div>
        </div>
      ) : (
        <div>
          {/* Surface "Read dates" at the top when a contract is on file — it was
              easy to miss buried in a document's button row. (tester #17) */}
          {(() => {
            const c = docs.find(isContractReadable);
            if (!c) return null;
            return (
              <div style={{ background: "#FCF6E3", border: "1px solid #C9A84C", borderRadius: 10, padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: "#7A5C00" }}>
                  📅 <b>Contract on file.</b> Let AI read it and auto-fill this deal's key dates (inspection, financing, closing) and timeline.
                </div>
                <button onClick={() => readContractDates(c)} disabled={readingDates === c.id}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #C9A84C", background: readingDates === c.id ? "#F5F5F5" : "#fff", cursor: readingDates === c.id ? "default" : "pointer", fontSize: 13, color: "#7A5C00", fontWeight: 700 }}>
                  {readingDates === c.id ? "Reading…" : "📅 Read dates from contract"}
                </button>
              </div>
            );
          })()}
          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14 }}>{docs.length} document{docs.length !== 1 ? "s" : ""}</div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12, background: "#F6F8FA", border: "1px solid #E5E7EB", borderRadius: 8, padding: "7px 10px" }}>
            💡 Each file has a <b>👁 Client can view</b> / <b>🔒 Hidden</b> button — tap it to control whether your client sees that file in their portal. New uploads are <b>Hidden</b> by default.
          </div>
          {(() => {
            // Group into folders: an offer's docs carry a `folder` (e.g. "Offer — John Doe");
            // everything else groups under its category.
            const groups = {};
            for (const doc of docs) {
              const key = doc.folder || doc.category || "General";
              (groups[key] = groups[key] || []).push(doc);
            }
            // Offer folders first, then the rest alphabetically.
            const names = Object.keys(groups).sort((a, b) => {
              const ao = /^offer/i.test(a), bo = /^offer/i.test(b);
              if (ao !== bo) return ao ? -1 : 1;
              return a.localeCompare(b);
            });
            return names.map(folder => (
              <div key={folder} style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 8px 2px" }}>
                  <span style={{ fontSize: 15 }}>{/^offer/i.test(folder) ? "📥" : "📁"}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: COLORS.navy }}>{folder}</span>
                  <span style={{ fontSize: 11, color: COLORS.muted }}>({groups[folder].length})</span>
                </div>
                {groups[folder].map(doc => (
                  <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#fff", border: "1px solid #DDDDDD", borderRadius: 10, marginBottom: 8, marginLeft: 14, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 24, flexShrink: 0 }}>{getIcon(doc.mime_type)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.name}</div>
                      <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{doc.category} · {new Date(doc.created_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                      {/* Rookie rule: two buttons per file — View and Get signature.
                          Everything else (share, download, hide, AI dates, delete)
                          lives under ⋯ so the row stops shouting. */}
                      {doc.is_visible_to_client && (
                        <span title="Your client can see this file in their portal (change under ⋯)"
                          style={{ padding: "4px 8px", borderRadius: 6, background: "#D5F5E3", fontSize: 11, fontWeight: 700, color: "#1E8449" }}>👁 Client</span>
                      )}
                      {(() => {
                        const ss = signStatus[doc.id];
                        const waiting = ss && ss.pending > 0;
                        const allSigned = ss && ss.pending === 0 && ss.signed > 0;
                        return (
                          <>
                            {waiting && (
                              <span title={`${ss.signed} of ${ss.pending + ss.signed} signed so far`}
                                style={{ padding: "4px 8px", borderRadius: 6, background: "#fef3c7", fontSize: 11, fontWeight: 700, color: "#92400e" }}>
                                ⏳ Awaiting signature{ss.pending + ss.signed > 1 ? ` (${ss.signed}/${ss.pending + ss.signed})` : ""}
                              </span>
                            )}
                            {allSigned && (
                              <span title="Everyone signed — the signed copy is filed in this list"
                                style={{ padding: "4px 8px", borderRadius: 6, background: "#d5f5e3", fontSize: 11, fontWeight: 700, color: "#1e8449" }}>✅ Signed</span>
                            )}
                            <button onClick={() => openPreview(doc)} title="Open and read this file"
                              style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #DDDDDD", background: "#fff", cursor: "pointer", fontSize: 12, color: COLORS.info, fontWeight: 600 }}>
                              👁 View
                            </button>
                            {/pdf$/i.test(doc.mime_type || "") && !coordinatorMode && (
                              <button onClick={() => setSignDoc({ doc })}
                                title={waiting ? "See who has signed, or cancel the signing links" : "Email a private e-signing link — the signed copy files back here"}
                                style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #d8b4fe", background: "#faf5ff", cursor: "pointer", fontSize: 12, color: "#86198f", fontWeight: 600 }}>
                                {waiting ? "✍️ Status" : "✍️ Get signature"}
                              </button>
                            )}
                          </>
                        );
                      })()}
                      <div style={{ position: "relative" }}>
                        <button onClick={() => setRowMenu(rowMenu === doc.id ? null : doc.id)} title="More actions"
                          style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #DDDDDD", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, color: COLORS.text }}>⋯</button>
                        {rowMenu === doc.id && (
                          <>
                            <div onClick={() => setRowMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
                            <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.16)", zIndex: 61, minWidth: 230, padding: 4 }}>
                              {[
                                { icon: "📤", label: "Email to someone on the deal", fn: () => setShare({ doc }) },
                                { icon: doc.is_visible_to_client ? "🔒" : "👁", label: doc.is_visible_to_client ? "Hide from client's portal" : "Show in client's portal", fn: () => toggleVisibility(doc) },
                                isContractReadable(doc) && { icon: "📅", label: readingDates === doc.id ? "Reading…" : "AI: read dates from this contract", fn: () => readContractDates(doc) },
                                { icon: "⬇️", label: "Download", fn: () => handleDownload(doc) },
                                { divider: true },
                                { icon: "🗑", label: "Delete…", danger: true, fn: () => handleDelete(doc) },
                              ].filter(Boolean).map((it, ii) => it.divider ? (
                                <div key={ii} style={{ height: 1, background: "#e5e7eb", margin: "6px 8px" }} />
                              ) : (
                                <button key={ii} onClick={() => { setRowMenu(null); it.fn(); }}
                                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 13px", background: "none", border: "none", borderRadius: 6, fontSize: 13, color: it.danger ? "#B91C1C" : "#1f2937", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                                  onMouseEnter={e => e.currentTarget.style.background = it.danger ? "#FEF2F2" : "#f3f4f6"}
                                  onMouseLeave={e => e.currentTarget.style.background = "none"}>
                                  <span style={{ fontSize: 15 }}>{it.icon}</span>
                                  <span>{it.label}</span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ));
          })()}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div onClick={() => setPreview(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", flexDirection: "column", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 12, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", maxWidth: 1000, width: "100%", margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #EEE", gap: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{preview.doc?.name}</div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                {preview.url && (
                  <a href={preview.url} target="_blank" rel="noreferrer"
                    style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #DDD", background: "#fff", color: COLORS.info, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                    Open in new tab
                  </a>
                )}
                <button onClick={() => setPreview(null)}
                  style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: "#C0392B", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  Close ✕
                </button>
              </div>
            </div>
            <div style={{ flex: 1, background: "#525659", overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {preview.loading ? (
                <div style={{ color: "#fff", padding: 40 }}>Loading preview…</div>
              ) : /image\//i.test(preview.mime || "") ? (
                <img src={preview.url} alt={preview.doc?.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              ) : (
                <iframe title="preview" src={preview.url} style={{ width: "100%", height: "100%", border: "none", background: "#fff" }} />
              )}
            </div>
          </div>
        </div>
      )}

      {signDoc && (
        <DocSignModal tx={tx} doc={signDoc.doc} allDocs={docs} headers={headers}
          onClose={() => { setSignDoc(null); loadSignStatus(); loadDocs(); }} />
      )}

      {/* Share-with-party modal */}
      {share && (
        <ShareModal tx={tx} doc={share.doc} headers={headers} onClose={() => setShare(null)} />
      )}
    </div>
  );
}

// ── Share an existing document with one or MORE parties ──────────────────────
// Check any parties on the transaction (and/or type an extra email), add an
// optional note; the server emails each recipient the file as an attachment in
// the agent's voice (one send per recipient — the endpoint is per-recipient).
function ShareModal({ tx, doc, headers, onClose }) {
  const parties = (tx.parties || []).filter(p => p.email && !/hoa/i.test(p.role || ""));
  // Checked recipients, keyed by party id/email. First party pre-checked (the
  // old modal pre-selected them, so one-recipient sharing stays one tap).
  const [checked, setChecked] = useState(() => {
    const init = {};
    if (parties[0]) init[String(parties[0].id || parties[0].email)] = true;
    return init;
  });
  const [extraOn, setExtraOn] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // { ok: [names], failed: ["name (reason)"] }
  const [error, setError] = useState(null);

  const toggle = (key) => setChecked(c => ({ ...c, [key]: !c[key] }));
  const pickedParties = parties.filter(p => checked[String(p.id || p.email)]);
  const nRecipients = pickedParties.length + (extraOn && email.trim() ? 1 : 0);

  const send = async () => {
    const recipients = pickedParties.map(p => ({ toEmail: p.email.trim(), toName: p.name || "", toRole: p.role || "" }));
    if (extraOn && email.trim()) {
      if (!/.+@.+\..+/.test(email.trim())) { setError("The extra email address doesn't look valid."); return; }
      recipients.push({ toEmail: email.trim(), toName: name.trim(), toRole: "" });
    }
    if (recipients.length === 0) { setError("Check at least one person (or add an email)."); return; }
    setError(null); setBusy(true);
    const ok = [], failed = [];
    // Sequential so a batch can't hammer the server; each recipient gets their
    // own email (privacy — recipients never see each other's addresses).
    for (const r of recipients) {
      try {
        const res = await fetch(`${API}/documents/${doc.id}/share`, {
          method: "POST", headers,
          body: JSON.stringify({ ...r, message }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "Could not send.");
        ok.push(r.toName || r.toEmail);
      } catch (e) { failed.push(`${r.toName || r.toEmail} (${e.message})`); }
    }
    setBusy(false);
    if (failed.length && !ok.length) { setError("Couldn't send: " + failed.join(", ")); return; }
    setDone({ ok, failed });
  };

  const inp = { width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid " + COLORS.border, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" };
  const lbl = { fontSize: 11, fontWeight: 700, color: COLORS.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 };

  return (
    <div onClick={() => !busy && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: 460, maxWidth: "100%", maxHeight: "94vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", margin: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px 14px", borderBottom: "1px solid " + COLORS.border }}>
          <h2 style={{ margin: 0, fontSize: 18, color: COLORS.text, fontWeight: 800 }}>📤 Share Document</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: COLORS.muted }}>×</button>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ background: "#F8F9FA", border: "1px solid " + COLORS.border, borderRadius: 8, padding: "10px 12px", marginBottom: 16, fontSize: 13 }}>
            📄 <b>{doc.name}</b> will be attached to the email.
          </div>

          {done ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>{done.failed.length ? "⚠️" : "✅"}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                Sent to {done.ok.join(", ")}
              </div>
              {done.failed.length > 0 && (
                <div style={{ fontSize: 13, color: COLORS.danger, marginBottom: 6 }}>Couldn't send to: {done.failed.join(", ")}</div>
              )}
              <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 18 }}>Each person got their own email with the document attached, and it's now visible in their portal.</div>
              <button onClick={onClose} style={{ background: COLORS.gold, color: "#fff", border: "none", padding: "10px 22px", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Done</button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Send to — check everyone who should get it</label>
                <div style={{ border: "1px solid " + COLORS.border, borderRadius: 8, maxHeight: 190, overflowY: "auto" }}>
                  {parties.map(p => {
                    const key = String(p.id || p.email);
                    return (
                      <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderBottom: "1px solid " + COLORS.bg, cursor: "pointer", fontSize: 14 }}>
                        <input type="checkbox" checked={!!checked[key]} onChange={() => toggle(key)} />
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <b>{p.name || p.email}</b> <span style={{ color: COLORS.muted }}>— {p.role}</span>
                        </span>
                      </label>
                    );
                  })}
                  <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", cursor: "pointer", fontSize: 14 }}>
                    <input type="checkbox" checked={extraOn} onChange={() => setExtraOn(v => !v)} />
                    <span>✏️ Someone else (type their email)</span>
                  </label>
                </div>
              </div>
              {extraOn && (
                <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>Name</label>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Recipient name" style={inp} />
                  </div>
                  <div style={{ flex: 1.4 }}>
                    <label style={lbl}>Email</label>
                    <input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@email.com" style={inp} />
                  </div>
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Note (optional)</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                  placeholder="Add a short message — or leave blank and we'll write a friendly one for you."
                  style={{ ...inp, resize: "vertical" }} />
              </div>
              {error && <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={onClose} disabled={busy} style={{ background: "#fff", color: COLORS.muted, border: "1px solid " + COLORS.border, padding: "10px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button onClick={send} disabled={busy} style={{ background: COLORS.gold, color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
                  {busy ? "Sending…" : `📤 Send${nRecipients > 1 ? ` to ${nRecipients} people` : ""}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Letter of Intent generator (commercial: Purchase OR Lease) ───────────────
// Pre-fills from the deal and produces a comprehensive, ready-to-send NON-BINDING
// commercial Letter of Intent — a Purchase LOI (property/price/closing/title/reps)
// or a Lease LOI term sheet (premises/use/rent/escalations/NNN/TI/work/signage/
// guaranty…), modeled on the brokerage's own LOIs. Output is an editable Word
// (.docx) the agent can fine-tune. Saves into Documents tagged "Letter_of_Intent".
function LetterOfIntentModal({ tx, headers, onClose, onSaved }) {
  const partyName = (...roles) => {
    for (const r of roles) { const m = (tx.parties || []).find(p => (p.role || "") === r); if (m && m.name) return m.name; }
    return "";
  };
  const fullAddress = [tx.address, tx.city, tx.state, tx.zipCode].filter(Boolean).join(", ");
  const todayISO = new Date().toISOString().split("T")[0];
  const plusDaysISO = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split("T")[0]; };
  const defaultLease = /lease|rental/i.test(`${tx.propertyType || ""} ${tx.transactionType || ""}`);

  const [mode, setMode] = useState(defaultLease ? "lease" : "purchase");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // ── PURCHASE form ──
  const [pf, setPf] = useState({
    loiDate: todayISO,
    buyerName: partyName("Buyer", "Buyer (Entity)"),
    sellerName: partyName("Seller"),
    propertyAddress: fullAddress,
    legalDescription: "",
    parcelId: "",
    purchasePrice: tx.contractPrice || tx.listPrice || "",
    deposit: "",
    additionalDeposit: "",
    financingType: tx.isCash ? "All cash" : "Conventional / commercial financing",
    dueDiligenceDays: "45",
    closingDays: "30",
    titleCompany: "",
    deedType: "Special Warranty Deed",
    possession: "At closing",
    closingCosts: "Each party pays its own customary closing costs; real estate taxes and assessments prorated as of Closing.",
    survey: "Buyer may obtain a current ALTA survey at Buyer's expense.",
    exclusivityDays: "30",
    contingencies: "Satisfactory due diligence, good and insurable title, and acceptable zoning for Buyer's intended use.",
    assignment: "Buyer may assign this Letter and the resulting contract to an affiliated entity or in connection with a 1031 exchange.",
    commissionPct: "",
    commissionPaidBy: "Seller",
    brokerName: "",
    expiresDate: plusDaysISO(5),
    preparedBy: "",
    additionalTerms: "",
  });
  const sp = (k) => (v) => setPf(s => ({ ...s, [k]: v }));

  // ── LEASE form ──
  const [lf, setLf] = useState({
    loiDate: todayISO,
    landlordName: partyName("Seller", "Landlord"),
    tenantName: partyName("Buyer", "Tenant"),
    tradeName: "",
    propertyName: "",
    premises: fullAddress,
    sqft: "",
    permittedUse: "",
    term: "Five (5) years",
    renewalOptions: "One (1) five (5)-year renewal option with 6 months' prior written notice at market rent.",
    baseRent: "",
    rentBasis: "Triple Net (NNN)",
    rentEscalation: "3% annual increases during the Term.",
    camTaxesInsurance: "Tenant pays its pro-rata share of Real Estate Taxes, Insurance and Common Area Maintenance (CAM).",
    estCharges: "",
    floridaTax: "Tenant pays Florida sales tax on all rent and charges.",
    rentCommencement: "Sixty (60) days after delivery of the Premises, or upon opening for business, whichever occurs first.",
    securityDeposit: "One (1) month's rent, operating expenses and sales tax, due upon Lease execution.",
    prepaidRent: "First (1st) month's rent, operating expenses and sales tax, due upon Lease execution.",
    tiAllowance: "None — Premises delivered as-is.",
    landlordWork: "Landlord delivers the Premises in its current \"as-is\" condition.",
    tenantWork: "Tenant is responsible, at its expense, for all work to be constructed in the Premises.",
    hvac: "Tenant is responsible for all maintenance, repair and replacement of the HVAC serving the Premises.",
    utilities: "Tenant pays directly for all utilities and connectivity serving the Premises.",
    signage: "Tenant, at its expense, may install its standard signage in compliance with the center's sign criteria and local code, subject to Landlord's approval.",
    operatingHours: "Tenant is not required to operate any minimum hours.",
    guaranty: "Personal guaranty from all owners (and spouses) during the initial Term.",
    impactFees: "",
    ccrs: "Tenant agrees to abide by the project's design guidelines, declarations and association requirements.",
    leaseForm: "Landlord's standard Lease form.",
    commissionDetail: "Landlord shall compensate the broker(s) pursuant to a separate agreement: fifty percent (50%) of the commission payable within thirty (30) days of Lease execution, and the remaining fifty percent (50%) within thirty (30) days of Rent Commencement. If Tenant fails to open for business, the 50% paid at Lease execution shall be reimbursed to Landlord within thirty (30) days of notice.",
    expiresDate: plusDaysISO(10),
    preparedBy: "",
    additionalTerms: "",
  });
  const sl = (k) => (v) => setLf(s => ({ ...s, [k]: v }));

  const fmtMoney = (v) => {
    const n = Number(String(v).replace(/[^0-9.]/g, ""));
    if (!v || isNaN(n) || n === 0) return "$__________";
    return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  };
  const fmtDate = (iso) => {
    if (!iso) return "____________";
    const [y, m, d] = iso.split("-");
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  };

  // PURCHASE → numbered letter clauses [title, text]
  const purchaseClauses = () => {
    const f = pf;
    const cl = [
      ["Property", `The property that is the subject of this Letter is located at ${f.propertyAddress || "____________"}${f.parcelId ? ` (Parcel ID ${f.parcelId})` : ""}, legally described as ${f.legalDescription || "[legal description to be confirmed by title commitment / survey]"}, together with all improvements, rights, easements and appurtenances (the "Property").`],
      ["Purchase Price", `The total purchase price for the Property is ${fmtMoney(f.purchasePrice)}, payable in cash at Closing, subject to customary prorations and adjustments.`],
      ["Earnest Money Deposit", `Within five (5) business days after execution of a definitive purchase agreement (the "Contract"), Buyer shall deposit ${fmtMoney(f.deposit)} in escrow with a mutually acceptable title company or escrow agent.${f.additionalDeposit ? ` An additional deposit of ${fmtMoney(f.additionalDeposit)} shall be made upon expiration of the Due Diligence Period.` : ""} All deposits shall be applied to the purchase price at Closing.`],
      ["Due Diligence / Feasibility Period", `Buyer shall have ${f.dueDiligenceDays || "____"} days from the effective date of the Contract to investigate the Property — including title, survey, environmental (Phase I), zoning and permitted use, soils, utilities, access, any leases, and all physical and financial conditions. Buyer may terminate during this period for any reason or no reason and receive a full refund of its deposit.`],
      ["Title & Survey", `Seller shall convey good, marketable and insurable title by ${f.deedType || "Special Warranty Deed"}, free and clear of all liens and encumbrances other than those approved by Buyer. Seller shall provide a current title commitment; ${f.survey} Buyer may object to title or survey matters during the Due Diligence Period.`],
      ["Closing", `Closing shall occur within ${f.closingDays || "____"} days after expiration of the Due Diligence Period${f.titleCompany ? `, at ${f.titleCompany}` : ", at a mutually acceptable title company or closing agent"}.`],
      ["Possession", /closing/i.test(f.possession) ? "Possession of the Property shall be delivered to Buyer at Closing, free of tenants and occupants unless otherwise agreed in the Contract." : `Possession shall be delivered ${f.possession}.`],
      ["Closing Costs & Prorations", f.closingCosts],
      ["Financing", /cash/i.test(f.financingType) ? "This is an all-cash transaction; Buyer will provide proof of funds upon request and this offer is not contingent upon financing." : `This offer contemplates ${f.financingType} and is contingent upon Buyer obtaining acceptable financing within the Due Diligence Period.`],
      ["Seller's Representations & Warranties", `Seller represents and warrants that: (a) Seller has full authority to sell the Property; (b) the Property is free of liens and encumbrances that will not be satisfied at Closing; (c) there is no pending litigation, condemnation or unrecorded agreement affecting the Property; and (d) Seller has received no notice of any violation of law affecting the Property. If any representation is untrue at Closing, Buyer may terminate and receive a full refund of its deposit.`],
      ["Property Condition", `Buyer shall accept the Property in its "AS-IS, WHERE-IS" condition as of Closing, subject to Buyer's satisfactory due diligence and Seller's representations above.`],
      ["Real Property Disclosure", "Seller is not aware of any material defect affecting the value of the Property other than those observable by Buyer or disclosed to Buyer in writing."],
      ["1031 Exchange", "Either party may structure its purchase or sale as part of a tax-deferred exchange under IRC §1031, and the other party shall reasonably cooperate at no additional cost or liability to it."],
      ["Assignment", f.assignment],
      ["Brokerage Commission", `${f.brokerName ? `${f.brokerName} represents Buyer in this transaction. ` : ""}A real estate commission${f.commissionPct ? ` of ${f.commissionPct}% of the purchase price` : ""} shall be paid by ${f.commissionPaidBy || "Seller"} at Closing pursuant to a separate agreement. Each party shall indemnify the other against claims by any other broker with whom it has dealt.`],
      ["Exclusivity / No-Shop", `For ${f.exclusivityDays || "____"} days following acceptance of this Letter, Seller shall not solicit, negotiate or accept any competing offer for the Property so the parties may negotiate the Contract in good faith.`],
      ["Confidentiality", "The parties shall keep the terms of this Letter and their negotiations confidential, except as required by law or as shared with their respective advisors, attorneys and lenders."],
      ["Contingencies", `This proposal is contingent upon: ${f.contingencies}`],
      ["Expenses", "Except as expressly provided, each party shall bear its own costs and professional fees in connection with this transaction."],
      ["Non-Binding Effect", "THIS LETTER OF INTENT IS NON-BINDING AND DOES NOT CREATE ANY CONTRACTUAL OBLIGATION. Except for the Exclusivity / No-Shop and Confidentiality paragraphs (which are binding), neither party shall be obligated unless and until a definitive Contract is fully executed by both parties. Either party may negotiate with third parties until a Contract is signed."],
      ["Governing Law", "This Letter shall be governed by the laws of the State of Florida."],
      ["Expiration", `This Letter of Intent will expire if not accepted in writing by ${fmtDate(f.expiresDate)}.`],
    ];
    if (f.additionalTerms.trim()) cl.push(["Additional Terms", f.additionalTerms.trim()]);
    return cl;
  };

  // LEASE → term-sheet rows [label, value]
  const leaseRows = () => {
    const f = lf;
    const rows = [
      ["Landlord", f.landlordName || "____________"],
      ["Tenant", f.tenantName || "____________"],
      ["Trade Name", f.tradeName || "To be provided by Tenant"],
      ["Property", f.propertyName || "____________"],
      ["Premises", `${f.premises || "____________"}${f.sqft ? `, containing approximately ${f.sqft} leasable square feet (as shown on the attached Exhibit A)` : ""}.`],
      ["Permitted Use", f.permittedUse || "____________"],
      ["Term", f.term || "____________"],
      ["Renewal Options", f.renewalOptions],
      ["Base Rent", `${f.baseRent ? `${fmtMoney(f.baseRent)} per square foot, ${f.rentBasis}, payable monthly in advance.` : "____________"} ${f.rentEscalation}`],
      ["CAM, Taxes & Insurance", `${f.camTaxesInsurance}${f.estCharges ? ` Estimated charges: ${f.estCharges} per square foot.` : ""}`],
      ["Florida Sales Tax", f.floridaTax],
      ["Rent Commencement", f.rentCommencement],
      ["Security Deposit", f.securityDeposit],
      ["Prepaid Rent", f.prepaidRent],
      ["Tenant Improvement Allowance", f.tiAllowance],
      ["Landlord's Work", f.landlordWork],
      ["Tenant's Work", f.tenantWork],
      ["HVAC", f.hvac],
      ["Utilities", f.utilities],
      ["Signage", f.signage],
      ["Operating Hours", f.operatingHours],
      ["Guaranty", f.guaranty],
      ["Impact Fees", f.impactFees || "Not applicable."],
      ["CC&Rs / Design Guidelines", f.ccrs],
      ["Documentation", f.leaseForm],
      ["Brokerage Commission", f.commissionDetail || "As set forth in a separate agreement; Landlord to compensate the broker(s)."],
      ["Offer Expiration", `This proposal is good until ${fmtDate(f.expiresDate)}.`],
    ];
    if (f.additionalTerms.trim()) rows.push(["Additional Terms", f.additionalTerms.trim()]);
    return rows;
  };

  const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const addrForName = (mode === "lease" ? lf.premises : pf.propertyAddress) || "Property";
  const fileBase = `Letter_of_Intent_${mode === "lease" ? "Lease" : "Purchase"}_${addrForName.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50)}`;

  const buildDocxBlob = async () => {
    const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import("docx");
    const run = (text, o = {}) => new TextRun({ text, ...o });
    const P = (children, opts = {}) => new Paragraph({ children, spacing: { after: 150, line: 276 }, ...opts });
    const children = [
      P([run("LETTER OF INTENT", { bold: true, size: 32 })], { alignment: AlignmentType.CENTER, spacing: { after: 30 } }),
      P([run(`(Non-Binding — ${mode === "lease" ? "Proposal to Lease" : "Proposal to Purchase"})`, { italics: true, size: 20, color: "555555" })], { alignment: AlignmentType.CENTER, spacing: { after: 260 } }),
      P([run(fmtDate(mode === "lease" ? lf.loiDate : pf.loiDate))]),
    ];
    if (mode === "purchase") {
      const f = pf;
      children.push(
        P([run("To (Seller): ", { bold: true }), run(f.sellerName || "____________")], { spacing: { after: 0, line: 276 } }),
        P([run("From (Buyer): ", { bold: true }), run(f.buyerName || "____________")], { spacing: { after: 0, line: 276 } }),
        P([run("Re: ", { bold: true }), run(`Proposed Purchase of ${f.propertyAddress || "____________"}`)]),
        P([run(`Dear ${f.sellerName || "Seller"}:`)]),
        P([run(`This Letter of Intent ("LOI") sets forth the principal terms under which ${f.buyerName || "Buyer"} ("Buyer") proposes to purchase the above-referenced property from ${f.sellerName || "Seller"} ("Seller"). The parties intend to negotiate a definitive purchase agreement consistent with the following:`)]),
      );
      purchaseClauses().forEach(([t, text], i) => children.push(P([run(`${i + 1}. ${t}.  `, { bold: true }), run(text)])));
      children.push(
        P([run("If these terms are acceptable as a basis for negotiation, please sign and return a copy. We look forward to working with you.")], { spacing: { before: 140, after: 420, line: 276 } }),
        P([run("Buyer: ", { bold: true }), run((f.buyerName || "") + "  ____________________________    Date: ____________")]),
        P([run("Seller: ", { bold: true }), run((f.sellerName || "") + "  ____________________________    Date: ____________")]),
      );
    } else {
      const f = lf;
      children.push(
        P([run("To (Tenant): ", { bold: true }), run(f.tenantName || "____________")], { spacing: { after: 0, line: 276 } }),
        P([run("From (Landlord): ", { bold: true }), run(f.landlordName || "____________")], { spacing: { after: 0, line: 276 } }),
        P([run("Re: ", { bold: true }), run(`Proposed Lease at ${f.propertyName || f.premises || "____________"}`)]),
        P([run(`This Letter of Intent sets forth the principal non-binding terms and conditions under which ${f.landlordName || "Landlord"} ("Landlord") would lease space to ${f.tenantName || "Tenant"} ("Tenant"). The Lease, when negotiated, shall contain among other items the following terms:`)], { spacing: { after: 220, line: 276 } }),
      );
      leaseRows().forEach(([label, value]) => children.push(
        new Paragraph({ spacing: { after: 130, line: 276 }, children: [run(label.toUpperCase() + ":  ", { bold: true }), run(value)] })
      ));
      children.push(
        P([run("This letter is a summary of negotiations to date and does not create any contractual obligation on either party. The Premises have not been taken off the market, and Landlord may continue to market the Premises to others. Final terms will be set forth in a Lease to be executed by Landlord and Tenant.")], { spacing: { before: 180, after: 120, line: 276 } }),
        P([run("If the above reflects our understanding, please sign below and return a copy, and we will prepare the Lease.")], { spacing: { after: 420, line: 276 } }),
        P([run("ACCEPTED AND AGREED:", { bold: true })]),
        P([run("Landlord: ", { bold: true }), run((f.landlordName || "") + "  ____________________________    Date: ____________")]),
        P([run("Tenant: ", { bold: true }), run((f.tenantName || "") + "  ____________________________    Date: ____________")]),
      );
    }
    const preparedBy = mode === "lease" ? lf.preparedBy : pf.preparedBy;
    if (preparedBy) children.push(P([run("Prepared by " + preparedBy, { size: 18, color: "666666" })], { spacing: { before: 300 } }));
    const doc = new Document({
      styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
      sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, children }],
    });
    return await Packer.toBlob(doc);
  };

  const handleDownload = async () => {
    setError(null); setBusy(true);
    try {
      const blob = await buildDocxBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileBase + ".docx";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) { setError(e.message || "Could not generate Word doc"); }
    finally { setBusy(false); }
  };

  const handleSave = async () => {
    const price = mode === "lease" ? lf.baseRent : pf.purchasePrice;
    if (!price) { setError(mode === "lease" ? "Enter the base rent first." : "Enter a purchase price first."); return; }
    setError(null); setBusy(true);
    try {
      const blob = await buildDocxBlob();
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(blob);
      });
      const res = await fetch(`${API}/documents/upload`, {
        method: "POST", headers,
        body: JSON.stringify({ transactionId: tx.id, fileName: fileBase + ".docx", fileType: DOCX_MIME,
          category: "Contract", documentType: "Letter_of_Intent", base64 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || ("Save failed (" + res.status + ")"));
      onSaved();
    } catch (e) { setError(e.message || "Could not save to documents"); setBusy(false); }
  };

  const inp = { width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: "inherit", color: COLORS.text, background: "#fff", boxSizing: "border-box" };
  const fld = (formObj, setter, label, key, opts = {}) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</label>
      {opts.type === "textarea"
        ? <textarea value={formObj[key]} onChange={e => setter(key)(e.target.value)} rows={opts.rows || 2} placeholder={opts.placeholder} style={{ ...inp, resize: "vertical" }} />
        : opts.options
          ? <select value={formObj[key]} onChange={e => setter(key)(e.target.value)} style={inp}>{opts.options.map(o => <option key={o}>{o}</option>)}</select>
          : <input type={opts.type || "text"} value={formObj[key]} onChange={e => setter(key)(e.target.value)} placeholder={opts.placeholder} style={inp} />}
    </div>
  );

  const tabBtn = (m, label) => (
    <button onClick={() => setMode(m)} style={{ flex: 1, padding: "9px 10px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
      background: mode === m ? "#0E7490" : "#E5F6F8", color: mode === m ? "#fff" : "#0E7490" }}>{label}</button>
  );

  return (
    <div onClick={() => !busy && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: 960, maxWidth: "100%", maxHeight: "94vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", margin: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px 14px", borderBottom: `1px solid ${COLORS.border}`, position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: "#0E7490", fontWeight: 800 }}>📝 Letter of Intent</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: COLORS.muted }}>×</button>
        </div>
        <div style={{ display: "flex", gap: 8, padding: "14px 22px 0" }}>{tabBtn("purchase", "🏢 Purchase")}{tabBtn("lease", "🔑 Lease")}</div>
        <div style={{ display: "flex", gap: 20, padding: 22, flexWrap: "wrap", alignItems: "flex-start" }}>
          {/* Form */}
          <div style={{ flex: "1 1 320px", minWidth: 290 }}>
            <div style={{ fontSize: 12.5, color: COLORS.muted, marginBottom: 12, lineHeight: 1.45 }}>
              Confirm the terms below — every clause is pre-written in standard FL commercial language. Generates an <b>editable Word (.docx)</b>. The letter is <b>non-binding</b>.
            </div>
            {mode === "purchase" ? (
              <>
                {fld(pf, sp, "LOI Date", "loiDate", { type: "date" })}
                {fld(pf, sp, "Buyer (name / entity)", "buyerName", { placeholder: "ABC Holdings, LLC" })}
                {fld(pf, sp, "Seller (name / entity)", "sellerName")}
                {fld(pf, sp, "Property Address", "propertyAddress")}
                {fld(pf, sp, "Legal Description", "legalDescription", { type: "textarea", placeholder: "Lot / block / plat or metes & bounds…" })}
                {fld(pf, sp, "Parcel ID (optional)", "parcelId")}
                {fld(pf, sp, "Purchase Price", "purchasePrice", { placeholder: "1,250,000" })}
                {fld(pf, sp, "Earnest Money Deposit", "deposit", { placeholder: "25,000" })}
                {fld(pf, sp, "Additional Deposit after DD (optional)", "additionalDeposit", { placeholder: "25,000" })}
                {fld(pf, sp, "Financing", "financingType", { options: ["All cash", "Conventional / commercial financing", "SBA financing", "Seller financing", "Subject to existing financing"] })}
                {fld(pf, sp, "Due Diligence Period (days)", "dueDiligenceDays", { type: "number" })}
                {fld(pf, sp, "Closing (days after due diligence)", "closingDays", { type: "number" })}
                {fld(pf, sp, "Deed Type", "deedType", { options: ["Special Warranty Deed", "General Warranty Deed", "Statutory Warranty Deed"] })}
                {fld(pf, sp, "Title Company / Closing Agent (optional)", "titleCompany")}
                {fld(pf, sp, "Possession", "possession", { placeholder: "At closing" })}
                {fld(pf, sp, "Closing Costs & Prorations", "closingCosts", { type: "textarea" })}
                {fld(pf, sp, "Title & Survey", "survey", { type: "textarea" })}
                {fld(pf, sp, "Contingencies", "contingencies", { type: "textarea" })}
                {fld(pf, sp, "Assignment", "assignment", { type: "textarea" })}
                {fld(pf, sp, "Commission %", "commissionPct", { placeholder: "6" })}
                {fld(pf, sp, "Commission Paid By", "commissionPaidBy", { options: ["Seller", "Buyer", "Each party its own"] })}
                {fld(pf, sp, "Buyer's Broker (name / brokerage)", "brokerName")}
                {fld(pf, sp, "Exclusivity / No-Shop (days)", "exclusivityDays", { type: "number" })}
                {fld(pf, sp, "This Offer Expires", "expiresDate", { type: "date" })}
                {fld(pf, sp, "Prepared By", "preparedBy", { placeholder: "Your name, Brokerage" })}
                {fld(pf, sp, "Additional Terms (optional)", "additionalTerms", { type: "textarea" })}
              </>
            ) : (
              <>
                {fld(lf, sl, "LOI Date", "loiDate", { type: "date" })}
                {fld(lf, sl, "Landlord", "landlordName")}
                {fld(lf, sl, "Tenant", "tenantName")}
                {fld(lf, sl, "Trade Name", "tradeName", { placeholder: "Tenant's business name" })}
                {fld(lf, sl, "Property / Center Name", "propertyName", { placeholder: "Regent Shoppes" })}
                {fld(lf, sl, "Premises", "premises", { type: "textarea", placeholder: "Unit / suite, address" })}
                {fld(lf, sl, "Approx. Square Feet", "sqft", { placeholder: "4,750" })}
                {fld(lf, sl, "Permitted Use", "permittedUse", { placeholder: "Veterinary clinic, gym, retail…" })}
                {fld(lf, sl, "Term", "term", { placeholder: "Five (5) years" })}
                {fld(lf, sl, "Renewal Options", "renewalOptions", { type: "textarea" })}
                {fld(lf, sl, "Base Rent ($/SF)", "baseRent", { placeholder: "14.00" })}
                {fld(lf, sl, "Rent Basis", "rentBasis", { options: ["Triple Net (NNN)", "Modified Gross", "Gross / Full Service"] })}
                {fld(lf, sl, "Rent Escalation", "rentEscalation", { type: "textarea" })}
                {fld(lf, sl, "CAM, Taxes & Insurance", "camTaxesInsurance", { type: "textarea" })}
                {fld(lf, sl, "Estimated Charges ($/SF, optional)", "estCharges", { placeholder: "$7.85" })}
                {fld(lf, sl, "Florida Sales Tax", "floridaTax", { type: "textarea" })}
                {fld(lf, sl, "Rent Commencement", "rentCommencement", { type: "textarea" })}
                {fld(lf, sl, "Security Deposit", "securityDeposit", { type: "textarea" })}
                {fld(lf, sl, "Prepaid Rent", "prepaidRent", { type: "textarea" })}
                {fld(lf, sl, "Tenant Improvement Allowance", "tiAllowance", { type: "textarea" })}
                {fld(lf, sl, "Landlord's Work", "landlordWork", { type: "textarea" })}
                {fld(lf, sl, "Tenant's Work", "tenantWork", { type: "textarea" })}
                {fld(lf, sl, "HVAC", "hvac", { type: "textarea" })}
                {fld(lf, sl, "Utilities", "utilities", { type: "textarea" })}
                {fld(lf, sl, "Signage", "signage", { type: "textarea" })}
                {fld(lf, sl, "Operating Hours", "operatingHours", { type: "textarea" })}
                {fld(lf, sl, "Guaranty", "guaranty", { type: "textarea" })}
                {fld(lf, sl, "Impact Fees (optional)", "impactFees", { type: "textarea" })}
                {fld(lf, sl, "CC&Rs / Design Guidelines", "ccrs", { type: "textarea" })}
                {fld(lf, sl, "Documentation (Lease form)", "leaseForm" )}
                {fld(lf, sl, "Brokerage Commission", "commissionDetail", { type: "textarea", placeholder: "Who represents whom & who pays…" })}
                {fld(lf, sl, "This Offer Expires", "expiresDate", { type: "date" })}
                {fld(lf, sl, "Prepared By", "preparedBy", { placeholder: "Your name, Brokerage" })}
                {fld(lf, sl, "Additional Terms (optional)", "additionalTerms", { type: "textarea" })}
              </>
            )}
          </div>
          {/* Preview */}
          <div style={{ flex: "1 1 380px", minWidth: 320 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Preview</div>
            <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, maxHeight: "66vh", overflow: "auto", background: "#F3F4F6", padding: 12 }}>
              <div style={{ background: "#fff", padding: "40px 46px", fontFamily: "Calibri, Arial, sans-serif", color: "#111", fontSize: 12.5, lineHeight: 1.5 }}>
                <div style={{ textAlign: "center", fontWeight: 700, fontSize: 16, marginBottom: 2 }}>LETTER OF INTENT</div>
                <div style={{ textAlign: "center", fontSize: 11.5, color: "#555", fontStyle: "italic", marginBottom: 18 }}>(Non-Binding — {mode === "lease" ? "Proposal to Lease" : "Proposal to Purchase"})</div>
                <div style={{ marginBottom: 12 }}>{fmtDate(mode === "lease" ? lf.loiDate : pf.loiDate)}</div>
                {mode === "purchase" ? (
                  <>
                    <div><b>To (Seller):</b> {pf.sellerName || "____________"}</div>
                    <div><b>From (Buyer):</b> {pf.buyerName || "____________"}</div>
                    <div style={{ marginBottom: 12 }}><b>Re:</b> Proposed Purchase of {pf.propertyAddress || "____________"}</div>
                    {purchaseClauses().map(([t, text], i) => <div key={i} style={{ marginBottom: 9 }}><b>{i + 1}. {t}.</b> {text}</div>)}
                    <div style={{ marginTop: 16 }}><b>Buyer:</b> {pf.buyerName} ____________  <b>Seller:</b> {pf.sellerName} ____________</div>
                  </>
                ) : (
                  <>
                    <div><b>To (Tenant):</b> {lf.tenantName || "____________"}</div>
                    <div><b>From (Landlord):</b> {lf.landlordName || "____________"}</div>
                    <div style={{ marginBottom: 12 }}><b>Re:</b> Proposed Lease at {lf.propertyName || lf.premises || "____________"}</div>
                    {leaseRows().map(([label, value], i) => <div key={i} style={{ marginBottom: 7 }}><b>{label.toUpperCase()}:</b> {value}</div>)}
                    <div style={{ marginTop: 16 }}><b>Landlord:</b> {lf.landlordName} ____________  <b>Tenant:</b> {lf.tenantName} ____________</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Actions */}
        <div style={{ position: "sticky", bottom: 0, background: "#fff", borderTop: `1px solid ${COLORS.border}`, padding: "14px 22px", display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {error && <div style={{ color: COLORS.danger, fontSize: 13, marginRight: "auto" }}>{error}</div>}
          <button onClick={handleDownload} disabled={busy} style={{ background: "#fff", color: "#0E7490", border: "1px solid #0E7490", padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Working…" : "⬇ Download Word (.docx)"}
          </button>
          <button onClick={handleSave} disabled={busy} style={{ background: "#0E7490", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Saving…" : "Save Word to Documents"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Request an e-signature on any PDF document ───────────────────────────────
// Signers get a private signing link (same flow buyers use for offers). The
// agent can TAP-TO-PLACE signature blocks anywhere on the pages (DocuSign-style)
// — those exact spots become the signer's guided markers and where the ink is
// stamped. No blocks placed → the app auto-detects "Signature" lines; if none
// exist, signatures appear on the attached certificate page. Signed copy files
// back into Documents automatically as "✍️ Signed — <name>".
function DocSignModal({ tx, doc, allDocs = [], headers, onClose }) {
  const [info, setInfo] = useState(null);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  // Bundle: more documents signed in the SAME round (one email, one link).
  const [extraIds, setExtraIds] = useState([]);
  const extraChoices = allDocs.filter(d =>
    d.id !== doc.id && /pdf$/i.test(d.mime_type || "") && !/^✍️ Signed/.test(d.name || ""));
  const selDocs = [doc, ...extraIds.map(id => extraChoices.find(d => d.id === id)).filter(Boolean)];
  // Tap-to-place state
  const [placing, setPlacing] = useState(false);
  const [pagesByDoc, setPagesByDoc] = useState({}); // docId → {pages:[{num,width,height,dataUrl}], err}
  const [activeSigner, setActiveSigner] = useState(1);
  const [placeKind, setPlaceKind] = useState("signature"); // signature | initials | date | text
  const [placements, setPlacements] = useState([]); // [{signer,docId,page,x,y,kind,text}] PDF pts, bottom-left origin

  const loadInfo = async () => {
    try {
      const r = await fetch(`${API}/documents/${doc.id}/signatures`, { headers });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Couldn't load signature status");
      setInfo(b);
      if (!(b.signers || []).length) {
        const sug = (b.suggested || []).slice(0, 4).map(s => ({ name: s.name || "", email: s.email || "" }));
        setRows(sug.length ? sug : [{ name: "", email: "" }]);
      }
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { loadInfo(); /* eslint-disable-next-line */ }, [doc.id]);

  // Load + render each selected document the first time it's needed in
  // tap-to-place. Loads survive re-renders (checking another box mid-load
  // must not abort the first document) — only unmount stops updates.
  const loadingDocs = useRef(new Set());
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => {
    if (!placing) return;
    (async () => {
      const pdfjs = await import("pdfjs-dist/build/pdf.min.mjs");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      const withTimeout = (pr, ms) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
      for (const d of selDocs) {
        if (!alive.current || loadingDocs.current.has(d.id)) continue;
        loadingDocs.current.add(d.id);
        setPagesByDoc(prev => prev[d.id] ? prev : { ...prev, [d.id]: { pages: [], err: null } });
        try {
          const resp = await fetch(`${API}/documents/${d.id}/file.pdf`, { headers });
          if (!resp.ok) throw new Error("Couldn't load the document preview.");
          const bytes = new Uint8Array(await resp.arrayBuffer());
          const pdf = await pdfjs.getDocument({ data: bytes, useSystemFonts: true, standardFontDataUrl: "/pdf-fonts/" }).promise;
          for (let i = 1; i <= pdf.numPages && alive.current; i++) {
            let entry;
            try {
              const page = await withTimeout(pdf.getPage(i), 15000);
              const vp0 = page.getViewport({ scale: 1 });
              const vp = page.getViewport({ scale: 1.4 });
              const canvas = document.createElement("canvas");
              canvas.width = vp.width; canvas.height = vp.height;
              await withTimeout(page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise, 15000);
              entry = { num: i, width: vp0.width, height: vp0.height, dataUrl: canvas.toDataURL("image/jpeg", 0.85) };
            } catch {
              entry = { num: i, width: 612, height: 792, dataUrl: null };
            }
            if (alive.current) setPagesByDoc(prev => ({ ...prev, [d.id]: { pages: [...(prev[d.id]?.pages || []), entry], err: null } }));
          }
        } catch (e) { if (alive.current) setPagesByDoc(prev => ({ ...prev, [d.id]: { pages: [], err: e.message } })); }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placing, extraIds.join(",")]);

  const setRow = (i, k, v) => setRows(rs => rs.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const signerNames = rows.map(r => (r.name || "").trim()).filter(Boolean);

  const placeAt = (docId, pg, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = rect.width / pg.width;
    const x = Math.max(0, Math.min(pg.width - 10, (e.clientX - rect.left) / scale));
    const yTop = (e.clientY - rect.top) / scale;
    const y = Math.max(4, Math.min(pg.height - 10, pg.height - yTop));
    let text = "";
    if (placeKind === "text") {
      const t = prompt("What should this text box say?\n\nLeave it EMPTY to let the signer type it in when they sign.");
      if (t === null) return; // cancelled
      text = t.trim().slice(0, 120);
    }
    setPlacements(ps => [...ps, { signer: activeSigner, docId, page: pg.num, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, kind: placeKind, text }]);
  };
  const initialsShort = (n) => {
    const parts = String(n || "").trim().split(/\s+/).filter(Boolean);
    return parts.length ? (parts[0][0] + (parts.length > 1 ? "." + parts[parts.length - 1][0] : "")).toUpperCase() + "." : "A.B.";
  };

  const send = async () => {
    setErr(null);
    const clean = rows.map(r => ({ name: (r.name || "").trim(), email: (r.email || "").trim() })).filter(r => r.name || r.email);
    if (!clean.length || clean.some(r => !r.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email))) {
      setErr("Every signer needs a name and a valid email."); return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${API}/documents/${doc.id}/request-signatures`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ signers: clean, placements, alsoDocIds: extraIds }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Couldn't send signing links");
      alert("✍️ Signing link sent to " + clean.map(s => s.name).join(" and ") + "." +
        (selDocs.length > 1 ? `\n\nOne link covers all ${selDocs.length} documents — they sign everything in one sitting.` : "") +
        (placements.length ? "\n\nThey'll be guided to the exact spot" + (placements.length > 1 ? "s" : "") + " you placed." : "") +
        "\n\nWhen everyone has signed, each signed copy (with its signature certificate) appears here in Documents — and you'll get a pop-up.");
      onClose();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const cancel = async () => {
    if (!confirm("Cancel the outstanding signing links for this document?")) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/documents/${doc.id}/cancel-signatures`, { method: "POST", headers });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Couldn't cancel");
      setInfo(null);
      await loadInfo();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const pending = (info?.signers || []).filter(s => s.status === "pending");
  const roundOut = (info?.signers || []).length > 0;
  const SIGNER_COLORS = ["#86198f", "#0c4a6e", "#b45309", "#166534"];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "40px 12px" }}
      onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: placing ? 760 : 540, boxShadow: "0 20px 60px rgba(2,6,23,0.35)" }} onClick={e => e.stopPropagation()}>
        <div style={{ background: "#86198f", color: "#fff", borderRadius: "14px 14px 0 0", padding: "16px 22px" }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>✍️ Get this signed — {doc.name}</div>
          <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 3 }}>Each signer gets a private email link to review and sign on their phone or computer. No DocuSign needed.</div>
        </div>
        <div style={{ padding: 22 }}>
          {!info && !err && <div style={{ color: "#64748b", fontSize: 14 }}>Loading…</div>}
          {err && <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: 10, fontSize: 13, color: "#7f1d1d", marginBottom: 12 }}>⚠️ {err}</div>}

          {info && roundOut && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#374151", marginBottom: 8 }}>Signing round in progress</div>
              {(info.signers || []).map(s => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
                  <span>{s.signer_name} <span style={{ color: "#64748b" }}>({s.signer_email})</span></span>
                  {s.status === "signed"
                    ? <span style={{ color: "#15803d", fontWeight: 700 }}>✅ Signed</span>
                    : <span style={{ color: "#92400e", fontWeight: 700 }}>⏳ Waiting</span>}
                </div>
              ))}
              {pending.length > 0 && (
                <button onClick={cancel} disabled={busy}
                  style={{ marginTop: 8, padding: "8px 16px", background: "#fee2e2", color: "#7f1d1d", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  Cancel signing links
                </button>
              )}
              {pending.length === 0 && (
                <div style={{ fontSize: 12.5, color: "#15803d", marginTop: 8 }}>✅ Everyone signed — look for "✍️ Signed — {doc.name}" in Documents.</div>
              )}
            </div>
          )}

          {info && !roundOut && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#374151", marginBottom: 8 }}>Who needs to sign?</div>
              {rows.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input value={r.name} onChange={e => setRow(i, "name", e.target.value)} placeholder="Full name"
                    style={{ flex: 1, padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, fontFamily: "inherit", minWidth: 0 }} />
                  <input value={r.email} onChange={e => setRow(i, "email", e.target.value)} placeholder="Email"
                    style={{ flex: 1, padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, fontFamily: "inherit", minWidth: 0 }} />
                  {rows.length > 1 && (
                    <button onClick={() => { setRows(rs => rs.filter((_, j) => j !== i)); setPlacements(ps => ps.filter(p => p.signer !== i + 1).map(p => p.signer > i + 1 ? { ...p, signer: p.signer - 1 } : p)); }}
                      style={{ background: "none", border: "none", color: "#7f1d1d", fontSize: 16, cursor: "pointer" }}>✕</button>
                  )}
                </div>
              ))}
              {rows.length < 4 && (
                <button onClick={() => setRows(rs => [...rs, { name: "", email: "" }])}
                  style={{ background: "none", border: "1px dashed #94a3b8", color: "#475569", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 10 }}>
                  + Add another signer
                </button>
              )}

              {/* Bundle more documents into the same round */}
              {extraChoices.length > 0 && (
                <div style={{ margin: "4px 0 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#374151", marginBottom: 6 }}>📚 Sign more documents in the same round <span style={{ fontWeight: 400, color: "#64748b" }}>(optional)</span></div>
                  <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: 8 }}>One email, one link — they sign everything in one sitting. Each document still files back as its own signed copy.</div>
                  <div style={{ maxHeight: 150, overflowY: "auto" }}>
                    {extraChoices.map(d => (
                      <label key={d.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#374151", padding: "4px 0", cursor: "pointer" }}>
                        <input type="checkbox" checked={extraIds.includes(d.id)}
                          onChange={e => {
                            if (e.target.checked) { setExtraIds(ids => ids.length < 7 ? [...ids, d.id] : ids); }
                            else { setExtraIds(ids => ids.filter(x => x !== d.id)); setPlacements(ps => ps.filter(p => p.docId !== d.id)); }
                          }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📄 {d.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Tap-to-place signature blocks */}
              <div style={{ margin: "6px 0 12px" }}>
                <button onClick={() => setPlacing(p => !p)}
                  style={{ padding: "8px 16px", background: placing ? "#86198f" : "#faf5ff", color: placing ? "#fff" : "#86198f", border: "1px solid #d8b4fe", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  📍 {placing ? "Hide pages" : "Place signature, initials, date & text blocks (optional)"}
                </button>
                {!placing && placements.length > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 12, color: "#15803d", fontWeight: 700 }}>✅ {placements.length} block{placements.length > 1 ? "s" : ""} placed</span>
                )}
                {!placing && placements.length === 0 && (
                  <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 6 }}>
                    No blocks placed → the app finds printed "Signature" lines automatically; if there are none, signatures appear on the attached certificate page.
                  </div>
                )}
              </div>

              {placing && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#374151" }}>Tap a page where</span>
                    {(signerNames.length ? signerNames : ["Signer 1"]).map((n, i) => (
                      <button key={i} onClick={() => setActiveSigner(i + 1)}
                        style={{ padding: "5px 12px", borderRadius: 14, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "2px solid " + SIGNER_COLORS[i % 4], background: activeSigner === i + 1 ? SIGNER_COLORS[i % 4] : "#fff", color: activeSigner === i + 1 ? "#fff" : SIGNER_COLORS[i % 4] }}>
                        {n || `Signer ${i + 1}`}
                      </button>
                    ))}
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#374151" }}>should sign. Tap a block to remove it.</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#374151" }}>Block type:</span>
                    {[["signature", "✍️ Signature"], ["initials", "🔤 Initials"], ["date", "📅 Date signed"], ["text", "💬 Text"]].map(([k, label]) => (
                      <button key={k} onClick={() => setPlaceKind(k)}
                        style={{ padding: "5px 12px", borderRadius: 14, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "2px solid #64748b", background: placeKind === k ? "#334155" : "#fff", color: placeKind === k ? "#fff" : "#334155" }}>
                        {label}
                      </button>
                    ))}
                    {placeKind === "date" && <span style={{ fontSize: 11.5, color: "#64748b" }}>Fills in the date they sign, automatically.</span>}
                    {placeKind === "text" && <span style={{ fontSize: 11.5, color: "#64748b" }}>You type it now — or leave it blank and the signer types it.</span>}
                  </div>
                  <div style={{ maxHeight: 460, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 10, padding: 8, background: "#f1f5f9" }}>
                    {selDocs.map(d => { const entry = pagesByDoc[d.id] || { pages: [], err: null }; return (
                    <div key={d.id}>
                      {selDocs.length > 1 && (
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", background: "#e2e8f0", borderRadius: 6, padding: "5px 10px", margin: "2px 0 8px" }}>📄 {d.name}</div>
                      )}
                      {entry.err && <div style={{ fontSize: 13, color: "#7f1d1d", padding: 6 }}>⚠️ {entry.err}</div>}
                      {!entry.err && entry.pages.length === 0 && <div style={{ fontSize: 13, color: "#64748b", padding: 10 }}>Loading pages…</div>}
                      {entry.pages.map(pg => (
                      <div key={d.id + "-" + pg.num} style={{ position: "relative", marginBottom: 10, cursor: "crosshair" }}
                        onClick={(e) => placeAt(d.id, pg, e)}>
                        {pg.dataUrl
                          ? <img src={pg.dataUrl} alt={"Page " + pg.num} style={{ display: "block", width: "100%", borderRadius: 4, boxShadow: "0 1px 6px rgba(2,6,23,0.15)" }} draggable={false} />
                          : <div style={{ width: "100%", height: 300, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#64748b" }}>Page {pg.num} preview unavailable</div>}
                        <div style={{ position: "absolute", top: 4, left: 6, fontSize: 10, fontWeight: 700, color: "#64748b", background: "rgba(255,255,255,0.85)", borderRadius: 4, padding: "1px 6px" }}>p.{pg.num}</div>
                        {placements.filter(p => p.docId === d.id && p.page === pg.num).map((p, pi) => {
                          const idx = placements.indexOf(p);
                          const color = SIGNER_COLORS[(p.signer - 1) % 4];
                          const first = (signerNames[p.signer - 1] || `Signer ${p.signer}`).split(" ")[0];
                          const kindOf = p.kind || "signature";
                          const widthPt = kindOf === "signature" ? 170 : kindOf === "initials" ? 48 : kindOf === "date" ? 80 : 130;
                          const label = kindOf === "signature" ? `✍️ ${first} signs here ✕`
                            : kindOf === "initials" ? `🔤 ${initialsShort(signerNames[p.signer - 1])} ✕`
                            : kindOf === "date" ? "📅 date ✕"
                            : `💬 ${p.text || first + " types"} ✕`;
                          return (
                            <div key={pi}
                              onClick={(e) => { e.stopPropagation(); setPlacements(ps => ps.filter((_, j) => j !== idx)); }}
                              title="Tap to remove"
                              style={{ position: "absolute", left: (p.x / pg.width * 100) + "%", bottom: (p.y / pg.height * 100) + "%", width: (widthPt / pg.width * 100) + "%", height: kindOf === "signature" ? 26 : 20, border: "2px dashed " + color, background: color + "22", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                              <span style={{ fontSize: 10, fontWeight: 800, color, whiteSpace: "nowrap", overflow: "hidden" }}>{label}</span>
                            </div>
                          );
                        })}
                      </div>
                      ))}
                    </div>
                    ); })}
                  </div>
                </div>
              )}

              <button onClick={send} disabled={busy}
                style={{ width: "100%", padding: "12px 0", background: busy ? "#94a3b8" : "#86198f", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: busy ? "default" : "pointer", fontFamily: "inherit", marginTop: 4 }}>
                {busy ? "Sending links…" : "Send signing link ✍️"}
              </button>
              <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 8, textAlign: "center" }}>
                The signed copy files back here automatically, with a signature certificate (who signed, when, from where) attached.
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: "12px 22px", borderTop: "1px solid #e5e7eb", textAlign: "right" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Close</button>
        </div>
      </div>
    </div>
  );
}
