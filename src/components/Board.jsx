import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import StickerOnBoard from './StickerOnBoard.jsx';
import { BOARD_W, BOARD_H, drawBase, cutHole, ensureFonts, loadBaseImages } from '../lib/exporter.js';
import { isClothing, wornList } from '../lib/dressup.js';

export default function Board({ stickers, bg, pack, selectedId, onSelect, onUpdate, onBringFront, onPeeled, onWear, onUndress }) {
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

  const startDrag = (e, id, base) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const st = base || stickers.find((s) => s.id === id);
    const clothing = isClothing(st.kind);
    onSelect(id);
    onBringFront(id);
    const rect = boardRef.current.getBoundingClientRect();
    const scale = BOARD_W / rect.width;
    const sx = e.clientX, sy = e.clientY;
    let moved = !!base;
    if (base) setDragId(id);
    let target = null;
    const move = (ev) => {
      const dx = (ev.clientX - sx) * scale;
      const dy = (ev.clientY - sy) * scale;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      if (!moved) setDragId(id);
      moved = true;
      onUpdate(id, {
        x: Math.max(0, Math.min(BOARD_W, st.x + dx)),
        y: Math.max(0, Math.min(BOARD_H, st.y + dy)),
      });
      if (clothing) {
        target = dollAt((ev.clientX - rect.left) * scale, (ev.clientY - rect.top) * scale, id);
        setDropId(target ? target.doll.id : null);
      }
    };
    const up = () => {
      setDragId(null);
      setDropId(null);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (moved && clothing && target) onWear(target.doll.id, id, target.fx, target.fy);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
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
    const r = boardRef.current.getBoundingClientRect();
    const scale = BOARD_W / r.width;
    const cx = r.left + st.x / scale;
    const cy = r.top + st.y / scale;
    const a0 = Math.atan2(e.clientY - cy, e.clientX - cx);
    const d0 = Math.hypot(e.clientX - cx, e.clientY - cy) || 1;
    setDragId(st.id);
    const move = (ev) => {
      const a = Math.atan2(ev.clientY - cy, ev.clientX - cx);
      const d = Math.hypot(ev.clientX - cx, ev.clientY - cy);
      let rot = st.rot + ((a - a0) * 180) / Math.PI;
      rot = ((rot + 540) % 360) - 180;
      if (ev.shiftKey) rot = Math.round(rot / 15) * 15;
      onUpdate(st.id, { rot, width: Math.max(50, Math.min(1400, (st.width * d) / d0)) });
    };
    const up = () => {
      setDragId(null);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const placed = stickers.filter((s) => s.placed);
  const byId = new Map(stickers.map((s) => [s.id, s]));
  const sel = placed.find((s) => s.id === selectedId);
  const selH = sel ? (sel.width * sel.imgH) / sel.imgW : 0;

  return (
    <div className="board-wrap">
      <div
        ref={boardRef}
        className={`board ${pack.enabled ? 'is-pack' : ''} ${bg.type === 'none' ? 'is-transparent' : ''}`}
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
              dropTarget={dropId === st.id}
              worn={wornList(st, byId)}
              onWornDown={startUndress}
              onPointerDown={startDrag}
              onPeeled={onPeeled}
            />
          ))}
        </div>
        {pack.enabled && pack.sheen && <div className="sheen" />}
        {placed.length === 0 && (
          <div className="board-empty">
            <p className="board-empty-big">Kertasnya masih kosong!</p>
            <p>Pencet <b>Scan</b> buat foto barang, AI bakal motongin jadi stiker.</p>
          </div>
        )}
      </div>

      {sel && !sel.peelNonce && (
        <div className="sel-layer">
          <div
            className="sel-frame"
            style={{
              left: `${((sel.x - sel.width / 2) / BOARD_W) * 100}%`,
              top: `${((sel.y - selH / 2) / BOARD_H) * 100}%`,
              width: `${(sel.width / BOARD_W) * 100}%`,
              height: `${(selH / BOARD_H) * 100}%`,
              transform: `rotate(${sel.rot}deg)`,
            }}
          >
            <button
              type="button"
              className="sel-handle"
              title="Geser buat putar & ubah ukuran (Shift = putar per 15°)"
              aria-label="Putar dan ubah ukuran"
              onPointerDown={(e) => startTransform(e, sel)}
            >
              ↻
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
