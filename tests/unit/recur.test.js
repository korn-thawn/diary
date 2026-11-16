// Pure date math in server/recur.js (no server or DB needed).
const test = require("node:test");
const assert = require("node:assert/strict");
const r = require("../../server/recur");

test("addPeriod clamps to the end of shorter months and keeps the anchor day", () => {
  assert.equal(r.addPeriod("2026-01-31", "month", 1), "2026-02-28");
  assert.equal(r.addPeriod("2028-01-31", "month", 1), "2028-02-29");
  assert.equal(r.addPeriod("2026-02-28", "month", 1, 31), "2026-03-31");
  assert.equal(r.addPeriod("2026-12-15", "month", 1), "2027-01-15");
  assert.equal(r.addPeriod("2026-03-01", "month", -1), "2026-02-01");
  assert.equal(r.addPeriod("2024-02-29", "year", 1), "2025-02-28");
  assert.equal(r.addPeriod("2024-02-29", "year", 4), "2028-02-29");
  assert.equal(r.addPeriod("2026-12-30", "day", 3), "2027-01-02");
  assert.equal(r.addPeriod("2026-11-16", "week", 2), "2026-11-30");
});

test("yearly events: Feb 29 birthdays and anniversary counts", () => {
  const leap = { date: "2024-02-29", repeat: "yearly" };
  assert.deepEqual(r.occurrences(leap, "2025-01-01", "2025-12-31").map((o) => o.date), ["2025-02-28"]);
  assert.deepEqual(r.occurrences(leap, "2028-01-01", "2028-12-31").map((o) => o.date), ["2028-02-29"]);
  const mom = { date: "1965-11-21", repeat: "yearly" };
  const next = r.nextOccurrence(mom, "2026-11-16");
  assert.equal(next.date, "2026-11-21");
  assert.equal(next.days_left, 5);
  assert.equal(next.years, 61);
});

test("monthly events on the 31st land on each month's last day", () => {
  const rent = { date: "2026-01-31", repeat: "monthly" };
  assert.deepEqual(r.occurrences(rent, "2026-02-01", "2026-04-30").map((o) => o.date), ["2026-02-28", "2026-03-31", "2026-04-30"]);
});

test("one-off events", () => {
  const e = { date: "2026-11-20", repeat: "none" };
  assert.equal(r.nextOccurrence(e, "2026-11-21"), null);
  assert.equal(r.nextOccurrence(e, "2026-11-20").days_left, 0);
});

test("recurring cards skip forward past today", () => {
  assert.equal(r.nextDue("2026-11-01", "weekly", "2026-11-02"), "2026-11-08");
  assert.equal(r.nextDue("2026-10-01", "weekly", "2026-11-16"), "2026-11-19");
  assert.equal(r.nextDue("2026-01-31", "monthly", "2026-02-01"), "2026-02-28");
  assert.throws(() => r.nextDue("2026-01-01", "hourly", "2026-01-02"));
});

test("meeting series: weekdays, weekly on chosen days, biweekly, monthly, until", () => {
  const base = { start_time: "09:00", end_time: "09:30" };
  const wd = { ...base, date: "2026-11-16", repeat: "weekdays" };
  assert.deepEqual(r.meetingBaseDates(wd, "2026-11-16", "2026-11-22"), ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]);
  const wk = { ...base, date: "2026-11-16", repeat: "weekly", weekdays: [1, 3] };
  assert.deepEqual(r.meetingBaseDates(wk, "2026-11-16", "2026-11-25"), ["2026-11-16", "2026-11-18", "2026-11-23", "2026-11-25"]);
  const bi = { ...base, date: "2026-11-18", repeat: "biweekly" };
  assert.deepEqual(r.meetingBaseDates(bi, "2026-11-01", "2026-12-31"), ["2026-11-18", "2026-12-02", "2026-12-16", "2026-12-30"]);
  const mo = { ...base, date: "2026-01-31", repeat: "monthly", repeat_until: "2026-04-15" };
  assert.deepEqual(r.meetingBaseDates(mo, "2026-01-01", "2026-12-31"), ["2026-01-31", "2026-02-28", "2026-03-31"]);
});

test("meeting exceptions: cancel, move out of and into the range", () => {
  const m = { date: "2026-11-16", repeat: "daily", start_time: "09:00", end_time: "09:30" };
  const ex = [
    { date: "2026-11-17", cancelled: true },
    { date: "2026-11-18", cancelled: false, new_date: "2026-11-25", new_start: "10:00", new_end: "10:30" },
    { date: "2026-11-10", cancelled: false, new_date: "2026-11-19", new_start: "15:00", new_end: "15:30" },
  ];
  const occ = r.meetingOccurrences({ ...m, date: "2026-11-01" }, "2026-11-17", "2026-11-19", ex);
  assert.deepEqual(occ.map((o) => [o.date, o.start, o.cancelled, o.moved]), [
    ["2026-11-17", "09:00", true, false],
    ["2026-11-19", "09:00", false, false],
    ["2026-11-19", "15:00", false, true],
  ]);
  assert.equal(r.nextMeetingOccurrence(m, "2026-11-17", ex).date, "2026-11-19");
});

test("findConflicts marks overlapping meetings on the same day only", () => {
  const occs = r.findConflicts([
    { meeting_id: "1", title: "A", date: "2026-11-16", start: "09:30", end: "09:45", original_date: "2026-11-16", cancelled: false },
    { meeting_id: "2", title: "B", date: "2026-11-16", start: "09:40", end: "10:30", original_date: "2026-11-16", cancelled: false },
    { meeting_id: "3", title: "C", date: "2026-11-16", start: "10:30", end: "11:00", original_date: "2026-11-16", cancelled: false },
    { meeting_id: "4", title: "D", date: "2026-11-16", start: "09:00", end: "12:00", original_date: "2026-11-16", cancelled: true },
  ]);
  assert.deepEqual(occs.map((o) => o.conflicts.map((c) => c.title)), [["B"], ["A"], [], []]);
});
