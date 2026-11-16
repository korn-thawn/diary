import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api, today as todayStr } from "../api";
import { useAuth } from "../auth";
import { entryNo, nightDate, timeOf } from "../night";
import { swapWithTransition, takeIntro, useReveal } from "../motion";
import HeroEntry, { BigTime } from "../components/home/HeroEntry";
import EntryCard from "../components/home/EntryCard";
import MoodMonth from "../components/home/MoodMonth";

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(i);
  }, []);
  return now;
}

// Nothing written yet: the same hero layout, waiting for the first night
function EmptyHero({ intro }) {
  const now = useNow();
  return (
    <section className="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 pt-10 pb-16 sm:px-8 sm:pt-16" data-intro={intro ? "" : undefined}>
      <div className="intro-meta meta text-sm tracking-[0.12em] text-calm-text">{entryNo(1)} · {nightDate(todayStr())}</div>
      <BigTime value={timeOf(now.toISOString())} className="intro-time neon-glow" />
      <h1 className="intro-rise m-0 text-[34px] sm:text-[46px]" style={{ "--i": 0 }}>คืนนี้ยังไม่มีบันทึก</h1>
      <p className="intro-rise m-0 max-w-[520px] text-[17px] text-muted" style={{ "--i": 1 }}>เริ่มจากสองสามบรรทัดก็พอ เวลาที่เขียนจะถูกจดไว้ให้เอง แล้วหน้านี้จะค่อยๆ เต็มไปด้วยคืนของคุณ</p>
      <div className="intro-rise mt-2" style={{ "--i": 2 }}>
        <Link to="/entries/new" viewTransition className="btn btn-primary min-h-11 px-5.5">เขียนบันทึกแรก</Link>
      </div>
    </section>
  );
}

// Holds the hero's shape while the first request is in flight, so nothing jumps when it arrives
function HomeSkeleton() {
  return (
    <section className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-10 px-4 pt-8 pb-16 sm:gap-14 sm:px-8 sm:pt-10" role="status" aria-label="กำลังโหลด">
      <div className="flex flex-[1_1_380px] flex-col gap-5">
        <div className="skeleton h-4 w-56" />
        <div className="skeleton h-[72px] w-64 sm:h-[112px] sm:w-96" style={{ animationDelay: "120ms" }} />
        <div className="skeleton h-10 w-4/5" style={{ animationDelay: "240ms" }} />
        <div className="skeleton h-16 w-full max-w-[520px]" style={{ animationDelay: "360ms" }} />
      </div>
      <div className="skeleton h-[276px] flex-[1_1_420px] sm:h-[432px]" style={{ animationDelay: "200ms" }} />
      <span className="sr-only">กำลังโหลด…</span>
    </section>
  );
}

function RecentEntries({ entries, total }) {
  const grid = useReveal();
  return (
    <section id="entries" className="border-t border-line">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 py-16 sm:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="m-0 text-[32px]">บันทึกก่อนหน้า</h2>
          <Link to="/entries" viewTransition className="meta py-3 text-calm-text">
            ดูทั้งหมด {total} บันทึก
          </Link>
        </div>
        <div ref={grid} data-reveal="" className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-7">
          {entries.map((e, i) => <EntryCard key={e.id} entry={e} index={i} />)}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { setUser } = useAuth();
  const today = todayStr();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [intro] = useState(takeIntro);

  useEffect(() => {
    let alive = true;
    api(`/entries/home?month=${today.slice(0, 7)}`)
      .then((d) => alive && setData(d))
      .catch((err) => (err.status === 401 ? setUser(null) : alive && setError("โหลดบันทึกไม่สำเร็จ ลองรีเฟรชหน้านี้")));
    return () => { alive = false; };
  }, [today, setUser]);

  // fetch the other month first, then slide the grid over in one view transition
  async function changeMonth(next) {
    try {
      const d = await api(`/entries/home?month=${next}`);
      document.documentElement.dataset.monthDir = next < month ? "prev" : "next";
      swapWithTransition(() => { setMonth(next); setData(d); }, "month");
    } catch (err) {
      if (err.status === 401) setUser(null);
    }
  }

  if (error) return <p className="mx-auto max-w-[1200px] px-4 py-16 text-hot-text sm:px-8">{error}</p>;

  return (
    <div className="page-enter" style={{ viewTransitionName: "win-body" }}>
      {!data ? <HomeSkeleton /> : data.latest ? <HeroEntry entry={data.latest} intro={intro} /> : <EmptyHero intro={intro} />}
      {data && data.recent.length > 0 && <RecentEntries entries={data.recent} total={data.total} />}
      {data && <MoodMonth month={month} days={data.month} today={today} onMonth={changeMonth} />}
    </div>
  );
}
