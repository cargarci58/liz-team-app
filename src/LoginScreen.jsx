const API = "https://liz-team-server-api-production.up.railway.app";

import { useState } from "react";

function ForgotPasswordModal({ onClose }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const API = "https://liz-team-server-api-production.up.railway.app";

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError("Email required"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(API + "/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (r.status === 429) {
        throw new Error("Too many reset attempts from your network. Please wait 15 minutes and try again.");
      }
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Request failed");
      setSent(true);
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 5000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 12, maxWidth: 420, width: "100%", padding: 28 }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>🔐 Forgot Your Password?</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
          Enter your email and we will send you a secure link to set a new password. The link expires in 1 hour.
        </div>
        {sent ? (
          <div>
            <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 13, color: "#14532d" }}>
              ✅ <strong>Check your email.</strong> If an account exists for that address, a reset link has been sent. The link expires in 1 hour.
            </div>
            <button onClick={onClose} style={{ width: "100%", background: "#0c4a6e", color: "white", border: "none", padding: "10px 18px", borderRadius: 6, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Close</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
              placeholder="you@example.com"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, marginBottom: 14, boxSizing: "border-box", fontFamily: "inherit" }} />
            {error && <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: 10, fontSize: 13, color: "#7f1d1d", marginBottom: 14 }}>⚠️ {error}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={onClose} style={{ flex: 1, background: "#e5e7eb", color: "#374151", border: "none", padding: "10px 18px", borderRadius: 6, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button type="submit" disabled={submitting} style={{ flex: 1, background: submitting ? "#9ca3af" : "#0c4a6e", color: "white", border: "none", padding: "10px 18px", borderRadius: 6, fontWeight: 700, fontSize: 14, cursor: submitting ? "wait" : "pointer", fontFamily: "inherit" }}>
                {submitting ? "Sending..." : "Send Reset Link"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function PwInput({ inputStyle, ...rest }) {
  const [show, setShow] = useState(false);
  const wrapStyle = { position: "relative", marginBottom: inputStyle?.marginBottom ?? 0 };
  const innerStyle = { ...inputStyle, marginBottom: 0, paddingRight: 42 };
  return (
    <div style={wrapStyle}>
      <input {...rest} type={show ? "text" : "password"} style={innerStyle} />
      <button type="button" onClick={() => setShow(s => !s)} tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", padding: 4, cursor: "pointer", color: "#6b7280", lineHeight: 0 }}>
        {show ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        )}
      </button>
    </div>
  );
}

export default function LoginScreen({ onLogin }) {
  const [showForgot, setShowForgot] = useState(false);
  const handleLogin = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    const btn = document.getElementById("login-btn");
    const err = document.getElementById("login-error");
    btn.textContent = "Signing in..."; btn.disabled = true; err.textContent = "";
    try {
      const res = await fetch(API + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) { err.textContent = data.error || "Login failed"; btn.textContent = "Sign In"; btn.disabled = false; return; }
      onLogin(data.user, data.token);
    } catch { err.textContent = "Cannot connect. Try again."; btn.textContent = "Sign In"; btn.disabled = false; }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const f = e.target;
    const err = document.getElementById("reg-error");
    const btn = document.getElementById("reg-btn");
    if (f.password.value !== f.confirmPassword.value) { err.textContent = "Passwords do not match"; return; }
    if (f.password.value.length < 8) { err.textContent = "Password must be at least 8 characters"; return; }
    btn.textContent = "Creating..."; btn.disabled = true; err.textContent = "";
    try {
      const res = await fetch(API + "/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brokerageName: f.brokerageName.value, firstName: f.firstName.value, lastName: f.lastName.value, email: f.email.value, phone: f.phone.value, password: f.password.value, accountType: f.accountType.value, state: f.state.value }) });
      const data = await res.json();
      if (!res.ok) { err.textContent = data.error || "Registration failed"; btn.textContent = "Start Free Trial"; btn.disabled = false; return; }
      onLogin(data.user, data.token);
    } catch { err.textContent = "Cannot connect. Try again."; btn.textContent = "Start Free Trial"; btn.disabled = false; }
  };

  const showTab = (tab) => {
    document.getElementById("login-form").style.display = tab === "login" ? "block" : "none";
    document.getElementById("register-form").style.display = tab === "register" ? "block" : "none";
    document.getElementById("tab-login").style.borderBottom = tab === "login" ? "3px solid #C0392B" : "3px solid transparent";
    document.getElementById("tab-register").style.borderBottom = tab === "register" ? "3px solid #C0392B" : "3px solid transparent";
  };

  const inp = { width: "100%", padding: "12px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 16, fontFamily: "inherit", boxSizing: "border-box", display: "block", marginBottom: 16 };
  const lbl = { fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 };
  const sbtn = { width: "100%", padding: "14px", background: "#C0392B", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };

  return (
    <div style={{ minHeight: "100svh", background: "#F4F4F4", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "#C0392B", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontSize: 22, fontWeight: 900 }}>T</span>
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#111" }}>TransactPro</div>
            <div style={{ fontSize: 12, color: "#555" }}>Real Estate Transaction Management</div>
          </div>
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "0 4px 32px rgba(0,0,0,0.10)", overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid #CCC" }}>
          <button id="tab-login" onClick={() => showTab("login")} type="button" style={{ flex: 1, padding: 16, border: "none", background: "#fff", color: "#111", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", borderBottom: "3px solid #C0392B" }}>Sign In</button>
          <button id="tab-register" onClick={() => showTab("register")} type="button" style={{ flex: 1, padding: 16, border: "none", background: "#F4F4F4", color: "#555", fontWeight: 400, fontSize: 14, cursor: "pointer", fontFamily: "inherit", borderBottom: "3px solid transparent" }}>Create Account</button>
        </div>
        <div style={{ padding: 32 }}>
          <div id="login-form">
            <div id="login-error" style={{ color: "#C0392B", fontSize: 13, marginBottom: 12, minHeight: 20 }}></div>
            <form onSubmit={handleLogin}>
              <label style={lbl}>Email</label>
              <input name="email" type="email" autoComplete="email" required style={inp} placeholder="you@example.com" />
              <label style={lbl}>Password</label>
              <PwInput name="password" autoComplete="current-password" required inputStyle={inp} placeholder="Your password" />
              <button id="login-btn" type="submit" style={sbtn}>Sign In</button>
              <div style={{ textAlign: "center", marginTop: 12 }}>
                <button type="button" onClick={() => setShowForgot(true)}
                  style={{ background: "none", border: "none", color: "#0c4a6e", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
                  Forgot your password?
                </button>
              </div>
            </form>
            {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
          </div>
          <div id="register-form" style={{ display: "none" }}>
            <div id="reg-error" style={{ color: "#C0392B", fontSize: 13, marginBottom: 12, minHeight: 20 }}></div>
            <form onSubmit={handleRegister}>
              <label style={lbl}>Account Type</label>
              <select name="accountType" required style={inp}>
                <option value="solo">Solo Agent — Just me managing my transactions</option>
                <option value="brokerage">Brokerage — I manage a team of agents</option>
              </select>
              <label style={lbl}>Brokerage / Business Name</label>
              <input name="brokerageName" type="text" required style={inp} placeholder="ABC Realty or Your Name Realty" />
              <label style={lbl}>Your First Name</label>
              <input name="firstName" type="text" required style={inp} placeholder="Carlos" />
              <label style={lbl}>Your Last Name</label>
              <input name="lastName" type="text" required style={inp} placeholder="Garcia" />
              <label style={lbl}>Email</label>
              <input name="email" type="email" autoComplete="email" required style={inp} placeholder="you@youremail.com" />
              <label style={lbl}>Phone</label>
              <input name="phone" type="tel" style={inp} placeholder="407-555-0100" />
              <label style={lbl}>State</label>
              <select name="state" style={inp}>
                <option value="FL">Florida</option>
                <option value="TX">Texas</option>
                <option value="CA">California</option>
                <option value="NY">New York</option>
                <option value="GA">Georgia</option>
                <option value="NC">North Carolina</option>
                <option value="AZ">Arizona</option>
                <option value="CO">Colorado</option>
                <option value="WA">Washington</option>
                <option value="other">Other</option>
              </select>
              <label style={lbl}>Password</label>
              <PwInput name="password" autoComplete="new-password" required inputStyle={inp} placeholder="Min 8 characters" />
              <label style={lbl}>Confirm Password</label>
              <PwInput name="confirmPassword" autoComplete="new-password" required inputStyle={inp} placeholder="Repeat password" />
              <div style={{ background: "#F0FFF4", border: "1px solid #1E8449", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 12, color: "#1E8449" }}>
                14-day free trial. No credit card required.
              </div>
              <button id="reg-btn" type="submit" style={sbtn}>Start Free Trial</button>
            </form>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 24, fontSize: 12, color: "#555", textAlign: "center" }}>
        2026 TransactPro
        <span style={{ margin: "0 8px", color: "#bbb" }}>·</span>
        <a href="/terms" style={{ color: "#555", textDecoration: "underline" }}>Terms of Service</a>
        <span style={{ margin: "0 8px", color: "#bbb" }}>·</span>
        <a href="/privacy" style={{ color: "#555", textDecoration: "underline" }}>Privacy Policy</a>
      </div>
    </div>
  );
}
