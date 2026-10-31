import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  ExclamationCircleIcon,
  PencilSquareIcon,
  PlusIcon,
  StarIcon,
} from "@heroicons/react/20/solid";
import { api, formatDate, moodOf, today } from "../api";
import { addMonths, isDate, isMonth, monthGrid } from "../dates";
import { useAuth } from "../auth";
import { color } from "../palette";
import { MoodDot } from "../components/Mood";
import EventModal from "../components/EventModal";
import { countdown, EventIcon } from "./Events";

const WEEKDAYS = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const LAYERS = [
  { key: "entries", label: "บันทึก" },
  { key: "cards", label: "งาน" },
  { key: "events", label: "วันสำคัญ" },
];
const loadLayers = () => {
  try {
    return { entries: true, cards: true, events: true, ...JSON.parse(localStorage.getItem("cal-layers") || "{}") };
  } catch {
    return { entries: true, cards: true, events: true };
  }
};
const lastDay = (month) => {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
};

function Upcoming({ data, onOpenEvent }) {
  const [open, setOpen] = useState(true);
  if (!data) return null;
  const total = data.overdue.length + data.items.length;
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-stone-200 sm:p-5">
      <button className="flex w-full items-center justify-between" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <h2 className="font-serif text-lg font-semibold">ใกล้ถึง <span className="text-sm font-normal text-stone-500">14 วัน</span></h2>
        <span className="text-xs text-stone-500">{total ? `${total} รายการ` : "ไม่มี"} · {open ? "ซ่อน" : "แสดง"}</span>
      </button>
      {open && total > 0 && (
        <ul className="mt-3 divide-y divide-stone-100">
          {data.overdue.map((c) => (
            <li key={`o${c.id}`}>
              <Link to={`/boards/${c.board_id}?card=${c.id}`} className="flex items-center gap-3 py-2 hover:bg-stone-50">
                <ExclamationCircleIcon className="size-5 shrink-0 text-red-600" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
                <span className="shrink-0 text-xs font-medium text-red-700">เลยกำหนด {-c.days_left} วัน</span>
              </Link>
            </li>
          ))}
          {data.items.map((it) =>
            it.kind === "card" ? (
              <li key={`c${it.id}`}>
                <Link to={`/boards/${it.board_id}?card=${it.id}`} className="flex items-center gap-3 py-2 hover:bg-stone-50">
                  <ClipboardDocumentCheckIcon className={`size-5 shrink-0 ${color(it.board_color).text}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">
                    {it.title} <span className="text-xs text-stone-400">· {it.board_name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-stone-500">{countdown(it.days_left)}{it.time && ` ${it.time}`}</span>
                </Link>
              </li>
            ) : (
              <li key={`e${it.id}-${it.date}`}>
                <button onClick={() => onOpenEvent(it.id)} className="flex w-full items-center gap-3 py-2 text-left hover:bg-stone-50">
                  <EventIcon event={it} size="size-6" iconSize="size-4" />
                  <span className="min-w-0 flex-1 truncate">
                    {it.title}
                    {it.years > 0 && <span className="text-xs text-stone-400"> · ครบ {it.years} ปี</span>}
                  </span>
                  <span className="shrink-0 text-xs text-stone-500">{countdown(it.days_left)}</span>
                </button>
              </li>
            )
          )}
        </ul>
      )}
    </section>
  );
}

export default function Calendar() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const todayStr = today();
  const selected = isDate(params.get("date")) ? params.get("date") : null;
  const month = isMonth(params.get("month")) ? params.get("month") : (selected || todayStr).slice(0, 7);

  const [data, setData] = useState(null);
  const [upcoming, setUpcoming] = useState(null);
  const [layers, setLayers] = useState(loadLayers);
  const [editing, setEditing] = useState(null); // { event } | { defaultDate }
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const fail = (err) => (err.status === 401 ? setUser(null) : setError(err.message));

  useEffect(() => {
    let cancelled = false;
    setData(null);
    api(`/calendar?from=${month}-01&to=${lastDay(month)}`)
      .then((d) => !cancelled && setData(d))
      .catch(fail);
    return () => { cancelled = true; };
  }, [month, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api(`/calendar/upcoming?today=${todayStr}&days=14`).then(setUpcoming).catch(fail);
  }, [reload]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => localStorage.setItem("cal-layers", JSON.stringify(layers)), [layers]);

  // Index everything by date
  const byDate = useMemo(() => {
    const map = {};
    const at = (d) => (map[d] ||= { entry: null, cards: [], events: [] });
    if (data) {
      for (const e of data.entries) at(e.date).entry = e;
      for (const c of data.cards) at(c.due_date).cards.push(c);
      for (const e of data.events) at(e.date).events.push(e);
    }
    return map;
  }, [data]);

  const weeks = useMemo(() => monthGrid(month), [month]);
  const thisMonth = todayStr.slice(0, 7);
  const go = (next) => setParams(next, { replace: false });
  const goMonth = (m) => go(m === thisMonth ? {} : { month: m });
  const select = (date) => go({ ...(month !== thisMonth ? { month } : {}), date });

  async function openEvent(id) {
    try {
      const { events } = await api(`/events?today=${todayStr}`);
      const ev = events.find((e) => e.id === id);
      if (ev) setEditing({ event: ev });
    } catch (err) { fail(err); }
  }

  const day = selected ? byDate[selected] || { entry: null, cards: [], events: [] } : null;

  return (
    <div className="space-y-5">
      <Upcoming data={upcoming} onOpenEvent={openEvent} />

      <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-stone-200 sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button className="btn btn-ghost px-2" onClick={() => goMonth(addMonths(month, -1))} aria-label="เดือนก่อน">
            <ChevronLeftIcon className="size-5" />
          </button>
          <h1 className="text-center font-serif text-xl font-semibold">
            {formatDate(`${month}-01`, { month: "long", year: "numeric" })}
          </h1>
          <div className="flex items-center gap-1">
            {month !== thisMonth && (
              <button className="btn btn-ghost px-2 text-sm" onClick={() => goMonth(thisMonth)}>วันนี้</button>
            )}
            <button className="btn btn-ghost px-2" onClick={() => goMonth(addMonths(month, 1))} aria-label="เดือนถัดไป">
              <ChevronRightIcon className="size-5" />
            </button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          {LAYERS.map((l) => (
            <button
              key={l.key}
              aria-pressed={layers[l.key]}
              onClick={() => setLayers((s) => ({ ...s, [l.key]: !s[l.key] }))}
              className={`rounded-full px-3 py-1 transition ${layers[l.key] ? "bg-ink text-paper" : "bg-stone-100 text-stone-500"}`}
            >
              {l.label}
            </button>
          ))}
          <Link to="/events" className="ml-auto inline-flex items-center gap-1 text-stone-600 hover:text-accent">
            <StarIcon className="size-4" aria-hidden="true" /> วันสำคัญทั้งหมด
          </Link>
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <table className={`w-full table-fixed border-separate border-spacing-1 ${data ? "" : "opacity-50"}`}>
          <thead>
            <tr>
              {WEEKDAYS.map((d) => <th key={d} className="pb-1 text-xs font-medium text-stone-500">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, i) => (
              <tr key={i}>
                {week.map((date, j) => {
                  if (!date) return <td key={j} />;
                  const d = byDate[date];
                  const entry = layers.entries && d?.entry;
                  const cards = (layers.cards && d?.cards) || [];
                  const openCards = cards.filter((c) => !c.done);
                  const overdue = date < todayStr && openCards.length > 0;
                  const events = (layers.events && d?.events) || [];
                  const isToday = date === todayStr;
                  const isSel = date === selected;
                  const label = [
                    formatDate(date, { weekday: "long", day: "numeric", month: "long" }),
                    entry && `${entry.count} บันทึก`,
                    cards.length && `${cards.length} งาน${overdue ? " (เลยกำหนด)" : ""}`,
                    ...events.map((e) => e.title),
                  ].filter(Boolean).join(" · ");
                  return (
                    <td key={j} className="p-0 align-top">
                      <button
                        onClick={() => select(date)}
                        aria-label={label}
                        aria-pressed={isSel}
                        title={label}
                        className={`flex aspect-square w-full flex-col items-center justify-start gap-0.5 rounded-lg pt-1 text-sm transition sm:pt-1.5 ${
                          isSel ? "bg-ink text-paper" : d ? "bg-stone-100 hover:bg-stone-200" : "hover:bg-stone-100"
                        } ${isToday && !isSel ? "ring-2 ring-accent" : ""}`}
                      >
                        <span className={isToday && !isSel ? "font-semibold text-accent" : ""}>{Number(date.slice(8))}</span>
                        <span className="flex h-2.5 items-center gap-0.5">
                          {entry && (entry.mood ? <MoodDot value={entry.mood} size="size-2" /> : <span className="size-2 rounded-full bg-stone-300" aria-hidden="true" />)}
                          {events.slice(0, 3).map((e, k) => (
                            <span key={k} className={`size-2 rotate-45 rounded-[2px] ${color(e.color).dot}`} aria-hidden="true" />
                          ))}
                        </span>
                        {cards.length > 0 && (
                          <span className={`flex items-center gap-0.5 text-[10px] leading-none ${overdue ? (isSel ? "text-red-200" : "text-red-700") : isSel ? "text-stone-300" : "text-stone-500"}`}>
                            {overdue ? <ExclamationCircleIcon className="size-3" aria-hidden="true" /> : <ClipboardDocumentCheckIcon className="size-3" aria-hidden="true" />}
                            {cards.length}
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-stone-500">
          <span className="inline-flex items-center gap-1.5"><MoodDot value={4} size="size-2" /> บันทึก (สีตามอารมณ์)</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rotate-45 rounded-[2px] bg-rose-500" /> วันสำคัญ</span>
          <span className="inline-flex items-center gap-1"><ClipboardDocumentCheckIcon className="size-3" /> งานครบกำหนด</span>
          <span className="inline-flex items-center gap-1 text-red-700"><ExclamationCircleIcon className="size-3" /> เลยกำหนด</span>
        </div>
      </section>

      {day && (
        <section className="space-y-4 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-stone-200 sm:p-5" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-serif text-lg font-semibold">
              {formatDate(selected, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </h2>
            <div className="flex gap-2">
              <button className="btn btn-ghost px-2.5 py-1.5 text-sm ring-1 ring-stone-300" onClick={() => setEditing({ defaultDate: selected })}>
                <StarIcon className="size-4" aria-hidden="true" /> เพิ่มวันสำคัญ
              </button>
              <button className="btn btn-primary px-2.5 py-1.5 text-sm" onClick={() => navigate(`/entries/new?date=${selected}`)}>
                <PencilSquareIcon className="size-4" aria-hidden="true" /> เขียนบันทึก
              </button>
            </div>
          </div>

          {!day.entry && !day.cards.length && !day.events.length && <p className="text-sm text-stone-500">ยังไม่มีอะไรในวันนี้</p>}

          {day.events.length > 0 && (
            <ul className="space-y-1.5">
              {day.events.map((e) => (
                <li key={e.id}>
                  <button onClick={() => openEvent(e.id)} className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left hover:bg-stone-50">
                    <EventIcon event={e} size="size-8" iconSize="size-4" />
                    <span className="min-w-0 flex-1 truncate font-medium">{e.title}</span>
                    <span className="shrink-0 text-xs text-stone-500">
                      {e.time}
                      {e.years > 0 && ` · ครบ ${e.years} ปี`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {day.entry && (
            <Link
              to={day.entry.count === 1 ? `/entries/${day.entry.first_id}` : `/?from=${selected}&to=${selected}`}
              className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-stone-50"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-stone-100">
                <MoodDot value={day.entry.mood} />
                {!day.entry.mood && <span className="size-2.5 rounded-full bg-stone-300" />}
              </span>
              <span className="flex-1">บันทึก {day.entry.count} รายการ</span>
              {day.entry.mood && <span className="text-xs text-stone-500">อารมณ์ {moodOf(day.entry.mood).label}</span>}
            </Link>
          )}

          {day.cards.length > 0 && (
            <ul className="space-y-1">
              {day.cards.map((c) => (
                <li key={c.id}>
                  <Link to={`/boards/${c.board_id}?card=${c.id}`} className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-stone-50">
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${color(c.board_color).soft}`}>
                      <ClipboardDocumentCheckIcon className="size-4" aria-hidden="true" />
                    </span>
                    <span className={`min-w-0 flex-1 truncate ${c.done ? "text-stone-400 line-through" : ""}`}>
                      {c.title}
                      {c.recurrence && <ArrowPathIcon className="ml-1 inline size-3.5 text-stone-400" aria-label="ทำซ้ำ" />}
                    </span>
                    <span className="shrink-0 text-xs text-stone-500">
                      {c.done ? "เสร็จแล้ว" : c.due_time || ""} · {c.board_name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!selected && (
        <p className="text-center text-xs text-stone-400">
          <PlusIcon className="inline size-3.5" aria-hidden="true" /> แตะที่วันเพื่อดูรายละเอียด เขียนบันทึก หรือเพิ่มวันสำคัญ
        </p>
      )}

      {editing && (
        <EventModal
          event={editing.event || null}
          defaultDate={editing.defaultDate}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setReload((n) => n + 1); }}
          onDeleted={() => { setEditing(null); setReload((n) => n + 1); }}
          onError={fail}
        />
      )}
    </div>
  );
}
