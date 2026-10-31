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

// ---------- meetings ----------
// ISO weekday 1 = Monday … 7 = Sunday
const isoWeekday = (date) => ((new Date(toDays(date) * 86400000).getUTCDay() + 6) % 7) + 1;
const mondayOf = (date) => toDays(date) - (isoWeekday(date) - 1);
const minDate = (a, b) => (a < b ? a : b);
const maxDate = (a, b) => (a > b ? a : b);

// Original (un-moved) occurrence dates of a meeting series within [from, to].
function meetingBaseDates(m, from, to) {
  const start = maxDate(from, m.date);
  const end = m.repeat_until ? minDate(to, m.repeat_until) : to;
  if (start > end) return [];
  if (m.repeat === "none") return m.date >= from && m.date <= to ? [m.date] : [];
  if (m.repeat === "monthly") {
    const anchor = parse(m.date)[2];
    const [sy, sm] = parse(start), [ey, em] = parse(m.date);
    const out = [];
    for (let k = Math.max(0, (sy - ey) * 12 + (sm - em) - 1); ; k++) {
      const d = addPeriod(m.date, "month", k, anchor);
      if (d > end) break;
      if (d >= start) out.push(d);
    }
    return out;
  }
  const days = m.weekdays && m.weekdays.length ? m.weekdays.map(Number) : [isoWeekday(m.date)];
  const firstMonday = mondayOf(m.date);
  const out = [];
  for (let n = toDays(start), last = toDays(end); n <= last; n++) {
    const d = fromDays(n);
    const wd = isoWeekday(d);
    if (m.repeat === "daily") out.push(d);
    else if (m.repeat === "weekdays") { if (wd <= 5) out.push(d); }
    else if (m.repeat === "weekly") { if (days.includes(wd)) out.push(d); }
    else if (m.repeat === "biweekly") {
      if (days.includes(wd) && Math.round((mondayOf(d) - firstMonday) / 7) % 2 === 0) out.push(d);
    }
  }
  return out;
}

const isMeetingDate = (m, date) => meetingBaseDates(m, date, date).length === 1;

// Occurrences in [from, to] after applying per-occurrence exceptions.
// exceptions: [{ date, cancelled, new_date, new_start, new_end }] for THIS meeting.
// Each result: { date, start, end, original_date, cancelled, moved }
function meetingOccurrences(m, from, to, exceptions = []) {
  const ex = new Map(exceptions.map((e) => [e.date, e]));
  const out = [];
  const seen = new Set();
  for (const base of meetingBaseDates(m, from, to)) {
    seen.add(base);
    const e = ex.get(base);
    if (e?.cancelled) out.push({ date: base, start: m.start_time, end: m.end_time, original_date: base, cancelled: true, moved: false });
    else if (e) {
      if (e.new_date >= from && e.new_date <= to) out.push({ date: e.new_date, start: e.new_start, end: e.new_end, original_date: base, cancelled: false, moved: true });
    } else out.push({ date: base, start: m.start_time, end: m.end_time, original_date: base, cancelled: false, moved: false });
  }
  // occurrences moved INTO the range from outside it
  for (const e of exceptions) {
    if (e.cancelled || seen.has(e.date) || !(e.new_date >= from && e.new_date <= to)) continue;
    if (isMeetingDate(m, e.date)) out.push({ date: e.new_date, start: e.new_start, end: e.new_end, original_date: e.date, cancelled: false, moved: true });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

// Next non-cancelled occurrence on or after today (looks ahead up to ~400 days).
function nextMeetingOccurrence(m, today, exceptions = []) {
  for (let w = 0; w < 7; w++) {
    const from = addPeriod(today, "day", w * 62);
    const to = addPeriod(from, "day", 61);
    const hit = meetingOccurrences(m, from, to, exceptions).find((o) => !o.cancelled && o.date >= today);
    if (hit) return { ...hit, days_left: diffDays(hit.date, today) };
    if (m.repeat === "none" && m.date < from) return null;
    if (m.repeat_until && m.repeat_until < from) return null;
  }
  return null;
}

// Mark overlapping (non-cancelled) occurrences on the same date.
// occs: [{ meeting_id, title, date, start, end, original_date, cancelled }] → adds conflicts: [{ meeting_id, original_date, title }]
function findConflicts(occs) {
  return occs.map((a) => ({
    ...a,
    conflicts: a.cancelled
      ? []
      : occs
          .filter((b) => b !== a && !b.cancelled && b.date === a.date && a.start < b.end && b.start < a.end)
          .map((b) => ({ meeting_id: b.meeting_id, original_date: b.original_date, title: b.title, start: b.start, end: b.end })),
  }));
}

module.exports = {
  addPeriod, occurrences, nextOccurrence, nextDue, diffDays, toDays, fromDays,
  isoWeekday, meetingBaseDates, isMeetingDate, meetingOccurrences, nextMeetingOccurrence, findConflicts,
};
