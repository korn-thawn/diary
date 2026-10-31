// Customization palette. Keys must match server/util.js COLORS / ICONS.
// Class names are written out in full so Tailwind's scanner picks them up.
import {
  AcademicCapIcon,
  BanknotesIcon,
  BellIcon,
  BriefcaseIcon,
  CakeIcon,
  ClipboardDocumentListIcon,
  GiftIcon,
  HeartIcon,
  HomeIcon,
  LightBulbIcon,
  PaperAirplaneIcon,
  ShoppingCartIcon,
  StarIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";

export const COLORS = {
  stone:   { label: "เทา",     dot: "bg-stone-400",   bar: "bg-stone-400",   soft: "bg-stone-100 text-stone-700",     ring: "ring-stone-300",   text: "text-stone-600" },
  rose:    { label: "แดง",     dot: "bg-rose-500",    bar: "bg-rose-500",    soft: "bg-rose-100 text-rose-800",       ring: "ring-rose-300",    text: "text-rose-700" },
  orange:  { label: "ส้ม",     dot: "bg-orange-500",  bar: "bg-orange-500",  soft: "bg-orange-100 text-orange-800",   ring: "ring-orange-300",  text: "text-orange-700" },
  amber:   { label: "เหลือง",  dot: "bg-amber-400",   bar: "bg-amber-400",   soft: "bg-amber-100 text-amber-800",     ring: "ring-amber-300",   text: "text-amber-700" },
  lime:    { label: "เขียวอ่อน", dot: "bg-lime-500",   bar: "bg-lime-500",    soft: "bg-lime-100 text-lime-800",       ring: "ring-lime-300",    text: "text-lime-700" },
  emerald: { label: "เขียว",   dot: "bg-emerald-500", bar: "bg-emerald-500", soft: "bg-emerald-100 text-emerald-800", ring: "ring-emerald-300", text: "text-emerald-700" },
  teal:    { label: "เขียวน้ำทะเล", dot: "bg-teal-500", bar: "bg-teal-500",  soft: "bg-teal-100 text-teal-800",       ring: "ring-teal-300",    text: "text-teal-700" },
  sky:     { label: "ฟ้า",     dot: "bg-sky-500",     bar: "bg-sky-500",     soft: "bg-sky-100 text-sky-800",         ring: "ring-sky-300",     text: "text-sky-700" },
  indigo:  { label: "คราม",    dot: "bg-indigo-500",  bar: "bg-indigo-500",  soft: "bg-indigo-100 text-indigo-800",   ring: "ring-indigo-300",  text: "text-indigo-700" },
  fuchsia: { label: "ชมพูม่วง", dot: "bg-fuchsia-500", bar: "bg-fuchsia-500", soft: "bg-fuchsia-100 text-fuchsia-800", ring: "ring-fuchsia-300", text: "text-fuchsia-700" },
};
export const COLOR_KEYS = Object.keys(COLORS);
export const color = (key) => COLORS[key] || COLORS.stone;

export const BOARD_ICONS = {
  clipboard: { label: "ทั่วไป", Icon: ClipboardDocumentListIcon },
  briefcase: { label: "งาน", Icon: BriefcaseIcon },
  home: { label: "บ้าน", Icon: HomeIcon },
  banknotes: { label: "เงิน", Icon: BanknotesIcon },
  airplane: { label: "เดินทาง", Icon: PaperAirplaneIcon },
  heart: { label: "สุขภาพ", Icon: HeartIcon },
  academic: { label: "เรียน", Icon: AcademicCapIcon },
  cart: { label: "ช้อปปิ้ง", Icon: ShoppingCartIcon },
  lightbulb: { label: "ไอเดีย", Icon: LightBulbIcon },
  wrench: { label: "ซ่อม", Icon: WrenchScrewdriverIcon },
  gift: { label: "ของขวัญ", Icon: GiftIcon },
  star: { label: "สำคัญ", Icon: StarIcon },
  cake: { label: "วันเกิด", Icon: CakeIcon },
  bell: { label: "เตือน", Icon: BellIcon },
};
export const ICONS = BOARD_ICONS;
export const boardIcon = (key) => (BOARD_ICONS[key] || BOARD_ICONS.clipboard).Icon;

export const RECURRENCES = [
  { value: null, label: "ไม่ซ้ำ" },
  { value: "daily", label: "ทุกวัน" },
  { value: "weekly", label: "ทุกสัปดาห์" },
  { value: "monthly", label: "ทุกเดือน" },
  { value: "yearly", label: "ทุกปี" },
];
export const recurrenceLabel = (v) => RECURRENCES.find((r) => r.value === v)?.label ?? "";

// Meetings
export const WEEKDAYS = [
  { value: 1, short: "จ", label: "จันทร์" },
  { value: 2, short: "อ", label: "อังคาร" },
  { value: 3, short: "พ", label: "พุธ" },
  { value: 4, short: "พฤ", label: "พฤหัสบดี" },
  { value: 5, short: "ศ", label: "ศุกร์" },
  { value: 6, short: "ส", label: "เสาร์" },
  { value: 7, short: "อา", label: "อาทิตย์" },
];
export const MEETING_REPEATS = [
  { value: "none", label: "ไม่ซ้ำ" },
  { value: "daily", label: "ทุกวัน" },
  { value: "weekdays", label: "วันทำงาน (จ–ศ)" },
  { value: "weekly", label: "ทุกสัปดาห์" },
  { value: "biweekly", label: "ทุก 2 สัปดาห์" },
  { value: "monthly", label: "ทุกเดือน" },
];
// ISO weekday (1 = Mon) of a YYYY-MM-DD string
export const isoWeekday = (d) => ((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
// e.g. "ทุกสัปดาห์ จ, พ", "ทุกเดือน วันที่ 15", "วันทำงาน (จ–ศ) ถึง 31 ธ.ค."
export function repeatText(m) {
  const base = MEETING_REPEATS.find((r) => r.value === m.repeat)?.label ?? "";
  if (m.repeat === "none") return "ครั้งเดียว";
  let text = base;
  if (m.repeat === "weekly" || m.repeat === "biweekly") {
    const days = m.weekdays?.length ? m.weekdays : [isoWeekday(m.date)];
    text += " " + days.map((d) => WEEKDAYS[d - 1].short).join(", ");
  }
  if (m.repeat === "monthly") text += ` วันที่ ${Number(m.date.slice(8))}`;
  if (m.repeat_until) {
    const [y, mo, d] = m.repeat_until.split("-").map(Number);
    text += ` ถึง ${new Date(y, mo - 1, d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}`;
  }
  return text;
}
export const REMIND_OPTIONS = [
  { value: null, label: "ตามค่าเริ่มต้น" },
  { value: 0, label: "ไม่เตือน" },
  { value: 5, label: "5 นาที" },
  { value: 10, label: "10 นาที" },
  { value: 15, label: "15 นาที" },
  { value: 30, label: "30 นาที" },
  { value: 60, label: "1 ชั่วโมง" },
];

export const PRIORITIES = [
  { value: 0, label: "ไม่ระบุ" },
  { value: 1, label: "ต่ำ" },
  { value: 2, label: "กลาง" },
  { value: 3, label: "สูง" },
];
