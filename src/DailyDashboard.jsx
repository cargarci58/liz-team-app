import { useState, useEffect, useRef } from "react";
import { LogCallButton } from "./ContactsPage";

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
  lead_conversion:   "🌱",
  inbound_email_reply: "💬",
  chase_reply_received: "💬",
  chase_opt_out:     "⚠️",
  price_reduction:   "💰",
  buyer_followup:    "🔑",
  move_anniversary:  "🏡",
};

// Three ready-to-use scripts to walk a seller toward a price reduction. Shown
// inside the price_reduction Win-the-Day card. Brackets are the agent's to fill.
const PRICE_REDUCTION_SCRIPTS = [
  { title: "Let the market do the talking",
    body: "“When we listed, we priced on the best information we had at the time. Since then we’ve had [X showings] and [Y offers], and the homes that are selling around us are coming in lower. The market is giving us feedback — and right now it’s telling us we’re priced just ahead of where buyers are. A focused adjustment gets us back in line with what they’re actually paying.”" },
  { title: "The cost of waiting",
    body: "“Every month we hold out for the higher number, you’re still carrying the mortgage, taxes, insurance, and upkeep — and the longer a home sits, the more buyers assume something’s wrong with it. A meaningful reduction now usually nets you more than slowly chasing the market down over the next few months. Let’s get ahead of it instead of falling behind it.”" },
  { title: "Get back in front of buyers",
    body: "“Your listing already had its first big wave of attention, and that wave has passed. A strategic price drop puts you back at the top of buyers’ searches and triggers a fresh round of alerts. If we move from [$405,000] to [$399,000], we cross a search threshold and show up for a whole new set of buyers who never saw it before. Let’s create that second ‘just listed’ moment.”" },
];

// Buyer-side scripts for the buyer_followup card (buyer still searching).
const BUYER_FOLLOWUP_SCRIPTS = [
  { title: "Reset and re-focus the search",
    body: "“We’ve been at this a little while, so let’s tighten things up. Tell me the two or three things that truly can’t change — and what you’re open to flexing on. The more focused we are, the faster I can get you in front of the right home before someone else does.”" },
  { title: "Win the next one on terms",
    body: "“When we find it, I don’t want us to lose it over a soft offer. If we’re ready with strong financing, a solid deposit, and flexibility on the closing date, we look like the safest buyer — and that’s who sellers pick. Let’s have all of that lined up so we can move the same day.”" },
  { title: "Don’t let the right one pass",
    body: "“Good homes in your range aren’t sitting — they’re gone in days. I’d rather we move decisively on the right one and use the inspection period to protect you than hesitate and spend the next few months comparing everything to the one that got away. When it shows up, let’s write it.”" },
];

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
function PersonalTaskCard({ task, token, onChange }) {
  const API = "https://liz-team-server-api-production.up.railway.app";
  const [busy, setBusy] = useState(false);

  const complete = async () => {
    setBusy(true);
    try {
      await fetch(API + "/personal-tasks/" + task.id + "/complete", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token }
      });
      window.dispatchEvent(new Event("wintheday:refresh"));
      if (onChange) onChange();
    } catch (e) { alert("Error: " + e.message); }
    setBusy(false);
  };

  const del = async () => {
    if (!confirm("Delete this general task?")) return;
    setBusy(true);
    try {
      await fetch(API + "/personal-tasks/" + task.id, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
      });
      window.dispatchEvent(new Event("wintheday:refresh"));
      if (onChange) onChange();
    } catch (e) { alert("Error: " + e.message); }
    setBusy(false);
  };

  const today = new Date().toISOString().slice(0, 10);
  const overdue = task.due_date && task.due_date < today;

  return (
    <div style={{ background: "#fff", border: "1px solid #d1fae5", borderLeft: "4px solid #1E8449", borderRadius: 10, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1a2332", marginBottom: 4 }}>{task.title}</div>
          {task.notes && <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{task.notes}</div>}
          <div style={{ fontSize: 11, color: overdue ? "#b91c1c" : "#6b7280", fontWeight: overdue ? 600 : 400 }}>
            {overdue ? "⚠️ Overdue · " : ""}General task{task.due_date ? " · Due " + task.due_date : ""}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={complete} disabled={busy} style={{ flex: 2, padding: "7px 0", borderRadius: 6, border: "none", background: "#1E8449", color: "#fff", fontWeight: 600, fontSize: 13, cursor: busy ? "wait" : "pointer", fontFamily: "inherit" }}>
          ✓ Done
        </button>
        <button onClick={del} disabled={busy} style={{ flex: 1, padding: "7px 0", borderRadius: 6, border: "1px solid #fecaca", background: "#fff", color: "#b91c1c", fontWeight: 600, fontSize: 12, cursor: busy ? "wait" : "pointer", fontFamily: "inherit" }}>
          🗑 Delete
        </button>
      </div>
    </div>
  );
}

// Strip the bucket prefix ("Past due:", "Today:", "Tomorrow:", "In N days:") and
// the trailing " — <address>" from a task title — the deal card already shows the
// address in its header and each line shows its own NOW/TODAY/SOON pill.
function cleanItemTitle(title, address) {
  if (!title) return "";
  let s = String(title);
  if (address) {
    const i = s.lastIndexOf(" — " + address);
    if (i >= 0) s = s.slice(0, i);
  }
  s = s.replace(/\s+—\s+[^—]*$/, "");                       // any trailing " — tail"
  s = s.replace(/^\s*(past due|today|tomorrow|due today|in \d+ days?)\s*:\s*/i, "");
  return s.trim();
}

// One task line inside a deal's grouped card. No outer card chrome / address —
// the parent DealGroupCard supplies those. `bucket` carries the NOW/TODAY/SOON
// label + colors for this specific line.
function TaskItem({ task, bucket, token, onResolve, onComplete, onSnooze, onOpenModal, onStartChase, onOpenTransactionMilestones, onOpenInboundReply, onInboundReply, onReschedule }) {
  const cfg = bucket || PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.normal;
  const icon = TASK_ICONS[task.task_type] || "📌";
  const isSellerUpdate = task.task_type === "seller_update";
  const isBuyerUpdate = task.task_type === "buyer_update";
  const isChaseable = ["milestone_overdue","milestone_upcoming","custom_task_overdue","custom_task_today","custom_task_upcoming"].includes(task.task_type);
  const isComplianceGap = task.task_type === "compliance_gap";
  // Inbound email reply: a party wrote back. If the AI proposed a milestone
  // update, the description carries a "🤖 Suggestion:" line and we offer one-tap approve.
  const isInboundReply = task.task_type === "inbound_email_reply";
  const inboundHasSuggestion = isInboundReply && /🤖 Suggestion:/.test(task.description || "");
  // Undated checklist step: "Done" must COMPLETE the milestone (complete-target),
  // not just silence the reminder for 7 days — otherwise it never saves as done.
  const isChecklist = task.task_type === "milestone_checklist";
  // Scripts cards: listing price-reduction + buyer still-searching. Each carries
  // 3 ready-to-use scripts for the paying agent's side of the deal.
  const scriptSet = task.task_type === "price_reduction" ? PRICE_REDUCTION_SCRIPTS
    : task.task_type === "buyer_followup" ? BUYER_FOLLOWUP_SCRIPTS : null;
  const [showScripts, setShowScripts] = useState(false);
  // A milestone-backed line can be rescheduled right here when the date moves.
  const canReschedule = !!onReschedule && !!task.target_ref_id && /^milestone_/.test(task.task_type || "");
  const [reschedOpen, setReschedOpen] = useState(false);
  const [reschedDate, setReschedDate] = useState("");

  return (
    <div style={{ paddingTop:2 }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
        <div style={{ fontSize:20, marginTop:2 }}>{icon}</div>
        <div style={{ flex:1 }}>
          {cfg.label && (
            <div style={{ marginBottom:4 }}>
              <span style={{ fontSize:10, fontWeight:700, color:cfg.color,
                background:cfg.bg, padding:"2px 8px", borderRadius:20 }}>
                {cfg.label}
              </span>
            </div>
          )}
          <div style={{ fontWeight:700, fontSize:15, color:COLORS.black, marginBottom:4 }}>{cleanItemTitle(task.title, task.address)}</div>
          {task.description && (
            <div style={{ fontSize:13, color:COLORS.gray, lineHeight:1.5 }}>{task.description}</div>
          )}
          {scriptSet && (
            <div style={{ marginTop:10 }}>
              <button onClick={() => setShowScripts(s => !s)}
                style={{ background:"none", border:"none", padding:0, cursor:"pointer",
                  color:COLORS.red, fontWeight:700, fontSize:13, fontFamily:"inherit" }}>
                {showScripts ? "▼ Hide scripts" : "💬 View 3 scripts"}
              </button>
              {showScripts && (
                <div style={{ marginTop:10 }}>
                  <div style={{ fontSize:12, color:COLORS.gray, marginBottom:8 }}>Pick the angle that fits your client. Brackets are yours to fill in.</div>
                  {scriptSet.map((s, i) => (
                    <div key={i} style={{ background:COLORS.lightGray, borderRadius:8,
                      borderLeft:"3px solid "+COLORS.red, padding:"10px 12px", marginBottom:8 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:COLORS.darkRed, marginBottom:4 }}>Script {i + 1} · {s.title}</div>
                      <div style={{ fontSize:13, color:COLORS.black, lineHeight:1.55 }}>{s.body}</div>
                      <button onClick={() => { try { navigator.clipboard.writeText(s.body); } catch (e) {} }}
                        style={{ marginTop:8, background:COLORS.white, border:"1px solid "+COLORS.border,
                          borderRadius:6, padding:"4px 10px", fontSize:11, fontWeight:600, color:COLORS.gray,
                          cursor:"pointer", fontFamily:"inherit" }}>
                        📋 Copy
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
        ) : isComplianceGap ? (
          <>
            <button onClick={() => onOpenTransactionMilestones && onOpenTransactionMilestones(task.transaction_id)}
              style={{ flex:"2 1 100%", padding:"11px 0", borderRadius:10, border:"none",
                background:COLORS.red, color:COLORS.white, fontWeight:700, fontSize:14, cursor:"pointer" }}>
              📎 Open & Upload Document
            </button>
          </>
        ) : isChaseable ? (
          <>
            <button onClick={() => onStartChase(task)}
              style={{ flex:"2 1 60%", padding:"11px 0", borderRadius:10, border:"none",
                background:COLORS.red, color:COLORS.white, fontWeight:700, fontSize:14, cursor:"pointer" }}>
              Follow Up Now
            </button>
            <button onClick={() => onComplete(task)}
              style={{ flex:"1 1 30%", padding:"11px 0", borderRadius:10,
                border:"1.5px solid #1E8449", background:COLORS.white,
                color:"#1E8449", fontWeight:600, fontSize:13, cursor:"pointer" }}>
              ✓ Done
            </button>
          </>
        ) : isChecklist ? (
          <button onClick={() => onComplete(task)}
            style={{ flex:2, padding:"11px 0", borderRadius:10, border:"none",
              background:"#1E8449", color:COLORS.white, fontWeight:700, fontSize:14, cursor:"pointer" }}>
            ✓ Done
          </button>
        ) : isInboundReply ? (
          <>
            {inboundHasSuggestion && (
              <button onClick={() => onInboundReply(task, true)}
                style={{ flex:"2 1 60%", padding:"11px 0", borderRadius:10, border:"none",
                  background:"#1E8449", color:COLORS.white, fontWeight:700, fontSize:14, cursor:"pointer" }}>
                ✓ Approve &amp; Update
              </button>
            )}
            <button onClick={() => (onOpenInboundReply || onOpenTransactionMilestones) && (onOpenInboundReply || onOpenTransactionMilestones)(task.transaction_id)}
              style={{ flex: inboundHasSuggestion ? "1 1 30%" : "2 1 60%", padding:"11px 0", borderRadius:10,
                border:"none", background:COLORS.red, color:COLORS.white, fontWeight:700, fontSize:14, cursor:"pointer" }}>
              📂 Open
            </button>
            <button onClick={() => onInboundReply(task, false)}
              style={{ flex:"1 1 30%", padding:"11px 0", borderRadius:10,
                border:"1.5px solid "+COLORS.border, background:COLORS.white,
                color:COLORS.gray, fontWeight:600, fontSize:13, cursor:"pointer" }}>
              Got it
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
          style={{ flex: canReschedule ? "1 1 45%" : "1 1 100%", padding:"10px 0", borderRadius:10, marginTop:4,
            border:"1.5px solid "+COLORS.border, background:COLORS.white,
            color:COLORS.gray, fontWeight:600, fontSize:13, cursor:"pointer" }}>
          ⏰ Not Today
        </button>
        {canReschedule && (
          <button onClick={() => setReschedOpen(o => !o)}
            style={{ flex:"1 1 45%", padding:"10px 0", borderRadius:10, marginTop:4,
              border:"1.5px solid "+COLORS.border, background:COLORS.white,
              color:COLORS.gray, fontWeight:600, fontSize:13, cursor:"pointer" }}>
            📅 Reschedule
          </button>
        )}
      </div>
      {canReschedule && reschedOpen && (
        <div style={{ display:"flex", gap:8, marginTop:8, alignItems:"center", flexWrap:"wrap" }}>
          <input type="date" value={reschedDate} onChange={e => setReschedDate(e.target.value)}
            style={{ padding:"8px 10px", border:"1px solid "+COLORS.border, borderRadius:8, fontSize:14, fontFamily:"inherit" }} />
          <button disabled={!reschedDate} onClick={() => { onReschedule(task, reschedDate); setReschedOpen(false); }}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", background: reschedDate ? "#0F6E56" : COLORS.border, color:"#fff", fontWeight:700, fontSize:13, cursor: reschedDate ? "pointer" : "default", fontFamily:"inherit" }}>
            Set new date
          </button>
        </div>
      )}
    </div>
  );
}

// Urgency buckets by rank: 0 overdue, 1 today, 2 due-soon, 3 no date.
const BUCKETS = [
  { label:"NOW",    color:COLORS.red,     bg:COLORS.lightRed },
  { label:"TODAY",  color:COLORS.warning, bg:COLORS.warningBg },
  { label:"SOON",   color:COLORS.gray,    bg:COLORS.lightGray },
  { label:"",       color:COLORS.gray,    bg:COLORS.lightGray },
];

// ── DEAL GROUP CARD ───────────────────────────────────────────
// One card per TRANSACTION. All of that deal's items are grouped here as lines,
// most-urgent first — instead of scattering 3-5 separate cards across the page.
// The card's left bar + header badge reflect the single most-urgent item.
function DealGroupCard({ deal, token, onResolve, onComplete, onSnooze, onOpenModal, onStartChase, onOpenTransactionMilestones, onOpenInboundReply, onInboundReply, onOpenTransaction, onReschedule }) {
  const top = BUCKETS[deal.rank] || BUCKETS[3];
  return (
    <div style={{ background:COLORS.white, borderRadius:14, padding:16, marginBottom:12,
      boxShadow:"0 1px 4px rgba(0,0,0,0.08)", borderLeft:"4px solid "+top.color }}>
      {/* Deal header — address once, with the deal's most-urgent badge */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
        {top.label && (
          <span style={{ fontSize:10, fontWeight:800, color:COLORS.white,
            background:top.color, padding:"2px 8px", borderRadius:20 }}>{top.label}</span>
        )}
        <button onClick={() => onOpenTransaction && onOpenTransaction(deal.transaction_id)}
          style={{ flex:1, minWidth:0, textAlign:"left", background:"none", border:"none",
            padding:0, cursor:"pointer", fontFamily:"inherit",
            fontWeight:800, fontSize:15, color:COLORS.black, whiteSpace:"nowrap",
            overflow:"hidden", textOverflow:"ellipsis" }}>
          {deal.address || "This transaction"}
        </button>
        <span style={{ fontSize:11, color:COLORS.gray, fontWeight:600 }}>
          {deal.tasks.length} item{deal.tasks.length === 1 ? "" : "s"}
        </span>
      </div>
      {deal.tasks.map((task, i) => (
        <div key={task.id} style={{ marginTop: i === 0 ? 8 : 14,
          paddingTop: i === 0 ? 0 : 14, borderTop: i === 0 ? "none" : "1px solid "+COLORS.lightGray }}>
          <TaskItem task={task} bucket={BUCKETS[task._rank]} token={token}
            onResolve={onResolve} onComplete={onComplete} onSnooze={onSnooze}
            onOpenModal={onOpenModal} onStartChase={onStartChase}
            onOpenTransactionMilestones={onOpenTransactionMilestones}
            onOpenInboundReply={onOpenInboundReply} onInboundReply={onInboundReply}
            onReschedule={onReschedule} />
        </div>
      ))}
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
      <div style={{ color:COLORS.gray, fontSize:13, lineHeight:1.6, marginTop:14, maxWidth:440, marginLeft:"auto", marginRight:"auto" }}>
        📞 Tip: your <b>daily call list</b> shows up here too — it builds itself from your <b>Contacts</b>. Add people and set follow-ups (<b>⚙️ Menu → Contacts</b>) and the right ones appear each morning.
      </div>
    </div>
  );
}

// Pull ONE dialable number out of a phone field that may hold two numbers, an
// extension, or formatting — otherwise tel: gets a 14+ digit blob and won't dial.
function telHref(raw) {
  if (!raw) return "";
  const s = String(raw);
  // first phone-like run (stops at a delimiter such as "/" "," ";" "or")
  const m = s.match(/\+?\d[\d().\-\s]{6,}\d/);
  let cleaned = (m ? m[0] : s).replace(/[^\d+]/g, "");
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length > 11) { // two numbers ran together — keep the first
    const take = digits[0] === "1" ? 11 : 10;
    cleaned = (cleaned[0] === "+" ? "+" : "") + digits.slice(0, take);
  }
  return cleaned;
}

// ── MAIN DASHBOARD ────────────────────────────────────────────
export default function DailyDashboard({ token, user, onViewTransactions, onOpenTransactionMilestones, onOpenInboundReply, onOpenPopBys, coordinatorMode = false }) {
  const [tasks, setTasks] = useState({ overdue:[], dueToday:[], upcoming:[] });
  const [personal, setPersonal] = useState({ overdue:[], dueToday:[], upcoming:[] });
  const [callsDue, setCallsDue] = useState([]);
  const [occasions, setOccasions] = useState([]);
  const [popByDueCount, setPopByDueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null);
  const [resolvedIds, setResolvedIds] = useState(new Set());
  // Contacts the user has tapped "Call" on — the Log button only appears after.
  const [calledIds, setCalledIds] = useState(() => new Set());
  // tel: links only dial on mobile. On desktop the agent calls from their cell,
  // so we show the Log button directly instead of gating it behind "Call".
  const isMobile = typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const firstName = user?.firstName || "";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const regenTimer = useRef(null);

  useEffect(() => {
    fetchTasks();
    // Refreshes from returning to the tab (focus) or an in-app event must NOT
    // blank the screen. fetchTasks() with the full-screen "Loading your day…"
    // state unmounts the whole dashboard — including the "View All My
    // Transactions" button — for the length of the request. If the user taps a
    // button as they refocus the app, that first tap lands on the loading
    // screen and is lost ("had to click twice"). Refresh SILENTLY instead: the
    // content stays on screen and updates in place. Only the first mount load
    // shows the loading screen.
    const handler = () => fetchTasks({ silent: true });
    window.addEventListener("wintheday:refresh", handler);
    window.addEventListener("focus", handler);
    return () => {
      window.removeEventListener("wintheday:refresh", handler);
      window.removeEventListener("focus", handler);
      if (regenTimer.current) clearTimeout(regenTimer.current);
    };
  }, []);

  // awaitRebuild = the follow-up fetch: ask the server to WAIT for the in-flight
  // rebuild to finish before answering, so we get the complete list. It runs
  // silently (no spinner, current list stays on screen) and never chains another.
  const fetchTasks = async ({ awaitRebuild = false, silent: silentOpt = false } = {}) => {
    const silent = awaitRebuild || silentOpt;
    if (!silent) setLoading(true);
    try {
      const url = API + "/dashboard/tasks" + (awaitRebuild ? "?await=1" : "");
      const [tasksRes, callsRes] = await Promise.all([
        fetch(url, { headers: { Authorization: "Bearer " + token } }),
        fetch(API + "/contacts/due-today", { headers: { Authorization: "Bearer " + token } }).catch(() => null),
      ]);
      const data = await tasksRes.json();
      if (data.success) {
        setTasks({ overdue: data.overdue || [], dueToday: data.dueToday || [], upcoming: data.upcoming || [] });
        setPersonal({ overdue: (data.personal && data.personal.overdue) || [], dueToday: (data.personal && data.personal.dueToday) || [], upcoming: (data.personal && data.personal.upcoming) || [] });
      }
      if (callsRes && callsRes.ok) {
        const callsData = await callsRes.json();
        setCallsDue(callsData.calls || []);
        setOccasions(callsData.occasions || []);
        setPopByDueCount(callsData.popByDueCount || 0);
      }
      // A rebuild is running in the background — the list we just got is the
      // pre-rebuild one. Fire ONE follow-up that waits for it to finish, so the
      // complete list appears on its own. We only arm this from the initial
      // (non-awaiting) fetch, so it can't loop. Definitive fix for the recurring
      // "had to click twice / tasks missing" bug.
      if (data.regenerating && !awaitRebuild) {
        if (regenTimer.current) clearTimeout(regenTimer.current);
        regenTimer.current = setTimeout(() => fetchTasks({ awaitRebuild: true }), 150);
      }
    } catch (e) { console.error(e); }
    if (!silent) setLoading(false);
  };

  const handleResolve = async (taskId) => {
    try {
      await fetch(API + "/dashboard/tasks/" + taskId + "/resolve", {
        method: "PATCH", headers: { Authorization: "Bearer " + token }
      });
      setResolvedIds(prev => new Set([...prev, taskId]));
    } catch (e) {}
  };

  // "✓ Done" on a milestone/task card: actually complete the underlying
  // milestone/task (so it's gone for good), not just silence the reminder.
  const handleComplete = async (task) => {
    setResolvedIds(prev => new Set([...prev, task.id]));  // hide immediately
    try {
      await fetch(API + "/dashboard/tasks/" + task.id + "/complete-target", {
        method: "PATCH", headers: { Authorization: "Bearer " + token }
      });
      // Refresh so any downstream changes (compliance badge, progress) show.
      window.dispatchEvent(new Event("wintheday:refresh"));
    } catch (e) {}
  };

  // Reschedule a milestone-backed line right from Win-the-Day (the date moved).
  // Routes to /tc/* for a coordinator, /milestones/* for an agent.
  const handleReschedule = async (task, date) => {
    if (!task.target_ref_id || !date) return;
    const base = coordinatorMode ? API + "/tc/milestones/" : API + "/milestones/";
    try {
      const r = await fetch(base + task.target_ref_id + "/schedule", {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ date }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Couldn't reschedule");
      window.dispatchEvent(new Event("wintheday:refresh"));
      fetchTasks({ silent: true });
    } catch (e) { alert("Could not reschedule: " + e.message); }
  };

  const handleSnooze = async (taskId) => {
    try {
      await fetch(API + "/dashboard/tasks/" + taskId + "/snooze", {
        method: "PATCH", headers: { Authorization: "Bearer " + token }
      });
      setResolvedIds(prev => new Set([...prev, taskId]));
    } catch (e) {}
  };

  // Inbound email reply card: approve the AI-suggested milestone update (or just
  // dismiss it). target_ref_id is the inbound_emails row id.
  const handleInboundReply = async (task, approve) => {
    setResolvedIds(prev => new Set([...prev, task.id]));  // hide immediately
    try {
      if (task.target_ref_id) {
        await fetch(API + "/inbound-emails/" + task.target_ref_id + "/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ approve: !!approve }),
        });
      } else {
        await fetch(API + "/dashboard/tasks/" + task.id + "/resolve", {
          method: "PATCH", headers: { Authorization: "Bearer " + token }
        });
      }
      window.dispatchEvent(new Event("wintheday:refresh"));
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

  // ── GROUP BY TRANSACTION ──────────────────────────────────────
  // One card per deal (not one per item). Tag each task with its urgency rank
  // (0 overdue · 1 today · 2 due-soon · 3 no date), bucket by transaction, then
  // sort deals by their most-urgent item. Within a deal, lines are urgent-first.
  const rankedTasks = [
    ...visibleOverdue.map(t => ({ ...t, _rank: 0 })),
    ...visibleToday.map(t => ({ ...t, _rank: 1 })),
    ...visibleUpcoming.map(t => ({ ...t, _rank: t.due_date ? 2 : 3 })),
  ];
  // Group by PROPERTY ADDRESS (normalized) so two transaction records for the
  // same home collapse into ONE card — a safety net against duplicate deals.
  // Falls back to transaction_id, then task id, when there's no address.
  const normAddr = (a) => String(a || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const dealMap = new Map();
  for (const t of rankedTasks) {
    const key = (t.address && normAddr(t.address)) ? "addr:" + normAddr(t.address) : (t.transaction_id || t.id);
    let deal = dealMap.get(key);
    if (!deal) { deal = { transaction_id: t.transaction_id, address: t.address, tasks: [], rank: 9 }; dealMap.set(key, deal); }
    // If records got merged by address, keep a real transaction_id for the "open" action.
    if (!deal.transaction_id && t.transaction_id) deal.transaction_id = t.transaction_id;
    deal.tasks.push(t);
    if (t._rank < deal.rank) deal.rank = t._rank;
  }
  const dealGroups = Array.from(dealMap.values());
  for (const d of dealGroups) {
    d.tasks.sort((a, b) => a._rank - b._rank || (a.due_date || "9999").localeCompare(b.due_date || "9999"));
  }
  dealGroups.sort((a, b) => a.rank - b.rank ||
    (a.tasks[0]?.due_date || "9999").localeCompare(b.tasks[0]?.due_date || "9999") ||
    String(a.address || "").localeCompare(String(b.address || "")));

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
            ? (callsDue.length > 0 ? `${callsDue.length} call${callsDue.length === 1 ? "" : "s"} to make today.` : "You are all caught up today.")
            : `You have ${totalVisible} task${totalVisible === 1 ? "" : "s"}${callsDue.length > 0 ? ` and ${callsDue.length} call${callsDue.length === 1 ? "" : "s"}` : ""} that need your attention.`}
        </div>
      </div>

      {totalVisible === 0 && callsDue.length === 0 && <EmptyState firstName={firstName} />}

      {/* CALLS DUE TODAY (from CRM-lite) — a FIXED daily batch the agent can finish.
          Completed calls stay on the list with a ✓ and sink to the bottom; the list does
          NOT refill as you go, so "15 done" really means the day is won. */}
      {callsDue.length > 0 && (() => {
        const doneCalls = callsDue.filter(c => c.done).length;
        const totalCalls = callsDue.length;
        const allDone = doneCalls === totalCalls;
        return (
        <div style={{ marginBottom: 16 }}>
          <SectionHeader label={"📞 CALLS DUE TODAY"} count={`${doneCalls}/${totalCalls}`} color={"#0c4a6e"} />
          {/* progress bar */}
          <div style={{ height: 8, background: "#e5e7eb", borderRadius: 999, overflow: "hidden", margin: "0 0 8px" }}>
            <div style={{ height: "100%", width: `${totalCalls ? Math.round((doneCalls / totalCalls) * 100) : 0}%`, background: allDone ? "#15803d" : "#0c4a6e", transition: "width .3s" }} />
          </div>
          {allDone ? (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: 12, fontSize: 13, color: "#166534", marginBottom: 10, fontWeight: 700, textAlign: "center" }}>
              🎉 You won the day — all {totalCalls} call{totalCalls === 1 ? "" : "s"} done! Fresh list tomorrow.
            </div>
          ) : (
            <div style={{ background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8, padding: 10, fontSize: 11, color: "#1e3a8a", marginBottom: 10 }}>
              💡 Tap <b>Call</b> to dial — then log the outcome. {totalCalls - doneCalls} to go — finish these {totalCalls} and you're done for the day (no new calls added until tomorrow).
            </div>
          )}
          {callsDue.map(c => {
            const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.phone || "(no name)";
            const tempEmoji = { hot: "🔥", warm: "🌤", cold: "❄️", sphere: "👥", past: "🏡" }[c.temperature] || "•";
            const due = c.next_call_due_at ? new Date(c.next_call_due_at) : null;
            const overdue = due && due < new Date(new Date().setHours(0,0,0,0));
            if (c.done) {
              // Completed today — show as done, no action button, no replacement pulled in.
              return (
                <div key={c.id} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, opacity: 0.7 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#6b7280", textDecoration: "line-through" }}>
                      {tempEmoji} {name}
                      {c.tier && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, color: "#fff", background: "#9ca3af", borderRadius: 10, padding: "1px 7px" }}>{c.tier}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                      {c.last_outcome ? `logged: ${String(c.last_outcome).replace(/_/g, " ")}` : "logged"}
                    </div>
                  </div>
                  <span style={{ color: "#15803d", fontWeight: 800, fontSize: 13, whiteSpace: "nowrap", flexShrink: 0 }}>✓ Done</span>
                </div>
              );
            }
            return (
              <div key={c.id} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>
                    {tempEmoji} {name}
                    {c.tier && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, color: "#fff", background: "#0c4a6e", borderRadius: 10, padding: "1px 7px" }}>{c.tier}</span>}
                  </div>
                  {c.next_call_reason && (
                    <div style={{ fontSize: 12.5, color: "#0c4a6e", fontWeight: 700, marginTop: 3 }}>
                      🎯 {c.next_call_reason}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                    {c.phone || c.email || "no contact info"}
                    {c.last_outcome && <span style={{ marginLeft: 8 }}>· last: {String(c.last_outcome).replace(/_/g, " ")}</span>}
                    {overdue && <span style={{ color: "#b91c1c", marginLeft: 8, fontWeight: 600 }}>⚠️ Overdue</span>}
                  </div>
                  {c.notes && (
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      "{c.notes}"
                    </div>
                  )}
                </div>
                {isMobile && c.phone && !calledIds.has(c.id) ? (
                  // Mobile: let the tel: link dial first, THEN reveal Log (deferred
                  // so the state change doesn't unmount the link before it navigates).
                  <a href={`tel:${telHref(c.phone)}`} onClick={() => { setTimeout(() => setCalledIds(s => new Set(s).add(c.id)), 800); }}
                    style={{ background: "#15803d", color: "#fff", fontWeight: 700, fontSize: 13, padding: "9px 16px", borderRadius: 8, textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}>
                    📞 Call
                  </a>
                ) : (
                  // Desktop: log directly. Mobile after a call: auto-open the log
                  // dialog so the outcome screen pops up when they return.
                  <LogCallButton contact={c} token={token} onLogged={fetchTasks} compact autoOpen={isMobile && calledIds.has(c.id)} />
                )}
              </div>
            );
          })}
        </div>
        );
      })()}

      {/* BIRTHDAYS & ANNIVERSARIES (next 7 days) */}
      {occasions.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeader label={"🎂 BIRTHDAYS & ANNIVERSARIES THIS WEEK"} count={occasions.length} color={"#be185d"} />
          {occasions.map(o => {
            const name = [o.first_name, o.last_name].filter(Boolean).join(" ") || o.phone || "(no name)";
            const md = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
            const items = [];
            if (o.birthday) items.push("🎂 Birthday " + md(o.birthday));
            if (o.wedding_anniversary) items.push("💍 Anniversary " + md(o.wedding_anniversary));
            return (
              <div key={o.id} style={{ background: "white", border: "1px solid #fbcfe8", borderRadius: 8, padding: 12, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>
                    {name}
                    {o.tier && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, color: "#fff", background: "#0c4a6e", borderRadius: 10, padding: "1px 7px" }}>{o.tier}</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#be185d", fontWeight: 700, marginTop: 3 }}>{items.join("  ·  ")}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{o.phone
                    ? <a href={`tel:${telHref(o.phone)}`} onClick={e => e.stopPropagation()} style={{ color: "#0c4a6e", fontWeight: 700, textDecoration: "none" }}>📞 {o.phone}</a>
                    : (o.email || "")}</div>
                </div>
                <LogCallButton contact={o} token={token} onLogged={fetchTasks} compact />
              </div>
            );
          })}
        </div>
      )}

      {/* No calls today — explain where the daily call list comes from so it's
          discoverable (testers couldn't find it on a fresh account). Only when the
          agent has other activity; a fully-empty day shows EmptyState instead. */}
      {callsDue.length === 0 && totalVisible > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionHeader label={"📞 CALLS DUE TODAY"} count={"0"} color={"#0c4a6e"} />
          <div style={{ background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#1e3a8a" }}>
            No calls scheduled for today. Your daily call list builds itself from your <b>Contacts</b> — add people and set follow-ups (<b>⚙️ Menu → Contacts</b>) and the right ones appear here each morning.
          </div>
        </div>
      )}

      {/* POP-BYS DUE — single nudge tile linking to the Pop-Bys page */}
      {popByDueCount > 0 && (
        <div style={{ marginBottom: 24 }}>
          <button onClick={() => onOpenPopBys && onOpenPopBys()}
            style={{ width: "100%", textAlign: "left", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "14px 16px", cursor: "pointer", fontFamily: "inherit", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#92400e" }}>🎁 {popByDueCount} pop-by{popByDueCount === 1 ? "" : "s"} to deliver</div>
              <div style={{ fontSize: 12, color: "#b45309", marginTop: 2 }}>Plan your gift run — suggestions, route &amp; note cards →</div>
            </div>
            <span style={{ fontSize: 20, color: "#b45309" }}>→</span>
          </button>
        </div>
      )}

      {/* OVERDUE / URGENT */}
            {(personal.overdue.length > 0 || personal.dueToday.length > 0) && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeader label="📝 GENERAL TASKS DUE TODAY" count={personal.overdue.length + personal.dueToday.length} color="#1E8449" />
          {[...personal.overdue, ...personal.dueToday].map(t => (
            <PersonalTaskCard key={t.id} task={t} token={token} onChange={fetchTasks} />
          ))}
        </div>
      )}
      {personal.upcoming.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeader label="📝 GENERAL TASKS — UPCOMING & UNDATED" count={personal.upcoming.length} color="#1E8449" />
          {personal.upcoming.map(t => (
            <PersonalTaskCard key={t.id} task={t} token={token} onChange={fetchTasks} />
          ))}
        </div>
      )}
      {/* ONE CARD PER TRANSACTION — all of a deal's items grouped, urgent first */}
      {dealGroups.length > 0 && (
        <div>
          <SectionHeader label="WHAT NEEDS YOU TODAY" count={dealGroups.length} color={COLORS.red} />
          {dealGroups.map(deal => (
            <DealGroupCard key={deal.transaction_id || deal.tasks[0]?.id} deal={deal} token={token}
              onResolve={handleResolve} onComplete={handleComplete} onSnooze={handleSnooze}
              onOpenModal={setActiveModal} onStartChase={handleStartChase}
              onOpenTransaction={onOpenTransactionMilestones}
              onOpenTransactionMilestones={onOpenTransactionMilestones}
              onOpenInboundReply={onOpenInboundReply} onInboundReply={handleInboundReply}
              onReschedule={handleReschedule} />
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
            display:"flex", alignItems:"flex-start", justifyContent:"center", zIndex:1000, padding:16, overflowY:"auto" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:COLORS.white, borderRadius:14, padding:20, maxWidth:420, width:"100%",
              maxHeight:"90vh", overflowY:"auto", margin:"auto" }}>
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
