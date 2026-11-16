// User-adjustable look on top of the noir theme: the neon accent color and the text size.
// Stored per account (/api/auth/appearance) and cached in localStorage so /theme.js can apply the
// generated CSS before the first paint. Accent ids must match server/appearance.js.
import { bestText, ensureContrast, isHex } from "./colors";

const BG = "#0b1211";
const RAISED = "#1a2422";

// fill = buttons / selected chips, on = text on the fill, text = accent text on the night background
export const ACCENTS = [
  { id: "red", label: "แดงนีออน", fill: "#c8261c", on: "#fff4e6", text: "#ff8a75" },
  { id: "jade", label: "หยก", fill: "#4fb8a0", on: "#0b1211", text: "#7fd1bd" },
  { id: "amber", label: "อำพัน", fill: "#f4d35e", on: "#0b1211", text: "#f4d35e" },
];
export const DEFAULT_ACCENT = "red";
export const SIZES = [
  { id: "s", label: "เล็ก", px: 15 },
  { id: "m", label: "ปกติ", px: 16 },
  { id: "l", label: "ใหญ่", px: 18 },
];

/** Resolve a saved accent ("red" | "jade" | "amber" | "#rrggbb") to its three colors. */
export function accentOf(a = {}) {
  const named = ACCENTS.find((x) => x.id === (a.accent || DEFAULT_ACCENT));
  if (named) return named;
  if (!isHex(a.accent)) return ACCENTS[0];
  const fill = a.accent.toLowerCase();
  return {
    id: "custom",
    label: "สีเอง",
    fill,
    on: bestText(fill, ["#fff4e6", BG]),
    text: ensureContrast(ensureContrast(fill, BG, 4.5), RAISED, 4.5),
  };
}

/** CSS text for a saved appearance ("" = the default red accent at normal size). */
export function buildCss(a = {}) {
  let v = "";
  if (a.accent && a.accent !== DEFAULT_ACCENT) {
    const c = accentOf(a);
    // html:root beats the @theme :root that loads after this style tag
    v += `--color-title:${c.fill};--color-on-title:${c.on};--color-accent:${c.text};`;
  }
  const size = SIZES.find((s) => s.id === a.size && s.id !== "m");
  if (size) v += `font-size:${size.px}px;`;
  return v ? `html:root{${v}}` : "";
}

const CACHE = "diary-appearance";

/** Apply now (live preview) and cache for the next page load. */
export function applyAppearance(a = {}) {
  const css = buildCss(a);
  try {
    if (css) localStorage.setItem(CACHE, JSON.stringify({ v: 2, css }));
    else localStorage.removeItem(CACHE);
  } catch { /* private mode: still applied for this page */ }
  window.diaryTheme?.applyUser(css ? { v: 2, css } : null);
}

export function clearAppearance() {
  try { localStorage.removeItem(CACHE); } catch { /* ignore */ }
  window.diaryTheme?.applyUser(null);
}
