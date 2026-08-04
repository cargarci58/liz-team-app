import { useState, useEffect, useRef } from "react";
import { LogCallButton } from "./ContactsPage";

// Whole days from today (ET) to a date: negative = overdue. ET on purpose —
// UTC comparisons flip a day after ~8pm Florida time.
const daysUntil = (d) => {
  if (!d) return null;
  const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const dd = String(d).split("T")[0];
  const n = Math.round((new Date(dd + "T00:00:00") - new Date(todayET + "T00:00:00")) / 86400000);
  return Number.isFinite(n) ? n : null;
};

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
  monthly_financials: "🧾",
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
  // Serves BOTH update cards: seller_update (showings + interest) and
  // buyer_update (homes toured; the server adds the deal's live
  // handled/coming-up digest). The buyer card used to open the seller
  // composer — Carlos caught it 2026-07-17.
  const isBuyer = task.task_type === "buyer_update";
  const [showings, setShowings] = useState(0);
  const [interest, setInterest] = useState("medium");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(false);

  const interestLabels = { low: "moderate", medium: "good", high: "strong" };

  const previewText = () => {
    if (isBuyer) {
      return "Hi [Buyer],\n\n" +
        (showings > 0 ? "This week we toured " + (showings == 1 ? "1 home" : showings + " homes") + " together.\n\n" : "") +
        (note ? note + "\n\n" : "") +
        "Handled for you recently + what's coming up next — pulled automatically from this deal's timeline.\n\n" +
        "I'm staying on top of every step and deadline — nothing is needed from you unless I reach out.";
    }
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
      await fetch(API + (isBuyer ? "/buyer-update/" : "/seller-update/") + task.transaction_id, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(isBuyer
          ? { homesShown: showings === "5+" ? 5 : showings, agentNote: note }
          : { showingsCount: showings, interestLevel: interest, agentNote: note }),
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
            <div style={{ fontWeight:700, fontSize:17 }}>{isBuyer ? "Buyer Weekly Update" : "Seller Weekly Update"}</div>
            <div style={{ color:COLORS.gray, fontSize:13, marginTop:2 }}>{task.address}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:COLORS.gray }}>✕</button>
        </div>

        {!preview ? (
          <>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:600, color:COLORS.gray, marginBottom:10 }}>{isBuyer ? "HOMES TOURED THIS WEEK (0 IS FINE)" : "SHOWINGS THIS WEEK"}</div>
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

            {!isBuyer && (
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
            )}

            {isBuyer && (
              <div style={{ background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:10, padding:"10px 12px", fontSize:12.5, color:"#0c4a6e", marginBottom:20 }}>
                ✨ The email automatically includes what you've handled recently and what's coming up next, straight from this deal's timeline.
              </div>
            )}

            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:13, fontWeight:600, color:COLORS.gray, marginBottom:8 }}>ONE THING TO SHARE <span style={{fontWeight:400}}>(optional)</span></div>
              <textarea value={note} onChange={e => setNote(e.target.value)}
                placeholder={isBuyer ? "e.g. The lender confirmed we're on track for closing..." : "e.g. Great feedback on the kitchen and backyard..."}
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
                {sending ? "Sending..." : (isBuyer ? "Send to Buyer ✓" : "Send to Seller ✓")}
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

  // Eastern (Florida) date, not UTC — otherwise in the evening a task due today
  // wrongly shows "Overdue" and one due tomorrow shows up under "due today".
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
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
function TaskItem({ task, bucket, token, onResolve, onComplete, onSnooze, onOpenModal, onStartChase, onOpenTransactionMilestones, onOpenInboundReply, onInboundReply, onReschedule, onActPreview, onUpdateSent }) {
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
  // REAL ACTION per card — sends the outreach the card is asking for, one tap.
  const actCfg = task.task_type === "compliance_gap" ? { label: "✉️ Request it" }
    : task.task_type === "price_reduction" ? { label: "✉️ Email seller" }
    : (/^milestone_/.test(task.task_type || "") || /^custom_task_/.test(task.task_type || "")) ? { label: "✉️ Send request" }
    : null;
  const [sent, setSent] = useState(null);
  // Compliance-gap: upload the missing document RIGHT HERE on the card (file
  // picker → server-proxied upload linked to the milestone) instead of dumping
  // the user on the deal page to hunt for an upload spot. target_ref_id is the
  // milestone id, so the server marks document_uploaded and the gap closes.
  const gapFileRef = useRef(null);
  const [gapBusy, setGapBusy] = useState(false);
  const onGapFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { alert("File too large (50MB max)"); return; }
    setGapBusy(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      const r = await fetch(API + "/documents/upload", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ transactionId: task.transaction_id, milestoneId: task.target_ref_id, fileName: file.name, fileType: file.type || "application/octet-stream", base64 }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Upload failed");
      alert("✅ Document uploaded and filed — gap closed.");
      onResolve(task.id);
    } catch (err) { alert("Upload failed: " + err.message); }
    setGapBusy(false);
  };
  // Approve-first: open the review modal (parent) instead of sending immediately.
  const doAct = () => {
    if (onActPreview) onActPreview(task, (res) => setSent({ to: res.to }));
  };

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
          {task.tc_handled && (
            <div style={{ display:"inline-block", marginBottom:6, fontSize:11, fontWeight:700, color:"#0F6E56", background:"#E7F5EF", border:"1px solid #BBE3D2", borderRadius:6, padding:"2px 8px" }}>
              🧭 Your TC is on this — flagged for your eyes
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
            <button onClick={() => (onUpdateSent ? onUpdateSent(task) : onResolve(task.id))}
              style={{ flex:"1 1 30%", padding:"11px 0", borderRadius:10,
                border:"1.5px solid "+COLORS.border, background:COLORS.white,
                color:COLORS.gray, fontWeight:600, fontSize:13, cursor:"pointer" }}>
              Already Sent
            </button>
          </>
        ) : isComplianceGap ? (
          <>
            <input ref={gapFileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.heic" style={{ display: "none" }} onChange={onGapFile} />
            <button disabled={gapBusy} onClick={() => gapFileRef.current && gapFileRef.current.click()}
              style={{ flex:"2 1 60%", padding:"11px 0", borderRadius:10, border:"none",
                background:COLORS.red, color:COLORS.white, fontWeight:700, fontSize:14, cursor: gapBusy ? "default" : "pointer", opacity: gapBusy ? 0.6 : 1 }}>
              {gapBusy ? "Uploading…" : "📎 Upload It Here"}
            </button>
            <button onClick={() => onOpenTransactionMilestones && onOpenTransactionMilestones(task.transaction_id)}
              style={{ flex:"1 1 30%", padding:"11px 0", borderRadius:10,
                border:"1.5px solid "+COLORS.border, background:COLORS.white,
                color:COLORS.gray, fontWeight:600, fontSize:13, cursor:"pointer" }}>
              Open deal →
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
            📅 {task.task_type === "milestone_checklist" ? "Set date" : "Reschedule"}
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
      {/* REAL ACTION row — take care of the task without leaving the screen. */}
      {actCfg && (
        <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap", alignItems:"center" }}>
          {!sent && (
            <button onClick={doAct}
              style={{ padding:"9px 16px", borderRadius:10, border:"none",
                background:"#0F6E56", color:COLORS.white, fontWeight:700, fontSize:13,
                cursor: "pointer", fontFamily:"inherit" }}>
              {actCfg.label}
            </button>
          )}
          {sent && <span style={{ fontSize:13, color:"#1E8449", fontWeight:700 }}>✓ Sent to {sent.to || "the right party"}</span>}
          {task.task_type !== "compliance_gap" && task.transaction_id && (
            <button onClick={() => onOpenTransactionMilestones && onOpenTransactionMilestones(task.transaction_id)}
              style={{ padding:"9px 16px", borderRadius:10, border:"1.5px solid "+COLORS.border,
                background:COLORS.white, color:COLORS.gray, fontWeight:600, fontSize:13,
                cursor:"pointer", fontFamily:"inherit" }}>
              Open deal →
            </button>
          )}
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

// Short plain-English label for a TC activity-log action (agent's TC section).
const tcVerb = (a) => ({
  document_requested: "requested a document",
  coordinator_message: "emailed a party",
  coordinator_autopilot: "sent reminders",
  milestone_completed: "completed a step",
  milestone_reopened: "reopened a step",
  document_uploaded: "uploaded a document",
  party_added: "added a party",
  party_updated: "updated a party",
}[a] || "took an action");

// ── DEAL GROUP CARD ───────────────────────────────────────────
// One card per TRANSACTION. All of that deal's items are grouped here as lines,
// most-urgent first — instead of scattering 3-5 separate cards across the page.
// The card's left bar + header badge reflect the single most-urgent item.
function DealGroupCard({ deal, token, coordinatorMode = false, meta = null, agentTc = null, onSendAiDraft, aiBusy, onDealAction, onActPreview, onResolve, onComplete, onSnooze, onOpenModal, onStartChase, onOpenTransactionMilestones, onOpenInboundReply, onInboundReply, onOpenTransaction, onReschedule, onUpdateSent }) {
  const top = BUCKETS[deal.rank] || BUCKETS[3];
  // Coordinator card accent reflects the AI health read when we have one.
  const healthColor = meta && meta.health === "red" ? "#DC2626" : meta && meta.health === "yellow" ? "#D97706" : meta && meta.health === "green" ? "#16A34A" : null;
  // Agent card with a TC: accent by the TC's health read.
  const tcHealthColor = agentTc && agentTc.health === "red" ? "#DC2626" : agentTc && agentTc.health === "yellow" ? "#D97706" : agentTc && agentTc.health === "green" ? "#16A34A" : null;
  const accent = (coordinatorMode && healthColor) || (!coordinatorMode && tcHealthColor) || top.color;
  // A plain-English history line so the TC knows where the deal stands at a glance.
  const historyBits = [];
  if (meta) {
    if (meta.status) historyBits.push(meta.status);
    if (meta.msTotal) historyBits.push(`${meta.msDone}/${meta.msTotal} steps done`);
    if (meta.daysSinceActivity != null) historyBits.push(meta.daysSinceActivity === 0 ? "active today" : `last activity ${meta.daysSinceActivity}d ago`);
    if (meta.closingDate) historyBits.push(`closing ${meta.closingDate}`);
  }
  return (
    <div style={{ background:COLORS.white, borderRadius:14, padding:16, marginBottom:12,
      boxShadow:"0 1px 4px rgba(0,0,0,0.08)", borderLeft:"4px solid "+accent }}>
      {/* Deal header — address once, with the deal's most-urgent badge */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
        {coordinatorMode && healthColor && (
          <span title={meta.health + " — AI health read"} style={{ width:11, height:11, borderRadius:"50%", background:healthColor, flexShrink:0 }} />
        )}
        {!coordinatorMode && top.label && (
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
      {/* COORDINATOR: history + the AI's read & recommended move, in one place */}
      {coordinatorMode && meta && (
        <div style={{ marginBottom:10 }}>
          {historyBits.length > 0 && (
            <div style={{ fontSize:12, color:COLORS.gray }}>{historyBits.join(" · ")}</div>
          )}
          {meta.reason && (
            <div style={{ fontSize:13, color:COLORS.black, fontWeight:600, marginTop:3 }}>⚠️ {meta.reason}</div>
          )}
          {meta.aiMove && (
            <div style={{ fontSize:12.5, color:"#1E40AF", marginTop:3 }}>🤖 Next: {meta.aiMove}</div>
          )}
          {meta.hasDraft && (
            <button disabled={aiBusy === deal.transaction_id} onClick={() => onSendAiDraft && onSendAiDraft(deal.transaction_id)}
              style={{ marginTop:8, padding:"8px 14px", borderRadius:8, border:"none",
                background:"#0F6E56", color:COLORS.white, fontWeight:700, fontSize:13,
                cursor: aiBusy === deal.transaction_id ? "wait" : "pointer", fontFamily:"inherit" }}>
              {aiBusy === deal.transaction_id ? "Sending…" : `✉️ Send the recommended message to the ${meta.draftToRole}`}
            </button>
          )}
        </div>
      )}
      {deal.tasks.map((task, i) => (
        <div key={task.id} style={{ marginTop: i === 0 ? 8 : 14,
          paddingTop: i === 0 ? 0 : 14, borderTop: i === 0 ? "none" : "1px solid "+COLORS.lightGray }}>
          <TaskItem task={task} bucket={BUCKETS[task._rank]} token={token}
            onResolve={onResolve} onComplete={onComplete} onSnooze={onSnooze}
            onOpenModal={onOpenModal} onStartChase={onStartChase}
            onOpenTransactionMilestones={onOpenTransactionMilestones}
            onOpenInboundReply={onOpenInboundReply} onInboundReply={onInboundReply}
            onReschedule={onReschedule} onActPreview={onActPreview} onUpdateSent={onUpdateSent} />
        </div>
      ))}
      {/* Header-only coordinator card (flagged deal whose item cards haven't
          regenerated yet) — give it deal-level actions so it's still workable. */}
      {coordinatorMode && deal._ccOnly && meta && (
        <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
          {meta.docGaps > 0 && (
            <button disabled={aiBusy === deal.transaction_id} onClick={() => onDealAction && onDealAction(deal.transaction_id, "doc")}
              style={{ padding:"9px 14px", borderRadius:10, border:"none", background:"#0F6E56", color:COLORS.white, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
              {aiBusy === deal.transaction_id ? "…" : "✉️ Request document"}
            </button>
          )}
          {(meta.overdue > 0 || meta.dueNext7 > 0) && !meta.hasDraft && (
            <button disabled={aiBusy === deal.transaction_id} onClick={() => onDealAction && onDealAction(deal.transaction_id, "remind")}
              style={{ padding:"9px 14px", borderRadius:10, border:"none", background:"#0F6E56", color:COLORS.white, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
              {aiBusy === deal.transaction_id ? "…" : "Send reminder"}
            </button>
          )}
          {meta.unreadReplies > 0 && (
            <button onClick={() => onDealAction && onDealAction(deal.transaction_id, "replies")}
              style={{ padding:"9px 14px", borderRadius:10, border:"1.5px solid "+COLORS.border, background:COLORS.white, color:COLORS.gray, fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
              Read &amp; reply
            </button>
          )}
          <button onClick={() => onOpenTransaction && onOpenTransaction(deal.transaction_id)}
            style={{ padding:"9px 14px", borderRadius:10, border:"1.5px solid "+COLORS.border, background:COLORS.white, color:COLORS.gray, fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
            Open deal →
          </button>
        </div>
      )}

      {/* AGENT view: what the TC is taking care of on THIS deal — folded into the
          same card so the agent sees their part + the TC's part in one place. */}
      {!coordinatorMode && agentTc && (
        <div style={{ marginTop: deal.tasks.length ? 12 : 2, paddingTop: 12, borderTop: "1px solid "+COLORS.lightGray }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:6 }}>
            <span style={{ fontSize:13, fontWeight:800, color:"#0F6E56" }}>🧭 Your TC{agentTc.coordinatorName ? " · " + agentTc.coordinatorName : ""} is handling this</span>
            {agentTc.msTotal > 0 && <span style={{ marginLeft:"auto", fontSize:12, color:COLORS.gray }}>{agentTc.msDone}/{agentTc.msTotal} done</span>}
          </div>
          {deal._tcOnly && (
            <div style={{ fontSize:13, color:"#1E8449", fontWeight:600, marginBottom:6 }}>✓ Nothing needs you here right now — your TC is on it.</div>
          )}
          {agentTc.overdue > 0 && (
            <div style={{ fontSize:12.5, color:"#B91C1C", fontWeight:700, marginBottom:4 }}>⚠️ {agentTc.overdue} overdue — your TC is working it</div>
          )}
          {agentTc.upcoming && agentTc.upcoming.length > 0 && (
            <div style={{ fontSize:12.5, color:COLORS.gray, marginBottom:4 }}>
              <b style={{ color:COLORS.black }}>TC's next steps:</b> {agentTc.upcoming.map(u => u.name + (u.dueDate ? " (" + u.dueDate + ")" : "")).join(" · ")}
            </div>
          )}
          {agentTc.recentTc && agentTc.recentTc.length > 0 ? (
            <div style={{ fontSize:12.5, color:COLORS.gray }}>
              <b style={{ color:COLORS.black }}>TC recently:</b> {agentTc.recentTc.map(a => tcVerb(a.action)).join(" · ")}
            </div>
          ) : (
            <div style={{ fontSize:12, color:COLORS.gray }}>No TC activity logged yet.</div>
          )}
          <button onClick={() => onOpenTransaction && onOpenTransaction(deal.transaction_id)}
            style={{ marginTop:8, padding:"7px 12px", borderRadius:8, border:"1.5px solid "+COLORS.border, background:COLORS.white, color:COLORS.gray, fontWeight:600, fontSize:12.5, cursor:"pointer", fontFamily:"inherit" }}>
            See full coordinator detail →
          </button>
        </div>
      )}
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

// ── UNMATCHED MAIL ────────────────────────────────────────────
// Emails captured by the agent's inbox forwarding rule (or sent to the parse
// domain) that couldn't be safely filed to a deal. The agent files each one to
// the right deal in one tap, or dismisses it (newsletter/spam). Renders nothing
// when the inbox is empty — most days it should be invisible.
function UnmatchedMailPanel({ token }) {
  const [items, setItems] = useState([]);
  const [dealList, setDealList] = useState(null);
  const [assignFor, setAssignFor] = useState(null);
  const [busy, setBusy] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch(API + "/inbound-emails/unmatched", { headers: { Authorization: "Bearer " + token } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (alive && d) setItems(Array.isArray(d.messages) ? d.messages : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [token]);
  const openAssign = (id) => {
    setAssignFor(id);
    if (dealList === null) {
      fetch(API + "/transactions", { headers: { Authorization: "Bearer " + token } })
        .then(r => r.json())
        .then(d => setDealList((d.transactions || d || []).map(t => ({ id: t.id, address: t.address }))))
        .catch(() => setDealList([]));
    }
  };
  const assign = async (id, transactionId) => {
    setBusy(id);
    try {
      const r = await fetch(API + "/inbound-emails/" + id + "/reassign", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ transactionId }),
      });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Failed");
      setItems(prev => prev.filter(x => x.id !== id)); setAssignFor(null);
    } catch (e) { alert("Could not file it: " + e.message); }
    setBusy(null);
  };
  const dismiss = async (id) => {
    setBusy(id);
    try {
      const r = await fetch(API + "/inbound-emails/" + id + "/dismiss", {
        method: "POST", headers: { Authorization: "Bearer " + token },
      });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Failed");
      setItems(prev => prev.filter(x => x.id !== id));
    } catch (e) { alert("Could not dismiss it: " + e.message); }
    setBusy(null);
  };
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <SectionHeader label={"📥 MAIL TO FILE"} count={items.length} color={"#92400E"} />
      <div style={{ fontSize: 12.5, color: COLORS.gray, margin: "0 0 8px" }}>
        These emails reached the app but we weren't sure which deal they belong to. File each one so nothing is lost.
      </div>
      {items.map(m => (
        <div key={m.id} style={{ background: COLORS.white, border: "1px solid " + COLORS.lightGray, borderRadius: 12, padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
            <span style={{ fontWeight: 700, color: COLORS.black, fontSize: 14 }}>{m.from_name || m.from_email || "Unknown sender"}</span>
            <span style={{ fontSize: 12, color: COLORS.gray }}>{m.created_at ? new Date(m.created_at).toLocaleDateString() : ""}</span>
          </div>
          {m.from_name && m.from_email && <div style={{ fontSize: 12, color: COLORS.gray }}>{m.from_email}</div>}
          {m.subject && <div style={{ fontWeight: 600, fontSize: 13.5, color: COLORS.black, marginTop: 6 }}>{m.subject}</div>}
          {(m.snippet || m.body_text) && <div style={{ fontSize: 13, color: COLORS.gray, marginTop: 4, whiteSpace: "pre-wrap" }}>{String(m.snippet || m.body_text).slice(0, 200)}</div>}
          {m.attachment_count > 0 && <div style={{ fontSize: 12, color: COLORS.gray, marginTop: 4 }}>📎 {m.attachment_count} attachment(s) — they follow the email to whichever deal you file it on.</div>}
          {/* Mail-provider forwarding confirmation: this is the one-time approval
              step that actually switches the agent's inbox forwarding ON. */}
          {m.forwarding ? (
            <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: 12, marginTop: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#166534", marginBottom: 4 }}>✅ Turn on email forwarding</div>
              <div style={{ fontSize: 12.5, color: "#166534", lineHeight: 1.5, marginBottom: 8 }}>
                This confirms the forwarding rule you set up in {m.forwarding.provider === "gmail" ? "Gmail" : "Outlook"}. Until you approve it, none of your deal email forwards into the app. Approve it once and you're done.
              </div>
              {m.forwarding.link && (
                <a href={m.forwarding.link} target="_blank" rel="noreferrer"
                  style={{ display: "inline-block", padding: "9px 16px", borderRadius: 8, background: "#166534", color: COLORS.white, fontWeight: 700, fontSize: 13, textDecoration: "none", marginBottom: m.forwarding.code ? 8 : 0 }}>
                  Confirm forwarding →
                </a>
              )}
              {m.forwarding.code && (
                <div style={{ fontSize: 12.5, color: "#166534" }}>
                  {m.forwarding.link ? "…or enter" : "Enter"} this confirmation code in {m.forwarding.provider === "gmail" ? "Gmail → Settings → Forwarding" : "Outlook forwarding settings"}:{" "}
                  <code style={{ fontWeight: 800, background: COLORS.white, padding: "2px 8px", borderRadius: 6, border: "1px solid #BBF7D0" }}>{m.forwarding.code}</code>
                </div>
              )}
              {!m.forwarding.link && !m.forwarding.code && (
                <div style={{ fontSize: 12.5, color: "#166534" }}>Open this email in {m.forwarding.provider === "gmail" ? "Gmail" : "Outlook"} to click the confirmation link.</div>
              )}
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button disabled={busy === m.id} onClick={() => openAssign(m.id)}
              style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#0F6E56", color: COLORS.white, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              📂 File to a deal
            </button>
            <button disabled={busy === m.id} onClick={() => dismiss(m.id)}
              style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid " + COLORS.lightGray, background: COLORS.white, color: COLORS.gray, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              {m.forwarding ? "Dismiss" : "Not deal-related"}
            </button>
          </div>
          {assignFor === m.id && (
            <div style={{ marginTop: 8 }}>
              {dealList === null ? <span style={{ fontSize: 13, color: COLORS.gray }}>Loading your deals…</span>
               : <select defaultValue="" onChange={e => e.target.value && assign(m.id, e.target.value)}
                   style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid " + COLORS.lightGray, fontSize: 14, fontFamily: "inherit", maxWidth: "100%" }}>
                   <option value="" disabled>Pick the deal…</option>
                   {dealList.map(d => <option key={d.id} value={d.id}>{d.address}</option>)}
                 </select>}
            </div>
          )}
        </div>
      ))}
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

// ── SEND PREVIEW MODAL ────────────────────────────────────────
// Approve-first: show exactly what's going out — to whom, how, the editable
// subject + body — before anything sends. Nothing leaves until "Approve & send".
function SendPreviewModal({ preview, busy, onCancel, onSend }) {
  const [subject, setSubject] = useState(preview.subject || "");
  const [body, setBody] = useState(preview.body || "");
  const [pickedDocIds, setPickedDocIds] = useState([]);     // attach from the transaction
  const [uploads, setUploads] = useState([]);                // attach from computer
  const availableDocs = preview.availableDocs || [];
  const toggleDoc = (id) => setPickedDocIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  const onFiles = (fileList) => {
    Array.from(fileList || []).forEach(file => {
      if (file.size > 12 * 1024 * 1024) { alert(`"${file.name}" is too large to email (12MB max).`); return; }
      const reader = new FileReader();
      reader.onload = () => setUploads(u => [...u, { name: file.name, dataBase64: reader.result, mimeType: file.type }]);
      reader.readAsDataURL(file);
    });
  };
  const totalAttached = pickedDocIds.length + uploads.length;
  return (
    <div onClick={onCancel} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:1000,
      display:"flex", alignItems:"flex-start", justifyContent:"center", overflowY:"auto", padding:"24px 12px" }}>
      <div onClick={e => e.stopPropagation()} style={{ background:COLORS.white, borderRadius:14, width:"100%",
        maxWidth:520, margin:"auto", padding:20, boxShadow:"0 10px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ fontSize:17, fontWeight:800, color:COLORS.black, marginBottom:4 }}>Review before sending</div>
        <div style={{ fontSize:13, color:COLORS.gray, marginBottom:14 }}>Nothing sends until you approve. Edit anything below.</div>
        <div style={{ background:COLORS.lightGray, borderRadius:8, padding:"10px 12px", marginBottom:12, fontSize:13, lineHeight:1.6 }}>
          <div><b>To:</b> {preview.to}{preview.role ? ` (${preview.role})` : ""}</div>
          <div><b>How:</b> {preview.channel === "email" ? "📧 Email" : preview.channel}</div>
          {preview.fromName && <div><b>From:</b> {preview.fromName} (your agent's voice)</div>}
        </div>
        <label style={{ fontSize:12, fontWeight:700, color:COLORS.gray }}>Subject</label>
        <input value={subject} onChange={e => setSubject(e.target.value)}
          style={{ width:"100%", padding:"10px 12px", border:"1px solid "+COLORS.border, borderRadius:8, fontSize:14, fontFamily:"inherit", marginTop:4, marginBottom:12, boxSizing:"border-box" }} />
        <label style={{ fontSize:12, fontWeight:700, color:COLORS.gray }}>Message</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={9}
          style={{ width:"100%", padding:"10px 12px", border:"1px solid "+COLORS.border, borderRadius:8, fontSize:14, fontFamily:"inherit", marginTop:4, resize:"vertical", boxSizing:"border-box" }} />

        {/* ATTACH — send a document (e.g. to get it signed): from the transaction
            or from the computer. Only shown when the action supports it. */}
        {preview.canAttach && (
          <div style={{ marginTop:14, border:"1px solid "+COLORS.border, borderRadius:10, padding:12 }}>
            <div style={{ fontSize:13, fontWeight:700, color:COLORS.black, marginBottom:6 }}>
              📎 Attach a document to send for signature {totalAttached > 0 ? `(${totalAttached})` : "(optional)"}
            </div>
            {availableDocs.length > 0 && (
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, fontWeight:700, color:COLORS.gray, marginBottom:4 }}>From this transaction</div>
                <div style={{ maxHeight:140, overflowY:"auto" }}>
                  {availableDocs.map(d => (
                    <label key={d.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 0", fontSize:13, cursor:"pointer" }}>
                      <input type="checkbox" checked={pickedDocIds.includes(d.id)} onChange={() => toggleDoc(d.id)} />
                      <span style={{ color:COLORS.black }}>{d.name}</span>
                      {d.category && <span style={{ color:COLORS.gray, fontSize:11 }}>· {d.category}</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <label style={{ display:"inline-block", padding:"7px 12px", border:"1.5px solid "+COLORS.border, borderRadius:8, fontSize:12.5, fontWeight:600, color:COLORS.gray, cursor:"pointer" }}>
              ⬆️ Upload from computer
              <input type="file" multiple style={{ display:"none" }} onChange={e => { onFiles(e.target.files); e.target.value = ""; }} />
            </label>
            {uploads.length > 0 && (
              <div style={{ marginTop:8 }}>
                {uploads.map((u, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12.5, padding:"3px 0" }}>
                    <span style={{ color:COLORS.black }}>📄 {u.name}</span>
                    <button onClick={() => setUploads(us => us.filter((_, j) => j !== i))}
                      style={{ marginLeft:"auto", background:"none", border:"none", color:COLORS.gray, cursor:"pointer", fontSize:12, textDecoration:"underline", fontFamily:"inherit" }}>remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display:"flex", gap:10, marginTop:16, justifyContent:"flex-end", flexWrap:"wrap" }}>
          <button onClick={onCancel} style={{ padding:"10px 18px", borderRadius:10, border:"1.5px solid "+COLORS.border, background:COLORS.white, color:COLORS.gray, fontWeight:600, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
          <button disabled={busy || !subject.trim() || !body.trim()} onClick={() => onSend(subject, body, { attachDocIds: pickedDocIds, uploadedFiles: uploads })}
            style={{ padding:"10px 20px", borderRadius:10, border:"none", background:"#0F6E56", color:COLORS.white, fontWeight:700, fontSize:14, cursor: busy ? "wait" : "pointer", fontFamily:"inherit" }}>
            {busy ? "Sending…" : (totalAttached > 0 ? `✅ Approve & send (${totalAttached} attached)` : "✅ Approve & send")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN DASHBOARD ────────────────────────────────────────────
export default function DailyDashboard({ token, user, onViewTransactions, onOpenTransactionMilestones, onOpenInboundReply, onOpenPopBys, coordinatorMode = false }) {
  const [tasks, setTasks] = useState({ overdue:[], dueToday:[], upcoming:[] });
  const [personal, setPersonal] = useState({ overdue:[], dueToday:[], upcoming:[] });
  const [callsDue, setCallsDue] = useState([]);
  const [occasions, setOccasions] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]); // 🔔 last 14 days of pop-ups
  const [unmatchedEmails, setUnmatchedEmails] = useState([]); // 📥 emails needing filing
  const [showFiling, setShowFiling] = useState(false);
  const [filingDeals, setFilingDeals] = useState(null);   // deal list for the picker
  const openFiling = () => {
    setShowFiling(true);
    if (filingDeals === null) {
      fetch(API + "/transactions", { headers: { Authorization: "Bearer " + token } })
        .then(r => r.json())
        .then(d => setFilingDeals((d.transactions || d || []).map(t => ({ id: t.id, address: t.address }))))
        .catch(() => setFilingDeals([]));
    }
  };
  const fileEmailTo = async (emailId, txId) => {
    try {
      const r = await fetch(API + `/inbound-emails/${emailId}/reassign`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ transactionId: txId }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Could not file it");
      setUnmatchedEmails(list => list.filter(m => m.id !== emailId));
    } catch (e) { alert("⚠️ " + e.message); }
  };
  const dismissUnmatched = async (emailId) => {
    try {
      await fetch(API + `/inbound-emails/${emailId}/unmatched`, { method: "DELETE", headers: { Authorization: "Bearer " + token } });
      setUnmatchedEmails(list => list.filter(m => m.id !== emailId));
    } catch { /* refetch fixes */ }
  };
  const [showActivity, setShowActivity] = useState(false); // 📰 FYI drawer open?
  // The floating 🔔 alerts chip lands here: OPEN the drawer (its alerts are
  // usually FYI ones living inside it) and flash the section so the tap
  // visibly arrives somewhere (Carlos 8/4: collapsed drawer = "takes me nowhere").
  useEffect(() => {
    const h = () => {
      setShowActivity(true);
      setTimeout(() => {
        const el = document.getElementById("wtd-alerts");
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.style.transition = "box-shadow 0.3s";
        el.style.boxShadow = "0 0 0 4px rgba(192,57,43,0.55)";
        setTimeout(() => { el.style.boxShadow = "none"; }, 1800);
      }, 150);
    };
    window.addEventListener("wintheday:show-alerts", h);
    return () => window.removeEventListener("wintheday:show-alerts", h);
  }, []);
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

  // COORDINATOR: pull the command-center read so each deal card can show its
  // health, progress, history and the AI's recommended move — making it ONE
  // comprehensive card per transaction (no separate Command Center list).
  const [ccMeta, setCcMeta] = useState({});       // txId -> { health, reason, score, msDone, msTotal, daysSinceActivity, closingDate, status, aiMove, hasDraft, draftToRole }
  const [needsYouDeals, setNeedsYouDeals] = useState([]); // flagged deals (may lack generated tasks)
  const [onTrackDeals, setOnTrackDeals] = useState([]);
  const [showOnTrack, setShowOnTrack] = useState(false);
  const [aiBusy, setAiBusy] = useState(null);
  // AGENT side: every TC-handled deal's status, so each deal card can show what
  // the TC is taking care of right alongside what the agent needs to do.
  const [agentTcMap, setAgentTcMap] = useState({});   // txId -> desk info
  const [agentTcDeals, setAgentTcDeals] = useState([]);
  const loadCc = () => {
    if (coordinatorMode) {
      fetch(API + "/tc/command-center", { headers: { Authorization: "Bearer " + token } })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d || !d.success) return;
          const map = {};
          (d.needsYou || []).forEach(x => { if (x.txId) map[x.txId] = x; });
          (d.onTrack || []).forEach(x => { if (x.txId) map[x.txId] = x; });
          setCcMeta(map);
          setNeedsYouDeals(d.needsYou || []);
          setOnTrackDeals(d.onTrack || []);
        }).catch(() => {});
    } else {
      fetch(API + "/agent/coordinator-desk", { headers: { Authorization: "Bearer " + token } })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d || !d.success) return;
          const map = {};
          (d.deals || []).forEach(x => { if (x.txId) map[x.txId] = x; });
          setAgentTcMap(map);
          setAgentTcDeals(d.deals || []);
        }).catch(() => {});
    }
  };
  // Deal-level action for a flagged deal that has no per-item task lines yet.
  const dealAction = async (txId, kind) => {
    if (kind === "replies") { onOpenTransactionMilestones && onOpenTransactionMilestones(txId, "replies"); return; }
    if (kind === "doc") { requestPreview("/tc/transaction/" + txId + "/request-document"); return; }
    // "remind" = today's milestone reminder ladder; the approve-first banner plan
    // already governs that batch, so it sends directly here.
    setAiBusy(txId);
    try {
      const r = await fetch(API + "/tc/action-plan/execute", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ txIds: [txId] }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Couldn't do that");
      alert("✅ Sent reminders");
      loadCc(); window.dispatchEvent(new Event("wintheday:refresh"));
    } catch (e) { alert("Could not: " + e.message); }
    setAiBusy(null);
  };
  useEffect(() => { loadCc(); /* eslint-disable-next-line */ }, [coordinatorMode]);
  // NOTE: loadCc is also called by the main wintheday:refresh handler below, so we
  // don't register a second listener here (that double-fetched the desk every refresh).
  // Approve-first preview engine: any send action first fetches a preview (to /
  // how / subject / body) and opens the review modal; nothing leaves until the
  // coordinator approves. `pendingPreview` holds the preview + the send fn.
  const [pendingPreview, setPendingPreview] = useState(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const post = (path, bodyObj) => fetch(API + path, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify(bodyObj || {}),
  }).then(async r => { const d = await r.json(); if (!r.ok || !d.success) throw new Error(d.error || "Something went wrong"); return d; });
  const requestPreview = async (path, onSent) => {
    try {
      const d = await post(path, { preview: true });
      if (!d.preview) { onSent && onSent(d); return; } // endpoint can't preview → already done
      setPendingPreview({
        data: d,
        send: async (subject, body, extras) => {
          setPreviewBusy(true);
          try {
            const r = await post(path, { confirm: true, subject, body, ...(extras || {}) });
            setPendingPreview(null);
            onSent && onSent(r);
            window.dispatchEvent(new Event("wintheday:refresh")); loadCc();
          } catch (e) { alert("Could not send: " + e.message); }
          setPreviewBusy(false);
        },
      });
    } catch (e) { alert(e.message); }
  };
  // Send the AI's recommended message (Deal Doctor draft) — with preview/approve.
  const sendAiDraft = (txId) => requestPreview("/tc/transaction/" + txId + "/send-deal-doctor-draft");
  // Per-card action preview (Win-the-Day line: request doc / send request / email seller).
  const actPreview = (task, onSent) => requestPreview("/dashboard/tasks/" + task.id + "/act", onSent);

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
    // Refresh discipline to stop the refetch storm (was reloading the home's data
    // on EVERY window focus + every in-app event → constant churn/jank while
    // clicking). In-app action events are debounced (a burst coalesces into one
    // refresh); window focus is throttled to at most once a minute.
    const doRefresh = () => { fetchTasks({ silent: true }); loadCc(); };
    let debounceT = null;
    const onEvent = () => { clearTimeout(debounceT); debounceT = setTimeout(doRefresh, 400); };
    let focusLast = 0;
    const onFocus = () => { const now = Date.now(); if (now - focusLast < 60000) return; focusLast = now; doRefresh(); };
    window.addEventListener("wintheday:refresh", onEvent);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("wintheday:refresh", onEvent);
      window.removeEventListener("focus", onFocus);
      clearTimeout(debounceT);
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
      const [tasksRes, callsRes, alertsRes, filingRes] = await Promise.all([
        fetch(url, { headers: { Authorization: "Bearer " + token } }),
        fetch(API + "/contacts/due-today", { headers: { Authorization: "Bearer " + token } }).catch(() => null),
        fetch(API + "/notifications/recent", { headers: { Authorization: "Bearer " + token } }).catch(() => null),
        fetch(API + "/inbound-emails/unmatched", { headers: { Authorization: "Bearer " + token } }).catch(() => null),
      ]);
      if (alertsRes && alertsRes.ok) {
        const ad = await alertsRes.json();
        setRecentAlerts(ad.notifications || []);
      }
      if (filingRes && filingRes.ok) {
        const fd = await filingRes.json();
        setUnmatchedEmails(fd.messages || []);
      }
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

  // "Already Sent" on a seller/buyer-update card — LOG the update so the clock
  // actually resets (otherwise it keeps saying "N days since your last update").
  const handleMarkUpdateSent = async (task) => {
    setResolvedIds(prev => new Set([...prev, task.id]));  // hide immediately
    try {
      await fetch(API + "/transactions/" + task.transaction_id + "/mark-update-sent", {
        method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ type: task.task_type === "buyer_update" ? "buyer" : "seller" }),
      });
      window.dispatchEvent(new Event("wintheday:refresh"));
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
  const rankedTasksAll = [
    ...visibleOverdue.map(t => ({ ...t, _rank: 0 })),
    ...visibleToday.map(t => ({ ...t, _rank: 1 })),
    ...visibleUpcoming.map(t => ({ ...t, _rank: t.due_date ? 2 : 3 })),
  ];
  // Monthly money check isn't tied to a deal — render it as its own card, not
  // inside a deal group (its transaction_id is NULL so it has no address).
  const financialsCards = rankedTasksAll.filter(t => t.task_type === 'monthly_financials');
  // Agent-set reminders get their OWN eye-catching section (Carlos 7/22) —
  // pulled out of the per-deal cards so they can't hide inside a group.
  const reminderCards = rankedTasksAll.filter(t => t.task_type === 'reminder');
  // Alert notifications for reminders that are ALREADY shown as reminder cards
  // get auto-acknowledged — otherwise the floating chip counts alerts the
  // alerts section (correctly) hides as duplicates.
  useEffect(() => {
    const cardIds = new Set(reminderCards.map(t => String(t.target_ref_id || "")));
    const dupIds = recentAlerts.filter(a => !a.seen_at && a.kind === "reminder_overdue" && a.target_id && cardIds.has(String(a.target_id))).map(a => a.id);
    if (!dupIds.length) return;
    fetch(API + "/notifications/seen", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ ids: dupIds }) }).catch(() => {});
    setRecentAlerts(list => list.map(x => dupIds.includes(x.id) ? { ...x, seen_at: x.seen_at || new Date().toISOString() } : x));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentAlerts.length, reminderCards.length]);
  const rankedTasks = rankedTasksAll.filter(t => t.task_type !== 'monthly_financials' && t.task_type !== 'reminder');
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
  // Coordinator view: every deal the command center flags must SHOW — even if its
  // per-item task cards haven't regenerated yet (e.g. a deal that just went under
  // contract awaiting EMD). Add those as header-only cards so nothing is hidden.
  if (coordinatorMode) {
    const have = new Set(dealGroups.map(d => d.transaction_id).filter(Boolean));
    for (const nd of needsYouDeals) {
      if (nd.txId && !have.has(nd.txId)) {
        dealGroups.push({ transaction_id: nd.txId, address: nd.address, tasks: [], rank: 0, _ccOnly: true });
        have.add(nd.txId);
      }
    }
    // Rank by the command-center risk score (most urgent first) so a TC watching
    // hundreds always sees the deals that need them at the top.
    dealGroups.sort((a, b) =>
      ((ccMeta[b.transaction_id]?.score || 0) - (ccMeta[a.transaction_id]?.score || 0)) ||
      a.rank - b.rank);
  }
  // AGENT view: fold the Coordinator Desk INTO the deal cards — every TC-handled
  // deal becomes ONE card showing the agent's part AND the TC's part. Deals the
  // TC runs that have no agent task still appear (header + TC section), so the
  // agent never goes back and forth between a list and a separate desk.
  if (!coordinatorMode) {
    const have = new Set(dealGroups.map(d => d.transaction_id).filter(Boolean));
    for (const td of agentTcDeals) {
      if (td.txId && !have.has(td.txId)) {
        dealGroups.push({ transaction_id: td.txId, address: td.address, tasks: [], rank: 4, _tcOnly: true });
        have.add(td.txId);
      }
    }
  }

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

      {/* Captured emails that need a human to say which deal they belong to. */}
      {!coordinatorMode && <UnmatchedMailPanel token={token} />}

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

      {/* 🚨 ALERTS = only things that DEMAND attention (Carlos 7/23: "alerts
          should be extremely past due… the green-checkmark ones aren't alerts").
          FYI notices (signed docs, feedback) live in a collapsed drawer below. */}
      {(recentAlerts.length > 0 || unmatchedEmails.length > 0) && (() => {
        const ALERT_KINDS = new Set(["reminder_overdue", "email_needs_filing"]);
        // A reminder that already has its own card in ⏰ YOUR REMINDERS below
        // must not ALSO show as an alert box — same reminder twice on one screen
        // (Carlos 7/30, Belfry). The reminder card is the richer one (Done /
        // New date / acknowledgment), so the alert defers to it.
        const reminderCardIds = new Set(reminderCards.map(t => String(t.target_ref_id || "")));
        const critical = [], fyi = [];
        for (const a of recentAlerts) {
          if (a.kind === "reminder_overdue" && a.target_id && reminderCardIds.has(String(a.target_id))) continue;
          (ALERT_KINDS.has(a.kind) ? critical : fyi).push(a);
        }
        // EVERY unacknowledged critical alert gets ITS OWN box with explicit
        // buttons (Carlos 7/28: no grouping, each alert individually actionable,
        // acknowledged alerts drop out once marked Done).
        const alerts = critical.filter(a => !a.seen_at).slice(0, 10);
        const ackAlert = async (a) => {
          try { await fetch(API + "/notifications/seen", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ ids: [a.id] }) }); } catch { /* refetch fixes it */ }
          setRecentAlerts(list => list.map(x => x.id === a.id ? { ...x, seen_at: new Date().toISOString() } : x));
        };
        // Done on a reminder alert marks THE REMINDER done (not just the alert) —
        // it never comes back tomorrow (Carlos 7/29).
        const doneReminderAlert = async (a) => {
          if (a.target_id) {
            try { await fetch(API + "/reminders/" + a.target_id + "/done", { method: "POST", headers: { Authorization: "Bearer " + token } }); } catch { /* ack still clears the alert */ }
          }
          await ackAlert(a);
        };
        const goTo = (a) => {
          if (a.kind === "email_needs_filing") { openFiling(); return; }
          if (a.transaction_id && onOpenTransactionMilestones) onOpenTransactionMilestones(a.transaction_id);
        };
        const renderCritical = (a) => (
          <div key={a.id} style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderLeft: "5px solid #dc2626", borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: "#7f1d1d" }}>{a.title}</div>
            {a.body && <div style={{ fontSize: 12.5, color: "#991b1b", marginTop: 2, whiteSpace: "pre-line" }}>{a.body}</div>}
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>{new Date(a.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
              {(a.transaction_id || a.kind === "email_needs_filing") && (
                <button onClick={() => goTo(a)}
                  style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                  → Take me there
                </button>
              )}
              {a.kind === "reminder_overdue" && a.target_id ? (
                <button onClick={() => doneReminderAlert(a)}
                  style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #86efac", background: "#f0fdf4", color: "#166534", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                  ✓ Done — mark this reminder done
                </button>
              ) : (
                <button onClick={() => ackAlert(a)}
                  style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fff", color: "#b91c1c", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                  ✓ Done — clear this alert
                </button>
              )}
            </div>
          </div>
        );
        const renderFyi = (a) => (
          <div key={a.id} style={{ background: a.seen_at ? "#fafafa" : "#f5f3ff", border: "1px solid " + (a.seen_at ? "#e5e7eb" : "#c4b5fd"), borderRadius: 8, padding: 12, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, opacity: a.seen_at ? 0.75 : 1 }}>
            <div style={{ flex: 1, minWidth: 0, cursor: a.transaction_id ? "pointer" : "default" }}
              onClick={() => a.transaction_id && onOpenTransactionMilestones && onOpenTransactionMilestones(a.transaction_id)}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: "#111" }}>{a.title}</div>
              {a.body && <div style={{ fontSize: 12.5, color: "#4b5563", marginTop: 2, whiteSpace: "pre-line" }}>{a.body}</div>}
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>{new Date(a.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}{a.transaction_id ? " · tap to open the deal" : ""}</div>
            </div>
            {!a.seen_at && (
              <button onClick={async () => {
                try { await fetch(API + "/notifications/seen", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ ids: [a.id] }) }); } catch { /* refetch fixes it */ }
                setRecentAlerts(list => list.map(x => x.id === a.id ? { ...x, seen_at: new Date().toISOString() } : x));
              }}
                style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 8, border: "1px solid #c4b5fd", background: "#fff", color: "#6d28d9", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                Got it
              </button>
            )}
          </div>
        );
        return (
          <div id="wtd-alerts" style={{ marginBottom: 24 }}>
            {(alerts.length > 0 || unmatchedEmails.length > 0) && (
              <>
                <SectionHeader label={"🚨 ALERTS — NEEDS YOUR ATTENTION"} count={alerts.length + (unmatchedEmails.length ? 1 : 0)} color={"#dc2626"} />
                {unmatchedEmails.length > 0 && (
                  <div style={{ background: "#fff7ed", border: "1px solid #fdba74", borderLeft: "5px solid #ea580c", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 13.5, color: "#7c2d12" }}>📥 {unmatchedEmails.length} email{unmatchedEmails.length === 1 ? "" : "s"} need{unmatchedEmails.length === 1 ? "s" : ""} filing</div>
                    <div style={{ fontSize: 12.5, color: "#9a3412", marginTop: 2 }}>The app received {unmatchedEmails.length === 1 ? "an email" : "emails"} it couldn't match to a deal — file {unmatchedEmails.length === 1 ? "it" : "them"} so nothing is lost.</div>
                    <button onClick={openFiling}
                      style={{ marginTop: 9, padding: "7px 14px", borderRadius: 8, border: "none", background: "#ea580c", color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                      → Open Needs Filing
                    </button>
                  </div>
                )}
                {alerts.map(renderCritical)}
              </>
            )}
            {fyi.length > 0 && (
              <>
                <button onClick={() => setShowActivity(v => !v)}
                  style={{ width: "100%", textAlign: "left", background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#4b5563", cursor: "pointer", fontFamily: "inherit", marginBottom: 8 }}>
                  {showActivity ? "▾" : "▸"} 📰 Recent activity ({fyi.length}) — signings, feedback &amp; other good news
                </button>
                {showActivity && fyi.map(renderFyi)}
              </>
            )}
          </div>
        );
      })()}
      {/* 📥 NEEDS FILING modal — every unmatched email with its own deal picker. */}
      {showFiling && (
        <div onMouseDown={e => { if (e.target === e.currentTarget) e.currentTarget.dataset.down = "1"; }}
          onClick={e => { if (e.target === e.currentTarget && e.currentTarget.dataset.down === "1") setShowFiling(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 4000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 640, margin: "24px auto", padding: 0, overflow: "hidden" }}>
            <div style={{ background: "#7c2d12", color: "#fff", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>📥 Needs filing</div>
              <button onClick={() => setShowFiling(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.8)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: 16, maxHeight: "70vh", overflowY: "auto" }}>
              {unmatchedEmails.length === 0 && <div style={{ textAlign: "center", color: "#6b7280", padding: 30 }}>🎉 Nothing needs filing.</div>}
              {unmatchedEmails.map(m => (
                <div key={m.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{m.from_name || m.from_email || "Unknown sender"} <span style={{ color: "#6b7280", fontWeight: 400 }}>&lt;{m.from_email}&gt;</span></div>
                  <div style={{ fontSize: 13, color: "#111", marginTop: 3, fontWeight: 600 }}>{m.subject || "(no subject)"}</div>
                  {m.snippet && <div style={{ fontSize: 12.5, color: "#4b5563", marginTop: 3 }}>{m.snippet}</div>}
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>{new Date(m.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}{m.attachment_count ? ` · 📎 ${m.attachment_count} attachment(s)` : ""}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                    {filingDeals === null ? <span style={{ fontSize: 12, color: "#6b7280" }}>Loading deals…</span> : (
                      <select defaultValue="" onChange={e => e.target.value && fileEmailTo(m.id, e.target.value)}
                        style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, fontFamily: "inherit", maxWidth: 280 }}>
                        <option value="" disabled>📁 File to a deal…</option>
                        {filingDeals.map(d => <option key={d.id} value={d.id}>{d.address}</option>)}
                      </select>
                    )}
                    <button onClick={() => dismissUnmatched(m.id)}
                      style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      Not deal-related — dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* ⏰ REMINDERS — the agent's own reminders, in their own loud section.
          3+ days overdue = acknowledgment mode: Done or a new date, nothing else. */}
      {!coordinatorMode && reminderCards.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeader label={"⏰ YOUR REMINDERS"} count={reminderCards.length} color={"#b45309"} />
          {reminderCards.map(t => {
            const du = daysUntil(t.due_date);
            const late = du !== null && du < 0 ? Math.abs(du) : 0;
            const needsAck = late >= 3;
            const pickNewDate = async () => {
              const suggestion = new Date(); suggestion.setDate(suggestion.getDate() + 1);
              const v = prompt("Move this reminder to which date? (YYYY-MM-DD)", suggestion.toISOString().slice(0, 10));
              if (!v) return;
              try {
                const r = await fetch(API + "/reminders/" + t.target_ref_id + "/reschedule", {
                  method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
                  body: JSON.stringify({ date: v.trim() }),
                });
                const d = await r.json();
                if (!r.ok) throw new Error(d.error || "Couldn't reschedule");
                fetchTasks();
              } catch (e) { alert(e.message); }
            };
            return (
              <div key={t.id} style={{ background: needsAck ? "#fef2f2" : "#fffbeb", border: "1.5px solid " + (needsAck ? "#fca5a5" : "#fcd34d"), borderLeft: "5px solid " + (needsAck ? "#dc2626" : "#d97706"), borderRadius: 10, padding: "14px 16px", marginBottom: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 14.5, color: needsAck ? "#7f1d1d" : "#78350f" }}>{String(t.title || "").replace(/^⏰\s*/, "⏰ ")}</div>
                {t.description && <div style={{ fontSize: 12.5, color: needsAck ? "#991b1b" : "#92400e", marginTop: 3 }}>{t.description}</div>}
                <div style={{ fontSize: 12, fontWeight: 700, color: needsAck ? "#dc2626" : "#b45309", marginTop: 4 }}>
                  {late > 0 ? `⚠️ Waiting ${late} day${late === 1 ? "" : "s"}` : du === 0 ? "Due today" : du === 1 ? "Due tomorrow" : `Due in ${du} days`}
                  {needsAck && " — mark it done or pick a new date"}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button onClick={() => handleResolve(t.id)}
                    style={{ flex: "2 1 40%", padding: "10px 0", borderRadius: 9, border: "none", background: "#1E8449", color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>
                    ✓ Done
                  </button>
                  <button onClick={pickNewDate}
                    style={{ flex: "2 1 35%", padding: "10px 0", borderRadius: 9, border: "1.5px solid " + (needsAck ? "#dc2626" : "#d97706"), background: "#fff", color: needsAck ? "#dc2626" : "#b45309", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                    📅 New date
                  </button>
                  {!needsAck && (
                    <button onClick={() => handleSnooze(t.id)}
                      style={{ flex: "1 1 20%", padding: "10px 0", borderRadius: 9, border: "1.5px solid #d1d5db", background: "#fff", color: "#6b7280", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                      ⏰ Not Today
                    </button>
                  )}
                </div>
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

      {/* MONTHLY MONEY CHECK — once a month, close out last month's books */}
      {!coordinatorMode && financialsCards.map(t => (
        <div key={t.id} style={{ background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)", border: "1.5px solid #10b981", borderRadius: 14, padding: 16, marginBottom: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#065f46", marginBottom: 6 }}>🧾 {t.title.replace(/^🧾\s*/, "")}</div>
          <div style={{ fontSize: 13.5, color: "#047857", lineHeight: 1.5, marginBottom: 12 }}>{t.description}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => window.dispatchEvent(new CustomEvent("tp:open-financials"))}
              style={{ flex: "2 1 55%", padding: "11px 0", borderRadius: 10, border: "none", background: "#059669", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              💵 Open Financials →
            </button>
            <button onClick={() => handleResolve(t.id)}
              style={{ flex: "1 1 20%", padding: "11px 0", borderRadius: 10, border: "1.5px solid #10b981", background: "#fff", color: "#065f46", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              ✓ Done
            </button>
            <button onClick={() => handleSnooze(t.id)}
              style={{ flex: "1 1 20%", padding: "11px 0", borderRadius: 10, border: "1.5px solid #d1d5db", background: "#fff", color: "#6b7280", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              ⏰ Not Today
            </button>
          </div>
        </div>
      ))}

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
          <SectionHeader label="📝 GENERAL TASKS — NEXT 2 DAYS & UNDATED" count={personal.upcoming.length} color="#1E8449" />
          {personal.upcoming.map(t => (
            <PersonalTaskCard key={t.id} task={t} token={token} onChange={fetchTasks} />
          ))}
        </div>
      )}
      {/* ONE CARD PER TRANSACTION — all of a deal's items grouped, urgent first */}
      {dealGroups.length > 0 && (
        <div>
          {!coordinatorMode && <SectionHeader label="YOUR DEALS TODAY" count={dealGroups.length} color={COLORS.red} />}
          {dealGroups.map(deal => (
            <DealGroupCard key={deal.transaction_id || deal.tasks[0]?.id} deal={deal} token={token}
              coordinatorMode={coordinatorMode} meta={ccMeta[deal.transaction_id]}
              agentTc={!coordinatorMode ? agentTcMap[deal.transaction_id] : null}
              onSendAiDraft={sendAiDraft} aiBusy={aiBusy} onDealAction={dealAction} onActPreview={actPreview}
              onResolve={handleResolve} onComplete={handleComplete} onSnooze={handleSnooze}
              onUpdateSent={handleMarkUpdateSent}
              onOpenModal={setActiveModal} onStartChase={handleStartChase}
              onOpenTransaction={onOpenTransactionMilestones}
              onOpenTransactionMilestones={onOpenTransactionMilestones}
              onOpenInboundReply={onOpenInboundReply} onInboundReply={handleInboundReply}
              onReschedule={handleReschedule} />
          ))}
        </div>
      )}

      {/* COORDINATOR: on-track deals, collapsed — the app's got these. */}
      {coordinatorMode && onTrackDeals.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setShowOnTrack(s => !s)}
            style={{ width:"100%", textAlign:"left", background:"#F0FDF4", border:"1px solid #BBF7D0",
              borderRadius:12, padding:"12px 14px", fontSize:14, fontWeight:700, color:"#166534",
              cursor:"pointer", fontFamily:"inherit" }}>
            ✅ {onTrackDeals.length} on track &amp; handled {showOnTrack ? "▲" : "▼"}
          </button>
          {showOnTrack && (
            <div style={{ marginTop: 8 }}>
              {onTrackDeals.map(d => (
                <div key={d.txId} onClick={() => onOpenTransactionMilestones && onOpenTransactionMilestones(d.txId)}
                  style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px",
                    borderBottom:"1px solid "+COLORS.lightGray, cursor:"pointer", fontSize:13 }}>
                  <span style={{ width:9, height:9, borderRadius:"50%", flexShrink:0,
                    background: d.health === "red" ? "#DC2626" : d.health === "yellow" ? "#D97706" : d.health === "green" ? "#16A34A" : "#CBD5E1" }} />
                  <span style={{ fontWeight:600, color:COLORS.black }}>{d.address}</span>
                  <span style={{ color:COLORS.gray }}>· {d.status}</span>
                  {d.closingDate && <span style={{ marginLeft:"auto", color:COLORS.gray, fontSize:12 }}>Closing {d.closingDate}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View All Transactions */}
      <button onClick={onViewTransactions}
        style={{ width:"100%", marginTop:24, padding:16, borderRadius:12,
          border:"2px solid "+COLORS.border, background:COLORS.white,
          color:COLORS.black, fontWeight:700, fontSize:15, cursor:"pointer" }}>
        📋 View All My Transactions
      </button>

      {/* Approve-first review modal — shared by every send action */}
      {pendingPreview && (
        <SendPreviewModal
          preview={pendingPreview.data}
          busy={previewBusy}
          onCancel={() => setPendingPreview(null)}
          onSend={pendingPreview.send}
        />
      )}

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
