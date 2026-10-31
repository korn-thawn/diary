const express = require("express");
const db = require("../db");
const { isDate, localToday } = require("../util");
const { occurrences, diffDays, addPeriod } = require("../recur");

const router = express.Router();
const bad = (res, msg) => res.status(400).json({ error: msg });

// Per-day diary summary in [from, to]
async function entrySummary(uid, from, to) {
  const { rows } = await db.query(
    `SELECT to_char(entry_date, 'YYYY-MM-DD') AS date, count(*)::int AS count,
            round(avg(mood))::int AS mood, min(id)::text AS first_id
     FROM entries WHERE user_id = $1 AND entry_date BETWEEN $2::date AND $3::date
     GROUP BY entry_date ORDER BY entry_date`,
    [uid, from, to]
  );
  return rows;
}

// Cards with a due date in [from, to] (or, with overdueBefore, open cards due before that date)
async function dueCards(uid, from, to, { openOnly = false } = {}) {
  const { rows } = await db.query(
    `SELECT k.id::text AS id, k.board_id::text AS board_id, b.name AS board_name, b.color AS board_color,
            k.title, to_char(k.due_date, 'YYYY-MM-DD') AS due_date, to_char(k.due_time, 'HH24:MI') AS due_time,
            c.is_done AS done, k.recurrence, k.priority
     FROM cards k JOIN boards b ON b.id = k.board_id JOIN board_columns c ON c.id = k.column_id
     WHERE b.user_id = $1 AND NOT b.archived AND k.due_date IS NOT NULL
       AND ($2::date IS NULL OR k.due_date >= $2::date) AND k.due_date <= $3::date
       ${openOnly ? "AND NOT c.is_done" : ""}
     ORDER BY k.due_date, k.due_time NULLS FIRST, k.id`,
    [uid, from, to]
  );
  return rows;
}

async function eventOccurrences(uid, from, to) {
  const { rows } = await db.query(
    `SELECT id::text AS id, title, to_char(date, 'YYYY-MM-DD') AS date, repeat,
            to_char(time, 'HH24:MI') AS time, color, icon
     FROM events WHERE user_id = $1`,
    [uid]
  );
  const out = [];
  for (const e of rows) {
    for (const o of occurrences(e, from, to)) {
      out.push({ id: e.id, title: e.title, date: o.date, time: e.time, color: e.color, icon: e.icon, repeat: e.repeat, years: o.years });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""));
}

// GET /api/calendar?from=&to= — everything shown on the calendar grid (max 62 days)
router.get("/", async (req, res) => {
  const { from, to } = req.query;
  if (!isDate(from) || !isDate(to)) return bad(res, "from and to must be YYYY-MM-DD");
  const span = diffDays(to, from);
  if (span < 0 || span > 62) return bad(res, "range must be 0-62 days");
  const uid = req.session.userId;
  const [entries, cards, events] = await Promise.all([
    entrySummary(uid, from, to),
    dueCards(uid, from, to),
    eventOccurrences(uid, from, to),
  ]);
  res.json({ entries, cards, events });
});

// GET /api/calendar/upcoming?today=&days=14 — overdue open cards + next N days
router.get("/upcoming", async (req, res) => {
  const today = isDate(req.query.today) ? req.query.today : localToday();
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 1), 60);
  const until = addPeriod(today, "day", days - 1);
  const uid = req.session.userId;
  const [overdue, soon, events] = await Promise.all([
    dueCards(uid, null, addPeriod(today, "day", -1), { openOnly: true }),
    dueCards(uid, today, until, { openOnly: true }),
    eventOccurrences(uid, today, until),
  ]);
  const withLeft = (date) => diffDays(date, today);
  res.json({
    today,
    until,
    overdue: overdue.map((c) => ({ ...c, days_left: withLeft(c.due_date) })),
    items: [
      ...soon.map((c) => ({ kind: "card", date: c.due_date, time: c.due_time, days_left: withLeft(c.due_date), ...c })),
      ...events.map((e) => ({ kind: "event", days_left: withLeft(e.date), ...e })),
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || "")),
  });
});

module.exports = { router, entrySummary };
