// Reminder scheduler: runs every minute in the (single) app process and sends Telegram messages.
// Every message is "claimed" in notifications_sent first, so restarts / overlapping ticks never double-send.
const db = require("./db");
const telegram = require("./telegram");
const { occurrences, addPeriod, diffDays } = require("./recur");
const { occurrencesFor } = require("./meetings");

const TZ = "Asia/Bangkok";
const esc = telegram.escapeHtml;

// Local date + minutes-of-day in Bangkok, independent of the host's TZ setting.
function localNow(now) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}
const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const inWindow = (minutes, start, len) => minutes >= start && minutes < start + len;
const thDate = (d) => new Date(`${d}T00:00:00+07:00`).toLocaleDateString("th-TH", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const link = (path) => (telegram.appUrl() ? `\n${telegram.appUrl()}${path}` : "");

async function labelNames(ids) {
  if (!ids?.length) return [];
  const { rows } = await db.query("SELECT name FROM labels WHERE id = ANY($1::bigint[]) ORDER BY name", [ids]);
  return rows.map((r) => r.name);
}

async function claim(userId, kind, ref) {
  const { rowCount } = await db.query(
    "INSERT INTO notifications_sent (user_id, kind, ref) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
    [userId, kind, ref]
  );
  return rowCount === 1;
}
const release = (userId, kind, ref) =>
  db.query("DELETE FROM notifications_sent WHERE user_id = $1 AND kind = $2 AND ref = $3", [userId, kind, ref]);

async function eventsBetween(userId, from, to) {
  const { rows } = await db.query(
    `SELECT id::text AS id, title, to_char(date, 'YYYY-MM-DD') AS date, repeat, to_char(time, 'HH24:MI') AS time
     FROM events WHERE user_id = $1`,
    [userId]
  );
  return rows.flatMap((e) => occurrences(e, from, to).map((o) => ({ ...e, date: o.date, years: o.years })));
}

async function openCards(userId, { before, on }) {
  const { rows } = await db.query(
    `SELECT k.id::text AS id, k.title, to_char(k.due_date, 'YYYY-MM-DD') AS due_date, to_char(k.due_time, 'HH24:MI') AS due_time,
            b.id::text AS board_id, b.name AS board
     FROM cards k JOIN boards b ON b.id = k.board_id JOIN board_columns c ON c.id = k.column_id
     WHERE b.user_id = $1 AND NOT b.archived AND NOT c.is_done AND k.due_date IS NOT NULL
       AND ${before ? "k.due_date < $2::date" : "k.due_date = $2::date"}
     ORDER BY k.due_date, k.due_time NULLS FIRST, k.id`,
    [userId, before || on]
  );
  return rows;
}

// The morning summary (also used by the /today bot command).
async function buildToday(userId, now = new Date()) {
  const { date } = localNow(now);
  const [overdue, today, events, entry, meetings] = await Promise.all([
    openCards(userId, { before: date }),
    openCards(userId, { on: date }),
    eventsBetween(userId, date, date),
    db.query("SELECT 1 FROM entries WHERE user_id = $1 AND entry_date = $2::date LIMIT 1", [userId, date]),
    occurrencesFor(userId, date, date),
  ]);
  const lines = [`<b>สรุปวันนี้ · ${esc(thDate(date))}</b>`];
  const live = meetings.filter((m) => !m.cancelled);
  if (live.length) {
    lines.push("", `<b>ประชุมวันนี้ ${live.length} รายการ</b>`);
    for (const m of live) {
      lines.push(`• ${m.start}–${m.end} ${esc(m.title)}${m.location ? ` <i>@ ${esc(m.location)}</i>` : ""}${m.conflicts.length ? " (เวลาชน)" : ""}`);
      if (m.url) lines.push(`  <a href="${esc(m.url)}">เข้าประชุม</a>`);
    }
  }
  if (events.length) {
    lines.push("", "<b>วันสำคัญ</b>");
    for (const e of events) lines.push(`• ${esc(e.title)}${e.years > 0 ? ` (ครบ ${e.years} ปี)` : ""}${e.time ? ` ${e.time}` : ""}`);
  }
  if (today.length) {
    lines.push("", "<b>งานวันนี้</b>");
    for (const c of today) lines.push(`• ${c.due_time ? `${c.due_time} ` : ""}${esc(c.title)} <i>(${esc(c.board)})</i>`);
  }
  if (overdue.length) {
    lines.push("", `<b>เลยกำหนด ${overdue.length} งาน</b>`);
    for (const c of overdue.slice(0, 10)) lines.push(`• ${esc(c.title)} — เลยมา ${diffDays(date, c.due_date)} วัน`);
    if (overdue.length > 10) lines.push(`…และอีก ${overdue.length - 10} งาน`);
  }
  if (!events.length && !today.length && !overdue.length && !live.length) lines.push("", "ไม่มีงาน ประชุม หรือวันสำคัญวันนี้");
  if (!entry.rows.length) lines.push("", "ยังไม่ได้เขียนไดอารี่วันนี้");
  return lines.join("\n") + link("/calendar");
}

async function sendClaimed(user, claims, html) {
  try {
    await telegram.send(user.tg_chat_id, html);
    return true;
  } catch (err) {
    console.error(`[reminders] send to user ${user.id} failed:`, err.message);
    // retry next tick unless the chat is gone (send() already unlinked it)
    if (err.code !== 403) for (const [kind, ref] of claims) await release(user.id, kind, ref);
    return false;
  }
}

async function remindUser(user, now) {
  const { date, minutes } = localNow(now);
  const sent = [];
  const dailyStart = toMin(user.daily_time);
  const inDaily = inWindow(minutes, dailyStart, 6 * 60); // late start after downtime is fine, up to 6 h

  // 1) morning summary
  if (user.tg_daily && inDaily && (await claim(user.id, "daily", date))) {
    if (await sendClaimed(user, [["daily", date]], await buildToday(user.id, now))) sent.push("daily");
  }

  // 2) important dates N days ahead (sent with the morning batch)
  const days = (user.tg_event_days || []).filter((d) => d > 0 && d <= 60);
  if (inDaily && days.length) {
    const max = Math.max(...days);
    const upcoming = (await eventsBetween(user.id, addPeriod(date, "day", 1), addPeriod(date, "day", max)))
      .map((e) => ({ ...e, left: diffDays(e.date, date) }))
      .filter((e) => days.includes(e.left));
    const claims = [];
    for (const e of upcoming) {
      const ref = `${e.id}:${e.date}:${e.left}`;
      if (await claim(user.id, "event", ref)) claims.push([["event", ref], e]);
    }
    if (claims.length) {
      const html = ["<b>วันสำคัญที่ใกล้ถึง</b>"]
        .concat(claims.map(([, e]) => `• ${e.left === 1 ? "พรุ่งนี้" : `อีก ${e.left} วัน`}: ${esc(e.title)}${e.years > 0 ? ` (ครบ ${e.years} ปี)` : ""} · ${esc(thDate(e.date))}`))
        .join("\n") + link("/events");
      if (await sendClaimed(user, claims.map(([c]) => c), html)) sent.push(`event×${claims.length}`);
    }
  }

  // 3) timed cards, N minutes before
  if (user.tg_card_minutes > 0) {
    for (const c of await openCards(user.id, { on: date })) {
      if (!c.due_time) continue;
      const left = toMin(c.due_time) - minutes;
      if (left < 0 || left > user.tg_card_minutes) continue;
      const ref = `${c.id}:${date}T${c.due_time}`;
      if (!(await claim(user.id, "card", ref))) continue;
      const html = `<b>${left === 0 ? "ถึงเวลาแล้ว" : `อีก ${left} นาที`}</b> · ${c.due_time}\n${esc(c.title)} <i>(${esc(c.board)})</i>` + link(`/boards/${c.board_id}?card=${c.id}`);
      if (await sendClaimed(user, [["card", ref]], html)) sent.push("card");
    }
  }

  // 5) meetings, N minutes before (per-meeting override, else the user's default)
  for (const m of await occurrencesFor(user.id, date, date)) {
    if (m.cancelled) continue;
    const before = m.remind_minutes ?? user.tg_meeting_minutes;
    if (!before) continue;
    const left = toMin(m.start) - minutes;
    if (left < 0 || left > before) continue;
    const ref = `${m.meeting_id}:${m.date}T${m.start}`;
    if (!(await claim(user.id, "meeting", ref))) continue;
    const labels = await labelNames(m.label_ids);
    const html = [
      `<b>${left === 0 ? "ประชุมเริ่มแล้ว" : `อีก ${left} นาที ประชุม`}</b> · ${m.start}–${m.end}`,
      esc(m.title) + (labels.length ? ` <i>[${esc(labels.join(", "))}]</i>` : ""),
      ...(m.location ? [`สถานที่: ${esc(m.location)}`] : []),
      ...(m.conflicts.length ? [`เวลาชนกับ: ${esc(m.conflicts.map((c) => c.title).join(", "))}`] : []),
      ...(m.url ? [`<a href="${esc(m.url)}">เข้าประชุม</a>`] : []),
    ].join("\n") + link(`/today?date=${m.date}`);
    if (await sendClaimed(user, [["meeting", ref]], html)) sent.push("meeting");
  }

  // 4) evening nudge to write the diary
  if (user.tg_diary && inWindow(minutes, toMin(user.diary_time), 3 * 60)) {
    const { rows } = await db.query("SELECT 1 FROM entries WHERE user_id = $1 AND entry_date = $2::date LIMIT 1", [user.id, date]);
    if (!rows.length && (await claim(user.id, "diary", date))) {
      const html = "วันนี้ยังไม่ได้เขียนไดอารี่ เป็นยังไงบ้าง?" + link(`/entries/new?date=${date}`);
      if (await sendClaimed(user, [["diary", date]], html)) sent.push("diary");
    }
  }
  return sent;
}

let running = false;
async function tick(now = new Date()) {
  if (running) return {};
  running = true;
  const result = {};
  try {
    const { rows: users } = await db.query(
      `SELECT id, tg_chat_id, tg_daily, to_char(tg_daily_time, 'HH24:MI') AS daily_time, tg_event_days,
              tg_card_minutes, tg_diary, to_char(tg_diary_time, 'HH24:MI') AS diary_time, tg_meeting_minutes
       FROM users WHERE tg_chat_id IS NOT NULL`
    );
    for (const u of users) {
      try {
        result[u.id] = await remindUser(u, now);
      } catch (err) {
        console.error(`[reminders] user ${u.id}:`, err.message);
      }
    }
    if (now.getUTCMinutes() === 0) {
      await db.query("DELETE FROM notifications_sent WHERE sent_at < now() - interval '90 days'");
    }
  } finally {
    running = false;
  }
  return result;
}

let timer = null;
function start() {
  if (!telegram.enabled()) return;
  const every = Number(process.env.REMINDER_TICK_MS) || 60_000;
  timer = setInterval(() => tick().catch((err) => console.error("[reminders]", err.message)), every);
  setTimeout(() => tick().catch(() => {}), 5_000);
}
const stop = () => clearInterval(timer);

module.exports = { tick, buildToday, localNow, start, stop };
