// Small color toolkit for user themes: WCAG contrast + OKLab/OKLCH so we can derive readable
// colors (text on title bars, accent links, muted greys) from whatever the user picks.

export const isHex = (s) => typeof s === "string" && /^#[0-9a-f]{6}$/i.test(s);

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const toHex = (rgb) =>
  "#" + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0")).join("");

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const delin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function luminance(hex) {
  const [r, g, b] = toRgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function toOklab(hex) {
  const [r, g, b] = toRgb(hex).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return toHex(
    [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ].map(delin)
  );
}

/** Mix two colors in OKLab; t = share of `a` (0..1). Same as CSS color-mix(in oklab, a t%, b). */
export function mix(a, b, t) {
  const p = toOklab(a), q = toOklab(b);
  return fromOklab(p.map((v, i) => v * t + q[i] * (1 - t)));
}

/** Shift lightness (keeping hue/chroma-ish) until `fg` reaches `ratio` against `bg`. */
export function ensureContrast(fg, bg, ratio = 4.5) {
  if (contrast(fg, bg) >= ratio) return fg;
  const [L, a, b] = toOklab(fg);
  const dir = luminance(bg) > 0.18 ? -1 : 1; // light background → go darker
  for (let step = 1; step <= 50; step++) {
    const nl = Math.min(1, Math.max(0, L + dir * step * 0.02));
    const fade = 1 - step / 60; // pull chroma in a little so we don't clip out of sRGB
    const c = fromOklab([nl, a * fade, b * fade]);
    if (contrast(c, bg) >= ratio) return c;
  }
  return dir < 0 ? "#000000" : "#ffffff";
}

/** The most readable of the candidate text colors on `bg`. */
export function bestText(bg, candidates) {
  return candidates.reduce((best, c) => (contrast(c, bg) > contrast(best, bg) ? c : best), candidates[0]);
}
