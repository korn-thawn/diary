const express = require("express");
const db = require("../db");
const { localToday } = require("../util");

const router = express.Router();

const MOOD_LABELS = { 1: "แย่มาก", 2: "ไม่ค่อยดี", 3: "เฉยๆ", 4: "ดี", 5: "ดีมาก" };

function toMarkdown(username, entries) {
  const out = [`# Diary — ${username}`, "", `ส่งออกเมื่อ ${new Date().toISOString()} · ${entries.length} บันทึก`, ""];
  for (const e of entries) {
    out.push("---", "");
    out.push(`## ${e.entry_date}${e.title ? ` · ${e.title}` : ""}`, "");
    const meta = [];
    if (e.mood) meta.push(`mood: ${MOOD_LABELS[e.mood]} (${e.mood}/5)`);
    if (e.tags.length) meta.push(e.tags.map((t) => `#${t}`).join(" "));
    if (meta.length) out.push(meta.join(" · "), "");
    out.push(e.body.trimEnd(), "");
  }
  return out.join("\n");
}

// GET /api/export?format=md|json — download all of this user's entries, oldest first
router.get("/", async (req, res) => {
  const format = req.query.format === "json" ? "json" : req.query.format === "md" ? "md" : null;
  if (!format) return res.status(400).json({ error: "format must be md or json" });

  const { rows } = await db.query(
    `SELECT id::text AS id, to_char(entry_date, 'YYYY-MM-DD') AS entry_date, title, body, mood, tags,
            created_at, updated_at
     FROM entries WHERE user_id = $1
     ORDER BY entry_date, id`,
    [req.session.userId]
  );
  const username = req.session.username;
  // username is restricted to [a-zA-Z0-9_.-] at registration, so it's safe in the header
  const filename = `diary-${username}-${localToday()}.${format}`;
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");

  if (format === "json") {
    const [boards, labels, events] = await Promise.all([
      db.query(
        `SELECT b.name, b.color, b.icon, b.archived,
           coalesce((SELECT json_agg(json_build_object(
               'name', c.name, 'color', c.color, 'is_done', c.is_done,
               'cards', coalesce((SELECT json_agg(json_build_object(
                   'title', k.title, 'description', k.description,
                   'due_date', to_char(k.due_date, 'YYYY-MM-DD'), 'due_time', to_char(k.due_time, 'HH24:MI'),
                   'priority', k.priority, 'color', k.color, 'recurrence', k.recurrence, 'completed_at', k.completed_at,
                   'created_at', k.created_at,
                   'labels', coalesce((SELECT json_agg(l.name ORDER BY l.name) FROM card_labels cl
                                       JOIN labels l ON l.id = cl.label_id WHERE cl.card_id = k.id), '[]'),
                   'items', coalesce((SELECT json_agg(json_build_object('text', i.text, 'done', i.done)
                                       ORDER BY i.position, i.id) FROM card_items i WHERE i.card_id = k.id), '[]')
                 ) ORDER BY k.position, k.id) FROM cards k WHERE k.column_id = c.id), '[]')
             ) ORDER BY c.position, c.id) FROM board_columns c WHERE c.board_id = b.id), '[]') AS columns
         FROM boards b WHERE b.user_id = $1 ORDER BY b.position, b.id`,
        [req.session.userId]
      ),
      db.query("SELECT name, color FROM labels WHERE user_id = $1 ORDER BY name", [req.session.userId]),
      db.query(
        `SELECT title, to_char(date, 'YYYY-MM-DD') AS date, repeat, to_char(time, 'HH24:MI') AS time, color, icon, note
         FROM events WHERE user_id = $1 ORDER BY date, id`,
        [req.session.userId]
      ),
    ]);
    res.type("application/json").send(
      JSON.stringify(
        { exportedAt: new Date().toISOString(), username, entries: rows, events: events.rows, labels: labels.rows, boards: boards.rows },
        null,
        2
      )
    );
  } else {
    res.type("text/markdown; charset=utf-8").send(toMarkdown(username, rows));
  }
});

module.exports = router;
