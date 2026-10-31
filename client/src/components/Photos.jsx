import { useCallback, useEffect, useRef, useState } from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  XMarkIcon,
} from "@heroicons/react/20/solid";
import { api, photoUrl, uploadPhoto } from "../api";
import { imageFilesFrom, processImage } from "../images";
import { useDndSensors } from "../pages/Boards";

export const MAX_PHOTOS = 12;

export function Lightbox({ photos, index, onIndex, onClose }) {
  const photo = photos[index];
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      if (e.key === "ArrowRight" && index < photos.length - 1) onIndex(index + 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, photos.length, onIndex, onClose]);
  if (!photo) return null;
  const nav = "absolute top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white hover:bg-white/30";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" role="dialog" aria-modal="true" aria-label="ดูรูป" onClick={onClose}>
      <img
        src={photoUrl(photo.id)}
        width={photo.width}
        height={photo.height}
        alt={`รูปที่ ${index + 1} จาก ${photos.length}`}
        className="max-h-[90dvh] max-w-[95vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="absolute top-3 right-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
        <a href={photoUrl(photo.id)} download={`photo-${photo.id}`} className="rounded-full bg-white/15 p-2 text-white hover:bg-white/30" aria-label="ดาวน์โหลด">
          <ArrowDownTrayIcon className="size-5" />
        </a>
        <button className="rounded-full bg-white/15 p-2 text-white hover:bg-white/30" onClick={onClose} aria-label="ปิด">
          <XMarkIcon className="size-5" />
        </button>
      </div>
      {index > 0 && (
        <button className={`${nav} left-3`} onClick={(e) => { e.stopPropagation(); onIndex(index - 1); }} aria-label="รูปก่อนหน้า">
          <ChevronLeftIcon className="size-6" />
        </button>
      )}
      {index < photos.length - 1 && (
        <button className={`${nav} right-3`} onClick={(e) => { e.stopPropagation(); onIndex(index + 1); }} aria-label="รูปถัดไป">
          <ChevronRightIcon className="size-6" />
        </button>
      )}
      <p className="absolute bottom-3 text-sm text-white/70">{index + 1} / {photos.length}</p>
    </div>
  );
}

function SavedThumb({ photo, index, onOpen, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group relative aspect-square overflow-hidden rounded-lg bg-stone-100 ${isDragging ? "z-10 opacity-60" : ""}`}
      {...attributes}
      {...listeners}
    >
      <img
        src={photoUrl(photo.id, true)}
        alt={`รูปที่ ${index + 1}`}
        loading="lazy"
        width={photo.width}
        height={photo.height}
        className="size-full cursor-zoom-in object-cover"
        onClick={() => onOpen(index)}
        draggable={false}
      />
      <button
        type="button"
        className="absolute top-1 right-1 rounded-full bg-black/55 p-1 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100 max-sm:opacity-100"
        onClick={(e) => { e.stopPropagation(); onDelete(photo); }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={`ลบรูปที่ ${index + 1}`}
      >
        <XMarkIcon className="size-4" />
      </button>
    </li>
  );
}

function PendingThumb({ item, onRemove }) {
  return (
    <li className="relative aspect-square overflow-hidden rounded-lg bg-stone-100">
      {item.previewUrl ? (
        <img src={item.previewUrl} alt="" className={`size-full object-cover ${item.status === "error" ? "opacity-30" : "opacity-70"}`} />
      ) : (
        <div className="flex size-full items-center justify-center"><PhotoIcon className="size-6 text-stone-300" aria-hidden="true" /></div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-black/55 px-1.5 py-1 text-[10px] leading-tight text-white">
        {item.status === "processing" && "กำลังย่อรูป…"}
        {item.status === "ready" && "รอบันทึก"}
        {item.status === "uploading" && `อัปโหลด ${Math.round(item.progress * 100)}%`}
        {item.status === "error" && (
          <span className="flex items-start gap-1"><ExclamationTriangleIcon className="mt-px size-3 shrink-0" aria-hidden="true" />{item.error}</span>
        )}
      </div>
      {item.status === "uploading" && (
        <div className="absolute inset-x-0 top-0 h-1 bg-black/20"><div className="h-full bg-emerald-400" style={{ width: `${item.progress * 100}%` }} /></div>
      )}
      {(item.status === "ready" || item.status === "error") && (
        <button type="button" className="absolute top-1 right-1 rounded-full bg-black/55 p-1 text-white" onClick={() => onRemove(item.key)} aria-label="เอารูปนี้ออก">
          <XMarkIcon className="size-4" />
        </button>
      )}
    </li>
  );
}

/**
 * Photo section for an entry or card.
 * - target = { entryId } | { cardId } uploads immediately;
 *   target = null keeps processed photos locally until the parent calls flushRef.current(target).
 * - Pasting an image anywhere on the page adds it while this component is mounted (pasteEnabled).
 */
export default function PhotoManager({ target, photos, onPhotosChange, onError, flushRef, pasteEnabled = true }) {
  const [pending, setPending] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const sensors = useDndSensors();
  const keySeq = useRef(0);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const update = (key, patch) => setPending((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const drop = (key) =>
    setPending((list) => {
      const it = list.find((p) => p.key === key);
      if (it?.previewUrl) URL.revokeObjectURL(it.previewUrl);
      return list.filter((p) => p.key !== key);
    });

  async function upload(item, to) {
    update(item.key, { status: "uploading", progress: 0 });
    try {
      const photo = await uploadPhoto(to, item.processed, (p) => update(item.key, { progress: p }));
      onPhotosChange([...photosRef.current, { id: photo.id, width: photo.width, height: photo.height }]);
      drop(item.key);
      return true;
    } catch (err) {
      if (err.status === 401) onError(err);
      update(item.key, { status: "error", error: err.message });
      return false;
    }
  }

  const addFiles = useCallback(
    async (files) => {
      const room = MAX_PHOTOS - photosRef.current.length - pending.filter((p) => p.status !== "error").length;
      const accepted = files.slice(0, Math.max(0, room));
      if (files.length > accepted.length) onError({ message: `แนบได้สูงสุด ${MAX_PHOTOS} รูปต่อรายการ` });
      // sequential: keeps memory low on phones when picking many large photos
      for (const file of accepted) {
        const key = ++keySeq.current;
        setPending((list) => [...list, { key, status: "processing", progress: 0 }]);
        let processed;
        try {
          processed = await processImage(file);
        } catch (err) {
          update(key, { status: "error", error: err.message });
          continue;
        }
        update(key, { status: "ready", processed, previewUrl: processed.previewUrl });
        if (target) await upload({ key, processed }, target);
      }
    },
    [target, pending] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Parent (new entry) uploads the queued photos once it has an id
  useEffect(() => {
    if (!flushRef) return;
    flushRef.current = async (to) => {
      let failed = 0;
      for (const item of pending.filter((p) => p.status === "ready")) if (!(await upload(item, to))) failed++;
      return { failed };
    };
  });

  useEffect(() => {
    if (!pasteEnabled) return;
    const onPaste = (e) => {
      const files = imageFilesFrom(e.clipboardData);
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [pasteEnabled, addFiles]);

  // free blob URLs on unmount
  useEffect(() => () => pending.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl)), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(photo) {
    if (!confirm("ลบรูปนี้?")) return;
    const prev = photos;
    onPhotosChange(photos.filter((p) => p.id !== photo.id));
    try {
      await api(`/photos/${photo.id}`, { method: "DELETE" });
    } catch (err) {
      onPhotosChange(prev);
      onError(err);
    }
  }

  async function reorder({ active, over }) {
    if (!over || active.id === over.id || !target) return;
    const prev = photos;
    const next = arrayMove(photos, photos.findIndex((p) => p.id === active.id), photos.findIndex((p) => p.id === over.id));
    onPhotosChange(next);
    try {
      await api("/photos/order", { method: "PUT", body: { ...target, ids: next.map((p) => p.id) } });
    } catch (err) {
      onPhotosChange(prev);
      onError(err);
    }
  }

  const count = photos.length + pending.filter((p) => p.status !== "error").length;

  return (
    <div
      className={`rounded-xl transition ${dragOver ? "bg-accent/5 ring-2 ring-accent/40" : ""}`}
      onDragOver={(e) => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { const files = imageFilesFrom(e.dataTransfer); if (files.length) { e.preventDefault(); addFiles(files); } setDragOver(false); }}
    >
      {(photos.length > 0 || pending.length > 0) && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder}>
          <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
            <ul className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((p, i) => (
                <SavedThumb key={p.id} photo={p} index={i} onOpen={setLightbox} onDelete={remove} />
              ))}
              {pending.map((item) => (
                <PendingThumb key={item.key} item={item} onRemove={drop} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-ghost px-3 py-1.5 text-sm ring-1 ring-stone-300"
          onClick={() => inputRef.current?.click()}
          disabled={count >= MAX_PHOTOS}
        >
          <PhotoIcon className="size-4" aria-hidden="true" /> เพิ่มรูป
        </button>
        <span className="text-xs text-stone-400">
          {count}/{MAX_PHOTOS} · ลากรูปมาวาง หรือกด Ctrl+V เพื่อวางรูปได้
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => { addFiles([...e.target.files]); e.target.value = ""; }}
        />
      </div>
      {lightbox !== null && <Lightbox photos={photos} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
