import { makeCanvas } from './sticker.js';
import { ensureFonts } from './exporter.js';

export const TEXT_STYLES = {
  bubble: { label: 'Bubble', font: (s) => `${s}px "Titan One", "Arial Black", sans-serif`, lh: 1.0 },
  script: { label: 'Script', font: (s) => `${s}px "Pacifico", cursive`, lh: 1.25 },
  round: { label: 'Bulat', font: (s) => `700 ${s}px "Fredoka", sans-serif`, lh: 1.0 },
  retro: { label: 'Retro', font: (s) => `${s}px "Caprasimo", Georgia, serif`, lh: 1.05 },
};

/** Teks -> gambar transparan (nanti dikasih pinggiran die-cut kayak stiker lain). */
export async function textToCutout(text, styleKey, fill, stroke) {
  await ensureFonts();
  const st = TEXT_STYLES[styleKey] || TEXT_STYLES.bubble;
  const size = 120;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 3);
  const probe = makeCanvas(10, 10).getContext('2d');
  probe.font = st.font(size);
  const widths = lines.map((l) => probe.measureText(l).width);
  const pad = 30;
  const lh = size * st.lh;
  const c = makeCanvas(Math.max(...widths) + pad * 2, lh * lines.length + pad * 2 + size * 0.25);
  const ctx = c.getContext('2d');
  ctx.font = st.font(size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  lines.forEach((l, i) => {
    const y = pad + size * 0.88 + i * lh;
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 14;
      ctx.strokeText(l, c.width / 2, y);
    }
    ctx.fillStyle = fill;
    ctx.fillText(l, c.width / 2, y);
  });
  // potong area kosong
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let minX = c.width, minY = c.height, maxX = 0, maxY = 0;
  for (let y = 0; y < c.height; y += 1)
    for (let x = 0; x < c.width; x += 1)
      if (d[(y * c.width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
  const out = makeCanvas(maxX - minX + 1, maxY - minY + 1);
  out.getContext('2d').drawImage(c, -minX, -minY);
  return out;
}
