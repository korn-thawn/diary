import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowPathIcon, ChevronLeftIcon, MapPinIcon, PlusIcon, VideoCameraIcon } from "@heroicons/react/20/solid";
import { api, formatDate, today } from "../api";
import { useAuth } from "../auth";
import { color, repeatText } from "../palette";
import { countdown } from "./Events";
import MeetingModal from "../components/MeetingModal";
import { TitleButton, WindowActions } from "../components/ui/Window";

export default function Meetings() {
  const { setUser } = useAuth();
  const [, setParams] = useSearchParams();
  const [meetings, setMeetings] = useState(null);
  const [labels, setLabels] = useState({});
  const [editing, setEditing] = useState(null); // meeting | "new"
  const [error, setError] = useState("");

  const load = () =>
    Promise.all([api(`/meetings?today=${today()}`), api("/boards/labels")])
      .then(([m, l]) => {
        setMeetings(m.meetings);
        setLabels(Object.fromEntries(l.labels.map((x) => [x.id, x])));
      })
      .catch((err) => (err.status === 401 ? setUser(null) : setError(err.message)));
  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener("diary:meetings-changed", onChange);
    return () => window.removeEventListener("diary:meetings-changed", onChange);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <p className="text-red-600">{error}</p>;
  if (!meetings) return <p className="text-center text-stone-500">กำลังโหลด…</p>;

  const upcoming = meetings.filter((m) => m.next).sort((a, b) => (a.next.date + a.next.start).localeCompare(b.next.date + b.next.start));
  const ended = meetings.filter((m) => !m.next);

  const Row = ({ m }) => (
    <li>
      <div className="flex items-center gap-3 panel p-3">
        <span className={`h-10 w-1.5 shrink-0 rounded ${color(m.color).bar}`} aria-hidden="true" />
        <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(m)}>
          <p className="truncate font-medium">{m.title}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
            <span className="tabular-nums">{m.start_time}–{m.end_time}</span>
            <span className="inline-flex items-center gap-0.5"><ArrowPathIcon className="size-3" aria-hidden="true" />{repeatText(m)}</span>
            {m.location && <span className="inline-flex items-center gap-0.5"><MapPinIcon className="size-3" aria-hidden="true" />{m.location}</span>}
            {m.url && <VideoCameraIcon className="size-3.5" aria-label="มีลิงก์ประชุม" />}
          </p>
          {m.label_ids.length > 0 && (
            <span className="mt-1 flex flex-wrap gap-1">
              {m.label_ids.map((id) => labels[id] && (
                <span key={id} className={`rounded px-1.5 py-0.5 text-[11px] leading-none font-medium ${color(labels[id].color).soft}`}>{labels[id].name}</span>
              ))}
            </span>
          )}
        </button>
        {m.next && (
          <button
            className="shrink-0 text-right text-xs text-stone-500 hover:text-accent"
            onClick={() => setParams((p) => { p.set("m", m.id); p.set("d", m.next.original_date); return p; })}
            title="เปิดครั้งถัดไป"
          >
            <span className="block font-medium text-ink">{countdown(m.next.days_left)}</span>
            {formatDate(m.next.date, { weekday: "short", day: "numeric", month: "short" })} {m.next.start}
          </button>
        )}
      </div>
    </li>
  );

  return (
    <div className="space-y-5">
      <WindowActions>
        <TitleButton onClick={() => setEditing("new")}>
          <PlusIcon className="size-4" aria-hidden="true" /> เพิ่ม
        </TitleButton>
      </WindowActions>
      {meetings.length === 0 && <p className="mt-12 text-center text-stone-500">ยังไม่มีการประชุม ลองเพิ่ม Standup ทุกวันทำงาน หรือประชุมทีมทุกสัปดาห์</p>}
      <ul className="space-y-2">{upcoming.map((m) => <Row key={m.id} m={m} />)}</ul>
      {ended.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-stone-500">จบไปแล้ว</h2>
          <ul className="space-y-2 opacity-70">{ended.map((m) => <Row key={m.id} m={m} />)}</ul>
        </section>
      )}
      {editing && (
        <MeetingModal
          meeting={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
          onDeleted={() => setEditing(null)}
          onError={(err) => (err.status === 401 ? setUser(null) : setError(err.message))}
        />
      )}
    </div>
  );
}
