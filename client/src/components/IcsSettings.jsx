import { useEffect, useState } from "react";
import { ArrowPathIcon, CheckIcon, ClipboardDocumentIcon, LinkIcon, XCircleIcon } from "@heroicons/react/20/solid";
import { api } from "../api";

function Toggle({ checked, onChange, children }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" className="size-4 accent-stone-800" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

// Settings card: secret ICS URL for Google Calendar "From URL" subscriptions.
export default function IcsSettings({ onAuthError }) {
  const [state, setState] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const call = async (method, body) => {
    setError("");
    try {
      setState(await api("/auth/ics", { method, body }));
    } catch (err) {
      if (err.status === 401) return onAuthError();
      setError(err.message);
    }
  };
  useEffect(() => { call("GET"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function copy() {
    try {
      await navigator.clipboard.writeText(state.url);
    } catch {
      // http (non-secure context) blocks the clipboard API: fall back to selecting the text
      document.getElementById("ics-url")?.select();
      document.execCommand?.("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!state) return <p className="text-sm text-stone-500">กำลังโหลด…</p>;

  if (!state.enabled) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-stone-600">
          สร้างลิงก์ลับสำหรับให้ Google Calendar (หรือแอปปฏิทินอื่น) ดึง<strong>วันสำคัญ</strong>และ<strong>งานที่มีกำหนดส่ง</strong>ไปแสดง เนื้อหาไดอารี่จะไม่ถูกส่งออกไป
        </p>
        <button className="btn btn-primary" onClick={() => call("POST")}>
          <LinkIcon className="size-4" aria-hidden="true" /> สร้างลิงก์ปฏิทิน
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input id="ics-url" className="input font-mono text-xs" value={state.url} readOnly onFocus={(e) => e.target.select()} aria-label="ลิงก์ปฏิทิน" />
        <button className="btn btn-ghost shrink-0 px-3 ring-1 ring-stone-300" onClick={copy} aria-label="คัดลอกลิงก์">
          {copied ? <CheckIcon className="size-4 text-emerald-700" /> : <ClipboardDocumentIcon className="size-4" />}
          <span className="text-sm">{copied ? "คัดลอกแล้ว" : "คัดลอก"}</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-4">
        <Toggle checked={state.events} onChange={(v) => call("PATCH", { events: v })}>ส่งวันสำคัญ</Toggle>
        <Toggle checked={state.cards} onChange={(v) => call("PATCH", { cards: v })}>ส่งงานที่ยังไม่เสร็จ (มีกำหนดส่ง)</Toggle>
      </div>

      <ol className="list-decimal space-y-1 pl-5 text-sm text-stone-600">
        <li>เปิด Google Calendar <strong>บนคอมพิวเตอร์</strong> (แอปมือถือเพิ่มจาก URL ไม่ได้)</li>
        <li>ที่แถบซ้าย ตรง "ปฏิทินอื่นๆ" กด <strong>+</strong> แล้วเลือก <strong>"จาก URL"</strong></li>
        <li>วางลิงก์ข้างบน แล้วกด "เพิ่มปฏิทิน" จากนั้นจะเห็นในมือถือด้วย</li>
      </ol>
      <ul className="space-y-1 text-xs text-stone-500">
        <li>Google จะดึงข้อมูลใหม่เองทุกไม่กี่ชั่วโมง (สั่งให้ดึงทันทีไม่ได้) เป็นการแสดงผลทางเดียว แก้ใน Google แล้วจะไม่กลับมาที่นี่</li>
        <li>ใครมีลิงก์นี้ก็เห็นรายการได้ ถ้าลิงก์หลุด ให้กด "สร้างลิงก์ใหม่" แล้วลิงก์เดิมจะใช้ไม่ได้ทันที</li>
        {state.url.startsWith("http:") && <li>ตอนนี้เว็บยังไม่มี HTTPS ลิงก์จึงวิ่งผ่าน http ธรรมดา</li>}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button className="btn btn-ghost px-2.5 py-1.5 text-sm ring-1 ring-stone-300" onClick={() => confirm("สร้างลิงก์ใหม่? ลิงก์เดิมจะใช้ไม่ได้ ต้องไปเพิ่มใน Google Calendar ใหม่") && call("POST")}>
          <ArrowPathIcon className="size-4" aria-hidden="true" /> สร้างลิงก์ใหม่
        </button>
        <button className="btn px-2.5 py-1.5 text-sm text-red-600 hover:bg-red-50" onClick={() => confirm("ปิดลิงก์ปฏิทิน? ปฏิทินใน Google จะหยุดอัปเดต") && call("DELETE")}>
          <XCircleIcon className="size-4" aria-hidden="true" /> ปิดลิงก์
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
