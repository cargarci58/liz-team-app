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
export default function ContractAutoIntake({ token, user, existingTransactionId, onBack, onApproved }) {
  const [stage, setStage] = useState("upload");
  const [uploadId, setUploadId] = useState(null);

  if (stage === "upload") {
    return <UploadStep token={token} existingTransactionId={existingTransactionId} onBack={onBack} onUploaded={(id) => { setUploadId(id); setStage("processing"); }} />;
  }
  if (stage === "processing") {
    return <ProcessingStep token={token} uploadId={uploadId} onReady={() => setStage("review")} onFailed={(err) => setStage("failed")} />;
  }
  if (stage === "review") {
    return <ReviewStep token={token} uploadId={uploadId} user={user} onApproved={onApproved} onBack={onBack} />;
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
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const onFileSelected = (f) => {
    if (!f) return;
    const validTypes = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif"];
    if (!validTypes.includes(f.type)) {
      setError("Please upload a PDF or image (JPG, PNG, HEIC). Got: " + f.type);
      return;
    }
    if (f.size > 30 * 1024 * 1024) {
      setError("File is too large (max 30 MB). Try compressing the PDF first.");
      return;
    }
    setError("");
    setFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    onFileSelected(e.dataTransfer.files?.[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    setProgress(10);
    try {
      // Step 1: get upload URL
      const r1 = await fetch(API + "/contracts/upload-url", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileType: file.type, existingTransactionId })
      });
      const d1 = await r1.json();
      if (!d1.success) throw new Error(d1.error || "Failed to get upload URL");
      setProgress(25);

      // Step 2: upload to R2 directly
      const r2 = await fetch(d1.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      });
      if (!r2.ok) throw new Error("Upload to storage failed");
      setProgress(70);

      // Step 3: trigger extraction
      const r3 = await fetch(API + "/contracts/upload-complete/" + d1.uploadId, {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ fileSize: file.size })
      });
      const d3 = await r3.json();
      if (!d3.success) throw new Error(d3.error || "Failed to start extraction");
      setProgress(100);

      onUploaded(d1.uploadId);
    } catch (e) {
      setError(e.message);
      setUploading(false);
    }
  };

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: COLORS.bg, minHeight: "100vh", padding: "24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 14, cursor: "pointer", marginBottom: 16 }}>← Back</button>
        <h1 style={{ margin: 0, color: COLORS.navy, fontSize: 26 }}>📄 Upload Executed Contract</h1>
        <p style={{ color: COLORS.muted, marginTop: 6, marginBottom: 24 }}>
          Drop your contract package below. We'll read it, identify every document and addendum, and pull out all the key fields automatically.
        </p>

        <div
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
            {file ? file.name : "Drop your contract here, or click to browse"}
          </div>
          <div style={{ fontSize: 13, color: COLORS.muted }}>
            {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "PDF, JPG, PNG, or HEIC · Max 30 MB"}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/heic,image/heif"
            style={{ display: "none" }}
            onChange={(e) => onFileSelected(e.target.files?.[0])}
          />
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 8, padding: "10px 14px", marginTop: 16, fontSize: 14 }}>
            {error}
          </div>
        )}

        {uploading && (
          <div style={{ marginTop: 20 }}>
            <div style={{ background: "#e5e7eb", height: 8, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ background: COLORS.red, height: "100%", width: progress + "%", transition: "width 0.3s" }} />
            </div>
            <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 8 }}>Uploading... {progress}%</div>
          </div>
        )}

        {file && !uploading && (
          <button
            onClick={handleUpload}
            style={{ marginTop: 20, background: COLORS.red, color: "white", border: "none", borderRadius: 8, padding: "14px 28px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            Upload & Process with AI →
          </button>
        )}

        <div style={{ marginTop: 32, padding: 20, background: "#f9fafb", borderRadius: 8, fontSize: 13, color: COLORS.muted, lineHeight: 1.6 }}>
          <strong style={{ color: COLORS.text }}>What happens next?</strong>
          <ol style={{ paddingLeft: 20, margin: "8px 0 0 0" }}>
            <li>Your contract is uploaded securely</li>
            <li>AI reads every page (takes 30-60 seconds)</li>
            <li>Each document and addendum is identified separately</li>
            <li>You review what was extracted, edit anything wrong, and approve</li>
            <li>Transaction is created automatically with all the data</li>
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
  const [status, setStatus] = useState("extracting");
  const [error, setError] = useState("");

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const r = await fetch(API + "/contracts/uploads/" + uploadId, {
          headers: { "Authorization": "Bearer " + token }
        });
        const d = await r.json();
        if (d.upload?.status === "ready_for_review") {
          clearInterval(poll);
          onReady();
        } else if (d.upload?.status === "failed") {
          clearInterval(poll);
          setError(d.upload.extraction_error || "Extraction failed");
          setTimeout(() => onFailed(d.upload.extraction_error), 2000);
        }
      } catch (e) { /* keep polling */ }
    }, 3000);
    return () => clearInterval(poll);
  }, [uploadId, token, onReady, onFailed]);

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
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// STEP 3: REVIEW & APPROVE
// ───────────────────────────────────────────────────────────────
function ReviewStep({ token, uploadId, user, onApproved, onBack }) {
  const [data, setData] = useState(null);
  const [edited, setEdited] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(API + "/contracts/uploads/" + uploadId, {
      headers: { "Authorization": "Bearer " + token }
    })
      .then(r => r.json())
      .then(d => {
        if (d.upload?.extracted_data) {
          setData(d.upload);
          setEdited(d.upload.extracted_data);
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

  const handleApprove = async () => {
    setSaving(true);
    setError("");
    try {
      const r = await fetch(API + "/contracts/uploads/" + uploadId + "/approve", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ approved_data: edited })
      });
      const d = await r.json();
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
          Verify everything below is correct. Edit any field that's wrong. Click <strong>Approve & Create Transaction</strong> when ready.
        </p>

        <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#78350f" }}>
          ⚠️ <strong>Agent responsibility:</strong> As the agent, you are legally responsible for verifying all extracted data is accurate before approval.
        </div>

        {edited.extraction_notes && (
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#1e3a8a" }}>
            🤖 <strong>AI Notes:</strong> {edited.extraction_notes}
          </div>
        )}

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
            <div><label style={labelStyle}>EMD DEADLINE (DAYS)</label><input type="number" style={inputStyle} value={tx.emd_deadline_days || ""} onChange={e => updateTx("emd_deadline_days", parseInt(e.target.value) || 0)} /></div>
            <div><label style={labelStyle}>INSPECTION PERIOD (DAYS)</label><input type="number" style={inputStyle} value={tx.inspection_period_days || ""} onChange={e => updateTx("inspection_period_days", parseInt(e.target.value) || 0)} /></div>
            <div><label style={labelStyle}>FINANCING CONTINGENCY (DAYS)</label><input type="number" style={inputStyle} value={tx.financing_contingency_days || ""} onChange={e => updateTx("financing_contingency_days", parseInt(e.target.value) || 0)} disabled={!tx.financing_contingency} /></div>
            <div><label style={labelStyle}>APPRAISAL CONTINGENCY (DAYS)</label><input type="number" style={inputStyle} value={tx.appraisal_contingency_days || ""} onChange={e => updateTx("appraisal_contingency_days", parseInt(e.target.value) || 0)} disabled={!tx.appraisal_contingency} /></div>
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
                    <option>Attorney</option><option>Other</option>
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

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
          <button onClick={onBack} style={{ background: "white", color: COLORS.text, border: "1px solid " + COLORS.border, borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={handleApprove} disabled={saving} style={{ background: COLORS.green, color: "white", border: "none", borderRadius: 8, padding: "12px 28px", fontSize: 14, fontWeight: 600, cursor: saving ? "wait" : "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Creating Transaction..." : "✓ Approve & Create Transaction"}
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
