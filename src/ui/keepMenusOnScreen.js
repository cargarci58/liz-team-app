// Keeps pop-up menus on screen (Carlos 10/4: on an iPhone some menus opened
// off the edge and he had to turn the phone sideways).
//
// Most drop-downs are `position: absolute; right: 0` under their button — fine
// on a desktop where the button sits at the right, but on a phone the header
// wraps, the button lands near the LEFT edge and the menu opens off-screen
// (body has overflow-x: hidden, so it can't even be scrolled to). Instead of
// patching each menu, this nudges ANY floating panel that ends up partly
// off-screen back inside, and narrows it if it's wider than the screen.
//
// What counts as a floating panel: an element positioned absolute/fixed with a
// z-index (menus, pop-overs) that is PARTLY off-screen horizontally. Fully
// off-screen elements (hidden drawers, screen-reader text) are left alone.
// Opt out with data-allow-offscreen.

const MARGIN = 8;

function adjust(el, vw) {
  const prev = Number(el.dataset.menuShift || 0);
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return;
  // Measure where it sits WITHOUT our previous nudge, so nudges never compound.
  const left = r.left - prev, right = r.right - prev;
  if (right <= 0 || left >= vw) return;                 // fully off-screen on purpose
  if (left >= MARGIN && right <= vw - MARGIN) {          // fits on its own
    if (prev) { el.style.translate = ""; delete el.dataset.menuShift; }
    return;
  }
  if (r.width > vw - MARGIN * 2 && el.style.maxWidth !== `${vw - MARGIN * 2}px`) {
    el.style.maxWidth = `${vw - MARGIN * 2}px`;
    el.style.boxSizing = "border-box";
    return adjust(el, vw);                               // re-measure at the new width
  }
  const shift = Math.round(left < MARGIN ? MARGIN - left : (vw - MARGIN) - right);
  if (shift === prev) return;                            // already placed — no write, no new mutation
  el.style.translate = `${shift}px 0`;
  el.dataset.menuShift = String(shift);
}

function scan() {
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const els = document.querySelectorAll('[style*="position: absolute"], [style*="position: fixed"]');
  for (const el of els) {
    if (el.hasAttribute("data-allow-offscreen")) continue;
    const z = parseInt(getComputedStyle(el).zIndex, 10);
    if (!(z > 0)) continue;                              // menus/pop-overs carry a z-index
    adjust(el, vw);
  }
}

let queued = false;
function schedule() {
  // Phones/tablets only: that's where buttons wrap to the left. Wide desktop
  // windows keep their menus exactly as designed (and skip the work).
  if (queued || window.innerWidth > 1024) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; try { scan(); } catch { /* never break the app */ } });
}

export function installKeepMenusOnScreen() {
  if (typeof window === "undefined" || window.__keepMenusOnScreen) return;
  window.__keepMenusOnScreen = true;
  // Menus appear after a tap/click (React re-renders) — watch the DOM for new
  // or restyled elements, and re-check on rotate/resize.
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  schedule();
}
