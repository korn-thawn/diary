const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Strict YYYY-MM-DD that is also a real calendar date (rejects 2026-02-31).
function isDate(s) {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Today's date in the server's local timezone (Asia/Bangkok on korn-sg-01).
// Postgres runs in UTC, so never rely on current_date for "today".
function localToday() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Allowed customization keys. Must match client/src/palette.js.
const COLORS = ["stone", "rose", "orange", "amber", "lime", "emerald", "teal", "sky", "indigo", "fuchsia"];
const BOARD_ICONS = [
  "clipboard", "briefcase", "home", "banknotes", "airplane", "heart",
  "academic", "cart", "lightbulb", "wrench", "gift", "star",
];

const ID_RE = /^\d{1,18}$/;
const isId = (v) => (typeof v === "string" || typeof v === "number") && ID_RE.test(String(v));
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Trimmed string of allowed length, else null.
function str(v, min, max) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length >= min && s.length <= max ? s : null;
}

// Run fn(client) inside a transaction.
async function tx(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Same set of ids (as strings), ignoring order; rejects duplicates.
function sameIdSet(a, b) {
  const sa = a.map(String), sb = b.map(String);
  if (new Set(sa).size !== sa.length) return false;
  if (sa.length !== sb.length) return false;
  const set = new Set(sb);
  return sa.every((x) => set.has(x));
}

module.exports = { isDate, localToday, COLORS, BOARD_ICONS, isId, TIME_RE, str, tx, sameIdSet };
