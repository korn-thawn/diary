// User-customizable look: color presets (light + night), custom colors, fonts and text size.
// Stored per account (/api/auth/appearance) and cached in localStorage so /theme.js can apply the
// generated CSS before the first paint. Ids must match server/appearance.js.
import { bestText, contrast, ensureContrast, isHex, mix } from "./colors";
import { FONTS } from "./fonts.generated";

export { FONTS };
export const TOKENS = [
  { key: "desk", label: "พื้นโต๊ะ" },
  { key: "paper", label: "หน้าต่าง" },
  { key: "surface", label: "กล่องข้างใน" },
  { key: "ink", label: "เส้นและตัวอักษร" },
  { key: "title", label: "แถบชื่อและปุ่มหลัก" },
  { key: "highlight", label: "ไฮไลต์" },
];

export const PRESETS = [
  {
    id: "green", label: "เขียวครีม",
    light: { desk: "#7dbb84", paper: "#fbf5e6", surface: "#ffffff", ink: "#1c2a20", title: "#23663e", highlight: "#ffe27a" },
    dark: { desk: "#10241a", paper: "#1c2a21", surface: "#25362b", ink: "#efe6cf", title: "#2f7f50", highlight: "#d9b94a" },
  },
  {
    id: "navy", label: "น้ำเงินกรมท่า",
    light: { desk: "#8fb3d9", paper: "#f7f4ec", surface: "#ffffff", ink: "#18223a", title: "#1f3a6b", highlight: "#ffd66b" },
    dark: { desk: "#0e1626", paper: "#18203a", surface: "#222c48", ink: "#e9e4d6", title: "#2c5596", highlight: "#d8b64c" },
  },
  {
    id: "lavender", label: "ม่วงลาเวนเดอร์",
    light: { desk: "#b7a6dc", paper: "#fbf7fb", surface: "#ffffff", ink: "#2a2140", title: "#5a3f97", highlight: "#ffe08a" },
    dark: { desk: "#17122a", paper: "#221b38", surface: "#2c2446", ink: "#ece4f2", title: "#6a4fb0", highlight: "#d7b85a" },
  },
  {
    id: "pink", label: "ชมพูนม",
    light: { desk: "#eeb0c1", paper: "#fff6f3", surface: "#ffffff", ink: "#3a1f2a", title: "#a2355a", highlight: "#ffe58f" },
    dark: { desk: "#2a121c", paper: "#331c26", surface: "#3e2530", ink: "#f6e6ea", title: "#a2355a", highlight: "#dcbc5a" },
  },
  {
    id: "olive", label: "มะกอกกับทราย",
    light: { desk: "#c9b98f", paper: "#fbf6e8", surface: "#fffdf7", ink: "#2b2a1a", title: "#56652a", highlight: "#f5d76e" },
    dark: { desk: "#1d1c12", paper: "#27261a", surface: "#323122", ink: "#efe9d2", title: "#5f6e2e", highlight: "#d4b84c" },
  },
  {
    id: "graphite", label: "เทากราไฟต์",
    light: { desk: "#a8adb3", paper: "#f6f6f3", surface: "#ffffff", ink: "#1d2024", title: "#3a4048", highlight: "#ffe27a" },
    dark: { desk: "#121417", paper: "#1c1f23", surface: "#25292e", ink: "#e8e8e3", title: "#4a525c", highlight: "#d9b94a" },
  },
];
export const DEFAULT_PRESET = "green";
export const SIZES = [
  { id: "s", label: "เล็ก", px: 15 },
  { id: "m", label: "ปกติ", px: 16 },
  { id: "l", label: "ใหญ่", px: 18 },
];
export const DEFAULT_FONTS = { fontDisplay: "chakra-petch", fontBody: "ibm-plex-sans-thai" };

const presetOf = (id) => PRESETS.find((p) => p.id === id);

/** The six base colors per mode for a saved appearance (custom colors win over the preset). */
export function colorsOf(a = {}) {
  const base = presetOf(a.preset) || presetOf(DEFAULT_PRESET);
  if (a.preset === "custom" && a.light && a.dark) return { light: a.light, dark: a.dark };
  return { light: base.light, dark: base.dark };
}

// share of ink mixed into the surface for each grey step (muted text, borders, tints)
const STONE = { 50: 0.035, 100: 0.07, 200: 0.14, 300: 0.26, 400: 0.45, 500: 0.65, 600: 0.74, 700: 0.82, 800: 0.88, 900: 0.94, 950: 0.97 };

/** Every CSS token for one mode, derived from its six base colors. */
export function derive(c, dark) {
  const pick = (bg) => {
    const t = bestText(bg, [c.ink, c.paper]);
    return contrast(t, bg) >= 4.5 ? t : bestText(bg, ["#ffffff", "#111111"]);
  };
  const out = {
    desk: c.desk,
    "desk-dot": mix(c.desk, c.ink, 0.9),
    paper: c.paper,
    surface: c.surface,
    ink: c.ink,
    shadow: dark ? mix(c.desk, "#000000", 0.4) : c.ink,
    title: c.title,
    "on-title": pick(c.title),
    accent: ensureContrast(ensureContrast(c.title, c.paper, 4.5), c.surface, 4.5),
    highlight: c.highlight,
    "on-highlight": pick(c.highlight),
  };
  for (const [k, t] of Object.entries(STONE)) out[`stone-${k}`] = mix(c.ink, c.surface, t);
  return out;
}

/** Readability problems in one mode's colors, each with a fix that returns corrected colors. */
export function problems(c) {
  const list = [];
  const worst = Math.min(contrast(c.ink, c.paper), contrast(c.ink, c.surface));
  if (worst < 4.5) {
    list.push({
      text: `ตัวอักษรกับพื้นหน้าต่างต่างกันน้อยไป (${worst.toFixed(1)}:1 ควรได้อย่างน้อย 4.5:1)`,
      fix: () => ({ ...c, ink: ensureContrast(ensureContrast(c.ink, c.paper, 7), c.surface, 7) }),
    });
  }
  const onTitle = bestText(c.title, [c.ink, c.paper, "#ffffff", "#111111"]);
  if (contrast(onTitle, c.title) < 4.5) {
    list.push({
      text: "สีแถบชื่อเป็นสีกลางๆ ตัวอักษรบนแถบอ่านยาก",
      fix: () => ({ ...c, title: ensureContrast(c.title, onTitle, 4.5) }),
    });
  }
  return list;
}

const fontStack = (id) => {
  const f = FONTS[id];
  return f ? `"${f.family}", "IBM Plex Sans Thai", system-ui, ${f.kind}` : null;
};

/** CSS text for a saved appearance ("" = everything default). */
export function buildCss(a = {}) {
  const parts = [];
  const custom = a.preset === "custom" || (a.preset && a.preset !== DEFAULT_PRESET && presetOf(a.preset));
  if (custom) {
    const { light, dark } = colorsOf(a);
    const vars = (tokens) => Object.entries(tokens).map(([k, v]) => `--color-${k}:${v};`).join("");
    // html:root beats @theme's :root; html:root.dark beats dark.css's .dark (both load later)
    parts.push(`html:root{${vars(derive(light, false))}}`);
    parts.push(`html:root.dark{${vars(derive(dark, true))}}`);
  }
  const display = a.fontDisplay && a.fontDisplay !== DEFAULT_FONTS.fontDisplay ? fontStack(a.fontDisplay) : null;
  const body = a.fontBody && a.fontBody !== DEFAULT_FONTS.fontBody ? fontStack(a.fontBody) : null;
  const size = SIZES.find((s) => s.id === a.size && s.id !== "m");
  if (display || body || size) {
    let v = "";
    if (body) v += `--font-sans:${body};`;
    if (display) v += `--font-display:${display};--font-serif:${display};`;
    if (size) v += `font-size:${size.px}px;`;
    parts.push(`html:root{${v}}`);
  }
  return parts.join("\n");
}

// Weights the app uses for each role; the defaults are bundled statically in index.jsx.
const ROLE_WEIGHTS = { fontDisplay: [500, 600, 700], fontBody: [400, 500, 600] };
const STATIC = { "chakra-petch": [500, 600, 700], "ibm-plex-sans-thai": [400, 500, 600] };
const loaded = new Set();

export function loadFont(id, weights) {
  const f = FONTS[id];
  if (!f) return Promise.resolve();
  const jobs = [];
  for (const w of weights) {
    // a font without that weight falls back to its nearest one (Itim only has 400)
    const have = f.weights[w] ? w : Number(Object.keys(f.weights).sort((x, y) => Math.abs(x - w) - Math.abs(y - w))[0]);
    const key = `${id}:${have}`;
    if (loaded.has(key) || STATIC[id]?.includes(have)) continue;
    loaded.add(key);
    jobs.push(f.weights[have]().catch(() => loaded.delete(key)));
  }
  return Promise.all(jobs);
}

const CACHE = "diary-appearance";

/** Apply now (live preview) and cache for the next page load. */
export function applyAppearance(a = {}) {
  for (const role of ["fontDisplay", "fontBody"]) if (a[role]) loadFont(a[role], ROLE_WEIGHTS[role]);
  const { light, dark } = colorsOf(a);
  const cached = { css: buildCss(a), paper: { light: light.paper, dark: dark.paper } };
  try {
    if (cached.css) localStorage.setItem(CACHE, JSON.stringify(cached));
    else localStorage.removeItem(CACHE);
  } catch { /* private mode: still applied for this page */ }
  window.diaryTheme?.applyUser(cached.css ? cached : null);
}

export function clearAppearance() {
  try { localStorage.removeItem(CACHE); } catch { /* ignore */ }
  window.diaryTheme?.applyUser(null);
}

export const isValidColors = (c) => c && TOKENS.every(({ key }) => isHex(c[key]));
