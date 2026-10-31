import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/20/solid";

// Stack of open dialogs so Escape only closes the top-most one
const stack = [];

/**
 * Retro dialog window. Desktop: centred window with a title bar. Mobile: bottom sheet.
 * Handles Escape, outside click, focus (first field / restore on close) and body scroll lock.
 */
export default function Dialog({ title, icon: Icon, onClose, children, size = "md", titleExtra }) {
  const ref = useRef(null);
  const id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

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
        closeRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      stack.splice(stack.indexOf(id), 1);
      if (!stack.length) document.body.style.overflow = prevOverflow;
      if (prevFocus && typeof prevFocus.focus === "function") prevFocus.focus({ preventScroll: true });
    };
  }, [id]);

  const width = size === "lg" ? "sm:max-w-2xl" : size === "sm" ? "sm:max-w-sm" : "sm:max-w-lg";
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/45 sm:items-start sm:overflow-y-auto sm:p-6 sm:pt-[8vh]"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        className={`win flex max-h-[92dvh] w-full animate-sheet-in flex-col overflow-hidden rounded-b-none outline-none sm:max-h-none sm:animate-dialog-in sm:overflow-visible sm:rounded-b-[6px] ${width}`}
      >
        <header className="win-title shrink-0 rounded-t-[4px]">
          {Icon && <Icon className="size-5 shrink-0" aria-hidden="true" />}
          <h2 id={`${id}-t`} className="min-w-0 flex-1 truncate py-1 font-display text-[15px] leading-normal font-semibold">{title}</h2>
          {titleExtra}
          <button data-close className="-mr-1 flex size-8 items-center justify-center rounded-[4px] hover:bg-white/15" onClick={onClose} aria-label="ปิด">
            <XMarkIcon className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5 sm:pb-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
