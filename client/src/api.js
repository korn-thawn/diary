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

// Upload one processed image ({ full, thumb, width, height }) to an entry or card.
// Uses XHR so we can report upload progress (fetch can't).
export function uploadPhoto({ entryId, cardId }, img, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("full", img.full, img.full.type === "image/jpeg" ? "full.jpg" : "full.webp");
    fd.append("thumb", img.thumb, "thumb");
    fd.append("width", String(img.width));
    fd.append("height", String(img.height));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/photos?${entryId ? `entryId=${entryId}` : `cardId=${cardId}`}`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data.photo);
      else reject(new ApiError(xhr.status, data.error || `อัปโหลดไม่สำเร็จ (${xhr.status})`));
    };
    xhr.onerror = () => reject(new ApiError(0, "เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง"));
    xhr.send(fd);
  });
}

export const photoUrl = (id, thumb = false) => `/api/photos/${id}${thumb ? "/thumb" : ""}`;

// Diverging scale: rose (bad) → stone (neutral) → emerald (good), as CSS variables so the
// light/dark themes can use different validated steps (see index.css :root and dark.css).
// Validated with the dataviz palette checker; always shown with a text label, never color alone.
export const MOODS = [
  { value: 1, label: "แย่มาก", bg: "bg-(--mood-1)", hex: "var(--mood-1)" },
  { value: 2, label: "ไม่ค่อยดี", bg: "bg-(--mood-2)", hex: "var(--mood-2)" },
  { value: 3, label: "เฉยๆ", bg: "bg-(--mood-3)", hex: "var(--mood-3)" },
  { value: 4, label: "ดี", bg: "bg-(--mood-4)", hex: "var(--mood-4)" },
  { value: 5, label: "ดีมาก", bg: "bg-(--mood-5)", hex: "var(--mood-5)" },
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
