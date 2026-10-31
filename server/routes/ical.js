// Public, cookie-less ICS feed: GET /ical/<token>.ics
// The 64-hex token in the URL is the only credential (rotatable / revocable in Settings).
const express = require("express");
const rateLimit = require("express-rate-limit");
const db = require("../db");
const { buildCalendar } = require("../ics");

const router = express.Router();

router.use(
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false })
);

router.get("/:file", async (req, res) => {
  const m = /^([0-9a-f]{64})\.ics$/.exec(req.params.file);
  if (!m) return res.status(404).type("text/plain").send("not found");
  const { rows: users } = await db.query(
    "SELECT id, username, ics_cards, ics_events FROM users WHERE ics_token = $1",
    [m[1]]
  );
  const user = users[0];
  if (!user) return res.status(404).type("text/plain").send("not found");

  const [events, cards] = await Promise.all([
    user.ics_events
      ? db.query(
          `SELECT id::text AS id, title, to_char(date, 'YYYY-MM-DD') AS date, repeat,
                  to_char(time, 'HH24:MI') AS time, note
           FROM events WHERE user_id = $1 ORDER BY date, id`,
          [user.id]
        )
      : { rows: [] },
    user.ics_cards
      ? db.query(
          `SELECT k.id::text AS id, k.title, to_char(k.due_date, 'YYYY-MM-DD') AS due_date,
                  to_char(k.due_time, 'HH24:MI') AS due_time, b.name AS board_name
           FROM cards k JOIN boards b ON b.id = k.board_id JOIN board_columns c ON c.id = k.column_id
           WHERE b.user_id = $1 AND NOT b.archived AND NOT c.is_done AND k.due_date IS NOT NULL
           ORDER BY k.due_date, k.id`,
          [user.id]
        )
      : { rows: [] },
  ]);

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'inline; filename="diary.ics"');
  res.setHeader("Cache-Control", "no-cache");
  res.send(buildCalendar({ name: `ไดอารี่ (${user.username})`, events: events.rows, cards: cards.rows }));
});

module.exports = router;
