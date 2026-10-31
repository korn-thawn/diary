const express = require("express");
const crypto = require("node:crypto");
const db = require("../db");
const telegram = require("../telegram");
const { TIME_RE } = require("../util");

const router = express.Router();
const bad = (res, msg) => res.status(400).json({ error: msg });

async function state(uid) {
  const { rows } = await db.query(
    `SELECT tg_chat_id, tg_daily, to_char(tg_daily_time, 'HH24:MI') AS daily_time, tg_event_days,
            tg_card_minutes, tg_diary, to_char(tg_diary_time, 'HH24:MI') AS diary_time, tg_meeting_minutes
     FROM users WHERE id = $1`,
    [uid]
  );
  const u = rows[0];
  return {
    available: telegram.enabled(),
    bot: telegram.enabled() ? await telegram.getBotUsername() : null,
    linked: Boolean(u.tg_chat_id),
    settings: {
      daily: u.tg_daily,
      daily_time: u.daily_time,
      event_days: u.tg_event_days,
      card_minutes: u.tg_card_minutes,
      diary: u.tg_diary,
      diary_time: u.diary_time,
      meeting_minutes: u.tg_meeting_minutes,
    },
  };
}

router.get("/", async (req, res) => res.json(await state(req.session.userId)));

// One-time deep link: t.me/<bot>?start=<code>, valid 15 minutes
router.post("/link", async (req, res) => {
  if (!telegram.enabled()) return res.status(503).json({ error: "Telegram is not configured on this server" });
  const bot = await telegram.getBotUsername();
  if (!bot) return res.status(503).json({ error: "cannot reach Telegram right now" });
  const code = crypto.randomBytes(16).toString("hex");
  await db.query(
    "UPDATE users SET tg_link_code = $2, tg_link_expires = now() + interval '15 minutes' WHERE id = $1",
    [req.session.userId, code]
  );
  res.json({ url: `https://t.me/${bot}?start=${code}`, expiresInMinutes: 15 });
});

router.delete("/link", async (req, res) => {
  await db.query("UPDATE users SET tg_chat_id = NULL, tg_link_code = NULL WHERE id = $1", [req.session.userId]);
  res.json(await state(req.session.userId));
});

router.patch("/settings", async (req, res) => {
  const b = req.body || {};
  const sets = [], params = [req.session.userId];
  const add = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };
  for (const [key, col] of [["daily", "tg_daily"], ["diary", "tg_diary"]]) {
    if (b[key] === undefined) continue;
    if (typeof b[key] !== "boolean") return bad(res, `${key} must be boolean`);
    add(col, b[key]);
  }
  for (const [key, col] of [["daily_time", "tg_daily_time"], ["diary_time", "tg_diary_time"]]) {
    if (b[key] === undefined) continue;
    if (typeof b[key] !== "string" || !TIME_RE.test(b[key])) return bad(res, `${key} must be HH:MM`);
    add(col, b[key]);
  }
  if (b.event_days !== undefined) {
    const d = b.event_days;
    if (!Array.isArray(d) || d.length > 5 || !d.every((n) => Number.isInteger(n) && n >= 1 && n <= 60)) {
      return bad(res, "event_days must be up to 5 integers between 1 and 60");
    }
    add("tg_event_days", [...new Set(d)].sort((x, y) => y - x));
  }
  if (b.meeting_minutes !== undefined) {
    if (!Number.isInteger(b.meeting_minutes) || b.meeting_minutes < 0 || b.meeting_minutes > 1440) return bad(res, "meeting_minutes must be 0-1440");
    add("tg_meeting_minutes", b.meeting_minutes);
  }
  if (b.card_minutes !== undefined) {
    if (!Number.isInteger(b.card_minutes) || b.card_minutes < 0 || b.card_minutes > 1440) return bad(res, "card_minutes must be 0-1440");
    add("tg_card_minutes", b.card_minutes);
  }
  if (sets.length) await db.query(`UPDATE users SET ${sets.join(", ")} WHERE id = $1`, params);
  res.json(await state(req.session.userId));
});

router.post("/test", async (req, res) => {
  const { rows } = await db.query("SELECT tg_chat_id FROM users WHERE id = $1", [req.session.userId]);
  if (!telegram.enabled() || !rows[0].tg_chat_id) return bad(res, "Telegram is not linked");
  try {
    await telegram.send(rows[0].tg_chat_id, "ทดสอบการแจ้งเตือนจากไดอารี่ ได้รับข้อความนี้แปลว่าใช้งานได้");
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: `ส่งไม่สำเร็จ: ${err.message}` });
  }
});

module.exports = router;
