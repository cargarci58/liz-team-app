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

export default function DocumentsTab({ tx }) {
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
  const [showLOI, setShowLOI] = useState(false); // Letter of Intent generator (commercial only)
  const isCommercial = /commercial/i.test(`${tx.propertyType || ""} ${tx.constructionType || ""}`);
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
      alert(
        `📅 Dates read from "${doc.name}"\n\n` +
        `${d.milestonesDated} milestone${d.milestonesDated === 1 ? "" : "s"} dated on your timeline.\n` +
        (d.executedDate ? `Executed: ${d.executedDate}\n` : "") +
        (d.closingDate ? `Closing: ${d.closingDate}\n` : "") +
        (sigLine ? `\n${sigLine}\n` : "") +
        (d.notes ? `\nNote: ${d.notes}` : "")
      );
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

  useEffect(() => {
    loadDocs().finally(() => setLoading(false));
    loadRequired();
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

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      alert(`File too large. Maximum is 50 MB, this file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`);
      e.target.value = "";
      return;
    }
    if (file.type && !ALLOWED_UPLOAD_TYPES.includes(file.type)) {
      alert(`File type "${file.type}" not allowed. Please upload PDFs, images, Word, Excel, or text files.`);
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      // Read the file as base64 and upload through the server (server-proxied).
      // The old browser→R2 presigned PUT failed CORS ("Failed to fetch").
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      const res = await fetch(`${API}/documents/upload`, {
        method: "POST", headers,
        body: JSON.stringify({ transactionId: tx.id, fileName: file.name, fileType: file.type, category, base64 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || ("Upload failed (" + res.status + ")"));
      const docsRes = await fetch(`${API}/documents/${tx.id}`, { headers });
      const docsData = await docsRes.json();
      if (docsData.documents) setDocs(docsData.documents);
      loadRequired();
      alert("✅ Document uploaded!");
    } catch (e) {
      console.error("Upload failed:", e);
      alert("Upload failed: " + e.message);
    }
    finally { setUploading(false); e.target.value = ""; }
  };

  const handleDownload = async (doc) => {
    try {
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
      const res = await fetch(`${API}/documents/${doc.id}/view-url`, { headers });
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

  const reqItems = required.filter(i => i.required);
  const recItems = required.filter(i => !i.required);
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

  return (
    <div style={{ padding: 24 }}>
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
        <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 16 }}>PDF, Word, Excel, Images up to 50MB</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
          <select value={category} onChange={e => setCategory(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #DDDDDD", fontSize: 13, fontFamily: "inherit" }}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <label style={{ padding: "8px 20px", background: "#C0392B", color: "#fff", borderRadius: 8, cursor: uploading ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 13, opacity: uploading ? 0.7 : 1 }}>
            {uploading ? "Uploading..." : "Choose File"}
            <input type="file" onChange={handleUpload} disabled={uploading} style={{ display: "none" }}
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
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>{docs.length} document{docs.length !== 1 ? "s" : ""}</div>
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
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => toggleVisibility(doc)}
                        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #DDDDDD", background: doc.is_visible_to_client ? "#D5F5E3" : "#F5F5F5", cursor: "pointer", fontSize: 11 }}>
                        {doc.is_visible_to_client ? "👁 Client" : "🔒 Private"}
                      </button>
                      <button onClick={() => openPreview(doc)} title="Preview"
                        style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #DDDDDD", background: "#fff", cursor: "pointer", fontSize: 12, color: COLORS.info }}>
                        👁 View
                      </button>
                      {isContractReadable(doc) && (
                        <button onClick={() => readContractDates(doc)} disabled={readingDates === doc.id}
                          title="Have AI read this contract and fill in the deal's dates + timeline"
                          style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #C9A84C", background: readingDates === doc.id ? "#F5F5F5" : "#FCF6E3", cursor: readingDates === doc.id ? "default" : "pointer", fontSize: 12, color: "#7A5C00", fontWeight: 600 }}>
                          {readingDates === doc.id ? "Reading…" : "📅 Read dates"}
                        </button>
                      )}
                      <button onClick={() => setShare({ doc })} title="Email this file to a party in the transaction"
                        style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #DDDDDD", background: "#fff", cursor: "pointer", fontSize: 12, color: COLORS.info }}>
                        📤 Share
                      </button>
                      <button onClick={() => handleDownload(doc)} title="Download"
                        style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #DDDDDD", background: "#fff", cursor: "pointer", fontSize: 12, color: COLORS.info }}>
                        ↓
                      </button>
                      <button onClick={() => handleDelete(doc)}
                        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #FCA5A5", background: "#fff", cursor: "pointer", fontSize: 12, color: COLORS.danger }}>
                        🗑
                      </button>
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

      {/* Share-with-party modal */}
      {share && (
        <ShareModal tx={tx} doc={share.doc} headers={headers} onClose={() => setShare(null)} />
      )}
    </div>
  );
}

// ── Share an existing document with a party ──────────────────────────────────
// Pick a party already on the transaction (or type any email), add an optional
// note, and the server emails the file as an attachment in the agent's voice.
function ShareModal({ tx, doc, headers, onClose }) {
  const parties = (tx.parties || []).filter(p => p.email && !/hoa/i.test(p.role || ""));
  const [picked, setPicked] = useState(parties[0] ? String(parties[0].id || parties[0].email) : "custom");
  const [email, setEmail] = useState(parties[0]?.email || "");
  const [name, setName] = useState(parties[0]?.name || "");
  const [role, setRole] = useState(parties[0]?.role || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const onPick = (val) => {
    setPicked(val);
    if (val === "custom") { setEmail(""); setName(""); setRole(""); return; }
    const p = parties.find(x => String(x.id || x.email) === val);
    if (p) { setEmail(p.email || ""); setName(p.name || ""); setRole(p.role || ""); }
  };

  const send = async () => {
    if (!email || !/.+@.+\..+/.test(email)) { setError("Enter a valid email address."); return; }
    setError(null); setBusy(true);
    try {
      const res = await fetch(`${API}/documents/${doc.id}/share`, {
        method: "POST", headers,
        body: JSON.stringify({ toEmail: email.trim(), toName: name.trim(), toRole: role, message }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Could not send.");
      setDone(true);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
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
              <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Sent to {name || email}</div>
              <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 18 }}>The document is on its way and is now visible in their portal.</div>
              <button onClick={onClose} style={{ background: COLORS.gold, color: "#fff", border: "none", padding: "10px 22px", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Done</button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Send to</label>
                <select value={picked} onChange={e => onPick(e.target.value)} style={inp}>
                  {parties.map(p => <option key={String(p.id || p.email)} value={String(p.id || p.email)}>{p.name || p.email} — {p.role}</option>)}
                  <option value="custom">✏️ Other email…</option>
                </select>
              </div>
              {picked === "custom" && (
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
                  {busy ? "Sending…" : "📤 Send"}
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
