// App chrome: menu bar (top), folder tabs (desktop), dock + "more" sheet (mobile).
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { BookOpenIcon, ComputerDesktopIcon, EllipsisHorizontalIcon, MoonIcon, SunIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../../auth";
import { DOCK, MORE, SECTIONS } from "../../routes";
import Dialog from "./Dialog";

function Clock() {
  const fmt = () => new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
  const [t, setT] = useState(fmt);
  useEffect(() => {
    const i = setInterval(() => setT(fmt()), 15_000);
    return () => clearInterval(i);
  }, []);
  return <time className="font-display text-sm font-semibold tabular-nums">{t}</time>;
}

const THEMES = [
  { value: "system", label: "ตามเครื่อง", Icon: ComputerDesktopIcon },
  { value: "light", label: "สว่าง", Icon: SunIcon },
  { value: "dark", label: "มืด", Icon: MoonIcon },
];

function ThemeCycle() {
  const [pref, setPref] = useState(() => window.diaryTheme?.get() || "system");
  const i = THEMES.findIndex((t) => t.value === pref);
  const cur = THEMES[i < 0 ? 0 : i];
  const next = THEMES[(i + 1) % THEMES.length];
  return (
    <button
      className="flex size-8 items-center justify-center rounded-[4px] hover:bg-ink/10"
      onClick={() => { window.diaryTheme?.set(next.value); setPref(next.value); }}
      aria-label={`ธีม: ${cur.label} (กดเพื่อเปลี่ยนเป็น ${next.label})`}
      title={`ธีม: ${cur.label}`}
    >
      <cur.Icon className="size-5" />
    </button>
  );
}

export function MenuBar() {
  const { user } = useAuth();
  return (
    <div className="sticky top-0 z-30 border-b-2 border-ink bg-paper md:static">
      <div className="mx-auto flex h-11 max-w-6xl items-center gap-2 px-3">
        <Link to={user ? "/today" : "/login"} viewTransition className="flex items-center gap-2 font-display text-[17px] font-bold">
          <span className="flex size-7 items-center justify-center rounded-[4px] border-2 border-ink bg-title text-on-title">
            <BookOpenIcon className="size-4" aria-hidden="true" />
          </span>
          ไดอารี่
        </Link>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ThemeCycle />
          {user && <span className="hidden max-w-32 truncate text-sm text-stone-600 sm:inline">{user.username}</span>}
          <span className="h-5 w-px bg-ink/25" aria-hidden="true" />
          <Clock />
        </div>
      </div>
    </div>
  );
}

/** Desktop navigation: manila-folder tabs that sit on top of the window. */
export function FolderTabs({ wide }) {
  const { pathname } = useLocation();
  return (
    <nav className={`mx-auto hidden w-full items-end gap-1 pl-3 md:flex ${wide ? "max-w-none" : "max-w-4xl"}`} aria-label="เมนูหลัก">
      {SECTIONS.map(({ to, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <NavLink
            key={to}
            to={to}
            viewTransition
            aria-current={active ? "page" : undefined}
            style={active ? { viewTransitionName: "active-tab" } : undefined}
            className={`relative -mb-[2px] flex items-center gap-1.5 rounded-t-[8px] border-2 border-b-0 border-ink px-4 font-display text-sm font-semibold transition-[padding,background-color] duration-150 ${
              active
                ? "z-10 bg-title pt-2.5 pb-2 text-on-title"
                : "bg-paper pt-1.5 pb-1.5 text-ink hover:pt-2 [background-image:linear-gradient(to_bottom,transparent_60%,color-mix(in_oklab,var(--color-ink)_8%,transparent))]"
            }`}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </NavLink>
        );
      })}
    </nav>
  );
}

/** Mobile navigation: bottom dock + "more" sheet. */
export function Dock() {
  const { pathname } = useLocation();
  const [more, setMore] = useState(false);
  const moreActive = MORE.some((m) => pathname.startsWith(m.to));
  const item = (active) =>
    `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 font-display text-[11px] font-semibold ${active ? "text-title" : "text-stone-600"}`;
  const pill = (active) => `flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? "bg-title text-on-title" : ""}`;
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t-2 border-ink bg-paper pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="เมนูหลัก">
        {DOCK.map(({ to, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <NavLink key={to} to={to} viewTransition className={item(active)} aria-current={active ? "page" : undefined}>
              <span className={pill(active)}><Icon className="size-5" aria-hidden="true" /></span>
              {label}
            </NavLink>
          );
        })}
        <button className={item(moreActive)} onClick={() => setMore(true)} aria-haspopup="dialog">
          <span className={pill(moreActive)}><EllipsisHorizontalIcon className="size-5" aria-hidden="true" /></span>
          เพิ่มเติม
        </button>
      </nav>
      {more && (
        <Dialog title="เพิ่มเติม" onClose={() => setMore(false)} size="sm">
          <ul className="grid grid-cols-2 gap-2">
            {MORE.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  viewTransition
                  onClick={() => setMore(false)}
                  className="panel flex flex-col items-center gap-1.5 px-2 py-4 font-display text-sm font-semibold"
                >
                  <Icon className="size-7 text-title" aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </>
  );
}
