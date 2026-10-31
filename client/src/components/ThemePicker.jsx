import { useState } from "react";
import { ComputerDesktopIcon, MoonIcon, SunIcon } from "@heroicons/react/20/solid";

const OPTIONS = [
  { value: "system", label: "ตามเครื่อง", Icon: ComputerDesktopIcon },
  { value: "light", label: "สว่าง", Icon: SunIcon },
  { value: "dark", label: "มืด", Icon: MoonIcon },
];

// Uses window.diaryTheme from /theme.js (applied before first paint, synced across tabs).
export default function ThemePicker() {
  const [pref, setPref] = useState(() => window.diaryTheme?.get() || "system");
  const choose = (v) => {
    window.diaryTheme?.set(v);
    setPref(v);
  };
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="ธีม">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={pref === value}
          onClick={() => choose(value)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm transition ${
            pref === value ? "border-[1.5px] border-ink bg-title text-on-title" : "border-[1.5px] border-ink/35 bg-surface text-ink hover:border-ink"
          }`}
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
