// Stiker "kartu" (photocard): kotak bulat dengan motif latar, foto berbingkai, tulisan & hiasan.
import { makeCanvas, renderSticker, loadImage } from './sticker.js';
import { ensureFonts } from './exporter.js';

export const CARD_COLORS = [
  // [nama, warna utama, warna muda, teks bawaan]
  ['pink', '#f59ac2', '#fde3ee', '#d6246e'],
  ['biru', '#8fbfee', '#e3f0fd', '#1f4fa8'],
  ['kuning', '#f9dd57', '#fff8d1', '#c0392b'],
  ['hijau', '#9fd67e', '#eaf8df', '#2e7d32'],
  ['lavender', '#c3adf3', '#efe8ff', '#6a3fc7'],
  ['merah', '#c8102e', '#e8475e', '#ffffff'],
  ['royal', '#2343d6', '#5574f2', '#ffffff'],
  ['gelap', '#1b1840', '#3a3566', '#ffd6ea'],
];

export const CARD_FONTS = {
  script: { label: 'Script', css: 'Pacifico', font: (s) => `${s}px "Pacifico", cursive`, lh: 1.3 },
  bubble: { label: 'Bubble', css: 'Titan One', font: (s) => `${s}px "Titan One", "Arial Black", sans-serif`, lh: 1.05 },
  round: { label: 'Bulat', css: 'Fredoka', font: (s) => `700 ${s}px "Fredoka", sans-serif`, lh: 1.1 },
  serif: { label: 'Elegan', css: 'Georgia', font: (s) => `italic ${s}px "Caprasimo", Georgia, serif`, lh: 1.1 },
  ketik: { label: 'Ketik', css: 'Courier New', font: (s) => `700 ${s}px "Courier New", monospace`, lh: 1.15 },
};

const SIZES = { square: [640, 640], portrait: [540, 720], landscape: [720, 540], banner: [720, 250] };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function framePath(ctx, shape, x, y, w, h) {
  ctx.beginPath();
  if (shape === 'oval') {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else if (shape === 'arch') {
    const r = Math.min(w / 2, h);
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.arc(x + w / 2, y + r, w / 2, Math.PI, 0);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  } else if (shape === 'heart') {
    const cx = x + w / 2;
    ctx.moveTo(cx, y + h);
    ctx.bezierCurveTo(x - w * 0.05, y + h * 0.55, x, y + h * 0.05, cx - w * 0.22, y + h * 0.02);
    ctx.bezierCurveTo(cx - w * 0.08, y, cx, y + h * 0.12, cx, y + h * 0.2);
    ctx.bezierCurveTo(cx, y + h * 0.12, cx + w * 0.08, y, cx + w * 0.22, y + h * 0.02);
    ctx.bezierCurveTo(x + w, y + h * 0.05, x + w * 1.05, y + h * 0.55, cx, y + h);
    ctx.closePath();
  } else {
    const r = Math.min(w, h) * 0.1;
    roundRect(ctx, x, y, w, h, r);
  }
}

function drawPattern(ctx, W, H, pattern, main, light) {
  if (pattern === 'solid') {
    ctx.fillStyle = main;
    ctx.fillRect(0, 0, W, H);
  } else if (pattern === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, light);
    g.addColorStop(1, main);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (pattern === 'gingham') {
    ctx.fillStyle = '#fffdfb';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = main;
    const c = 30;
    for (let x = 0; x < W; x += c * 2) ctx.fillRect(x, 0, c, H);
    for (let y = 0; y < H; y += c * 2) ctx.fillRect(0, y, W, c);
    ctx.globalAlpha = 1;
  } else if (pattern === 'stripes') {
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = main;
    for (let x = 0; x < W; x += 52) ctx.fillRect(x, 0, 26, H);
  } else if (pattern === 'dots') {
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = main;
    for (let y = 16, row = 0; y < H + 20; y += 30, row++)
      for (let x = row % 2 ? 31 : 16; x < W + 20; x += 30) {
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
  }
}

function star(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}
function heart(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.9);
  ctx.bezierCurveTo(cx - r * 1.3, cy, cx - r * 0.8, cy - r * 1.1, cx, cy - r * 0.4);
  ctx.bezierCurveTo(cx + r * 0.8, cy - r * 1.1, cx + r * 1.3, cy, cx, cy + r * 0.9);
  ctx.closePath();
}
function sparkle(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + r * 0.15, cy - r * 0.15, cx + r, cy);
  ctx.quadraticCurveTo(cx + r * 0.15, cy + r * 0.15, cx, cy + r);
  ctx.quadraticCurveTo(cx - r * 0.15, cy + r * 0.15, cx - r, cy);
  ctx.quadraticCurveTo(cx - r * 0.15, cy - r * 0.15, cx, cy - r);
  ctx.closePath();
}

function drawDeco(ctx, W, H, deco) {
  if (deco === 'none') return;
  const spots = [
    [0.09, 0.1, 1], [0.91, 0.14, 0.75], [0.88, 0.88, 1.1], [0.1, 0.86, 0.7],
  ];
  const base = Math.min(W, H) * 0.06;
  const fills = { stars: ['#ffd60a', '#ff4fa3', '#2fbf71', '#2343d6'], hearts: ['#ff3d6e', '#ff8fc6', '#e0102e', '#ffb3d4'], sparkle: ['#ffffff', '#ffe066', '#ffffff', '#ffd1e8'] };
  spots.forEach(([fx, fy, s], i) => {
    const r = base * s;
    const cx = fx * W, cy = fy * H;
    if (deco === 'stars') star(ctx, cx, cy, r);
    else if (deco === 'hearts') heart(ctx, cx, cy, r);
    else sparkle(ctx, cx, cy, r * 1.2);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, r * 0.22);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = fills[deco][i];
    ctx.fill();
  });
}

function fitText(ctx, lines, fontKey, maxW, maxH) {
  const f = CARD_FONTS[fontKey] || CARD_FONTS.script;
  for (let s = 120; s >= 16; s -= 2) {
    ctx.font = f.font(s);
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (w <= maxW && lines.length * s * f.lh <= maxH) return { size: s, lh: s * f.lh, font: f };
  }
  ctx.font = f.font(16);
  return { size: 16, lh: 16 * f.lh, font: f };
}

function drawText(ctx, text, opts, area) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 4);
  if (!lines.length) return;
  const { size, lh, font } = fitText(ctx, lines, opts.font, area.w, area.h);
  ctx.font = font.font(size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const total = lh * lines.length;
  let y = area.y + area.h / 2 - total / 2 + lh / 2;
  for (const l of lines) {
    const x = area.x + area.w / 2;
    if (opts.textOutline) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(4, size * 0.16);
      ctx.strokeText(l, x, y);
    }
    ctx.fillStyle = opts.textColor;
    ctx.fillText(l, x, y);
    y += lh;
  }
}

/**
 * opts: { size, pattern, color, frame, text, font, textColor, textPos, deco, innerLine }
 * photo: { img, isCut } atau null
 */
export async function renderCard(opts, photo) {
  await ensureFonts();
  const [W, H] = SIZES[opts.size] || SIZES.square;
  const [, main, light] = CARD_COLORS.find((c) => c[0] === opts.color) || CARD_COLORS[0];
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const R = Math.min(W, H) * 0.07;

  ctx.save();
  roundRect(ctx, 0, 0, W, H, R);
  ctx.clip();
  drawPattern(ctx, W, H, opts.pattern, main, light);

  const pad = Math.min(W, H) * 0.08;
  const text = (opts.text || '').trim();
  let photoRect = null;
  let textRect = null;

  if (opts.size === 'banner') {
    if (photo) {
      const s = H - pad * 2;
      photoRect = { x: pad, y: pad, w: s, h: s };
      textRect = { x: pad * 2 + s, y: pad, w: W - s - pad * 3, h: H - pad * 2 };
    } else textRect = { x: pad * 1.4, y: pad, w: W - pad * 2.8, h: H - pad * 2 };
  } else if (!photo) {
    textRect = { x: pad * 1.2, y: pad * 1.2, w: W - pad * 2.4, h: H - pad * 2.4 };
  } else {
    const tH = text ? H * (opts.textPos === 'overlay' ? 0.3 : 0.24) : 0;
    const inner = { x: pad, y: pad, w: W - pad * 2, h: H - pad * 2 };
    if (!text || opts.textPos === 'overlay') {
      photoRect = inner;
      if (text) textRect = { x: pad * 1.5, y: H - pad - tH, w: W - pad * 3, h: tH - pad * 0.3 };
    } else if (opts.textPos === 'top') {
      textRect = { x: pad, y: pad * 0.8, w: W - pad * 2, h: tH };
      photoRect = { x: pad, y: pad + tH, w: W - pad * 2, h: H - pad * 2 - tH };
    } else {
      photoRect = { x: pad, y: pad, w: W - pad * 2, h: H - pad * 2 - tH };
      textRect = { x: pad, y: H - pad * 0.8 - tH, w: W - pad * 2, h: tH };
    }
  }

  if (photo && photoRect) {
    const { x, y, w, h } = photoRect;
    if (photo.isCut) {
      // orang hasil potong AI langsung di atas motif, pakai pinggiran putih
      const st = renderSticker(photo.img, 10, '#ffffff');
      const im = await loadImage(st.url);
      const s = Math.min(w / im.width, h / im.height);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.22)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      ctx.drawImage(im, x + (w - im.width * s) / 2, y + h - im.height * s, im.width * s, im.height * s);
      ctx.restore();
    } else {
      const img = photo.img;
      // bingkai putih + bayangan
      ctx.save();
      framePath(ctx, opts.frame, x, y, w, h);
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.restore();
      const b = Math.min(w, h) * 0.035;
      ctx.save();
      framePath(ctx, opts.frame, x + b, y + b, w - b * 2, h - b * 2);
      ctx.clip();
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const s = Math.max((w - b * 2) / iw, (h - b * 2) / ih);
      ctx.drawImage(img, x + w / 2 - (iw * s) / 2, y + h / 2 - (ih * s) / 2, iw * s, ih * s);
      ctx.restore();
    }
  }

  if (text && textRect) drawText(ctx, text, { ...opts, textOutline: opts.textPos === 'overlay' || opts.textOutline }, textRect);
  drawDeco(ctx, W, H, opts.deco);

  if (opts.innerLine) {
    ctx.save();
    ctx.setLineDash([14, 10]);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    roundRect(ctx, pad * 0.45, pad * 0.45, W - pad * 0.9, H - pad * 0.9, R * 0.7);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  return c;
}
