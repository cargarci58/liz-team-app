// ═══════════════════════════════════════════════════════════════
// assistant-route.js — DROP-IN Express route for the app's AI Assistant.
//
// This file belongs in the SERVER repo (liz-team-server-api). It is kept
// here in the app repo because the app repo is where the assistant was
// built; copy it over and mount it — see ASSISTANT-SETUP.md next to
// this file for the 3-step install.
//
// What it does
// ────────────
// POST /assistant receives, from the logged-in app:
//   {
//     message:  "dial maria",                     // what the agent asked
//     history:  [{ role, text }, ...],            // last few turns
//     context:  { screen, dealAddress },          // where they are in the app
//     snapshot: { contacts, deals, tasks },       // THEIR data, sent by the app
//     guides:   [{ heading, items: [{title, steps}] }]  // Help Center library
//   }
// and returns Claude's structured answer:
//   { success, reply, speak, cards: [...] }
//
// Design choices that keep this file simple and safe:
//  • NO database access. The app sends a compact snapshot of the agent's
//    own data with each request, and Claude answers ONLY from it. The AI
//    can never see another agent's data because it is never given any.
//  • NO tool-use loop. Claude is forced to answer through a single
//    "respond" tool whose JSON schema matches the cards the app renders.
//    One API call per inquiry, nothing to orchestrate.
//  • NO write access. The only "write" the AI can express is a
//    create_task PROPOSAL card — the app shows it to the agent, and the
//    agent's confirming tap does the actual save through the normal
//    authenticated /personal-tasks endpoint.
//  • Zero new dependencies: uses global fetch (Node 18+) and Express.
//
// Env:  ANTHROPIC_API_KEY  (required)
//       ASSISTANT_MODEL    (optional, default "claude-sonnet-5")
// ═══════════════════════════════════════════════════════════════

const express = require("express");

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ASSISTANT_MODEL || "claude-sonnet-5";

// The single forced tool: its schema IS the app's card protocol.
const RESPOND_TOOL = {
  name: "respond",
  description: "Deliver your answer to the agent. Always use this tool.",
  input_schema: {
    type: "object",
    required: ["reply", "cards"],
    properties: {
      reply: {
        type: "string",
        description: "1-2 friendly sentences shown (and read aloud) to the agent. Plain language, no markdown.",
      },
      speak: {
        type: "string",
        description: "Optional shorter version for text-to-speech. Omit to speak `reply` as-is.",
      },
      cards: {
        type: "array",
        description: "UI cards the app renders under your reply. Use [] for a plain answer or a clarifying question with no choices.",
        items: {
          type: "object",
          required: ["type"],
          properties: {
            type: {
              type: "string",
              enum: ["contact", "choices", "tasks", "deal", "navigate", "create_task", "help"],
            },
            // contact — tap-to-call/text/email card. MUST be copied verbatim
            // from the snapshot (id, name, phone, email, role, company).
            contact: { type: "object" },
            // choices — clarifying-question buttons. `send` is the text
            // submitted back when tapped; make it unambiguous.
            options: {
              type: "array",
              items: {
                type: "object",
                required: ["label", "send"],
                properties: { label: { type: "string" }, send: { type: "string" } },
              },
            },
            // tasks — a titled list. items: {title, due, where}.
            title: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: { title: { type: "string" }, due: { type: "string" }, where: { type: "string" } },
              },
            },
            // deal — a deal summary + "Open" button. Copy verbatim from the
            // snapshot (id, address, status, closingDate, price). `tab` may be
            // overview | milestones | documents | offers | parties | messages.
            deal: { type: "object" },
            tab: { type: "string" },
            // navigate — a button that jumps to an app screen.
            label: { type: "string" },
            target: {
              type: "string",
              enum: ["home", "dashboard", "contacts", "popbys", "scripts", "cma", "expenses", "forms", "growthplan", "calendar", "reports", "vendors", "help", "new"],
            },
            // create_task — a PROPOSAL the agent must confirm.
            // task: {title, due_date (YYYY-MM-DD|null), category, notes}
            task: { type: "object" },
            // help — numbered how-to steps, ONLY from the provided guides.
            steps: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  },
};

function systemPrompt(body) {
  const { context = {}, snapshot = {}, guides = [] } = body || {};
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return [
    "You are the in-app assistant for The Liz Team real-estate platform. The person talking to you is a real-estate agent using the app, possibly by voice while busy. Be fast, warm, and concise.",
    "",
    "You can do three things, expressed ONLY through the `respond` tool's cards:",
    "1. DO — surface a contact to call/text/email (contact card), propose a task (create_task card).",
    "2. SHOW — list tasks (tasks card), summarize/open a deal (deal card), jump to a screen (navigate card).",
    "3. TEACH — answer how-do-I questions with numbered steps (help card) taken ONLY from the GUIDES below.",
    "",
    "Hard rules:",
    "• Answer ONLY from the DATA and GUIDES given here. Never invent contacts, deals, tasks, phone numbers, or app instructions. Copy contact/deal objects into cards verbatim.",
    "• Ambiguous request (two Marias, several matching deals)? Ask ONE short clarifying question with a choices card. Exactly one match? Act, don't ask.",
    "• If no data matches, say so plainly and offer the closest useful navigate card.",
    "• If no guide covers a how-to question, say you don't have a guide for it and offer the help target — never improvise steps.",
    "• You cannot send, save, or change anything. A create_task card is a proposal the agent confirms. Requests to email/text a client get the contact card (the agent sends it themselves).",
    "• `reply` is spoken aloud: 1-2 short sentences, no markdown, no lists — details go in cards.",
    "",
    `Today's date (Eastern): ${today}. Due dates are YYYY-MM-DD.`,
    `The agent is currently on the "${context.screen || "unknown"}" screen${context.dealAddress ? `, viewing the deal at ${context.dealAddress}` : ""}. "Here"/"this deal" means that.`,
    "",
    "DATA (this agent's own records):",
    JSON.stringify(snapshot),
    "",
    "GUIDES (the app's help library):",
    JSON.stringify(guides),
  ].join("\n");
}

module.exports = function assistantRoute({ apiKey = process.env.ANTHROPIC_API_KEY, model = MODEL } = {}) {
  const router = express.Router();

  router.post("/assistant", express.json({ limit: "1mb" }), async (req, res) => {
    try {
      if (!apiKey) return res.status(503).json({ success: false, error: "ANTHROPIC_API_KEY not configured" });
      // Auth: mount this router behind your existing auth middleware (see
      // ASSISTANT-SETUP.md). Belt-and-suspenders: refuse anonymous calls.
      if (!req.headers.authorization) return res.status(401).json({ success: false, error: "auth required" });

      const { message, history = [] } = req.body || {};
      if (!message || typeof message !== "string") {
        return res.status(400).json({ success: false, error: "message required" });
      }

      // Rebuild the short conversation for continuity ("actually text her
      // instead" needs to know who "her" was).
      const messages = [];
      history.slice(-8).forEach(h => {
        if (h && h.text) messages.push({ role: h.role === "assistant" ? "assistant" : "user", content: String(h.text).slice(0, 2000) });
      });
      // The API requires alternating turns starting with "user"; collapse
      // any accidental doubles.
      const collapsed = [];
      messages.forEach(m => {
        if (collapsed.length && collapsed[collapsed.length - 1].role === m.role) {
          collapsed[collapsed.length - 1].content += "\n" + m.content;
        } else collapsed.push(m);
      });
      if (collapsed.length && collapsed[0].role === "assistant") collapsed.shift();
      collapsed.push({ role: "user", content: String(message).slice(0, 2000) });

      const r = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1200,
          system: systemPrompt(req.body),
          tools: [RESPOND_TOOL],
          tool_choice: { type: "tool", name: "respond" },
          messages: collapsed,
        }),
      });

      if (!r.ok) {
        const errText = await r.text().catch(() => "");
        console.error("[assistant] Anthropic API error", r.status, errText.slice(0, 300));
        return res.status(502).json({ success: false, error: "AI service error" });
      }

      const data = await r.json();
      const toolUse = (data.content || []).find(b => b.type === "tool_use" && b.name === "respond");
      if (!toolUse || !toolUse.input) {
        return res.status(502).json({ success: false, error: "no structured answer" });
      }

      const { reply = "", speak = "", cards = [] } = toolUse.input;
      return res.json({ success: true, reply, speak: speak || reply, cards: Array.isArray(cards) ? cards : [] });
    } catch (e) {
      console.error("[assistant] error:", e.message);
      return res.status(500).json({ success: false, error: "assistant failed" });
    }
  });

  // ————— Voice transcription fallback —————————————————————————————
  // Browsers without built-in speech recognition (Firefox, Brave, some
  // Android WebViews) record audio in the app and send it here to be
  // turned into text. Uses OpenAI Whisper (the industry-standard cheap
  // STT API, ~$0.006/min) via OPENAI_API_KEY. Optional: without the key
  // this returns 503 and the app tells the agent to type instead —
  // nothing breaks.
  router.post("/assistant/transcribe", express.json({ limit: "12mb" }), async (req, res) => {
    try {
      const sttKey = process.env.OPENAI_API_KEY;
      if (!sttKey) return res.status(503).json({ success: false, error: "transcription not configured" });
      if (!req.headers.authorization) return res.status(401).json({ success: false, error: "auth required" });

      const { audio, mime } = req.body || {};
      if (!audio || typeof audio !== "string" || audio.length > 12 * 1024 * 1024) {
        return res.status(400).json({ success: false, error: "audio (base64) required" });
      }

      const buf = Buffer.from(audio, "base64");
      const ext = /mp4/.test(mime || "") ? "mp4" : /ogg/.test(mime || "") ? "ogg" : "webm";
      const fd = new FormData();
      fd.append("file", new Blob([buf], { type: mime || "audio/webm" }), "voice." + ext);
      fd.append("model", "whisper-1");
      fd.append("language", "en");

      const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: "Bearer " + sttKey },
        body: fd,
      });
      if (!r.ok) {
        const errText = await r.text().catch(() => "");
        console.error("[assistant/transcribe] STT error", r.status, errText.slice(0, 300));
        return res.status(502).json({ success: false, error: "transcription service error" });
      }
      const d = await r.json();
      return res.json({ success: true, text: d.text || "" });
    } catch (e) {
      console.error("[assistant/transcribe] error:", e.message);
      return res.status(500).json({ success: false, error: "transcription failed" });
    }
  });

  return router;
};
