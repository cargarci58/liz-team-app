# AI Assistant — server install (3 steps, ~5 minutes)

The app now ships with an AI Assistant (the floating 🎙 button). The UI is
live already: **without any server change it runs in offline mode**, handling
the core commands (dial a contact, today's tasks, open a deal, add a task,
help lookups) with built-in pattern matching.

To turn on the full AI brain — natural language, clarifying questions,
context awareness — install this route in the **liz-team-server-api** repo
(the Railway app):

## 1. Copy the route file

Copy `assistant-route.js` (next to this file) into the server repo, e.g.:

```
liz-team-server-api/
  routes/assistant-route.js   ← here
```

No new npm packages are needed — it uses Express and Node's built-in fetch
(Node 18+).

## 2. Mount it behind the existing auth

Wherever the other authenticated routes are mounted:

```js
const assistantRoute = require("./routes/assistant-route");

// Use the SAME auth middleware the other agent endpoints use, so
// req.user is validated exactly like everywhere else:
app.use(requireAuth, assistantRoute());
```

This exposes `POST /assistant`, which the app is already calling.

## 3. Set the API key

In Railway → Variables, add:

```
ANTHROPIC_API_KEY = sk-ant-...        (from console.anthropic.com)
ASSISTANT_MODEL   = claude-sonnet-5   (optional — this is the default)
```

Deploy. The app detects the endpoint automatically — no frontend change or
redeploy needed. (While the endpoint is missing or erroring, the panel
silently falls back to offline mode, so shipping this is zero-risk.)

## How it works / security properties

- **The AI never touches the database.** Each request carries a compact
  snapshot of the logged-in agent's own contacts, deals, and tasks (built
  client-side from data the agent already has). Claude answers only from
  that snapshot — it cannot see anyone else's data because it is never
  given any.
- **The AI cannot write, send, or dial anything.** Its only "write" is a
  *proposal* card (e.g. a new task) that the agent must tap to confirm;
  the save then goes through the normal authenticated endpoint.
- **One API call per inquiry**, structured output enforced by a forced
  tool schema. Typical cost is a fraction of a cent per question.
- How-to answers come **only from the Help Center guide library** the app
  sends along; if no guide matches, the AI says so instead of inventing
  steps.

## Costs & limits

Each inquiry sends roughly 5–20k input tokens (snapshot + guides) and gets
~200 output tokens back. At team scale this is dollars per month, not per
day. If usage grows, add your standard rate limiter to the mount line like
any other route.
