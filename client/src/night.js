// Noir theme vocabulary: atmosphere of a night, weather, and how times / dates / entry numbers are written.
// Ids must match server/routes/entries.js (ATMOSPHERES, WEATHERS).

export const ATMOSPHERES = [
  { id: "hot", label: "ร้อนรุ่ม", fill: "bg-hot", on: "text-[#fff4e6]", text: "text-hot-text" },
  { id: "calm", label: "นิ่ง", fill: "bg-calm", on: "text-paper", text: "text-calm-text" },
  { id: "warm", label: "อบอุ่น", fill: "bg-warm", on: "text-paper", text: "text-warm" },
];
export const atmosphereOf = (id) => ATMOSPHERES.find((a) => a.id === id) || null;

export const WEATHERS = [
  { id: "clear", label: "แจ่มใส" },
  { id: "cloudy", label: "ครึ้ม" },
  { id: "drizzle", label: "ฝนปรอย" },
  { id: "rain", label: "ฝนตก" },
  { id: "storm", label: "พายุ" },
  { id: "fog", label: "หมอก" },
  { id: "hot", label: "ร้อนอบอ้าว" },
  { id: "cold", label: "หนาว" },
];
export const weatherLabel = (id) => WEATHERS.find((w) => w.id === id)?.label || null;

const TZ = "Asia/Bangkok";

/** "03:27" — the moment an entry was written, Bangkok time */
export const timeOf = (iso) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });

const parse = (ymd) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** "จันทร์ 16 พ.ย. 2026" (Gregorian year, as in the design) */
export function nightDate(ymd, { weekday = true, year = true } = {}) {
  const dt = parse(ymd);
  const wd = dt.toLocaleDateString("th-TH", { weekday: "long" }).replace(/^วัน/, "");
  const dm = dt.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  return [weekday && wd, dm, year && dt.getFullYear()].filter(Boolean).join(" ");
}

/** "NO. 0427" */
export const entryNo = (n) => `NO. ${String(n).padStart(4, "0")}`;

/** Rough reading time for Thai text (no spaces between words, so count characters) */
export const readMinutes = (chars) => Math.max(1, Math.round(chars / 500));

/** First ~n characters, cut at a space when possible */
export function excerpt(text, n = 180) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const sp = cut.lastIndexOf(" ");
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut) + "…";
}

/** "อ่าน 4 นาที · ฝนปรอย · 24°C" */
export function entryFacts(e) {
  return [
    e.chars ? `อ่าน ${readMinutes(e.chars)} นาที` : null,
    weatherLabel(e.weather),
    e.temp_c !== null && e.temp_c !== undefined ? `${e.temp_c}°C` : null,
  ].filter(Boolean).join(" · ");
}
