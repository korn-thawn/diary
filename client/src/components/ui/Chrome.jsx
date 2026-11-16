// App chrome (noir): site header with the main nav (desktop), bottom dock + "more" sheet (mobile).
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { EllipsisHorizontalIcon, PencilIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../../auth";
import { DOCK, MORE, SECTIONS } from "../../routes";
import Dialog from "./Dialog";

export const SITE_NAME = "บันทึกหลังเที่ยงคืน";

function NightClock() {
  const fmt = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
  const [t, setT] = useState(fmt);
  useEffect(() => {
    const i = setInterval(() => setT(fmt()), 15_000);
    return () => clearInterval(i);
  }, []);
  return <time className="meta text-dim tabular-nums" aria-label={`เวลา ${t}`}>{t}</time>;
}

export function SiteHeader() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[rgb(11_18_17/0.86)] backdrop-blur-md">
      <div className="mx-auto flex min-h-16 max-w-[1200px] items-center gap-4 px-4 sm:px-8">
        <Link to={user ? "/" : "/login"} viewTransition className="font-display text-[19px] font-semibold italic text-ink sm:text-2xl">
          {SITE_NAME}
        </Link>
        {user && (
          <>
            <nav className="ml-auto hidden items-center gap-7 md:flex" aria-label="เมนูหลัก">
              {SECTIONS.map(({ to, label, match }) => {
                const active = match(pathname);
                return (
                  <NavLink
                    key={to}
                    to={to}
                    viewTransition
                    aria-current={active ? "page" : undefined}
                    style={active ? { viewTransitionName: "active-tab" } : undefined}
                    className={`relative py-2.5 text-[15px] transition-colors ${
                      active ? "text-ink after:absolute after:inset-x-0 after:bottom-1 after:h-0.5 after:bg-title" : "text-muted"
                    }`}
                  >
                    {label}
                  </NavLink>
                );
              })}
            </nav>
            <div className="ml-auto flex items-center gap-4 md:ml-2">
              <span className="hidden lg:inline"><NightClock /></span>
              <Link to="/entries/new" viewTransition className="btn btn-primary min-h-11 px-4 sm:px-5">
                <PencilIcon className="size-4 sm:hidden" aria-hidden="true" />
                <span className="hidden sm:inline">เขียนบันทึก</span>
                <span className="sm:hidden">เขียน</span>
              </Link>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { user } = useAuth();
  return (
    <footer className="mt-16 border-t border-line">
      <div className="meta mx-auto flex max-w-[1200px] flex-wrap justify-between gap-3 px-4 py-8 text-dim sm:px-8">
        <span>{SITE_NAME}{user ? ` · ${user.username}` : ""}</span>
        <span>เขียนทุกคืนที่ยังไม่หลับ</span>
      </div>
    </footer>
  );
}

/** Mobile navigation: bottom dock + "more" sheet. */
export function Dock() {
  const { pathname } = useLocation();
  const [more, setMore] = useState(false);
  const moreActive = MORE.some((m) => pathname.startsWith(m.to)) && !DOCK.some((d) => d.match(pathname));
  const item = (active) =>
    `relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] ${
      active ? "text-accent before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:bg-title" : "text-muted"
    }`;
  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-[rgb(11_18_17/0.92)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
        aria-label="เมนูหลัก"
      >
        {DOCK.map(({ to, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <NavLink key={to} to={to} viewTransition className={item(active)} aria-current={active ? "page" : undefined}>
              <Icon className="size-6" aria-hidden="true" />
              {label}
            </NavLink>
          );
        })}
        <button className={item(moreActive)} onClick={() => setMore(true)} aria-haspopup="dialog">
          <EllipsisHorizontalIcon className="size-6" aria-hidden="true" />
          เพิ่มเติม
        </button>
      </nav>
      {more && (
        <Dialog title="เพิ่มเติม" onClose={() => setMore(false)} size="sm">
          <ul className="divide-y divide-line">
            {MORE.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink to={to} viewTransition onClick={() => setMore(false)} className="flex min-h-13 items-center gap-3 py-3 text-base">
                  <Icon className="size-5 text-accent" aria-hidden="true" />
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
