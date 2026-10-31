import { useEffect, useRef, useState } from "react";
import { ArrowPathIcon, CheckIcon, ExclamationTriangleIcon, LanguageIcon } from "@heroicons/react/20/solid";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  DEFAULT_FONTS, DEFAULT_PRESET, FONTS, PRESETS, SIZES, TOKENS,
  applyAppearance, colorsOf, loadFont, problems,
} from "../appearance";
import { isHex } from "../colors";
import Dialog from "./ui/Dialog";

const SAMPLE = "ไดอารี่ของวันนี้ Aa 123";

// Follows the .dark class that /theme.js toggles on <html>
function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

// A tiny window on a desk, painted with one mode's colors
function Swatch({ c }) {
  return (
    <span className="block rounded-[4px] p-1.5" style={{ background: c.desk }} aria-hidden="true">
      <span className="block overflow-hidden rounded-[3px]" style={{ background: c.paper, border: `1.5px solid ${c.ink}`, boxShadow: `2px 2px 0 ${c.ink}` }}>
        <span className="block h-2" style={{ background: c.title, borderBottom: `1.5px solid ${c.ink}` }} />
        <span className="block space-y-1 p-1.5">
          <span className="block h-1 w-4/5 rounded-full" style={{ background: c.ink }} />
          <span className="block h-1 w-1/2 rounded-full" style={{ background: c.highlight }} />
          <span className="block h-2.5 rounded-[2px]" style={{ background: c.surface, border: `1px solid ${c.ink}` }} />
        </span>
      </span>
    </span>
  );
}

function FontDialog({ role, value, onPick, onClose }) {
  const weight = role === "fontDisplay" ? 600 : 400;
  // previews need every font: load one weight of each only while this list is open
  useEffect(() => { for (const id of Object.keys(FONTS)) loadFont(id, [weight]); }, [weight]);
  return (
    <Dialog title={role === "fontDisplay" ? "ฟอนต์หัวข้อและปุ่ม" : "ฟอนต์เนื้อหา"} icon={LanguageIcon} onClose={onClose}>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="ฟอนต์">
        {Object.entries(FONTS).map(([id, f]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value === id}
            onClick={() => { onPick(id); onClose(); }}
            className={`flex items-center justify-between gap-2 rounded-[6px] border-[1.5px] px-3 py-2 text-left ${
              value === id ? "border-ink bg-title text-on-title" : "border-ink/35 bg-surface hover:border-ink"
            }`}
          >
            <span className="min-w-0">
              <span className="block truncate text-lg leading-snug" style={{ fontFamily: `"${f.family}"`, fontWeight: weight }}>{SAMPLE}</span>
              <span className="block text-xs opacity-75">{f.label}</span>
            </span>
            {value === id && <CheckIcon className="size-5 shrink-0" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </Dialog>
  );
}

export default function AppearanceSettings({ onAuthError }) {
  const { user, setUser } = useAuth();
  const [a, setA] = useState(() => user.appearance || {});
  const [status, setStatus] = useState(null); // null | saving | saved | error text
  const isDark = useIsDark();
  const [mode, setMode] = useState(isDark ? "dark" : "light");
  const [fontRole, setFontRole] = useState(null);
  const timer = useRef(null);
  const latest = useRef(a);

  useEffect(() => setMode(isDark ? "dark" : "light"), [isDark]);
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

  const preset = a.preset || DEFAULT_PRESET;
  const colors = colorsOf(a);
  const current = colors[mode];
  const issues = problems(current);

  const setColor = (key, value) => {
    if (!isHex(value)) return;
    const next = { ...colors, [mode]: { ...current, [key]: value.toLowerCase() } };
    change({ ...a, preset: "custom", light: next.light, dark: next.dark });
  };
  const applyFix = (fix) => {
    const next = { ...colors, [mode]: fix() };
    change({ ...a, preset: "custom", light: next.light, dark: next.dark });
  };
  const pickPreset = (id) => {
    const { light: _l, dark: _d, ...rest } = a;
    change({ ...rest, preset: id });
  };

  return (
    <div className="mt-5 space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm text-stone-600">ชุดสี</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="ชุดสี">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={preset === p.id}
              onClick={() => pickPreset(p.id)}
              className={`rounded-[6px] border-[1.5px] p-1 text-center text-xs ${
                preset === p.id ? "border-ink bg-title text-on-title" : "border-ink/30 bg-surface hover:border-ink"
              }`}
            >
              <Swatch c={p[mode]} />
              <span className="mt-1 block truncate font-display font-medium">{p.label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <details className="group rounded-[6px] border-[1.5px] border-ink/30 bg-surface" open={preset === "custom" || undefined}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 font-display text-sm font-semibold">
          <span>ปรับสีเอง {preset === "custom" && <span className="ml-1 rounded-[3px] bg-highlight px-1.5 py-0.5 text-xs text-on-highlight">กำลังใช้</span>}</span>
          <span className="text-xs font-normal text-stone-500 group-open:hidden">แตะเพื่อเปิด</span>
        </summary>
        <div className="space-y-3 border-t-[1.5px] border-ink/20 p-3">
          <div className="flex gap-1" role="radiogroup" aria-label="แก้สีของโหมด">
            {[["light", "กลางวัน"], ["dark", "กลางคืน"]].map(([m, label]) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} className="chip" onClick={() => setMode(m)}>{label}</button>
            ))}
          </div>
          <p className="text-xs text-stone-500">
            {mode === (isDark ? "dark" : "light") ? "สีที่เห็นอยู่ตอนนี้" : `ตอนนี้แสดงโหมด${isDark ? "กลางคืน" : "กลางวัน"} สลับธีมด้านบนเพื่อดูผล`}
            {" "}ตัวอักษรบนแถบชื่อ เงา และสีเทาต่างๆ คำนวณให้อัตโนมัติ
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {TOKENS.map(({ key, label }) => (
              <li key={key} className="flex items-center gap-2">
                <input
                  type="color"
                  value={current[key]}
                  onChange={(e) => setColor(key, e.target.value)}
                  className="size-10 shrink-0 cursor-pointer rounded-[6px] border-[1.5px] border-ink bg-surface p-0.5"
                  aria-label={label}
                />
                <span className="min-w-0 flex-1 text-sm">{label}</span>
                <HexInput value={current[key]} onChange={(v) => setColor(key, v)} label={`${label} (รหัสสี)`} />
              </li>
            ))}
          </ul>
          {issues.map((p) => (
            <div key={p.text} className="flex flex-wrap items-center gap-2 rounded-[6px] border-[1.5px] border-ink bg-highlight px-3 py-2 text-sm text-on-highlight" role="status">
              <ExclamationTriangleIcon className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">{p.text}</span>
              <button type="button" className="btn btn-outline min-h-8 px-3 py-1 text-xs" onClick={() => applyFix(p.fix)}>ปรับให้อ่านง่าย</button>
            </div>
          ))}
        </div>
      </details>

      <div className="grid gap-3 sm:grid-cols-2">
        {[["fontDisplay", "ฟอนต์หัวข้อและปุ่ม"], ["fontBody", "ฟอนต์เนื้อหา"]].map(([role, label]) => {
          const id = a[role] || DEFAULT_FONTS[role];
          const f = FONTS[id];
          return (
            <div key={role}>
              <p className="mb-1 text-sm text-stone-600">{label}</p>
              <button
                type="button"
                onClick={() => setFontRole(role)}
                className="flex w-full items-center justify-between gap-2 rounded-[6px] border-[1.5px] border-ink/60 bg-surface px-3 py-2 text-left hover:border-ink"
              >
                <span className="min-w-0">
                  <span className="block truncate text-base" style={{ fontFamily: `"${f.family}"`, fontWeight: role === "fontDisplay" ? 600 : 400 }}>{SAMPLE}</span>
                  <span className="block text-xs text-stone-500">{f.label}</span>
                </span>
                <span className="shrink-0 text-xs text-stone-500">เปลี่ยน</span>
              </button>
            </div>
          );
        })}
      </div>

      <div>
        <p className="mb-1.5 text-sm text-stone-600">ขนาดตัวอักษร</p>
        <div className="flex gap-1" role="radiogroup" aria-label="ขนาดตัวอักษร">
          {SIZES.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={(a.size || "m") === s.id} className="chip min-w-16" onClick={() => change({ ...a, size: s.id })}>
              <span style={{ fontSize: `${s.px * 0.875}px` }}>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-outline" onClick={() => change({})} disabled={!Object.keys(a).length}>
          <ArrowPathIcon className="size-4" aria-hidden="true" /> กลับค่าเริ่มต้น
        </button>
        <span className="text-sm text-stone-500" role="status" aria-live="polite">
          {status === "saving" ? "กำลังบันทึก…" : status === "saved" ? "บันทึกแล้ว ใช้กับทุกเครื่องที่ล็อกอินบัญชีนี้" : status}
        </span>
      </div>

      {fontRole && (
        <FontDialog
          role={fontRole}
          value={a[fontRole] || DEFAULT_FONTS[fontRole]}
          onPick={(id) => change({ ...a, [fontRole]: id })}
          onClose={() => setFontRole(null)}
        />
      )}
    </div>
  );
}

// Lets people paste a hex code; only applied once it is a full #rrggbb
function HexInput({ value, onChange, label }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input
      className="input w-24 shrink-0 px-2 py-1 text-sm uppercase"
      value={text}
      maxLength={7}
      spellCheck={false}
      aria-label={label}
      onChange={(e) => {
        let v = e.target.value.trim();
        if (v && !v.startsWith("#")) v = "#" + v;
        setText(v);
        if (isHex(v)) onChange(v);
      }}
      onBlur={() => setText(value)}
    />
  );
}
