import { useEffect, useState } from "react";
import { ArrowTopRightOnSquareIcon, LinkSlashIcon, PaperAirplaneIcon } from "@heroicons/react/20/solid";
import { api } from "../api";

const EVENT_DAY_OPTIONS = [1, 3, 7, 14, 30];
const CARD_MINUTE_OPTIONS = [
  { value: 0, label: "ไม่เตือน" },
  { value: 15, label: "15 นาที" },
  { value: 30, label: "30 นาที" },
  { value: 60, label: "1 ชั่วโมง" },
  { value: 180, label: "3 ชั่วโมง" },
];

function Row({ title, hint, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {hint && <p className="text-xs text-stone-500">{hint}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-emerald-600" : "bg-stone-300"}`}
    >
      <span className={`absolute top-0.5 size-5 rounded-full bg-surface shadow transition ${checked ? "left-5.5" : "left-0.5"}`} />
    </button>
  );
}

// Settings card: link a Telegram chat and choose which reminders to get.
export default function TelegramSettings({ onAuthError }) {
  const [st, setSt] = useState(null);
  const [linkUrl, setLinkUrl] = useState(null);
  const [msg, setMsg] = useState(null);

  const run = async (fn) => {
    setMsg(null);
    try {
      return await fn();
    } catch (err) {
      if (err.status === 401) onAuthError();
      else setMsg({ ok: false, text: err.message });
    }
  };
  const load = () => run(async () => setSt(await api("/telegram")));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // While waiting for the user to press Start in Telegram, poll until linked
  useEffect(() => {
    if (!linkUrl || st?.linked) return;
    const t = setInterval(async () => {
      const s = await api("/telegram").catch(() => null);
      if (s?.linked) { setSt(s); setLinkUrl(null); setMsg({ ok: true, text: "เชื่อม Telegram แล้ว" }); }
    }, 3000);
    return () => clearInterval(t);
  }, [linkUrl, st?.linked]);

  const save = (patch) => run(async () => setSt(await api("/telegram/settings", { method: "PATCH", body: patch })));

  if (!st) return <p className="text-sm text-stone-500">กำลังโหลด…</p>;
  if (!st.available) {
    return (
      <p className="text-sm text-stone-600">
        Server ยังไม่ได้ตั้งค่า bot ของ Telegram (ต้องใส่ <code className="rounded bg-stone-100 px-1">TELEGRAM_BOT_TOKEN</code> ในไฟล์ .env ของ server)
      </p>
    );
  }

  const s = st.settings;
  return (
    <div className="space-y-3">
      {!st.linked ? (
        <div className="space-y-3">
          <p className="text-sm text-stone-600">
            เชื่อมกับ Telegram เพื่อรับสรุปงานตอนเช้า, เตือนวันสำคัญ, เตือนก่อนเวลางาน และเตือนให้เขียนไดอารี่ ผ่าน bot <b>@{st.bot}</b>
          </p>
          {!linkUrl ? (
            <button className="btn btn-primary" onClick={() => run(async () => setLinkUrl((await api("/telegram/link", { method: "POST" })).url))}>
              <PaperAirplaneIcon className="size-4" aria-hidden="true" /> เชื่อม Telegram
            </button>
          ) : (
            <div className="space-y-2 rounded-xl bg-stone-50 p-3 text-sm">
              <a href={linkUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
                <ArrowTopRightOnSquareIcon className="size-4" aria-hidden="true" /> เปิด Telegram แล้วกด Start
              </a>
              <p className="text-xs text-stone-500">ลิงก์ใช้ได้ 15 นาที หน้านี้จะอัปเดตเองเมื่อเชื่อมเสร็จ</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">เชื่อมกับ <b>@{st.bot}</b> แล้ว</p>
          <div className="flex gap-2">
            <button className="btn btn-ghost px-2.5 py-1.5 text-sm ring-1 ring-stone-300" onClick={() => run(async () => { await api("/telegram/test", { method: "POST" }); setMsg({ ok: true, text: "ส่งข้อความทดสอบแล้ว ลองเช็กใน Telegram" }); })}>
              <PaperAirplaneIcon className="size-4" aria-hidden="true" /> ส่งข้อความทดสอบ
            </button>
            <button className="btn px-2.5 py-1.5 text-sm text-red-600 hover:bg-red-50" onClick={() => confirm("เลิกเชื่อม Telegram?") && run(async () => setSt(await api("/telegram/link", { method: "DELETE" })))}>
              <LinkSlashIcon className="size-4" aria-hidden="true" /> เลิกเชื่อม
            </button>
          </div>
        </div>
      )}

      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}

      <div className={st.linked ? "" : "pointer-events-none opacity-50"} aria-disabled={!st.linked}>
        <Row title="สรุปประจำวัน" hint="ประชุม งานวันนี้ งานที่เลยกำหนด และวันสำคัญวันนี้">
          <input type="time" className="input w-28 py-1 text-sm" value={s.daily_time} onChange={(e) => e.target.value && save({ daily_time: e.target.value })} aria-label="เวลาส่งสรุป" />
          <Switch checked={s.daily} onChange={(v) => save({ daily: v })} label="สรุปประจำวัน" />
        </Row>
        <Row title="เตือนวันสำคัญล่วงหน้า" hint="ส่งพร้อมสรุปตอนเช้า">
          <div className="flex flex-wrap gap-1">
            {EVENT_DAY_OPTIONS.map((d) => {
              const on = s.event_days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => save({ event_days: on ? s.event_days.filter((x) => x !== d) : [...s.event_days, d] })}
                  className={`rounded-lg px-2 py-1 text-xs transition ${on ? "bg-ink text-paper" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
                >
                  {d === 1 ? "1 วัน" : `${d} วัน`}
                </button>
              );
            })}
          </div>
        </Row>
        <Row title="เตือนก่อนเวลางาน" hint="เฉพาะการ์ดที่ตั้งเวลาไว้">
          <select className="input w-auto py-1 text-sm" value={s.card_minutes} onChange={(e) => save({ card_minutes: Number(e.target.value) })} aria-label="เตือนก่อนเวลางาน">
            {CARD_MINUTE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Row>
        <Row title="เตือนก่อนประชุม" hint="ค่าเริ่มต้น ตั้งแยกรายการประชุมได้">
          <select className="input w-auto py-1 text-sm" value={s.meeting_minutes} onChange={(e) => save({ meeting_minutes: Number(e.target.value) })} aria-label="เตือนก่อนประชุม">
            {[0, 5, 10, 15, 30, 60].map((v) => <option key={v} value={v}>{v === 0 ? "ไม่เตือน" : v === 60 ? "1 ชั่วโมง" : `${v} นาที`}</option>)}
          </select>
        </Row>
        <Row title="เตือนให้เขียนไดอารี่" hint="ถ้าถึงเวลานี้แล้ววันนั้นยังไม่ได้เขียน">
          <input type="time" className="input w-28 py-1 text-sm" value={s.diary_time} onChange={(e) => e.target.value && save({ diary_time: e.target.value })} aria-label="เวลาเตือนเขียนไดอารี่" />
          <Switch checked={s.diary} onChange={(v) => save({ diary: v })} label="เตือนให้เขียนไดอารี่" />
        </Row>
      </div>
      <p className="text-xs text-stone-500">ใน Telegram พิมพ์ /today เพื่อดูสรุปวันนี้ได้ทุกเมื่อ เวลาทั้งหมดเป็นเวลาประเทศไทย</p>
    </div>
  );
}
