// Showing-tour route planner. Orders a day of homes so the agent drives the
// least and still makes every fixed appointment window, then builds the
// arrival/leave schedule.
//
// Distances are straight-line × a road factor (free, no map API) — good for
// ORDERING stops; Google Maps gives real drive times when navigating.
//
// stop:  { id, lat, lng, appt_start: "HH:MM"|null, appt_end: "HH:MM"|null }
// start: { lat, lng } | null   (null = start at the first home)

const ROAD_FACTOR = 1.3;   // roads aren't straight lines
const AVG_MPH = 30;        // suburban/city driving
const PARK_MIN = 3;        // park, walk up, find the lockbox
const UNKNOWN_LEG_MIN = 15; // a home we couldn't place on the map
const LATE_PENALTY = 60;   // 1 min late ≈ 60 min of extra driving — windows win
const EXACT_MAX = 8;       // ≤8 homes: try every order; more: fast heuristic

export function toMin(hhmm) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(String(hhmm).trim())) return null;
  const [h, m] = String(hhmm).trim().split(":").map(Number);
  return h * 60 + m;
}
export function fmtTime(min) {
  if (min == null || isNaN(min)) return "";
  const m = Math.round(min);
  let h = Math.floor(m / 60) % 24; const mm = String(m % 60).padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${h}:${mm} ${ap}`;
}
export function milesBetween(a, b) {
  if (!a || !b || a.lat == null || b.lat == null || a.lng == null || b.lng == null) return null;
  const R = 3958.8, r = (d) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) * ROAD_FACTOR;
}
function legMinutes(a, b) {
  if (!a) return { min: 0, miles: 0 };            // no start address: the day begins at stop 1
  const mi = milesBetween(a, b);
  if (mi == null) return { min: UNKNOWN_LEG_MIN, miles: null };
  return { min: mi < 0.05 ? 1 : (mi / AVG_MPH) * 60 + PARK_MIN, miles: mi };
}

// Walk the stops in this order and produce the day's schedule.
export function simulate(order, { start = null, startTime = "10:00", minutesPerStop = 20 } = {}) {
  let clock = toMin(startTime) ?? 600;
  let prev = start && start.lat != null ? start : null;
  let lateMin = 0, miles = 0, first = true;
  const legs = order.map((s) => {
    const leg = legMinutes(first && !prev ? null : prev, s);
    first = false;
    const arrive = clock + leg.min;
    const ws = toMin(s.appt_start), we = toMin(s.appt_end);
    const begin = ws != null ? Math.max(arrive, ws) : arrive;
    const deadline = we != null ? we : (ws != null ? ws + 15 : null); // a single time = arrive within 15 min
    const late = deadline != null && begin > deadline ? begin - deadline : 0;
    lateMin += late;
    if (leg.miles) miles += leg.miles;
    const depart = begin + minutesPerStop;
    clock = depart;
    prev = s.lat != null ? s : prev;
    return { id: s.id, driveMin: Math.round(leg.min), miles: leg.miles, arrive, begin, wait: Math.round(begin - arrive), depart, late: Math.round(late) };
  });
  return { legs, finish: clock, lateMin: Math.round(lateMin), miles };
}
const cost = (order, opts) => { const r = simulate(order, opts); return r.finish + LATE_PENALTY * r.lateMin; };

// Best visiting order. Homes we couldn't map stay at the end in their
// current order (the agent can move them).
export function planRoute(stops, opts = {}) {
  const mapped = stops.filter(s => s.lat != null && s.lng != null);
  const unmapped = stops.filter(s => s.lat == null || s.lng == null);
  let best = mapped;
  if (mapped.length > 1 && mapped.length <= EXACT_MAX) {
    let bestCost = Infinity;
    const used = new Array(mapped.length).fill(false), cur = [];
    const dfs = () => {
      if (cur.length === mapped.length) {
        const c = cost(cur, opts);
        if (c < bestCost) { bestCost = c; best = cur.slice(); }
        return;
      }
      if (cur.length && cost(cur, opts) >= bestCost) return; // partial day already worse
      for (let i = 0; i < mapped.length; i++) {
        if (used[i]) continue;
        used[i] = true; cur.push(mapped[i]); dfs(); cur.pop(); used[i] = false;
      }
    };
    dfs();
  } else if (mapped.length > EXACT_MAX) {
    // Nearest-next from the start, then 2-opt until no swap helps.
    const left = mapped.slice(); const out = [];
    let here = opts.start && opts.start.lat != null ? opts.start : null;
    while (left.length) {
      let bi = 0, bd = Infinity;
      left.forEach((s, i) => { const d = here ? (milesBetween(here, s) ?? Infinity) : 0; if (d < bd) { bd = d; bi = i; } });
      here = left[bi]; out.push(left.splice(bi, 1)[0]);
    }
    best = out;
    let bestCost = cost(best, opts), improved = true, guard = 0;
    while (improved && guard++ < 200) {
      improved = false;
      for (let i = 0; i < best.length - 1; i++) {
        for (let k = i + 1; k < best.length; k++) {
          const cand = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
          const c = cost(cand, opts);
          if (c < bestCost - 0.01) { best = cand; bestCost = c; improved = true; }
        }
      }
    }
  }
  return [...best, ...unmapped];
}
