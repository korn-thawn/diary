// Minimal RFC 5545 calendar writer for the subscribe-by-URL feed.
// Diary entries are never included — only important dates and card due dates.
const { addPeriod } = require("./recur");

const TZ = "Asia/Bangkok";
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${TZ}`,
  "BEGIN:STANDARD",
  "DTSTART:19700101T000000",
  "TZOFFSETFROM:+0700",
  "TZOFFSETTO:+0700",
  "TZNAME:+07",
  "END:STANDARD",
  "END:VTIMEZONE",
];

// TEXT escaping (RFC 5545 §3.3.11)
const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Fold a content line to ≤ 75 octets per physical line, never splitting a UTF-8 character.
function fold(line) {
  const out = [];
  let cur = "", bytes = 0, limit = 75;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > limit) {
      out.push(cur);
      cur = " ";      // continuation lines start with a space
      bytes = 1;
      limit = 75;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n");
}

const ymd = (d) => d.replace(/-/g, "");
const hm = (t) => t.replace(":", "") + "00";
const stamp = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function addMinutes(date, time, mins) {
  const [h, m] = time.split(":").map(Number);
  let total = h * 60 + m + mins;
  let d = date;
  while (total >= 1440) { total -= 1440; d = addPeriod(d, "day", 1); }
  return { date: d, time: `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}` };
}

function timing(date, time, minutes) {
  if (!time) return [`DTSTART;VALUE=DATE:${ymd(date)}`, `DTEND;VALUE=DATE:${ymd(addPeriod(date, "day", 1))}`];
  const end = addMinutes(date, time, minutes);
  return [`DTSTART;TZID=${TZ}:${ymd(date)}T${hm(time)}`, `DTEND;TZID=${TZ}:${ymd(end.date)}T${hm(end.time)}`];
}

function rrule(e) {
  const day = Number(e.date.slice(8, 10));
  if (e.repeat === "yearly") {
    // Feb 29 → last day of February every year (matches the app's own rule)
    return e.date.slice(5) === "02-29" ? "RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1" : "RRULE:FREQ=YEARLY";
  }
  if (e.repeat === "monthly") {
    // 29th–31st: Google would skip short months; the app clamps to month end instead
    return day > 28 ? "RRULE:FREQ=MONTHLY;BYMONTHDAY=-1" : "RRULE:FREQ=MONTHLY";
  }
  return null;
}

/**
 * @param {{ name: string, events: object[], cards: object[], now?: Date }} opts
 */
function buildCalendar({ name, events = [], cards = [], now = new Date() }) {
  const dtstamp = `DTSTAMP:${stamp(now)}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//korn//diary//TH",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
    `X-WR-TIMEZONE:${TZ}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...VTIMEZONE,
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:event-${e.id}@diary`,
      dtstamp,
      ...timing(e.date, e.time, 60),
      `SUMMARY:${esc(e.title)}`,
      ...(rrule(e) ? [rrule(e)] : []),
      ...(e.note ? [`DESCRIPTION:${esc(e.note)}`] : []),
      "CATEGORIES:วันสำคัญ",
      "TRANSP:TRANSPARENT",
      "END:VEVENT"
    );
  }
  for (const c of cards) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:card-${c.id}@diary`,
      dtstamp,
      ...timing(c.due_date, c.due_time, 30),
      `SUMMARY:${esc(c.title)}`,
      `DESCRIPTION:${esc(`บอร์ด: ${c.board_name}`)}`,
      "CATEGORIES:งาน",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

module.exports = { buildCalendar, fold, esc };
