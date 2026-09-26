import { describe, it, expect } from "vitest";
import { planRoute, simulate, toMin, fmtTime } from "./tourRoute";

// Homes strung along a line east of the start, deliberately shuffled.
const start = { lat: 28.30, lng: -81.40 };
const at = (id, dx, extra = {}) => ({ id, lat: 28.30, lng: -81.40 + dx, ...extra });

describe("tourRoute", () => {
  it("orders homes to avoid back-and-forth", () => {
    const stops = [at("far", 0.20), at("near", 0.02), at("mid", 0.10), at("mid2", 0.14)];
    const ids = planRoute(stops, { start, startTime: "10:00", minutesPerStop: 20 }).map(s => s.id);
    expect(ids).toEqual(["near", "mid", "mid2", "far"]);
  });

  it("honors a fixed appointment window even if it means driving more", () => {
    // "far" can only be shown 10:00–10:45 (~35 min away) — no time for a stop before it.
    const stops = [at("near", 0.02), at("mid", 0.10), at("far", 0.20, { appt_start: "10:00", appt_end: "10:45" })];
    const opts = { start, startTime: "10:00", minutesPerStop: 20 };
    const order = planRoute(stops, opts);
    expect(order[0].id).toBe("far");
    expect(simulate(order, opts).lateMin).toBe(0);
  });

  it("waits for a window that opens later instead of arriving early", () => {
    const opts = { start, startTime: "10:00", minutesPerStop: 20 };
    const r = simulate([at("a", 0.02, { appt_start: "11:00", appt_end: "12:00" })], opts);
    expect(r.legs[0].begin).toBe(toMin("11:00"));
    expect(r.legs[0].wait).toBeGreaterThan(0);
  });

  it("keeps homes that couldn't be mapped at the end", () => {
    const stops = [{ id: "nomap", lat: null, lng: null }, at("a", 0.05), at("b", 0.01)];
    const ids = planRoute(stops, { start }).map(s => s.id);
    expect(ids[ids.length - 1]).toBe("nomap");
    expect(ids.slice(0, 2)).toEqual(["b", "a"]);
  });

  it("handles 10 homes with the fast planner", () => {
    const stops = Array.from({ length: 10 }, (_, i) => at("h" + i, ((i * 7) % 10) * 0.02 + 0.01));
    const ids = planRoute(stops, { start }).map(s => s.id);
    const lngs = ids.map(id => stops.find(s => s.id === id).lng);
    expect([...lngs].sort((a, b) => a - b)).toEqual(lngs); // straight out, no doubling back
  });

  it("formats times", () => {
    expect(fmtTime(toMin("13:05"))).toBe("1:05 PM");
    expect(fmtTime(toMin("09:30"))).toBe("9:30 AM");
  });
});
