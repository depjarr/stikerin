// Paket stiker WhatsApp: tiap stiker jadi WebP 512×512 (≤100 KB) + ikon 96×96, dibungkus .zip.
import { zipSync } from 'fflate';
import { loadImage, makeCanvas, canvasToBlob } from './sticker.js';

async function fit(url, size, margin) {
  const img = await loadImage(url);
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const s = Math.min((size - margin * 2) / img.width, (size - margin * 2) / img.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (size - img.width * s) / 2, (size - img.height * s) / 2, img.width * s, img.height * s);
  return c;
}

async function webpUnder(c, maxBytes) {
  for (const q of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4]) {
    const b = await canvasToBlob(c, 'image/webp', q);
    if (b.type !== 'image/webp') throw new Error('Browser ini ga bisa bikin WebP. Coba pakai Chrome.');
    if (b.size <= maxBytes || q === 0.4) return b;
  }
}

const README = `PAKET STIKER WHATSAPP (dari Stikerin)

Isi:
- 01.webp, 02.webp, ... = stiker 512x512
- tray.png = ikon paket

Cara masukin ke WhatsApp (Android/iPhone):
1. Install aplikasi pembuat stiker, misalnya "Sticker Maker" atau "Personal stickers for WhatsApp".
2. Ekstrak zip ini di HP.
3. Di aplikasinya, bikin paket baru, pilih file-file .webp di atas (min. 3, maks. 30), lalu "Add to WhatsApp".

WhatsApp ga bisa nambahin paket langsung dari browser, jadi perlu aplikasi perantara.
`;

/** Bikin zip paket stiker. Balikin { blob, count }. */
export async function buildWaPack(stickers, name = 'stikerin') {
  const list = stickers.filter((s) => s.url).slice(0, 30);
  if (list.length < 3) throw new Error('Paket WhatsApp butuh minimal 3 stiker');
  const files = {};
  for (let i = 0; i < list.length; i++) {
    const c = await fit(list[i].url, 512, 16);
    const b = await webpUnder(c, 100 * 1024);
    files[`${String(i + 1).padStart(2, '0')}.webp`] = new Uint8Array(await b.arrayBuffer());
  }
  const tray = await canvasToBlob(await fit(list[0].url, 96, 4), 'image/png');
  files['tray.png'] = new Uint8Array(await tray.arrayBuffer());
  files['CARA-PAKAI.txt'] = new TextEncoder().encode(README);
  const zipped = zipSync(files, { level: 0 });
  return { blob: new Blob([zipped], { type: 'application/zip' }), count: list.length, filename: `${name}-whatsapp.zip` };
}
