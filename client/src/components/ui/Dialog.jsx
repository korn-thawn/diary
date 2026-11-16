import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/20/solid";
import { prefersReducedMotion } from "../../motion";

// Stack of open dialogs so Escape only closes the top-most one
const stack = [];
const CLOSE_MS = 180;
const SWIPE_CLOSE_PX = 96;

/**
 * Dialog (noir). Desktop: centred raised box. Mobile: bottom sheet that can be swiped down to close.
 * Handles Escape, outside click, focus (first field / restore on close), body scroll lock, and plays a
 * closing animation before calling onClose (X / Esc / backdrop / swipe).
 */
export default function Dialog({ title, icon: Icon, onClose, children, size = "md", titleExtra }) {
  const ref = useRef(null);
  const bodyRef = useRef(null);
  const id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);

  // animate out, then really close
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (prefersReducedMotion()) return closeRef.current();
    setClosing(true);
    setTimeout(() => closeRef.current(), CLOSE_MS);
  }, []);

  useEffect(() => {
    stack.push(id);
    const prevFocus = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // focus the first field unless something inside already grabbed focus (autoFocus)
    requestAnimationFrame(() => {
      if (ref.current && !ref.current.contains(document.activeElement)) {
        const first = ref.current.querySelector("input:not([type=hidden]),textarea,select,button:not([data-close])");
        (first || ref.current).focus({ preventScroll: true });
      }
    });
    const onKey = (e) => {
      if (e.key === "Escape" && stack[stack.length - 1] === id) {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      stack.splice(stack.indexOf(id), 1);
      if (!stack.length) document.body.style.overflow = prevOverflow;
      if (prevFocus && typeof prevFocus.focus === "function") prevFocus.focus({ preventScroll: true });
    };
  }, [id, close]);

  // ---- swipe down to close (mobile sheet). Starts from the grab handle / header, or from the body
  // when it's scrolled to the top, so it never fights with scrolling the content.
  const drag = useRef(null);
  const onTouchStart = (e) => {
    if (window.matchMedia("(min-width: 640px)").matches) return;
    const fromHeader = e.target.closest("[data-sheet-handle]");
    if (!fromHeader && (bodyRef.current?.scrollTop || 0) > 0) return;
    if (!fromHeader && e.target.closest("input,textarea,select,[contenteditable],[data-no-swipe]")) return;
    drag.current = { y: e.touches[0].clientY, t: performance.now(), dy: 0, active: !!fromHeader };
  };
  const onTouchMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.touches[0].clientY - d.y;
    if (!d.active) {
      if (dy < 8) { if (dy < -4) drag.current = null; return; }
      d.active = true; // pulled down from the top of the content
    }
    d.dy = Math.max(0, dy);
    const el = ref.current;
    el.style.transition = "none";
    el.style.transform = `translateY(${d.dy}px)`;
  };
  const onTouchEnd = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.active) return;
    const el = ref.current;
    const speed = d.dy / Math.max(1, performance.now() - d.t); // px per ms
    el.style.transition = "";
    if (d.dy > SWIPE_CLOSE_PX || speed > 0.6) {
      el.style.transform = "";
      el.dataset.swiped = "";
      close();
    } else {
      el.style.transform = ""; // springs back via the CSS transition on .sheet
    }
  };

  const width = size === "lg" ? "sm:max-w-2xl" : size === "sm" ? "sm:max-w-sm" : "sm:max-w-lg";
  return createPortal(
    <div
      className={`dialog-backdrop fixed inset-0 z-50 flex items-end justify-center sm:items-start sm:overflow-y-auto sm:p-6 sm:pt-[8vh] ${closing ? "is-closing" : ""}`}
      onPointerDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        className={`dialog-panel win flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-b-none outline-none sm:max-h-none sm:overflow-visible ${width} ${closing ? "is-closing" : ""}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div data-sheet-handle className="flex justify-center pt-2 pb-1 sm:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-line-strong" />
        </div>
        <header data-sheet-handle className="win-title shrink-0">
          {Icon && <Icon className="size-5 shrink-0" aria-hidden="true" />}
          <h2 id={`${id}-t`} className="min-w-0 flex-1 truncate py-1 text-lg leading-normal">{title}</h2>
          {titleExtra}
          <button data-close className="-mr-1 flex size-9 items-center justify-center rounded-[2px] transition-colors hover:bg-white/10" onClick={close} aria-label="ปิด">
            <XMarkIcon className="size-5" />
          </button>
        </header>
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5 sm:pb-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
