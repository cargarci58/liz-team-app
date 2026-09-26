// Phone-call scripts — prospecting, follow-up, and objection answers.
//
// ONE source for both places they show up:
//   • Scripts page → "📞 Calls" tab (ScriptsPage.jsx)
//   • The 📜 Scripts button on call screens (components/CallScriptPanel.jsx)
// Edit wording here and both update.
//
// [name] is filled in automatically with the contact's first name on the call
// screen. Every other [bracket] is the agent's to fill in. Statewide-safe:
// nothing is hardcoded to a city, county, or tenant.

export const CALL_SCRIPT_GROUPS = [
  {
    key: "new_lead",
    situation: "First call to a new lead",
    why: "They just reached out (intake link, sign call, website). Speed and curiosity win — ask, don't pitch.",
    scripts: [
      { title: "Fast, friendly, curious",
        body: "“Hi [name], this is [your name] with [brokerage] — you reached out about [buying / selling / a home in (area)], and I wanted to get back to you right away. Do you have two minutes? … Great. Tell me a little about what’s got you thinking about a move?”" },
      { title: "Find the timeline and the why",
        body: "“That makes sense. If everything lined up perfectly, when would you ideally like to be [in your new home / moved out]? … And what’s driving that — is it more about [space, schools, work, being closer to family]? … Have you had a chance to talk with a lender yet, or would it help if I connected you with one I trust?”" },
      { title: "Set the next step",
        body: "“Here’s what I’d suggest: let’s set up a quick [20-minute call / coffee] so I can learn exactly what you need and walk you through how this works in today’s market. Does [day] at [time] or [day] at [time] work better for you?”" },
    ],
  },
  {
    key: "followup",
    situation: "Following up on what you promised",
    why: "You told them you’d call back about something specific — lead with it so they know you listened.",
    scripts: [
      { title: "Lead with the promise",
        body: "“Hi [name], it’s [your name] — last time we talked you mentioned [what you promised to follow up on], and I told you I’d check back in. How did that go?”" },
      { title: "Bring something useful",
        body: "“I was thinking about you because [a home just came on in (area) / rates moved / a home near you just sold for $___]. I wanted you to hear it from me first. Is that the kind of thing you’d still like me to keep an eye out for?”" },
    ],
  },
  {
    key: "not_now",
    situation: "Checking in on a “not right now” lead",
    why: "They weren’t ready last time. Stay helpful and low-pressure so you’re the one they call when they are.",
    scripts: [
      { title: "No-pressure check-in",
        body: "“Hi [name], it’s [your name]. No agenda — you’d mentioned you were thinking about a move [around (timeframe)], so I just wanted to check in and see if anything has changed on your end.”" },
      { title: "Keep the door open",
        body: "“Totally understand. Would it be helpful if I sent you a quick update on what homes like [yours / the ones you liked] are doing every month or so? That way when the time is right, you already know the market and there are no surprises.”" },
    ],
  },
  {
    key: "past_client",
    situation: "Past client check-in",
    why: "Your best source of referrals. Make it about them first — the ask comes naturally at the end.",
    scripts: [
      { title: "How’s the home?",
        body: "“Hi [name], it’s [your name]! I was just thinking about you — how are you enjoying the house? Has everything been holding up okay? … If you ever need a [plumber, roofer, handyman], I’ve got a list of people I trust — just ask.”" },
      { title: "The referral ask",
        body: "“I’m so glad to hear it. One quick thing — my business really runs on referrals from people like you. Is there anyone you know, a friend, a neighbor, someone at work, who’s been talking about buying or selling? I’d take great care of them.”" },
    ],
  },
  {
    key: "sphere",
    situation: "Friends, family & sphere",
    why: "People who know you but haven’t done business with you. Be yourself — real-estate talk is a side note.",
    scripts: [
      { title: "Catch up first",
        body: "“Hey [name], it’s [your name]! It’s been a while — how are you and [family / work / that trip you mentioned]? … I’m still helping people buy and sell homes, and I always like to let my favorite people know: if you or anyone you know ever has a real estate question, I’m your person.”" },
    ],
  },
  {
    key: "move_ready",
    situation: "Could they be ready to move?",
    why: "Owned for a few years, family changed, or they’ve been reading your market updates. Plant the seed with value.",
    scripts: [
      { title: "The equity check",
        body: "“Hi [name], it’s [your name]. Homes around you have changed a lot since you bought — would you like me to put together a free, no-strings update on what your home might be worth today? A lot of owners are surprised by how much equity they’ve built.”" },
      { title: "Life changes",
        body: "“Is the house still working for you the way it did when you bought it? … Sometimes families outgrow a home, or the kids move out and it’s suddenly too much. If you ever want to talk through options — even just to know the numbers — I’m happy to.”" },
    ],
  },
  {
    key: "voicemail",
    situation: "Voicemail & follow-up text",
    why: "Keep it under 20 seconds with one clear reason to call back. Only text if they’ve said texting is OK.",
    scripts: [
      { title: "20-second voicemail",
        body: "“Hi [name], it’s [your name] with [brokerage]. I’m calling about [one specific reason]. Give me a call back at [your number] — again, [your number]. Talk soon!”" },
      { title: "Follow-up text after the voicemail",
        body: "Hi [name], it’s [your name] — just left you a quick voicemail about [reason]. No rush — text or call me back whenever it’s convenient." },
    ],
  },
];

// Short answers to what people say mid-call. Tap one on the call screen.
export const CALL_OBJECTIONS = [
  { says: "“We’re just looking.”",
    answer: "“That’s perfect — most people start right there. What made you start looking now? … If the right home came up, would you want to be ready to move on it, or are you gathering info for later?”" },
  { says: "“We’re waiting for rates to come down.”",
    answer: "“A lot of people are. The trade-off is when rates drop, more buyers jump in and prices usually rise with them. You can buy now and refinance later if rates fall — but you can’t go back and get today’s price. Want me to have a lender run both scenarios so you can compare?”" },
  { says: "“I already have an agent.”",
    answer: "“That’s great — I’d never want to get in the way of that. If anything ever changes, or if someone you know needs help, I’d love to be your backup. Mind if I stay in touch now and then?”" },
  { says: "“Just send me some listings.”",
    answer: "“Happy to! So I don’t flood your inbox with the wrong ones — what are the two or three things a home absolutely has to have? … And price-wise, what range feels comfortable?”" },
  { says: "“We’re not ready yet — maybe next year.”",
    answer: "“That’s smart to think ahead. The people who get the best results usually start planning 6–12 months out. Would it help if we sat down once, no commitment, so you know exactly what to expect and what to do first?”" },
  { says: "“What’s my home worth? Just curious.”",
    answer: "“Great question — I can put together a real market analysis for you, not a website guess. It takes me a day or so. Is there anything you’ve updated in the home I should factor in?”" },
  { says: "“Please don’t call me again.”",
    answer: "“Absolutely, I’ll take you off my list right now. Thank you for letting me know, and have a great day.” — Then log the call as 🛑 Do Not Contact." },
];

// Which script groups fit THIS contact, best first. Uses only fields the call
// screens already load: contact_type, temperature, next_call_reason,
// last_contacted_at, last_outcome, batch_kind.
export function recommendCallScriptKeys(contact) {
  const c = contact || {};
  const type = String(c.contact_type || "").toLowerCase();
  const keys = [];
  if (c.next_call_reason || c.batch_kind === "followup") keys.push("followup");
  if ((type === "lead" || type === "buyer" || type === "seller" || !type) && !c.last_contacted_at) keys.push("new_lead");
  if (c.last_outcome === "spoke_not_now" || c.temperature === "cold") keys.push("not_now");
  if (type === "past_client") keys.push("past_client", "move_ready");
  if (type === "sphere" || type === "vendor" || type === "other") keys.push("sphere", "move_ready");
  if (type === "seller") keys.push("move_ready");
  if (type === "lead" || type === "buyer" || type === "seller") keys.push("not_now");
  if (c.last_outcome === "left_vm" || c.last_outcome === "no_answer") keys.push("voicemail");
  if (!keys.length) keys.push("followup");
  return [...new Set(keys)];
}

// Fill [name] with the contact's first name; leave every other bracket alone.
export function fillCallScript(body, contact) {
  const first = String((contact && contact.first_name) || "").trim();
  return first ? String(body).replace(/\[name\]/g, first) : String(body);
}
