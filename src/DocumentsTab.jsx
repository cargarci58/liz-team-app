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
  const tok = localStorage.getItem("tp_token") || "";
  const headers = { "Content-Type": "application/json", "Authorization": "Bearer " + tok };

  useEffect(() => {
    fetch(`${API}/documents/${tx.id}`, { headers })
      .then(r => r.json())
      .then(d => { if (d.documents) setDocs(d.documents); })
      .catch(e => console.error("Load docs failed:", e))
      .finally(() => setLoading(false));
  }, [tx.id]);

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

  return (
    <div style={{ padding: 24 }}>
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
          {docs.map(doc => (
            <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#fff", border: "1px solid #DDDDDD", borderRadius: 10, marginBottom: 8, flexWrap: "wrap" }}>
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
      )}
    </div>
  );
}
