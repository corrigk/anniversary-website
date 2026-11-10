// Client-side photo processing before upload:
// decode -> orientation fixed -> longest edge <= 2560px -> JPEG at quality 0.92 (the
// full copy, shown in the full-screen viewer), plus a 1280px "display" copy at 0.88
// (shown on timeline cards, in the garden and in memory pop-ups: sharp on a phone).
// Re-encoding through a canvas also strips EXIF metadata (including GPS).
//
// Orientation: every browser this site targets (iOS Safari 13.4+, Chrome 81+,
// Firefox 77+) applies the EXIF orientation when decoding an <img>, and
// drawImage() draws the upright image, so no manual rotation is needed (and
// rotating again would turn the photo sideways).

export const FULL_EDGE = 2560;
export const THUMB_EDGE = 1280; // the "thumb" is the card-sized display copy, not a tiny preview
const FULL_QUALITY = 0.92;
const THUMB_QUALITY = 0.88;
const MAX_FULL_BYTES = 4 * 1024 * 1024; // only squeeze harder if a photo is unusually heavy

export async function processPhoto(file) {
  const img = await decode(file);
  const w = img.naturalWidth, hgt = img.naturalHeight;
  if (!w || !hgt) throw unreadable(file);

  const full = drawScaled(img, w, hgt, FULL_EDGE);
  let fullBlob = await toJpeg(full, FULL_QUALITY);
  if (fullBlob.size > MAX_FULL_BYTES) fullBlob = await toJpeg(full, 0.85);

  const thumb = drawScaled(full, full.width, full.height, THUMB_EDGE);
  const thumbBlob = await toJpeg(thumb, THUMB_QUALITY);

  full.width = full.height = 0; // free memory on iOS
  return { full: fullBlob, thumb: thumbBlob, preview: URL.createObjectURL(thumbBlob), width: w, height: hgt };
}

function decode(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(unreadable(file)); };
    img.src = url;
  });
}

function unreadable(file) {
  const heic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name || '');
  return new Error(heic
    ? `“${file.name}” is a HEIC photo this browser can’t open. On iPhone, pick it from Photos in Safari (it converts automatically), or set Camera → Formats → “Most Compatible”.`
    : `“${file.name || 'That file'}” couldn’t be opened as a photo. Try a JPEG or PNG.`);
}

function drawScaled(src, w, hgt, maxEdge) {
  const scale = Math.min(1, maxEdge / Math.max(w, hgt));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(hgt * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // transparent PNGs become white, not black
  ctx.fillRect(0, 0, cw, ch);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, cw, ch);
  return canvas;
}

function toJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process that photo.'))), 'image/jpeg', quality);
  });
}
