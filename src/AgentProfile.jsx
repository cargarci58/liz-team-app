import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

export default function AgentProfile({ onClose, currentUser }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", photoUrl: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const tok = localStorage.getItem("tp_token") || "";
  const headers = { "Content-Type": "application/json", "Authorization": "Bearer " + tok };

  useEffect(() => {
    fetch(API + "/profile", { headers })
      .then(r => r.json())
      .then(d => {
        if (d.profile) setForm({
          firstName: d.profile.firstName || "",
          lastName: d.profile.lastName || "",
          phone: d.profile.phone || "",
          photoUrl: d.profile.photoUrl || "",
        });
        setLoading(false);
      }).catch(() => setLoading(false));
  }, []);

  const [uploading, setUploading] = useState(false);

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Please select an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { alert("Photo must be under 5MB."); return; }
    setUploading(true);
    try {
      // Get upload URL
      const res = await fetch(API + "/profile/photo-url", {
        method: "POST", headers,
        body: JSON.stringify({ fileName: file.name, fileType: file.type })
      });
      const data = await res.json();
      if (!data.uploadUrl) throw new Error("Failed to get upload URL");
      // Upload to R2
      await fetch(data.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      setForm(f => ({ ...f, photoUrl: data.photoUrl }));
    } catch (e) { alert("Upload failed: " + e.message); }
    setUploading(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(API + "/profile", { method: "PUT", headers, body: JSON.stringify(form) });
      const data = await res.json();
      if (data.success) { setSaved(true); setTimeout(() => { setSaved(false); onClose(); }, 1500); }
    } catch {}
    setSaving(false);
  };

  const inp = { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" };
  const lbl = { fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480, boxShadow: "0 8px 40px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        
        {/* Header */}
        <div style={{ background: "#111", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>👤 My Profile</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ padding: 24 }}>
          {loading ? <div style={{ textAlign: "center", padding: 32, color: "#888" }}>Loading...</div> : <>

            {/* Photo Preview */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, padding: 16, background: "#F8F9FA", borderRadius: 10 }}>
              {form.photoUrl ? (
                <img src={form.photoUrl} alt="Profile" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "3px solid #C0392B" }} onError={e => e.target.style.display="none"} />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#C0392B", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#fff", fontWeight: 700 }}>
                  {form.firstName ? form.firstName[0].toUpperCase() : "?"}
                </div>
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{form.firstName} {form.lastName}</div>
                <div style={{ fontSize: 13, color: "#888" }}>{currentUser?.email}</div>
                <div style={{ fontSize: 12, color: "#C0392B", fontWeight: 600, marginTop: 2 }}>{currentUser?.role?.toUpperCase()}</div>
              </div>
            </div>

            {/* Form */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={lbl}>First Name</label>
                <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} style={inp} placeholder="Carlos" />
              </div>
              <div>
                <label style={lbl}>Last Name</label>
                <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} style={inp} placeholder="Garcia" />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Cell Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inp} placeholder="407-555-0100" type="tel" />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Profile Photo</label>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                <label style={{ display: "inline-block", padding: "8px 16px", background: "#111", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
                  {uploading ? "Uploading..." : "📷 Upload Photo"}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => handlePhotoUpload(e.target.files[0])} disabled={uploading} />
                </label>
                <span style={{ fontSize: 12, color: "#888" }}>or paste URL below</span>
              </div>
              <input value={form.photoUrl} onChange={e => setForm(f => ({ ...f, photoUrl: e.target.value }))} style={inp} placeholder="https://yoursite.com/photo.jpg" />
              <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>Max 5MB. JPG, PNG, or GIF. This appears in your email signatures.</div>
            </div>

            {/* Email Signature Preview */}
            <div style={{ marginBottom: 20, padding: 16, background: "#F8F9FA", borderRadius: 10, border: "1px solid #DDD" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 10 }}>Email Signature Preview</div>
              <div style={{ borderTop: "2px solid #C0392B", paddingTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
                {form.photoUrl && <img src={form.photoUrl} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} onError={e => e.target.style.display="none"} />}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{form.firstName} {form.lastName}</div>
                  <div style={{ fontSize: 12, color: "#C0392B", fontWeight: 600 }}>The Liz Team Realty</div>
                  {form.phone && <div style={{ fontSize: 12, color: "#555" }}>📞 {form.phone}</div>}
                  <div style={{ fontSize: 12, color: "#555" }}>✉️ {currentUser?.email}</div>
                </div>
              </div>
            </div>

            {saved && <div style={{ background: "#F0FFF4", border: "1px solid #1E8449", borderRadius: 8, padding: 12, marginBottom: 16, color: "#1E8449", fontSize: 13, fontWeight: 600 }}>✅ Profile saved!</div>}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={{ padding: "10px 18px", border: "1px solid #CCC", borderRadius: 8, background: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ padding: "10px 24px", background: "#C0392B", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}
