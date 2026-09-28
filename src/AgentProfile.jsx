import { useState, useEffect } from "react";
import PhotoCropper from "./PhotoCropper";

const API = "https://liz-team-server-api-production.up.railway.app";

export default function AgentProfile({ onClose, currentUser }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", photoUrl: "", title: "", address: "", city: "", county: "", state: "FL", zip: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  // What the REAL email signature prints under the name (the account's company
  // name) — from the server, so the preview never disagrees with the email.
  const [sig, setSig] = useState({ tenantName: "", brandColor: "#C0392B", email: "", canEditCompanyName: false });
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
        if (d.profile) setSig({ tenantName: d.profile.tenantName || "", brandColor: d.profile.brandColor || "#C0392B", email: d.profile.email || "", canEditCompanyName: !!d.profile.canEditCompanyName });
        setLoading(false);
      }).catch(() => setLoading(false));
  }, []);

  const [uploading, setUploading] = useState(false);

  // Every photo goes through the framing step first (Carlos 9/28: a center
  // crop cut tc1's head off in the round signature avatar). The cropper hands
  // back a small 480×480 JPEG, so big phone photos are fine to pick.
  const [cropSrc, setCropSrc] = useState(null);
  const handlePhotoUpload = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Please select an image file."); return; }
    if (file.size > 25 * 1024 * 1024) { alert("That photo is too large (25MB max)."); return; }
    setCropSrc(URL.createObjectURL(file));
  };
  const uploadCropped = async (base64) => {
    setUploading(true);
    try {
      // Server-proxied upload (browser→R2 presigned PUT fails CORS).
      const res = await fetch(API + "/profile/photo", {
        method: "POST", headers,
        body: JSON.stringify({ fileName: "profile.jpg", fileType: "image/jpeg", base64 })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Upload failed");
      // The server saves the photo to the profile immediately.
      setForm(f => ({ ...f, photoUrl: data.photoUrl }));
      setCropSrc(null);
    } catch (e) { alert("Upload failed: " + e.message); }
    setUploading(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = sig.canEditCompanyName ? { ...form, companyName: sig.tenantName } : form;
      const res = await fetch(API + "/profile", { method: "PUT", headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || !data.success) { alert(data.error || "Could not save — please try again."); setSaving(false); return; }
      // Keep the saved session's company name current (header, etc.) without a re-login.
      if (sig.canEditCompanyName) {
        try { const u = JSON.parse(localStorage.getItem("tp_user") || "{}"); u.tenantName = sig.tenantName; localStorage.setItem("tp_user", JSON.stringify(u)); } catch {}
      }
      // A renamed company shows in the page header — reload so it updates now.
      setSaved(true); setTimeout(() => { setSaved(false); if (sig.canEditCompanyName) window.location.reload(); else onClose(); }, 1500);
    } catch { alert("Could not save — please try again."); }
    setSaving(false);
  };

  // Personal forward-capture address (the inbox forwarding safety net).
  const [fwAddr, setFwAddr] = useState(null);
  const [fwCopied, setFwCopied] = useState(false);
  useEffect(() => {
    fetch(API + "/me/forward-address", { headers })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.address) setFwAddr(d.address); })
      .catch(() => {});
  }, []);

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
                <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} style={inp} placeholder="Jane" />
              </div>
              <div>
                <label style={lbl}>Last Name</label>
                <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} style={inp} placeholder="Smith" />
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
                <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} style={inp} placeholder="City" />
              </div>
              <div>
                <label style={lbl}>County</label>
                <input value={form.county} onChange={e => setForm(f => ({ ...f, county: e.target.value }))} style={inp} placeholder="County" />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
              <div>
                <label style={lbl}>State</label>
                <input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} style={inp} placeholder="FL" />
              </div>
              <div>
                <label style={lbl}>Zip</label>
                <input value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} style={inp} placeholder="ZIP code" />
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#888", marginTop: -8, marginBottom: 16 }}>Your home market — used to default the property-tax rate on net sheets.</div>

            <div style={{ marginBottom: 16 }}>
              {sig.canEditCompanyName && (
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>Company Name</label>
                  <input value={sig.tenantName} onChange={e => setSig(s => ({ ...s, tenantName: e.target.value }))} style={inp} placeholder="Your coordinator company name" />
                  <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>Shown under your name in every email you send.</div>
                </div>
              )}
              <label style={lbl}>Profile Photo</label>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                {form.photoUrl && <img src={form.photoUrl} alt="" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: "2px solid #C0392B" }} onError={e => e.target.style.display = "none"} />}
                <label style={{ display: "inline-block", padding: "8px 16px", background: "#111", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
                  {uploading ? "Uploading..." : "📷 Upload Photo"}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { handlePhotoUpload(e.target.files[0]); e.target.value = ""; }} disabled={uploading} />
                </label>
                {form.photoUrl && (
                  <button type="button" onClick={() => setCropSrc(form.photoUrl)} disabled={uploading}
                    style={{ padding: "8px 14px", background: "#fff", color: "#0c4a6e", border: "1.5px solid #0c4a6e", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
                    ✂️ Adjust photo
                  </button>
                )}
              </div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>After you pick a photo you'll drag and zoom it so your face sits right in the circle — exactly how it shows in your email signature.</div>
              {cropSrc && <PhotoCropper src={cropSrc} onCancel={() => setCropSrc(null)} onSave={uploadCropped} />}
            </div>

            {/* Email capture — the personal forwarding safety net */}
            {fwAddr && (
              <div style={{ marginBottom: 20, padding: 16, background: "#F0FDF4", borderRadius: 10, border: "1px solid #BBF7D0" }}>
                <label style={lbl}>📥 Catch deal emails sent to your personal inbox</label>
                <div style={{ fontSize: 12, color: "#555", marginBottom: 10, lineHeight: 1.5 }}>
                  Title companies, lenders, and other agents often email <b>you</b> directly instead of the app — so the app never sees those messages. Set up a <b>one-time forwarding rule</b> in your email and every deal-related message files itself to the right transaction automatically. Anything the app can't place shows up on your Win the Day page under <b>📥 Mail to file</b>.
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <code style={{ fontSize: 13, fontWeight: 700, color: "#14532D", wordBreak: "break-all", background: "#fff", padding: "6px 10px", borderRadius: 8, border: "1px solid #BBF7D0" }}>{fwAddr}</code>
                  <button onClick={() => { try { navigator.clipboard.writeText(fwAddr); setFwCopied(true); setTimeout(() => setFwCopied(false), 2000); } catch { alert(fwAddr); } }}
                    style={{ padding: "8px 14px", background: "#166534", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                    {fwCopied ? "✅ Copied" : "Copy address"}
                  </button>
                </div>
                {/* Every step matters — Limarys's forward sat "Verify…" (OFF) for
                    2½ months because the confirmation was dismissed and step 5
                    never happened (Carlos 9/28). */}
                <div style={{ fontSize: 12.5, color: "#333", lineHeight: 1.6 }}>
                  <b>Gmail (5 steps, once):</b>
                  <ol style={{ margin: "4px 0 10px", paddingLeft: 20 }}>
                    <li>Gmail → Settings ⚙️ → <b>See all settings</b> → <b>Forwarding and POP/IMAP</b> → <b>Add a forwarding address</b> → paste the address above → Next → Proceed.</li>
                    <li>Gmail sends a confirmation to the app. Open <b>Win the Day → 📥 Mail to file</b> (it can take a minute).</li>
                    <li>Click the green <b>Confirm forwarding →</b> button, then <b>Confirm</b> on Google's page. <b>Don't hide it before this.</b></li>
                    <li>Back in Gmail's Forwarding page, <b>refresh</b>. It must no longer say "Verify fw-…".</li>
                    <li>Select <b>"Forward a copy of incoming mail to fw-…"</b> and <b>"keep … copy in the Inbox"</b> → click <b>Save Changes</b> at the bottom.</li>
                  </ol>
                  <b>Outlook:</b> Settings ⚙️ → Mail → <b>Forwarding</b> → Enable forwarding → paste the address above → check <b>"Keep a copy of forwarded messages"</b> → Save.<br />
                  <span style={{ color: "#888" }}>Gmail says forwarding isn't allowed? Your Google Workspace admin must turn on "Allow users to automatically forward incoming email" (Admin console → Apps → Gmail → End User Access).</span>
                </div>
              </div>
            )}

            {/* Email Signature Preview */}
            <div style={{ marginBottom: 20, padding: 16, background: "#F8F9FA", borderRadius: 10, border: "1px solid #DDD" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 10 }}>Email Signature Preview</div>
              <div style={{ borderTop: "2px solid #C0392B", paddingTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
                {form.photoUrl && <img src={form.photoUrl} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} onError={e => e.target.style.display="none"} />}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{form.firstName} {form.lastName}</div>
                  {form.title && <div style={{ fontSize: 12, color: "#555" }}>{form.title}</div>}
                  {sig.tenantName && <div style={{ fontSize: 12, color: sig.brandColor, fontWeight: 600 }}>{sig.tenantName}</div>}
                  {form.phone && <div style={{ fontSize: 12, color: "#555" }}>📞 {form.phone}</div>}
                  <div style={{ fontSize: 12, color: "#555" }}>✉️ {sig.email || currentUser?.email}</div>
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
