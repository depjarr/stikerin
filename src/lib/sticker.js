// Semua proses gambar jalan di browser user (ga ada upload ke server).

const MAX_SIDE = 640; // resolusi kerja stiker (cukup tajam, tetap cepat)

const imageCache = new Map();
export function loadImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gambar gagal dibaca'));
    img.src = src;
  });
  imageCache.set(src, p);
  if (imageCache.size > 200) imageCache.delete(imageCache.keys().next().value);
  return p;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal bikin file'))), type, quality)
  );
}

export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function fitCanvas(src, max) {
  const w = src.naturalWidth || src.width;
  const h = src.naturalHeight || src.height;
  const s = Math.min(1, max / Math.max(w, h));
  const c = makeCanvas(w * s, h * s);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

// Potong area transparan di pinggir.
function trimCanvas(src) {
  const c = fitCanvas(src, 4096);
  const { width: w, height: h } = c;
  const data = c.getContext('2d').getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const out = makeCanvas(maxX - minX + 1, maxY - minY + 1);
  out.getContext('2d').drawImage(c, -minX, -minY);
  return out;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shapeCanvas(src, shape) {
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext('2d');
  const m = Math.min(c.width, c.height);
  if (shape === 'circle') {
    ctx.beginPath();
    ctx.ellipse(c.width / 2, c.height / 2, c.width / 2, c.height / 2, 0, 0, Math.PI * 2);
  } else {
    roundRectPath(ctx, 0, 0, c.width, c.height, shape === 'rounded' ? m * 0.16 : m * 0.04);
  }
  ctx.clip();
  ctx.drawImage(src, 0, 0);
  return c;
}

/**
 * Foto -> "cutout" (gambar transparan tanpa latar).
 * useAI: pakai model segmentasi (IS-Net) yang jalan lokal di browser.
 */
export async function fileToCutout(file, { useAI, shape, onProgress }) {
  const url = URL.createObjectURL(file);
  let img;
  try {
    img = await loadImage(url);
  } finally {
    imageCache.delete(url);
  }

  if (!useAI) {
    URL.revokeObjectURL(url);
    return shapeCanvas(fitCanvas(img, MAX_SIDE), shape);
  }

  URL.revokeObjectURL(url);
  return aiCutout(img, onProgress);
}

/**
 * Gambar apa aja → cutout. Coba Gemini dulu (kalau API key diisi di server),
 * kalau gagal pakai AI yang jalan di browser.
 */
export async function aiCutout(img, onProgress) {
  const cloud = await import('./cloud.js');
  if (await cloud.geminiEnabled()) {
    try {
      onProgress?.('Gemini lagi motong foto…', 0.3);
      const cut = await cloud.removeBgCloud(img);
      const trimmed = cut && trimCanvas(cut);
      if (trimmed) return fitCanvas(trimmed, MAX_SIDE);
    } catch (e) {
      console.warn('Gemini gagal motong, pakai AI browser', e);
    }
  }
  return localCutout(img, onProgress);
}

async function localCutout(img, onProgress) {
  onProgress?.('Nyiapin AI…', 0);
  const base = fitCanvas(img, 1024);
  const { removeBackground } = await import('@imgly/background-removal');
  const out = await removeBackground(await canvasToBlob(base), {
    model: 'isnet_fp16',
    output: { format: 'image/png' },
    progress: (key, cur, total) => {
      const pct = total ? cur / total : 0;
      onProgress?.(key.startsWith('fetch') ? 'Download model AI (cuma sekali)…' : 'AI lagi nge-scan foto…', pct);
    },
  });
  onProgress?.('Ngerapihin pinggiran…', 1);
  const outUrl = URL.createObjectURL(out);
  const cutImg = await loadImage(outUrl);
  imageCache.delete(outUrl);
  const trimmed = trimCanvas(cutImg);
  URL.revokeObjectURL(outUrl);
  if (!trimmed) throw new Error('AI ga nemu objek di foto ini');
  return fitCanvas(trimmed, MAX_SIDE);
}

/**
 * Cutout + pinggiran (die-cut outline) dengan ketebalan bebas.
 * Hasil: url PNG, ukuran, dan data titik buat animasi peel.
 */
export function renderSticker(cut, width, color) {
  const pad = Math.ceil(width) + 6;
  const W = cut.width + pad * 2;
  const H = cut.height + pad * 2;
  const out = makeCanvas(W, H);
  const ctx = out.getContext('2d');

  if (width > 0) {
    const sil = makeCanvas(cut.width, cut.height);
    const s = sil.getContext('2d');
    s.drawImage(cut, 0, 0);
    s.globalCompositeOperation = 'source-in';
    s.fillStyle = color;
    s.fillRect(0, 0, sil.width, sil.height);

    const ol = makeCanvas(W, H);
    const o = ol.getContext('2d');
    const rings = Math.max(1, Math.ceil(width / 2.5));
    for (let i = 1; i <= rings; i++) {
      const r = (width * i) / rings;
      const n = Math.min(64, Math.max(16, Math.ceil(r * 1.4)));
      for (let k = 0; k < n; k++) {
        const a = (Math.PI * 2 * k) / n;
        o.drawImage(sil, pad + Math.cos(a) * r, pad + Math.sin(a) * r);
      }
    }
    // tegasin alpha biar pinggirannya solid kayak stiker beneran
    const d = o.getImageData(0, 0, W, H);
    const px = d.data;
    for (let i = 3; i < px.length; i += 4) {
      const a = px[i];
      px[i] = a < 20 ? 0 : Math.min(255, (a - 20) * 5);
    }
    o.putImageData(d, 0, 0);
    ctx.drawImage(ol, 0, 0);
  }
  ctx.drawImage(cut, pad, pad);

  return {
    url: out.toDataURL('image/png'),
    imgW: W,
    imgH: H,
    pad,
    peel: peelMeta(out),
  };
}

// Titik paling "kanan-bawah" & "kiri-atas" (arah diagonal) dari bentuk stiker.
function peelMeta(canvas) {
  const { width: w, height: h } = canvas;
  const data = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  let sMax = -1, sMin = Infinity, cx = w, cy = h;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (data[(y * w + x) * 4 + 3] > 60) {
        const sum = x + y;
        if (sum > sMax) { sMax = sum; cx = x; cy = y; }
        if (sum < sMin) sMin = sum;
      }
    }
  }
  if (sMax < 0) { sMax = w + h; sMin = 0; }
  return { sMax: (sMax + 3) / w, sMin: Math.max(0, sMin - 3) / w, cx: cx / w, cy: cy / w };
}

// Versi stiker WhatsApp: 512x512 WebP (fallback PNG kalau browser ga support).
export async function toWhatsAppSticker(url) {
  const img = await loadImage(url);
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');
  const s = Math.min(480 / img.width, 480 / img.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (512 - img.width * s) / 2, (512 - img.height * s) / 2, img.width * s, img.height * s);
  const blob = await canvasToBlob(c, 'image/webp', 0.92);
  return blob;
}

export async function dataURLToBlob(url) {
  return (await fetch(url)).blob();
}
