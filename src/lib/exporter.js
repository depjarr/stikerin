import { loadImage, makeCanvas, canvasToBlob } from './sticker.js';
import { wornList } from './dressup.js';

// Ukuran logis papan (rasio 3:4). Semua posisi stiker disimpan dalam satuan ini.
export const BOARD_W = 1000;
export const BOARD_H = 1333;
export const HEADER_H = 300;
export const CARD_R = 28;

let fontsPromise;
export function ensureFonts() {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      document.fonts.load('100px "Caprasimo"'),
      document.fonts.load('800 30px "Bricolage Grotesque"'),
      document.fonts.load('100px "Titan One"'),
      document.fonts.load('100px "Pacifico"'),
      document.fonts.load('700 100px "Fredoka"'),
    ]).catch(() => {});
  }
  return fontsPromise;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCover(ctx, img, x, y, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  const iw = img.width * s;
  const ih = img.height * s;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  ctx.restore();
}

function seeded(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

function star(ctx, cx, cy, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = rot + (Math.PI * i) / 5 - Math.PI / 2;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

export async function loadBaseImages(bg, pack) {
  const [bgImg, headerImg] = await Promise.all([
    bg.type === 'image' && bg.image ? loadImage(bg.image) : null,
    pack.enabled && pack.type === 'image' && pack.image ? loadImage(pack.image) : null,
  ]);
  return { bg: bgImg, header: headerImg };
}

/** Latar + header pack. ctx sudah di-scale ke satuan logis. */
export function drawBase(ctx, { bg, pack, images }) {
  const W = BOARD_W, H = BOARD_H;
  ctx.save();
  if (pack.enabled) {
    roundRect(ctx, 0, 0, W, H, CARD_R);
    ctx.clip();
  }

  if (bg.type === 'color') {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, W, H);
  } else if (bg.type === 'stripes') {
    ctx.fillStyle = bg.color2;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = bg.color;
    const sw = 44;
    for (let x = 0; x < W; x += sw * 2) ctx.fillRect(x, 0, sw, H);
  } else if (bg.type === 'image' && images.bg) {
    drawCover(ctx, images.bg, 0, 0, W, H);
  }

  if (pack.enabled) {
    if (pack.type === 'image' && images.header) {
      drawCover(ctx, images.header, 0, 0, W, HEADER_H);
    } else {
      ctx.fillStyle = pack.color;
      ctx.fillRect(0, 0, W, HEADER_H);
      ctx.fillStyle = pack.patternColor;
      const rnd = seeded(11);
      if (pack.pattern === 'stars') {
        for (let i = 0; i < 46; i++) star(ctx, rnd() * W, rnd() * HEADER_H, 6 + rnd() * 6, rnd() * 3);
      } else if (pack.pattern === 'dots') {
        for (let y = 18; y < HEADER_H; y += 36)
          for (let x = (y / 36) % 2 ? 18 : 36; x < W; x += 36) {
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
          }
      }
      drawHeaderText(ctx, pack);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(0, HEADER_H - 4, W, 4);
  }
  ctx.restore();
}

export const HEADER_FONTS = {
  retro: '"Caprasimo", Georgia, serif',
  bubble: '"Titan One", "Arial Black", sans-serif',
  script: '"Pacifico", cursive',
  round: '700 {s}px "Fredoka", sans-serif',
};
function headerFont(key, size) {
  const f = HEADER_FONTS[key] || HEADER_FONTS.retro;
  return f.includes('{s}') ? f.replace('{s}', size) : `${size}px ${f}`;
}

// Pecah judul jadi max 2 baris biar muat.
function fitLines(ctx, text, fontKey, maxW, maxSize, minSize, maxH, lhMul) {
  const words = text.split(/\s+/).filter(Boolean);
  for (let fs = maxSize; fs >= minSize; fs -= 4) {
    ctx.font = headerFont(fontKey, fs);
    if (ctx.measureText(text).width <= maxW && fs * lhMul <= maxH) return { lines: [text], fs };
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
      if (fs <= maxSize * 0.8 && 2 * fs * lhMul <= maxH && ctx.measureText(a).width <= maxW && ctx.measureText(b).width <= maxW) return { lines: [a, b], fs };
    }
  }
  ctx.font = headerFont(fontKey, minSize);
  return { lines: [text], fs: minSize };
}

function drawHeaderText(ctx, pack) {
  const W = BOARD_W;
  const left = pack.align === 'left';
  const x = left ? 64 : W / 2;
  const handle = (pack.handle || '').trim();
  const sub = (pack.subtitle || '').trim();
  const top = handle ? 124 : 70;
  const bottom = sub ? 226 : 278;
  const maxW = left ? W * 0.66 : W - 140;
  const lhMul = pack.font === 'script' ? 1.15 : 1.0;
  const { lines, fs } = fitLines(ctx, pack.title || '', pack.font, maxW, 118, 36, bottom - top, lhMul);
  ctx.textAlign = left ? 'left' : 'center';
  ctx.textBaseline = 'alphabetic';
  const lh = fs * lhMul;
  const blockH = lh * lines.length;
  let y = top + (bottom - top - blockH) / 2 + fs * 0.78;
  for (const line of lines) {
    ctx.font = headerFont(pack.font, fs);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillText(line, x + 5, y + 5);
    ctx.fillStyle = pack.textColor;
    ctx.fillText(line, x, y);
    y += lh;
  }
  ctx.fillStyle = pack.textColor;
  if (handle) {
    ctx.font = '700 30px "Fredoka", system-ui, sans-serif';
    ctx.fillText(handle, x, 104);
  }
  if (sub) {
    ctx.font = '800 30px "Bricolage Grotesque", system-ui, sans-serif';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '7px';
    ctx.fillText(sub.toUpperCase(), x, 262);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
}

/** Lubang gantungan di atas pack. */
export function cutHole(ctx, pack) {
  if (!pack.enabled || !pack.hole) return;
  const w = 150, h = 38, x = (BOARD_W - w) / 2, y = 42;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.14)';
  ctx.lineWidth = 3;
  roundRect(ctx, x - 1.5, y - 1.5, w + 3, h + 3, h / 2 + 1.5);
  ctx.stroke();
  ctx.restore();
}

/** Kilau plastik (sama persis dengan CSS .sheen: linear-gradient 115deg). */
export function drawSheen(ctx, pack) {
  if (!pack.enabled || !pack.sheen) return;
  const W = BOARD_W, H = BOARD_H;
  const a = (115 * Math.PI) / 180;
  const vx = Math.sin(a), vy = -Math.cos(a);
  const L = Math.abs(W * vx) + Math.abs(H * vy);
  const g = ctx.createLinearGradient(W / 2 - (vx * L) / 2, H / 2 - (vy * L) / 2, W / 2 + (vx * L) / 2, H / 2 + (vy * L) / 2);
  const stops = [
    [0, 0], [0.2, 0], [0.32, 0.3], [0.42, 0], [0.6, 0], [0.68, 0.2], [0.76, 0], [1, 0],
  ];
  stops.forEach(([o, al]) => g.addColorStop(o, `rgba(255,255,255,${al})`));
  ctx.save();
  roundRect(ctx, 0, 0, W, H, CARD_R);
  ctx.clip();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function drawStickerOn(ctx, img, st, shadowScale, extras = []) {
  const w = st.width;
  const h = (st.width * st.imgH) / st.imgW;
  ctx.save();
  ctx.translate(st.x, st.y);
  ctx.rotate((st.rot * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = 8 * shadowScale;
  ctx.shadowOffsetY = 3 * shadowScale;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  // baju yang dipakai stiker orang
  ctx.shadowBlur = 4 * shadowScale;
  ctx.shadowOffsetY = 1.5 * shadowScale;
  for (const ex of extras) {
    ctx.drawImage(ex.img, -w / 2 + ex.rect.left * w, -h / 2 + ex.rect.top * h, ex.rect.width * w, ex.rect.height * h);
  }
  ctx.restore();
}

/** Render satu set penuh jadi PNG (2000 x 2666 px). */
export async function exportSet({ stickers, bg, pack, scale = 2 }) {
  await ensureFonts();
  const images = await loadBaseImages(bg, pack);
  const c = makeCanvas(BOARD_W * scale, BOARD_H * scale);
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  ctx.imageSmoothingQuality = 'high';
  drawBase(ctx, { bg, pack, images });

  ctx.save();
  if (pack.enabled) {
    roundRect(ctx, 0, 0, BOARD_W, BOARD_H, CARD_R);
    ctx.clip();
  } else {
    ctx.beginPath();
    ctx.rect(0, 0, BOARD_W, BOARD_H);
    ctx.clip();
  }
  const placed = stickers.filter((s) => s.placed).sort((a, b) => a.z - b.z);
  const byId = new Map(stickers.map((s) => [s.id, s]));
  const imgs = await Promise.all(placed.map((s) => loadImage(s.url)));
  for (let i = 0; i < placed.length; i++) {
    const worn = wornList(placed[i], byId);
    const extras = await Promise.all(worn.map(async (w) => ({ rect: w.rect, img: await loadImage(w.item.url) })));
    drawStickerOn(ctx, imgs[i], placed[i], scale, extras);
  }
  ctx.restore();

  drawSheen(ctx, pack);
  cutHole(ctx, pack);
  return canvasToBlob(c);
}
