import React, { useEffect, useRef, useState } from 'react';
import { clipHalf, easeInOut } from './StickerOnBoard.jsx';

const LETTER_COLORS = ['#2346c8', '#ff4fa3', '#ffb800', '#2fae5b', '#8a5cf6'];
const tilt = (i) => [-8, 5, -3, 7, -6, 4, -2, 8, -5, 3][i % 10];

/** Judul dari huruf-huruf stiker yang "ditempel" satu per satu. */
export function StickerTitle({ lines, delay = 0 }) {
  let n = 0;
  return (
    <h1 className="st-title" aria-label={lines.join(' ')}>
      {lines.map((line, li) => (
        <span key={li} className={`st-line l${li}`} aria-hidden="true">
          {line.split(' ').map((word, wi) => (
            <span key={wi} className="st-word">
              {[...word].map((ch, i) => {
                const k = n++;
                return (
                  <span
                    key={i}
                    className="st-letter"
                    style={{ '--c': LETTER_COLORS[k % LETTER_COLORS.length], '--r': `${tilt(k)}deg`, '--d': `${delay + k * 0.06}s` }}
                  >
                    {ch}
                  </span>
                );
              })}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}

/** Badge bulat dengan tulisan melingkar yang muter pelan. */
export function SpinBadge({ text, className = '' }) {
  return (
    <div className={`spin-badge ${className}`} aria-label={text.replace(/✦/g, ',')}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <path id="badge-circle" d="M100 100m-72 0a72 72 0 1 1 144 0a72 72 0 1 1-144 0" />
        </defs>
        <circle cx="100" cy="100" r="96" fill="#ffd23f" stroke="#fff" strokeWidth="6" />
        <g className="spin-ring">
          <text fontFamily="Fredoka" fontWeight="700" fontSize="21" letterSpacing="3" fill="#2346c8">
            <textPath href="#badge-circle">{text}</textPath>
          </text>
        </g>
        <path d="M100 66l9 23 25 2-19 16 6 25-21-14-21 14 6-25-19-16 25-2z" fill="#ff4fa3" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** Stiker demo yang beneran bisa dicabut (tarik pojok atau klik). */
export function PeelDemo({ sticker }) {
  const stageRef = useRef(null);
  const raf = useRef(0);
  const sRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [s, setS] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | peeling | flying | gone
  const busy = phase !== 'idle';

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [sticker]);

  const s0 = sticker ? sticker.peel.sMax * size.w : 0;
  const sEnd = sticker ? sticker.peel.sMin * size.w - 2 : 0;

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

  // mancing: pojoknya kebuka dikit tiap beberapa detik
  useEffect(() => {
    if (phase !== 'idle' || !size.w) return;
    const id = setInterval(() => {
      if (sRef.current != null) return;
      const curl = Math.min(60, size.w * 0.18);
      tween(s0, s0 - curl, 450, () => setTimeout(() => tween(s0 - curl, s0, 380, () => setFold(null)), 350));
    }, 3400);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, size.w, s0]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const finish = (from) => {
    setPhase('peeling');
    tween(from, sEnd, Math.max(280, 750 * ((from - sEnd) / (s0 - sEnd || 1))), () => {
      setPhase('flying');
      setTimeout(() => {
        setPhase('gone');
        setFold(null);
        setTimeout(() => setPhase('idle'), 2600);
      }, 520);
    });
  };

  const onDown = (e) => {
    if (busy || !sticker) return;
    e.preventDefault();
    cancelAnimationFrame(raf.current);
    setPhase('peeling');
    const sx = e.clientX, sy = e.clientY;
    const start = sRef.current ?? s0;
    let moved = false;
    const move = (ev) => {
      const d = (ev.clientX - sx + (ev.clientY - sy)) / 2;
      if (Math.abs(d) > 3) moved = true;
      setFold(Math.max(sEnd, Math.min(s0, start + d)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const cur = sRef.current ?? s0;
      if (!moved || s0 - cur > 0.35 * (s0 - sEnd)) finish(cur); // klik doang = langsung dicabut
      else tween(cur, s0, 220, () => {
        setFold(null);
        setPhase('idle');
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const W = size.w, H = size.h;
  return (
    <div className="peel-demo">
      <div className={`pd-under ${phase === 'gone' || phase === 'flying' ? 'show' : ''}`}>
        <b>yay! ✦</b>
        <span>gitu rasanya nyabut stiker di sini</span>
      </div>
      {sticker && phase !== 'gone' && (
        <div className={`pd-sticker ${phase === 'flying' ? 'flying' : ''}`} ref={stageRef} style={{ aspectRatio: `${sticker.imgW} / ${sticker.imgH}` }} onPointerDown={onDown}>
          <img className="pd-front" src={sticker.url} alt="Stiker contoh, tarik pojoknya buat nyabut" draggable={false} style={{ clipPath: s != null ? clipHalf(W, H, s, true) : undefined }} />
          {s != null && (
            <div className="flap-shadow">
              <img className="sticker-back" src={sticker.url} alt="" draggable={false} style={{ transform: `matrix(0, -1, -1, 0, ${s}, ${s})`, clipPath: clipHalf(W, H, s, false) }} />
            </div>
          )}
        </div>
      )}
      {phase === 'idle' && <span className="pd-hint">tarik pojoknya ↘ atau klik</span>}
    </div>
  );
}

/** Ledakan stiker kecil dari sebuah tombol. */
export function burst(fromEl) {
  const r = fromEl.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.className = 'burst-layer';
  document.body.appendChild(layer);
  const shapes = ['★', '♥', '●', '✦'];
  const colors = ['#ffd23f', '#ff4fa3', '#2346c8', '#2fae5b', '#8a5cf6'];
  for (let i = 0; i < 22; i++) {
    const p = document.createElement('span');
    const a = (Math.PI * 2 * i) / 22 + Math.random() * 0.4;
    const dist = 90 + Math.random() * 120;
    p.textContent = shapes[i % shapes.length];
    p.style.left = `${r.left + r.width / 2}px`;
    p.style.top = `${r.top + r.height / 2}px`;
    p.style.color = colors[i % colors.length];
    p.style.setProperty('--x', `${Math.cos(a) * dist}px`);
    p.style.setProperty('--y', `${Math.sin(a) * dist - 40}px`);
    p.style.setProperty('--rot', `${Math.round(Math.random() * 540 - 270)}deg`);
    p.style.fontSize = `${18 + Math.random() * 18}px`;
    layer.appendChild(p);
  }
  setTimeout(() => layer.remove(), 900);
}
