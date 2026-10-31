import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  ListBulletIcon,
  MapPinIcon,
  PlusIcon,
  VideoCameraIcon,
} from "@heroicons/react/20/solid";
import { api, formatDate, today } from "../api";
import { isDate } from "../dates";
import { useAuth } from "../auth";
import { color } from "../palette";
import { EventIcon } from "./Events";
import { TitleButton, WindowActions } from "../components/ui/Window";
import MeetingModal from "../components/MeetingModal";

const PX_PER_MIN = 1.1;
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const shift = (date, n) => {
  const [y, m, d] = date.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + n));
  return x.toISOString().slice(0, 10);
};

// Place overlapping items side by side: returns items with { col, cols }.
function layout(items) {
  const sorted = [...items].sort((a, b) => a.s - b.s || b.e - a.e);
  const out = [];
  let cluster = [], clusterEnd = -1;
  const flush = () => {
    const cols = [];
    for (const it of cluster) {
      let c = cols.findIndex((end) => end <= it.s);
      if (c === -1) { c = cols.length; cols.push(0); }
      cols[c] = it.e;
      it.col = c;
    }
    for (const it of cluster) out.push({ ...it, cols: cols.length });
    cluster = [];
  };
  for (const it of sorted) {
    if (cluster.length && it.s >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.e);
  }
  if (cluster.length) flush();
  return out;
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function Today() {
  const { setUser } = useAuth();
  const [params, setParams] = useSearchParams();
  const todayStr = today();
  const date = isDate(params.get("date")) ? params.get("date") : todayStr;
  const isToday = date === todayStr;
  const now = useNow();

  const [data, setData] = useState(null);
  const [overdue, setOverdue] = useState([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const onChange = () => setReload((n) => n + 1);
    window.addEventListener("diary:meetings-changed", onChange);
    return () => window.removeEventListener("diary:meetings-changed", onChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError("");
    Promise.all([
      api(`/calendar?from=${date}&to=${date}`),
      isToday ? api(`/calendar/upcoming?today=${todayStr}&days=1`) : Promise.resolve({ overdue: [] }),
    ])
      .then(([d, up]) => { if (!cancelled) { setData(d); setOverdue(up.overdue); } })
      .catch((err) => (err.status === 401 ? setUser(null) : setError(err.message)));
    return () => { cancelled = true; };
  }, [date, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (d) => setParams(d === todayStr ? {} : { date: d });
  const openOcc = (o) => setParams((p) => { p.set("m", o.meeting_id); p.set("d", o.original_date); return p; });

  const meetings = data?.meetings || [];
  const timedCards = (data?.cards || []).filter((c) => c.due_time);
  const allDayCards = (data?.cards || []).filter((c) => !c.due_time);
  const events = data?.events || [];

  const items = useMemo(
    () =>
      layout([
        ...meetings.map((m) => ({ kind: "meeting", key: `m${m.meeting_id}-${m.original_date}`, s: toMin(m.start), e: Math.max(toMin(m.end), toMin(m.start) + 15), m })),
        ...timedCards.map((c) => ({ kind: "card", key: `c${c.id}`, s: toMin(c.due_time), e: toMin(c.due_time) + 30, c })),
      ]),
    [data] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const startHour = Math.min(7, ...items.map((i) => Math.floor(i.s / 60)));
  const endHour = Math.max(22, ...items.map((i) => Math.ceil(i.e / 60)));
  const top = (min) => (min - startHour * 60) * PX_PER_MIN;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const conflictCount = meetings.filter((m) => !m.cancelled && m.conflicts.length).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-ghost px-2" onClick={() => go(shift(date, -1))} aria-label="วันก่อน"><ChevronLeftIcon className="size-5" /></button>
        <h1 className="font-serif text-xl font-semibold">
          {isToday ? "วันนี้ · " : ""}{formatDate(date, { weekday: "long", day: "numeric", month: "long" })}
        </h1>
        <button className="btn btn-ghost px-2" onClick={() => go(shift(date, 1))} aria-label="วันถัดไป"><ChevronRightIcon className="size-5" /></button>
        {!isToday && <button className="btn btn-ghost px-2 text-sm" onClick={() => go(todayStr)}>วันนี้</button>}
        <Link to="/meetings" viewTransition className="ml-auto inline-flex items-center gap-1 text-sm text-stone-600 underline-offset-4 hover:text-ink hover:underline">
          <ListBulletIcon className="size-4" aria-hidden="true" /> การประชุมทั้งหมด
        </Link>
        <WindowActions>
          <TitleButton onClick={() => setAdding(true)}>
            <PlusIcon className="size-4" aria-hidden="true" /> ประชุม
          </TitleButton>
        </WindowActions>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {conflictCount > 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900" role="alert">
          <ExclamationTriangleIcon className="size-4 shrink-0" aria-hidden="true" />
          มีประชุมเวลาชนกัน {conflictCount} รายการ
        </p>
      )}

      {(events.length > 0 || allDayCards.length > 0 || overdue.length > 0) && (
        <section className="space-y-1.5 panel p-4">
          {events.map((e) => (
            <div key={`e${e.id}`} className="flex items-center gap-2 text-sm">
              <EventIcon event={e} size="size-6" iconSize="size-3.5" />
              <span className="font-medium">{e.title}</span>
              {e.years > 0 && <span className="text-xs text-stone-500">ครบ {e.years} ปี</span>}
            </div>
          ))}
          {overdue.map((c) => (
            <Link key={`o${c.id}`} to={`/boards/${c.board_id}?card=${c.id}`} className="flex items-center gap-2 text-sm hover:text-accent">
              <ExclamationCircleIcon className="size-5 shrink-0 text-red-600" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
              <span className="shrink-0 text-xs font-medium text-red-700">เลยกำหนด {-c.days_left} วัน</span>
            </Link>
          ))}
          {allDayCards.map((c) => (
            <Link key={`a${c.id}`} to={`/boards/${c.board_id}?card=${c.id}`} className="flex items-center gap-2 text-sm hover:text-accent">
              <ClipboardDocumentCheckIcon className={`size-5 shrink-0 ${color(c.board_color).text}`} aria-hidden="true" />
              <span className={`min-w-0 flex-1 truncate ${c.done ? "text-stone-400 line-through" : ""}`}>{c.title}</span>
              <span className="shrink-0 text-xs text-stone-500">{c.board_name}</span>
            </Link>
          ))}
        </section>
      )}

      <section className="panel p-3 sm:p-4" aria-label="ตารางเวลา">
        {!data ? (
          <p className="p-6 text-center text-stone-500">กำลังโหลด…</p>
        ) : (
          <div className="relative flex" style={{ height: (endHour - startHour) * 60 * PX_PER_MIN }}>
            {/* hour gutter + grid lines */}
            <div className="w-12 shrink-0">
              {Array.from({ length: endHour - startHour }, (_, i) => (
                <div key={i} className="absolute left-0 w-12 -translate-y-2 text-right text-[11px] text-stone-400 tabular-nums" style={{ top: i * 60 * PX_PER_MIN }}>
                  {String(startHour + i).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            <div className="relative ml-2 flex-1">
              {Array.from({ length: endHour - startHour }, (_, i) => (
                <div key={i} className="absolute inset-x-0 border-t border-stone-100" style={{ top: i * 60 * PX_PER_MIN }} />
              ))}
              {items.length === 0 && (
                <p className="absolute inset-x-0 top-1/3 text-center text-sm text-stone-400">ไม่มีประชุมหรืองานที่ตั้งเวลาไว้</p>
              )}
              {items.map((it) => {
                const style = {
                  top: top(it.s),
                  height: Math.max((it.e - it.s) * PX_PER_MIN, 40),
                  left: `${(it.col / it.cols) * 100}%`,
                  width: `calc(${100 / it.cols}% - 4px)`,
                };
                if (it.kind === "card") {
                  const c = it.c;
                  return (
                    <Link key={it.key} to={`/boards/${c.board_id}?card=${c.id}`} style={style} className="absolute overflow-hidden rounded-lg border border-dashed border-stone-300 bg-surface px-2 py-1 text-xs hover:border-stone-500">
                      <span className="flex items-center gap-1 font-medium">
                        <ClipboardDocumentCheckIcon className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className={`truncate ${c.done ? "text-stone-400 line-through" : ""}`}>{c.title}</span>
                      </span>
                      <span className="text-stone-500">{c.due_time} · {c.board_name}</span>
                    </Link>
                  );
                }
                const m = it.m;
                const clash = !m.cancelled && m.conflicts.length > 0;
                return (
                  <button
                    key={it.key}
                    style={style}
                    onClick={() => openOcc(m)}
                    className={`absolute overflow-hidden rounded-lg px-2 py-1 text-left text-xs transition ${color(m.color).soft} ${
                      m.cancelled ? "opacity-50" : "hover:brightness-95"
                    } ${clash ? "ring-2 ring-amber-500" : ""}`}
                    aria-label={`${m.title} ${m.start}–${m.end}${m.cancelled ? " ยกเลิก" : ""}${clash ? " เวลาชน" : ""}`}
                  >
                    <span className={`block truncate font-semibold ${m.cancelled ? "line-through" : ""}`}>{m.title}</span>
                    <span className="flex flex-wrap items-center gap-x-2 opacity-80">
                      <span className="tabular-nums">{m.start}–{m.end}</span>
                      {m.url && !m.cancelled && <VideoCameraIcon className="size-3.5" aria-label="มีลิงก์ประชุม" />}
                      {m.location && <span className="inline-flex items-center gap-0.5 truncate"><MapPinIcon className="size-3" aria-hidden="true" />{m.location}</span>}
                      {clash && <span className="inline-flex items-center gap-0.5 font-medium"><ExclamationTriangleIcon className="size-3" aria-hidden="true" />เวลาชน</span>}
                      {m.cancelled && <span className="font-medium">ยกเลิก</span>}
                    </span>
                  </button>
                );
              })}
              {isToday && nowMin >= startHour * 60 && nowMin <= endHour * 60 && (
                <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: top(nowMin) }} aria-hidden="true">
                  <span className="-ml-1.5 size-2.5 rounded-full bg-accent" />
                  <span className="h-0.5 flex-1 bg-accent" />
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {adding && (
        <MeetingModal
          defaultDate={date}
          onClose={() => setAdding(false)}
          onSaved={() => setAdding(false)}
          onDeleted={() => setAdding(false)}
          onError={(err) => (err.status === 401 ? setUser(null) : setError(err.message))}
        />
      )}
    </div>
  );
}
