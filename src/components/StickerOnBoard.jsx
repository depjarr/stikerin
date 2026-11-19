import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BOARD_W, BOARD_H } from '../lib/exporter.js';

/*
  Animasi peel = lipatan datar di sepanjang garis x + y = s (arah diagonal, dari pojok kanan-bawah).
  - Lapisan depan: bagian stiker yang masih nempel  (x + y <= s)
  - Lapisan belakang (flap): bagian yang udah kebuka, dicerminkan terhadap garis lipat,
    jadi kelihatan sisi belakang stiker (kertas putih).
  Pencerminan terhadap x + y = s:  (x, y) -> (s - y, s - x)  =>  matrix(0, -1, -1, 0, s, s)
*/

function clipHalf(W, H, s, keepBelow) {
  const pts = [[0, 0], [W, 0], [W, H], [0, H]];
  const inside = (p) => (keepBelow ? p[0] + p[1] <= s : p[0] + p[1] >= s);
  const cross = (a, b) => {
    const t = (s - (a[0] + a[1])) / (b[0] + b[1] - (a[0] + a[1]));
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  };
  const out = [];
  for (let i = 0; i < 4; i++) {
    const cur = pts[i];
    const prev = pts[(i + 3) % 4];
    const ci = inside(cur);
    const pi = inside(prev);
    if (ci) {
      if (!pi) out.push(cross(prev, cur));
      out.push(cur);
    } else if (pi) out.push(cross(prev, cur));
  }
  if (out.length < 3) return 'polygon(0 0, 0 0, 0 0)';
  return `polygon(${out.map((p) => `${p[0].toFixed(1)}px ${p[1].toFixed(1)}px`).join(', ')})`;
}

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export default function StickerOnBoard({ st, selected, dragging, dropTarget, worn = [], onWornDown, onPointerDown, onPeeled }) {
  const stageRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [s, setS] = useState(null); // posisi garis lipat; null = ga lagi dipeel
  const [hover, setHover] = useState(false);
  const [phase, setPhase] = useState('stick'); // stick -> idle -> peeling -> flying
  const raf = useRef(0);
  const sRef = useRef(null);
  const lastNonce = useRef(st.peelNonce);

  useLayoutEffect(() => {
    const el = stageRef.current;
    const ro = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setPhase((p) => (p === 'stick' ? 'idle' : p)), 450);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  const s0 = st.peel.sMax * size.w;
  const sEnd = st.peel.sMin * size.w - 2;

  const setFold = (v) => {
    sRef.current = v;
    setS(v);
  };

  const tween = (from, to, dur, done) => {
    cancelAnimationFrame(raf.current);
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      setFold(from + (to - from) * easeInOut(t));
      if (t < 1) raf.current = requestAnimationFrame(step);
      else done?.();
    };
    raf.current = requestAnimationFrame(step);
  };

  const finishPeel = (from) => {
    setPhase('peeling');
    tween(from, sEnd, Math.max(250, 700 * ((from - sEnd) / (s0 - sEnd || 1))), () => {
      setPhase('flying');
      setTimeout(() => onPeeled(st.id), 480);
    });
  };

  // Dipicu dari tombol "Cabut" / tombol Delete
  useEffect(() => {
    if (st.peelNonce && st.peelNonce !== lastNonce.current && size.w) {
      lastNonce.current = st.peelNonce;
      setPhase('peeling');
      tween(s0, s0 - 0.25 * (s0 - sEnd), 260, () => finishPeel(sRef.current));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.peelNonce, size.w]);

  // Tarik pojok stiker pakai mouse/jari
  const onCornerDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (phase === 'peeling' || phase === 'flying') return;
    setPhase('peeling');
    const sx = e.clientX, sy = e.clientY;
    const rad = (-st.rot * Math.PI) / 180;
    const startS = sRef.current ?? s0;
    const move = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
      setFold(Math.max(sEnd, Math.min(s0, startS + (lx + ly) / 2)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const cur = sRef.current ?? s0;
      if (s0 - cur > 0.4 * (s0 - sEnd)) finishPeel(cur);
      else
        tween(cur, s0, 220, () => {
          setFold(null);
          setPhase('idle');
        });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const curl = Math.min(26, size.w * 0.14);
  const fold = s ?? (hover && !dragging && phase === 'idle' ? s0 - curl : null);
  const W = size.w, H = size.h;

  const h = (st.width * st.imgH) / st.imgW;
  const style = {
    left: `${((st.x - st.width / 2) / BOARD_W) * 100}%`,
    top: `${((st.y - h / 2) / BOARD_H) * 100}%`,
    width: `${(st.width / BOARD_W) * 100}%`,
    height: `${(h / BOARD_H) * 100}%`,
    transform: `rotate(${st.rot}deg)`,
    zIndex: st.z,
  };

  return (
    <div
      className={`sticker phase-${phase} ${selected ? 'is-selected' : ''} ${dragging ? 'is-dragging' : ''} ${dropTarget ? 'is-drop' : ''} ${st.kind === 'doll' ? 'is-doll' : ''}`}
      style={style}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <div className="peel-stage" ref={stageRef}>
        <img
          className="sticker-front"
          src={st.url}
          alt={st.name}
          draggable={false}
          style={{ clipPath: fold != null ? clipHalf(W, H, fold, true) : undefined }}
          onPointerDown={(e) => onPointerDown(e, st.id)}
        />
        {worn.length > 0 && (
          <div className="worn-layer" style={{ clipPath: fold != null ? clipHalf(W, H, fold, true) : undefined }}>
            {worn.map((w) => (
              <img
                key={w.slot}
                className={`worn worn-${w.slot}`}
                src={w.item.url}
                alt={w.item.name}
                draggable={false}
                title="Tarik buat lepas"
                style={{ left: `${w.rect.left * 100}%`, top: `${w.rect.top * 100}%`, width: `${w.rect.width * 100}%`, height: `${w.rect.height * 100}%` }}
                onPointerDown={(e) => onWornDown(e, st, w.slot, w.item)}
              />
            ))}
          </div>
        )}
        {dropTarget && <span className="drop-hint">lepas buat dipakai ♡</span>}
        {fold != null && (
          <div className="flap-shadow">
            <img
              className="sticker-back"
              src={st.url}
              alt=""
              draggable={false}
              style={{
                transform: `matrix(0, -1, -1, 0, ${fold}, ${fold})`,
                clipPath: clipHalf(W, H, fold, false),
              }}
            />
          </div>
        )}
        {phase !== 'flying' && size.w > 0 && (
          <button
            type="button"
            className="peel-corner"
            title="Tarik pojok ini buat nyabut stiker"
            aria-label={`Cabut stiker ${st.name}`}
            style={{ left: st.peel.cx * size.w, top: st.peel.cy * size.w }}
            onPointerDown={onCornerDown}
          />
        )}
      </div>
    </div>
  );
}
