import { useEffect, useState } from "react";
import { api } from "../api";

const mb = (b) => (b / 1024 / 1024).toLocaleString("th-TH", { maximumFractionDigits: 1 });

// Settings: how much of the per-user photo quota is used.
export default function PhotoUsage({ onAuthError }) {
  const [u, setU] = useState(null);
  useEffect(() => {
    api("/photos/usage").then(setU).catch((err) => err.status === 401 && onAuthError());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!u) return null;
  const pct = Math.min(100, (u.bytes / u.quota) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-stone-600">รูปที่แนบ {u.count.toLocaleString("th-TH")} รูป</span>
        <span className="text-stone-500 tabular-nums">{mb(u.bytes)} / {mb(u.quota)} MB</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stone-100" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="พื้นที่รูปที่ใช้">
        <div className={`h-full rounded-full ${pct > 90 ? "bg-rose-600" : "bg-stone-500"}`} style={{ width: `${Math.max(pct, u.bytes ? 1 : 0)}%` }} />
      </div>
      {pct > 90 && <p className="text-xs font-medium text-rose-700">พื้นที่รูปใกล้เต็ม</p>}
    </div>
  );
}
