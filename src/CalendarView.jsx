import { useState } from "react";

export default function CalendarView({ transactions, onBack, onSelectTx }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [printOptions, setPrintOptions] = useState({ closings: true, openDates: false, tasks: true, allMonths: false });

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    const rows = [];
    const monthCount = printOptions.allMonths ? 3 : 1;
    for (let mo = 0; mo < monthCount; mo++) {
      const d = new Date(year, month + mo, 1);
      const mn = d.toLocaleString("en-US", { month: "long", year: "numeric" });
      rows.push("<h2 style='color:#C0392B;margin-top:20px'>" + mn + "</h2>");
      rows.push("<table border='1' cellpadding='8' cellspacing='0' width='100%' style='border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px'>");
      rows.push("<tr style='background:#111;color:#fff'><th>Date</th><th>Type</th><th>Property</th><th>Details</th></tr>");
      const allEvents = [];
      transactions.filter(tx => tx.status !== "Cancelled").forEach(tx => {
        if (printOptions.closings && tx.closingDate) {
          const cd = new Date(tx.closingDate.split("T")[0] + "T00:00:00");
          if (cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth()) allEvents.push({ date: tx.closingDate.split("T")[0], type: "Closing", property: tx.address, detail: tx.status, color: "#C0392B" });
        }
        if (printOptions.openDates && tx.openDate) {
          const od = new Date(tx.openDate.split("T")[0] + "T00:00:00");
          if (od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth()) allEvents.push({ date: tx.openDate.split("T")[0], type: "Open Date", property: tx.address, detail: tx.type, color: "#1A5276" });
        }
        if (printOptions.tasks) {
          (tx.tasks || []).filter(t => t.dueDate && t.status !== "Completed").forEach(task => {
            const td = new Date(task.dueDate.split("T")[0] + "T00:00:00");
            if (td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth()) allEvents.push({ date: task.dueDate.split("T")[0], type: "Task Due", property: tx.address, detail: task.name, color: "#B7860B" });
          });
        }
      });
      allEvents.sort((a, b) => a.date.localeCompare(b.date));
      if (allEvents.length === 0) {
        rows.push("<tr><td colspan='4' style='text-align:center;color:#888;padding:16px'>No events this month</td></tr>");
      } else {
        allEvents.forEach(ev => {
          const dateStr = new Date(ev.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          rows.push("<tr><td>" + dateStr + "</td><td style='color:" + ev.color + ";font-weight:700'>" + ev.type + "</td><td>" + ev.property + "</td><td>" + ev.detail + "</td></tr>");
        });
      }
      rows.push("</table>");
    }
    const html = "<!DOCTYPE html><html><head><title>TransactPro Calendar</title><style>body{font-family:Arial,sans-serif;padding:20px}@media print{button{display:none}}</style></head><body><h1>TransactPro Calendar Report</h1><p>Generated: " + new Date().toLocaleDateString() + "</p>" + rows.join("") + "</body></html>";
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
    setShowPrintOptions(false);
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString("en-US", { month: "long", year: "numeric" });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  today.setHours(0,0,0,0);

  // Build events map
  const events = {};
  const addEvent = (dateStr, event) => {
    if (!dateStr) return;
    const key = dateStr.split("T")[0];
    if (!events[key]) events[key] = [];
    events[key].push(event);
  };

  transactions.filter(tx => tx.status !== "Cancelled").forEach(tx => {
    if (tx.closingDate) addEvent(tx.closingDate, { type: "closing", label: tx.address, txId: tx.id, status: tx.status });
    if (tx.openDate) addEvent(tx.openDate, { type: "open", label: tx.address, txId: tx.id });
    (tx.tasks || []).filter(t => t.dueDate && t.status !== "Completed" && t.status !== "Waived").forEach(task => {
      addEvent(task.dueDate, { type: "task", label: task.name, address: tx.address, txId: tx.id });
    });
  });

  const typeColors = {
    closing: { bg: "#C0392B", text: "#fff", dot: "#C0392B" },
    open: { bg: "#1A5276", text: "#fff", dot: "#1A5276" },
    task: { bg: "#B7860B", text: "#fff", dot: "#B7860B" },
  };

  const typeLabels = { closing: "🏠 Closing", open: "📋 Open", task: "✅ Task" };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedKey = selectedDay ? `${year}-${String(month+1).padStart(2,"0")}-${String(selectedDay).padStart(2,"0")}` : null;
  const selectedEvents = selectedKey ? (events[selectedKey] || []) : [];

  const styles = {
    container: { minHeight: "100vh", background: "#F4F4F4", fontFamily: "system-ui, sans-serif" },
    header: { background: "#111", padding: "14px 24px", display: "flex", alignItems: "center", gap: 16 },
    nav: { background: "#fff", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #DDD" },
    grid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, background: "#DDD" },
    dayHeader: { background: "#F8F9FA", padding: "8px 0", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase" },
    cell: (isToday, isSelected, hasEvents) => ({
      background: isSelected ? "#FEF2F2" : "#fff",
      minHeight: 90,
      padding: 6,
      cursor: hasEvents ? "pointer" : "default",
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
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>←</button>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>📅 Calendar</div>
        <button onClick={() => setShowPrintOptions(true)} style={{ marginLeft: "auto", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>🖨️ Print Options</button>
      </div>

      {/* Legend */}
      <div style={{ background: "#fff", padding: "10px 24px", borderBottom: "1px solid #DDD", display: "flex", gap: 16 }}>
        {Object.entries(typeLabels).map(([type, label]) => (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: typeColors[type].bg }} />
            {label}
          </div>
        ))}
      </div>

      <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
        {/* Month Nav */}
        <div style={styles.nav}>
          <button onClick={prevMonth} style={{ background: "none", border: "1px solid #DDD", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 18 }}>‹</button>
          <div style={{ fontWeight: 700, fontSize: 20, color: "#111" }}>{monthName}</div>
          <button onClick={nextMonth} style={{ background: "none", border: "1px solid #DDD", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 18 }}>›</button>
        </div>

        {/* Calendar Grid */}
        <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #DDD", marginTop: 16 }}>
          <div style={styles.grid}>
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
              <div key={d} style={styles.dayHeader}>{d}</div>
            ))}
            {cells.map((day, i) => {
              if (!day) return <div key={i} style={{ background: "#F8F9FA", minHeight: 90 }} />;
              const key = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const dayEvents = events[key] || [];
              const cellDate = new Date(year, month, day);
              cellDate.setHours(0,0,0,0);
              const isToday = cellDate.getTime() === today.getTime();
              const isSelected = day === selectedDay;
              return (
                <div key={i} style={styles.cell(isToday, isSelected, dayEvents.length > 0)}
                  onClick={() => setSelectedDay(isSelected ? null : day)}>
                  <div style={styles.dayNum(isToday, isSelected)}>{day}</div>
                  {dayEvents.slice(0, 3).map((ev, j) => (
                    <span key={j} style={styles.eventTag(ev.type)}
                      onClick={e => { e.stopPropagation(); if (ev.txId) onSelectTx(ev.txId); }}>
                      {ev.label}
                    </span>
                  ))}
                  {dayEvents.length > 3 && <span style={{ fontSize: 10, color: "#888" }}>+{dayEvents.length - 3} more</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Detail */}
        {selectedDay && selectedEvents.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #DDD", padding: 20, marginTop: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12, color: "#111" }}>
              {new Date(year, month, selectedDay).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </div>
            {selectedEvents.map((ev, i) => (
              <div key={i} onClick={() => ev.txId && onSelectTx(ev.txId)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: "#F8F9FA", marginBottom: 8, cursor: ev.txId ? "pointer" : "default", border: "1px solid #EEE" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: typeColors[ev.type]?.bg, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{typeLabels[ev.type]} — {ev.label}</div>
                  {ev.address && <div style={{ fontSize: 11, color: "#666" }}>{ev.address}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showPrintOptions && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 400, boxShadow: "0 8px 40px rgba(0,0,0,0.2)", overflow: "hidden", fontFamily: "system-ui, sans-serif" }}>
            <div style={{ background: "#111", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Print Options</div>
              <button onClick={() => setShowPrintOptions(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 20, cursor: "pointer" }}>x</button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 12 }}>Include</div>
              {[["closings", "Closing Dates"], ["openDates", "Open Dates"], ["tasks", "Pending Task Deadlines"], ["allMonths", "Next 3 months (vs current month only)"]].map(([key, label]) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, cursor: "pointer", fontSize: 15 }}>
                  <input type="checkbox" checked={printOptions[key]} onChange={e => setPrintOptions(p => ({ ...p, [key]: e.target.checked }))} style={{ width: 18, height: 18 }} />
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
