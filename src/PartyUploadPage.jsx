import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

const COLORS = {
  white: "#fff", black: "#111", gray: "#555", border: "#DDD",
  red: "#C0392B", lightRed: "#FADBD8",
  warning: "#B7770D", warningBg: "#FFFBEB", warningBorder: "#FCD34D",
  success: "#1E8449", successBg: "#D1FAE5", successBorder: "#86EFAC",
  danger: "#991B1B", dangerBg: "#FEE2E2", dangerBorder: "#FCA5A5",
};

// Extract token from URL like /upload/abc123
function getTokenFromUrl() {
  const parts = window.location.pathname.split("/");
  const idx = parts.indexOf("upload");
  return idx >= 0 ? parts[idx + 1] : null;
}

export default function PartyUploadPage() {
  const token = getTokenFromUrl();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [file, setFile] = useState(null);

  useEffect(() => {
    if (!token) { setError("Invalid link"); setLoading(false); return; }
    fetch(API + "/party-uploads/info/" + token)
      .then(r => r.json())
      .then(d => {
        if (d.success) setInfo(d);
        else setError(d.error || "Could not load upload link");
        setLoading(false);
      })
      .catch(() => { setError("Could not load upload link"); setLoading(false); });
  }, [token]);

  const handleUpload = async () => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { alert("File too large (max 50MB)"); return; }
    setUploading(true);
    try {
      const urlRes = await fetch(API + "/party-uploads/upload-url/" + token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileType: file.type || "application/octet-stream", fileSize: file.size })
      });
      const urlData = await urlRes.json();
      if (!urlData.success) throw new Error(urlData.error || "Could not get upload URL");

      const putRes = await fetch(urlData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file
      });
      if (!putRes.ok) throw new Error("Upload to storage failed");

      const confirmRes = await fetch(API + "/party-uploads/confirm/" + token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, mimeType: file.type, storageKey: urlData.key })
      });
      const confirmData = await confirmRes.json();
      if (!confirmData.success) throw new Error(confirmData.error || "Confirm failed");

      setCompleted(true);
    } catch (err) {
      alert("Upload failed: " + err.message);
    }
    setUploading(false);
  };

  const Card = ({ children }) => (
    <div style={{ background: COLORS.white, borderRadius: 14, padding: 24, maxWidth: 480, margin: "40px auto",
      boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>{children}</div>
  );

  if (loading) {
    return <Card><div style={{ textAlign: "center", color: COLORS.gray }}>Loading...</div></Card>;
  }

  if (error) {
    return (
      <Card>
        <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.danger, marginBottom: 10 }}>Link unavailable</div>
        <div style={{ color: COLORS.gray, lineHeight: 1.5 }}>{error}</div>
        <div style={{ color: COLORS.gray, fontSize: 12, marginTop: 16, lineHeight: 1.5 }}>
          This upload link may have expired or already been used. Please contact the agent who sent it for a new link.
        </div>
      </Card>
    );
  }

  if (completed) {
    return (
      <Card>
        <div style={{ fontSize: 48, textAlign: "center", marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.success, textAlign: "center", marginBottom: 10 }}>
          Document received!
        </div>
        <div style={{ color: COLORS.gray, lineHeight: 1.5, textAlign: "center", marginBottom: 16 }}>
          Thank you, {info.partyName}. {info.agentName} has been notified and the milestone is now marked complete.
        </div>
        <div style={{ background: "#F3F4F6", borderRadius: 8, padding: 12, fontSize: 13, color: COLORS.gray }}>
          <div><strong>Property:</strong> {info.address}</div>
          <div><strong>Document for:</strong> {info.milestoneName}</div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.gray, letterSpacing: 0.5, marginBottom: 4 }}>
          DOCUMENT UPLOAD REQUEST
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.black, marginBottom: 4 }}>
          Hi {info.partyName ? info.partyName.split(" ")[0] : "there"}
        </div>
        <div style={{ color: COLORS.gray, fontSize: 14, lineHeight: 1.5 }}>
          {info.agentName} needs a document from you for:
        </div>
      </div>

      <div style={{ background: "#F3F4F6", borderRadius: 8, padding: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: COLORS.gray, marginBottom: 2 }}>Property</div>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{info.address}</div>
        <div style={{ fontSize: 13, color: COLORS.gray, marginBottom: 2 }}>Required for</div>
        <div style={{ fontWeight: 700 }}>{info.milestoneName}</div>
      </div>

      {info.requiredDocType && (
        <div style={{ background: COLORS.warningBg, border: "1px solid " + COLORS.warningBorder, borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, color: "#92400E", marginBottom: 4 }}>
            📎 Document needed: {info.requiredDocType}
          </div>
          {info.description && (
            <div style={{ color: "#78350F", fontSize: 12, lineHeight: 1.5 }}>{info.description}</div>
          )}
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.gray, letterSpacing: 0.5, marginBottom: 6 }}>
          SELECT FILE
        </div>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic"
          onChange={e => setFile(e.target.files?.[0] || null)}
          style={{ width: "100%", padding: 10, border: "1.5px dashed " + COLORS.border, borderRadius: 8, fontSize: 13 }}
        />
        {file && (
          <div style={{ fontSize: 12, color: COLORS.gray, marginTop: 6 }}>
            Selected: <strong>{file.name}</strong> ({Math.round(file.size / 1024)} KB)
          </div>
        )}
      </div>

      <button onClick={handleUpload} disabled={!file || uploading}
        style={{ width: "100%", padding: 14, borderRadius: 10, border: "none",
          background: !file ? "#D1D5DB" : COLORS.red, color: COLORS.white,
          fontWeight: 700, fontSize: 15, cursor: !file || uploading ? "not-allowed" : "pointer" }}>
        {uploading ? "Uploading..." : "Upload Document"}
      </button>

      <div style={{ fontSize: 11, color: COLORS.gray, textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
        Your document will be securely uploaded and the agent notified immediately.
        Files are stored privately and only visible to authorized parties in the transaction.
      </div>
    </Card>
  );
}
