import React, { useState, useRef } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

const COLORS = {
  navy: "#1a2332", red: "#c8102e", green: "#1e8449",
  bg: "#f7f8fa", border: "#e3e6eb", text: "#1a2332", muted: "#6b7280"
};

export default function ContractUploadPublic({ token: urlToken }) {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  // Extract token from URL path /upload-contract/:token
  const token = urlToken || window.location.pathname.split("/upload-contract/")[1];

  const onFileSelected = (f) => {
    if (!f) return;
    const validTypes = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif"];
    if (!validTypes.includes(f.type)) { setError("Please upload a PDF or image (JPG, PNG, HEIC)."); return; }
    if (f.size > 30 * 1024 * 1024) { setError("File too large — max 30 MB."); return; }
    setError(""); setFile(f);
  };

  const handleUpload = async () => {
    if (!file || !token) return;
    setUploading(true); setError(""); setProgress(10);
    try {
      const r1 = await fetch(API + "/contracts/public-upload-url/" + token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileType: file.type })
      });
      const d1 = await r1.json();
      if (!d1.success) throw new Error(d1.error || "Invalid or expired link");
      setProgress(30);

      const r2 = await fetch(d1.uploadUrl, {
        method: "PUT", headers: { "Content-Type": file.type }, body: file
      });
      if (!r2.ok) throw new Error("Upload failed");
      setProgress(70);

      const r3 = await fetch(API + "/contracts/public-upload-complete/" + token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileSize: file.size })
      });
      const d3 = await r3.json();
      if (!d3.success) throw new Error(d3.error || "Failed to confirm upload");
      setProgress(100);
      setDone(true);
    } catch (e) {
      setError(e.message); setUploading(false);
    }
  };

  if (done) return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: COLORS.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 500, textAlign: "center", background: "white", borderRadius: 12, padding: 40, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <h2 style={{ margin: 0, color: COLORS.navy }}>Contract Uploaded!</h2>
        <p style={{ color: COLORS.muted, marginTop: 12, lineHeight: 1.6 }}>
          Your contract has been uploaded securely. Your agent will be notified and will review the extracted information shortly.
        </p>
        <p style={{ color: COLORS.muted, fontSize: 13 }}>You can close this window.</p>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: COLORS.bg, minHeight: "100vh", padding: 24 }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏠</div>
          <h1 style={{ margin: 0, color: COLORS.navy, fontSize: 24 }}>Upload Your Contract</h1>
          <p style={{ color: COLORS.muted, marginTop: 8, fontSize: 15 }}>
            Upload your executed contract and addenda. No login required.
          </p>
        </div>

        <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); onFileSelected(e.dataTransfer.files?.[0]); }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? COLORS.red : COLORS.border}`,
              background: dragging ? "#fef2f2" : "#f9fafb",
              borderRadius: 10, padding: 40, textAlign: "center", cursor: "pointer"
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 10 }}>📥</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>
              {file ? file.name : "Drop your contract here, or click to browse"}
            </div>
            <div style={{ fontSize: 13, color: COLORS.muted }}>
              {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "PDF, JPG, PNG, or HEIC · Max 30 MB"}
            </div>
            <input ref={fileInputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/heic,image/heif" style={{ display: "none" }} onChange={(e) => onFileSelected(e.target.files?.[0])} />
          </div>

          {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 8, padding: "10px 14px", marginTop: 16, fontSize: 14 }}>{error}</div>}

          {uploading && (
            <div style={{ marginTop: 20 }}>
              <div style={{ background: "#e5e7eb", height: 8, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ background: COLORS.red, height: "100%", width: progress + "%", transition: "width 0.3s" }} />
              </div>
              <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 8 }}>Uploading... {progress}%</div>
            </div>
          )}

          {file && !uploading && (
            <button onClick={handleUpload} style={{ marginTop: 20, width: "100%", background: COLORS.red, color: "white", border: "none", borderRadius: 8, padding: "14px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Upload Contract →
            </button>
          )}

          <div style={{ marginTop: 24, padding: 16, background: "#f9fafb", borderRadius: 8, fontSize: 12, color: COLORS.muted, lineHeight: 1.6 }}>
            🔒 Your document is uploaded securely and only accessible to your agent. TransactPro uses bank-level encryption.
          </div>
        </div>
      </div>
    </div>
  );
}
