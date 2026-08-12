// ═══════════════════════════════════════════════════════════════
// assistantLocal — the offline brain for the AI Assistant.
//
// The assistant normally sends every inquiry to the server
// (POST /assistant), where Claude interprets it against a snapshot
// of the agent's data. This module is the FALLBACK: when that
// endpoint is unreachable or not yet deployed, routeLocal() handles
// the core commands (dial a contact, today's tasks, open a deal,
// navigate, add a task, help lookup) entirely in the browser with
// plain pattern matching — so the feature is never dead.
//
// Both brains speak the same "cards" protocol the panel renders:
//   { type: "contact", contact }                     → dial/text/email card
//   { type: "choices", options: [{ label, send }] }  → tap-to-answer buttons
//   { type: "tasks", title, items: [{ title, due, where }] }
//   { type: "deal", deal, tab? }                     → deal summary + Open →
//   { type: "navigate", label, target }              → jump to an app screen
//   { type: "create_task", task: { title, due_date, category, notes } }
//   { type: "help", title, steps: [..], target? }    → numbered how-to
// ═══════════════════════════════════════════════════════════════

export function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/[.,!?;:"()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Name match: every query token must prefix-match some name token.
// "maria" matches "Maria Gonzalez"; "maria gon" matches too.
function nameMatches(name, queryTokens) {
  const nameTokens = norm(name).split(" ");
  return queryTokens.every(q => nameTokens.some(n => n.startsWith(q)));
}

export function findContacts(contacts, query) {
  const q = norm(query);
  if (!q) return [];
  const tokens = q.split(" ");
  return (contacts || []).filter(c => nameMatches(c.name || "", tokens));
}

export function findDeals(deals, query) {
  const q = norm(query);
  if (!q) return [];
  const tokens = q.split(" ").filter(t => t.length > 1);
  if (!tokens.length) return [];
  return (deals || []).filter(d => {
    const addr = norm(d.address || "");
    return tokens.every(t => addr.includes(t));
  });
}

// "today" | "tomorrow" | "in 3 days" | "next week" | "in 2 weeks" |
// "in a month" → YYYY-MM-DD (ET, matching the app's task dates), else null.
export function parseDue(text, now = new Date()) {
  const t = norm(text);
  let days = null;
  if (/\btoday\b/.test(t)) days = 0;
  else if (/\btomorrow\b/.test(t)) days = 1;
  else if (/\bnext week\b/.test(t)) days = 7;
  else if (/\bnext month\b/.test(t)) days = 30;
  else {
    let m = t.match(/\bin (\d+) days?\b/);
    if (m) days = parseInt(m[1], 10);
    if (days == null && (m = t.match(/\bin (\d+) weeks?\b/))) days = parseInt(m[1], 10) * 7;
    if (days == null && (m = t.match(/\bin (\d+) months?\b/))) days = parseInt(m[1], 10) * 30;
    if (days == null && /\bin a week\b/.test(t)) days = 7;
    if (days == null && /\bin a month\b/.test(t)) days = 30;
  }
  if (days == null) return null;
  const et = new Date(now.toLocaleDateString("en-CA", { timeZone: "America/New_York" }) + "T00:00:00");
  et.setDate(et.getDate() + days);
  return `${et.getFullYear()}-${String(et.getMonth() + 1).padStart(2, "0")}-${String(et.getDate()).padStart(2, "0")}`;
}

// Strip due-date phrases out of a task title ("call the Smiths tomorrow" → "call the Smiths")
function stripDuePhrase(s) {
  return s
    .replace(/\b(today|tomorrow|next week|next month|in a week|in a month|in \d+ (?:days?|weeks?|months?))\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const NAV_TARGETS = [
  { target: "contacts", label: "📇 Contacts", words: ["contacts", "contact book", "address book"] },
  { target: "popbys", label: "🎁 Pop-Bys", words: ["pop by", "pop bys", "popby", "popbys", "pop-by"] },
  { target: "scripts", label: "📜 Scripts", words: ["script", "scripts", "objection"] },
  { target: "cma", label: "📊 CMA", words: ["cma", "market analysis", "comps"] },
  { target: "expenses", label: "💰 Financials", words: ["expense", "expenses", "financial", "financials", "money"] },
  { target: "forms", label: "📄 Forms", words: ["form", "forms"] },
  { target: "growthplan", label: "📈 Growth Plan", words: ["growth plan", "goals"] },
  { target: "calendar", label: "📅 Calendar", words: ["calendar", "schedule"] },
  { target: "dashboard", label: "🏠 My Deals", words: ["deals", "pipeline", "transactions", "dashboard"] },
  { target: "home", label: "☀️ Today", words: ["home", "win the day", "today screen"] },
  { target: "reports", label: "📊 Reports", words: ["report", "reports"] },
  { target: "vendors", label: "🔧 Vendors", words: ["vendor", "vendors", "inspector list", "lender list"] },
];

function dealCardSummary(d) {
  const bits = [];
  if (d.status) bits.push(d.status);
  if (d.closingDate) bits.push("closing " + d.closingDate);
  return bits.length ? `${d.address} — ${bits.join(", ")}.` : `${d.address}.`;
}

function taskItems(list, where) {
  return (list || []).map(t => ({
    title: t.title || t.name || t.task || t.taskName || t.milestone || t.description || "Task",
    due: t.due_date || t.dueDate || "",
    where: t.address || t.transactionAddress || t.txAddress || t.transaction_address || t.property_address || where || "",
  }));
}

// "Order survey (123 Palm Ave), Send welcome email and 2 more" — so the
// spoken/text reply NAMES the work instead of just counting it.
function nameList(items) {
  const named = items.slice(0, 3).map(t => t.title + (t.where ? ` (${t.where})` : ""));
  return named.join(", ") + (items.length > 3 ? ` and ${items.length - 3} more` : "");
}

// Search the Help Center guides for the best match to a "how do I…" question.
export function searchGuides(guides, query) {
  const q = norm(query).split(" ").filter(w => w.length > 2 &&
    !["how", "the", "can", "you", "what", "where", "does", "for", "and", "this", "that", "with", "into"].includes(w));
  if (!q.length) return [];
  const scored = [];
  (guides || []).forEach(sec => (sec.items || []).forEach(g => {
    const hay = norm(g.title + " " + (g.steps || []).join(" "));
    const titleHay = norm(g.title);
    let score = 0;
    q.forEach(w => {
      if (titleHay.includes(w)) score += 3;
      else if (hay.includes(w)) score += 1;
    });
    if (score > 0) scored.push({ score, guide: g });
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 2).map(s => s.guide);
}

// The offline router. Returns { reply, cards } or null when it can't tell
// what was asked (the caller shows the capabilities hint).
//
// `memory` is the panel's short-term context — what the LAST answer showed
// ({ contacts, deals, choices, tasks }) — so follow-ups like "text her
// instead", "which one?", "open it", or answering a choices question by
// just saying the name, resolve against it.
export function routeLocal(inputRaw, ctx = {}, memory = null) {
  const { contacts = [], deals = [], tasks = null, guides = [], now = new Date() } = ctx;
  const input = norm(inputRaw);
  if (!input) return null;

  if (memory) {
    // Spoken answer to a pending choices question ("Gonzalez") — if it
    // singles out one option, run that option's command.
    const pending = memory.choices || [];
    if (pending.length) {
      const hits = pending.filter(o => norm(o.label).includes(input) || norm(o.send).includes(input));
      if (hits.length === 1) return routeLocal(hits[0].send, ctx);
    }

    // "text her instead" / "email them" / bare "call" — re-aim at the last
    // single contact shown.
    let fm = input.match(/^(?:no,? |actually,? |ok,? )?(call|dial|phone|text|sms|email)(?: (?:her|him|them|it))?(?: instead)?$/);
    if (fm && (memory.contacts || []).length === 1) {
      const c = memory.contacts[0];
      const how = fm[1] === "email" ? "email" : fm[1] === "text" || fm[1] === "sms" ? "text" : "call";
      return { reply: `Here's ${c.name} — tap to ${how}.`, cards: [{ type: "contact", contact: c }] };
    }

    // "which one?" / "what is it?" after a task answer — spell the tasks out.
    if (/^(which (one|ones)( is (it|that))?|what (is|are) (it|they|those|the tasks?)|tell me more|more details?|like what)\??$/.test(input) && (memory.tasks || []).length) {
      const items = memory.tasks;
      const spoken = items.slice(0, 5).map(t => t.title + (t.where ? ` for ${t.where}` : "") + (t.due ? `, due ${t.due}` : "")).join("; ");
      return {
        reply: `${spoken}.`,
        cards: [{ type: "tasks", title: `📋 The details (${items.length})`, items }],
      };
    }

    // "open it" / "open that one" after a single deal was shown.
    if (/^(open|show)( up)? (it|that|this|that one)$/.test(input) && (memory.deals || []).length === 1) {
      const d = memory.deals[0];
      return { reply: dealCardSummary(d), cards: [{ type: "deal", deal: d }] };
    }
  }

  // ---- Contact: call / dial / text / email <name> -------------------------
  let m = input.match(/^(?:can you |please |i need to |i want to )?(call|dial|phone|text|sms|email)\s+(.+)$/);
  if (m) {
    const verb = m[1];
    const how = verb === "email" ? "email" : verb === "text" || verb === "sms" ? "text" : "call";
    const name = stripDuePhrase(m[2].replace(/\b(please|now|for me|her|him|them|it|instead)\b/g, "").trim());
    // "text her instead" with nobody in recent context — ask, don't search
    // for a contact literally named "her instead".
    if (!name) return { reply: `Who would you like to ${how}? Say the name.`, cards: [] };
    const matches = findContacts(contacts, name);
    if (matches.length === 1) {
      const c = matches[0];
      return {
        reply: `Here's ${c.name} — tap to ${how}.`,
        cards: [{ type: "contact", contact: c }],
      };
    }
    if (matches.length > 1) {
      return {
        reply: `You have ${matches.length} contacts matching “${name}” — which one?`,
        cards: [{
          type: "choices",
          options: matches.slice(0, 6).map(c => ({
            label: c.name + (c.role ? ` (${c.role})` : ""),
            send: `${verb} ${c.name}`,
          })),
        }],
      };
    }
    return { reply: `I couldn't find a contact named “${name}”. You can add them from the Contacts page.`, cards: [{ type: "navigate", label: "📇 Open Contacts", target: "contacts" }] };
  }

  // ---- Schedule: "do I have anything tomorrow?" / "what's on my calendar
  // today?" — answer from tasks + closings, don't just point at the calendar.
  const schedDay = input.match(/\b(today|tomorrow)\b/);
  if (schedDay && /(schedule|calendar|appointment|agenda|planned|going on|have anything|anything (for|on|scheduled|planned|happening))/.test(input)) {
    const et = new Date(now.toLocaleDateString("en-CA", { timeZone: "America/New_York" }) + "T00:00:00");
    if (schedDay[1] === "tomorrow") et.setDate(et.getDate() + 1);
    const dateStr = `${et.getFullYear()}-${String(et.getMonth() + 1).padStart(2, "0")}-${String(et.getDate()).padStart(2, "0")}`;
    const dayTasks = (schedDay[1] === "today"
      ? taskItems(tasks?.dueToday).concat(taskItems(tasks?.personal?.dueToday, "General"))
      : taskItems(tasks?.upcoming).concat(taskItems(tasks?.personal?.upcoming, "General")).filter(t => t.due === dateStr)
    );
    const closings = (deals || []).filter(d => d.closingDate === dateStr)
      .map(d => ({ title: "🔑 Closing", due: dateStr, where: d.address }));
    const items = closings.concat(dayTasks);
    // Tasks don't carry times of day — say so when they asked for one.
    const timeNote = /\b(morning|afternoon|evening|tonight)\b/.test(input)
      ? " (heads up: the app doesn't track times of day, so this is the whole day)"
      : "";
    const reply = items.length
      ? `Here's ${schedDay[1]}${timeNote}: ${nameList(items)}.`
      : `Nothing on the books for ${schedDay[1]} — no closings and no tasks due${timeNote}.`;
    const cards = [];
    if (items.length) cards.push({ type: "tasks", title: `📅 ${schedDay[1] === "today" ? "Today" : "Tomorrow"} (${items.length})`, items });
    cards.push({ type: "navigate", label: "📅 Open the Calendar", target: "calendar" });
    return { reply, cards };
  }

  // ---- Tasks: what's due today / overdue ---------------------------------
  if (/\b(task|tasks|to do|todo|to-do)\b/.test(input) || /what.*(today|do i need)/.test(input) || /\boverdue\b/.test(input)) {
    if (/^(add|create|new|remind)/.test(input) === false) {
      const overdue = taskItems(tasks?.overdue).concat(taskItems(tasks?.personal?.overdue, "General"));
      const dueToday = taskItems(tasks?.dueToday).concat(taskItems(tasks?.personal?.dueToday, "General"));
      const wantOverdueOnly = /\boverdue\b/.test(input) && !/today/.test(input);
      const cards = [];
      if (wantOverdueOnly) {
        cards.push({ type: "tasks", title: `⚠️ Overdue (${overdue.length})`, items: overdue });
      } else {
        if (overdue.length) cards.push({ type: "tasks", title: `⚠️ Overdue (${overdue.length})`, items: overdue });
        cards.push({ type: "tasks", title: `📅 Due today (${dueToday.length})`, items: dueToday });
      }
      const total = (wantOverdueOnly ? overdue.length : overdue.length + dueToday.length);
      let reply;
      if (total === 0) {
        reply = "You're all caught up — nothing urgent right now. 🎉";
      } else if (wantOverdueOnly) {
        reply = `You have ${overdue.length} overdue task${overdue.length === 1 ? "" : "s"}: ${nameList(overdue)}.`;
      } else {
        reply = `You have ${dueToday.length} due today${overdue.length ? ` and ${overdue.length} overdue` : ""}.`;
        if (overdue.length) reply += ` Overdue: ${nameList(overdue)}.`;
        if (dueToday.length) reply += ` Due today: ${nameList(dueToday)}.`;
      }
      cards.push({ type: "navigate", label: "☀️ Open Win the Day", target: "home" });
      return { reply, cards };
    }
  }

  // ---- Create a task: "remind me to…" / "add a task…" --------------------
  m = input.match(/^(?:remind me to|remind me|add (?:a )?task(?: to)?|create (?:a )?task(?: to)?|new task)\s+(.+)$/);
  if (m) {
    const due = parseDue(m[1], now);
    const title = stripDuePhrase(m[1]);
    if (!title) return { reply: "What should the task say?", cards: [] };
    return {
      reply: `Here's the task — confirm to add it${due ? ` (due ${due})` : ""}.`,
      cards: [{ type: "create_task", task: { title: title.charAt(0).toUpperCase() + title.slice(1), due_date: due, category: "Follow Up", notes: null } }],
    };
  }

  // ---- Help: "how do I…" --------------------------------------------------
  if (/^(how do i|how can i|how to|where do i|where can i)\b/.test(input) || /\bhelp\b/.test(input)) {
    const hits = searchGuides(guides, input);
    if (hits.length) {
      return {
        reply: `Here's how:`,
        cards: hits.map(g => ({ type: "help", title: g.title, steps: g.steps || [] }))
          .concat([{ type: "navigate", label: "❓ Open the full Help Center", target: "help" }]),
      };
    }
    return {
      reply: "I don't have a guide for that yet — the Help Center has the full how-to library, and Contact Support can reach a human.",
      cards: [{ type: "navigate", label: "❓ Open Help Center", target: "help" }],
    };
  }

  // ---- Deal status / open a deal by address ------------------------------
  m = input.match(/^(?:open|show|pull up|go to|whats? (?:the )?status (?:of|on)|status (?:of|on))\s+(.+)$/);
  if (m) {
    const q = m[1].replace(/\b(the|deal|transaction|property|listing)\b/g, " ").trim();
    // A navigation word beats an address ("open contacts")
    const navHit = NAV_TARGETS.find(n => n.words.some(w => norm(q) === w || norm(q).startsWith(w)));
    if (navHit) return { reply: `Opening ${navHit.label.replace(/^\S+\s/, "")}…`, cards: [{ type: "navigate", label: navHit.label, target: navHit.target }] };
    const matches = findDeals(deals, q);
    if (matches.length === 1) {
      const d = matches[0];
      return { reply: dealCardSummary(d), cards: [{ type: "deal", deal: d }] };
    }
    if (matches.length > 1) {
      return {
        reply: `${matches.length} deals match — which one?`,
        cards: [{ type: "choices", options: matches.slice(0, 6).map(d => ({ label: d.address, send: `open ${d.address}` })) }],
      };
    }
    return { reply: `I couldn't find a deal matching “${q}”.`, cards: [{ type: "navigate", label: "🏠 Open My Deals", target: "dashboard" }] };
  }

  // ---- Unread messages ----------------------------------------------------
  if (/\b(unread|new messages?|any messages?)\b/.test(input)) {
    return {
      reply: "Your new-message alerts live at the top of the Today screen.",
      cards: [{ type: "navigate", label: "💬 Check messages", target: "home" }],
    };
  }

  // ---- Bare navigation ("contacts", "take me to the CMA") ----------------
  const navHit = NAV_TARGETS.find(n => n.words.some(w => input === w || input.includes(w)));
  if (navHit) {
    return { reply: `Here you go:`, cards: [{ type: "navigate", label: navHit.label, target: navHit.target }] };
  }

  return null;
}
