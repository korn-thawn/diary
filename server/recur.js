// Date recurrence helpers on plain "YYYY-MM-DD" strings (UTC math, no TZ shifts).

const pad = (n) => String(n).padStart(2, "0");
const parse = (s) => s.split("-").map(Number);
const fmt = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-based
const toDays = (s) => {
  const [y, m, d] = parse(s);
  return Date.UTC(y, m - 1, d) / 86400000;
};
const fromDays = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
const diffDays = (a, b) => toDays(a) - toDays(b);

// Add n units to a date. Month/year steps clamp to the month's last day
// (Jan 31 + 1 month → Feb 28/29; Feb 29 + 1 year → Feb 28).
// `anchorDay` keeps the original day-of-month across repeated steps (Jan 31 → Feb 28 → Mar 31).
function addPeriod(date, unit, n = 1, anchorDay) {
  const [y, m, d] = parse(date);
  if (unit === "day") return fromDays(toDays(date) + n);
  if (unit === "week") return fromDays(toDays(date) + 7 * n);
  const months = unit === "month" ? n : unit === "year" ? 12 * n : NaN;
  if (Number.isNaN(months)) throw new Error(`bad unit ${unit}`);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12), nm = (total % 12) + 1;
  const day = Math.min(anchorDay ?? d, daysInMonth(ny, nm));
  return fmt(ny, nm, day);
}

const UNIT = { daily: "day", weekly: "week", monthly: "month", yearly: "year" };

// The k-th occurrence of an event (k = 0 is the original date).
function nth(event, k) {
  if (event.repeat === "yearly") return addPeriod(event.date, "year", k, parse(event.date)[2]);
  if (event.repeat === "monthly") return addPeriod(event.date, "month", k, parse(event.date)[2]);
  return k === 0 ? event.date : null;
}

// First k whose occurrence is >= `from` (cheap estimate, then step).
function firstIndexFrom(event, from) {
  if (event.repeat === "none" || diffDays(from, event.date) <= 0) return 0;
  const [fy, fm] = parse(from), [ey, em] = parse(event.date);
  let k = event.repeat === "yearly" ? fy - ey - 1 : (fy - ey) * 12 + (fm - em) - 1;
  k = Math.max(0, k);
  while (nth(event, k) < from) k++;
  return k;
}

// All occurrences within [from, to] (inclusive).
function occurrences(event, from, to) {
  const out = [];
  for (let k = firstIndexFrom(event, from); ; k++) {
    const date = nth(event, k);
    if (!date || date > to) break;
    if (date >= from) out.push({ date, years: event.repeat === "yearly" ? k : null, months: event.repeat === "monthly" ? k : null });
    if (event.repeat === "none") break;
  }
  return out;
}

// Next occurrence on or after today, or null if a one-off already passed.
function nextOccurrence(event, today) {
  const k = firstIndexFrom(event, today);
  const date = nth(event, k);
  if (!date || date < today) return null;
  return { date, days_left: diffDays(date, today), years: event.repeat === "yearly" ? k : null };
}

// Next due date for a recurring card: step past the old due date, and
// keep stepping until it's today or later (don't spawn an already-overdue card).
function nextDue(due, recurrence, today) {
  const unit = UNIT[recurrence];
  if (!unit) throw new Error(`bad recurrence ${recurrence}`);
  const anchor = parse(due)[2];
  let k = 1;
  let next = addPeriod(due, unit, k, anchor);
  while (next < today) next = addPeriod(due, unit, ++k, anchor);
  return next;
}

module.exports = { addPeriod, occurrences, nextOccurrence, nextDue, diffDays, toDays, fromDays };
