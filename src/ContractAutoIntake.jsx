import React, { useState, useEffect, useRef } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

const COLORS = {
  navy: "#1a2332",
  red: "#c8102e",
  green: "#1e8449",
  amber: "#d97706",
  bg: "#f7f8fa",
  border: "#e3e6eb",
  text: "#1a2332",
  muted: "#6b7280"
};

const DOC_TYPE_LABELS = {
  FAR_BAR_Contract: "FAR/BAR Residential Contract",
  AS_IS_Contract: "AS-IS Residential Contract",
  Vacant_Land_Contract: "Vacant Land Contract",
  Commercial_Contract: "Commercial Contract",
  Lease_Contract: "Lease Contract",
  Lead_Paint_Disclosure: "Lead Paint Disclosure",
  HOA_Addendum: "HOA Addendum",
  Inspection_Addendum: "Inspection Addendum",
  Financing_Addendum: "Financing Addendum",
  Appraisal_Addendum: "Appraisal Addendum",
  Wire_Fraud_Disclosure: "Wire Fraud Disclosure",
  Sellers_Property_Disclosure: "Seller's Property Disclosure",
  Condo_Rider: "Condo Rider",
  Other: "Other Document"
};

// ───────────────────────────────────────────────────────────────
// UPLOAD SCREEN — entry point
// ───────────────────────────────────────────────────────────────
export default function ContractAutoIntake({ token, user, existingTransactionId, reviewUploadId, currentStatus, onBack, onApproved }) {
  const [stage, setStage] = useState(reviewUploadId ? "review" : "upload");
  const [uploadId, setUploadId] = useState(reviewUploadId || null);

  if (stage === "upload") {
    return <UploadStep token={token} existingTransactionId={existingTransactionId} onBack={onBack} onUploaded={(id) => { setUploadId(id); setStage("processing"); }} />;
  }
  if (stage === "processing") {
    return <ProcessingStep token={token} uploadId={uploadId} onReady={() => setStage("review")} onFailed={(err) => setStage("failed")} />;
  }
  if (stage === "review") {
    return <ReviewStep token={token} uploadId={uploadId} user={user} currentStatus={currentStatus} onApproved={onApproved} onBack={onBack} />;
  }
  if (stage === "failed") {
    return <FailedStep onBack={onBack} onRetry={() => setStage("upload")} />;
  }
  return null;
}

// ───────────────────────────────────────────────────────────────
// STEP 1: UPLOAD
// ───────────────────────────────────────────────────────────────
function UploadStep({ token, existingTransactionId, onBack, onUploaded }) {
  // On a listing this is a buyer's OFFER coming in (seller hasn't signed yet);
  // standalone it's importing a fully-signed contract for a deal not in the app.
  const isOffer = !!existingTransactionId;
  const [mode, setMode] = useState("self"); // "self" or "link"
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const [linkExpiry, setLinkExpiry] = useState(72);
  const [generatedLink, setGeneratedLink] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  // "Pick an existing document" — an offer signed in-app is already on the deal.
  const [dealDocs, setDealDocs] = useState([]);
  const [pickingId, setPickingId] = useState(null); // the ONE doc being read
  useEffect(() => {
    if (!existingTransactionId) return;
    fetch(API + "/documents/" + existingTransactionId, { headers: { Authorization: "Bearer " + token } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setDealDocs((d?.documents || []).filter(x => /pdf$/i.test(x.mime_type || ""))))
      .catch(() => setDealDocs([]));
  }, [existingTransactionId, token]);
  const useExistingDoc = async (docId) => {
    if (pickingId) return; // one at a time
    setPickingId(docId); setError("");
    try {
      const r = await fetch(API + "/contracts/from-document/" + docId, {
        method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Couldn't read that document");
      onUploaded(d.uploadId);
    } catch (e) { setError(e.message); setPickingId(null); }
  };

  const generateShareableLink = async () => {
    setGeneratingLink(true);
    setError("");
    try {
      const r = await fetch(API + "/contracts/shareable-link", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ existingTransactionId, expiresInHours: linkExpiry })
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || "Failed to generate link");
      setGeneratedLink(d.url);
    } catch (e) {
      setError(e.message);
    }
    setGeneratingLink(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const onFilesSelected = (fList) => {
    if (!fList || fList.length === 0) return;
    const validTypes = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif"];
    const accepted = [];
    for (const f of Array.from(fList)) {
      if (!validTypes.includes(f.type)) {
        setError("Skipped " + f.name + " — only PDF or image (JPG, PNG, HEIC) allowed.");
        continue;
      }
      if (f.size > 30 * 1024 * 1024) {
        setError("Skipped " + f.name + " — too large (max 30 MB per file).");
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length > 0) {
      setError("");
      setFiles(prev => [...prev, ...accepted]);
    }
  };

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    onFilesSelected(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");
    setProgress(5);
    try {
      const primary = files[0];
      const extras = files.slice(1);

      // Read a File as base64 (strip the data: URL prefix). We upload through
      // our server (base64 → server → R2); a browser→R2 presigned PUT fails
      // CORS with "Failed to fetch".
      const toBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Could not read " + file.name));
        reader.readAsDataURL(file);
      });

      // Step 1: upload primary file through the server
      const primaryB64 = await toBase64(primary);
      const r1 = await fetch(API + "/contracts/upload-url", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: primary.name, fileType: primary.type, existingTransactionId, base64: primaryB64 })
      });
      const d1 = await r1.json();
      if (!d1.success) throw new Error(d1.error || "Failed to upload " + primary.name);
      const uploadId = d1.uploadId;
      setProgress(30);

      // Step 2: upload each additional file through the server
      for (let i = 0; i < extras.length; i++) {
        const ef = extras[i];
        const efB64 = await toBase64(ef);
        const ar = await fetch(API + "/contracts/upload-additional-url/" + uploadId, {
          method: "POST",
          headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: ef.name, fileType: ef.type, fileSize: ef.size, base64: efB64 })
        });
        const ad = await ar.json();
        if (!ad.success) throw new Error(ad.error || "Upload failed for " + ef.name);
        setProgress(30 + Math.round(((i + 1) / extras.length) * 40));
      }
      setProgress(75);

      // Step 4: trigger extraction (uses primary's size; backend reads additional_files for the rest)
      const r3 = await fetch(API + "/contracts/upload-complete/" + uploadId, {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ fileSize: primary.size })
      });
      const d3 = await r3.json();
      if (!d3.success) throw new Error(d3.error || "Failed to start extraction");
      setProgress(100);

      onUploaded(uploadId);
    } catch (e) {
      setError(e.message);
      setUploading(false);
    }
  };

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: COLORS.bg, minHeight: "100vh", padding: "24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 14, cursor: "pointer", marginBottom: 16 }}>← Back</button>
        <h1 style={{ margin: 0, color: COLORS.navy, fontSize: 26 }}>{isOffer ? "📥 Upload Offer" : "📄 Import a Signed Contract"}</h1>
        <p style={{ color: COLORS.muted, marginTop: 6, marginBottom: 8 }}>
          {isOffer
            ? "Drop the buyer's offer below (signed by the buyer — your seller hasn't signed yet, and nothing here accepts it). We'll read it, identify every document and addendum, and pull out the price, buyer, dates, and terms automatically."
            : "Drop the fully-signed contract package below. We'll read it, identify every document and addendum, and pull out all the key fields automatically."}
        </p>
        <p style={{ color: COLORS.muted, marginTop: 0, marginBottom: 24, fontSize: 13 }}>
          Two ways: <strong>upload it yourself</strong>, or <strong>send {isOffer ? "the other agent" : "your client"} a no-login link</strong> so they can upload it for you.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {isOffer && (
            <button
              onClick={() => setMode("existing")}
              style={{ flex: "1 1 30%", padding: "12px", borderRadius: 8, border: `2px solid ${mode === "existing" ? COLORS.red : COLORS.border}`, background: mode === "existing" ? "#fef2f2" : "white", color: mode === "existing" ? COLORS.red : COLORS.text, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
            >
              📁 Already on this deal
            </button>
          )}
          <button
            onClick={() => setMode("self")}
            style={{ flex: "1 1 30%", padding: "12px", borderRadius: 8, border: `2px solid ${mode === "self" ? COLORS.red : COLORS.border}`, background: mode === "self" ? "#fef2f2" : "white", color: mode === "self" ? COLORS.red : COLORS.text, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
          >
            📤 Upload Myself
          </button>
          <button
            onClick={() => setMode("link")}
            style={{ flex: "1 1 30%", padding: "12px", borderRadius: 8, border: `2px solid ${mode === "link" ? COLORS.red : COLORS.border}`, background: mode === "link" ? "#fef2f2" : "white", color: mode === "link" ? COLORS.red : COLORS.text, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
          >
            🔗 Send a Link (no login)
          </button>
        </div>

        {mode === "existing" && (
          <div style={{ background: "white", border: "1px solid " + COLORS.border, borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 6px 0", color: COLORS.navy, fontSize: 16 }}>Pick the offer/contract already on this deal</h3>
            <p style={{ color: COLORS.muted, fontSize: 13, marginTop: 0, marginBottom: 14 }}>
              Signed the offer in-app? It's already here. Pick it and the AI reads it — no re-uploading.
            </p>
            {dealDocs.length === 0 ? (
              <div style={{ fontSize: 13, color: COLORS.muted, padding: "8px 0" }}>No PDF documents on this deal yet — use <strong>Upload Myself</strong> instead.</div>
            ) : (
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                {dealDocs.map(d => {
                  const isThis = pickingId === d.id;
                  const dimmed = pickingId && !isThis;
                  return (
                  <button key={d.id} disabled={!!pickingId} onClick={() => useExistingDoc(d.id)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", textAlign: "left", padding: "11px 12px", marginBottom: 6, borderRadius: 8, border: "1px solid " + (isThis ? COLORS.red : COLORS.border), background: isThis ? "#fef2f2" : "#fff", cursor: pickingId ? "default" : "pointer", fontFamily: "inherit", opacity: dimmed ? 0.5 : 1 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📄 {d.name}</span>
                    <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: COLORS.red }}>{isThis ? "Reading…" : "Read this →"}</span>
                  </button>
                  );
                })}
              </div>
            )}
            {error && <div style={{ marginTop: 10, background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8, padding: 10, fontSize: 13, color: "#7F1D1D" }}>⚠️ {error}</div>}
          </div>
        )}

        {mode === "link" && (
          <div style={{ background: "white", border: "1px solid " + COLORS.border, borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 8px 0", color: COLORS.navy, fontSize: 16 }}>Generate Upload Link</h3>
            <p style={{ color: COLORS.muted, fontSize: 13, marginTop: 0, marginBottom: 16 }}>
              Anyone with this link can upload the contract — no login required. The AI will process it and notify you when it's ready to review.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 6, fontWeight: 600 }}>LINK EXPIRES IN</label>
              <select
                value={linkExpiry}
                onChange={e => setLinkExpiry(parseInt(e.target.value))}
                style={{ padding: "8px 12px", border: "1px solid " + COLORS.border, borderRadius: 6, fontSize: 14, fontFamily: "inherit" }}
              >
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
                <option value={72}>72 hours (default)</option>
                <option value={168}>7 days</option>
              </select>
            </div>
            {!generatedLink ? (
              <button
                onClick={generateShareableLink}
                disabled={generatingLink}
                style={{ background: COLORS.red, color: "white", border: "none", borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: 600, cursor: generatingLink ? "wait" : "pointer", fontFamily: "inherit", opacity: generatingLink ? 0.7 : 1 }}
              >
                {generatingLink ? "Generating..." : "Generate Link"}
              </button>
            ) : (
              <div>
                <div style={{ background: "#f9fafb", border: "1px solid " + COLORS.border, borderRadius: 8, padding: 12, marginBottom: 12, wordBreak: "break-all", fontSize: 13, color: COLORS.text }}>
                  {generatedLink}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={copyLink}
                    style={{ background: linkCopied ? COLORS.green : COLORS.navy, color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    {linkCopied ? "✓ Copied!" : "📋 Copy Link"}
                  </button>
                  <button
                    onClick={() => { setGeneratedLink(""); setLinkCopied(false); }}
                    style={{ background: "white", color: COLORS.text, border: "1px solid " + COLORS.border, borderRadius: 8, padding: "10px 20px", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Generate New Link
                  </button>
                </div>
                <div style={{ marginTop: 12, fontSize: 12, color: COLORS.muted }}>
                  ✅ You'll get an email + SMS notification when the contract is uploaded and ready to review.
                </div>
              </div>
            )}
          </div>
        )}

        {mode === "self" && <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? COLORS.red : COLORS.border}`,
            background: dragging ? "#fef2f2" : "white",
            borderRadius: 12,
            padding: 48,
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.15s"
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>📥</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, marginBottom: 6 }}>
            {files.length > 0 ? `${files.length} file${files.length > 1 ? "s" : ""} selected — click to add more` : "Drop contract + addenda here, or click to browse"}
          </div>
          <div style={{ fontSize: 13, color: COLORS.muted }}>
            {files.length > 0 ? "You can add the contract, addenda, disclosures — all together" : "PDF, JPG, PNG, or HEIC · Max 30 MB each · Select multiple files"}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="application/pdf,image/jpeg,image/png,image/heic,image/heif"
            style={{ display: "none" }}
            onChange={(e) => onFilesSelected(e.target.files)}
          />
        </div>}

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 8, padding: "10px 14px", marginTop: 16, fontSize: 14 }}>
            {error}
          </div>
        )}

        {mode === "self" && uploading && (
          <div style={{ marginTop: 20 }}>
            <div style={{ background: "#e5e7eb", height: 8, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ background: COLORS.red, height: "100%", width: progress + "%", transition: "width 0.3s" }} />
            </div>
            <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 8 }}>Uploading... {progress}%</div>
          </div>
        )}

        {mode === "self" && files.length > 0 && !uploading && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>
              Files to upload ({files.length}):
            </div>
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, marginBottom: 16 }}>
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
              💡 Add the contract and any addenda or disclosures together. AI will read them as one package.
            </div>
            <button
              onClick={handleUpload}
              style={{ background: COLORS.red, color: "white", border: "none", borderRadius: 8, padding: "14px 28px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              Upload & Process with AI →
            </button>
          </div>
        )}

        <div style={{ marginTop: 32, padding: 20, background: "#f9fafb", borderRadius: 8, fontSize: 13, color: COLORS.muted, lineHeight: 1.6 }}>
          <strong style={{ color: COLORS.text }}>What happens next?</strong>
          <ol style={{ paddingLeft: 20, margin: "8px 0 0 0" }}>
            <li>Your contract is uploaded securely</li>
            <li>AI reads every page (takes 30-60 seconds)</li>
            <li>Each document and addendum is identified separately</li>
            <li>You review what was extracted, edit anything wrong, and approve</li>
            <li>On approval, the offer is accepted: the listing moves to Under Contract, parties are added, and the timeline + tasks are created</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// STEP 2: PROCESSING (polling)
// ───────────────────────────────────────────────────────────────
function ProcessingStep({ token, uploadId, onReady, onFailed }) {
  const [error, setError] = useState("");
  const [slow, setSlow] = useState(false); // true once it's taking unusually long
  // Hold callbacks in refs so the parent re-rendering (and creating new
  // function identities for onReady/onFailed) doesn't tear down and
  // restart the polling effect.
  const onReadyRef = useRef(onReady);
  const onFailedRef = useRef(onFailed);
  useEffect(() => { onReadyRef.current = onReady; onFailedRef.current = onFailed; }, [onReady, onFailed]);

  // If extraction stalls, don't spin forever — surface a way out after 75s.
  useEffect(() => {
    const slowTimer = setTimeout(() => setSlow(true), 75000);
    return () => clearTimeout(slowTimer);
  }, [uploadId]);

  useEffect(() => {
    let cancelled = false;
    let failedTimer = null;
    const poll = setInterval(async () => {
      if (cancelled) return;
      try {
        const r = await fetch(API + "/contracts/uploads/" + uploadId, {
          headers: { "Authorization": "Bearer " + token }
        });
        if (cancelled) return;
        const d = await r.json();
        if (cancelled) return;
        if (d.upload?.status === "ready_for_review") {
          clearInterval(poll);
          onReadyRef.current();
        } else if (d.upload?.status === "failed") {
          clearInterval(poll);
          setError(d.upload.extraction_error || "Extraction failed");
          failedTimer = setTimeout(() => { if (!cancelled) onFailedRef.current(d.upload.extraction_error); }, 2000);
        }
      } catch (e) {
        console.error("[ContractAutoIntake poll]", e && e.message ? e.message : e);
      }
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(poll);
      if (failedTimer) clearTimeout(failedTimer);
    };
  }, [uploadId, token]);

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: COLORS.bg, minHeight: "100vh", padding: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: 500, textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>🤖</div>
        <h2 style={{ margin: 0, color: COLORS.navy, fontSize: 22 }}>Reading your contract...</h2>
        <p style={{ color: COLORS.muted, marginTop: 12, fontSize: 15, lineHeight: 1.6 }}>
          AI is identifying every document and extracting all the key fields. This usually takes 30-60 seconds.
        </p>
        <div style={{ marginTop: 32 }}>
          <div style={{ display: "inline-block", width: 40, height: 40, border: `4px solid ${COLORS.border}`, borderTop: `4px solid ${COLORS.red}`, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        </div>
        {error && <div style={{ color: COLORS.red, marginTop: 20, fontSize: 14 }}>{error}</div>}
        {slow && !error && (
          <div style={{ marginTop: 24, fontSize: 14, color: COLORS.muted, lineHeight: 1.6 }}>
            This is taking longer than usual. It may still finish in a moment — or something may have stalled.
            <div style={{ marginTop: 14 }}>
              <button onClick={() => onFailedRef.current("Extraction is taking too long")}
                style={{ background: COLORS.red, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                Go back &amp; try again
              </button>
            </div>
          </div>
        )}
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// STEP 3: REVIEW & APPROVE
// ───────────────────────────────────────────────────────────────
function ReviewStep({ token, uploadId, user, currentStatus, onApproved, onBack }) {
  const [data, setData] = useState(null);
  const [edited, setEdited] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [vendors, setVendors] = useState([]);
  // The actual uploaded PDFs (contract + attachments) — reviewable BEFORE
  // accepting; the AI summary alone is not enough (Carlos 7/23).
  const [offerFiles, setOfferFiles] = useState([]);
  useEffect(() => {
    fetch(API + "/contracts/uploads/" + uploadId + "/files", { headers: { "Authorization": "Bearer " + token } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setOfferFiles(d && d.success ? (d.files || []) : []))
      .catch(() => setOfferFiles([]));
  }, [uploadId, token]);

  // Load the agent's saved Preferred Vendors so the closing-agent prompt can
  // offer one-tap picks (the title company / attorney they use all the time)
  // instead of re-typing it on every deal.
  useEffect(() => {
    fetch(API + "/vendors", { headers: { "Authorization": "Bearer " + token } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setVendors(d && d.success ? (d.vendors || []) : []))
      .catch(() => setVendors([]));
  }, [token]);

  useEffect(() => {
    fetch(API + "/contracts/uploads/" + uploadId, {
      headers: { "Authorization": "Bearer " + token }
    })
      .then(r => r.json())
      .then(d => {
        if (d.upload?.extracted_data) {
          setData(d.upload);
          const ed = d.upload.extracted_data;
          // In Florida a contract is "executed" when fully signed AND delivered —
          // which is the moment you accept it. Offers come in unsigned, so default
          // the executed date to TODAY (Florida time) when it's blank OR in the
          // past (you can't have executed it before you're accepting it now). The
          // agent can still change it before approving.
          if (ed.transaction) {
            const flToday = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
            const cur = ed.transaction.executed_date;
            if (!cur || cur < flToday) ed.transaction.executed_date = flToday;
          }
          setEdited(ed);
        } else {
          setError("No extracted data found");
        }
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [uploadId, token]);

  const updateTx = (field, value) => {
    setEdited({ ...edited, transaction: { ...edited.transaction, [field]: value } });
  };

  const updateParty = (idx, field, value) => {
    const newParties = [...edited.parties];
    newParties[idx] = { ...newParties[idx], [field]: value };
    setEdited({ ...edited, parties: newParties });
  };

  const removeParty = (idx) => {
    setEdited({ ...edited, parties: edited.parties.filter((_, i) => i !== idx) });
  };

  const addParty = () => {
    setEdited({ ...edited, parties: [...edited.parties, { role: "Other", name: "", email: "", phone: "", company: "" }] });
  };
  // Add a party with its role pre-set (used by the "add your closing agent"
  // quick-add buttons), so the agent just fills in the name/email right here.
  const addPartyRole = (role) => {
    setEdited({ ...edited, parties: [...edited.parties, { role, name: "", email: "", phone: "", company: "" }] });
  };
  // Add a party PRE-FILLED from a saved Preferred Vendor (the title company /
  // attorney the agent uses every deal). Maps the vendor's category to a party
  // role so the timeline/emails treat it correctly.
  const addPartyFromVendor = (vendor) => {
    const role = /attorney/i.test(vendor.category || vendor.role || "") ? "Attorney" : "Title Company";
    setEdited({ ...edited, parties: [...edited.parties, {
      role,
      name: vendor.name || vendor.company || "",
      company: vendor.company || "",
      email: vendor.email || "",
      phone: vendor.phone || "",
    }] });
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setError("");
    try {
      const r = await fetch(API + "/contracts/uploads/" + uploadId + "/save", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ extracted_data: edited })
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || "Save failed");
      onBack();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    // Guard against accidentally overwriting an already-accepted offer. The
    // listing is only Active/Coming Soon before any offer is accepted; once it's
    // Under Contract (or further), approving THIS offer replaces the current
    // accepted terms — make the agent confirm that's intended.
    const alreadyUnderContract = currentStatus && !["Active", "Coming Soon", "New"].includes(currentStatus);
    if (alreadyUnderContract) {
      const ok = window.confirm(
        `This listing is already "${currentStatus}" — an offer was already accepted.\n\n` +
        `Approving THIS offer will replace the accepted offer's price, dates, commission and parties with this one's, and re-run the timeline.\n\n` +
        `Only do this if you're intentionally switching to this offer. Continue?`
      );
      if (!ok) return;
    }
    setSaving(true);
    setError("");
    try {
      let r = await fetch(API + "/contracts/uploads/" + uploadId + "/approve", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ approved_data: edited })
      });
      let d = await r.json();
      // Backend guard: the seller declined this offer on their review link.
      // Confirm the agent really means to override, then retry.
      if (r.status === 409 && d.error === "seller_declined") {
        const ok = window.confirm((d.message || "The seller declined this offer.") + "\n\nApprove it anyway?");
        if (!ok) { setSaving(false); return; }
        r = await fetch(API + "/contracts/uploads/" + uploadId + "/approve", {
          method: "POST",
          headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
          body: JSON.stringify({ approved_data: edited, override: true })
        });
        d = await r.json();
      }
      if (!d.success) throw new Error(d.error || "Approval failed");
      onApproved(d.transaction_id);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: COLORS.muted }}>Loading...</div>;
  if (error && !edited) return <div style={{ padding: 40, textAlign: "center", color: COLORS.red }}>{error}</div>;
  if (!edited) return null;

  const tx = edited.transaction || {};
  const parties = edited.parties || [];
  const docs = edited.detected_documents || [];

  const inputStyle = { padding: "8px 10px", border: "1px solid " + COLORS.border, borderRadius: 6, fontSize: 14, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
  const labelStyle = { fontSize: 11, color: COLORS.muted, display: "block", marginBottom: 4, fontWeight: 600, letterSpacing: 0.5 };
  const sectionStyle = { background: "white", border: "1px solid " + COLORS.border, borderRadius: 10, padding: 20, marginBottom: 16 };

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: COLORS.bg, minHeight: "100vh", padding: "24px" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 14, cursor: "pointer", marginBottom: 16 }}>← Back</button>
        <h1 style={{ margin: 0, color: COLORS.navy, fontSize: 26 }}>📋 Review Extracted Contract Data</h1>
        <p style={{ color: COLORS.muted, marginTop: 6, marginBottom: 20 }}>
          Verify everything below is correct. Edit any field that's wrong. Click <strong>Approve Offer</strong> when ready — this accepts the offer, moves the listing to Under Contract, adds the parties, and sets up the timeline and tasks.
        </p>

        {offerFiles.length > 0 && (
          <div style={{ background: "#eff6ff", border: "1.5px solid #93c5fd", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#1e3a8a", marginBottom: 8 }}>📄 Read the actual documents first</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {offerFiles.map((f, i) => (
                <button key={i} onClick={() => window.open(f.url, "_blank")}
                  style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #93c5fd", background: "#fff", color: "#1d4ed8", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  👁 {f.name}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: "#3730a3", marginTop: 6 }}>Each opens in a new tab. The summary below is only what the AI read — the documents are the source of truth.</div>
          </div>
        )}

        <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#78350f" }}>
          ⚠️ <strong>Agent responsibility:</strong> As the agent, you are legally responsible for verifying all extracted data is accurate before approval.
        </div>

        {edited.extraction_notes && (
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#1e3a8a" }}>
            🤖 <strong>AI Notes:</strong> {edited.extraction_notes}
          </div>
        )}

        {/* ADDITIONAL TERMS — surfaced prominently because custom clauses are often missed */}
        <div style={{ background: edited.transaction?.additional_terms ? "#fef9c3" : "#f9fafb", border: edited.transaction?.additional_terms ? "2px solid #facc15" : "1px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>📝</span>
            <div style={{ fontWeight: 800, color: edited.transaction?.additional_terms ? "#854d0e" : "#374151", fontSize: 15 }}>
              {edited.transaction?.additional_terms ? "ADDITIONAL TERMS / SPECIAL CLAUSES DETECTED" : "Additional Terms / Special Clauses"}
            </div>
          </div>
          {edited.transaction?.additional_terms ? (
            <>
              <div style={{ fontSize: 12, color: "#713f12", marginBottom: 10, lineHeight: 1.5 }}>
                <strong>⚠️ Important:</strong> These are CUSTOM clauses negotiated between parties (not standard form terms). They override standard contract terms. <strong>Read every line carefully</strong> — missing one can cost the buyer/seller money or break the deal. Edit below if the AI misread anything.
              </div>
              <textarea
                value={edited.transaction?.additional_terms || ""}
                onChange={(e) => setEdited(prev => ({ ...prev, transaction: { ...prev.transaction, additional_terms: e.target.value } }))}
                style={{ width: "100%", minHeight: 120, padding: 10, borderRadius: 6, border: "1.5px solid #facc15", fontSize: 13, fontFamily: "monospace", lineHeight: 1.5, boxSizing: "border-box", background: "white" }}
              />
              <div style={{ fontSize: 11, color: "#854d0e", marginTop: 6 }}>
                ℹ️ On approval, this text will also be saved to the transaction Notes so you can find it later.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8, lineHeight: 1.5 }}>
                No custom clauses detected. If the contract has an "Additional Terms" or "Special Clauses" section that the AI missed, paste it here.
              </div>
              <textarea
                value={edited.transaction?.additional_terms || ""}
                onChange={(e) => setEdited(prev => ({ ...prev, transaction: { ...prev.transaction, additional_terms: e.target.value } }))}
                placeholder="e.g. Seller to credit buyer $5,000 at closing. Refrigerator stays. Closing contingent on buyer's sale of 123 Main St..."
                style={{ width: "100%", minHeight: 80, padding: 10, borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, fontFamily: "monospace", lineHeight: 1.5, boxSizing: "border-box", background: "white" }}
              />
            </>
          )}
        </div>

        <div style={sectionStyle}>
          <h3 style={{ marginTop: 0, color: COLORS.navy, fontSize: 16 }}>📄 Documents Detected ({docs.length})</h3>
          {docs.map((d, i) => (
            <div key={i} style={{ padding: 10, background: "#f9fafb", borderRadius: 6, marginBottom: 6, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
              <span><strong>{DOC_TYPE_LABELS[d.document_type] || d.document_type}</strong> · pages {d.page_start}-{d.page_end}</span>
              <span style={{ color: d.confidence === "high" ? COLORS.green : (d.confidence === "medium" ? COLORS.amber : COLORS.red), fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>{d.confidence}</span>
            </div>
          ))}
        </div>

        <div style={sectionStyle}>
          <h3 style={{ marginTop: 0, color: COLORS.navy, fontSize: 16 }}>🏠 Property & Contract</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>PROPERTY ADDRESS</label>
              <input style={inputStyle} value={tx.property_address || ""} onChange={e => updateTx("property_address", e.target.value)} />
            </div>
            <div><label style={labelStyle}>CITY</label><input style={inputStyle} value={tx.property_city || ""} onChange={e => updateTx("property_city", e.target.value)} /></div>
            <div><label style={labelStyle}>STATE</label><input style={inputStyle} value={tx.property_state || ""} onChange={e => updateTx("property_state", e.target.value)} /></div>
            <div><label style={labelStyle}>ZIP</label><input style={inputStyle} value={tx.property_zip || ""} onChange={e => updateTx("property_zip", e.target.value)} /></div>
            <div><label style={labelStyle}>COUNTY</label><input style={inputStyle} value={tx.property_county || ""} onChange={e => updateTx("property_county", e.target.value)} /></div>
            <div><label style={labelStyle}>MLS #</label><input style={inputStyle} value={tx.mls_number || ""} onChange={e => updateTx("mls_number", e.target.value)} /></div>
            <div>
              <label style={labelStyle}>PROPERTY TYPE</label>
              <select style={inputStyle} value={tx.property_type || ""} onChange={e => updateTx("property_type", e.target.value)}>
                <option value="">—</option>
                <option>Single Family</option><option>Condo</option><option>Townhouse</option>
                <option>Vacant Land</option><option>Commercial</option><option>Multi-Family</option><option>Lease</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>CONTRACT FORM</label>
              <select style={inputStyle} value={tx.contract_form_type || ""} onChange={e => updateTx("contract_form_type", e.target.value)}>
                <option value="">—</option>
                <option value="FAR_BAR">FAR/BAR</option>
                <option value="AS_IS">AS-IS</option>
                <option value="VACANT_LAND">Vacant Land</option>
                <option value="COMMERCIAL">Commercial</option>
                <option value="LEASE">Lease</option>
              </select>
            </div>
            <div><label style={labelStyle}>CONTRACT PRICE ($)</label><input type="number" style={inputStyle} value={tx.contract_price || ""} onChange={e => updateTx("contract_price", parseFloat(e.target.value) || 0)} /></div>
            <div><label style={labelStyle}>EARNEST MONEY ($)</label><input type="number" style={inputStyle} value={tx.earnest_money_amount || ""} onChange={e => updateTx("earnest_money_amount", parseFloat(e.target.value) || 0)} /></div>
            <div><label style={labelStyle}>EXECUTED DATE</label><input type="date" style={inputStyle} value={tx.executed_date || ""} onChange={e => updateTx("executed_date", e.target.value)} /></div>
            <div><label style={labelStyle}>CLOSING DATE</label><input type="date" style={inputStyle} value={tx.closing_date || ""} onChange={e => updateTx("closing_date", e.target.value)} /></div>
            <div><label style={labelStyle}>OFFER ACCEPTANCE DEADLINE</label><input type="date" style={inputStyle} value={tx.offer_acceptance_deadline || ""} onChange={e => updateTx("offer_acceptance_deadline", e.target.value)} /></div>
            <div><label style={labelStyle}>EMD DEADLINE (DAYS)</label><input type="number" style={inputStyle} value={tx.emd_deadline_days || ""} onChange={e => updateTx("emd_deadline_days", parseInt(e.target.value) || 0)} /></div>
            <div><label style={labelStyle}>INSPECTION PERIOD (DAYS)</label><input type="number" style={inputStyle} value={tx.inspection_period_days || ""} onChange={e => updateTx("inspection_period_days", parseInt(e.target.value) || 0)} /></div>
            <div><label style={labelStyle}>FINANCING CONTINGENCY (DAYS)</label><input type="number" style={inputStyle} value={tx.financing_contingency_days || ""} onChange={e => updateTx("financing_contingency_days", parseInt(e.target.value) || 0)} disabled={!tx.financing_contingency} /></div>
            <div><label style={labelStyle}>APPRAISAL CONTINGENCY (DAYS)</label><input type="number" style={inputStyle} value={tx.appraisal_contingency_days || ""} onChange={e => updateTx("appraisal_contingency_days", parseInt(e.target.value) || 0)} disabled={!tx.appraisal_contingency} /></div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ ...labelStyle, color: tx.buyer_agent_commission_pct ? COLORS.muted : COLORS.red }}>
                BUYER'S AGENT COMMISSION (%) {tx.buyer_agent_commission_pct ? "" : "— not found on the offer, please enter"}
              </label>
              <input
                type="number" step="0.01" placeholder="e.g. 2.5"
                style={{ ...inputStyle, maxWidth: 220, border: tx.buyer_agent_commission_pct ? inputStyle.border : "1.5px solid " + COLORS.red }}
                value={tx.buyer_agent_commission_pct ?? ""}
                onChange={e => updateTx("buyer_agent_commission_pct", e.target.value === "" ? null : parseFloat(e.target.value))}
              />
              <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>Buy-side only. The listing-side commission already on the transaction is not changed. Used for pipeline & commission reporting.</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 24, marginTop: 16, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}><input type="checkbox" checked={!!tx.is_cash} onChange={e => updateTx("is_cash", e.target.checked)} /> Cash deal</label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}><input type="checkbox" checked={!!tx.financing_contingency} onChange={e => updateTx("financing_contingency", e.target.checked)} /> Financing contingency</label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}><input type="checkbox" checked={!!tx.appraisal_contingency} onChange={e => updateTx("appraisal_contingency", e.target.checked)} /> Appraisal contingency</label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}><input type="checkbox" checked={!!tx.hoa_approval_required} onChange={e => updateTx("hoa_approval_required", e.target.checked)} /> HOA approval required</label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}><input type="checkbox" checked={!!tx.survey_required} onChange={e => updateTx("survey_required", e.target.checked)} /> Survey required</label>
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, color: COLORS.navy, fontSize: 16 }}>👥 Parties ({parties.length})</h3>
            <button onClick={addParty} style={{ background: "white", border: "1px solid " + COLORS.border, borderRadius: 6, padding: "6px 12px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>+ Add Party</button>
          </div>
          {/* The uploaded offer only carries buyer/seller/agents. In Florida the
              closing runs through a title company OR a real estate attorney, who
              gets the welcome email and coordinates closing — so prompt to add
              them RIGHT HERE before approving, with one tap. Banner disappears
              once a closing party is on the list. */}
          {!parties.some(p => /title|attorney|escrow|closing/i.test(p.role || "")) && (
            <div style={{ background: "#FEF9E7", border: "1px solid #FCD34D", borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#92400E", marginBottom: 4 }}>🏛️ Add your closing agent</div>
              <div style={{ fontSize: 12.5, color: "#78350f", marginBottom: 10, lineHeight: 1.5 }}>
                In Florida the closing is handled by a title company or a real estate attorney. Add them here so they're included in the transaction and receive the welcome email. (You can fill in their name and email below after adding.)
              </div>
              {/* One-tap picks from saved Preferred Vendors (title companies /
                  attorneys the agent uses on every deal) — pre-fills the row. */}
              {(() => {
                const saved = vendors.filter(v => /title|attorney|escrow/i.test(v.category || v.role || ""));
                if (saved.length === 0) return null;
                return (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#78350f", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Your saved vendors</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {saved.map(v => (
                        <button key={v.id} onClick={() => addPartyFromVendor(v)} title={[v.company || v.name, v.email, v.phone].filter(Boolean).join(" · ")} style={{ background: "#fff", border: "1px solid " + COLORS.navy, color: COLORS.navy, borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          {/attorney/i.test(v.category || v.role || "") ? "⚖️" : "📋"} {v.company || v.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => addPartyRole("Title Company")} style={{ background: COLORS.navy, border: "none", color: "#fff", borderRadius: 6, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Add New Title Company</button>
                <button onClick={() => addPartyRole("Attorney")} style={{ background: "white", border: "1px solid " + COLORS.navy, color: COLORS.navy, borderRadius: 6, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Add New Closing Attorney</button>
              </div>
            </div>
          )}
          {parties.map((p, i) => (
            <div key={i} style={{ background: "#f9fafb", borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
                <div>
                  <label style={labelStyle}>ROLE</label>
                  <select style={inputStyle} value={p.role || ""} onChange={e => updateParty(i, "role", e.target.value)}>
                    <option>Buyer</option><option>Seller</option>
                    <option>Buyer's Agent</option><option>Listing Agent</option>
                    <option>Title Company</option><option>Lender</option>
                    <option>Inspector</option><option>HOA Management</option>
                    <option>Attorney</option>
                    <option>Photographer</option><option>Handyman</option>
                    <option>Plumber</option><option>Electrician</option>
                    <option>General Contractor</option><option>Roofer</option>
                    <option>HVAC</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>NAME</label>
                  <input style={inputStyle} value={p.name || ""} onChange={e => updateParty(i, "name", e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>COMPANY</label>
                  <input style={inputStyle} value={p.company || ""} onChange={e => updateParty(i, "company", e.target.value)} />
                </div>
                <button onClick={() => removeParty(i)} style={{ background: "white", border: "1px solid " + COLORS.border, borderRadius: 6, padding: "8px 10px", color: COLORS.red, cursor: "pointer", fontSize: 13 }}>Remove</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
                <div>
                  <label style={labelStyle}>EMAIL</label>
                  <input style={inputStyle} value={p.email || ""} onChange={e => updateParty(i, "email", e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>PHONE</label>
                  <input style={inputStyle} value={p.phone || ""} onChange={e => updateParty(i, "phone", e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>LICENSE #</label>
                  <input style={inputStyle} value={p.license_number || ""} onChange={e => updateParty(i, "license_number", e.target.value)} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 14 }}>{error}</div>}

        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#1E3A8A" }}>
          💡 <strong>This offer is held in Pending Offers.</strong> Save it now and come back later — share it with the sellers, hold several offers side by side, and only <strong>Approve</strong> once the sellers have signed/accepted. Approving accepts it into the transaction (Under Contract, parties, timeline & tasks).
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
          <button onClick={handleSaveDraft} disabled={saving} style={{ background: "white", color: COLORS.navy, border: "1px solid " + COLORS.border, borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: saving ? "wait" : "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>{saving ? "Saving..." : "← Save to Pending Offers"}</button>
          <button onClick={handleApprove} disabled={saving} style={{ background: COLORS.green, color: "white", border: "none", borderRadius: 8, padding: "12px 28px", fontSize: 14, fontWeight: 600, cursor: saving ? "wait" : "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Approving Offer..." : "✓ Approve Offer (sellers accepted)"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FailedStep({ onBack, onRetry }) {
  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: COLORS.bg, minHeight: "100vh", padding: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: 500, textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>❌</div>
        <h2 style={{ margin: 0, color: COLORS.navy, fontSize: 22 }}>Extraction Failed</h2>
        <p style={{ color: COLORS.muted, marginTop: 12 }}>We couldn't process this contract. Try again with a different file or use manual entry.</p>
        <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center" }}>
          <button onClick={onRetry} style={{ background: COLORS.red, color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Try Another File</button>
          <button onClick={onBack} style={{ background: "white", color: COLORS.text, border: "1px solid " + COLORS.border, borderRadius: 8, padding: "10px 20px", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Back</button>
        </div>
      </div>
    </div>
  );
}
