import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api, today as todayStr } from "../api";
import { useAuth } from "../auth";
import { entryNo, nightDate, timeOf } from "../night";
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
function EmptyHero() {
  const now = useNow();
  return (
    <section className="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 pt-10 pb-16 sm:px-8 sm:pt-16">
      <div className="meta text-sm tracking-[0.12em] text-calm-text">{entryNo(1)} · {nightDate(todayStr())}</div>
      <BigTime value={timeOf(now.toISOString())} />
      <h1 className="m-0 text-[34px] sm:text-[46px]">คืนนี้ยังไม่มีบันทึก</h1>
      <p className="m-0 max-w-[520px] text-[17px] text-muted">เริ่มจากสองสามบรรทัดก็พอ เวลาที่เขียนจะถูกจดไว้ให้เอง แล้วหน้านี้จะค่อยๆ เต็มไปด้วยคืนของคุณ</p>
      <div className="mt-2">
        <Link to="/entries/new" viewTransition className="btn btn-primary min-h-11 px-5.5">เขียนบันทึกแรก</Link>
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

  useEffect(() => {
    let alive = true;
    api(`/entries/home?month=${month}`)
      .then((d) => alive && setData(d))
      .catch((err) => (err.status === 401 ? setUser(null) : alive && setError("โหลดบันทึกไม่สำเร็จ ลองรีเฟรชหน้านี้")));
    return () => { alive = false; };
  }, [month, setUser]);

  if (error) return <p className="mx-auto max-w-[1200px] px-4 py-16 text-hot-text sm:px-8">{error}</p>;
  if (!data) return <p className="meta mx-auto max-w-[1200px] px-4 py-16 text-dim sm:px-8">กำลังโหลด…</p>;

  return (
    <div style={{ viewTransitionName: "win-body" }}>
      {data.latest ? <HeroEntry entry={data.latest} /> : <EmptyHero />}

      {data.recent.length > 0 && (
        <section id="entries" className="border-t border-line">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 py-16 sm:px-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="m-0 text-[32px]">บันทึกก่อนหน้า</h2>
              <Link to="/entries" viewTransition className="meta py-3 text-calm-text">
                ดูทั้งหมด {data.total} บันทึก
              </Link>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-7">
              {data.recent.map((e) => <EntryCard key={e.id} entry={e} />)}
            </div>
          </div>
        </section>
      )}

      <MoodMonth month={month} days={data.month} today={today} onMonth={setMonth} />
    </div>
  );
}
