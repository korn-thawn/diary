import { createContext, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { ChevronLeftIcon } from "@heroicons/react/20/solid";

const WindowCtx = createContext({ actionsEl: null, setTitle: () => {} });

/** The main app window: green title bar + cream body. Pages add buttons with <WindowActions>. */
export default function Window({ title, icon: Icon, back, wide, children }) {
  const navigate = useNavigate();
  const [actionsEl, setActionsEl] = useState(null);
  const [override, setTitle] = useState(null);
  return (
    <WindowCtx.Provider value={{ actionsEl, setTitle }}>
      <section className={`win relative mx-auto w-full ${wide ? "max-w-none" : "max-w-4xl"}`} aria-label={override || title}>
        <header className="win-title sticky top-0 z-20 rounded-t-[4px]">
          {back ? (
            <button
              className="-ml-1 flex size-8 shrink-0 items-center justify-center rounded-[4px] hover:bg-white/15"
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(back))}
              aria-label="ย้อนกลับ"
            >
              <ChevronLeftIcon className="size-5" />
            </button>
          ) : (
            Icon && <Icon className="size-5 shrink-0" aria-hidden="true" />
          )}
          <h1 className="min-w-0 flex-1 truncate py-1 font-display text-[15px] leading-normal font-semibold">{override || title}</h1>
          <div ref={setActionsEl} className="flex shrink-0 items-center gap-1.5" />
        </header>
        <div className="p-3 sm:p-5" style={{ viewTransitionName: "win-body" }}>
          {children}
        </div>
      </section>
    </WindowCtx.Provider>
  );
}

/** Render buttons into the current window's title bar. */
export function WindowActions({ children }) {
  const { actionsEl } = useContext(WindowCtx);
  return actionsEl ? createPortal(children, actionsEl) : null;
}

/** Replace the window title while this page is mounted (e.g. the board name). */
export function useWindowTitle(title) {
  const { setTitle } = useContext(WindowCtx);
  useEffect(() => {
    setTitle(title || null);
    return () => setTitle(null);
  }, [title, setTitle]);
}

/** Small button sized for the green title bar. */
export function TitleButton({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex min-h-8 items-center gap-1 rounded-[4px] border-2 border-ink bg-paper px-2.5 font-display text-xs font-semibold text-ink shadow-[2px_2px_0_var(--color-shadow)] transition-[transform,box-shadow] duration-75 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
