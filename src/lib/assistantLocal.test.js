import { describe, it, expect } from "vitest";
import { routeLocal, parseDue, findContacts, findDeals, searchGuides } from "./assistantLocal.js";

const CONTACTS = [
  { id: "c1", name: "Maria Gonzalez", phone: "407-555-0101", email: "mg@x.com", role: "Buyer" },
  { id: "c2", name: "Maria Lopez", phone: "407-555-0102", email: "ml@x.com", role: "Lender" },
  { id: "c3", name: "John Smith", phone: "407-555-0103", email: "js@x.com", role: "Seller" },
];

const DEALS = [
  { id: "t1", address: "456 Ocean Drive", status: "Under Contract", closingDate: "2026-09-01" },
  { id: "t2", address: "123 Palm Ave", status: "Active", closingDate: "" },
  { id: "t3", address: "9 Ocean View Ct", status: "Closing", closingDate: "2026-08-20" },
];

const TASKS = {
  overdue: [{ name: "Order survey", dueDate: "2026-08-08", address: "123 Palm Ave" }],
  dueToday: [{ name: "Send welcome email", dueDate: "2026-08-11", address: "456 Ocean Drive" }],
  personal: { overdue: [], dueToday: [{ title: "Renew license", due_date: "2026-08-11" }] },
};

const GUIDES = [
  {
    heading: "Money",
    items: [
      { title: "Upload a bank statement", steps: ["Open Financials.", "Tap Upload.", "Pick the PDF."] },
      { title: "Share a document with a client", steps: ["Open the deal.", "Documents tab.", "Tap Share."] },
    ],
  },
];

const CTX = { contacts: CONTACTS, deals: DEALS, tasks: TASKS, guides: GUIDES, now: new Date("2026-08-11T15:00:00Z") };

describe("contact intents", () => {
  it("dials a uniquely-matched contact", () => {
    const r = routeLocal("dial john", CTX);
    expect(r.cards[0].type).toBe("contact");
    expect(r.cards[0].contact.name).toBe("John Smith");
  });

  it("asks which Maria when ambiguous, with tappable choices", () => {
    const r = routeLocal("call Maria", CTX);
    expect(r.cards[0].type).toBe("choices");
    expect(r.cards[0].options.map(o => o.label)).toEqual([
      "Maria Gonzalez (Buyer)",
      "Maria Lopez (Lender)",
    ]);
    // Tapping a choice re-sends an unambiguous command
    expect(routeLocal(r.cards[0].options[0].send, CTX).cards[0].contact.id).toBe("c1");
  });

  it("handles a missing contact gracefully", () => {
    const r = routeLocal("call Bruno", CTX);
    expect(r.reply).toMatch(/couldn't find/i);
  });

  it("full-name match narrows to one", () => {
    expect(findContacts(CONTACTS, "maria lopez")).toHaveLength(1);
  });
});

describe("task intents", () => {
  it("lists today's and overdue tasks", () => {
    const r = routeLocal("what are my tasks today", CTX);
    const titles = r.cards.filter(c => c.type === "tasks").flatMap(c => c.items.map(i => i.title));
    expect(titles).toContain("Order survey");
    expect(titles).toContain("Send welcome email");
    expect(titles).toContain("Renew license");
    expect(r.reply).toMatch(/2 due today/);
  });

  it("overdue-only when asked", () => {
    const r = routeLocal("what's overdue", CTX);
    const taskCards = r.cards.filter(c => c.type === "tasks");
    expect(taskCards).toHaveLength(1);
    expect(taskCards[0].title).toMatch(/Overdue \(1\)/);
  });

  it("proposes (not creates) a task from 'remind me', with parsed due date", () => {
    const r = routeLocal("remind me to follow up with the smiths in 3 days", CTX);
    expect(r.cards[0].type).toBe("create_task");
    expect(r.cards[0].task.title).toMatch(/follow up with the smiths/i);
    expect(r.cards[0].task.due_date).toBe("2026-08-14");
  });
});

describe("parseDue", () => {
  const now = new Date("2026-08-11T15:00:00Z");
  it("today / tomorrow / next week / in N days", () => {
    expect(parseDue("today", now)).toBe("2026-08-11");
    expect(parseDue("tomorrow", now)).toBe("2026-08-12");
    expect(parseDue("next week", now)).toBe("2026-08-18");
    expect(parseDue("in 10 days", now)).toBe("2026-08-21");
    expect(parseDue("in 2 weeks", now)).toBe("2026-08-25");
  });
  it("returns null when no date phrase", () => {
    expect(parseDue("call the lender", now)).toBeNull();
  });
});

describe("deal intents", () => {
  it("opens a uniquely-matched deal with a status summary", () => {
    const r = routeLocal("what's the status of palm ave", CTX);
    expect(r.cards[0].type).toBe("deal");
    expect(r.cards[0].deal.id).toBe("t2");
  });

  it("disambiguates multiple address matches", () => {
    const r = routeLocal("open ocean", CTX);
    expect(r.cards[0].type).toBe("choices");
    expect(r.cards[0].options).toHaveLength(2);
  });

  it("findDeals requires all tokens", () => {
    expect(findDeals(DEALS, "ocean drive")).toHaveLength(1);
  });
});

describe("help intents", () => {
  it("answers 'how do I' from the guide library", () => {
    const r = routeLocal("how do i upload a bank statement", CTX);
    const help = r.cards.find(c => c.type === "help");
    expect(help.title).toBe("Upload a bank statement");
    expect(help.steps).toHaveLength(3);
  });

  it("admits when no guide matches instead of inventing steps", () => {
    const r = routeLocal("how do i fly a helicopter", CTX);
    expect(r.reply).toMatch(/don't have a guide/i);
    expect(r.cards[0].target).toBe("help");
  });

  it("searchGuides ranks title hits above body hits", () => {
    const hits = searchGuides(GUIDES, "share a document");
    expect(hits[0].title).toBe("Share a document with a client");
  });
});

describe("navigation and fallback", () => {
  it("bare page names navigate", () => {
    expect(routeLocal("open contacts", CTX).cards[0].target).toBe("contacts");
    expect(routeLocal("calendar", CTX).cards[0].target).toBe("calendar");
  });

  it("unread messages points at the Today screen", () => {
    expect(routeLocal("do i have unread messages", CTX).cards[0].target).toBe("home");
  });

  it("returns null for gibberish so the panel can show capability hints", () => {
    expect(routeLocal("purple monkey dishwasher", CTX)).toBeNull();
  });
});

describe("task replies name the work, not just count it", () => {
  it("includes overdue and due-today task names in the reply text", () => {
    const r = routeLocal("what are my tasks today", CTX);
    expect(r.reply).toMatch(/Order survey \(123 Palm Ave\)/);
    expect(r.reply).toMatch(/Send welcome email/);
  });
  it("overdue-only reply names the overdue item", () => {
    const r = routeLocal("what's overdue", CTX);
    expect(r.reply).toMatch(/Order survey/);
  });
});
