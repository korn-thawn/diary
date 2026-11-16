// Validation for users.appearance (noir theme): { accent?, size? }.
// accent is one of the named colors (ids must match ACCENTS in client/src/appearance.js) or a custom #rrggbb.
const ACCENTS = ["red", "jade", "amber"];
const SIZES = ["s", "m", "l"];
const HEX = /^#[0-9a-f]{6}$/i;
const KEYS = ["accent", "size"];

/** @returns {{ value?: object, error?: string }} */
function validateAppearance(a) {
  if (a === null || typeof a !== "object" || Array.isArray(a)) return { error: "appearance must be an object" };
  const extra = Object.keys(a).filter((k) => !KEYS.includes(k));
  if (extra.length) return { error: `unknown field: ${extra[0]}` };
  const out = {};
  if (a.accent !== undefined) {
    if (typeof a.accent !== "string" || !(ACCENTS.includes(a.accent) || HEX.test(a.accent))) {
      return { error: "accent must be red, jade, amber or #rrggbb" };
    }
    out.accent = ACCENTS.includes(a.accent) ? a.accent : a.accent.toLowerCase();
  }
  if (a.size !== undefined) {
    if (!SIZES.includes(a.size)) return { error: "size must be s, m or l" };
    out.size = a.size;
  }
  return { value: out };
}

module.exports = { validateAppearance, ACCENTS };
