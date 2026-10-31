// Meeting data access shared by the API, calendar, reminders and ICS feed.
const db = require("./db");
const { meetingOccurrences, nextMeetingOccurrence, findConflicts } = require("./recur");

const SERIES_COLS = `m.id::text AS id, m.title, to_char(m.date, 'YYYY-MM-DD') AS date,
  to_char(m.start_time, 'HH24:MI') AS start_time, to_char(m.end_time, 'HH24:MI') AS end_time,
  m.repeat, m.weekdays, to_char(m.repeat_until, 'YYYY-MM-DD') AS repeat_until,
  m.location, m.url, m.color, m.agenda, m.remind_minutes, m.created_at, m.updated_at,
  coalesce((SELECT array_agg(ml.label_id::text) FROM meeting_labels ml WHERE ml.meeting_id = m.id), '{}') AS label_ids`;

async function seriesOf(userId, { id } = {}) {
  const { rows } = await db.query(
    `SELECT ${SERIES_COLS} FROM meetings m WHERE m.user_id = $1 ${id ? "AND m.id = $2" : ""} ORDER BY m.start_time, m.id`,
    id ? [userId, id] : [userId]
  );
  return rows;
}

async function exceptionsOf(meetingIds) {
  if (!meetingIds.length) return new Map();
  const { rows } = await db.query(
    `SELECT meeting_id::text AS meeting_id, to_char(date, 'YYYY-MM-DD') AS date, cancelled,
            to_char(new_date, 'YYYY-MM-DD') AS new_date, to_char(new_start, 'HH24:MI') AS new_start, to_char(new_end, 'HH24:MI') AS new_end
     FROM meeting_exceptions WHERE meeting_id = ANY($1::bigint[])`,
    [meetingIds]
  );
  const map = new Map();
  for (const r of rows) (map.get(r.meeting_id) || map.set(r.meeting_id, []).get(r.meeting_id)).push(r);
  return map;
}

/**
 * All occurrences of a user's meetings in [from, to], with series details and conflicts.
 * withMeta adds has_notes / actions_total / actions_done per occurrence.
 */
async function occurrencesFor(userId, from, to, { withMeta = false, id } = {}) {
  const series = await seriesOf(userId, { id });
  const ex = await exceptionsOf(series.map((s) => s.id));
  let list = [];
  for (const s of series) {
    for (const o of meetingOccurrences(s, from, to, ex.get(s.id) || [])) {
      list.push({
        meeting_id: s.id, title: s.title, location: s.location, url: s.url, color: s.color, agenda: s.agenda,
        repeat: s.repeat, label_ids: s.label_ids, remind_minutes: s.remind_minutes, ...o,
      });
    }
  }
  if (withMeta && list.length) {
    const ids = [...new Set(list.map((o) => o.meeting_id))];
    const [notes, actions] = await Promise.all([
      db.query(
        `SELECT meeting_id::text AS meeting_id, to_char(date, 'YYYY-MM-DD') AS date FROM meeting_notes
         WHERE meeting_id = ANY($1::bigint[]) AND notes <> ''`,
        [ids]
      ),
      db.query(
        `SELECT a.meeting_id::text AS meeting_id, to_char(a.date, 'YYYY-MM-DD') AS date, count(*)::int AS total,
                count(*) FILTER (WHERE a.done OR c.is_done)::int AS done
         FROM meeting_actions a
         LEFT JOIN cards k ON k.id = a.card_id LEFT JOIN board_columns c ON c.id = k.column_id
         WHERE a.meeting_id = ANY($1::bigint[]) GROUP BY a.meeting_id, a.date`,
        [ids]
      ),
    ]);
    const noteSet = new Set(notes.rows.map((n) => `${n.meeting_id}|${n.date}`));
    const actMap = new Map(actions.rows.map((a) => [`${a.meeting_id}|${a.date}`, a]));
    list = list.map((o) => {
      const k = `${o.meeting_id}|${o.original_date}`;
      const a = actMap.get(k);
      return { ...o, has_notes: noteSet.has(k), actions_total: a?.total ?? 0, actions_done: a?.done ?? 0 };
    });
  }
  list.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.title.localeCompare(b.title, "th"));
  return findConflicts(list);
}

async function seriesWithNext(userId, today) {
  const series = await seriesOf(userId);
  const ex = await exceptionsOf(series.map((s) => s.id));
  return series.map((s) => ({ ...s, next: nextMeetingOccurrence(s, today, ex.get(s.id) || []) }));
}

module.exports = { SERIES_COLS, seriesOf, exceptionsOf, occurrencesFor, seriesWithNext };
