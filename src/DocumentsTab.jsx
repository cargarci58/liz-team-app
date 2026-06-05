import { useState, useEffect } from "react";

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
  const [showAdd, setShowAdd] = useState(false);
  const [addLabel, setAddLabel] = useState("");
  const [addSide, setAddSide] = useState(tx.transaction_type === "Buyer Representation" ? "Buyer Representation" : "Listing (Seller)");
  const [addBusy, setAddBusy] = useState(false);
  const tok = localStorage.getItem("tp_token") || "";
  const headers = { "Content-Type": "application/json", "Authorization": "Bearer " + tok };
  let role = ""; try { role = JSON.parse(atob((tok.split(".")[1] || ""))).role || ""; } catch { /* ignore */ }
  const isAdmin = role === "admin" || role === "superadmin";

  const addRequirement = async () => {
    const label = addLabel.trim();
    if (!label) { alert("Enter the document name."); return; }
    setAddBusy(true);
    try {
      const res = await fetch(`${API}/document-requirements/custom`, {
        method: "POST", headers, body: JSON.stringify({ label, side: addSide }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Add failed");
      setAddLabel(""); setShowAdd(false);
      await loadRequired();
    } catch (e) { alert("Add failed: " + e.message); }
    finally { setAddBusy(false); }
  };

  const removeRequirement = async (item) => {
    if (!item.requirementId) return;
    if (!window.confirm(`Remove "${item.label}" as a brokerage requirement?\n\nIt will stop appearing on this side's deals. (Uploaded files are not deleted.)`)) return;
    try {
      const res = await fetch(`${API}/admin/document-requirements/${item.requirementId}`, { method: "DELETE", headers });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || res.status); }
      await loadRequired();
    } catch (e) { alert("Remove failed: " + e.message); }
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
          {item.custom && isAdmin && item.requirementId && (
            <button onClick={() => removeRequirement(item)} title="Remove this brokerage requirement"
              style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#B91C1C", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              ✕ remove
            </button>
          )}
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
          </div>

          {/* Broker/admin: add a brokerage-specific required document */}
          {isAdmin && (
            <div style={{ marginTop: 12, borderTop: "1px dashed #DDD", paddingTop: 12 }}>
              {!showAdd ? (
                <button onClick={() => setShowAdd(true)}
                  style={{ background: "none", border: "1px solid #BBB", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#333", cursor: "pointer" }}>
                  + Add a document our brokerage requires
                </button>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input value={addLabel} onChange={e => setAddLabel(e.target.value)} placeholder="Document name (e.g. Buyer's Broker's Disclosure)"
                    style={{ flex: "2 1 240px", padding: "8px 10px", borderRadius: 7, border: "1px solid #CCC", fontSize: 13, fontFamily: "inherit" }} />
                  <select value={addSide} onChange={e => setAddSide(e.target.value)}
                    style={{ padding: "8px 10px", borderRadius: 7, border: "1px solid #CCC", fontSize: 13, fontFamily: "inherit" }}>
                    <option value="Listing (Seller)">Seller-side deals</option>
                    <option value="Buyer Representation">Buyer-side deals</option>
                    <option value="both">All deals (both sides)</option>
                  </select>
                  <button onClick={addRequirement} disabled={addBusy}
                    style={{ padding: "8px 14px", borderRadius: 7, border: "none", background: "#1E8449", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {addBusy ? "Adding…" : "Add"}
                  </button>
                  <button onClick={() => { setShowAdd(false); setAddLabel(""); }}
                    style={{ padding: "8px 12px", borderRadius: 7, border: "1px solid #CCC", background: "#fff", fontSize: 13, color: "#666", cursor: "pointer" }}>
                    Cancel
                  </button>
                  <div style={{ flexBasis: "100%", fontSize: 11, color: COLORS.muted }}>Applies to every deal of that side for your brokerage, marked BROKER. Required (can be uploaded or waived per deal).</div>
                </div>
              )}
            </div>
          )}
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
    </div>
  );
}
