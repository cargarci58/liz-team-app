import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";
const SHOW_KEY = "tp_calendar_show_v1";
// What the calendar can show; the agent picks (remembered on this device).
const SHOW_DEFAULT = { closing: true, open: false, deadline: true, task: true, mine: true };

export default function CalendarView({ transactions, onBack, onSelectTx }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);     // day number in the current month
  const [mode, setMode] = useState("month");                  // "month" | "day"
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [show, setShow] = useState(() => {
    try { return { ...SHOW_DEFAULT, ...(JSON.parse(localStorage.getItem(SHOW_KEY) || "{}") || {}) }; } catch { return SHOW_DEFAULT; }
  });
  const toggleShow = (k) => setShow(s => {
    const next = { ...s, [k]: !s[k] };
    try { localStorage.setItem(SHOW_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    return next;
  });

  // The agent's own general tasks ("Add a Task" / Win the Day) live on the
  // calendar too, and can be added right here (Carlos 9/30).
  const [myTasks, setMyTasks] = useState([]);
  const [deadlines, setDeadlines] = useState([]);           // open timeline steps across the deals
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const tok = () => localStorage.getItem("tp_token") || "";
  const loadMyTasks = () => fetch(API + "/personal-tasks", { headers: { Authorization: "Bearer " + tok() } })
    .then(r => r.ok ? r.json() : null)
    .then(d => setMyTasks(Array.isArray(d?.tasks) ? d.tasks : Array.isArray(d) ? d : []))
    .catch(() => {});
  const txIdsKey = (transactions || []).filter(t => t.status !== "Cancelled").map(t => t.id).join(",");
  useEffect(() => { window.scrollTo(0, 0); loadMyTasks(); }, []);
  useEffect(() => {
    const ids = txIdsKey ? txIdsKey.split(",") : [];
    if (!ids.length) { setDeadlines([]); return; }
    fetch(API + "/calendar/milestones", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok() },
      body: JSON.stringify({ transactionIds: ids }),
    }).then(r => r.ok ? r.json() : null)
      .then(d => setDeadlines(Array.isArray(d?.milestones) ? d.milestones : []))
      .catch(() => {});
  }, [txIdsKey]);

  const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const addTask = async (dateStr) => {
    const title = newTitle.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      const r = await fetch(API + "/personal-tasks", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok() },
        body: JSON.stringify({ title, due_date: dateStr || null }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not add the task.");
      setNewTitle(""); setAddOpen(false);
      if (!show.mine) toggleShow("mine");
      await loadMyTasks();
      try { window.dispatchEvent(new CustomEvent("wintheday:refresh")); } catch { /* ignore */ }
    } catch (e) { alert(e.message || "Could not add the task."); }
    setAdding(false);
  };
  const completeTask = async (id) => {
    try {
      await fetch(API + "/personal-tasks/" + id + "/complete", { method: "PATCH", headers: { Authorization: "Bearer " + tok() } });
      await loadMyTasks();
      try { window.dispatchEvent(new CustomEvent("wintheday:refresh")); } catch { /* ignore */ }
    } catch { alert("Could not mark that task done."); }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Printing uses the same events the calendar shows. Range: one day, the
  // month on screen, or the next 3 months; include = the same kinds as SHOW
  // (Carlos 9/30: "Print Options don't let you print just one day").
  const [printRange, setPrintRange] = useState("month");      // "day" | "month" | "3months"
  const [printInclude, setPrintInclude] = useState(null);     // null → copy SHOW when the dialog opens
  const openPrint = () => {
    setPrintInclude({ ...show });
    setPrintRange(mode === "day" && selectedDay ? "day" : "month");
    setShowPrintOptions(true);
  };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const handlePrint = () => {
    const inc = printInclude || show;
    const keys = Object.keys(allEvents).filter(k => {
      if (printRange === "day") return k === ymd(year, month, selectedDay || 1);
      const d = new Date(k + "T00:00:00");
      const mDiff = (d.getFullYear() - year) * 12 + (d.getMonth() - month);
      return printRange === "3months" ? mDiff >= 0 && mDiff < 3 : mDiff === 0;
    }).sort();
    const title = printRange === "day"
      ? new Date(year, month, selectedDay || 1).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : printRange === "3months"
      ? `${new Date(year, month, 1).toLocaleString("en-US", { month: "long" })} – ${new Date(year, month + 2, 1).toLocaleString("en-US", { month: "long", year: "numeric" })}`
      : monthName;
    const rows = [];
    for (const k of keys) {
      const list = (allEvents[k] || []).filter(ev => inc[ev.type]);
      if (!list.length) continue;
      const dateStr = new Date(k + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
      rows.push(`<tr><td colspan='4' style='background:#F4F4F4;font-weight:700;padding:8px'>${esc(dateStr)}</td></tr>`);
      for (const ev of list) {
        rows.push(`<tr><td style='white-space:nowrap'>${ev.time ? esc(fmtTime(ev.time)) : ""}</td><td style='color:${typeColors[ev.type].bg};font-weight:700;white-space:nowrap'>${esc(typeLabels[ev.type])}</td><td>${esc(ev.label)}</td><td>${esc(ev.address || ev.notes || "")}</td></tr>`);
      }
    }
    const body = rows.length ? rows.join("") : "<tr><td colspan='4' style='text-align:center;color:#888;padding:16px'>Nothing scheduled</td></tr>";
    const html = "<!DOCTYPE html><html><head><title>TransactPro Calendar</title><style>body{font-family:Arial,sans-serif;padding:20px}td,th{border:1px solid #DDD;padding:8px;font-size:12px;text-align:left}table{border-collapse:collapse;width:100%}</style></head><body>"
      + "<h1 style='margin:0 0 4px'>" + esc(title) + "</h1><p style='color:#666;margin:0 0 16px'>TransactPro calendar · printed " + esc(new Date().toLocaleDateString()) + "</p>"
      + "<table><tr style='background:#111;color:#fff'><th>Time</th><th>Type</th><th>What</th><th>Deal / notes</th></tr>" + body + "</table></body></html>";
    const printWindow = window.open("", "_blank");
    if (!printWindow) { alert("Your browser blocked the print window — allow pop-ups for this site and try again."); return; }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    setShowPrintOptions(false);
  };

  const monthName = currentDate.toLocaleString("en-US", { month: "long", year: "numeric" });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  today.setHours(0,0,0,0);

  // Build every event (allEvents, used for printing), then the kinds the agent
  // chose to show (events, used on screen).
  const allEvents = {};
  const addEvent = (dateStr, event) => {
    if (!dateStr) return;
    const key = String(dateStr).split("T")[0];
    if (!allEvents[key]) allEvents[key] = [];
    allEvents[key].push(event);
  };

  transactions.filter(tx => tx.status !== "Cancelled").forEach(tx => {
    if (tx.closingDate) addEvent(tx.closingDate, { type: "closing", label: tx.address, txId: tx.id, status: tx.status });
    if (tx.openDate) addEvent(tx.openDate, { type: "open", label: tx.address, txId: tx.id });
    (tx.tasks || []).filter(t => t.dueDate && t.status !== "Completed" && t.status !== "Waived").forEach(task => {
      addEvent(task.dueDate, { type: "task", label: task.name, address: tx.address, txId: tx.id });
    });
  });
  for (const m of deadlines) {
    addEvent(m.date, { type: "deadline", label: m.name, address: m.address, txId: m.txId, time: m.time, booked: m.booked });
  }
  for (const t of myTasks) {
    if (t && t.due_date && t.status !== "completed") addEvent(String(t.due_date), { type: "mine", label: t.title, taskId: t.id, notes: t.notes });
  }
  const undatedTasks = show.mine ? myTasks.filter(t => t && !t.due_date && t.status !== "completed") : [];
  const typeOrder = { closing: 0, deadline: 1, mine: 2, task: 3, open: 4 };
  for (const k of Object.keys(allEvents)) allEvents[k].sort((a, b) => (typeOrder[a.type] - typeOrder[b.type]) || String(a.time || "").localeCompare(String(b.time || "")));
  const events = {};
  for (const [k, list] of Object.entries(allEvents)) { const f = list.filter(ev => show[ev.type]); if (f.length) events[k] = f; }

  const typeColors = {
    closing: { bg: "#C0392B", text: "#fff", dot: "#C0392B" },
    deadline: { bg: "#922B21", text: "#fff", dot: "#922B21" },
    open: { bg: "#1A5276", text: "#fff", dot: "#1A5276" },
    task: { bg: "#B7860B", text: "#fff", dot: "#B7860B" },
    mine: { bg: "#0c4a6e", text: "#fff", dot: "#0c4a6e" },
  };

  const typeLabels = { closing: "🏠 Closing day", deadline: "⏰ Timeline deadline", mine: "📝 My task", task: "✅ Deal task due", open: "📋 Deal started" };

  const prevMonth = () => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDay(null); setMode("month"); };
  const nextMonth = () => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDay(null); setMode("month"); };
  const openDay = (day) => { setSelectedDay(day); setMode("day"); setNewTitle(""); window.scrollTo(0, 0); };
  const shiftDay = (delta) => {
    const d = new Date(year, month, (selectedDay || 1) + delta);
    setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedDay(d.getDate());
  };
  const goToday = () => { const t = new Date(); setCurrentDate(new Date(t.getFullYear(), t.getMonth(), 1)); openDay(t.getDate()); };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedKey = selectedDay ? ymd(year, month, selectedDay) : null;
  const selectedEvents = selectedKey ? (events[selectedKey] || []) : [];
  const fmtTime = (hhmm) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ""));
    if (!m) return null;
    const h = Number(m[1]); return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
  };

  const styles = {
    container: { minHeight: "100vh", background: "#F4F4F4", fontFamily: "system-ui, sans-serif" },
    header: { background: "#111", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
    nav: { background: "#fff", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #DDD", gap: 8 },
    grid: { display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 1, background: "#DDD" },
    dayHeader: { background: "#F8F9FA", padding: "8px 0", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase" },
    cell: (isToday, isSelected) => ({
      background: isSelected ? "#FEF2F2" : "#fff",
      minHeight: 90,
      minWidth: 0,
      overflow: "hidden",
      padding: 6,
      cursor: "pointer",
      border: isSelected ? "2px solid #C0392B" : isToday ? "2px solid #1A5276" : "none",
    }),
    dayNum: (isToday, isSelected) => ({
      fontSize: 13,
      fontWeight: isToday || isSelected ? 700 : 400,
      color: isToday ? "#1A5276" : isSelected ? "#C0392B" : "#111",
      marginBottom: 4,
    }),
    eventTag: (type) => ({
      fontSize: 10,
      padding: "2px 6px",
      borderRadius: 4,
      background: typeColors[type]?.bg || "#888",
      color: typeColors[type]?.text || "#fff",
      marginBottom: 2,
      display: "block",
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      cursor: "pointer",
    }),
    navBtn: { background: "none", border: "1px solid #DDD", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 18, fontFamily: "inherit" },
    smallBtn: { background: "#fff", border: "1px solid #DDD", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", color: "#111" },
  };

  const addRow = (dateKey, placeholder) => (
    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
      <input value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addTask(dateKey); }}
        placeholder={placeholder}
        style={{ flex: "1 1 240px", padding: "9px 12px", border: "1px solid #CCC", borderRadius: 8, fontSize: 14, fontFamily: "inherit" }} />
      <button onClick={() => addTask(dateKey)} disabled={adding || !newTitle.trim()}
        style={{ padding: "9px 16px", background: "#C0392B", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: adding || !newTitle.trim() ? 0.6 : 1 }}>{adding ? "Adding…" : "Add"}</button>
    </div>
  );

  const eventRow = (ev, i) => (
    <div key={i} onClick={() => ev.txId && onSelectTx(ev.txId)}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 8, background: "#F8F9FA", marginBottom: 8, cursor: ev.txId ? "pointer" : "default", border: "1px solid #EEE" }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: typeColors[ev.type]?.bg, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {ev.time ? <span style={{ color: "#922B21", marginRight: 6 }}>{fmtTime(ev.time)}</span> : null}
          {ev.label}
        </div>
        <div style={{ fontSize: 12, color: "#666" }}>
          {typeLabels[ev.type]}{ev.type === "deadline" ? (ev.booked ? " · appointment" : " · due") : ""}{ev.address ? ` · ${ev.address}` : ""}
        </div>
        {ev.notes && <div style={{ fontSize: 12, color: "#666" }}>{ev.notes}</div>}
      </div>
      {ev.type === "mine" && (
        <button onClick={e => { e.stopPropagation(); completeTask(ev.taskId); }}
          style={{ padding: "6px 12px", background: "#fff", border: "1px solid #CCC", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#1E8449", fontFamily: "inherit" }}>✓ Done</button>
      )}
      {ev.txId && <span style={{ fontSize: 12, color: "#0c4a6e", fontWeight: 700 }}>Open deal →</span>}
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={onBack} title="Back" style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>←</button>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>📅 Calendar</div>
        <button onClick={() => { setAddOpen(o => !o); if (!newDate) setNewDate(selectedDay ? ymd(year, month, selectedDay) : ymd(today.getFullYear(), today.getMonth(), today.getDate())); }}
          style={{ marginLeft: "auto", background: "#C0392B", border: "none", color: "#fff", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>➕ Add a task</button>
        <button onClick={openPrint} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>🖨️ Print Options</button>
      </div>

      {addOpen && (
        <div style={{ background: "#fff", borderBottom: "1px solid #DDD", padding: "12px 24px", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addTask(newDate); }}
            placeholder="What do you need to do? e.g. Call the appraiser"
            style={{ flex: "1 1 260px", padding: "10px 12px", border: "1px solid #CCC", borderRadius: 8, fontSize: 15, fontFamily: "inherit" }} />
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
            style={{ padding: "9px 10px", border: "1px solid #CCC", borderRadius: 8, fontSize: 15, fontFamily: "inherit" }} />
          <button onClick={() => addTask(newDate)} disabled={adding || !newTitle.trim()}
            style={{ padding: "10px 18px", background: "#C0392B", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: adding || !newTitle.trim() ? 0.6 : 1 }}>{adding ? "Adding…" : "Add"}</button>
          <button onClick={() => setAddOpen(false)} style={{ padding: "10px 14px", background: "none", border: "1px solid #CCC", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        </div>
      )}

      {/* Show: pick what the calendar displays (remembered on this device) */}
      <div style={{ background: "#fff", padding: "10px 24px", borderBottom: "1px solid #DDD", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#555", marginRight: 4 }}>SHOW:</span>
        {Object.entries(typeLabels).map(([type, label]) => (
          <label key={type} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", padding: "5px 10px", borderRadius: 20,
            border: `1px solid ${show[type] ? typeColors[type].bg : "#DDD"}`, background: show[type] ? "#fff" : "#F4F4F4", opacity: show[type] ? 1 : 0.6 }}>
            <input type="checkbox" checked={!!show[type]} onChange={() => toggleShow(type)} style={{ width: 15, height: 15, accentColor: typeColors[type].bg }} />
            <span style={{ width: 10, height: 10, borderRadius: 3, background: typeColors[type].bg }} />
            {label}
          </label>
        ))}
      </div>

      <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
        {mode === "month" && (
          <>
            {/* Month Nav */}
            <div style={styles.nav}>
              <button onClick={prevMonth} style={styles.navBtn}>‹</button>
              <div style={{ fontWeight: 700, fontSize: 20, color: "#111" }}>{monthName}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={goToday} style={styles.smallBtn}>Today</button>
                <button onClick={nextMonth} style={styles.navBtn}>›</button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#888", margin: "8px 4px 0" }}>💡 Tap any day to open the whole day</div>

            {/* Calendar Grid */}
            <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #DDD", marginTop: 8 }}>
              <div data-keep-grid="" style={styles.grid}>
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                  <div key={d} style={styles.dayHeader}>{d}</div>
                ))}
                {cells.map((day, i) => {
                  if (!day) return <div key={i} style={{ background: "#F8F9FA", minHeight: 90 }} />;
                  const key = ymd(year, month, day);
                  const dayEvents = events[key] || [];
                  const cellDate = new Date(year, month, day);
                  cellDate.setHours(0,0,0,0);
                  const isToday = cellDate.getTime() === today.getTime();
                  const isSelected = day === selectedDay;
                  return (
                    <div key={i} style={styles.cell(isToday, isSelected)} onClick={() => openDay(day)}>
                      <div style={styles.dayNum(isToday, isSelected)}>{day}</div>
                      {dayEvents.slice(0, 3).map((ev, j) => (
                        <span key={j} style={styles.eventTag(ev.type)}>
                          {ev.type === "mine" ? "📝 " : ev.type === "deadline" ? "⏰ " : ""}{ev.label}
                        </span>
                      ))}
                      {dayEvents.length > 3 && <span style={{ fontSize: 10, color: "#888" }}>+{dayEvents.length - 3} more</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {undatedTasks.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #DDD", padding: 20, marginTop: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color: "#111" }}>📝 My tasks with no date ({undatedTasks.length})</div>
                {undatedTasks.map(t => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "#F8F9FA", marginBottom: 6, border: "1px solid #EEE" }}>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{t.title}</div>
                    <button onClick={() => completeTask(t.id)} style={{ padding: "5px 10px", background: "#fff", border: "1px solid #CCC", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#1E8449", fontFamily: "inherit" }}>✓ Done</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* DAY VIEW — the whole day on its own page */}
        {mode === "day" && selectedDay && (
          <>
            <div style={styles.nav}>
              <button onClick={() => shiftDay(-1)} style={styles.navBtn} title="Previous day">‹</button>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 20, color: "#111" }}>
                  {new Date(year, month, selectedDay).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </div>
                <div style={{ fontSize: 12, color: "#888" }}>{selectedEvents.length} item{selectedEvents.length === 1 ? "" : "s"}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setMode("month")} style={styles.smallBtn}>📅 Month</button>
                <button onClick={() => shiftDay(1)} style={styles.navBtn} title="Next day">›</button>
              </div>
            </div>
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #DDD", padding: 20, marginTop: 12 }}>
              {selectedEvents.length === 0 && <div style={{ fontSize: 14, color: "#888", marginBottom: 10 }}>Nothing scheduled for this day{Object.values(show).some(v => !v) ? " (some kinds are hidden — see Show above)" : ""}.</div>}
              {selectedEvents.map(eventRow)}
              {addRow(selectedKey, "➕ Add a task for this day")}
            </div>
          </>
        )}
      </div>
      {showPrintOptions && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 400, boxShadow: "0 8px 40px rgba(0,0,0,0.2)", overflow: "hidden", fontFamily: "system-ui, sans-serif", margin: "auto" }}>
            <div style={{ background: "#111", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Print Options</div>
              <button onClick={() => setShowPrintOptions(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 20, cursor: "pointer" }}>x</button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 10 }}>What to print</div>
              {[
                ["day", selectedDay ? `One day — ${new Date(year, month, selectedDay).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}` : "One day (tap a day first)"],
                ["month", `This month — ${monthName}`],
                ["3months", "The next 3 months"],
              ].map(([key, label]) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, cursor: key === "day" && !selectedDay ? "not-allowed" : "pointer", fontSize: 15, opacity: key === "day" && !selectedDay ? 0.5 : 1 }}>
                  <input type="radio" name="printRange" disabled={key === "day" && !selectedDay} checked={printRange === key} onChange={() => setPrintRange(key)} style={{ width: 18, height: 18 }} />
                  {label}
                </label>
              ))}
              <div style={{ fontSize: 13, fontWeight: 700, color: "#555", textTransform: "uppercase", margin: "16px 0 10px" }}>Include</div>
              {Object.entries(typeLabels).map(([key, label]) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, cursor: "pointer", fontSize: 15 }}>
                  <input type="checkbox" checked={!!(printInclude || show)[key]} onChange={e => setPrintInclude(p => ({ ...(p || show), [key]: e.target.checked }))} style={{ width: 18, height: 18 }} />
                  {label}
                </label>
              ))}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
                <button onClick={() => setShowPrintOptions(false)} style={{ padding: "10px 18px", border: "1px solid #CCC", borderRadius: 8, background: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                <button onClick={handlePrint} style={{ padding: "10px 20px", background: "#C0392B", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Print Now</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
