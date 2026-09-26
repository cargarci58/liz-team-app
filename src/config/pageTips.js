// ═══════════════════════════════════════════════════════════════
// "First time here?" — the three lines a brand-new agent sees on every page.
//
// Every entry has the same shape, and the shape is the point:
//   what     — what this page is FOR, in one plain sentence
//   doFirst  — the ONE thing to do first (not a menu of options)
//   why      — the money or time reason an agent should care
//   guide    — search term for the Help Center's guide library ("Show me how")
//   action   — optional: { label, key } for a button that does the thing.
//              Keys resolve to real handlers in App.jsx / TransactionDetail.
//
// Rules for writing these (Carlos, 9/20 — the agents using this app may never
// have done lead generation, tracked their finances, or used a tool like this):
//   1. Plain English over the correct term. "People who might move soon", not
//      "lead scoring". If a word needs explaining, don't use it.
//   2. One action. A rookie given three choices makes none.
//   3. Name the payoff. Nobody does a pop-by because the page exists; they do
//      it because it's how they become the agent someone calls in two years.
//
// This file is CONTENT, not code — edit the words freely. Nothing here changes
// how the app works; it only changes what it says.
// ═══════════════════════════════════════════════════════════════

export const PAGE_TIPS = {

  // ── The five header buttons ────────────────────────────────────
  home: {
    what: "Your to-do list for today. The app reads every deal you have and puts what needs you right here, most urgent first.",
    doFirst: "Start at the top and work down. Tap a card to do it, or \"Not today\" to push it to tomorrow.",
    why: "This is the whole app in one screen. If you only ever open this page each morning, nothing on any deal slips.",
    guide: "Win the Day",
  },
  dashboard: {
    what: "Every deal you're working — listings and buyers — as cards. Tap one to open it.",
    doFirst: "Use the dropdown to switch between what's live, what's under contract, and what's on hold.",
    why: "\"Read All\" shows only what's active, so the list stays short enough to actually scan.",
    guide: "My Deals",
  },
  new: {
    what: "Three questions to start a deal: the address, who your client is, and the price.",
    doFirst: "If you already have a signed contract, don't type — upload it instead and the app fills all of this in for you.",
    why: "Once a deal exists, the timeline, the reminders, and the client emails all build themselves. This is the one thing you have to start.",
    guide: "Start a new transaction",
    action: { label: "Upload a contract instead", key: "uploadContract" },
  },
  contacts: {
    what: "Everyone you know — past clients, people you've met, anyone who might buy or sell one day.",
    doFirst: "Add the last five people you talked to about real estate. Name and phone is enough.",
    why: "Each morning the app picks a few of these people and puts them on your call list. That call list is where your next deal comes from — but only if the people are in here.",
    guide: "Add a contact",
  },

  // ── Tools ─────────────────────────────────────────────────────
  expenses: {
    what: "How much you've made, how much you've spent, and how much you actually kept — in plain numbers.",
    doFirst: "Upload one bank statement. The app sorts every line into a category for you; you just confirm.",
    why: "Most agents find out what they really earned at tax time. This shows you every month, and it's also what your tax preparer will ask for.",
    guide: "Track expenses",
  },
  popbys: {
    what: "A plan for dropping a small gift on a past client's doorstep — who, what to bring, and the driving route.",
    doFirst: "Pick three past clients and let the app suggest a gift and write the note card.",
    why: "A $5 gift twice a year is why someone calls you — and not the agent on the billboard — when their sister wants to sell. This page makes it a two-hour afternoon instead of a project.",
    guide: "Pop-Bys",
  },
  scripts: {
    what: "Word-for-word what to say in the hard conversations — a price reduction, a nervous buyer, a seller who wants to wait — plus phone-call scripts and objection answers (also one tap away on every call screen).",
    doFirst: "Open the one for the conversation you're dreading this week and read it out loud once.",
    why: "The difference between a good agent and a great one is usually what they say in the first thirty seconds of a hard call. These are those thirty seconds, written down.",
    guide: "Scripts",
  },
  growthplan: {
    what: "You tell it what you want to earn this year. It works backwards to how many people you need to talk to each day.",
    doFirst: "Type in your income goal. That's it — the daily number appears.",
    why: "\"I want to make $100,000\" isn't a plan. \"I need to talk to six people a day\" is, and you can do that today.",
    guide: "Growth Plan",
  },
  cma: {
    what: "Figure out what a home is worth by comparing it to similar homes that sold nearby, then print a report the seller can hold.",
    doFirst: "Enter the property, add three to five recent sales from the MLS, and let the app do the math.",
    why: "Walking into a listing appointment with a printed report is how you win the listing. This builds one in about ten minutes.",
    guide: "Run a CMA",
  },
  forms: {
    what: "The official Florida forms, filled in with your details so you're never starting from a blank PDF.",
    doFirst: "Pick the form you need this week and see how much is already filled in.",
    why: "Every form you fill by hand is a place to make a mistake. These start with your brokerage, your license, and your client already typed in.",
    guide: "Send your forms",
  },
  reports: {
    what: "Your numbers — how many people you called, how many became deals, and how that's tracking against your goal.",
    doFirst: "Look at the funnel first: it shows where people drop off between \"talked to\" and \"closed\".",
    why: "You can't fix what you can't see. If forty calls became two appointments, the problem is the call, not the market — and now you know.",
    guide: "Reports",
  },

  // ── Inside a deal (tabs) ──────────────────────────────────────
  "tx:overview": {
    what: "The deal at a glance — status, key dates, price, and the one thing that needs doing next.",
    doFirst: "Check the \"Next step\" bar at the top. That's the only thing on this deal you need to think about today.",
    why: "You don't have to remember the timeline. The app does. Your job is just the next step.",
    guide: "See everything for one deal",
  },
  "tx:overview:listing": {
    what: "The deal at a glance — status, key dates, price, and the one thing that needs doing next.",
    doFirst: "When an offer comes in, tap \"Receive Offer\" and upload it. The app reads it and fills everything in.",
    why: "An offer you upload becomes a full contract timeline in about a minute. An offer you type in takes an hour, and you'll miss a date.",
    guide: "Receive an offer",
    action: { label: "Receive an offer", key: "receiveOffer" },
  },
  "tx:milestones": {
    what: "Every step from here to closing, in order, with its date. Inspection, appraisal, financing, title — all of it.",
    doFirst: "Scroll to the first step that isn't checked off. That's where you are.",
    why: "Each step already knows who to remind and when. Mark it done when it's done, and the app handles the chasing.",
    guide: "Timeline",
  },
  "tx:documents": {
    what: "Every paper on this deal in one place — the contract, disclosures, inspection report, everything.",
    doFirst: "Upload the signed contract if it isn't here. Then use \"Get signature\" on anything that still needs signing.",
    why: "No more \"can you resend that?\" Your client sees the documents you share in their own portal, and a signed copy files itself back here.",
    guide: "Share a document",
  },
  "tx:showings": {
    what: "Plan a day of home tours. Upload the MLS report and the app reads every home — address, listing agent, door codes — and puts them in the shortest driving order.",
    doFirst: "Tap \"Plan a new tour\", then in Stellar MLS pick the homes → Broker Full report → save as one PDF → Upload. Check what it read, then \"Plan my route\".",
    why: "No more driving back and forth across town or digging for lockbox codes in the car. When your buyer loves one, \"Write an offer\" fills the contract from the same report.",
    guide: "Plan a day of showings",
  },
  "tx:offers": {
    what: "Write an offer for this buyer. Answer four questions and the full Florida contract comes out filled in.",
    doFirst: "Tap \"New offer\" and choose Express. Price, deposit, financing, closing date — done.",
    why: "This replaces the form software, the retyping, and the PDF editor. It's the reason the app exists.",
    guide: "Write an offer",
  },
  "tx:parties": {
    what: "Everyone on this deal — your client, the other agent, the lender, the title company, the inspector.",
    doFirst: "Add your client with their email. Then add the other agent as soon as you know who it is.",
    why: "Every person here gets the right update at the right time, in your name. If they're not on the list, they don't get the email — and you're the one who gets the call.",
    guide: "Add a party",
    action: { label: "Add a person", key: "addParty" },
  },
  "tx:messages": {
    what: "Email and text everyone on the deal from here, so the whole conversation lives with the deal instead of in your phone.",
    doFirst: "Send your client one message from this screen so you see how it works.",
    why: "Six months from now when someone asks \"did you tell the buyer about the roof?\", the answer is right here with the date on it.",
    guide: "Messages",
  },
  "tx:seller-calc": {
    what: "What your seller actually walks away with after commissions, taxes, and closing costs — not just the sale price.",
    doFirst: "Enter the offer price and their remaining mortgage. The rest is already filled in.",
    why: "\"How much do I get?\" is the first question every seller asks. This answers it in thirty seconds, and you can print it for them.",
    guide: "Net sheet",
  },
  "tx:buyer-net": {
    what: "How much cash your buyer needs to bring to closing — down payment, closing costs, prepaids, all of it.",
    doFirst: "Enter the price and the loan type. It works out the rest.",
    why: "The number one reason a deal falls apart in the last week is a buyer who didn't know how much cash they'd need. Show them this on day one.",
    guide: "Buyer calculator",
  },
  "tx:cma": {
    what: "What this home is worth, based on what similar homes nearby actually sold for.",
    doFirst: "Add three to five recent sales and the app builds the report.",
    why: "Price it right the first time and it sells. Price it wrong and you'll be having the price-reduction conversation in three weeks.",
    guide: "Run a CMA",
  },
};

// Pick the right tip for a deal tab, with a listing-specific variant where one exists.
// ── Which scenes of the narrated walkthrough explain which page ─────────────
// Scene numbers are the "learn the app" cut in public/tour/index.html
// (chapter.scene). The "First time here?" bar plays exactly these, in order,
// then stops — a one-minute clip about THIS page, in Kristen's voice, instead
// of three lines of text. Add a scene here when you add one to the tour.
export const PAGE_SCENES = {
  // Scene numbers = chapter.scene of the "learn the app" cut (public/tour).
  // Every page plays its whole chapter — every section of that page explained.
  home: ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "1.8", "1.9", "1.10", "1.11", "1.12", "1.13"],
  dashboard: ["2.1", "2.2"],
  new: ["3.2", "3.1", "3.3"],
  contacts: ["11.1", "11.2", "1.5", "1.7"],
  expenses: ["13.1", "13.2"],
  popbys: ["12.1", "1.9"],
  scripts: ["12.2"],
  growthplan: ["14.1"],
  cma: ["15.1"],
  forms: ["15.2"],
  reports: ["14.2"],
  "tx:overview": ["4.1", "4.2"],
  "tx:overview:listing": ["4.1", "4.2", "7.2", "7.3"],
  "tx:milestones": ["5.1", "5.2"],
  "tx:documents": ["6.1", "6.2"],
  "tx:documents:listing": ["6.1", "6.2", "7.3"],
  "tx:offers": ["7.1"],
  "tx:offers:listing": ["7.2"],
  "tx:parties": ["8.1", "8.2"],
  "tx:messages": ["9.1", "9.2"],
  "tx:seller-calc": ["10.1"],
  "tx:buyer-net": ["10.1"],
  "tx:cma": ["15.1"],
};
export function dealTabScenes(tabId, { isListingSide } = {}) {
  if (isListingSide && PAGE_SCENES["tx:" + tabId + ":listing"]) return PAGE_SCENES["tx:" + tabId + ":listing"];
  return PAGE_SCENES["tx:" + tabId] || null;
}

export function dealTabTip(tabId, { isListingSide } = {}) {
  if (tabId === "overview" && isListingSide && PAGE_TIPS["tx:overview:listing"]) return PAGE_TIPS["tx:overview:listing"];
  return PAGE_TIPS["tx:" + tabId] || null;
}
