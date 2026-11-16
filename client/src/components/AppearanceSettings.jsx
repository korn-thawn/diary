import { useEffect, useRef, useState } from "react";
import { ArrowPathIcon, CheckIcon } from "@heroicons/react/20/solid";
import { api } from "../api";
import { useAuth } from "../auth";
import { ACCENTS, DEFAULT_ACCENT, SIZES, accentOf, applyAppearance } from "../appearance";
import { isHex } from "../colors";

/** Accent color (neon) + text size. Changes apply at once and save to the account. */
export default function AppearanceSettings({ onAuthError }) {
  const { user, setUser } = useAuth();
  const [a, setA] = useState(() => user.appearance || {});
  const [status, setStatus] = useState(null); // null | saving | saved | error text
  const timer = useRef(null);
  const latest = useRef(a);
  useEffect(() => () => clearTimeout(timer.current), []);

  function change(next) {
    setA(next);
    latest.current = next;
    applyAppearance(next); // live preview across the whole app
    setStatus("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const d = await api("/auth/appearance", { method: "PUT", body: latest.current });
        if (latest.current === next) {
          setStatus("saved");
          setUser((u) => (u ? { ...u, appearance: d.appearance } : u));
        }
      } catch (err) {
        if (err.status === 401) return onAuthError?.();
        setStatus("บันทึกไม่สำเร็จ ลองเปลี่ยนอีกครั้ง");
      }
    }, 500);
  }

  const current = accentOf(a);
  const custom = isHex(a.accent) ? a.accent : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm text-muted">สีหลัก (ปุ่ม เวลาตัวใหญ่ และไฮไลต์)</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="สีหลัก">
          {ACCENTS.map((c) => {
            const active = current.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => change({ ...a, accent: c.id })}
                className={`inline-flex min-h-11 items-center gap-2.5 rounded-[2px] border px-3.5 text-sm ${active ? "border-ink text-ink" : "border-line-strong text-muted hover:border-dim"}`}
              >
                <span aria-hidden="true" className="size-4" style={{ background: c.fill }} />
                {c.label}
                {active && <CheckIcon className="size-4" aria-hidden="true" />}
              </button>
            );
          })}
          <label
            className={`inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[2px] border px-3.5 text-sm ${custom ? "border-ink text-ink" : "border-line-strong text-muted hover:border-dim"}`}
          >
            <input
              type="color"
              value={custom || "#c8261c"}
              onChange={(e) => change({ ...a, accent: e.target.value.toLowerCase() })}
              className="size-5 cursor-pointer border-0 bg-transparent p-0"
              aria-label="เลือกสีเอง"
            />
            สีเอง
            {custom && <CheckIcon className="size-4" aria-hidden="true" />}
          </label>
        </div>
        {/* preview: the three colors the accent turns into */}
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-[2px] border border-line p-4" aria-hidden="true">
          <span className="font-mono text-4xl font-medium" style={{ color: current.fill }}>03:27</span>
          <span className="btn btn-primary pointer-events-none" style={{ background: current.fill, borderColor: current.fill, color: current.on }}>เขียนบันทึก</span>
          <span className="meta" style={{ color: current.text }}>ลิงก์และตัวอักษรเน้น</span>
        </div>
        {custom && <p className="mt-2 text-xs text-dim">สีตัวอักษรบนปุ่มและสีลิงก์ถูกปรับให้อ่านง่ายบนพื้นมืดอัตโนมัติ</p>}
      </div>

      <div>
        <p className="mb-2 text-sm text-muted">ขนาดตัวอักษร</p>
        <div className="flex gap-1.5" role="radiogroup" aria-label="ขนาดตัวอักษร">
          {SIZES.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={(a.size || "m") === s.id} className="chip min-h-10 min-w-16" onClick={() => change({ ...a, size: s.id })}>
              <span style={{ fontSize: `${s.px * 0.875}px` }}>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-outline" onClick={() => change({})} disabled={!a.size && (!a.accent || a.accent === DEFAULT_ACCENT)}>
          <ArrowPathIcon className="size-4" aria-hidden="true" /> กลับค่าเริ่มต้น
        </button>
        <span className="text-sm text-dim" role="status" aria-live="polite">
          {status === "saving" ? "กำลังบันทึก…" : status === "saved" ? "บันทึกแล้ว ใช้กับทุกเครื่องที่ล็อกอินบัญชีนี้" : status}
        </span>
      </div>
    </div>
  );
}
