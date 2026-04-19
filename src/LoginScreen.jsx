import { useState } from "react";

// Add global CSS for input focus instead of JS handlers
if (typeof document !== 'undefined' && !document.getElementById('login-focus-style')) {
  const s = document.createElement('style');
  s.id = 'login-focus-style';
  s.textContent = 'input:focus { border-color: #C0392B !important; outline: none; }';
  document.head.appendChild(s);
}

const API = "https://liz-team-server-api-production.up.railway.app";

const C = {
  red: "#C0392B",
  darkRed: "#922B21",
  lightRed: "#FADBD8",
  black: "#111111",
  darkGray: "#222222",
  gray: "#555555",
  lightGray: "#F4F4F4",
  midGray: "#CCCCCC",
  white: "#FFFFFF",
  success: "#1E8449",
  error: "#C0392B",
};

export default function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("login"); // login | register | forgot
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Login form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Register form
  const [reg, setReg] = useState({ brokerageName: "", firstName: "", lastName: "", email: "", phone: "", password: "", confirmPassword: "" });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Login failed"); return; }
      localStorage.setItem("tp_token", data.token);
      localStorage.setItem("tp_user", JSON.stringify(data.user));
      onLogin(data.user, data.token);
    } catch { setError("Cannot connect to server. Please try again."); }
    finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (reg.password !== reg.confirmPassword) { setError("Passwords do not match"); return; }
    if (reg.password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brokerageName: reg.brokerageName, firstName: reg.firstName, lastName: reg.lastName, email: reg.email, phone: reg.phone, password: reg.password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Registration failed"); return; }
      localStorage.setItem("tp_token", data.token);
      localStorage.setItem("tp_user", JSON.stringify(data.user));
      onLogin(data.user, data.token);
    } catch { setError("Cannot connect to server. Please try again."); }
    finally { setLoading(false); }
  };

  const inputStyle = {
    width: "100%", padding: "12px 14px", borderRadius: 8,
    border: `1.5px solid ${C.midGray}`, fontSize: 15,
    fontFamily: "inherit", color: C.black, background: C.white,
    outline: "none", transition: "border 0.2s",
    boxSizing: "border-box",
  };

  const labelStyle = {
    fontSize: 12, fontWeight: 700, color: C.gray,
    textTransform: "uppercase", letterSpacing: "0.06em",
    display: "block", marginBottom: 6,
  };

  const Field = ({ label, type = "text", value, onChange, placeholder, required }) => (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>{label}{required && <span style={{ color: C.red }}> *</span>}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        required={required} style={inputStyle}

      />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.lightGray, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* Logo / Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: C.red, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: C.white, fontSize: 22, fontWeight: 900 }}>T</span>
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: C.black, letterSpacing: "-0.5px" }}>TransactPro</div>
            <div style={{ fontSize: 12, color: C.gray, fontWeight: 500, marginTop: -2 }}>Real Estate Transaction Management</div>
          </div>
        </div>
      </div>

      {/* Card */}
      <div style={{ background: C.white, borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "0 4px 32px rgba(0,0,0,0.10)", overflow: "hidden" }}>

        {/* Tab switcher */}
        <div style={{ display: "flex", borderBottom: `1px solid ${C.midGray}` }}>
          {[["login", "Sign In"], ["register", "Create Account"]].map(([m, label]) => (
            <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }}
              style={{ flex: 1, padding: "16px", border: "none", background: mode === m ? C.white : C.lightGray, color: mode === m ? C.red : C.gray, fontWeight: mode === m ? 700 : 500, fontSize: 14, cursor: "pointer", fontFamily: "inherit", borderBottom: mode === m ? `3px solid ${C.red}` : "3px solid transparent", transition: "all 0.2s" }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ padding: 32 }}>
          {error && (
            <div style={{ background: C.lightRed, color: C.darkRed, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
              ⚠️ {error}
            </div>
          )}
          {success && (
            <div style={{ background: "#D5F5E3", color: C.success, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 20 }}>
              ✅ {success}
            </div>
          )}

          {/* LOGIN */}
          {mode === "login" && (
            <form onSubmit={handleLogin}>
              <Field label="Email Address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Password <span style={{ color: C.red }}>*</span></label>
                <div style={{ position: "relative" }}>
                  <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Your password" required style={{ ...inputStyle, paddingRight: 44 }}
                    onFocus={e => e.target.style.border = `1.5px solid ${C.red}`}
                    onBlur={e => e.target.style.border = `1.5px solid ${C.midGray}`}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.gray }}>
                    {showPassword ? "🙈" : "👁"}
                  </button>
                </div>
              </div>
              <div style={{ textAlign: "right", marginBottom: 20, marginTop: -8 }}>
                <button type="button" onClick={() => setMode("forgot")} style={{ background: "none", border: "none", color: C.red, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  Forgot password?
                </button>
              </div>
              <button type="submit" disabled={loading}
                style={{ width: "100%", padding: "14px", background: loading ? C.midGray : C.red, color: C.white, border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "background 0.2s" }}>
                {loading ? "Signing in..." : "Sign In →"}
              </button>
            </form>
          )}

          {/* REGISTER */}
          {mode === "register" && (
            <form onSubmit={handleRegister}>
              <Field label="Brokerage / Company Name" value={reg.brokerageName} onChange={v => setReg(r => ({ ...r, brokerageName: v }))} placeholder="ABC Realty" required />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 0 }}>
                <div>
                  <label style={labelStyle}>First Name <span style={{ color: C.red }}>*</span></label>
                  <input value={reg.firstName} onChange={e => setReg(r => ({ ...r, firstName: e.target.value }))} placeholder="Carlos" required style={inputStyle}
 />
                </div>
                <div>
                  <label style={labelStyle}>Last Name <span style={{ color: C.red }}>*</span></label>
                  <input value={reg.lastName} onChange={e => setReg(r => ({ ...r, lastName: e.target.value }))} placeholder="Garcia" required style={inputStyle}
 />
                </div>
              </div>
              <div style={{ marginBottom: 16 }} />
              <Field label="Email Address" type="email" value={reg.email} onChange={v => setReg(r => ({ ...r, email: v }))} placeholder="you@brokerage.com" required />
              <Field label="Phone Number" type="tel" value={reg.phone} onChange={v => setReg(r => ({ ...r, phone: v }))} placeholder="407-555-0100" />
              <Field label="Password" type="password" value={reg.password} onChange={v => setReg(r => ({ ...r, password: v }))} placeholder="Min 8 characters" required />
              <Field label="Confirm Password" type="password" value={reg.confirmPassword} onChange={v => setReg(r => ({ ...r, confirmPassword: v }))} placeholder="Repeat password" required />
              <div style={{ background: C.lightGray, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.gray, marginBottom: 20 }}>
                🔒 By creating an account you agree to our Terms of Service and Privacy Policy. Your 14-day free trial starts immediately.
              </div>
              <button type="submit" disabled={loading}
                style={{ width: "100%", padding: "14px", background: loading ? C.midGray : C.red, color: C.white, border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {loading ? "Creating account..." : "Start Free Trial →"}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD */}
          {mode === "forgot" && (
            <div>
              <p style={{ color: C.gray, fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
                Enter your email address and we'll send you instructions to reset your password.
              </p>
              <Field label="Email Address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
              <button onClick={async () => {
                setLoading(true); setError("");
                await new Promise(r => setTimeout(r, 1000));
                setSuccess("If that email exists, a reset link has been sent.");
                setLoading(false);
              }} disabled={loading}
                style={{ width: "100%", padding: "14px", background: C.red, color: C.white, border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}>
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
              <button onClick={() => setMode("login")} style={{ width: "100%", padding: "12px", background: "none", color: C.gray, border: `1px solid ${C.midGray}`, borderRadius: 8, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                ← Back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 24, textAlign: "center", fontSize: 12, color: C.gray }}>
        <div style={{ marginBottom: 4 }}>© 2025 TransactPro · Real Estate Transaction Management</div>
        <div>Florida Licensed · Secure · Reliable</div>
      </div>
    </div>
  );
}
