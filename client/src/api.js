export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || res.statusText);
  return data;
}

export const MOODS = [
  { value: 1, emoji: "😢", label: "แย่มาก" },
  { value: 2, emoji: "😕", label: "ไม่ค่อยดี" },
  { value: 3, emoji: "😐", label: "เฉยๆ" },
  { value: 4, emoji: "🙂", label: "ดี" },
  { value: 5, emoji: "😄", label: "ดีมาก" },
];

export const moodEmoji = (v) => MOODS.find((m) => m.value === v)?.emoji ?? "";

export function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDate(iso, opts = { weekday: "short", day: "numeric", month: "short" }) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("th-TH", opts);
}
