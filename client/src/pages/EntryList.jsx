import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { api, formatDate, moodEmoji } from "../api";
import { useAuth } from "../auth";

const PAGE = 30;

function groupByMonth(entries) {
  const groups = [];
  for (const e of entries) {
    const key = e.entry_date.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) groups.push((g = { key, items: [] }));
    g.items.push(e);
  }
  return groups;
}

export default function EntryList() {
  const { setUser } = useAuth();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const tag = params.get("tag") || "";

  const [search, setSearch] = useState(q);
  const [entries, setEntries] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(offset = 0) {
    setLoading(true);
    setError("");
    const qs = new URLSearchParams({ limit: PAGE, offset });
    if (q) qs.set("q", q);
    if (tag) qs.set("tag", tag);
    try {
      const d = await api(`/entries?${qs}`);
      setEntries((prev) => (offset ? [...prev, ...d.entries] : d.entries));
      setHasMore(d.hasMore);
    } catch (err) {
      if (err.status === 401) return setUser(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(0);
  }, [q, tag]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api("/entries/tags").then((d) => setTags(d.tags)).catch(() => {});
  }, []);

  // Debounce search box → URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (search === q) return;
      const next = new URLSearchParams(params);
      search ? next.set("q", search) : next.delete("q");
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleTag(t) {
    const next = new URLSearchParams(params);
    tag === t ? next.delete("tag") : next.set("tag", t);
    setParams(next);
  }

  const groups = useMemo(() => groupByMonth(entries), [entries]);

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input
          className="input"
          type="search"
          placeholder="ค้นหาบันทึก…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Link to="/entries/new" className="btn btn-primary shrink-0">
          + เขียนบันทึก
        </Link>
      </div>

      {tags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {tags.map(({ tag: t, count }) => (
            <button
              key={t}
              onClick={() => toggleTag(t)}
              className={`rounded-full px-3 py-1 text-sm transition ${
                tag === t ? "bg-accent text-white" : "bg-stone-200/70 text-stone-700 hover:bg-stone-300/70"
              }`}
            >
              #{t} <span className="opacity-60">{count}</span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="mb-4 text-red-600">{error}</p>}

      {!loading && entries.length === 0 && (
        <div className="mt-16 text-center text-stone-500">
          {q || tag ? "ไม่พบบันทึกที่ตรงกับเงื่อนไข" : "ยังไม่มีบันทึก เริ่มเขียนวันแรกกันเลย ✍️"}
        </div>
      )}

      {groups.map((g) => (
        <section key={g.key} className="mb-8">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-stone-500 uppercase">
            {formatDate(`${g.key}-01`, { month: "long", year: "numeric" })}
          </h2>
          <ul className="space-y-3">
            {g.items.map((e) => (
              <li key={e.id}>
                <Link
                  to={`/entries/${e.id}`}
                  className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200 transition hover:ring-accent/40"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="truncate font-serif text-lg font-medium">
                      {moodEmoji(e.mood)} {e.title || <span className="text-stone-400">(ไม่มีหัวข้อ)</span>}
                    </h3>
                    <time className="shrink-0 text-sm text-stone-500">{formatDate(e.entry_date)}</time>
                  </div>
                  <p className="mt-1 line-clamp-2 text-stone-600">{e.body}</p>
                  {e.tags.length > 0 && (
                    <p className="mt-2 text-xs text-stone-400">{e.tags.map((t) => `#${t}`).join(" ")}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {loading && <p className="text-center text-stone-500">กำลังโหลด…</p>}
      {hasMore && !loading && (
        <div className="text-center">
          <button className="btn btn-ghost" onClick={() => load(entries.length)}>
            โหลดเพิ่ม
          </button>
        </div>
      )}
    </div>
  );
}
