import { Link, Navigate, NavLink, Route, Routes, useLocation, useSearchParams } from "react-router";
import { useEffect, useState } from "react";
import { BookOpenIcon, ExclamationTriangleIcon, SignalSlashIcon } from "@heroicons/react/24/outline";
import {
  CalendarDaysIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ListBulletIcon,
  Squares2X2Icon,
  SunIcon,
} from "@heroicons/react/20/solid";
import { useAuth } from "./auth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import EntryList from "./pages/EntryList";
import EntryEditor from "./pages/EntryEditor";
import Calendar from "./pages/Calendar";
import Stats from "./pages/Stats";
import Settings from "./pages/Settings";
import Boards from "./pages/Boards";
import Board from "./pages/Board";
import Events from "./pages/Events";
import Today from "./pages/Today";
import Meetings from "./pages/Meetings";
import OccurrenceModal from "./components/OccurrenceModal";

// Shown while the device is offline (the installed app can still open its cached shell)
function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (online) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-stone-700 px-4 py-2 text-center text-sm text-stone-100" role="status">
      <SignalSlashIcon className="size-4 shrink-0" aria-hidden="true" />
      ออฟไลน์อยู่ ข้อมูลจะโหลดและบันทึกได้เมื่อกลับมาออนไลน์
    </div>
  );
}

function InsecureBanner() {
  const { protocol, hostname } = window.location;
  const local = hostname === "localhost" || hostname === "127.0.0.1";
  if (protocol !== "http:" || local) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
      <ExclamationTriangleIcon className="size-4 shrink-0" aria-hidden="true" />
      เว็บนี้ยังไม่มี HTTPS ใช้รหัสผ่านทิ้งสำหรับทดสอบเท่านั้น อย่าใช้รหัสจริง
    </div>
  );
}

function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === undefined) return <p className="p-8 text-center text-stone-500">กำลังโหลด…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

const NAV = [
  { to: "/today", label: "วันนี้", icon: SunIcon },
  { to: "/", label: "บันทึก", icon: ListBulletIcon, end: true },
  { to: "/boards", label: "งาน", icon: Squares2X2Icon },
  { to: "/calendar", label: "ปฏิทิน", icon: CalendarDaysIcon },
  { to: "/stats", label: "สถิติ", icon: ChartBarIcon },
  { to: "/settings", label: "ตั้งค่า", icon: Cog6ToothIcon },
];

function Header() {
  const { user } = useAuth();
  return (
    <header className="mx-auto max-w-3xl px-4 pt-5 pb-4">
      <div className="flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 font-serif text-2xl font-semibold tracking-tight">
          <BookOpenIcon className="size-7 text-accent" aria-hidden="true" />
          ไดอารี่
        </Link>
        {user && <span className="truncate text-sm text-stone-500">{user.username}</span>}
      </div>
      {user && (
        <nav className="-mx-1 mt-4 flex gap-1 overflow-x-auto" aria-label="เมนูหลัก">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                  isActive ? "bg-ink text-paper" : "text-stone-600 hover:bg-stone-200/60"
                }`
              }
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}

const protect = (el) => <RequireAuth>{el}</RequireAuth>;

// ?m=<meetingId>&d=<original date> opens a meeting occurrence on top of any page
function MeetingOccurrenceRoute() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const m = params.get("m"), d = params.get("d");
  if (!user || !m || !d) return null;
  return (
    <OccurrenceModal
      key={m + d}
      meetingId={m}
      date={d}
      onClose={() => setParams((p) => { p.delete("m"); p.delete("d"); return p; }, { replace: true })}
    />
  );
}

export default function App() {
  const { pathname } = useLocation();
  // Kanban boards need the full width; everything else stays in a readable column
  const wide = /^\/boards\/[^/]+/.test(pathname);
  return (
    <div className="min-h-dvh">
      <OfflineBanner />
      <InsecureBanner />
      <Header />
      <main className={`mx-auto px-4 pb-16 ${wide ? "max-w-none" : "max-w-3xl"}`}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={protect(<EntryList />)} />
          <Route path="/entries/new" element={protect(<EntryEditor />)} />
          <Route path="/entries/:id" element={protect(<EntryEditor />)} />
          <Route path="/boards" element={protect(<Boards />)} />
          <Route path="/boards/:id" element={protect(<Board />)} />
          <Route path="/today" element={protect(<Today />)} />
          <Route path="/meetings" element={protect(<Meetings />)} />
          <Route path="/events" element={protect(<Events />)} />
          <Route path="/calendar" element={protect(<Calendar />)} />
          <Route path="/stats" element={protect(<Stats />)} />
          <Route path="/settings" element={protect(<Settings />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <MeetingOccurrenceRoute />
      </main>
    </div>
  );
}
