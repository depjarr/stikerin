// Jembatan ke fungsi server Gemini (/api/*). Kalau server/key ga ada, semua fungsi di sini
// "gagal dengan sopan" dan web balik ke AI yang jalan di browser.
import { makeCanvas, canvasToBlob, loadImage } from './sticker.js';

let statusP = null;
export function geminiEnabled() {
  if (!statusP) {
    statusP = fetch('/api/status')
      .then((r) => (r.ok ? r.json() : { gemini: false }))
      .then((d) => !!d.gemini)
      .catch(() => false);
  }
  return statusP;
}

async function post(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Server error ${r.status}`);
  return data;
}

function toJpegDataUrl(src, max = 1024, bg = null) {
  const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
  const s = Math.min(1, max / Math.max(w, h));
  const c = makeCanvas(w * s, h * s);
  const ctx = c.getContext('2d');
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL(bg ? 'image/jpeg' : 'image/png', 0.9);
}

/** Potong latar pakai poligon dari Gemini. Balikin canvas transparan atau null. */
export async function removeBgCloud(src) {
  const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
  const { objects } = await post('/api/remove-bg', { image: toJpegDataUrl(src, 1024, '#ffffff') });
  if (!objects?.length) return null;
  // gambar masker dari poligon, sedikit diblur biar tepinya halus
  const mask = makeCanvas(w, h);
  const m = mask.getContext('2d');
  m.fillStyle = '#000';
  m.filter = `blur(${Math.max(1, Math.round(Math.max(w, h) / 600))}px)`;
  let drawn = 0;
  for (const o of objects) {
    const pts = (o.polygon || []).filter((p) => Array.isArray(p) && p.length >= 2);
    if (pts.length < 3) continue;
    m.beginPath();
    pts.forEach(([x, y], i) => {
      const px = (x / 1000) * w, py = (y / 1000) * h;
      i ? m.lineTo(px, py) : m.moveTo(px, py);
    });
    m.closePath();
    m.fill();
    drawn++;
  }
  if (!drawn) return null;
  const out = makeCanvas(w, h);
  const o = out.getContext('2d');
  o.drawImage(src, 0, 0, w, h);
  o.globalCompositeOperation = 'destination-in';
  o.drawImage(mask, 0, 0);
  return out;
}

/** Prompt → gambar (data URL, latar putih). */
export async function generateCloud(prompt, style) {
  const { image } = await post('/api/generate', { prompt, style });
  return loadImage(image);
}

/** Orang + baju → gambar orang pakai baju (data URL, latar putih). */
export async function tryOnCloud(personCanvas, garments) {
  const person = toJpegDataUrl(personCanvas, 1024, '#ffffff');
  const list = garments.map((g) => ({ slot: g.slot, image: toJpegDataUrl(g.canvas, 768, '#ffffff') }));
  const { image } = await post('/api/try-on', { person, garments: list });
  return loadImage(image);
}

export async function imageToBlob(img) {
  const c = makeCanvas(img.naturalWidth || img.width, img.naturalHeight || img.height);
  c.getContext('2d').drawImage(img, 0, 0);
  return canvasToBlob(c, 'image/png');
}
