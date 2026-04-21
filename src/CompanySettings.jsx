import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

export default function CompanySettings({ onClose }) {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: "", city: "", state: "FL", zip: "",
    website: "", licenseNumber: "", tagline: "", primaryColor: "#C0392B",
    facebook: "", instagram: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const tok = localStorage.getItem("tp_token") || "";
  const headers = { "Content-Type": "application/json", "Authorization": "Bearer " + tok };

  useEffect(() => {
    fetch(API + "/settings/company", { headers })
      .then(r => r.json())
      .then(d => {
        if (d.company) setForm(f => ({ ...f, ...d.company }));
        setLoading(false);
      }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(API + "/settings/company", { method: "PUT", headers, body: JSON.stringify(form) });
      const data = await res.json();
      if (data.success) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } catch {}
    setSaving(false);
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
          {field("Brokerage Name", "name", "text", "The Liz Team Realty")}
          {field("Tagline", "tagline", "text", "Your trusted real estate partner")}
          {field("License Number", "licenseNumber", "text", "FL-XXXX")}

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
            <label style={lbl}>Logo URL</label>
            <input value={form.logoUrl || ""} onChange={e => f("logoUrl")(e.target.value)} placeholder="https://yourdomain.com/logo.png" style={inp} />
            {form.logoUrl && <img src={form.logoUrl} alt="Logo preview" style={{ marginTop: 8, maxHeight: 60, maxWidth: 200, borderRadius: 8, border: "1px solid #DDD" }} onError={e => e.target.style.display="none"} />}
            <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>Upload your logo to a hosting service (Cloudflare, Imgur, etc.) and paste the URL here.</div>
          </div>

          {/* Save */}
          {saved && <div style={{ background: "#F0FFF4", border: "1px solid #1E8449", borderRadius: 8, padding: 12, marginBottom: 16, color: "#1E8449", fontSize: 13, fontWeight: 600 }}>✅ Settings saved successfully!</div>}
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
