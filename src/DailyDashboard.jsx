import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

const COLORS = {
  red: "#C0392B", darkRed: "#922B21", lightRed: "#FADBD8",
  black: "#111111", gray: "#555555", lightGray: "#F4F4F4",
  border: "#DDDDDD", success: "#1E8449", successBg: "#D5F5E3",
  warning: "#B7770D", warningBg: "#FEF9E7", white: "#FFFFFF",
};

const PRIORITY_CONFIG = {
  urgent: { color: COLORS.red, bg: COLORS.lightRed, label: "NOW" },
  high:   { color: COLORS.warning, bg: COLORS.warningBg, label: "TODAY" },
  normal: { color: COLORS.gray, bg: COLORS.lightGray, label: "UPCOMING" },
};

const TASK_ICONS = {
  seller_update:     "📋",
  buyer_update:      "📋",
  milestone_overdue: "🔴",
  milestone_upcoming:"🟡",
  setup_milestones:  "⚡",
  closing_prep:      "🏠",
};

// ── SELLER UPDATE MODAL ───────────────────────────────────────
function SellerUpdateModal({ task, token, onClose, onDone }) {
  const [showings, setShowings] = useState(0);
  const [interest, setInterest] = useState("medium");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(false);

  const interestLabels = { low: "moderate", medium: "good", high: "strong" };

  const previewText = () => {
    const showText = showings == 0 ? "focused on marketing your property across all platforms"
      : showings == 1 ? "had 1 showing this week with " + interestLabels[interest] + " buyer interest"
      : "had " + showings + " showings this week with " + interestLabels[interest] + " buyer interest";
    return "Hi [Seller],\n\nThis week we " + showText + "." +
      (note ? "\n\n" + note : "") +
      "\n\nYour property continues to be actively marketed. I will be in touch again soon.";
  };

  const handleSend = async () => {
    setSending(true);
    try {
      await fetch(API + "/seller-update/" + task.transaction_id, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ showingsCount: showings, interestLevel: interest, agentNote: note }),
      });
      onDone(task.id);
    } catch (e) { alert("Error sending update"); }
    setSending(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:1000, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:COLORS.white, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480, padding:24, paddingBottom:40 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:17 }}>Seller Weekly Update</div>
            <div style={{ color:COLORS.gray, fontSize:13, marginTop:2 }}>{task.address}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:COLORS.gray }}>✕</button>
        </div>

        {!preview ? (
          <>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:600, color:COLORS.gray, marginBottom:10 }}>SHOWINGS THIS WEEK</div>
              <div style={{ display:"flex", gap:8 }}>
                {[0,1,2,3,4,"5+"].map(n => (
                  <button key={n} onClick={() => setShowings(n)}
                    style={{ flex:1, padding:"10px 0", borderRadius:8, border:"2px solid",
                      borderColor: showings===n ? COLORS.red : COLORS.border,
                      background: showings===n ? COLORS.lightRed : COLORS.white,
                      color: showings===n ? COLORS.red : COLORS.black,
                      fontWeight:700, fontSize:14, cursor:"pointer" }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:600, color:COLORS.gray, marginBottom:10 }}>BUYER INTEREST LEVEL</div>
              <div style={{ display:"flex", gap:8 }}>
                {[["low","Low"],["medium","Good"],["high","Strong"]].map(([val,label]) => (
                  <button key={val} onClick={() => setInterest(val)}
                    style={{ flex:1, padding:"10px 0", borderRadius:8, border:"2px solid",
                      borderColor: interest===val ? COLORS.red : COLORS.border,
                      background: interest===val ? COLORS.lightRed : COLORS.white,
                      color: interest===val ? COLORS.red : COLORS.black,
                      fontWeight:700, fontSize:14, cursor:"pointer" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:13, fontWeight:600, color:COLORS.gray, marginBottom:8 }}>ONE THING TO SHARE <span style={{fontWeight:400}}>(optional)</span></div>
              <textarea value={note} onChange={e => setNote(e.target.value)}
                placeholder="e.g. Great feedback on the kitchen and backyard..."
                style={{ width:"100%", height:80, padding:12, borderRadius:10, border:"1.5px solid "+COLORS.border,
                  fontSize:14, fontFamily:"inherit", resize:"none", boxSizing:"border-box" }} />
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setPreview(true)}
                style={{ flex:1, padding:14, borderRadius:10, border:"2px solid "+COLORS.red,
                  background:COLORS.white, color:COLORS.red, fontWeight:700, fontSize:15, cursor:"pointer" }}>
                Preview Email
              </button>
              <button onClick={handleSend} disabled={sending}
                style={{ flex:1, padding:14, borderRadius:10, border:"none",
                  background:COLORS.red, color:COLORS.white, fontWeight:700, fontSize:15, cursor:"pointer" }}>
                {sending ? "Sending..." : "Send Now ✓"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ background:COLORS.lightGray, borderRadius:10, padding:16, marginBottom:20,
              fontSize:13, lineHeight:1.7, whiteSpace:"pre-wrap", color:COLORS.black }}>
              {previewText()}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setPreview(false)}
                style={{ flex:1, padding:14, borderRadius:10, border:"2px solid "+COLORS.border,
                  background:COLORS.white, color:COLORS.black, fontWeight:700, fontSize:15, cursor:"pointer" }}>
                ← Edit
              </button>
              <button onClick={handleSend} disabled={sending}
                style={{ flex:1, padding:14, borderRadius:10, border:"none",
                  background:COLORS.red, color:COLORS.white, fontWeight:700, fontSize:15, cursor:"pointer" }}>
                {sending ? "Sending..." : "Send to Seller ✓"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── TASK CARD ─────────────────────────────────────────────────
function TaskCard({ task, token, onResolve, onSnooze, onOpenModal, onStartChase }) {
  const cfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.normal;
  const icon = TASK_ICONS[task.task_type] || "📌";
  const isSellerUpdate = task.task_type === "seller_update";
  const isBuyerUpdate = task.task_type === "buyer_update";
  const isChaseable = ["milestone_overdue","milestone_upcoming","custom_task_overdue","custom_task_today","custom_task_upcoming"].includes(task.task_type);

  return (
    <div style={{ background:COLORS.white, borderRadius:14, padding:16, marginBottom:12,
      boxShadow:"0 1px 4px rgba(0,0,0,0.08)", borderLeft:"4px solid "+cfg.color }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
        <div style={{ fontSize:22, marginTop:2 }}>{icon}</div>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
            <span style={{ fontSize:10, fontWeight:700, color:cfg.color,
              background:cfg.bg, padding:"2px 8px", borderRadius:20 }}>
              {cfg.label}
            </span>
            {task.address && (
              <span style={{ fontSize:12, color:COLORS.gray, fontWeight:500 }}>{task.address}</span>
            )}
          </div>
          <div style={{ fontWeight:700, fontSize:15, color:COLORS.black, marginBottom:4 }}>{task.title}</div>
          {task.description && (
            <div style={{ fontSize:13, color:COLORS.gray, lineHeight:1.5 }}>{task.description}</div>
          )}
        </div>
      </div>

      <div style={{ display:"flex", gap:8, marginTop:14, flexWrap:"wrap" }}>
        {(isSellerUpdate || isBuyerUpdate) ? (
          <>
            <button onClick={() => onOpenModal(task)}
              style={{ flex:"2 1 60%", padding:"11px 0", borderRadius:10, border:"none",
                background:COLORS.red, color:COLORS.white, fontWeight:700, fontSize:14, cursor:"pointer" }}>
              Do It Now →
            </button>
            <button onClick={() => onResolve(task.id)}
              style={{ flex:"1 1 30%", padding:"11px 0", borderRadius:10,
                border:"1.5px solid "+COLORS.border, background:COLORS.white,
                color:COLORS.gray, fontWeight:600, fontSize:13, cursor:"pointer" }}>
              Already Sent
            </button>
          </>
        ) : isChaseable ? (
          <>
            <button onClick={() => onStartChase(task)}
              style={{ flex:"2 1 60%", padding:"11px 0", borderRadius:10, border:"none",
                background:COLORS.red, color:COLORS.white, fontWeight:700, fontSize:14, cursor:"pointer" }}>
              Follow Up Now
            </button>
            <button onClick={() => onResolve(task.id)}
              style={{ flex:"1 1 30%", padding:"11px 0", borderRadius:10,
                border:"1.5px solid #1E8449", background:COLORS.white,
                color:"#1E8449", fontWeight:600, fontSize:13, cursor:"pointer" }}>
              ✓ Done
            </button>
          </>
        ) : (
          <button onClick={() => onResolve(task.id)}
            style={{ flex:2, padding:"11px 0", borderRadius:10, border:"none",
              background:COLORS.red, color:COLORS.white, fontWeight:700, fontSize:14, cursor:"pointer" }}>
            Mark Done ✓
          </button>
        )}
        <button onClick={() => onSnooze(task.id)}
          style={{ flex:"1 1 100%", padding:"10px 0", borderRadius:10, marginTop:4,
            border:"1.5px solid "+COLORS.border, background:COLORS.white,
            color:COLORS.gray, fontWeight:600, fontSize:13, cursor:"pointer" }}>
          ⏰ Not Today
        </button>
      </div>
    </div>
  );
}

// ── SECTION HEADER ────────────────────────────────────────────
function SectionHeader({ label, count, color }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, marginTop:8 }}>
      <div style={{ fontWeight:800, fontSize:13, color, letterSpacing:0.5 }}>{label}</div>
      <div style={{ background:color, color:COLORS.white, borderRadius:20,
        fontSize:11, fontWeight:700, padding:"1px 8px" }}>{count}</div>
      <div style={{ flex:1, height:1, background:COLORS.border }} />
    </div>
  );
}

// ── EMPTY STATE ───────────────────────────────────────────────
function EmptyState({ firstName }) {
  return (
    <div style={{ textAlign:"center", padding:"48px 24px" }}>
      <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
      <div style={{ fontWeight:700, fontSize:20, color:COLORS.black, marginBottom:8 }}>
        You are all caught up{firstName ? ", " + firstName : ""}!
      </div>
      <div style={{ color:COLORS.gray, fontSize:15, lineHeight:1.6 }}>
        No tasks need your attention right now.{" "}
        Check back tomorrow morning for your next briefing.
      </div>
    </div>
  );
}

// ── MAIN DASHBOARD ────────────────────────────────────────────
export default function DailyDashboard({ token, user, onViewTransactions }) {
  const [tasks, setTasks] = useState({ overdue:[], dueToday:[], upcoming:[] });
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null);
  const [resolvedIds, setResolvedIds] = useState(new Set());

  const firstName = user?.firstName || "";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  useEffect(() => { fetchTasks(); }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(API + "/dashboard/tasks", {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await res.json();
      if (data.success) {
        setTasks({ overdue: data.overdue || [], dueToday: data.dueToday || [], upcoming: data.upcoming || [] });
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleResolve = async (taskId) => {
    try {
      await fetch(API + "/dashboard/tasks/" + taskId + "/resolve", {
        method: "PATCH", headers: { Authorization: "Bearer " + token }
      });
      setResolvedIds(prev => new Set([...prev, taskId]));
    } catch (e) {}
  };

  const handleSnooze = async (taskId) => {
    try {
      await fetch(API + "/dashboard/tasks/" + taskId + "/snooze", {
        method: "PATCH", headers: { Authorization: "Bearer " + token }
      });
      setResolvedIds(prev => new Set([...prev, taskId]));
    } catch (e) {}
  };

  const handleModalDone = (taskId) => {
    setResolvedIds(prev => new Set([...prev, taskId]));
    setActiveModal(null);
  };

  const [chaseTask, setChaseTask] = useState(null);
  const [chaseSubmitting, setChaseSubmitting] = useState(false);
  const [chaseCustomMsg, setChaseCustomMsg] = useState("");
  const [chasePreview, setChasePreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handleStartChase = async (task) => {
    setChaseCustomMsg("");
    setChasePreview(null);
    setChaseTask(task);
    setPreviewLoading(true);

    let targetType, targetId;
    if (task.task_type === "milestone_overdue" || task.task_type === "milestone_upcoming") {
      targetType = "milestone";
    } else {
      targetType = "task";
    }
    targetId = task.target_ref_id;

    if (!targetId) {
      setPreviewLoading(false);
      return;
    }

    try {
      const res = await fetch(API + "/chases/preview", {
        method: "POST",
        headers: { "Content-Type":"application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          transactionId: task.transaction_id,
          targetType, targetId
        })
      });
      const data = await res.json();
      if (data.success) setChasePreview(data);
      else setChasePreview({ error: data.error, availableParties: data.availableParties });
    } catch (e) {
      setChasePreview({ error: "Could not load preview" });
    }
    setPreviewLoading(false);
  };

  const submitChase = async () => {
    if (!chaseTask) return;
    setChaseSubmitting(true);
    // Determine target type and id from task_type
    let targetType, targetId;
    if (chaseTask.task_type === "milestone_overdue" || chaseTask.task_type === "milestone_upcoming") {
      targetType = "milestone";
      targetId = chaseTask.target_ref_id;
    } else {
      targetType = "task";
      targetId = chaseTask.target_ref_id;
    }
    if (!targetId) {
      alert("This task doesn't have a linked milestone/task yet. Regenerate tasks and try again.");
      setChaseSubmitting(false);
      return;
    }
    try {
      const res = await fetch(API + "/chases/start", {
        method: "POST",
        headers: { "Content-Type":"application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          transactionId: chaseTask.transaction_id,
          targetType,
          targetId,
          customMessage: chaseCustomMsg || null
        })
      });
      const data = await res.json();
      const persistResolve = async (taskId) => {
        try {
          await fetch(API + "/dashboard/tasks/" + taskId + "/resolve", {
            method: "PATCH", headers: { Authorization: "Bearer " + token }
          });
        } catch (e) {}
      };

      if (data.success) {
        await persistResolve(chaseTask.id);
        alert("Follow-up started! First reminder will be sent shortly to " + (data.party?.name || "the party") + ".");
        setChaseTask(null);
        setResolvedIds(prev => new Set([...prev, chaseTask.id]));
      } else if (data.error && data.error.includes("already active")) {
        await persistResolve(chaseTask.id);
        alert("A follow-up is already running for this item. It will keep going until the task is marked complete.");
        setChaseTask(null);
        setResolvedIds(prev => new Set([...prev, chaseTask.id]));
      } else {
        alert("Could not start follow-up: " + (data.error || "unknown error"));
      }
    } catch (e) {
      alert("Network error starting follow-up");
    }
    setChaseSubmitting(false);
  };

  const filterVisible = (arr) => arr.filter(t => !resolvedIds.has(t.id));

  const visibleOverdue  = filterVisible(tasks.overdue);
  const visibleToday    = filterVisible(tasks.dueToday);
  const visibleUpcoming = filterVisible(tasks.upcoming);
  const totalVisible    = visibleOverdue.length + visibleToday.length + visibleUpcoming.length;

  if (loading) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
        justifyContent:"center", height:300, gap:12 }}>
        <div style={{ width:36, height:36, border:"3px solid "+COLORS.lightRed,
          borderTop:"3px solid "+COLORS.red, borderRadius:"50%",
          animation:"spin 0.8s linear infinite" }} />
        <div style={{ color:COLORS.gray, fontSize:14 }}>Loading your day...</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"0 16px 100px" }}>

      {/* Morning Greeting */}
      <div style={{ padding:"24px 0 16px" }}>
        <div style={{ fontSize:22, fontWeight:800, color:COLORS.black }}>
          {greeting}{firstName ? ", " + firstName : ""}! ☀️
        </div>
        <div style={{ color:COLORS.gray, fontSize:14, marginTop:4 }}>
          {totalVisible === 0
            ? "You are all caught up today."
            : `You have ${totalVisible} thing${totalVisible === 1 ? "" : "s"} that need your attention.`}
        </div>
      </div>

      {totalVisible === 0 && <EmptyState firstName={firstName} />}

      {/* OVERDUE / URGENT */}
      {visibleOverdue.length > 0 && (
        <div>
          <SectionHeader label="NEEDS ATTENTION NOW" count={visibleOverdue.length} color={COLORS.red} />
          {visibleOverdue.map(task => (
            <TaskCard key={task.id} task={task} token={token}
              onResolve={handleResolve} onSnooze={handleSnooze}
              onOpenModal={setActiveModal} onStartChase={handleStartChase} />
          ))}
        </div>
      )}

      {/* DUE TODAY */}
      {visibleToday.length > 0 && (
        <div style={{ marginTop:8 }}>
          <SectionHeader label="DUE TODAY" count={visibleToday.length} color={COLORS.warning} />
          {visibleToday.map(task => (
            <TaskCard key={task.id} task={task} token={token}
              onResolve={handleResolve} onSnooze={handleSnooze}
              onOpenModal={setActiveModal} onStartChase={handleStartChase} />
          ))}
        </div>
      )}

      {/* COMING UP */}
      {visibleUpcoming.length > 0 && (
        <div style={{ marginTop:8 }}>
          <SectionHeader label="COMING UP THIS WEEK" count={visibleUpcoming.length} color={COLORS.gray} />
          {visibleUpcoming.map(task => (
            <TaskCard key={task.id} task={task} token={token}
              onResolve={handleResolve} onSnooze={handleSnooze}
              onOpenModal={setActiveModal} onStartChase={handleStartChase} />
          ))}
        </div>
      )}

      {/* View All Transactions */}
      <button onClick={onViewTransactions}
        style={{ width:"100%", marginTop:24, padding:16, borderRadius:12,
          border:"2px solid "+COLORS.border, background:COLORS.white,
          color:COLORS.black, fontWeight:700, fontSize:15, cursor:"pointer" }}>
        📋 View All My Transactions
      </button>

      {/* Seller Update Modal */}
      {activeModal && (
        <SellerUpdateModal
          task={activeModal}
          token={token}
          onClose={() => setActiveModal(null)}
          onDone={handleModalDone}
        />
      )}
    
      {chaseTask && (
        <div onClick={() => !chaseSubmitting && setChaseTask(null)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)",
            display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:COLORS.white, borderRadius:14, padding:20, maxWidth:420, width:"100%",
              maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ fontSize:18, fontWeight:800, marginBottom:6 }}>Start Follow-Up</div>
            <div style={{ fontSize:13, color:COLORS.gray, marginBottom:14 }}>
              {chaseTask.title}
            </div>

            {previewLoading && (
              <div style={{ padding:"24px 0", textAlign:"center", color:COLORS.gray, fontSize:13 }}>
                Loading preview...
              </div>
            )}

            {!previewLoading && chasePreview && chasePreview.error && (
              <div style={{ background:"#FEE2E2", color:"#991B1B", borderRadius:8, padding:12, marginBottom:14, fontSize:13 }}>
                {chasePreview.error}
              </div>
            )}

            {!previewLoading && chasePreview && chasePreview.success && (
              <>
                <div style={{ fontSize:11, fontWeight:700, color:COLORS.gray, marginBottom:6, letterSpacing:0.5 }}>
                  WILL CONTACT
                </div>
                <div style={{ background:"#F3F4F6", borderRadius:10, padding:12, marginBottom:14 }}>
                  <div style={{ fontWeight:700, fontSize:15, marginBottom:2 }}>👤 {chasePreview.party.name}</div>
                  <div style={{ fontSize:12, color:COLORS.gray, marginBottom:6 }}>{chasePreview.party.role}</div>
                  {chasePreview.party.email && <div style={{ fontSize:13, color:COLORS.black }}>📧 {chasePreview.party.email}</div>}
                  {chasePreview.party.phone && <div style={{ fontSize:13, color:COLORS.black }}>📱 {chasePreview.party.phone}</div>}
                </div>

                <div style={{ fontSize:11, fontWeight:700, color:COLORS.gray, marginBottom:6, letterSpacing:0.5 }}>
                  MESSAGE PREVIEW
                </div>
                <div style={{ background:"#FFFBEB", border:"1px solid #FCD34D", borderRadius:8, padding:12, marginBottom:14, fontSize:13, lineHeight:1.6, whiteSpace:"pre-wrap" }}>
                  {chaseCustomMsg || chasePreview.defaultMessage}
                </div>

                <div style={{ fontSize:11, fontWeight:700, color:COLORS.gray, marginBottom:6, letterSpacing:0.5 }}>
                  EDIT MESSAGE (OPTIONAL)
                </div>
                <textarea
                  value={chaseCustomMsg}
                  onChange={e => setChaseCustomMsg(e.target.value)}
                  placeholder="Leave blank to use the message above"
                  style={{ width:"100%", minHeight:70, padding:10, borderRadius:8,
                    border:"1.5px solid "+COLORS.border, fontSize:13, fontFamily:"inherit", boxSizing:"border-box", marginBottom:14 }}
                />

                <div style={{ fontSize:11, fontWeight:700, color:COLORS.gray, marginBottom:6, letterSpacing:0.5 }}>
                  FOLLOW-UP SCHEDULE
                </div>
                <div style={{ background:"#EFF6FF", borderRadius:8, padding:12, marginBottom:14, fontSize:12, lineHeight:1.7, color:"#1E3A8A" }}>
                  • First message: <strong>right now</strong> (SMS + email)<br/>
                  • 2nd reminder: in 48 hours<br/>
                  • 3rd reminder: 24 hours after that<br/>
                  • 4th & 5th: every 12 hours<br/>
                  • Stops automatically when marked complete<br/>
                  • You get alerted if they stop responding
                </div>
              </>
            )}

            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setChaseTask(null)} disabled={chaseSubmitting}
                style={{ flex:1, padding:"12px 0", borderRadius:10,
                  border:"1.5px solid "+COLORS.border, background:COLORS.white,
                  color:COLORS.gray, fontWeight:600, fontSize:14, cursor:"pointer" }}>
                Cancel
              </button>
              <button onClick={submitChase} disabled={chaseSubmitting || previewLoading || (chasePreview && chasePreview.error)}
                style={{ flex:2, padding:"12px 0", borderRadius:10, border:"none",
                  background:COLORS.red, color:COLORS.white, fontWeight:700, fontSize:14,
                  cursor: chaseSubmitting ? "wait" : "pointer", opacity: (chaseSubmitting || previewLoading || (chasePreview && chasePreview.error)) ? 0.5 : 1 }}>
                {chaseSubmitting ? "Sending..." : "Send & Start Follow-Up"}
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
  );
}
