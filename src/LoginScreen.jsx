const API = "https://liz-team-server-api-production.up.railway.app";

export default function LoginScreen({ onLogin }) {
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
      const res = await fetch(API + "/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brokerageName: f.brokerageName.value, firstName: f.firstName.value, lastName: f.lastName.value, email: f.email.value, phone: f.phone.value, password: f.password.value }) });
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
              <input name="password" type="password" autoComplete="current-password" required style={inp} placeholder="Your password" />
              <button id="login-btn" type="submit" style={sbtn}>Sign In</button>
            </form>
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
              <input name="password" type="password" autoComplete="new-password" required style={inp} placeholder="Min 8 characters" />
              <label style={lbl}>Confirm Password</label>
              <input name="confirmPassword" type="password" autoComplete="new-password" required style={inp} placeholder="Repeat password" />
              <div style={{ background: "#F0FFF4", border: "1px solid #1E8449", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 12, color: "#1E8449" }}>
                14-day free trial. No credit card required.
              </div>
              <button id="reg-btn" type="submit" style={sbtn}>Start Free Trial</button>
            </form>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 24, fontSize: 12, color: "#555" }}>2025 TransactPro</div>
    </div>
  );
}
