import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import Board from './components/Board.jsx';
import BlindBag from './components/BlindBag.jsx';
import Home from './components/Home.jsx';
import CameraScanner from './components/CameraScanner.jsx';
import ShareSheet from './components/ShareSheet.jsx';
import { ScanButton, PhotoStrip, RetroPhone, StickyNote, Postcard, BottomSheet } from './components/Panels.jsx';
import { Tape, DeskDoodles } from './components/Deco.jsx';
import Icon from './components/Icons.jsx';
import { fileToCutout, aiCutout, renderSticker, dataURLToBlob, toWhatsAppSticker, canvasToBlob } from './lib/sticker.js';
import { saveDoc, loadDoc, blobToCanvas } from './lib/persist.js';
import { renderPrintPage, printPages } from './lib/printSheet.js';
import { buildWaPack } from './lib/waPack.js';
import { generateCloud, tryOnCloud } from './lib/cloud.js';
import { textToCutout } from './lib/textSticker.js';
import { BOARD_W, BOARD_H, HEADER_H, exportSet } from './lib/exporter.js';
import { downloadBlob } from './lib/share.js';
import { makeSamples } from './lib/samples.js';
import useLayoutMode from './lib/useLayoutMode.js';
import { detectAnchors, putOn, slotFromDrop, isClothing, SLOT_LABEL } from './lib/dressup.js';

const uid = () => Math.random().toString(36).slice(2, 10);
const BASE_SIZE = 280; // sisi terpanjang stiker baru (satuan kertas)

const bodyTop = (pack) => (pack.enabled ? HEADER_H + 30 : 30);
const initialWidth = (r, base = BASE_SIZE) => (r.imgW >= r.imgH ? base : (base * r.imgW) / r.imgH);

function randomSpot(pack, width, height) {
  const top = bodyTop(pack);
  const x = width / 2 + 30 + Math.random() * Math.max(1, BOARD_W - width - 60);
  const y = top + height / 2 + Math.random() * Math.max(1, BOARD_H - top - height - 30);
  return { x, y, rot: Math.round(Math.random() * 16 - 8) };
}

function headerSpot(pack, width) {
  const right = pack.align === 'left';
  return {
    x: right ? BOARD_W - width / 2 - 50 : 120 + Math.random() * (BOARD_W - 240),
    y: HEADER_H / 2 + 10,
    rot: Math.round(Math.random() * 10 - 5),
  };
}

// Susun rapi: rak per baris, dikecilin kalau ga muat.
function arrange(stickers, pack) {
  const placed = stickers.filter((s) => s.placed && s.y > (pack.enabled ? HEADER_H : 0));
  if (!placed.length) return stickers;
  const top = bodyTop(pack);
  const availH = BOARD_H - top - 30;
  const gap = 26;
  let f = 1;
  let layout;
  for (let tries = 0; tries < 30; tries++) {
    layout = new Map();
    let x = 40, y = top, rowH = 0;
    const items = [...placed].sort((a, b) => (b.width * b.imgH) / b.imgW - (a.width * a.imgH) / a.imgW);
    for (const s of items) {
      const w = s.width * f;
      const h = (w * s.imgH) / s.imgW;
      if (x + w > BOARD_W - 40 && x > 40) {
        x = 40;
        y += rowH + gap;
        rowH = 0;
      }
      layout.set(s.id, { x: x + w / 2, y: y + h / 2, width: w, rot: 0 });
      x += w + gap;
      rowH = Math.max(rowH, h);
    }
    if (y + rowH <= top + availH) break;
    f *= 0.9;
  }
  return stickers.map((s) => (layout.has(s.id) ? { ...s, ...layout.get(s.id) } : s));
}

// barang-barang di meja muncul berurutan
const DESK = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.08 } } };
const POP = {
  hidden: { opacity: 0, y: 36, rotate: -2.5, scale: 0.96 },
  show: { opacity: 1, y: 0, rotate: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 20 } },
};
const DROP = {
  hidden: { opacity: 0, y: -50, rotate: 2 },
  show: { opacity: 1, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 300, damping: 17 } },
};

export default function App() {
  const mode = useLayoutMode();
  const [screen, setScreen] = useState('home');
  const [bagOpen, setBagOpen] = useState(false);
  const [bagLogo, setBagLogo] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [sheet, setSheet] = useState(null); // HP: 'tambah' | 'gaya' | 'atur' | 'kirim'
  const [pcTab, setPcTab] = useState('bg');
  const [stickers, setStickers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [defaults, setDefaults] = useState({ useAI: true, shape: 'rounded', outline: 14, outlineColor: '#ffffff' });
  const [bg, setBg] = useState({ type: 'stripes', color: '#fde4ef', color2: '#fff7fb', image: null });
  const [pack, setPack] = useState({
    enabled: true,
    type: 'plain',
    title: 'Hello its free sticker!',
    handle: '@stikerin',
    subtitle: '',
    font: 'bubble',
    align: 'left',
    color: '#ff4fa3',
    textColor: '#ffffff',
    pattern: 'stars',
    patternColor: '#ff8cc6',
    image: null,
    hole: true,
    sheen: true,
  });
  const [share, setShare] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const [exporting, setExporting] = useState(false);
  const cutouts = useRef(new Map());
  const cutoutBlobs = useRef(new Map()); // buat disimpen ke IndexedDB
  const [loaded, setLoaded] = useState(false);
  const [saveTick, setSaveTick] = useState(0);
  const [savedAt, setSavedAt] = useState(0);
  const zTop = useRef(1);
  const packRef = useRef(pack);
  packRef.current = pack;

  const toast = useCallback((m) => setToastMsg(m), []);
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(''), 4200);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const update = useCallback((id, patch) => setStickers((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s))), []);

  const setCutout = (id, cut, blob) => {
    cutouts.current.set(id, cut);
    if (blob) {
      cutoutBlobs.current.set(id, blob);
      return;
    }
    canvasToBlob(cut, 'image/png')
      .then((b) => {
        cutoutBlobs.current.set(id, b);
        setSaveTick((t) => t + 1);
      })
      .catch(() => {});
  };

  /* ---------- simpan otomatis (IndexedDB) ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const doc = await loadDoc();
      if (alive && doc?.stickers?.length) {
        for (const [id, blob] of doc.cutouts || []) {
          try {
            setCutout(id, await blobToCanvas(blob), blob);
          } catch {
            /* lewati cutout yang rusak */
          }
        }
        zTop.current = Math.max(1, ...doc.stickers.map((s) => s.z || 1));
        setStickers(doc.stickers.map((s) => ({ ...s, peelNonce: 0 })));
        if (doc.bg) setBg(doc.bg);
        if (doc.pack) setPack(doc.pack);
        if (doc.defaults) setDefaults(doc.defaults);
        hist.current = { past: [], future: [], last: null, timer: 0, skip: false };
      }
      if (alive) setLoaded(true);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(async () => {
      const ids = new Set(stickers.map((s) => s.id));
      const cut = [...cutoutBlobs.current].filter(([id]) => ids.has(id));
      if (await saveDoc({ v: 1, stickers, bg, pack, defaults, cutouts: cut, savedAt: Date.now() })) setSavedAt(Date.now());
    }, 800);
    return () => clearTimeout(t);
  }, [stickers, bg, pack, defaults, loaded, saveTick]);

  /* ---------- undo / redo ---------- */
  const hist = useRef({ past: [], future: [], last: null, timer: 0, skip: false });
  const [, setHistTick] = useState(0);
  const [glideKey, setGlideKey] = useState(0); // naik tiap undo/redo → stiker meluncur ke posisi lama
  useEffect(() => {
    const h = hist.current;
    const cur = { stickers, bg, pack };
    if (h.skip) {
      h.skip = false;
      h.last = cur;
      return;
    }
    if (!h.last) {
      h.last = cur;
      return;
    }
    clearTimeout(h.timer);
    // digabung per 400 ms, jadi satu kali geser = satu langkah undo
    h.timer = setTimeout(() => {
      if (h.last.stickers === cur.stickers && h.last.bg === cur.bg && h.last.pack === cur.pack) return;
      h.past.push(h.last);
      if (h.past.length > 60) h.past.shift();
      h.future = [];
      h.last = cur;
      setHistTick((t) => t + 1);
    }, 400);
  }, [stickers, bg, pack]);

  const flushHistory = () => {
    const h = hist.current;
    clearTimeout(h.timer);
    const cur = { stickers, bg, pack };
    if (h.last && (h.last.stickers !== cur.stickers || h.last.bg !== cur.bg || h.last.pack !== cur.pack)) {
      h.past.push(h.last);
      h.future = [];
      h.last = cur;
    }
  };
  const restore = (doc) => {
    hist.current.skip = true;
    setStickers(doc.stickers.map((s) => (s.peelNonce ? { ...s, peelNonce: 0 } : s)));
    setBg(doc.bg);
    setPack(doc.pack);
    setGlideKey((k) => k + 1);
    setHistTick((t) => t + 1);
  };
  const undo = () => {
    flushHistory();
    const h = hist.current;
    if (!h.past.length) return;
    const prev = h.past.pop();
    h.future.push(h.last);
    h.last = prev;
    restore(prev);
  };
  const redo = () => {
    const h = hist.current;
    clearTimeout(h.timer);
    if (!h.future.length) return;
    const next = h.future.pop();
    h.past.push(h.last);
    h.last = next;
    restore(next);
  };
  const canUndo = hist.current.past.length > 0 || (hist.current.last && hist.current.last.stickers !== stickers);
  const canRedo = hist.current.future.length > 0;

  const addSticker = (name, cut, outline, outlineColor, { where = 'body', base, kind = 'sticker' } = {}) => {
    const p = packRef.current;
    const r = renderSticker(cut, outline, outlineColor);
    const id = uid();
    setCutout(id, cut);
    let width = initialWidth(r, base);
    const h = (width * r.imgH) / r.imgW;
    if (where === 'header' && h > HEADER_H * 0.8) width *= (HEADER_H * 0.8) / h;
    const spot = where === 'header' && p.enabled ? headerSpot(p, width) : randomSpot(p, width, (width * r.imgH) / r.imgW);
    const st = { id, name, ...r, outline, outlineColor, width, ...spot, placed: true, placedAt: Date.now(), z: ++zTop.current, peelNonce: 0, kind, outfit: kind === 'doll' ? {} : undefined };
    setStickers((ss) => [...ss, st]);
    return id;
  };

  const onFiles = async (files, { kind = 'sticker' } = {}) => {
    const opts = { ...defaults, ...(kind !== 'sticker' ? { useAI: true } : {}) };
    for (const file of files) {
      const jobId = uid();
      setJobs((j) => [...j, { id: jobId, name: file.name, status: 'Baca foto…', pct: 0 }]);
      const setJob = (patch) => setJobs((j) => j.map((x) => (x.id === jobId ? { ...x, ...patch } : x)));
      try {
        const cut = await fileToCutout(file, { useAI: opts.useAI, shape: opts.shape, onProgress: (status, pct) => setJob({ status, pct }) });
        const base = kind === 'doll' ? 560 : isClothing(kind) ? 240 : undefined;
        if (kind === 'doll') setJob({ status: 'AI baca posisi badan…', pct: 1 });
        const anchors = kind === 'doll' ? await detectAnchors(cut) : null;
        const id = addSticker(file.name.replace(/\.[^.]+$/, ''), cut, opts.outline, opts.outlineColor, { base, kind });
        if (anchors) {
          update(id, { anchors });
          if (anchors.source !== 'ai') toast('Pose ga kebaca jelas, baju bakal dipasang pakai perkiraan badan');
        }
        setSelectedId(id);
        setJobs((j) => j.filter((x) => x.id !== jobId));
      } catch (e) {
        console.error(e);
        setJob({ status: `Gagal: ${e.message || 'error'}`, error: true });
        setTimeout(() => setJobs((j) => j.filter((x) => x.id !== jobId)), 6000);
      }
    }
  };

  const loadSamples = async () => {
    const samples = await makeSamples();
    samples.forEach((s) => addSticker(s.name, s.cut, defaults.outline, defaults.outlineColor));
  };

  const addText = async ({ text, style, fill, stroke, where }) => {
    const cut = await textToCutout(text, style, fill, stroke);
    const id = addSticker(text.replace(/\n/g, ' ').slice(0, 20), cut, 10, '#ffffff', { where, base: where === 'header' ? 200 : 300 });
    setSelectedId(id);
    toast(where === 'header' ? 'Teks ditempel di header ✦' : 'Stiker teks jadi ✦');
    if (mode === 'phone') setSheet(null);
  };

  /* ---------- paper doll ---------- */
  const releaseSpot = (doll, s, i = 0) => {
    const h = (s.width * s.imgH) / s.imgW;
    const right = doll.x + doll.width / 2 + s.width / 2 + 20 < BOARD_W;
    return {
      x: Math.max(s.width / 2, Math.min(BOARD_W - s.width / 2, right ? doll.x + doll.width / 2 + s.width / 2 + 10 : doll.x - doll.width / 2 - s.width / 2 - 10)),
      y: Math.max(h / 2, Math.min(BOARD_H - h / 2, doll.y - 120 + i * 90)),
    };
  };

  const onWear = (dollId, itemId, fx, fy) => {
    const doll = stickers.find((s) => s.id === dollId);
    const item = stickers.find((s) => s.id === itemId);
    if (!doll || !item) return;
    const slot = slotFromDrop(doll, item, fx, fy);
    const { outfit, released } = putOn(doll.outfit, slot, itemId);
    setStickers((ss) =>
      ss.map((s) => {
        if (s.id === dollId) return { ...s, outfit };
        if (s.id === itemId) return { ...s, placed: false, wornBy: dollId, peelNonce: 0 };
        const ri = released.indexOf(s.id);
        if (ri >= 0) return { ...s, wornBy: null, placed: true, placedAt: Date.now(), z: ++zTop.current, rot: doll.rot, ...releaseSpot(doll, s, ri) };
        return s;
      })
    );
    setSelectedId(dollId);
    toast(`${doll.name || 'Dia'} sekarang pake ${SLOT_LABEL[slot]} ini ✦`);
  };

  const onUndress = (dollId, slot, at) => {
    const doll = stickers.find((s) => s.id === dollId);
    const itemId = doll?.outfit?.[slot];
    if (!itemId) return;
    const outfit = { ...doll.outfit };
    delete outfit[slot];
    setStickers((ss) =>
      ss.map((s) => (s.id === dollId ? { ...s, outfit } : s.id === itemId ? { ...s, wornBy: null, placed: true, placedAt: Date.now(), z: ++zTop.current, peelNonce: 0, x: at.x, y: at.y, rot: at.rot } : s))
    );
  };

  const takeOff = (dollId, slot) => {
    const doll = stickers.find((s) => s.id === dollId);
    const item = stickers.find((s) => s.id === doll?.outfit?.[slot]);
    if (!item) return;
    onUndress(dollId, slot, { ...releaseSpot(doll, item), rot: doll.rot });
  };

  const setKind = async (id, kind) => {
    const s = stickers.find((x) => x.id === id);
    if (!s || s.kind === kind) return;
    if (s.kind === 'doll' && kind !== 'doll') {
      const ids = Object.values(s.outfit || {});
      setStickers((ss) =>
        ss.map((x) => {
          const i = ids.indexOf(x.id);
          return i >= 0 ? { ...x, wornBy: null, placed: true, placedAt: Date.now(), z: ++zTop.current, rot: s.rot, ...releaseSpot(s, x, i) } : x;
        })
      );
    }
    if (s.wornBy && !isClothing(kind)) {
      const doll = stickers.find((d) => d.id === s.wornBy);
      const slot = Object.keys(doll?.outfit || {}).find((k) => doll.outfit[k] === id);
      if (slot) takeOff(doll.id, slot);
    }
    update(id, { kind, outfit: kind === 'doll' ? s.outfit || {} : undefined });
    if (kind === 'doll' && !s.anchors) {
      toast('AI lagi baca posisi badan…');
      const anchors = await detectAnchors(cutouts.current.get(id));
      update(id, { anchors });
      toast(anchors.source === 'ai' ? 'Pose kebaca! Seret baju ke orangnya ✦' : 'Pose ga jelas, pakai perkiraan badan');
    }
  };

  /* ---------- Gemini: prompt → stiker & try-on realistis ---------- */
  const generateFromPrompt = async ({ prompt, style, onStage }) => {
    onStage?.('AI lagi ngegambar…');
    const img = await generateCloud(prompt, style);
    onStage?.('Motong pinggiran stiker…');
    const cut = await aiCutout(img);
    const id = addSticker(prompt.slice(0, 20), cut, defaults.outline, defaults.outlineColor);
    setSelectedId(id);
    toast('Stiker dari prompt jadi ✦');
    if (mode === 'phone') setSheet(null);
  };

  const makeRealistic = async (dollId) => {
    const doll = stickers.find((s) => s.id === dollId);
    const person = cutouts.current.get(dollId);
    const garments = Object.entries(doll?.outfit || {})
      .map(([slot, id]) => ({ slot, canvas: cutouts.current.get(id) }))
      .filter((g) => g.canvas);
    if (!person || !garments.length) throw new Error('Pakaikan minimal 1 baju dulu');
    const img = await tryOnCloud(person, garments);
    const cut = await aiCutout(img);
    const r = renderSticker(cut, doll.outline, doll.outlineColor);
    const id = addSticker(`${doll.name || 'orang'} (realistis)`, cut, doll.outline, doll.outlineColor, { base: 560 });
    const width = (doll.width / doll.imgW) * r.imgW * (doll.imgH / r.imgH);
    const x = doll.x + doll.width / 2 + width / 2 + 16 < BOARD_W ? doll.x + doll.width / 2 + width / 2 + 16 : Math.max(width / 2, doll.x - doll.width / 2 - width / 2 - 16);
    update(id, { x, y: doll.y, rot: 0, width });
    setSelectedId(id);
    toast('Versi realistis jadi ✦');
  };

  const addCard = ({ canvas, name, where, size }) => {
    const base = size === 'banner' ? 360 : 300;
    const id = addSticker(name, canvas, 6, '#ffffff', { where, base });
    setSelectedId(id);
    toast('Kartu ditempel ✦');
    if (mode === 'phone') setSheet(null);
  };

  const regenOutline = (id, outline, outlineColor) => {
    const cut = cutouts.current.get(id);
    if (!cut) return;
    const r = renderSticker(cut, outline, outlineColor);
    setStickers((ss) => ss.map((s) => (s.id === id ? { ...s, ...r, outline, outlineColor, width: (s.width / s.imgW) * r.imgW } : s)));
  };

  const applyAll = (outline, outlineColor) => {
    stickers.forEach((s) => regenOutline(s.id, outline, outlineColor));
    setDefaults((d) => ({ ...d, outline, outlineColor }));
    toast('Pinggiran semua stiker udah disamain ✦');
  };

  const bringFront = (id) => update(id, { z: ++zTop.current });
  const layer = (id, dir) => {
    if (dir > 0) return bringFront(id);
    update(id, { z: Math.min(...stickers.map((s) => s.z)) - 1 });
  };

  const toHeader = (id) => {
    const s = stickers.find((x) => x.id === id);
    const h = (s.width * s.imgH) / s.imgW;
    const width = h > HEADER_H * 0.8 ? (s.width * HEADER_H * 0.8) / h : s.width;
    update(id, { width, ...headerSpot(pack, width), z: ++zTop.current });
  };

  const peel = (id) => {
    update(id, { peelNonce: Date.now() });
    if (mode === 'phone') setSheet(null);
  };
  const onPeeled = useCallback((id) => {
    setStickers((ss) => ss.map((s) => (s.id === id ? { ...s, placed: false, peelNonce: 0 } : s)));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const place = (id) => {
    const s = stickers.find((x) => x.id === id);
    const h = (s.width * s.imgH) / s.imgW;
    update(id, { placed: true, placedAt: Date.now(), z: ++zTop.current, peelNonce: 0, ...randomSpot(pack, s.width, h) });
    setSelectedId(id);
  };

  const duplicate = (id) => {
    const s = stickers.find((x) => x.id === id);
    const nid = uid();
    setCutout(nid, cutouts.current.get(id), cutoutBlobs.current.get(id));
    setStickers((ss) => [...ss, { ...s, id: nid, x: s.x + 40, y: s.y + 40, z: ++zTop.current, placedAt: Date.now(), peelNonce: 0, outfit: s.kind === 'doll' ? {} : undefined, wornBy: null }]);
    setSelectedId(nid);
  };

  const remove = (id) => {
    const s = stickers.find((x) => x.id === id);
    setStickers((ss) =>
      ss
        .filter((x) => x.id !== id)
        .map((x) => {
          if (s?.kind === 'doll' && x.wornBy === id) return { ...x, wornBy: null };
          if (x.kind === 'doll' && x.outfit && Object.values(x.outfit).includes(id)) {
            const outfit = { ...x.outfit };
            Object.keys(outfit).forEach((k) => outfit[k] === id && delete outfit[k]);
            return { ...x, outfit };
          }
          return x;
        })
    );
    if (selectedId === id) setSelectedId(null); // cutout ga dihapus biar bisa di-undo
  };

  const shareSticker = async (id) => {
    const s = stickers.find((x) => x.id === id);
    const slug = (s.name || 'stiker').replace(/[^\w-]+/g, '-').slice(0, 30);
    setShare({
      title: s.name || 'Stiker',
      blob: await dataURLToBlob(s.url),
      filename: `stiker-${slug}.png`,
      extra: [{ label: 'Stiker WhatsApp (WebP 512)', share: true, make: async () => ({ blob: await toWhatsAppSticker(s.url), filename: `stiker-wa-${slug}.webp` }) }],
    });
  };

  const exportBlob = async () => {
    setExporting(true);
    try {
      return await exportSet({ stickers, bg, pack });
    } finally {
      setExporting(false);
    }
  };
  const download = async () => downloadBlob(await exportBlob(), pack.enabled ? 'sticker-pack.png' : 'sticker-sheet.png');
  const shareSet = async () => setShare({ title: pack.enabled ? pack.title || 'Sticker pack' : 'Lembar stiker', blob: await exportBlob(), filename: 'sticker-pack.png' });

  const printA4 = async () => {
    const win = window.open('', '_blank'); // dibuka pas klik biar ga diblok
    setExporting(true);
    try {
      // satu lembar penuh: header + latar + semua stiker di kertas + garis potong
      const page = await renderPrintPage({ stickers, bg, pack });
      if (win) printPages(win, [page]);
      else {
        downloadBlob(await canvasToBlob(page), 'stiker-a4.png');
        toast('Popup diblok browser, jadi lembar A4-nya didownload');
      }
    } finally {
      setExporting(false);
    }
  };

  const waPack = async () => {
    setExporting(true);
    try {
      const { blob, count, filename } = await buildWaPack(stickers);
      downloadBlob(blob, filename);
      toast(`Paket ${count} stiker WhatsApp didownload. Caranya ada di CARA-PAKAI.txt`);
    } catch (e) {
      toast(e.message || 'Gagal bikin paket');
    } finally {
      setExporting(false);
    }
  };

  const clearBoard = () => {
    setStickers([]);
    setSelectedId(null);
    toast('Kertas dikosongin. Pencet ↶ buat balikin');
  };

  // Keyboard: Ctrl+Z / Ctrl+Shift+Z = undo/redo, Delete = cabut, panah = geser
  useEffect(() => {
    if (screen !== 'studio') return;
    const onKey = (e) => {
      if (share || scanOpen || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'y')) {
        e.preventDefault();
        if (k === 'y' || e.shiftKey) redo();
        else undo();
        return;
      }
      if (!selectedId) return;
      const s = stickers.find((x) => x.id === selectedId);
      if (!s || !s.placed) return;
      const step = e.shiftKey ? 20 : 4;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        peel(selectedId);
      } else if (moves[e.key]) {
        e.preventDefault();
        update(selectedId, { x: s.x + moves[e.key][0], y: s.y + moves[e.key][1] });
      } else if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const closeScan = useCallback(() => setScanOpen(false), []);
  const selected = stickers.find((s) => s.id === selectedId && s.placed);
  const placedCount = stickers.filter((s) => s.placed).length;

  const closeBag = useCallback(() => setBagOpen(false), []);
  const scanner = scanOpen && <CameraScanner onClose={closeScan} onFiles={onFiles} jobs={jobs} defaults={defaults} setDefaults={setDefaults} />;
  const overlays = (
    <>
      {scanner}
      {bagOpen && (
        <BlindBag stickers={stickers} logo={bagLogo} setLogo={setBagLogo} defaults={defaults} toast={toast} onClose={closeBag} />
      )}
      {share && <ShareSheet item={share} onClose={() => setShare(null)} toast={toast} />}
      <div className={`toast ${toastMsg ? 'show' : ''}`} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </>
  );

  // pindah layar: halaman awal memudar dulu, baru meja studio muncul (barang-barangnya nyusul satu-satu)
  const shell = (child) => (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false}>
        {child}
      </AnimatePresence>
    </MotionConfig>
  );

  if (screen === 'home') {
    return shell(
      <motion.div key="home" className="screen-home" exit={{ opacity: 0, transition: { duration: 0.22 } }}>
        <Home
          hasWork={stickers.length > 0}
          count={stickers.length}
          onStart={() => {
            setScreen('studio');
            setScanOpen(true);
          }}
          onDemo={() => {
            setScreen('studio');
            if (!stickers.length) loadSamples();
          }}
          onContinue={() => setScreen('studio')}
        />
        {overlays}
      </motion.div>
    );
  }

  /* ---------- panel-panel studio (meja loker) ---------- */
  const closeSheetOnPhone = () => mode === 'phone' && setSheet(null);
  const closeSheet = () => setSheet(null);
  const strip = (
    <PhotoStrip
      horizontal={mode !== 'desk'}
      stickers={stickers}
      jobs={jobs}
      selectedId={selectedId}
      onPlace={place}
      onSelect={setSelectedId}
      onShare={shareSticker}
      onDelete={remove}
      onArrange={() => setStickers((ss) => arrange(ss, pack))}
    />
  );
  const postcard = (
    <Postcard
      tab={pcTab}
      setTab={setPcTab}
      bg={bg}
      setBg={setBg}
      pack={pack}
      setPack={setPack}
      onAddText={addText}
      onUploadKind={(files, kind) => {
        onFiles(files, { kind });
        closeSheetOnPhone();
      }}
      onAddCard={addCard}
      onGenerate={generateFromPrompt}
      jobs={jobs}
    />
  );
  const note = (
    <StickyNote
      st={selected}
      defaults={defaults}
      setDefaults={setDefaults}
      onUpdate={update}
      onOutline={regenOutline}
      onApplyAll={applyAll}
      onPeel={peel}
      onDuplicate={duplicate}
      onLayer={layer}
      onToHeader={toHeader}
      packOn={pack.enabled}
      onKind={setKind}
      onTakeOff={takeOff}
      onRealistic={makeRealistic}
      stickers={stickers}
    />
  );
  const phone = (
    <RetroPhone
      selected={selected}
      placedCount={placedCount}
      total={stickers.length}
      exporting={exporting}
      onShareSticker={shareSticker}
      onShareSet={shareSet}
      onDownload={download}
      onPrint={printA4}
      onWaPack={waPack}
      onBag={() => {
        setBagOpen(true);
        closeSheetOnPhone();
      }}
      onClear={() => {
        clearBoard();
        closeSheetOnPhone();
      }}
    />
  );
  const boardActions = {
    onPeel: peel,
    onDuplicate: duplicate,
    onFront: bringFront,
    onShare: shareSticker,
    onDelete: remove,
  };

  return shell(
    <motion.div
      key="studio"
      className={`studio mode-${mode}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.25 }}
    >
      <motion.header
        className="studio-top"
        initial={{ y: -70, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      >
        <button type="button" className="logo" onClick={() => setScreen('home')} aria-label="Ke halaman awal">
          <span className="logo-word">Stikerin</span>
        </button>
        {mode === 'desk' && <span className="top-slogan">foto, tempel, kirim!</span>}
        <div className="top-undo">
          <button type="button" onClick={undo} disabled={!canUndo} aria-label="Batalkan (Ctrl+Z)" title="Batalkan (Ctrl+Z)">
            <Icon name="undo" size={19} strokeWidth={2.4} />
          </button>
          <button type="button" onClick={redo} disabled={!canRedo} aria-label="Ulangi (Ctrl+Shift+Z)" title="Ulangi (Ctrl+Shift+Z)">
            <Icon name="redo" size={19} strokeWidth={2.4} />
          </button>
          <small className="top-saved">{savedAt ? 'tersimpan ✓' : ''}</small>
        </div>
        <nav className="top-nav">
          <button type="button" className="nav-pill blue" onClick={() => setScanOpen(true)}>
            <Icon name="camera" size={17} strokeWidth={2.2} /> <span>Scan</span>
          </button>
          <button type="button" className="nav-pill orange" onClick={shareSet} disabled={!placedCount || exporting}>
            <Icon name="share" size={17} strokeWidth={2.2} /> <span>Kirim set</span>
          </button>
          <button type="button" className="nav-pill pink" onClick={download} disabled={exporting}>
            <Icon name="download" size={17} strokeWidth={2.2} /> <span>{exporting ? 'Nyiapin…' : 'Simpan'}</span>
          </button>
        </nav>
      </motion.header>

      <motion.div className="desk" initial="hidden" animate="show" variants={DESK}>
        <DeskDoodles />
        {mode !== 'phone' && (
          <motion.div className="area-tools" variants={POP}>
            <ScanButton onScan={() => setScanOpen(true)} jobs={jobs} />
            {postcard}
          </motion.div>
        )}
        <motion.div className="area-strip" variants={POP}>{strip}</motion.div>
        <motion.div className="area-board" variants={DROP}>
          <div className="board-holder">
            <Tape className="bt1" />
            <Tape className="bt2" />
            <Board
              stickers={stickers}
              bg={bg}
              pack={pack}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onUpdate={update}
              onBringFront={bringFront}
              onPeeled={onPeeled}
              onWear={onWear}
              onUndress={onUndress}
              actions={boardActions}
              glideKey={glideKey}
            />
          </div>
          <p className="board-hint">ketuk stiker buat menu · tarik pojok yang kelipat buat nyabut · ↻ putar & ubah ukuran</p>
        </motion.div>
        {mode !== 'phone' && (
          <motion.div className="area-side" variants={POP}>
            {phone}
            {note}
          </motion.div>
        )}
      </motion.div>

      {mode === 'phone' && (
        <>
          <nav className="dock" aria-label="Alat">
            <button type="button" onClick={() => setSheet('gaya')}>
              <Icon name="sliders" size={22} /> Gaya
            </button>
            <button type="button" onClick={() => setSheet('atur')} className={selected ? 'has' : ''}>
              <Icon name="peel" size={22} /> Atur
            </button>
            <button type="button" className="dock-scan" onClick={() => setScanOpen(true)} aria-label="Scan foto">
              <Icon name="camera" size={30} strokeWidth={2.2} />
            </button>
            <button type="button" onClick={() => setSheet('kirim')}>
              <Icon name="share" size={22} /> Kirim
            </button>
            <button type="button" onClick={download} disabled={exporting}>
              <Icon name="download" size={22} /> Simpan
            </button>
          </nav>
          <AnimatePresence>
            {sheet === 'gaya' && <BottomSheet key="gaya" title="Gaya kertas" onClose={closeSheet}>{postcard}</BottomSheet>}
            {sheet === 'atur' && <BottomSheet key="atur" title="Atur stiker" onClose={closeSheet}>{note}</BottomSheet>}
            {sheet === 'kirim' && <BottomSheet key="kirim" title="Kirim" onClose={closeSheet}>{phone}</BottomSheet>}
          </AnimatePresence>
        </>
      )}
      {overlays}
    </motion.div>
  );
}
