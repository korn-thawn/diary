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

// Diverging scale: rose (bad) → stone (neutral) → emerald (good).
// Validated with the dataviz palette checker (CVD + normal-vision separation pass);
// low-contrast steps always ship with a text label, never color alone.
export const MOODS = [
  { value: 1, label: "แย่มาก", bg: "bg-rose-700", hex: "#be123c" },
  { value: 2, label: "ไม่ค่อยดี", bg: "bg-rose-400", hex: "#fb7185" },
  { value: 3, label: "เฉยๆ", bg: "bg-stone-500", hex: "#78716c" },
  { value: 4, label: "ดี", bg: "bg-emerald-500", hex: "#10b981" },
  { value: 5, label: "ดีมาก", bg: "bg-emerald-700", hex: "#047857" },
];

export const moodOf = (v) => MOODS.find((m) => m.value === Math.round(v));

export function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDate(iso, opts = { weekday: "short", day: "numeric", month: "short" }) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("th-TH", opts);
}
