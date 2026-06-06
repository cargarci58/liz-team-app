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
  const [showLOI, setShowLOI] = useState(false); // Letter of Intent generator (commercial only)
  const isCommercial = /commercial/i.test(`${tx.propertyType || ""} ${tx.constructionType || ""}`);
  const tok = localStorage.getItem("tp_token") || "";
  const headers = { "Content-Type": "application/json", "Authorization": "Bearer " + tok };

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

// ── Letter of Intent generator (commercial deals) ───────────────────────────
// Pre-fills from the deal, renders a ready-to-send NON-BINDING commercial LOI
// with every clause pre-written, and lets the agent confirm the numbers, then
// generate a PDF that downloads and/or saves into the deal's Documents (tagged
// document_type "Letter_of_Intent" so it ticks the LOI checklist slot).
function LetterOfIntentModal({ tx, headers, onClose, onSaved }) {
  const partyName = (role) => (tx.parties || []).find(p => (p.role || "") === role)?.name || "";
  const fullAddress = [tx.address, tx.city, tx.state, tx.zipCode].filter(Boolean).join(", ");
  const todayISO = new Date().toISOString().split("T")[0];
  const plusDaysISO = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split("T")[0]; };

  const [f, setF] = useState({
    loiDate: todayISO,
    buyerName: partyName("Buyer") || partyName("Buyer (Entity)") || "",
    sellerName: partyName("Seller") || "",
    propertyAddress: fullAddress,
    propertyDesc: "",
    purchasePrice: tx.contractPrice || tx.listPrice || "",
    deposit: "",
    financingType: tx.isCash ? "All cash" : "Conventional / commercial financing",
    dueDiligenceDays: "45",
    closingDays: "30",
    exclusivityDays: "30",
    expiresDate: plusDaysISO(5),
    preparedBy: "",
    additionalTerms: "",
  });
  const set = (k) => (v) => setF(s => ({ ...s, [k]: v }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const letterRef = useRef(null);

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

  const clauses = [
    ["Property", `The proposed transaction concerns the real property located at ${f.propertyAddress || "____________"}${f.propertyDesc ? `, further described as ${f.propertyDesc}` : ""}, together with all improvements, fixtures, and appurtenances (the "Property").`],
    ["Purchase Price", `The proposed total purchase price for the Property is ${fmtMoney(f.purchasePrice)}, payable at closing subject to customary prorations and adjustments.`],
    ["Earnest Money Deposit", `Upon execution of a definitive purchase agreement, Buyer shall deposit ${fmtMoney(f.deposit)} in escrow as an earnest money deposit, to be applied to the purchase price at closing.`],
    ["Due Diligence / Feasibility Period", `Buyer shall have ${f.dueDiligenceDays || "____"} days following the effective date of a definitive agreement to inspect the Property and review all title, survey, environmental, zoning, lease, financial, and other due-diligence matters. Buyer may terminate for any reason during this period and receive a full refund of the deposit.`],
    ["Closing", `Closing shall occur within ${f.closingDays || "____"} days after expiration of the Due Diligence Period, at a title company or closing agent mutually acceptable to the parties.`],
    ["Financing", `This proposal contemplates ${f.financingType || "____________"}. ${/cash/i.test(f.financingType) ? "Buyer will provide proof of funds upon request." : "Closing will be contingent upon Buyer obtaining acceptable financing within the Due Diligence Period."}`],
    ["Title & Survey", `Seller shall convey marketable, insurable title by special/general warranty deed, free of liens and encumbrances other than those approved by Buyer. Buyer may obtain a current ALTA survey at Buyer's election.`],
    ["Brokerage", `Each party shall be responsible for its own broker and any commission shall be addressed in the definitive agreement. Each party represents it has dealt with no broker other than as disclosed.`],
    ["Exclusivity / No-Shop", `For ${f.exclusivityDays || "____"} days following acceptance of this Letter of Intent, Seller agrees not to solicit, negotiate, or accept any competing offer for the Property, so the parties may negotiate a definitive agreement in good faith.`],
    ["Confidentiality", `The parties shall keep the terms of this Letter and their negotiations confidential, except as required by law or to their respective advisors.`],
    ["Non-Binding Effect", `THIS LETTER OF INTENT IS A NON-BINDING EXPRESSION OF INTEREST ONLY. Except for the Exclusivity / No-Shop and Confidentiality paragraphs (which are binding), no party shall have any obligation unless and until a definitive written purchase agreement is fully executed by both parties.`],
    ["Governing Law", `This Letter shall be governed by the laws of the State of Florida.`],
    ["Expiration", `This Letter of Intent will expire if not accepted in writing by ${fmtDate(f.expiresDate)}.`],
  ];
  const extraClause = f.additionalTerms.trim() ? [["Additional Terms", f.additionalTerms.trim()]] : [];
  const allClauses = [...clauses, ...extraClause];

  const fileBase = `Letter_of_Intent_${(f.propertyAddress || "Property").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60)}`;

  const renderPdf = async () => {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
    const canvas = await html2canvas(letterRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const pdf = new jsPDF("p", "pt", "letter");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;
    const img = canvas.toDataURL("image/jpeg", 0.95);
    let y = 0, page = 0;
    while (y < imgH - 1) {
      if (page > 0) pdf.addPage();
      pdf.addImage(img, "JPEG", 0, -y, pageW, imgH);
      y += pageH; page += 1;
    }
    return pdf;
  };

  const handleDownload = async () => {
    setError(null); setBusy(true);
    try { const pdf = await renderPdf(); pdf.save(fileBase + ".pdf"); }
    catch (e) { setError(e.message || "Could not generate PDF"); }
    finally { setBusy(false); }
  };

  const handleSave = async () => {
    if (!f.purchasePrice) { setError("Enter a purchase price first."); return; }
    setError(null); setBusy(true);
    try {
      const pdf = await renderPdf();
      const blob = pdf.output("blob");
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Could not read PDF"));
        reader.readAsDataURL(blob);
      });
      const res = await fetch(`${API}/documents/upload`, {
        method: "POST", headers,
        body: JSON.stringify({ transactionId: tx.id, fileName: fileBase + ".pdf", fileType: "application/pdf",
          category: "Contract", documentType: "Letter_of_Intent", base64 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || ("Save failed (" + res.status + ")"));
      onSaved();
    } catch (e) { setError(e.message || "Could not save to documents"); setBusy(false); }
  };

  const field = (label, key, opts) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</label>
      {opts?.type === "textarea"
        ? <textarea value={f[key]} onChange={e => set(key)(e.target.value)} rows={3} placeholder={opts.placeholder} style={inp} />
        : opts?.options
          ? <select value={f[key]} onChange={e => set(key)(e.target.value)} style={inp}>{opts.options.map(o => <option key={o}>{o}</option>)}</select>
          : <input type={opts?.type || "text"} value={f[key]} onChange={e => set(key)(e.target.value)} placeholder={opts?.placeholder} style={inp} />}
    </div>
  );
  const inp = { width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: "inherit", color: COLORS.text, background: "#fff", boxSizing: "border-box" };

  return (
    <div onClick={() => !busy && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: 920, maxWidth: "100%", maxHeight: "94vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px 14px", borderBottom: `1px solid ${COLORS.border}`, position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: "#0E7490", fontWeight: 800 }}>📝 Letter of Intent</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: COLORS.muted }}>×</button>
        </div>
        <div style={{ display: "flex", gap: 20, padding: 22, flexWrap: "wrap", alignItems: "flex-start" }}>
          {/* Form */}
          <div style={{ flex: "1 1 300px", minWidth: 280 }}>
            <div style={{ fontSize: 12.5, color: COLORS.muted, marginBottom: 12, lineHeight: 1.45 }}>
              Confirm the numbers below — the legal clauses are pre-written. The letter is <b>non-binding</b> (except confidentiality and the no-shop period).
            </div>
            {field("LOI Date", "loiDate", { type: "date" })}
            {field("Buyer (name / entity)", "buyerName", { placeholder: "ABC Holdings, LLC" })}
            {field("Seller (name / entity)", "sellerName", { placeholder: "Seller name" })}
            {field("Property Address", "propertyAddress")}
            {field("Property Description (optional)", "propertyDesc", { placeholder: "e.g. ±12,500 SF retail building on 0.8 acres, Parcel 30-22-…" })}
            {field("Purchase Price", "purchasePrice", { placeholder: "1,250,000" })}
            {field("Earnest Money Deposit", "deposit", { placeholder: "25,000" })}
            {field("Financing", "financingType", { options: ["All cash", "Conventional / commercial financing", "SBA financing", "Seller financing", "Subject to existing financing"] })}
            {field("Due Diligence Period (days)", "dueDiligenceDays", { type: "number" })}
            {field("Closing (days after due diligence)", "closingDays", { type: "number" })}
            {field("Exclusivity / No-Shop (days)", "exclusivityDays", { type: "number" })}
            {field("This Offer Expires", "expiresDate", { type: "date" })}
            {field("Prepared By (agent / brokerage)", "preparedBy", { placeholder: "Your name, Brokerage" })}
            {field("Additional Terms (optional)", "additionalTerms", { type: "textarea", placeholder: "Any extra terms in plain language…" })}
          </div>
          {/* Live letter preview */}
          <div style={{ flex: "1 1 380px", minWidth: 320 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Preview</div>
            <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, maxHeight: "62vh", overflow: "auto", background: "#F3F4F6", padding: 12 }}>
              <div ref={letterRef} style={{ background: "#fff", width: 612, maxWidth: "100%", padding: "48px 54px", fontFamily: "Georgia, 'Times New Roman', serif", color: "#111", fontSize: 13, lineHeight: 1.55 }}>
                <div style={{ textAlign: "center", fontWeight: 700, fontSize: 16, letterSpacing: 0.5, marginBottom: 4 }}>LETTER OF INTENT</div>
                <div style={{ textAlign: "center", fontSize: 12, color: "#555", marginBottom: 22 }}>(Non-Binding — For Discussion Purposes Only)</div>
                <div style={{ marginBottom: 14 }}>{fmtDate(f.loiDate)}</div>
                <div style={{ marginBottom: 14 }}>
                  <div><b>To (Seller):</b> {f.sellerName || "____________"}</div>
                  <div><b>From (Buyer):</b> {f.buyerName || "____________"}</div>
                  <div><b>Re:</b> Proposed Purchase of {f.propertyAddress || "____________"}</div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  Dear {f.sellerName || "Seller"}:
                </div>
                <div style={{ marginBottom: 14 }}>
                  This Letter of Intent ("LOI") sets forth the principal terms under which {f.buyerName || "Buyer"} ("Buyer") proposes to purchase the above-referenced property from {f.sellerName || "Seller"} ("Seller"). The parties intend to negotiate a definitive purchase agreement consistent with the following:
                </div>
                {allClauses.map(([title, text], i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <b>{i + 1}. {title}.</b> {text}
                  </div>
                ))}
                <div style={{ marginTop: 16, marginBottom: 30 }}>
                  If these terms are acceptable as a basis for negotiation, please sign and return a copy. We look forward to working with you.
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 30, marginTop: 36 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ borderTop: "1px solid #111", paddingTop: 4, fontSize: 12 }}>Buyer: {f.buyerName || ""}</div>
                    <div style={{ fontSize: 12, marginTop: 18, borderTop: "1px solid #111", paddingTop: 4 }}>Date</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ borderTop: "1px solid #111", paddingTop: 4, fontSize: 12 }}>Seller: {f.sellerName || ""}</div>
                    <div style={{ fontSize: 12, marginTop: 18, borderTop: "1px solid #111", paddingTop: 4 }}>Date</div>
                  </div>
                </div>
                {f.preparedBy && <div style={{ marginTop: 26, fontSize: 11, color: "#666" }}>Prepared by {f.preparedBy}</div>}
              </div>
            </div>
          </div>
        </div>
        {/* Actions */}
        <div style={{ position: "sticky", bottom: 0, background: "#fff", borderTop: `1px solid ${COLORS.border}`, padding: "14px 22px", display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {error && <div style={{ color: COLORS.danger, fontSize: 13, marginRight: "auto" }}>{error}</div>}
          <button onClick={handleDownload} disabled={busy} style={{ background: "#fff", color: "#0E7490", border: "1px solid #0E7490", padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Working…" : "⬇ Download PDF"}
          </button>
          <button onClick={handleSave} disabled={busy} style={{ background: "#0E7490", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Saving…" : "Save to Documents"}
          </button>
        </div>
      </div>
    </div>
  );
}
