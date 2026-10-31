import { Navigate, Route, Routes, useLocation, useSearchParams } from "react-router";
import { useEffect, useState } from "react";
import { ExclamationTriangleIcon, SignalSlashIcon } from "@heroicons/react/20/solid";
import { useAuth } from "./auth";
import { windowFor } from "./routes";
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
import Window from "./components/ui/Window";
import { Dock, FolderTabs, MenuBar } from "./components/ui/Chrome";

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
    <div className="flex items-center justify-center gap-2 border-b-2 border-ink bg-ink px-4 py-1.5 text-center text-sm text-paper" role="status">
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
    <div className="flex items-center justify-center gap-2 border-b-2 border-ink bg-highlight px-4 py-1.5 text-center text-sm text-on-highlight">
      <ExclamationTriangleIcon className="size-4 shrink-0" aria-hidden="true" />
      เว็บนี้ยังไม่มี HTTPS ใช้รหัสผ่านทิ้งสำหรับทดสอบเท่านั้น
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

const AUTH_PATHS = ["/login", "/register"];

export default function App() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const win = windowFor(pathname);
  const isAuthPage = AUTH_PATHS.includes(pathname);

  return (
    <div className={`min-h-dvh ${user && !isAuthPage ? "pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-10" : "pb-10"}`}>
      <OfflineBanner />
      <MenuBar />
      <InsecureBanner />
      {isAuthPage ? (
        <main className="px-3 pt-8 sm:pt-16">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Routes>
        </main>
      ) : (
        <main className="px-2 pt-3 sm:px-4 md:pt-6">
          {user && <FolderTabs wide={win.wide} />}
          <Window key={win.title + (win.back || "")} title={win.title} icon={win.icon} back={win.back} wide={win.wide}>
            <Routes>
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
          </Window>
          <MeetingOccurrenceRoute />
        </main>
      )}
      {user && !isAuthPage && <Dock />}
    </div>
  );
}
