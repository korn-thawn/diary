// Navigation map: folder tabs (desktop), dock (mobile) and window titles all read from here.
import {
  BookOpenIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  PencilSquareIcon,
  Squares2X2Icon,
  StarIcon,
  SunIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

// Main sections, in tab order. `match` decides which tab is active for nested pages.
export const SECTIONS = [
  { to: "/today", label: "วันนี้", icon: SunIcon, match: (p) => p.startsWith("/today") || p.startsWith("/meetings") },
  { to: "/", label: "บันทึก", icon: BookOpenIcon, match: (p) => p === "/" || p.startsWith("/entries") },
  { to: "/boards", label: "งาน", icon: Squares2X2Icon, match: (p) => p.startsWith("/boards") },
  { to: "/calendar", label: "ปฏิทิน", icon: CalendarDaysIcon, match: (p) => p.startsWith("/calendar") || p.startsWith("/events") },
  { to: "/stats", label: "สถิติ", icon: ChartBarIcon, match: (p) => p.startsWith("/stats") },
  { to: "/settings", label: "ตั้งค่า", icon: Cog6ToothIcon, match: (p) => p.startsWith("/settings") },
];

// Mobile dock: the first four sections + "more" sheet with the rest
export const DOCK = SECTIONS.slice(0, 4);
export const MORE = [
  { to: "/stats", label: "สถิติ", icon: ChartBarIcon },
  { to: "/meetings", label: "การประชุม", icon: UsersIcon },
  { to: "/events", label: "วันสำคัญ", icon: StarIcon },
  { to: "/settings", label: "ตั้งค่า", icon: Cog6ToothIcon },
];

// Window title for a path (the page can still override it)
export function windowFor(pathname) {
  if (pathname === "/entries/new") return { title: "เขียนบันทึก", icon: PencilSquareIcon, back: "/" };
  if (pathname.startsWith("/entries/")) return { title: "บันทึก", icon: BookOpenIcon, back: "/" };
  if (/^\/boards\/[^/]+/.test(pathname)) return { title: "บอร์ดงาน", icon: Squares2X2Icon, back: "/boards", wide: true };
  if (pathname.startsWith("/meetings")) return { title: "การประชุม", icon: UsersIcon, back: "/today" };
  if (pathname.startsWith("/events")) return { title: "วันสำคัญ", icon: StarIcon, back: "/calendar" };
  const s = SECTIONS.find((x) => x.match(pathname));
  if (s) return { title: s.to === "/" ? "บันทึกประจำวัน" : s.to === "/boards" ? "บอร์ดงาน" : s.label, icon: s.icon };
  return { title: "ไดอารี่", icon: BookOpenIcon };
}
