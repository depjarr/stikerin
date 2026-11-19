// Cetak A4: satu lembar stiker penuh (header + latar + semua stiker sesuai susunan),
// plus garis potong abu-abu di sekeliling tiap stiker.
import { makeCanvas } from './sticker.js';
import { renderSetCanvas } from './exporter.js';

const DPI = 300;
const MM = DPI / 25.4;
const A4_W = Math.round(210 * MM); // 2480
const A4_H = Math.round(297 * MM); // 3508
const MARGIN = Math.round(8 * MM);

/** Balikin canvas halaman A4 (putih) berisi lembar stiker penuh di tengah. */
export async function renderPrintPage({ stickers, bg, pack }) {
  const sheet = await renderSetCanvas({ stickers, bg, pack, scale: 3, cutLines: true });
  const page = makeCanvas(A4_W, A4_H);
  const ctx = page.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, A4_W, A4_H);
  const footer = Math.round(6 * MM);
  const maxW = A4_W - MARGIN * 2;
  const maxH = A4_H - MARGIN * 2 - footer;
  const s = Math.min(maxW / sheet.width, maxH / sheet.height);
  const w = Math.round(sheet.width * s);
  const h = Math.round(sheet.height * s);
  const x = Math.round((A4_W - w) / 2);
  const y = MARGIN;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sheet, x, y, w, h);
  ctx.fillStyle = '#9a9a9a';
  ctx.font = `${Math.round(3 * MM)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('Stikerin · potong stiker ngikutin garis abu-abu', A4_W / 2, A4_H - MARGIN + Math.round(1 * MM));
  return page;
}

/** Buka dialog cetak. `win` dibuka duluan pas klik (biar ga diblok popup blocker). */
export function printPages(win, pages) {
  const imgs = pages.map((p) => `<img src="${p.toDataURL('image/png')}" alt="">`).join('');
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Cetak stiker A4</title>
<style>@page{size:A4;margin:0}html,body{margin:0;background:#fff}img{display:block;width:210mm;height:297mm;page-break-after:always}img:last-child{page-break-after:auto}</style>
</head><body>${imgs}<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
  win.document.close();
}
