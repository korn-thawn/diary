import { Link, Navigate, Route, Routes, useLocation } from "react-router";
import { useAuth } from "./auth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import EntryList from "./pages/EntryList";
import EntryEditor from "./pages/EntryEditor";

function InsecureBanner() {
  const { protocol, hostname } = window.location;
  const local = hostname === "localhost" || hostname === "127.0.0.1";
  if (protocol !== "http:" || local) return null;
  return (
    <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
      ⚠️ เว็บนี้ยังไม่มี HTTPS ใช้รหัสผ่านทิ้งสำหรับทดสอบเท่านั้น อย่าใช้รหัสจริง
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

function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
      <Link to="/" className="font-serif text-2xl font-semibold tracking-tight">
        📔 ไดอารี่
      </Link>
      {user && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-stone-500">{user.username}</span>
          <button className="btn btn-ghost" onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      )}
    </header>
  );
}

export default function App() {
  return (
    <div className="min-h-dvh">
      <InsecureBanner />
      <Header />
      <main className="mx-auto max-w-3xl px-4 pb-16">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<RequireAuth><EntryList /></RequireAuth>} />
          <Route path="/entries/new" element={<RequireAuth><EntryEditor /></RequireAuth>} />
          <Route path="/entries/:id" element={<RequireAuth><EntryEditor /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
