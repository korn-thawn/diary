import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { FireIcon, TrophyIcon, BookOpenIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";
import { api, formatDate, MOODS, moodOf, today } from "../api";
import { useAuth } from "../auth";
import { MoodDot } from "../components/Mood";

const DAY = 86400000;
const toDays = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DAY;
const fromDays = (n) => new Date(n * DAY).toISOString().slice(0, 10);

export default function Stats() {
  const { setUser } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/stats?today=${today()}`)
      .then(setData)
      .catch((err) => (err.status === 401 ? setUser(null) : setError(err.message)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-center text-stone-500">กำลังโหลด…</p>;

  const { totals, streak } = data;
  if (!totals.entries) {
    return (
      <div className="mt-16 text-center text-stone-500">
        ยังไม่มีบันทึก สถิติจะขึ้นหลังจากเริ่มเขียน{" "}
        <Link to="/entries/new" className="text-accent hover:underline">
          เขียนบันทึกแรก
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile icon={BookOpenIcon} label="บันทึกทั้งหมด" value={totals.entries} />
        <Tile icon={CalendarDaysIcon} label="วันที่เขียน" value={totals.days} sub={`เริ่ม ${formatDate(totals.first_date, { day: "numeric", month: "short", year: "2-digit" })}`} />
        <Tile icon={FireIcon} label="เขียนติดกันตอนนี้" value={streak.current} unit="วัน" accent={streak.current > 0} />
        <Tile icon={TrophyIcon} label="ติดกันนานสุด" value={streak.longest} unit="วัน" />
      </div>

      <Card title="อารมณ์ 90 วันล่าสุด" sub={totals.avg_mood ? `เฉลี่ยทั้งหมด ${moodOf(totals.avg_mood).label} (${totals.avg_mood.toFixed(1)})` : null}>
        <MoodLine points={data.moodDaily} today={data.today} />
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card title="สัดส่วนอารมณ์">
          <MoodDistribution rows={data.moodDist} />
        </Card>
        <Card title="แท็กที่ใช้บ่อย">
          <TopTags tags={data.topTags} />
        </Card>
      </div>

      <Card title="จำนวนบันทึกต่อเดือน" sub="12 เดือนล่าสุด">
        <PerMonth rows={data.perMonth} />
      </Card>
    </div>
  );
}

function Tile({ icon: Icon, label, value, unit, sub, accent }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <div className="flex items-center gap-1.5 text-xs text-stone-500">
        <Icon className={`size-4 ${accent ? "text-accent" : ""}`} aria-hidden="true" />
        {label}
      </div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">
        {value.toLocaleString("th-TH")}
        {unit && <span className="ml-1 text-sm font-normal text-stone-500">{unit}</span>}
      </div>
      {sub && <div className="mt-0.5 text-xs text-stone-400">{sub}</div>}
    </div>
  );
}

function Card({ title, sub, children }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
      <h2 className="font-serif text-lg font-semibold">{title}</h2>
      {sub && <p className="text-xs text-stone-500">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// ---- Mood line: one series, y = mood 1..5, breaks on days without a mood ----
function MoodLine({ points, today: todayStr }) {
  const wrap = useRef(null);
  const [hover, setHover] = useState(null);
  const W = 640, H = 200, L = 64, R = 12, T = 10, B = 26;
  const end = toDays(todayStr);
  const start = end - 89;
  const x = (d) => L + ((d - start) / 89) * (W - L - R);
  const y = (v) => T + ((5 - v) / 4) * (H - T - B);

  if (!points.length) return <p className="text-sm text-stone-500">ยังไม่มีบันทึกที่ใส่อารมณ์ในช่วงนี้</p>;

  const pts = points.map((p) => ({ ...p, d: toDays(p.date) }));
  // Split into segments wherever a day is missing
  const segments = [];
  for (const p of pts) {
    const seg = segments[segments.length - 1];
    if (seg && p.d - seg[seg.length - 1].d === 1) seg.push(p);
    else segments.push([p]);
  }

  function onMove(e) {
    const rect = wrap.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = null;
    for (const p of pts) if (!best || Math.abs(x(p.d) - px) < Math.abs(x(best.d) - px)) best = p;
    setHover(best && Math.abs(x(best.d) - px) < 30 ? best : null);
  }

  const ticks = [0, 30, 60, 89].map((o) => start + o);

  return (
    <div className="relative">
      <svg
        ref={wrap}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label="กราฟเส้นอารมณ์รายวันย้อนหลัง 90 วัน"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {MOODS.map((m) => (
          <g key={m.value}>
            <line x1={L} x2={W - R} y1={y(m.value)} y2={y(m.value)} className="stroke-stone-200" strokeWidth="1" />
            <circle cx={10} cy={y(m.value)} r={4} fill={m.hex} />
            <text x={20} y={y(m.value)} dy="0.35em" className="fill-stone-500 text-[11px]">
              {m.label}
            </text>
          </g>
        ))}
        {ticks.map((d) => (
          <text key={d} x={x(d)} y={H - 6} textAnchor="middle" className="fill-stone-400 text-[11px]">
            {formatDate(fromDays(d), { day: "numeric", month: "short" })}
          </text>
        ))}
        {hover && <line x1={x(hover.d)} x2={x(hover.d)} y1={T} y2={H - B} className="stroke-stone-400" strokeWidth="1" />}
        {segments.map((seg, i) =>
          seg.length > 1 ? (
            <polyline
              key={i}
              points={seg.map((p) => `${x(p.d)},${y(p.mood)}`).join(" ")}
              fill="none"
              className="stroke-stone-500"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null
        )}
        {pts.map((p) => (
          <circle
            key={p.date}
            cx={x(p.d)}
            cy={y(p.mood)}
            r={hover?.date === p.date ? 6 : 4}
            fill={moodOf(p.mood).hex}
            className="stroke-white"
            strokeWidth="2"
          />
        ))}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-paper shadow"
          style={{ left: `${(x(hover.d) / W) * 100}%` }}
        >
          {formatDate(hover.date, { weekday: "short", day: "numeric", month: "short" })} ·{" "}
          {moodOf(hover.mood).label} ({hover.mood % 1 ? hover.mood.toFixed(1) : hover.mood})
        </div>
      )}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs text-stone-500">ดูเป็นตาราง</summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead className="text-stone-500">
            <tr>
              <th className="py-1 font-medium">วันที่</th>
              <th className="py-1 font-medium">อารมณ์</th>
            </tr>
          </thead>
          <tbody>
            {[...pts].reverse().map((p) => (
              <tr key={p.date} className="border-t border-stone-100">
                <td className="py-1">{formatDate(p.date, { day: "numeric", month: "short", year: "numeric" })}</td>
                <td className="py-1">
                  {moodOf(p.mood).label} ({p.mood % 1 ? p.mood.toFixed(1) : p.mood})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

// ---- Mood distribution: horizontal bars, each labeled ----
function MoodDistribution({ rows }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (!total) return <p className="text-sm text-stone-500">ยังไม่มีบันทึกที่ใส่อารมณ์</p>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <ul className="space-y-2">
      {[...rows].reverse().map((r) => {
        const m = moodOf(r.mood);
        const pct = Math.round((r.count / total) * 100);
        return (
          <li key={r.mood} className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-2 text-sm" title={`${m.label}: ${r.count} บันทึก (${pct}%)`}>
            <span className="flex items-center gap-1.5 text-stone-600">
              <MoodDot value={r.mood} size="size-2" />
              {m.label}
            </span>
            <span className="h-3 rounded-r bg-stone-100">
              {r.count > 0 && (
                <span className={`block h-full rounded-r ${m.bg}`} style={{ width: `${(r.count / max) * 100}%` }} />
              )}
            </span>
            <span className="text-right text-xs text-stone-500 tabular-nums">
              {r.count} · {pct}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function TopTags({ tags }) {
  if (!tags.length) return <p className="text-sm text-stone-500">ยังไม่ได้ใช้แท็ก</p>;
  const max = tags[0].count;
  return (
    <ul className="space-y-1.5">
      {tags.map((t) => (
        <li key={t.tag}>
          <Link
            to={`/?tag=${encodeURIComponent(t.tag)}`}
            className="grid grid-cols-[minmax(0,7rem)_1fr_2rem] items-center gap-2 rounded text-sm hover:text-accent"
          >
            <span className="truncate">#{t.tag}</span>
            <span className="h-2 rounded-r bg-stone-100">
              <span className="block h-full rounded-r bg-accent/70" style={{ width: `${(t.count / max) * 100}%` }} />
            </span>
            <span className="text-right text-xs text-stone-500 tabular-nums">{t.count}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ---- Entries per month: vertical bars, single series ----
function PerMonth({ rows }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div>
      <div className="flex h-36 items-end gap-0.5" role="img" aria-label="กราฟแท่งจำนวนบันทึกต่อเดือน">
        {rows.map((r) => (
          <div
            key={r.month}
            className="relative flex h-full flex-1 flex-col justify-end px-px"
            onPointerEnter={() => setHover(r.month)}
            onPointerLeave={() => setHover(null)}
          >
            {hover === r.month && (
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-lg bg-ink px-2 py-1 text-xs whitespace-nowrap text-paper shadow">
                {formatDate(`${r.month}-01`, { month: "long", year: "numeric" })}: {r.count} บันทึก
              </div>
            )}
            <div
              className={`rounded-t ${r.count ? "bg-accent" : "bg-stone-100"} ${hover === r.month ? "opacity-80" : ""}`}
              style={{ height: r.count ? `${Math.max(4, (r.count / max) * 100)}%` : "2px" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5">
        {rows.map((r) => (
          <div key={r.month} className="flex-1 text-center text-[10px] text-stone-400">
            {formatDate(`${r.month}-01`, { month: "narrow" })}
          </div>
        ))}
      </div>
    </div>
  );
}
