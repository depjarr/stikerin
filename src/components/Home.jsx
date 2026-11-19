import React, { useEffect, useRef, useState } from 'react';
import { makeSamples } from '../lib/samples.js';
import { renderSticker } from '../lib/sticker.js';
import { renderCard } from '../lib/card.js';
import { StickerTitle, SpinBadge, PeelDemo, burst } from './HomeFx.jsx';

// Halaman awal gaya papan mading: kartu biru, paku payung, polaroid, sticky note.
// Animasi: tiap item "jatuh" lalu ketancep paku (urut lewat --d), polaroid goyang, coretan kegambar sendiri.

const STEPS = [
  {
    tag: 'LANGKAH 01',
    title: 'Foto atau upload',
    text: 'Jepret barang, makanan, atau temen. AI motong objeknya, langsung ada pinggiran putih.',
    circle: 'gratis',
    pin: 'red',
    r: -3,
  },
  {
    tag: 'LANGKAH 02',
    title: 'Tempel & dandanin',
    text: 'Susun di kertas stiker, bikin kartu photocard, atau pakaikan baju ke paper doll.',
    circle: 'bisa dicabut',
    pin: 'blue',
    r: 2.5,
  },
  {
    tag: 'LANGKAH 03',
    title: 'Kirim & simpan',
    text: 'Download PNG satu set, atau kirim satuan ke WhatsApp, X, dan Telegram.',
    circle: 'satuan / 1 set',
    pin: 'green',
    r: -1.5,
  },
];

function Pin({ color = 'red', d = 0 }) {
  return <span className={`hb-pin pin-${color}`} style={{ '--d': `${d + 0.45}s` }} aria-hidden="true" />;
}

function Scribble({ children, d }) {
  return (
    <span className="hb-scribble" style={{ '--d': `${d + 0.7}s` }}>
      {children}
      <svg viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true">
        <path d="M14 34C10 14 70 4 120 8c46 4 74 14 70 30-4 18-66 20-110 17C40 52 8 46 16 26c6-14 40-20 70-21" />
      </svg>
    </span>
  );
}

export default function Home({ onStart, onDemo, onContinue, hasWork, count = 0 }) {
  const [demo, setDemo] = useState([]);
  const [peelSticker, setPeelSticker] = useState(null);
  const boardRef = useRef(null);

  useEffect(() => {
    let alive = true;
    makeSamples().then((list) => {
      if (!alive) return;
      setDemo(list.map((s) => ({ name: s.name, raw: s.cut.toDataURL(), sticker: renderSticker(s.cut, 16, '#ffffff').url })));
      // stiker demo yang bisa dicabut: kartu gingham + hati
      renderCard(
        { size: 'portrait', pattern: 'gingham', color: 'pink', frame: 'rounded', text: 'tarik\npojokku!', font: 'bubble', textColor: '#d6246e', textPos: 'bottom', deco: 'stars', innerLine: true },
        { img: list[0].cut, isCut: true }
      ).then((card) => alive && setPeelSticker(renderSticker(card, 12, '#ffffff')));
    });
    return () => {
      alive = false;
    };
  }, []);

  const [heart, pill, starS, tag] = demo;

  return (
    <div className="hb">
      <div
        className="hb-board"
        ref={boardRef}
        onPointerMove={(e) => {
          if (e.pointerType !== 'mouse') return;
          const r = boardRef.current.getBoundingClientRect();
          boardRef.current.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
          boardRef.current.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
        }}
      >
        {/* hiasan lepas */}
        <svg className="hb-deco hb-smile" viewBox="0 0 100 100" aria-hidden="true">
          <rect x="8" y="8" width="84" height="84" rx="6" fill="#fffdf4" stroke="#e9e1c9" strokeWidth="2" />
          <circle cx="50" cy="50" r="30" fill="none" stroke="#e7b400" strokeWidth="5" />
          <circle cx="40" cy="44" r="4" fill="#e7b400" />
          <circle cx="60" cy="44" r="4" fill="#e7b400" />
          <path d="M36 57q14 14 28 0" fill="none" stroke="#e7b400" strokeWidth="5" strokeLinecap="round" />
        </svg>
        <svg className="hb-deco hb-heart" viewBox="0 0 100 90" aria-hidden="true">
          <path d="M50 84C14 60 4 40 12 22 20 6 42 6 50 24 58 6 80 6 88 22c8 18-2 38-38 62z" fill="#ff8fb9" stroke="#fff" strokeWidth="6" strokeLinejoin="round" />
        </svg>
        <svg className="hb-deco hb-star" viewBox="0 0 100 100" aria-hidden="true">
          <path d="M50 6 62 36l32 2-25 20 9 32-28-18-28 18 9-32L6 38l32-2z" fill="#ffe27a" stroke="#f2c94c" strokeWidth="3" strokeLinejoin="round" />
        </svg>
        <svg className="hb-deco hb-flower" viewBox="0 0 100 100" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <ellipse key={i} cx="50" cy="22" rx="11" ry="20" fill="#ffd23f" transform={`rotate(${i * 45} 50 50)`} />
          ))}
          <circle cx="50" cy="50" r="13" fill="#2346c8" />
        </svg>

        {/* judul */}
        <header className="hb-head hb-item hb-par" style={{ '--r': '-1.5deg', '--d': '0s', '--z': 8 }}>
          <p className="hb-brand">
            <span className="hb-logo" aria-hidden="true">✦</span> stikerin <span>· papan stiker buatan sendiri</span>
          </p>
          <StickerTitle lines={['BIKIN STIKER', 'SESUKAMU!']} delay={0.2} />
          <p className="hb-sub">dari foto, tulisan, atau prompt AI</p>
        </header>

        {/* kamera (pengganti megafon) */}
        <svg className="hb-cam hb-item" style={{ '--r': '-12deg', '--d': '0.25s' }} viewBox="0 0 120 100" aria-hidden="true">
          <rect x="10" y="26" width="100" height="64" rx="14" fill="#ffd23f" stroke="#fff" strokeWidth="6" />
          <rect x="10" y="26" width="100" height="64" rx="14" fill="none" stroke="#2346c8" strokeWidth="3" />
          <rect x="38" y="12" width="40" height="18" rx="5" fill="#ffd23f" stroke="#2346c8" strokeWidth="3" />
          <circle cx="60" cy="58" r="20" fill="#fff" stroke="#2346c8" strokeWidth="4" />
          <circle cx="60" cy="58" r="10" fill="#2346c8" />
          <circle cx="92" cy="40" r="4" fill="#ff5b8a" />
          <path d="M8 14l10 8M2 30l12 2M114 14l-10 8" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
        </svg>

        {/* stiker demo yang bisa dicabut */}
        <div className="hb-demo hb-par" style={{ '--z': 18 }}>
          <div className="hb-item" style={{ '--r': '4deg', '--d': '0.9s' }}>
            <Pin color="yellow" d={0.9} />
            <PeelDemo sticker={peelSticker} />
          </div>
          <SpinBadge className="hb-badge" text="GRATIS ✦ TANPA DAFTAR ✦ PAKAI AI ✦ " />
        </div>

        {/* langkah */}
        <ol className="hb-steps hb-par" style={{ '--z': 12 }}>
          {STEPS.map((s, i) => {
            const d = 0.7 + i * 0.18;
            return (
              <li key={s.tag} className="hb-card hb-item" style={{ '--r': `${s.r}deg`, '--d': `${d}s` }}>
                <Pin color={s.pin} d={d} />
                <span className="hb-tag">{s.tag}</span>
                <h2>{s.title}</h2>
                <p>{s.text}</p>
                <Scribble d={d}>{s.circle}</Scribble>
              </li>
            );
          })}
        </ol>

        {/* stiker contoh nempel di papan */}
        <div className="hb-loose hb-par" style={{ '--z': -14 }} aria-hidden="true">
          {pill && <img className="hb-float f1" src={pill.sticker} alt="" />}
          {starS && <img className="hb-float f2" src={starS.sticker} alt="" />}
          {tag && <img className="hb-float f3" src={tag.sticker} alt="" />}
        </div>

        {/* ajakan: sticky note kuning */}
        <section className="hb-cta hb-item hb-par" style={{ '--r': '2deg', '--d': '1.3s', '--z': 22 }}>
          <Pin color="blue" d={1.3} />
          <p className="hb-hand">psst… bikin stiker pertamamu yuk!</p>
          <button
            type="button"
            className="hb-go"
            onClick={(e) => {
              burst(e.currentTarget);
              setTimeout(onStart, 420);
            }}
          >
            Mulai bikin <span aria-hidden="true">→</span>
          </button>
          {hasWork ? (
            <button type="button" className="hb-link" onClick={onContinue}>
              lanjutin kertasku ({count} stiker)
            </button>
          ) : (
            <button type="button" className="hb-link" onClick={onDemo}>
              liat contohnya dulu
            </button>
          )}
        </section>

        {/* sobekan kertas binder */}
        <div className="hb-paper hb-item" style={{ '--r': '-4deg', '--d': '1.1s' }} aria-hidden="true">
          <span>♡ ♡</span>
          <span>stiker = mood booster</span>
        </div>
      </div>
    </div>
  );
}
