import { createContext, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { markBack } from "../../motion";

const WindowCtx = createContext({ actionsEl: null, setTitle: () => {} });

/**
 * Page frame (noir): back link in mono, italic page title, an actions slot on the right, then the page.
 * Kept the old "Window" API so pages add buttons with <WindowActions> and rename it with useWindowTitle().
 */
export default function Window({ title, back, wide, children }) {
  const navigate = useNavigate();
  const [actionsEl, setActionsEl] = useState(null);
  const [override, setTitle] = useState(null);
  return (
    <WindowCtx.Provider value={{ actionsEl, setTitle }}>
      <section
        className={`relative mx-auto w-full px-4 pt-6 sm:px-8 sm:pt-10 ${wide ? "max-w-none" : "max-w-[1200px]"}`}
        aria-label={override || title}
      >
        <header className="mb-6 flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-line pb-4 sm:mb-8">
          <div className="min-w-0 flex-1">
            {back && (
              <button
                className="meta -ml-1 mb-1 inline-flex min-h-9 items-center px-1 text-calm-text hover:text-warm"
                onClick={() => { markBack(); window.history.length > 1 ? navigate(-1) : navigate(back, { viewTransition: true }); }}
              >
                ← กลับ
              </button>
            )}
            <h1 className="truncate py-1 text-[26px] leading-normal sm:text-[32px]">{override || title}</h1>
          </div>
          <div ref={setActionsEl} className="flex shrink-0 flex-wrap items-center gap-2" />
        </header>
        <div className="page-enter" style={{ viewTransitionName: "win-body" }}>{children}</div>
      </section>
    </WindowCtx.Provider>
  );
}

/** Render buttons into the current page header. */
export function WindowActions({ children }) {
  const { actionsEl } = useContext(WindowCtx);
  return actionsEl ? createPortal(children, actionsEl) : null;
}

/** Replace the page title while this page is mounted (e.g. the board name). */
export function useWindowTitle(title) {
  const { setTitle } = useContext(WindowCtx);
  useEffect(() => {
    setTitle(title || null);
    return () => setTitle(null);
  }, [title, setTitle]);
}

/** Button for the page header: the first one on a page usually is the main action. */
export function TitleButton({ children, className = "", primary = false, ...props }) {
  return (
    <button className={`btn ${primary ? "btn-primary" : "btn-outline"} min-h-10 px-3.5 ${className}`} {...props}>
      {children}
    </button>
  );
}
