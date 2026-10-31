import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router";
import { BookOpenIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import {
  CalendarDaysIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ListBulletIcon,
  Squares2X2Icon,
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

export default function App() {
  const { pathname } = useLocation();
  // Kanban boards need the full width; everything else stays in a readable column
  const wide = /^\/boards\/[^/]+/.test(pathname);
  return (
    <div className="min-h-dvh">
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
          <Route path="/calendar" element={protect(<Calendar />)} />
          <Route path="/stats" element={protect(<Stats />)} />
          <Route path="/settings" element={protect(<Settings />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
