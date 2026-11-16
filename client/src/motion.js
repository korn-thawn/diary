// Motion helpers for the noir theme. All the animation itself lives in index.css; this file only
// decides *when* things play (scroll reveal, navigation direction, view transitions for in-page swaps).
import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Reveal-on-scroll is opt-in via this class, so content is never hidden if this script didn't run.
if (typeof document !== "undefined") document.documentElement.classList.add("motion-ok");

// WebKit (Safari and every iOS browser): no View Transitions. Playwright's WebKit crashed while
// snapshotting our pages and we can't rule that out on real devices, so WebKit gets a CSS-only page
// entrance instead (.no-vt .page-enter in index.css). This must run before the router is created,
// because react-router checks for document.startViewTransition.
export const IS_WEBKIT =
  typeof navigator !== "undefined" &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) || (/AppleWebKit/.test(navigator.userAgent) && !/(Chrome|Chromium|Edg)\//.test(navigator.userAgent)));
if (IS_WEBKIT && typeof document !== "undefined") {
  document.documentElement.classList.add("no-vt");
  try { delete Document.prototype.startViewTransition; } catch { /* ignore */ }
  try { document.startViewTransition = undefined; } catch { /* ignore */ }
}

/** Ref for an element with data-reveal: gets data-revealed once it scrolls into view (children stagger via --i). */
export function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      el.dataset.revealed = "";
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.dataset.revealed = "";
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

// ---- navigation direction for the page "film cut" (forward slides in from the right, back from the left)
function setNav(dir) {
  document.documentElement.dataset.nav = dir;
}
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => { settleAnimations(); setNav("back"); });
  document.addEventListener("click", onLinkClick, true);
}

// Shared-element names ("entry-time-<id>", "entry-cover-<id>") are given only to the entry that was
// tapped, right before the router starts its view transition — and only to parts that are on screen.
// Naming every card all the time makes the browser snapshot off-screen / invisible elements, which
// is wasteful and crashed WebKit in testing.
// Jump any running one-shot animations (intro, reveal) to their end before a view transition captures
// the page: the page is leaving anyway, and snapshotting mid-animation content crashed WebKit in testing.
export function settleAnimations() {
  if (!document.getAnimations) return;
  for (const anim of document.getAnimations()) {
    const iterations = anim.effect?.getTiming?.().iterations;
    if (iterations === Infinity) continue;
    try { anim.finish(); } catch { /* not finishable */ }
  }
}

function onLinkClick(e) {
  const a = e.target.closest?.("a[href]");
  if (!a) return;
  settleAnimations();
  setNav("forward"); // any link click is a forward navigation
  document.querySelectorAll("[data-vt-named]").forEach((el) => {
    el.style.viewTransitionName = "";
    el.style.viewTransitionClass = "";
    delete el.dataset.vtNamed;
  });
  const host = a.closest("[data-entry-link]") || e.target.closest("[data-entry-link]");
  if (!host) return;
  const id = host.dataset.entryLink;
  const name = (el, kind) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const onScreen = r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
    const visible = el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true;
    if (!onScreen || !visible) return;
    el.style.viewTransitionName = `entry-${kind}-${id}`;
    el.style.viewTransitionClass = `entry-${kind}`;
    el.dataset.vtNamed = "";
  };
  name(host.querySelector("[data-vt-time]"), "time");
}
export const markBack = () => { settleAnimations(); setNav("back"); };

/**
 * Run a state update inside a view transition (for in-page swaps like changing the month).
 * `kind` is set on <html data-vt> during the transition so CSS can pick the animation.
 */
export function swapWithTransition(update, kind) {
  if (!document.startViewTransition || prefersReducedMotion()) {
    update();
    return;
  }
  settleAnimations();
  const root = document.documentElement;
  root.dataset.vt = kind;
  const t = document.startViewTransition(() => flushSync(update));
  t.finished.finally(() => { if (root.dataset.vt === kind) delete root.dataset.vt; });
}

/** Play the home intro once per browser session. */
export function takeIntro() {
  if (prefersReducedMotion()) return false;
  try {
    if (sessionStorage.getItem("diary-intro")) return false;
    sessionStorage.setItem("diary-intro", "1");
  } catch { /* private mode: play it */ }
  return true;
}
