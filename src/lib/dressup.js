// Paper doll: stiker "orang" bisa dipakaikan stiker baju.
// Posisi badan dibaca pakai MediaPipe Pose (jalan lokal di browser).
import { makeCanvas } from './sticker.js';

const MP_VERSION = '1.2.3';
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

export const KINDS = {
  sticker: 'Stiker biasa',
  doll: 'Orang',
  auto: 'Baju (otomatis)',
  top: 'Atasan',
  bottom: 'Bawahan',
  dress: 'Dress',
  outer: 'Outer',
  shoes: 'Sepatu',
  hat: 'Topi',
};
export const SLOT_LABEL = { top: 'atasan', bottom: 'bawahan', dress: 'dress', outer: 'outer', shoes: 'sepatu', hat: 'topi' };
// urutan gambar dari paling bawah ke paling atas
export const SLOT_ORDER = ['shoes', 'bottom', 'top', 'dress', 'outer', 'hat'];
export const isClothing = (kind) => !!kind && kind !== 'sticker' && kind !== 'doll';

let landmarkerP = null;
function getLandmarker() {
  if (!landmarkerP) {
    landmarkerP = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks(WASM);
      return PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
        runningMode: 'IMAGE',
        numPoses: 1,
      });
    })();
    landmarkerP.catch(() => {
      landmarkerP = null;
    });
  }
  return landmarkerP;
}

// Kalau AI ga nemu pose: pakai proporsi badan rata-rata.
function guessAnchors(cut) {
  const ctx = cut.getContext('2d');
  const { width: w, height: h } = cut;
  const d = ctx.getImageData(0, 0, w, h).data;
  const centerAt = (fy) => {
    const y = Math.min(h - 1, Math.round(fy * h));
    let sum = 0, n = 0;
    for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 60) { sum += x; n++; }
    return n ? sum / n / w : 0.5;
  };
  const c = (fy) => centerAt(fy);
  return {
    nose: [c(0.07), 0.07], earL: [c(0.07) + 0.06, 0.07], earR: [c(0.07) - 0.06, 0.07],
    shL: [c(0.2) + 0.17, 0.19], shR: [c(0.2) - 0.17, 0.19],
    hipL: [c(0.48) + 0.09, 0.48], hipR: [c(0.48) - 0.09, 0.48],
    kneeL: [c(0.7) + 0.08, 0.71], kneeR: [c(0.7) - 0.08, 0.71],
    ankL: [c(0.92) + 0.08, 0.93], ankR: [c(0.92) - 0.08, 0.93],
    source: 'guess',
  };
}

/** Baca titik badan dari cutout orang. Hasil dinormalisasi ke ukuran cutout (0..1). */
export async function detectAnchors(cut) {
  try {
    const lm = await getLandmarker();
    // AI lebih akurat kalau latarnya putih, bukan transparan
    const pad = Math.round(Math.max(cut.width, cut.height) * 0.08);
    const c = makeCanvas(cut.width + pad * 2, cut.height + pad * 2);
    const x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
    x.drawImage(cut, pad, pad);
    const res = lm.detect(c);
    const p = res?.landmarks?.[0];
    if (!p) return guessAnchors(cut);
    const at = (i) => [((p[i].x * c.width) - pad) / cut.width, ((p[i].y * c.height) - pad) / cut.height];
    const vis = (i) => (p[i].visibility ?? 1) > 0.35;
    const a = {
      nose: at(0), earL: at(7), earR: at(8),
      shL: at(11), shR: at(12), hipL: at(23), hipR: at(24),
      kneeL: at(25), kneeR: at(26), ankL: at(27), ankR: at(28),
      source: 'ai',
    };
    // foto setengah badan: perkirain lutut & kaki dari panjang badan
    const torso = (a.hipL[1] + a.hipR[1]) / 2 - (a.shL[1] + a.shR[1]) / 2;
    if (!vis(25) || !vis(26)) { a.kneeL = [a.hipL[0], a.hipL[1] + torso]; a.kneeR = [a.hipR[0], a.hipR[1] + torso]; }
    if (!vis(27) || !vis(28)) { a.ankL = [a.kneeL[0], a.kneeL[1] + torso]; a.ankR = [a.kneeR[0], a.kneeR[1] + torso]; }
    return a;
  } catch (e) {
    console.warn('Pose gagal, pakai perkiraan', e);
    return guessAnchors(cut);
  }
}

// Titik badan dalam piksel gambar stiker orang (sudah termasuk pinggiran).
function body(doll) {
  const pad = doll.pad || 0;
  const cw = doll.imgW - pad * 2, ch = doll.imgH - pad * 2;
  const P = (k) => ({ x: pad + doll.anchors[k][0] * cw, y: pad + doll.anchors[k][1] * ch });
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const shL = P('shL'), shR = P('shR'), hipL = P('hipL'), hipR = P('hipR');
  const kneeL = P('kneeL'), kneeR = P('kneeR'), ankL = P('ankL'), ankR = P('ankR');
  const earL = P('earL'), earR = P('earR'), nose = P('nose');
  const sh = mid(shL, shR), hip = mid(hipL, hipR), knee = mid(kneeL, kneeR), ank = mid(ankL, ankR);
  const shoulderW = Math.max(Math.abs(shL.x - shR.x), cw * 0.18);
  const hipW = Math.max(Math.abs(hipL.x - hipR.x), shoulderW * 0.55);
  const torso = Math.max(hip.y - sh.y, ch * 0.18);
  const headW = Math.max(Math.abs(earL.x - earR.x), shoulderW * 0.42);
  const ankleW = Math.abs(ankL.x - ankR.x);
  return { sh, hip, knee, ank, nose, shoulderW, hipW, torso, headW, ankleW };
}

/** Kotak baju di badan, dalam pecahan ukuran gambar orang (0..1). */
export function wearRect(doll, item, slot) {
  const b = body(doll);
  const r = item.imgH / item.imgW;
  let w, cx, y0;
  switch (slot) {
    case 'top': w = b.shoulderW * 2.05; cx = b.sh.x; y0 = b.sh.y - b.torso * 0.2; break;
    case 'outer': w = b.shoulderW * 2.3; cx = b.sh.x; y0 = b.sh.y - b.torso * 0.24; break;
    case 'dress': w = b.shoulderW * 2.1; cx = b.sh.x; y0 = b.sh.y - b.torso * 0.18; break;
    case 'bottom': w = Math.max(b.hipW * 2.5, b.shoulderW * 1.35); cx = b.hip.x; y0 = b.hip.y - b.torso * 0.2; break;
    case 'shoes': w = Math.max(b.ankleW * 2.1, b.shoulderW * 1.15); cx = b.ank.x; y0 = b.ank.y - w * r * 0.4; break;
    case 'hat': {
      w = b.headW * 2.4; cx = b.nose.x;
      const brow = b.nose.y - b.torso * 0.1;
      y0 = brow - w * r * 0.85;
      break;
    }
    default: return null;
  }
  const h = w * r;
  return { left: (cx - w / 2) / doll.imgW, top: y0 / doll.imgH, width: w / doll.imgW, height: h / doll.imgH };
}

/** Baju "otomatis": tentuin slot dari bagian badan tempat baju dilepas. fx/fy = 0..1 di stiker orang. */
export function slotFromDrop(doll, item, fx, fy) {
  if (isClothing(item.kind) && item.kind !== 'auto') return item.kind;
  const b = body(doll);
  const y = fy * doll.imgH;
  const tall = item.imgH / item.imgW > 1.35;
  if (y < b.sh.y - b.torso * 0.15) return 'hat';
  if (y < b.hip.y) return tall ? 'dress' : 'top';
  if (y < b.ank.y - b.torso * 0.3) return 'bottom';
  return 'shoes';
}

/** Pasang baju ke outfit; balikin outfit baru + baju yang kelepas. */
export function putOn(outfit, slot, itemId) {
  const next = { ...(outfit || {}) };
  const released = [];
  const drop = (s) => {
    if (next[s] && next[s] !== itemId) released.push(next[s]);
    delete next[s];
  };
  if (slot === 'dress') ['top', 'bottom', 'dress'].forEach(drop);
  else if (slot === 'top' || slot === 'bottom') {
    drop('dress');
    drop(slot);
  } else drop(slot);
  // kalau baju yang sama dipindah slot
  Object.keys(next).forEach((s) => next[s] === itemId && delete next[s]);
  next[slot] = itemId;
  return { outfit: next, released };
}

/** Daftar baju yang dipakai doll, urut gambar. */
export function wornList(doll, byId) {
  if (doll.kind !== 'doll' || !doll.anchors || !doll.outfit) return [];
  return SLOT_ORDER.filter((s) => doll.outfit[s] && byId.get(doll.outfit[s])).map((slot) => {
    const item = byId.get(doll.outfit[slot]);
    return { slot, item, rect: wearRect(doll, item, slot) };
  });
}
