import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { TrashIcon } from "@heroicons/react/20/solid";
import { api, today } from "../api";
import { isDate } from "../dates";
import { useAuth } from "../auth";
import { MoodPicker } from "../components/Mood";
import { AtmospherePicker, WeatherPicker } from "../components/Atmosphere";
import { BigTime } from "../components/home/HeroEntry";
import PhotoManager from "../components/Photos";
import { timeOf } from "../night";

function Field({ label, hint, children }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">
        {label} {hint && <span className="text-xs text-dim">{hint}</span>}
      </p>
      {children}
    </div>
  );
}

export default function EntryEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setUser } = useAuth();

  // ?date=YYYY-MM-DD comes from the calendars; computed lazily so "today" isn't stale
  const [form, setForm] = useState(() => ({
    entry_date: isDate(params.get("date")) ? params.get("date") : today(),
    title: "",
    body: "",
    mood: null,
    tags: "",
    atmosphere: null,
    weather: null,
    temp_c: "",
    caption: "",
    created_at: null,
  }));
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [photos, setPhotos] = useState([]);
  const flushPhotos = useRef(null);
  const [now] = useState(() => new Date().toISOString());

  const handleError = (err) => {
    if (err.status === 401) return setUser(null);
    setError(err.message);
  };

  useEffect(() => {
    if (isNew) return;
    api(`/entries/${id}`)
      .then(({ entry }) => {
        setForm({ ...entry, tags: entry.tags.join(", "), temp_c: entry.temp_c ?? "", caption: entry.caption || "" });
        setPhotos(entry.photos || []);
      })
      .catch((err) => (err.status === 404 ? navigate("/", { replace: true }) : handleError(err)))
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setValue = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const temp = String(form.temp_c).trim();
    const body = {
      entry_date: form.entry_date,
      title: form.title,
      body: form.body,
      mood: form.mood,
      tags: form.tags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean),
      atmosphere: form.atmosphere,
      weather: form.weather,
      temp_c: temp === "" ? null : Math.round(Number(temp)),
      caption: form.caption.trim() || null,
    };
    try {
      if (isNew) {
        const { entry } = await api("/entries", { method: "POST", body });
        // upload photos picked before the entry existed
        const { failed } = (await flushPhotos.current?.({ entryId: entry.id })) || { failed: 0 };
        if (failed) {
          navigate(`/entries/${entry.id}`, { replace: true });
          setError(`บันทึกแล้ว แต่อัปโหลดรูปไม่สำเร็จ ${failed} รูป ลองเพิ่มใหม่อีกครั้ง`);
          return;
        }
      } else {
        await api(`/entries/${id}`, { method: "PUT", body });
      }
      navigate("/");
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("ลบบันทึกนี้? ลบแล้วกู้คืนไม่ได้")) return;
    try {
      await api(`/entries/${id}`, { method: "DELETE" });
      navigate("/");
    } catch (err) {
      handleError(err);
    }
  }

  if (loading) return <p className="meta text-dim">กำลังโหลด…</p>;

  return (
    <form onSubmit={save} className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="meta mb-2 text-calm-text">{isNew ? "เวลาที่เริ่มเขียน" : "เขียนเมื่อ"}</p>
          <BigTime value={timeOf(form.created_at || now)} className="text-[56px] sm:text-[80px]" />
        </div>
        <label className="block">
          <span className="meta mb-1 block text-dim">คืนวันที่</span>
          <input type="date" className="input w-auto" value={form.entry_date} onChange={set("entry_date")} required />
        </label>
      </div>

      <input
        className="w-full border-0 border-b border-line-strong bg-transparent pb-2 font-display text-[28px] font-semibold italic outline-none placeholder:font-normal focus:border-title sm:text-[34px]"
        placeholder="ชื่อบันทึก (ไม่บังคับ)"
        value={form.title}
        onChange={set("title")}
        maxLength={200}
        aria-label="ชื่อบันทึก"
      />

      <textarea
        className="input min-h-[45vh] resize-y bg-transparent text-[17px] leading-relaxed"
        placeholder="คืนนี้เกิดอะไรขึ้นบ้าง…"
        value={form.body}
        onChange={set("body")}
        required
        autoFocus={isNew}
        aria-label="เนื้อหา"
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="บรรยากาศคืนนี้" hint="ใช้ระบายสีปฏิทินอารมณ์">
          <AtmospherePicker value={form.atmosphere} onChange={setValue("atmosphere")} />
        </Field>
        <Field label="อารมณ์" hint="1–5 ใช้ในหน้าสถิติ">
          <MoodPicker value={form.mood} onChange={setValue("mood")} />
        </Field>
      </div>

      <Field label="อากาศ">
        <div className="flex flex-wrap items-center gap-3">
          <WeatherPicker value={form.weather} onChange={setValue("weather")} />
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="number"
              inputMode="numeric"
              className="input w-20 py-1.5"
              min={-30}
              max={60}
              value={form.temp_c}
              onChange={set("temp_c")}
              aria-label="อุณหภูมิ (องศาเซลเซียส)"
            />
            °C
          </label>
        </div>
      </Field>

      <Field label="รูป" hint="รูปแรกเป็นรูปปกบนหน้าแรก">
        <PhotoManager
          target={isNew ? null : { entryId: id }}
          photos={photos}
          onPhotosChange={setPhotos}
          onError={handleError}
          flushRef={flushPhotos}
        />
        <input
          className="input text-center font-display text-warm italic"
          placeholder="คำบรรยายใต้รูปปก เหมือน subtitle ในหนัง (ไม่บังคับ)"
          value={form.caption}
          onChange={set("caption")}
          maxLength={120}
          aria-label="คำบรรยายใต้รูปปก"
        />
      </Field>

      <Field label="แท็ก">
        <input className="input text-sm" placeholder="คั่นด้วย comma เช่น งาน, เที่ยว" value={form.tags} onChange={set("tags")} />
      </Field>

      {error && <p className="text-sm text-hot-text" role="alert">{error}</p>}

      <div className="flex items-center justify-between gap-2 border-t border-line pt-6">
        <div>
          {!isNew && (
            <button type="button" className="btn btn-danger" onClick={remove}>
              <TrashIcon className="size-4" aria-hidden="true" />
              ลบ
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Link to="/" className="btn btn-ghost">ยกเลิก</Link>
          <button className="btn btn-primary min-h-11 px-6" disabled={saving}>
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </div>
    </form>
  );
}
