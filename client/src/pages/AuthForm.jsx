import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { useAuth } from "../auth";

// Shared form for Login and Register
export default function AuthForm({ title, submitLabel, onSubmit, footer, minPassword = 1 }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={location.state?.from?.pathname || "/"} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onSubmit(username.trim(), password);
      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-10 max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-stone-200">
      <h1 className="mb-6 font-serif text-2xl font-semibold">{title}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm text-stone-600">ชื่อผู้ใช้</span>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-stone-600">รหัสผ่าน</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={minPassword > 1 ? "new-password" : "current-password"}
            minLength={minPassword}
            required
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? "กำลังดำเนินการ…" : submitLabel}
        </button>
      </form>
      {footer && <div className="mt-6 text-center text-sm text-stone-500">{footer}</div>}
    </div>
  );
}
