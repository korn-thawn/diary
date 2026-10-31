import { useEffect, useRef, useState } from "react";

// Small click-to-open popover. Closes on outside click / Escape.
export default function Popover({ button, children, align = "right", className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      {button({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          className={`absolute top-full z-30 mt-1 min-w-48 rounded-xl bg-surface p-2 shadow-lg ring-1 ring-stone-200 ${
            align === "right" ? "right-0" : "left-0"
          } ${className}`}
        >
          {typeof children === "function" ? children({ close: () => setOpen(false) }) : children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon: Icon, children, danger, ...props }) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm ${
        danger ? "text-red-600 hover:bg-red-50" : "text-stone-700 hover:bg-stone-100"
      }`}
      {...props}
    >
      {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
}
