import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

export default function CompanySettings({ onClose, onChangePassword }) {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: "", city: "", state: "FL", zip: "",
    website: "", licenseNumber: "", tagline: "", primaryColor: "#C0392B",
    facebook: "", instagram: "",
    ein: "", mlsId: "", businessType: "", dbaName: "", narMemberId: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [roster, setRoster] = useState([]);
  const [generatingW9, setGeneratingW9] = useState(false);
  const [w9Error, setW9Error] = useState("");
  const tok = localStorage.getItem("tp_token") || "";
  const headers = { "Content-Type": "application/json", "Authorization": "Bearer " + tok };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setLogoError("");
    if (file.size > 2 * 1024 * 1024) { setLogoError("Logo is too large — max 2 MB."); return; }
    if (!/^image\//.test(file.type)) { setLogoError("Please pick an image file (PNG, JPG, GIF, WebP, or SVG)."); return; }
    setUploadingLogo(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      const res = await fetch(API + "/settings/company/logo", {
        method: "POST", headers,
        body: JSON.stringify({ filename: file.name, mimeType: file.type, base64 })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Upload failed");
      setForm(f => ({ ...f, logoUrl: data.logoUrl }));
    } catch (err) {
      setLogoError(err.message || "Upload failed");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoRemove = async () => {
    if (!confirm("Remove the current logo?")) return;
    setLogoError("");
    try {
      const res = await fetch(API + "/settings/company/logo", { method: "DELETE", headers });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Could not remove logo");
      setForm(f => ({ ...f, logoUrl: "" }));
    } catch (err) {
      setLogoError(err.message || "Could not remove logo");
    }
  };

  useEffect(() => {
    fetch(API + "/settings/company", { headers })
      .then(r => r.json())
      .then(d => {
        if (d.company) setForm(f => ({ ...f, ...d.company }));
        setLoading(false);
      }).catch(() => setLoading(false));

    // Fetch brokerage roster (admins only — endpoint requires admin role)
    fetch(API + "/users", { headers })
      .then(r => r.ok ? r.json() : { users: [] })
      .then(d => setRoster(Array.isArray(d.users) ? d.users : []))
      .catch(e => console.error("[bg]", e && e.message ? e.message : e));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(API + "/settings/company", { method: "PUT", headers, body: JSON.stringify(form) });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        // Auto-close after a brief confirmation flash so the user sees the
        // success and doesn't have to hit Cancel themselves.
        setTimeout(() => {
          setSaved(false);
          onClose();
        }, 800);
      }
    } catch {}
    setSaving(false);
  };

  const handleGenerateW9 = async () => {
    setW9Error("");
    setGeneratingW9(true);
    try {
      const res = await fetch(API + "/settings/company/w9", { method: "POST", headers });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Request failed: ${res.status}`);
      }
      // Download the PDF
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `W9_${(form.name || "brokerage").replace(/[^a-z0-9]/gi, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setW9Error(err.message || "Could not generate W-9");
    } finally {
      setGeneratingW9(false);
    }
  };

  const f = k => v => setForm(p => ({ ...p, [k]: v }));

  const inp = { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" };
  const lbl = { fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 };
  const field = (label, key, type = "text", placeholder = "") => (
    <div style={{ marginBottom: 16 }}>
      <label style={lbl}>{label}</label>
      <input type={type} value={form[key] || ""} onChange={e => f(key)(e.target.value)} placeholder={placeholder} style={inp} />
    </div>
  );

  if (loading) return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 32 }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>
        
        {/* Header */}
        <div style={{ background: "#111", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "14px 14px 0 0", position: "sticky", top: 0, zIndex: 1 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>🏢 Company Settings</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Brokerage Info */}
          <div style={{ fontSize: 13, fontWeight: 700, color: "#C0392B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Brokerage Information</div>
          {field("Brokerage Name (as on tax return)", "name", "text", "ABC Realty LLC")}
          {field("DBA (Doing Business As)", "dbaName", "text", "If different from legal name")}
          {field("Tagline", "tagline", "text", "Your trusted real estate partner")}
          {field("Brokerage License Number (DBPR)", "licenseNumber", "text", "FL-XXXX")}
          {field("MLS ID (Broker)", "mlsId", "text", "e.g. 270000-1")}
          {field("NAR Member ID", "narMemberId", "text", "Optional")}

          {/* Tax / Entity Info — needed for W-9 generation */}
          <div style={{ fontSize: 13, fontWeight: 700, color: "#C0392B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16, marginTop: 8 }}>Tax & Entity Info</div>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Business Type</label>
            <select value={form.businessType || ""} onChange={e => f("businessType")(e.target.value)} style={inp}>
              <option value="">— Select —</option>
              <option value="Sole Proprietor">Sole Proprietor / Individual</option>
              <option value="LLC">LLC (single-member or unspecified)</option>
              <option value="LLC - S Corp">LLC taxed as S Corporation</option>
              <option value="LLC - C Corp">LLC taxed as C Corporation</option>
              <option value="LLC - Partnership">LLC taxed as Partnership</option>
              <option value="S Corporation">S Corporation</option>
              <option value="C Corporation">C Corporation</option>
              <option value="Partnership">Partnership</option>
              <option value="Trust/Estate">Trust / Estate</option>
            </select>
          </div>
          {field("EIN (Federal Tax ID, 9 digits)", "ein", "text", "XX-XXXXXXX")}

          {/* Contact */}
          <div style={{ fontSize: 13, fontWeight: 700, color: "#C0392B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16, marginTop: 8 }}>Contact Information</div>
          {field("Email", "email", "email", "info@brokerage.com")}
          {field("Phone", "phone", "tel", "407-555-0100")}
          {field("Website", "website", "text", "https://yourbrokerage.com")}

          {/* Address */}
          <div style={{ fontSize: 13, fontWeight: 700, color: "#C0392B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16, marginTop: 8 }}>Address</div>
          {field("Street Address", "address", "text", "123 Main St, Suite 100")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 120px", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={lbl}>City</label>
              <input value={form.city || ""} onChange={e => f("city")(e.target.value)} placeholder="Orlando" style={inp} />
            </div>
            <div>
              <label style={lbl}>State</label>
              <input value={form.state || "FL"} onChange={e => f("state")(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>ZIP</label>
              <input value={form.zip || ""} onChange={e => f("zip")(e.target.value)} placeholder="32801" style={inp} />
            </div>
          </div>

          {/* Social */}
          <div style={{ fontSize: 13, fontWeight: 700, color: "#C0392B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16, marginTop: 8 }}>Social Media</div>
          {field("Facebook URL", "facebook", "text", "https://facebook.com/yourbrokerage")}
          {field("Instagram URL", "instagram", "text", "https://instagram.com/yourbrokerage")}

          {/* Branding */}
          <div style={{ fontSize: 13, fontWeight: 700, color: "#C0392B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16, marginTop: 8 }}>Branding</div>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Brand Color</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input type="color" value={form.primaryColor || "#C0392B"} onChange={e => f("primaryColor")(e.target.value)} style={{ width: 48, height: 40, borderRadius: 8, border: "1.5px solid #CCC", cursor: "pointer", padding: 2 }} />
              <input value={form.primaryColor || "#C0392B"} onChange={e => f("primaryColor")(e.target.value)} placeholder="#C0392B" style={{ ...inp, width: 120 }} />
              <div style={{ width: 40, height: 40, borderRadius: 8, background: form.primaryColor || "#C0392B" }} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Logo</label>

            {form.logoUrl ? (
              <div style={{ marginBottom: 8, padding: 12, background: "#FAFAFA", border: "1px solid #DDD", borderRadius: 8, display: "flex", alignItems: "center", gap: 14 }}>
                <img src={form.logoUrl} alt="Logo preview" style={{ maxHeight: 60, maxWidth: 200, objectFit: "contain" }} onError={e => e.target.style.display = "none"} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1E8449" }}>✓ Logo set</div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>This logo appears in all client-facing emails.</div>
                </div>
                <button onClick={handleLogoRemove} style={{ padding: "6px 12px", background: "none", border: "1px solid #CCC", borderRadius: 6, cursor: "pointer", fontSize: 12, color: "#555", fontFamily: "inherit" }}>Remove</button>
              </div>
            ) : null}

            <label style={{ display: "inline-block", padding: "10px 18px", background: uploadingLogo ? "#888" : "#111", color: "#fff", borderRadius: 8, cursor: uploadingLogo ? "wait" : "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
              {uploadingLogo ? "Uploading…" : (form.logoUrl ? "📤 Replace Logo" : "📤 Upload Logo")}
              <input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" onChange={handleLogoUpload} disabled={uploadingLogo} style={{ display: "none" }} />
            </label>

            <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>PNG, JPG, GIF, WebP, or SVG. Max 2 MB.</div>
            {logoError && <div style={{ fontSize: 12, color: "#C0392B", marginTop: 6, fontWeight: 600 }}>⚠️ {logoError}</div>}
          </div>

          {/* Brokerage Roster — read-only list of agents in this brokerage */}
          {roster.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#C0392B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, marginTop: 8 }}>Brokerage Roster ({roster.length})</div>
              <div style={{ background: "#FAFAFA", border: "1px solid #EEE", borderRadius: 8, padding: 4, marginBottom: 16, maxHeight: 220, overflowY: "auto" }}>
                {roster.map(u => (
                  <div key={u.id} style={{ padding: "10px 12px", borderBottom: "1px solid #F0F0F0", display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center", fontSize: 13 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "#111" }}>
                        {u.first_name} {u.last_name}
                        {!u.is_active && <span style={{ fontSize: 11, color: "#999", marginLeft: 8, fontWeight: 400 }}>(inactive)</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                        {u.email}
                        {u.license_number && <span style={{ marginLeft: 8 }}>· License #{u.license_number}</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: u.role === "admin" || u.role === "superadmin" ? "#C0392B" : "#555", padding: "3px 8px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{u.role}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#888", marginTop: -8, marginBottom: 16 }}>Read-only summary. To add, remove, or edit agents, use the User Management screen.</div>
            </>
          )}

          {/* W-9 Generator */}
          <div style={{ fontSize: 13, fontWeight: 700, color: "#C0392B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, marginTop: 8 }}>W-9 Form</div>
          <div style={{ background: "#FAFAFA", border: "1px solid #EEE", borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "#333", marginBottom: 10, lineHeight: 1.5 }}>
              Generate an IRS Form W-9 pre-filled with your brokerage info. Use this when a co-op brokerage or client needs your W-9 on file before paying commission.
            </div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 12, lineHeight: 1.5 }}>
              <strong>Requires:</strong> Brokerage Name, Address (street, city, state, ZIP), Business Type, and EIN. <strong>Save your settings first</strong> if you just added or changed any of these.
            </div>
            <button
              onClick={handleGenerateW9}
              disabled={generatingW9}
              style={{ padding: "10px 18px", background: generatingW9 ? "#888" : "#0c4a6e", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: generatingW9 ? "wait" : "pointer", fontFamily: "inherit" }}
            >
              {generatingW9 ? "Generating…" : "📄 Generate W-9 PDF"}
            </button>
            {w9Error && <div style={{ fontSize: 12, color: "#C0392B", marginTop: 10, fontWeight: 600 }}>⚠️ {w9Error}</div>}
            <div style={{ fontSize: 11, color: "#888", marginTop: 10, lineHeight: 1.4 }}>
              ℹ️ Print the PDF and sign Part II by hand. The IRS legally requires a real signature for the W-9 to be valid.
            </div>
          </div>

          {/* Save */}
          {saved && <div style={{ background: "#F0FFF4", border: "1px solid #1E8449", borderRadius: 8, padding: 12, marginBottom: 16, color: "#1E8449", fontSize: 13, fontWeight: 600 }}>✅ Settings saved successfully!</div>}
          <div style={{ borderTop: "1px solid #EEE", paddingTop: 16, marginBottom: 16 }}>
            <button onClick={() => { onClose(); onChangePassword && onChangePassword(); }} style={{ background: "none", border: "1px solid #CCC", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "#555" }}>🔒 Change Password</button>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "10px 18px", border: "1px solid #CCC", borderRadius: 8, background: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ padding: "10px 24px", background: "#C0392B", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 15 }}>
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

