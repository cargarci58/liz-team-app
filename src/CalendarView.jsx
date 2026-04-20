export default function CalendarView({ transactions, onBack, onSelectTx }) {
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [selectedDay, setSelectedDay] = React.useState(null);

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
    </div>
  );
}
