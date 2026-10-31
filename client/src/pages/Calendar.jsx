import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import { api, formatDate, moodOf, today } from "../api";
import { addMonths, isMonth, monthGrid } from "../dates";
import { useAuth } from "../auth";
import { MoodDot } from "../components/Mood";

const WEEKDAYS = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];

export default function Calendar() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const todayStr = today();
  const month = isMonth(params.get("month")) ? params.get("month") : todayStr.slice(0, 7);

  const [days, setDays] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api(`/entries/calendar?month=${month}`)
      .then((d) => {
        if (!cancelled) setDays(Object.fromEntries(d.days.map((x) => [x.date, x])));
      })
      .catch((err) => (err.status === 401 ? setUser(null) : setError(err.message)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const weeks = useMemo(() => monthGrid(month), [month]);
  const goMonth = (m) => setParams(m === todayStr.slice(0, 7) ? {} : { month: m });

  const written = Object.keys(days).length;
  const totalEntries = Object.values(days).reduce((s, d) => s + d.count, 0);

  function open(date) {
    const d = days[date];
    if (!d) navigate(`/entries/new?date=${date}`);
    else if (d.count === 1) navigate(`/entries/${d.first_id}`);
    else navigate(`/?from=${date}&to=${date}`);
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <button className="btn btn-ghost px-2" onClick={() => goMonth(addMonths(month, -1))} aria-label="เดือนก่อน">
          <ChevronLeftIcon className="size-5" />
        </button>
        <div className="text-center">
          <h1 className="font-serif text-xl font-semibold">
            {formatDate(`${month}-01`, { month: "long", year: "numeric" })}
          </h1>
          <p className="text-xs text-stone-500">
            {loading ? "กำลังโหลด…" : `เขียน ${written} วัน · ${totalEntries} บันทึก`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {month !== todayStr.slice(0, 7) && (
            <button className="btn btn-ghost px-2 text-sm" onClick={() => goMonth(todayStr.slice(0, 7))}>
              วันนี้
            </button>
          )}
          <button className="btn btn-ghost px-2" onClick={() => goMonth(addMonths(month, 1))} aria-label="เดือนถัดไป">
            <ChevronRightIcon className="size-5" />
          </button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <table className="w-full table-fixed border-separate border-spacing-1">
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th key={d} className="pb-1 text-xs font-medium text-stone-500">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, i) => (
            <tr key={i}>
              {week.map((date, j) => {
                if (!date) return <td key={j} />;
                const d = days[date];
                const isToday = date === todayStr;
                const mood = d && moodOf(d.mood);
                const label = [
                  formatDate(date, { weekday: "long", day: "numeric", month: "long" }),
                  d ? `${d.count} บันทึก` : "ยังไม่มีบันทึก",
                  mood && `อารมณ์เฉลี่ย ${mood.label}`,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <td key={j} className="p-0">
                    <button
                      onClick={() => open(date)}
                      title={label}
                      aria-label={label}
                      className={`flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg text-sm transition ${
                        d ? "bg-stone-100 hover:bg-stone-200" : "hover:bg-stone-100"
                      } ${isToday ? "ring-2 ring-accent" : ""}`}
                    >
                      <span className={isToday ? "font-semibold text-accent" : d ? "text-ink" : "text-stone-400"}>
                        {Number(date.slice(8))}
                      </span>
                      <span className="flex h-2.5 items-center gap-0.5">
                        {d &&
                          (d.mood ? (
                            <MoodDot value={d.mood} size="size-2" />
                          ) : (
                            <span className="size-2 rounded-full bg-stone-300" aria-hidden="true" />
                          ))}
                        {d && d.count > 1 && <span className="text-[10px] leading-none text-stone-500">{d.count}</span>}
                      </span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <MoodLegend />
    </div>
  );
}

function MoodLegend() {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-stone-500">
      {[1, 2, 3, 4, 5].map((v) => (
        <span key={v} className="inline-flex items-center gap-1.5">
          <MoodDot value={v} size="size-2" />
          {moodOf(v).label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-stone-300" />
        ไม่ได้ใส่อารมณ์
      </span>
    </div>
  );
}
