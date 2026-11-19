// Lembar cetak A4 (300 dpi) dengan garis potong abu-abu di sekeliling tiap stiker.
import { loadImage, makeCanvas } from './sticker.js';
import { BOARD_W } from './exporter.js';

const DPI = 300;
const MM = DPI / 25.4;
const A4_W = Math.round(210 * MM); // 2480
const A4_H = Math.round(297 * MM); // 3508
const MARGIN = Math.round(10 * MM);
const GAP = Math.round(4 * MM);
const CUT = '#9a9a9a';

// stiker + garis potong tipis (siluetnya dilebarin dikit, warnanya abu-abu)
function withCutLine(img, w, h) {
  const pad = 6;
  const c = makeCanvas(w + pad * 2, h + pad * 2);
  const ctx = c.getContext('2d');
  const sil = makeCanvas(w, h);
  const s = sil.getContext('2d');
  s.drawImage(img, 0, 0, w, h);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = CUT;
  s.fillRect(0, 0, w, h);
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI * 2 * i) / 16;
    ctx.drawImage(sil, pad + Math.cos(a) * 4, pad + Math.sin(a) * 4);
  }
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI * 2 * i) / 16;
    ctx.drawImage(sil, pad + Math.cos(a) * 1.5, pad + Math.sin(a) * 1.5);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(img, pad, pad, w, h);
  return c;
}

/** Susun stiker di halaman A4. Balikin array canvas (bisa lebih dari 1 halaman). */
export async function renderPrintPages(stickers) {
  const list = stickers.filter((s) => s.url);
  if (!list.length) return [];
  // ukuran fisik ngikutin ukuran di kertas stiker: lebar kertas (1000) = lebar area cetak
  const scale = (A4_W - MARGIN * 2) / BOARD_W;
  const items = await Promise.all(
    list.map(async (s) => {
      const img = await loadImage(s.url);
      let w = Math.max(60, s.width * scale);
      let h = (w * s.imgH) / s.imgW;
      const maxH = A4_H - MARGIN * 2 - 120;
      if (h > maxH) {
        w *= maxH / h;
        h = maxH;
      }
      return { img, w: Math.round(w), h: Math.round(h) };
    })
  );
  items.sort((a, b) => b.h - a.h);

  const pages = [];
  let page, ctx, x, y, rowH;
  const newPage = () => {
    page = makeCanvas(A4_W, A4_H);
    ctx = page.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, A4_W, A4_H);
    ctx.fillStyle = '#9a9a9a';
    ctx.font = `${Math.round(3.2 * MM)}px sans-serif`;
    ctx.fillText('Stikerin · potong ngikutin garis abu-abu', MARGIN, A4_H - MARGIN / 2);
    pages.push(page);
    x = MARGIN;
    y = MARGIN;
    rowH = 0;
  };
  newPage();
  for (const it of items) {
    if (x + it.w > A4_W - MARGIN && x > MARGIN) {
      x = MARGIN;
      y += rowH + GAP;
      rowH = 0;
    }
    if (y + it.h > A4_H - MARGIN - 80) newPage();
    ctx.drawImage(withCutLine(it.img, it.w, it.h), x - 6, y - 6);
    x += it.w + GAP;
    rowH = Math.max(rowH, it.h);
  }
  return pages;
}

/** Buka dialog cetak. `win` dibuka duluan pas klik (biar ga diblok popup blocker). */
export function printPages(win, pages) {
  const imgs = pages.map((p) => `<img src="${p.toDataURL('image/png')}" alt="">`).join('');
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Cetak stiker A4</title>
<style>@page{size:A4;margin:0}html,body{margin:0;background:#fff}img{display:block;width:210mm;height:297mm;page-break-after:always}img:last-child{page-break-after:auto}</style>
</head><body>${imgs}<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
  win.document.close();
}
