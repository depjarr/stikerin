import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import StickerOnBoard, { GLIDE } from './StickerOnBoard.jsx';
import { BOARD_W, BOARD_H, drawBase, cutHole, ensureFonts, loadBaseImages } from '../lib/exporter.js';
import { isClothing, wornList } from '../lib/dressup.js';

function MenuIcon({ name }) {
  const p = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (name === 'peel') return <svg {...p}><path d="M4 4h16v9l-7 7H4z" /><path d="M20 13h-7v7" /></svg>;
  if (name === 'dup') return <svg {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></svg>;
  if (name === 'front') return <svg {...p}><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></svg>;
  if (name === 'send') return <svg {...p}><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>;
  return <svg {...p}><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></svg>;
}

export default function Board({ stickers, bg, pack, selectedId, onSelect, onUpdate, onBringFront, onPeeled, onWear, onUndress, actions, glideKey = 0 }) {
  const boardRef = useRef(null);
  const baseRef = useRef(null);
  const [px, setPx] = useState(0);
  const [dragId, setDragId] = useState(null);
  const [dropId, setDropId] = useState(null);

  useLayoutEffect(() => {
    const el = boardRef.current;
    const ro = new ResizeObserver(() => setPx(el.offsetWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Gambar latar + header ke canvas (pakai fungsi yang sama dengan export → hasil download = yang dilihat)
  useEffect(() => {
    let alive = true;
    (async () => {
      await ensureFonts();
      const images = await loadBaseImages(bg, pack).catch(() => ({}));
      const c = baseRef.current;
      if (!alive || !c || !px) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(px * dpr);
      c.height = Math.round(((px * BOARD_H) / BOARD_W) * dpr);
      const ctx = c.getContext('2d');
      ctx.setTransform(c.width / BOARD_W, 0, 0, c.height / BOARD_H, 0, 0);
      ctx.clearRect(0, 0, BOARD_W, BOARD_H);
      drawBase(ctx, { bg, pack, images });
      cutHole(ctx, pack);
    })();
    return () => {
      alive = false;
    };
  }, [bg, pack, px]);

  const k = () => BOARD_W / boardRef.current.getBoundingClientRect().width;

  // Cari stiker orang di bawah titik (koordinat kertas). Balikin {doll, fx, fy} atau null.
  const dollAt = (bx, by, exceptId) => {
    const dolls = stickers.filter((d) => d.placed && d.kind === 'doll' && d.anchors && d.id !== exceptId).sort((a, b) => b.z - a.z);
    for (const d of dolls) {
      const h = (d.width * d.imgH) / d.imgW;
      const rad = (-d.rot * Math.PI) / 180;
      const dx = bx - d.x, dy = by - d.y;
      const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
      const fx = lx / d.width + 0.5, fy = ly / h + 0.5;
      if (fx > 0.05 && fx < 0.95 && fy > 0 && fy < 1) return { doll: d, fx, fy };
    }
    return null;
  };

  // Satu gestur aktif: geser pakai 1 jari/mouse, cubit (2 jari) buat zoom + putar.
  const g = useRef(null);
  const [mode, setMode] = useState(null); // 'drag' | 'pinch' | 'turn' | null
  // stiker yang lagi meluncur halus: 'all' (habis undo/redo) atau Set id (habis dilempar)
  const [glide, setGlide] = useState(null);
  const glideTimer = useRef(0);
  const startGlide = (v, ms = 700) => {
    clearTimeout(glideTimer.current);
    setGlide(v);
    glideTimer.current = setTimeout(() => setGlide(null), ms);
  };
  // undo/redo: nyalain glide di render yang SAMA dengan posisi barunya (kalau lewat effect, stikernya udah keburu loncat)
  const [seenKey, setSeenKey] = useState(glideKey);
  if (glideKey !== seenKey) {
    setSeenKey(glideKey);
    setGlide('all');
  }
  useEffect(() => {
    if (glide !== 'all') return;
    const t = setTimeout(() => setGlide((v) => (v === 'all' ? null : v)), 700);
    return () => clearTimeout(t);
  }, [glide, seenKey]);
  useEffect(() => () => clearTimeout(glideTimer.current), []);

  const clampW = (w) => Math.max(50, Math.min(1400, w));
  // nempel ke 0/90/180 kalau udah deket, biar gampang lurus
  const snapRot = (r, hard) => {
    r = ((r + 540) % 360) - 180;
    if (hard) return Math.round(r / 15) * 15;
    const n = Math.round(r / 90) * 90;
    return Math.abs(r - n) < 4 ? n : r;
  };

  const apply = (patch) => {
    Object.assign(g.current.cur, patch);
    onUpdate(g.current.id, patch);
  };

  const pinchBase = () => {
    const G = g.current;
    const [a, b] = [...G.pts.values()];
    G.base = { ...G.cur, d0: Math.hypot(b.x - a.x, b.y - a.y) || 1, a0: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  };
  const dragBase = () => {
    const G = g.current;
    const [p] = [...G.pts.values()];
    G.base = { ...G.cur, sx: p.x, sy: p.y };
  };

  const onMove = (ev) => {
    const G = g.current;
    if (!G || !G.pts.has(ev.pointerId)) return;
    G.pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    // jejak 100ms terakhir buat ngitung kecepatan lempar
    const now = performance.now();
    (G.trail ||= []).push({ x: ev.clientX, y: ev.clientY, t: now });
    while (G.trail.length > 2 && now - G.trail[0].t > 100) G.trail.shift();
    const B = G.base;
    if (G.mode === 'pinch' && G.pts.size >= 2) {
      const [a, b] = [...G.pts.values()];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      apply({
        width: clampW((B.width * d) / B.d0),
        rot: snapRot(B.rot + ((ang - B.a0) * 180) / Math.PI),
        x: Math.max(0, Math.min(BOARD_W, B.x + (mx - B.mx) * G.scale)),
        y: Math.max(0, Math.min(BOARD_H, B.y + (my - B.my) * G.scale)),
      });
      return;
    }
    if (G.mode === 'turn') {
      const p = G.pts.get(ev.pointerId);
      const a = Math.atan2(p.y - G.cy, p.x - G.cx);
      const d = Math.hypot(p.x - G.cx, p.y - G.cy);
      apply({ rot: snapRot(B.rot + ((a - B.a0) * 180) / Math.PI, ev.shiftKey), width: clampW((B.width * d) / B.d0) });
      return;
    }
    // geser
    const dx = (ev.clientX - B.sx) * G.scale;
    const dy = (ev.clientY - B.sy) * G.scale;
    if (!G.moved && Math.hypot(dx, dy) < 4) return;
    if (!G.moved) {
      G.moved = true;
      setDragId(G.id);
      setMode('drag');
    }
    apply({ x: Math.max(0, Math.min(BOARD_W, B.x + dx)), y: Math.max(0, Math.min(BOARD_H, B.y + dy)) });
    if (G.clothing) {
      G.target = dollAt((ev.clientX - G.rect.left) * G.scale, (ev.clientY - G.rect.top) * G.scale, G.id);
      setDropId(G.target ? G.target.doll.id : null);
    }
  };

  const endGesture = () => {
    const G = g.current;
    g.current = null;
    window.removeEventListener('pointermove', moveProxy);
    window.removeEventListener('pointerup', upProxy);
    window.removeEventListener('pointercancel', upProxy);
    setDragId(null);
    setDropId(null);
    setMode(null);
    return G;
  };

  const onUp = (ev) => {
    const G = g.current;
    if (!G || !G.pts.has(ev.pointerId)) return;
    G.pts.delete(ev.pointerId);
    if (G.pts.size === 1 && G.mode === 'pinch') {
      // 1 jari diangkat → lanjut geser pakai jari yang tersisa, tanpa loncat
      G.mode = 'drag';
      G.moved = true;
      G.clothing = false;
      setMode('drag');
      dragBase();
      return;
    }
    if (G.pts.size > 0) return;
    const done = endGesture();
    if (ev.type === 'pointerup' && done.mode === 'drag' && done.moved && done.clothing && done.target) {
      onWear(done.target.doll.id, done.id, done.target.fx, done.target.fy);
      return;
    }
    // dilempar -> meluncur dikit terus berhenti
    if (ev.type === 'pointerup' && done.mode === 'drag' && done.moved && done.trail?.length > 1) {
      const a = done.trail[0], b = done.trail[done.trail.length - 1];
      const dt = Math.max(16, b.t - a.t);
      if (performance.now() - b.t < 80) {
        const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt; // px layar per ms
        const speed = Math.hypot(vx, vy);
        if (speed > 0.45) {
          const k = Math.min(260, speed * 180) / speed; // jarak luncur dibatasi
          const tx = Math.max(0, Math.min(BOARD_W, done.cur.x + vx * k * done.scale));
          const ty = Math.max(0, Math.min(BOARD_H, done.cur.y + vy * k * done.scale));
          startGlide(new Set([done.id]), 800);
          onUpdate(done.id, { x: tx, y: ty });
        }
      }
    }
  };

  // handler window harus referensi yang sama pas dilepas
  const onMoveRef = useRef(null);
  const onUpRef = useRef(null);
  const moveProxy = useRef((ev) => onMoveRef.current?.(ev)).current;
  const upProxy = useRef((ev) => onUpRef.current?.(ev)).current;
  onMoveRef.current = onMove;
  onUpRef.current = onUp;

  const listen = () => {
    window.addEventListener('pointermove', moveProxy);
    window.addEventListener('pointerup', upProxy);
    window.addEventListener('pointercancel', upProxy);
  };
  useEffect(() => () => {
    window.removeEventListener('pointermove', moveProxy);
    window.removeEventListener('pointerup', upProxy);
    window.removeEventListener('pointercancel', upProxy);
  }, [moveProxy, upProxy]);

  // jari kedua nyentuh kertas (di mana aja) pas lagi megang stiker → mode cubit
  const addFinger = (e) => {
    const G = g.current;
    if (!G || e.pointerType !== 'touch' || G.pts.size !== 1 || G.mode === 'turn') return false;
    e.preventDefault();
    e.stopPropagation();
    G.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    G.mode = 'pinch';
    G.target = null;
    setDropId(null);
    setDragId(G.id);
    setMode('pinch');
    pinchBase();
    return true;
  };

  const startDrag = (e, id, base) => {
    if (g.current) {
      addFinger(e);
      return;
    }
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const st = base || stickers.find((s) => s.id === id);
    onSelect(id);
    onBringFront(id);
    const rect = boardRef.current.getBoundingClientRect();
    g.current = {
      id,
      mode: 'drag',
      rect,
      scale: BOARD_W / rect.width,
      pts: new Map([[e.pointerId, { x: e.clientX, y: e.clientY }]]),
      cur: { x: st.x, y: st.y, width: st.width, rot: st.rot },
      clothing: isClothing(st.kind),
      moved: !!base,
      target: null,
    };
    dragBase();
    if (base) {
      setDragId(id);
      setMode('drag');
    }
    listen();
  };

  // Tarik baju dari badan orang = lepas baju, langsung kebawa jari/mouse
  const startUndress = (e, doll, slot, item) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = boardRef.current.getBoundingClientRect();
    const scale = BOARD_W / rect.width;
    const x = (e.clientX - rect.left) * scale, y = (e.clientY - rect.top) * scale;
    onUndress(doll.id, slot, { x, y, rot: doll.rot });
    startDrag(e, item.id, { ...item, x, y });
  };

  // Handle pojok kanan-atas: putar + ubah ukuran sekaligus
  const startTransform = (e, st) => {
    e.preventDefault();
    e.stopPropagation();
    if (g.current) return;
    const r = boardRef.current.getBoundingClientRect();
    const scale = BOARD_W / r.width;
    const cx = r.left + st.x / scale;
    const cy = r.top + st.y / scale;
    g.current = {
      id: st.id,
      mode: 'turn',
      rect: r,
      scale,
      cx,
      cy,
      pts: new Map([[e.pointerId, { x: e.clientX, y: e.clientY }]]),
      cur: { x: st.x, y: st.y, width: st.width, rot: st.rot },
      moved: true,
    };
    g.current.base = {
      ...g.current.cur,
      a0: Math.atan2(e.clientY - cy, e.clientX - cx),
      d0: Math.hypot(e.clientX - cx, e.clientY - cy) || 1,
    };
    setDragId(st.id);
    setMode('turn');
    listen();
  };

  const placed = stickers.filter((s) => s.placed);
  const byId = new Map(stickers.map((s) => [s.id, s]));
  const sel = placed.find((s) => s.id === selectedId);
  const selH = sel ? (sel.width * sel.imgH) / sel.imgW : 0;
  const gliding = glide === 'all' || !!(sel && glide && glide.has?.(sel.id));

  // stiker yang ditempel barengan (contoh / satu set) muncul satu-satu
  const enterDelay = new Map();
  {
    const now = Date.now();
    const fresh = placed.filter((s) => now - (s.placedAt || 0) < 1500).sort((a, b) => a.placedAt - b.placedAt);
    let prev = -Infinity, n = 0;
    for (const s of fresh) {
      n = s.placedAt - prev < 400 ? n + 1 : 0;
      prev = s.placedAt;
      enterDelay.set(s.id, Math.min(n, 10) * 0.07);
    }
  }

  let menu = null;
  if (sel && !sel.peelNonce && !dragId && !gliding && actions) {
    // menu cepat di atas stiker (pindah ke bawah kalau mepet atas)
    const reach = Math.max(sel.width, selH) * 0.58;
    const above = sel.y - reach > BOARD_H * 0.07;
    const top = ((above ? sel.y - reach : sel.y + reach) / BOARD_H) * 100;
    // kertas lebar: ikon + tulisan; kertas sempit: ikon + tulisan kecil di bawahnya
    const wide = px >= 380;
    const menuW = wide ? 340 : 5 * 44 + 10;
    const half = px ? Math.min(50, ((menuW / 2 + 4) / px) * 100) : 30;
    const left = Math.min(100 - half, Math.max(half, (sel.x / BOARD_W) * 100));
    const items = [
      ['Cabut', 'peel', () => actions.onPeel(sel.id)],
      ['Duplikat', 'dup', () => actions.onDuplicate(sel.id)],
      ['Ke depan', 'front', () => actions.onFront(sel.id)],
      ['Kirim', 'send', () => actions.onShare(sel.id)],
      ['Hapus', 'del', () => actions.onDelete(sel.id)],
    ];
    menu = (
      <div key={sel.id} className={`sel-menu-pos ${above ? 'above' : 'below'}`} style={{ left: `${left}%`, top: `${top}%` }}>
        <motion.div
          className={`sel-menu ${wide ? 'is-wide' : 'is-compact'}`}
          role="toolbar"
          aria-label="Aksi stiker"
          style={{ transformOrigin: above ? '50% 100%' : '50% 0%' }}
          initial={{ opacity: 0, scale: 0.55, y: above ? 14 : -14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: above ? 6 : -6, transition: { duration: 0.12 } }}
          transition={{ type: 'spring', stiffness: 520, damping: 24 }}
        >
          {items.map(([label, icon, fn], i) => (
            <motion.button
              key={icon}
              type="button"
              className={icon === 'del' ? 'danger' : ''}
              title={label}
              onClick={fn}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 + i * 0.03, duration: 0.16 }}
              whileTap={{ scale: 0.88 }}
            >
              <MenuIcon name={icon} />
              <span>{label}</span>
            </motion.button>
          ))}
        </motion.div>
      </div>
    );
  }

  const selBox = sel && {
    left: `${((sel.x - sel.width / 2) / BOARD_W) * 100}%`,
    top: `${((sel.y - selH / 2) / BOARD_H) * 100}%`,
    width: `${(sel.width / BOARD_W) * 100}%`,
    height: `${(selH / BOARD_H) * 100}%`,
    rotate: sel.rot,
  };

  return (
    <div className="board-wrap">
      <div
        ref={boardRef}
        className={`board ${pack.enabled ? 'is-pack' : ''} ${bg.type === 'none' ? 'is-transparent' : ''}`}
        onPointerDownCapture={(e) => {
          if (g.current) addFinger(e);
        }}
        onPointerDown={(e) => {
          if (!e.target.closest('.sticker')) onSelect(null);
        }}
      >
        <canvas ref={baseRef} className="board-base" />
        <div className="sticker-layer">
          {placed.map((st) => (
            <StickerOnBoard
              key={st.id + ':' + st.placedAt}
              st={st}
              selected={st.id === selectedId}
              dragging={dragId === st.id}
              lifted={dragId === st.id && mode === 'drag'}
              glide={glide === 'all' || !!glide?.has?.(st.id)}
              enterDelay={enterDelay.get(st.id) || 0}
              dropTarget={dropId === st.id}
              worn={wornList(st, byId)}
              onWornDown={startUndress}
              onPointerDown={startDrag}
              onPeeled={onPeeled}
            />
          ))}
        </div>
        {pack.enabled && pack.sheen && <div className="sheen" />}
        <AnimatePresence>
          {placed.length === 0 && (
            <motion.div
              key="empty"
              className="board-empty-pos"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 380, damping: 20 }}
            >
              <div className="board-empty">
                <p className="board-empty-big">Kertasnya masih kosong!</p>
                <p>Pencet <b>Scan</b> buat foto barang, AI bakal motongin jadi stiker.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="sel-layer">
        <AnimatePresence>
          {sel && !sel.peelNonce && (
            <motion.div
              key={'f' + sel.id}
              className="sel-frame"
              initial={{ ...selBox, opacity: 0 }}
              animate={{ ...selBox, opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={gliding ? { ...GLIDE, opacity: { duration: 0.12 } } : { duration: 0, opacity: { duration: 0.12 } }}
            >
              <motion.button
                type="button"
                className="sel-handle"
                title="Geser buat putar & ubah ukuran (Shift = putar per 15°)"
                aria-label="Putar dan ubah ukuran"
                onPointerDown={(e) => startTransform(e, sel)}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 600, damping: 18, delay: 0.05 }}
              >
                ↻
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>{menu}</AnimatePresence>
      </div>
    </div>
  );
}
