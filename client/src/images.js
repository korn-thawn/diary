// Client-side image processing: decode (EXIF-aware), resize, re-encode.
// Re-encoding also drops all metadata (EXIF, GPS location) from the original file.

const FULL_EDGE = 1600;
const THUMB_EDGE = 480;
const MAX_INPUT = 40 * 1024 * 1024; // refuse absurd files before decoding

function fit(w, h, edge) {
  const scale = Math.min(1, edge / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encode(bitmap, edge, quality) {
  const { width, height } = fit(bitmap.width, bitmap.height, edge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  // white backdrop so transparent PNGs don't turn black in JPEG
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  let blob = await toBlob(canvas, "image/webp", quality);
  // Browsers that can't encode WebP silently return PNG (or null): use JPEG instead
  if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality + 0.05);
  if (!blob) throw new Error("เบราว์เซอร์นี้แปลงรูปไม่ได้");
  return { blob, width, height };
}

/**
 * @param {File} file
 * @returns {Promise<{ full: Blob, thumb: Blob, width: number, height: number, previewUrl: string }>}
 */
export async function processImage(file) {
  if (!file.type.startsWith("image/") && !/\.(heic|heif|jpe?g|png|webp|gif|avif)$/i.test(file.name)) {
    throw new Error(`"${file.name}" ไม่ใช่ไฟล์รูป`);
  }
  if (file.size > MAX_INPUT) throw new Error(`"${file.name}" ใหญ่เกิน 40 MB`);
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const heic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
    throw new Error(
      heic
        ? `เบราว์เซอร์นี้เปิดไฟล์ HEIC ไม่ได้ ("${file.name}") ลองเลือกรูปจากแอปรูปภาพบนมือถือ หรือแปลงเป็น JPEG ก่อน`
        : `เปิดไฟล์ "${file.name}" ไม่ได้`
    );
  }
  try {
    const full = await encode(bitmap, FULL_EDGE, 0.82);
    const thumb = await encode(bitmap, THUMB_EDGE, 0.75);
    return { full: full.blob, thumb: thumb.blob, width: full.width, height: full.height, previewUrl: URL.createObjectURL(thumb.blob) };
  } finally {
    bitmap.close?.();
  }
}

// Pull image files out of a paste or drop event.
export function imageFilesFrom(dataTransfer) {
  return [...(dataTransfer?.files || [])].filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
}
