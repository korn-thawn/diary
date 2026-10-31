import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  PencilSquareIcon,
  PlusIcon,
  VideoCameraIcon,
  XCircleIcon,
  XMarkIcon,
} from "@heroicons/react/20/solid";
import { api, formatDate, today } from "../api";
import { color, repeatText } from "../palette";
import MeetingModal, { meetingsChanged } from "./MeetingModal";

function CardPicker({ onPick, onCancel }) {
  const [boards, setBoards] = useState([]);
  const [boardId, setBoardId] = useState("");
  const [columns, setColumns] = useState([]);
  const [columnId, setColumnId] = useState("");
  const [due, setDue] = useState("");
  useEffect(() => {
    api(`/boards?today=${today()}`).then((d) => {
      const active = d.boards.filter((b) => !b.archived);
      setBoards(active);
      if (active[0]) setBoardId(active[0].id);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!boardId) return;
    api(`/boards/${boardId}`).then((d) => {
      setColumns(d.columns);
      setColumnId(d.columns.find((c) => !c.is_done)?.id || d.columns[0]?.id || "");
    }).catch(() => {});
  }, [boardId]);
  return (
    <div className="mt-2 space-y-2 rounded-lg bg-stone-50 p-2 text-sm">
      <div className="grid gap-2 sm:grid-cols-3">
        <select className="input py-1 text-sm" value={boardId} onChange={(e) => setBoardId(e.target.value)} aria-label="บอร์ด">
          {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className="input py-1 text-sm" value={columnId} onChange={(e) => setColumnId(e.target.value)} aria-label="คอลัมน์">
          {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" className="input py-1 text-sm" value={due} onChange={(e) => setDue(e.target.value)} aria-label="กำหนดส่ง (ไม่บังคับ)" />
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary py-1 text-sm" disabled={!columnId} onClick={() => onPick(columnId, due || null)}>สร้างการ์ด</button>
        <button type="button" className="btn btn-ghost py-1 text-sm" onClick={onCancel}>ยกเลิก</button>
      </div>
    </div>
  );
}

// One occurrence of a meeting: details, cancel/move this time, notes, action items.
export default function OccurrenceModal({ meetingId, date, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [moving, setMoving] = useState(null); // { new_date, new_start, new_end }
  const [editing, setEditing] = useState(false);
  const [newAction, setNewAction] = useState("");
  const [picking, setPicking] = useState(null); // action id
  const timer = useRef(null);

  const load = async () => {
    try {
      const d = await api(`/meetings/${meetingId}/occurrences/${date}`);
      setData(d);
      setNotes(d.notes);
    } catch (err) {
      setError(err.status === 404 || err.status === 400 ? "ไม่พบการประชุมครั้งนี้" : err.message);
    }
  };
  useEffect(() => { load(); }, [meetingId, date]); // eslint-disable-line react-hooks/exhaustive-deps

  const flush = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    api(`/meetings/${meetingId}/occurrences/${date}/notes`, { method: "PUT", body: { notes } }).then(() => { setStatus("บันทึกแล้ว"); meetingsChanged(); }).catch((e) => setError(e.message));
  };
  const close = () => { flush(); onClose(); };
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !editing && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  function onNotes(v) {
    setNotes(v);
    setStatus("กำลังพิมพ์…");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      api(`/meetings/${meetingId}/occurrences/${date}/notes`, { method: "PUT", body: { notes: v } })
        .then(() => { setStatus("บันทึกแล้ว"); meetingsChanged(); })
        .catch((e) => { setStatus(""); setError(e.message); });
    }, 500);
  }

  async function act(fn) {
    setError("");
    try {
      await fn();
      meetingsChanged();
      await load();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }

  const occ = data?.occurrence;
  const m = data?.meeting;
  const cancelled = occ?.cancelled;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:py-10" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="w-full max-w-xl rounded-2xl bg-surface shadow-xl" role="dialog" aria-modal="true" aria-label="การประชุม">
        {!data ? (
          <div className="p-6">
            <p className="text-center text-stone-500">{error || "กำลังโหลด…"}</p>
            {error && <div className="mt-3 text-center"><button className="btn btn-ghost" onClick={onClose}>ปิด</button></div>}
          </div>
        ) : (
          <div className="space-y-5 p-5">
            <div className="flex items-start gap-3">
              <span className={`mt-1.5 h-8 w-1.5 shrink-0 rounded ${color(m.color).bar}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h2 className={`font-serif text-xl font-semibold break-words ${cancelled ? "text-stone-400 line-through" : ""}`}>{m.title}</h2>
                <p className="text-sm text-stone-600">
                  {occ ? (
                    <>
                      {formatDate(occ.date, { weekday: "long", day: "numeric", month: "long" })} · {occ.start}–{occ.end}
                      {occ.moved && <span className="ml-1 text-amber-700">(เลื่อนจาก {formatDate(date, { day: "numeric", month: "short" })} {m.start_time})</span>}
                      {cancelled && <span className="ml-1 font-medium text-red-700">ยกเลิกครั้งนี้แล้ว</span>}
                    </>
                  ) : (
                    formatDate(date, { weekday: "long", day: "numeric", month: "long" })
                  )}
                </p>
                <p className="flex items-center gap-1 text-xs text-stone-500">
                  <ArrowPathIcon className="size-3.5" aria-hidden="true" /> {repeatText(m)}
                </p>
              </div>
              <button className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100" onClick={close} aria-label="ปิด">
                <XMarkIcon className="size-5" />
              </button>
            </div>

            {occ?.conflicts?.length > 0 && !cancelled && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900" role="alert">
                <ExclamationTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>เวลาชนกับ: {occ.conflicts.map((c) => `${c.title} (${c.start}–${c.end})`).join(", ")}</span>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {m.url && !cancelled && (
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                  <VideoCameraIcon className="size-4" aria-hidden="true" /> เข้าประชุม
                </a>
              )}
              {m.location && (
                <span className="inline-flex items-center gap-1 text-sm text-stone-600">
                  <MapPinIcon className="size-4" aria-hidden="true" /> {m.location}
                </span>
              )}
            </div>

            {m.agenda && (
              <section>
                <h3 className="mb-1 text-sm font-semibold text-stone-700">วาระ</h3>
                <p className="text-sm whitespace-pre-wrap text-stone-600">{m.agenda}</p>
              </section>
            )}

            {/* this occurrence only */}
            <section className="space-y-2">
              <div className="flex flex-wrap gap-2 text-sm">
                {!cancelled && (
                  <button className="btn btn-ghost px-2.5 py-1.5 ring-1 ring-stone-300" onClick={() => setMoving({ new_date: occ?.date || date, new_start: occ?.start || m.start_time, new_end: occ?.end || m.end_time })}>
                    <CalendarDaysIcon className="size-4" aria-hidden="true" /> เลื่อนครั้งนี้
                  </button>
                )}
                {!cancelled && (
                  <button className="btn px-2.5 py-1.5 text-red-600 hover:bg-red-50" onClick={() => confirm("ยกเลิกการประชุมครั้งนี้ (ครั้งอื่นไม่เปลี่ยน)?") && act(() => api(`/meetings/${m.id}/occurrences/${date}`, { method: "PUT", body: { cancelled: true } }))}>
                    <XCircleIcon className="size-4" aria-hidden="true" /> ยกเลิกครั้งนี้
                  </button>
                )}
                {(cancelled || occ?.moved) && (
                  <button className="btn btn-ghost px-2.5 py-1.5 ring-1 ring-stone-300" onClick={() => act(() => api(`/meetings/${m.id}/occurrences/${date}`, { method: "DELETE" }))}>
                    <ArrowUturnLeftIcon className="size-4" aria-hidden="true" /> คืนค่าเดิม
                  </button>
                )}
                <button className="btn btn-ghost px-2.5 py-1.5 ring-1 ring-stone-300" onClick={() => setEditing(true)}>
                  <PencilSquareIcon className="size-4" aria-hidden="true" /> แก้ทุกครั้ง
                </button>
              </div>
              {moving && (
                <form
                  className="flex flex-wrap items-end gap-2 rounded-lg bg-stone-50 p-2"
                  onSubmit={(e) => { e.preventDefault(); act(() => api(`/meetings/${m.id}/occurrences/${date}`, { method: "PUT", body: moving })).then((ok) => ok && setMoving(null)); }}
                >
                  <input type="date" className="input w-auto py-1 text-sm" value={moving.new_date} onChange={(e) => setMoving({ ...moving, new_date: e.target.value })} required aria-label="วันใหม่" />
                  <input type="time" className="input w-28 py-1 text-sm" value={moving.new_start} onChange={(e) => setMoving({ ...moving, new_start: e.target.value })} required aria-label="เริ่ม" />
                  <input type="time" className="input w-28 py-1 text-sm" value={moving.new_end} onChange={(e) => setMoving({ ...moving, new_end: e.target.value })} required aria-label="จบ" />
                  <button className="btn btn-primary py-1 text-sm">เลื่อน</button>
                  <button type="button" className="btn btn-ghost py-1 text-sm" onClick={() => setMoving(null)}>ยกเลิก</button>
                </form>
              )}
            </section>

            <section>
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-stone-700">บันทึกการประชุม</h3>
                <span className="text-xs text-stone-400" role="status">{status}</span>
              </div>
              <textarea className="input min-h-32 text-sm leading-relaxed" placeholder="สรุปสิ่งที่คุยกัน การตัดสินใจ…" value={notes} onChange={(e) => onNotes(e.target.value)} onBlur={flush} maxLength={50000} />
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-stone-700">Action items</h3>
              <ul className="space-y-1">
                {data.actions.map((a) => (
                  <li key={a.id}>
                    <div className="group flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-stone-50">
                      <input
                        type="checkbox"
                        className="size-4 accent-emerald-600"
                        checked={a.card_id ? Boolean(a.card_done) : a.done}
                        disabled={Boolean(a.card_id)}
                        title={a.card_id ? "สถานะตามการ์ด" : undefined}
                        onChange={(e) => act(() => api(`/meetings/actions/${a.id}`, { method: "PATCH", body: { done: e.target.checked } }))}
                        aria-label={a.text}
                      />
                      <span className={`min-w-0 flex-1 text-sm ${(a.card_id ? a.card_done : a.done) ? "text-stone-400 line-through" : ""}`}>{a.text}</span>
                      {a.card_id ? (
                        <Link to={`/boards/${a.card_board_id}?card=${a.card_id}`} onClick={close} className="inline-flex shrink-0 items-center gap-1 text-xs text-stone-500 hover:text-accent">
                          {a.card_done ? <CheckCircleIcon className="size-3.5 text-emerald-600" aria-hidden="true" /> : <ClipboardDocumentCheckIcon className="size-3.5" aria-hidden="true" />}
                          ดูการ์ด
                        </Link>
                      ) : (
                        <button className="shrink-0 text-xs text-stone-500 hover:text-accent" onClick={() => setPicking(picking === a.id ? null : a.id)}>
                          สร้างการ์ด
                        </button>
                      )}
                      <button className="shrink-0 p-1 text-stone-300 opacity-0 group-hover:opacity-100 hover:text-red-600 focus:opacity-100 max-sm:opacity-100" onClick={() => act(() => api(`/meetings/actions/${a.id}`, { method: "DELETE" }))} aria-label={`ลบ ${a.text}`}>
                        <XMarkIcon className="size-4" />
                      </button>
                    </div>
                    {picking === a.id && (
                      <CardPicker
                        onCancel={() => setPicking(null)}
                        onPick={(columnId, due) => act(() => api(`/meetings/actions/${a.id}/card`, { method: "POST", body: { columnId, due_date: due } })).then((ok) => ok && setPicking(null))}
                      />
                    )}
                  </li>
                ))}
              </ul>
              <form
                className="mt-2 flex gap-2"
                onSubmit={(e) => { e.preventDefault(); if (newAction.trim()) act(() => api(`/meetings/${m.id}/occurrences/${date}/actions`, { method: "POST", body: { text: newAction } })).then((ok) => ok && setNewAction("")); }}
              >
                <input className="input py-1.5 text-sm" placeholder="เพิ่ม action item แล้วกด Enter" value={newAction} maxLength={300} onChange={(e) => setNewAction(e.target.value)} />
                <button className="btn btn-ghost px-3 py-1.5 ring-1 ring-stone-300" aria-label="เพิ่ม action item"><PlusIcon className="size-4" /></button>
              </form>
            </section>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}
      </div>
      {editing && m && (
        <MeetingModal
          meeting={m}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); }}
          onDeleted={() => { setEditing(false); onClose(); }}
          onError={(e) => setError(e.message)}
        />
      )}
    </div>
  );
}
