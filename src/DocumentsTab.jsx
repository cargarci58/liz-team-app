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

  const ChecklistRow = (item) => (
    <div key={item.documentType} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
      background: "#fff", border: "1px solid " + (item.present ? "#A7E0BE" : "#EEDD9E"),
      borderRadius: 8, marginBottom: 6 }}>
      <div style={{ fontSize: 16, flexShrink: 0 }}>{item.present ? "✅" : (item.required ? "⬜" : "▫️")}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: COLORS.text }}>
          {item.label}
          {!item.required && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#92400E", background: "#FEF3C7", padding: "1px 6px", borderRadius: 10 }}>OPTIONAL</span>}
          {item.custom && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#1A5276", background: "#D6EAF8", padding: "1px 6px", borderRadius: 10 }}>BROKER</span>}
        </div>
        <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 1 }}>
          {item.condition && item.condition !== "always" ? `Required because: ${item.condition.replace(/_/g, " ")} · ` : ""}
          {item.statute || ""}
        </div>
      </div>
      {item.present ? (
        <span style={{ fontSize: 11, fontWeight: 700, color: "#1E8449", flexShrink: 0 }}>On file</span>
      ) : (
        <label style={{ flexShrink: 0, padding: "5px 12px", background: "#C0392B", color: "#fff", borderRadius: 7,
          cursor: slotUploading ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 12, opacity: slotUploading === item.documentType ? 0.6 : 1 }}>
          {slotUploading === item.documentType ? "Uploading…" : "📎 Upload"}
          <input type="file" disabled={!!slotUploading} style={{ display: "none" }}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.txt"
            onChange={(e) => handleSlotUpload(item.documentType, item.label, e)} />
        </label>
      )}
    </div>
  );

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
                      <button onClick={() => handleDownload(doc)}
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
    </div>
  );
}
