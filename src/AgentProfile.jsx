import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

export default function AgentProfile({ onClose, currentUser }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", photoUrl: "", title: "", address: "", city: "", county: "", state: "FL", zip: "" });
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
          title: d.profile.title || "",
          address: d.profile.address || "",
          city: d.profile.city || "",
          county: d.profile.county || "",
          state: d.profile.state || "FL",
          zip: d.profile.zip || "",
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
      // Server-proxied upload (browser→R2 presigned PUT fails CORS).
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      const res = await fetch(API + "/profile/photo", {
        method: "POST", headers,
        body: JSON.stringify({ fileName: file.name, fileType: file.type, base64 })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Upload failed");
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

  // RentCast key (one per agent, works for ALL their contacts' "Look up last sale").
  const [rc, setRc] = useState({ hasKey: false, last4: null, input: "", saving: false, msg: "" });
  useEffect(() => {
    fetch(API + "/me/integrations/rentcast", { headers })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.success) setRc(s => ({ ...s, hasKey: d.hasKey, last4: d.last4 })); })
      .catch(() => {});
  }, []);
  const saveRc = async (clear) => {
    setRc(s => ({ ...s, saving: true, msg: "" }));
    try {
      const r = await fetch(API + "/me/integrations/rentcast", { method: "PUT", headers, body: JSON.stringify({ apiKey: clear ? "" : rc.input.trim() }) });
      const d = await r.json();
      setRc(s => ({ ...s, saving: false, hasKey: !!d.hasKey, last4: clear ? null : s.input.trim().slice(-4), input: "", msg: clear ? "Removed." : "Saved ✓" }));
    } catch { setRc(s => ({ ...s, saving: false, msg: "Could not save." })); }
  };

  const inp = { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" };
  const lbl = { fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 3000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, fontFamily: "system-ui, sans-serif", overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480, boxShadow: "0 8px 40px rgba(0,0,0,0.2)", overflow: "hidden", margin: "auto" }}>
        
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
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>Title</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inp} placeholder="Transaction Coordinator, Broker, Real Estate Agent..." />
              <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Shown in your email signature</div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={lbl}>Street Address</label>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={inp} placeholder="123 Main St, Suite 100" />
              <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Your business mailing address — required in the footer of newsletter/marketing emails (CAN-SPAM law).</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8 }}>
              <div>
                <label style={lbl}>City</label>
                <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} style={inp} placeholder="Orlando" />
              </div>
              <div>
                <label style={lbl}>County</label>
                <input value={form.county} onChange={e => setForm(f => ({ ...f, county: e.target.value }))} style={inp} placeholder="Orange" />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
              <div>
                <label style={lbl}>State</label>
                <input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} style={inp} placeholder="FL" />
              </div>
              <div>
                <label style={lbl}>Zip</label>
                <input value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} style={inp} placeholder="32801" />
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#888", marginTop: -8, marginBottom: 16 }}>Your home market — used to default the property-tax rate on net sheets.</div>

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

            {/* RentCast integration — one key, all contacts */}
            <div style={{ marginBottom: 20, padding: 16, background: "#F0F7FF", borderRadius: 10, border: "1px solid #BFD9F2" }}>
              <label style={lbl}>🔍 Property Lookup (RentCast)</label>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 10, lineHeight: 1.5 }}>
                Add your free RentCast key <b>once here</b> — it powers the "Look up last sale" button on <b>every</b> contact. Get a free key at <a href="https://www.rentcast.io/api" target="_blank" rel="noreferrer" style={{ color: "#1d4ed8", fontWeight: 600 }}>rentcast.io/api</a> (50 free lookups/month).
              </div>
              {rc.hasKey ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1E8449", marginRight: 4 }}>✓ Connected (••••{rc.last4})</span>
                  <input value={rc.input} onChange={e => setRc(s => ({ ...s, input: e.target.value }))} style={{ ...inp, flex: 1, minWidth: 150, width: "auto" }} placeholder="Paste a new key to replace" />
                  <button onClick={() => saveRc(false)} disabled={rc.saving || !rc.input.trim()} style={{ padding: "9px 14px", background: "#111", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Update</button>
                  <button onClick={() => saveRc(true)} disabled={rc.saving} style={{ padding: "9px 14px", background: "none", color: "#C0392B", border: "1px solid #C0392B", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Remove</button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={rc.input} onChange={e => setRc(s => ({ ...s, input: e.target.value }))} style={{ ...inp, flex: 1, width: "auto" }} placeholder="RentCast API key" />
                  <button onClick={() => saveRc(false)} disabled={rc.saving || !rc.input.trim()} style={{ padding: "9px 16px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{rc.saving ? "Saving…" : "Save key"}</button>
                </div>
              )}
              {rc.msg && <div style={{ fontSize: 12, fontWeight: 600, color: rc.msg.startsWith("Could") ? "#C0392B" : "#1E8449", marginTop: 8 }}>{rc.msg}</div>}
            </div>

            {/* Email Signature Preview */}
            <div style={{ marginBottom: 20, padding: 16, background: "#F8F9FA", borderRadius: 10, border: "1px solid #DDD" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 10 }}>Email Signature Preview</div>
              <div style={{ borderTop: "2px solid #C0392B", paddingTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
                {form.photoUrl && <img src={form.photoUrl} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} onError={e => e.target.style.display="none"} />}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{form.firstName} {form.lastName}</div>
                  <div style={{ fontSize: 12, color: "#C0392B", fontWeight: 600 }}>{currentUser?.tenantName || "Your Brokerage"}</div>
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
