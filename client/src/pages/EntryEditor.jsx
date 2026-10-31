import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { TrashIcon } from "@heroicons/react/20/solid";
import { api, today } from "../api";
import { isDate } from "../dates";
import { useAuth } from "../auth";
import { MoodPicker } from "../components/Mood";
import PhotoManager from "../components/Photos";

export default function EntryEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setUser } = useAuth();

  // ?date=YYYY-MM-DD comes from the calendar; computed lazily so "today" isn't stale
  const [form, setForm] = useState(() => ({
    entry_date: isDate(params.get("date")) ? params.get("date") : today(),
    title: "",
    body: "",
    mood: null,
    tags: "",
  }));
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [photos, setPhotos] = useState([]);
  const flushPhotos = useRef(null);

  const handleError = (err) => {
    if (err.status === 401) return setUser(null);
    setError(err.message);
  };

  useEffect(() => {
    if (isNew) return;
    api(`/entries/${id}`)
      .then(({ entry }) => {
        setForm({ ...entry, tags: entry.tags.join(", ") });
        setPhotos(entry.photos || []);
      })
      .catch((err) => (err.status === 404 ? navigate("/", { replace: true }) : handleError(err)))
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const body = {
      entry_date: form.entry_date,
      title: form.title,
      body: form.body,
      mood: form.mood,
      tags: form.tags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean),
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

  if (loading) return <p className="text-center text-stone-500">กำลังโหลด…</p>;

  return (
    <form onSubmit={save} className="space-y-4 panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="date"
          className="input w-auto"
          value={form.entry_date}
          onChange={set("entry_date")}
          required
        />
        <MoodPicker value={form.mood} onChange={(mood) => setForm((f) => ({ ...f, mood }))} />
      </div>

      <input
        className="input font-serif text-xl"
        placeholder="หัวข้อ (ไม่บังคับ)"
        value={form.title}
        onChange={set("title")}
        maxLength={200}
      />

      <textarea
        className="input min-h-[50vh] resize-y leading-relaxed"
        placeholder="วันนี้เป็นยังไงบ้าง…"
        value={form.body}
        onChange={set("body")}
        required
        autoFocus={isNew}
      />

      <PhotoManager
        target={isNew ? null : { entryId: id }}
        photos={photos}
        onPhotosChange={setPhotos}
        onError={handleError}
        flushRef={flushPhotos}
      />

      <input
        className="input text-sm"
        placeholder="แท็ก คั่นด้วย comma เช่น งาน, เที่ยว"
        value={form.tags}
        onChange={set("tags")}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between gap-2">
        <div>
          {!isNew && (
            <button type="button" className="btn btn-danger" onClick={remove}>
              <TrashIcon className="size-4" aria-hidden="true" />
              ลบ
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Link to="/" className="btn btn-ghost">
            ยกเลิก
          </Link>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </div>
    </form>
  );
}
