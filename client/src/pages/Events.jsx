import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowPathIcon, ChevronLeftIcon, PlusIcon } from "@heroicons/react/20/solid";
import { api, formatDate, today } from "../api";
import { useAuth } from "../auth";
import { color, ICONS } from "../palette";
import EventModal from "../components/EventModal";

const REPEAT_LABEL = { none: "ครั้งเดียว", monthly: "ทุกเดือน", yearly: "ทุกปี" };

export function countdown(daysLeft) {
  if (daysLeft === 0) return "วันนี้";
  if (daysLeft === 1) return "พรุ่งนี้";
  return `อีก ${daysLeft} วัน`;
}

export function EventIcon({ event, size = "size-9", iconSize = "size-5" }) {
  const Icon = (ICONS[event.icon] || ICONS.star).Icon;
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-xl ${size} ${color(event.color).soft}`}>
      <Icon className={iconSize} aria-hidden="true" />
    </span>
  );
}

export default function Events() {
  const { setUser } = useAuth();
  const [events, setEvents] = useState(null);
  const [editing, setEditing] = useState(null); // event | "new"
  const [error, setError] = useState("");

  const load = () =>
    api(`/events?today=${today()}`)
      .then((d) => setEvents(d.events))
      .catch((err) => (err.status === 401 ? setUser(null) : setError(err.message)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <p className="text-red-600">{error}</p>;
  if (!events) return <p className="text-center text-stone-500">กำลังโหลด…</p>;

  const upcoming = events.filter((e) => e.next);
  const past = events.filter((e) => !e.next);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/calendar" className="btn btn-ghost px-2" aria-label="กลับไปปฏิทิน">
          <ChevronLeftIcon className="size-5" />
        </Link>
        <h1 className="font-serif text-2xl font-semibold">วันสำคัญ</h1>
        <button className="btn btn-primary ml-auto" onClick={() => setEditing("new")}>
          <PlusIcon className="size-4" aria-hidden="true" /> เพิ่ม
        </button>
      </div>

      {events.length === 0 && (
        <p className="mt-12 text-center text-stone-500">ยังไม่มีวันสำคัญ ลองเพิ่มวันเกิด วันครบรอบ หรือวันจ่ายบิลรายเดือน</p>
      )}

      <ul className="space-y-2">
        {upcoming.map((e) => (
          <li key={e.id}>
            <button onClick={() => setEditing(e)} className="flex w-full items-center gap-3 rounded-xl bg-surface p-3 text-left shadow-sm ring-1 ring-stone-200 hover:ring-stone-400">
              <EventIcon event={e} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{e.title}</p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
                  <span>{formatDate(e.next, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}{e.time && ` ${e.time}`}</span>
                  {e.repeat !== "none" && (
                    <span className="inline-flex items-center gap-0.5"><ArrowPathIcon className="size-3" aria-hidden="true" />{REPEAT_LABEL[e.repeat]}</span>
                  )}
                  {e.years > 0 && <span>ครบ {e.years} ปี</span>}
                </p>
              </div>
              <span className={`shrink-0 text-sm tabular-nums ${e.days_left <= 7 ? "font-semibold text-ink" : "text-stone-500"}`}>
                {countdown(e.days_left)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {past.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-stone-500">ผ่านไปแล้ว</h2>
          <ul className="space-y-2 opacity-70">
            {past.map((e) => (
              <li key={e.id}>
                <button onClick={() => setEditing(e)} className="flex w-full items-center gap-3 rounded-xl bg-surface p-3 text-left ring-1 ring-stone-200 hover:ring-stone-400">
                  <EventIcon event={e} size="size-8" iconSize="size-4" />
                  <span className="min-w-0 flex-1 truncate">{e.title}</span>
                  <span className="text-xs text-stone-500">{formatDate(e.date, { day: "numeric", month: "short", year: "numeric" })}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editing && (
        <EventModal
          event={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          onDeleted={() => { setEditing(null); load(); }}
          onError={(err) => (err.status === 401 ? setUser(null) : setError(err.message))}
        />
      )}
    </div>
  );
}
