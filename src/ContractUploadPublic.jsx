import React, { useState, useRef } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

const COLORS = {
  navy: "#1a2332", red: "#c8102e", green: "#1e8449",
  bg: "#f7f8fa", border: "#e3e6eb", text: "#1a2332", muted: "#6b7280"
};

export default function ContractUploadPublic({ token: urlToken }) {
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  // Extract token from URL path /upload-contract/:token
  const token = urlToken || window.location.pathname.split("/upload-contract/")[1];

  const onFilesSelected = (fList) => {
    if (!fList || fList.length === 0) return;
    const validTypes = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif"];
    const accepted = [];
    for (const f of Array.from(fList)) {
      if (!validTypes.includes(f.type)) { setError("Skipped " + f.name + " — only PDF or image (JPG, PNG, HEIC) allowed."); continue; }
      if (f.size > 30 * 1024 * 1024) { setError("Skipped " + f.name + " — too large (max 30 MB per file)."); continue; }
      accepted.push(f);
    }
    if (accepted.length > 0) { setError(""); setFiles(prev => [...prev, ...accepted]); }
  };

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  // Read a File as base64 (strip the data: URL prefix). We upload through our
  // server (base64 → server → R2) because a browser→R2 presigned PUT fails
  // CORS with "Failed to fetch".
  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read " + file.name));
    reader.readAsDataURL(file);
  });

  const handleUpload = async () => {
    if (!files || files.length === 0 || !token) return;
    setUploading(true); setError(""); setProgress(5);
    try {
      const primary = files[0];
      const extras = files.slice(1);

      // Step 1: upload primary file through the server
      const primaryB64 = await toBase64(primary);
      const r1 = await fetch(API + "/contracts/public-upload-url/" + token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: primary.name, fileType: primary.type, base64: primaryB64 })
      });
      const d1 = await r1.json();
      if (!d1.success) throw new Error(d1.error || "Invalid or expired link");
      setProgress(30);

      // Step 2: upload each additional file through the server
      for (let i = 0; i < extras.length; i++) {
        const ef = extras[i];
        const efB64 = await toBase64(ef);
        const ar = await fetch(API + "/contracts/public-upload-additional-url/" + token, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: ef.name, fileType: ef.type, fileSize: ef.size, base64: efB64 })
        });
        const ad = await ar.json();
        if (!ad.success) throw new Error(ad.error || "Upload failed for " + ef.name);
        setProgress(30 + Math.round(((i + 1) / extras.length) * 40));
      }
      setProgress(75);

      // Step 4: trigger extraction
      const r3 = await fetch(API + "/contracts/public-upload-complete/" + token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileSize: primary.size })
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
            onDrop={(e) => { e.preventDefault(); setDragging(false); onFilesSelected(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? COLORS.red : COLORS.border}`,
              background: dragging ? "#fef2f2" : "#f9fafb",
              borderRadius: 10, padding: 40, textAlign: "center", cursor: "pointer"
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 10 }}>📥</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>
              {files.length > 0 ? `${files.length} file${files.length > 1 ? "s" : ""} selected — click to add more` : "Drop contract + addenda here, or click to browse"}
            </div>
            <div style={{ fontSize: 13, color: COLORS.muted }}>
              {files.length > 0 ? "You can upload the contract, addenda, and disclosures — all together" : "PDF, JPG, PNG, or HEIC · Max 30 MB each · Select multiple files"}
            </div>
            <input ref={fileInputRef} type="file" multiple accept="application/pdf,image/jpeg,image/png,image/heic,image/heif" style={{ display: "none" }} onChange={(e) => onFilesSelected(e.target.files)} />
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

          {files.length > 0 && !uploading && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>
                Files to upload ({files.length}):
              </div>
              <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, marginBottom: 12 }}>
                {files.map((f, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: idx < files.length - 1 ? "1px solid #e5e7eb" : "none" }}>
                    <div style={{ fontSize: 13, color: COLORS.text }}>
                      📄 {f.name} <span style={{ color: COLORS.muted }}>({(f.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                      style={{ background: "transparent", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12 }}>
                💡 Add the contract and any addenda or disclosures together. Your agent will review them all at once.
              </div>
              <button onClick={handleUpload} style={{ width: "100%", background: COLORS.red, color: "white", border: "none", borderRadius: 8, padding: "14px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Upload Contract →
              </button>
            </div>
          )}

          <div style={{ marginTop: 24, padding: 16, background: "#f9fafb", borderRadius: 8, fontSize: 12, color: COLORS.muted, lineHeight: 1.6 }}>
            🔒 Your document is uploaded securely and only accessible to your agent. TransactPro uses bank-level encryption.
          </div>
        </div>
      </div>
    </div>
  );
}
