const express = require("express");
const db = require("../db");
const { localToday, isDate } = require("../util");

const router = express.Router();

// GET /api/stats?today=YYYY-MM-DD
// `today` comes from the browser (Thai time); Postgres in the container runs on UTC.
router.get("/", async (req, res) => {
  const today = isDate(req.query.today) ? req.query.today : localToday();
  const uid = req.session.userId;

  const [totals, streak, moodDaily, moodDist, perMonth, topTags] = await Promise.all([
    db.query(
      `SELECT count(*)::int AS entries,
              count(DISTINCT entry_date)::int AS days,
              to_char(min(entry_date), 'YYYY-MM-DD') AS first_date,
              round(avg(mood), 2)::float AS avg_mood
       FROM entries WHERE user_id = $1`,
      [uid]
    ),
    // gaps-and-islands: consecutive dates share the same (date - row_number)
    db.query(
      `WITH d AS (SELECT DISTINCT entry_date FROM entries WHERE user_id = $1),
            g AS (SELECT entry_date, entry_date - (row_number() OVER (ORDER BY entry_date))::int AS grp FROM d),
            s AS (SELECT min(entry_date) AS start_date, max(entry_date) AS end_date, count(*)::int AS len
                  FROM g GROUP BY grp)
       SELECT coalesce((SELECT max(len) FROM s), 0)::int AS longest,
              coalesce((SELECT len FROM s
                        WHERE start_date <= $2::date AND end_date >= $2::date - 1
                        ORDER BY end_date DESC LIMIT 1), 0)::int AS current`,
      [uid, today]
    ),
    db.query(
      `SELECT to_char(entry_date, 'YYYY-MM-DD') AS date, round(avg(mood), 2)::float AS mood
       FROM entries
       WHERE user_id = $1 AND mood IS NOT NULL
         AND entry_date > $2::date - 90 AND entry_date <= $2::date
       GROUP BY entry_date ORDER BY entry_date`,
      [uid, today]
    ),
    db.query(
      `SELECT m AS mood, count(e.id)::int AS count
       FROM generate_series(1, 5) AS m
       LEFT JOIN entries e ON e.mood = m AND e.user_id = $1
       GROUP BY m ORDER BY m`,
      [uid]
    ),
    db.query(
      `SELECT to_char(m, 'YYYY-MM') AS month, count(e.id)::int AS count
       FROM generate_series(date_trunc('month', $2::date) - interval '11 months',
                            date_trunc('month', $2::date), interval '1 month') AS m
       LEFT JOIN entries e ON e.user_id = $1 AND date_trunc('month', e.entry_date) = m
       GROUP BY m ORDER BY m`,
      [uid, today]
    ),
    db.query(
      `SELECT t AS tag, count(*)::int AS count
       FROM entries, unnest(tags) AS t
       WHERE user_id = $1
       GROUP BY t ORDER BY count DESC, t LIMIT 10`,
      [uid]
    ),
  ]);

  res.json({
    today,
    totals: totals.rows[0],
    streak: streak.rows[0],
    moodDaily: moodDaily.rows,
    moodDist: moodDist.rows,
    perMonth: perMonth.rows,
    topTags: topTags.rows,
  });
});

module.exports = router;
