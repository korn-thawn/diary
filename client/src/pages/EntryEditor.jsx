import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { api, MOODS, today } from "../api";
import { useAuth } from "../auth";

const EMPTY = { entry_date: today(), title: "", body: "", mood: null, tags: "" };

export default function EntryEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleError = (err) => {
    if (err.status === 401) return setUser(null);
    setError(err.message);
  };

  useEffect(() => {
    if (isNew) return;
    api(`/entries/${id}`)
      .then(({ entry }) => setForm({ ...entry, tags: entry.tags.join(", ") }))
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
      if (isNew) await api("/entries", { method: "POST", body });
      else await api(`/entries/${id}`, { method: "PUT", body });
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
    <form onSubmit={save} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="date"
          className="input w-auto"
          value={form.entry_date}
          onChange={set("entry_date")}
          required
        />
        <div className="flex gap-1" role="radiogroup" aria-label="อารมณ์">
          {MOODS.map((m) => (
            <button
              type="button"
              key={m.value}
              title={m.label}
              aria-label={m.label}
              aria-checked={form.mood === m.value}
              role="radio"
              onClick={() => setForm((f) => ({ ...f, mood: f.mood === m.value ? null : m.value }))}
              className={`rounded-full p-1.5 text-2xl transition ${
                form.mood === m.value ? "bg-accent/15 ring-2 ring-accent" : "opacity-50 grayscale hover:opacity-100 hover:grayscale-0"
              }`}
            >
              {m.emoji}
            </button>
          ))}
        </div>
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
            <button type="button" className="btn text-red-600 hover:bg-red-50" onClick={remove}>
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
