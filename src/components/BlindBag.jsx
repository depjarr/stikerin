import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, animate, useMotionValue } from 'motion/react';
import Icon from './Icons.jsx';
import { fileToCutout, renderSticker } from '../lib/sticker.js';

/*
  Blind bag: stiker dimasukin ke bungkus foil, bungkusnya bisa dikasih logo,
  terus user nyobek bagian atas (geser jari di garis sobek) → stiker keluar
  ngipas kayak kartu, lalu mencar dan bisa digeser-geser.

  Tahap: pack (stiker nongol dari bungkus yang kebuka) → packing → sealing → sealed
         → rise (keluar ngipas) → open (mencar, bisa digeser)
*/

const TEAR = 0.15; // posisi garis sobek, proporsi tinggi bungkus
const TEETH = 18;

// potongan bergerigi buat garis sobek (dipakai bagian atas & badan biar pas nyambung)
function zigzag(top) {
  const pts = [];
  for (let i = 0; i <= TEETH; i++) {
    const x = (i / TEETH) * 100;
    const y = TEAR * 100 + (i % 2 ? 0.9 : -0.9);
    pts.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
  }
  return top ? `polygon(0% 0%, 100% 0%, ${pts.reverse().join(', ')})` : `polygon(${pts.join(', ')}, 100% 100%, 0% 100%)`;
}
const CLIP_TOP = zigzag(true);
const CLIP_BODY = zigzag(false);

// angka acak tapi tetap (biar posisi mencar ga loncat tiap render)
const rnd = (i, k = 1) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

function BagArt({ id }) {
  const f = `bbf-${id}`, sh = `bbs-${id}`, seal = `bbp-${id}`, blur = `bbb-${id}`;
  return (
    <svg className="bb-art" viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={f} x1="0" y1="0" x2="1" y2="0.12">
          <stop offset="0" stopColor="#787e86" />
          <stop offset="0.1" stopColor="#d5d9de" />
          <stop offset="0.28" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#bfc4ca" />
          <stop offset="0.6" stopColor="#f6f7f9" />
          <stop offset="0.8" stopColor="#a6acb3" />
          <stop offset="0.92" stopColor="#dfe2e6" />
          <stop offset="1" stopColor="#6d737a" />
        </linearGradient>
        <linearGradient id={sh} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.16" />
          <stop offset="0.16" stopColor="#000" stopOpacity="0" />
          <stop offset="0.86" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
        <pattern id={seal} width="3" height="3" patternUnits="userSpaceOnUse">
          <rect width="3" height="3" fill="#eef0f2" />
          <rect width="1.3" height="3" fill="#c3c8ce" />
        </pattern>
        <filter id={blur} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      <rect x="3" y="3" width="294" height="394" rx="9" fill={`url(#${f})`} />
      {/* kerutan foil */}
      <g filter={`url(#${blur})`}>
        <path d="M40 90 C 70 150, 60 260, 44 340" stroke="#fff" strokeWidth="16" fill="none" opacity="0.75" />
        <path d="M250 96 C 232 170, 246 270, 258 338" stroke="#fff" strokeWidth="12" fill="none" opacity="0.6" />
        <path d="M70 82 C 140 100, 190 96, 236 80" stroke="#fff" strokeWidth="14" fill="none" opacity="0.7" />
        <path d="M60 352 C 120 334, 190 338, 246 354" stroke="#fff" strokeWidth="12" fill="none" opacity="0.55" />
        <path d="M26 110 C 46 180, 40 270, 28 330" stroke="#4a5058" strokeWidth="10" fill="none" opacity="0.35" />
        <path d="M276 112 C 262 190, 266 280, 274 330" stroke="#4a5058" strokeWidth="10" fill="none" opacity="0.35" />
        <path d="M120 170 C 150 150, 180 190, 200 160" stroke="#8d939a" strokeWidth="8" fill="none" opacity="0.25" />
      </g>
      <rect x="3" y="3" width="294" height="394" rx="9" fill={`url(#${sh})`} />
      {/* segel panas: atas, bawah, samping */}
      <rect x="3" y="3" width="294" height="50" rx="8" fill={`url(#${seal})`} opacity="0.92" />
      <rect x="3" y="372" width="294" height="25" rx="6" fill={`url(#${seal})`} opacity="0.92" />
      <rect x="3" y="53" width="13" height="319" fill={`url(#${seal})`} opacity="0.75" />
      <rect x="284" y="53" width="13" height="319" fill={`url(#${seal})`} opacity="0.75" />
      {/* lubang gantungan */}
      <rect x="126" y="17" width="48" height="13" rx="6.5" fill="#1b1840" opacity="0.55" />
      {/* takik + garis sobek */}
      <path d="M3 54 L15 60 L3 66 Z" fill="#596068" />
      <path d="M297 54 L285 60 L297 66 Z" fill="#596068" />
      <line x1="18" y1="60" x2="282" y2="60" stroke="#868c93" strokeWidth="1.3" strokeDasharray="6 5" opacity="0.75" />
      <rect x="3" y="3" width="294" height="394" rx="9" fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="2" />
    </svg>
  );
}

export default function BlindBag({ stickers, logo, setLogo, defaults, onClose, toast }) {
  const stageRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [stage, setStage] = useState('pack');
  const [z, setZ] = useState({}); // urutan tumpuk stiker yang lagi digeser
  const [round, setRound] = useState(0);
  const [logoBusy, setLogoBusy] = useState(false);
  const [cutLogo, setCutLogo] = useState(false);
  const fileRef = useRef(null);
  const timers = useRef([]);

  // bagian atas bungkus (yang disobek) digerakin manual
  const topX = useMotionValue(0);
  const topY = useMotionValue(0);
  const topR = useMotionValue(0);
  const topO = useMotionValue(1);
  const bodyY = useMotionValue(0);
  const bodyS = useMotionValue(1);

  const items = stickers.filter((s) => s.url && !s.wornBy).slice(0, 30);
  const n = items.length;

  useLayoutEffect(() => {
    const el = stageRef.current;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      timers.current.forEach(clearTimeout);
    };
  }, [onClose]);

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  /* ---------- ukuran & posisi (relatif ke tengah panggung) ---------- */
  const { w, h } = size;
  const bagH = Math.max(160, Math.min(h * 0.56, 420, (w * 0.56) / 0.75));
  const bagW = bagH * 0.75;
  const by = h * 0.12; // bungkus agak ke bawah biar ada ruang buat stiker ngipas di atas
  const mouthY = by - bagH / 2 + bagH * TEAR;
  const sw = Math.max(56, Math.min(bagW * 0.44, 124));
  // tutup atas melayang di samping; layar sempit (HP) → naik ke atas biar ga keluar layar
  const room = w / 2 - bagW * 0.56;
  const narrow = room < bagW * 0.4;
  const lidPos = narrow ? { x: Math.max(0, room) * 0.6, y: -bagH * 0.52, r: 8 } : { x: Math.min(bagW * 0.62, room), y: -bagH * 0.1, r: 16 };

  const dims = (st) => ({ sw, sh: (sw * st.imgH) / st.imgW });

  // kipas: nongol dari mulut bungkus kayak kartu
  const fan = (i, st) => {
    const { sh } = dims(st);
    const t = i - (n - 1) / 2;
    const gap = Math.min(sw * 0.42, (bagW * 0.95) / Math.max(1, n - 1));
    const step = Math.min(11, 75 / Math.max(1, n));
    return { x: t * gap, y: mouthY - sh * 0.36 + Math.abs(t) * 3, rotate: t * step, scale: 1, opacity: 1 };
  };
  const inside = () => ({ x: 0, y: mouthY + bagH * 0.18, rotate: 0, scale: 0.35, opacity: 0 });
  // mencar ngelilingin bungkus
  const scatter = (i, st) => {
    const { sh } = dims(st);
    const ring = n > 12 && i % 2 ? 0.8 : 1;
    // sebar 270° lewat atas, bagian bawah bungkus dikosongin biar ga numpuk tombol
    const a = -Math.PI / 2 + (n > 1 ? (i / (n - 1) - 0.5) * Math.PI * 1.5 : 0) + (rnd(i) - 0.5) * 0.25;
    const rx = Math.min(w / 2 - sw * 0.55, bagW / 2 + sw * 0.85) * ring;
    const ry = Math.min(h / 2 - sh * 0.55, bagH / 2 + sh * 0.55) * ring;
    let x = Math.cos(a) * rx * (0.9 + rnd(i, 2) * 0.15);
    let y = by * 0.4 + Math.sin(a) * ry * (0.9 + rnd(i, 3) * 0.15);
    x = Math.max(-w / 2 + sw / 2, Math.min(w / 2 - sw / 2, x));
    y = Math.max(-h / 2 + sh / 2, Math.min(h / 2 - sh / 2, y));
    return { x, y, rotate: (rnd(i, 4) - 0.5) * 34, scale: 1, opacity: 1 };
  };

  const target = (i, st) => {
    if (stage === 'pack' || stage === 'rise') return fan(i, st);
    if (stage === 'open') return scatter(i, st);
    return inside();
  };
  const transition = (i) => {
    if (stage === 'packing') return { duration: 0.42, ease: [0.5, 0, 0.75, 0], delay: i * 0.07 };
    if (stage === 'rise') return { type: 'spring', stiffness: 260, damping: 18, delay: 0.1 + i * 0.05 };
    if (stage === 'open') return { type: 'spring', stiffness: 170, damping: 17, delay: i * 0.025 };
    return { type: 'spring', stiffness: 300, damping: 24, delay: i * 0.03 };
  };

  /* ---------- tutup bungkus ---------- */
  // posisi awal: tutup atas melayang di samping (bungkus kebuka)
  const placedLid = useRef(false);
  useEffect(() => {
    if (!w || placedLid.current) return;
    placedLid.current = true;
    topX.set(lidPos.x);
    topY.set(lidPos.y);
    topR.set(lidPos.r);
  });

  const pack = () => {
    if (!n) return;
    setStage('packing');
    const t = 420 + n * 70;
    // bungkus goyang tiap ada stiker masuk
    animate(bodyS, [1, 0.97, 1.01, 1], { duration: Math.min(1.4, t / 1000), ease: 'easeInOut' });
    later(() => {
      setStage('sealing');
      animate(topX, 0, { type: 'spring', stiffness: 260, damping: 22 });
      animate(topY, 0, { type: 'spring', stiffness: 260, damping: 22 });
      animate(topR, 0, { type: 'spring', stiffness: 260, damping: 22 });
      later(() => animate(bodyS, [1, 0.95, 1.03, 1], { duration: 0.4 }), 260);
      later(() => setStage('sealed'), 750);
    }, t);
  };

  const tear = (dir = 1) => {
    if (stage !== 'sealed') return;
    navigator.vibrate?.(25);
    animate(topX, dir * bagW * 0.9, { duration: 0.6, ease: 'easeOut' });
    animate(topY, -bagH * 0.55, { duration: 0.6, ease: [0.2, 0.7, 0.4, 1] });
    animate(topR, dir * 38, { duration: 0.6 });
    animate(topO, 0, { duration: 0.5, delay: 0.15 });
    animate(bodyY, [0, -14, 0], { duration: 0.35 });
    setStage('rise');
    later(() => setStage('open'), 450 + n * 50 + 650);
  };

  const repack = () => {
    setZ({});
    setRound((r) => r + 1);
    setStage('pack');
    topO.set(1);
    animate(topX, lidPos.x, { type: 'spring', stiffness: 220, damping: 22 });
    animate(topY, lidPos.y, { type: 'spring', stiffness: 220, damping: 22 });
    animate(topR, lidPos.r, { type: 'spring', stiffness: 220, damping: 22 });
  };

  // geser jari di bagian atas buat nyobek
  const onTopDown = (e) => {
    if (stage !== 'sealed') return;
    e.preventDefault();
    const x0 = e.clientX;
    let p = 0, dir = 1;
    const move = (ev) => {
      const dx = ev.clientX - x0;
      dir = dx < 0 ? -1 : 1;
      p = Math.min(1, Math.abs(dx) / (bagW * 0.55));
      topR.set(-dir * p * 9);
      topY.set(-p * 10);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (p >= 0.8) tear(dir);
      else {
        animate(topR, 0, { type: 'spring', stiffness: 400, damping: 18 });
        animate(topY, 0, { type: 'spring', stiffness: 400, damping: 18 });
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const onLogo = async (file) => {
    setLogoBusy(true);
    try {
      const cut = await fileToCutout(file, { useAI: cutLogo, shape: 'rounded' });
      setLogo(renderSticker(cut, 10, '#ffffff').url);
    } catch (e) {
      console.error(e);
      toast?.('Logonya gagal dibaca, coba foto lain');
    } finally {
      setLogoBusy(false);
    }
  };

  const behind = stage !== 'open';
  const lidFront = stage === 'sealed' || stage === 'sealing';
  const lidAlt = stage === 'pack' ? 'Tutup bungkus' : '';

  return (
    <div className="bb" role="dialog" aria-modal="true" aria-label="Blind bag stiker">
      <header className="bb-top-bar">
        <button type="button" className="bb-round" onClick={onClose} aria-label="Tutup blind bag">
          <Icon name="close" size={20} strokeWidth={2.6} />
        </button>
        <h2>Blind bag</h2>
        <span className="bb-count">{n} stiker</span>
      </header>

      <div className="bb-stage" ref={stageRef}>
        {w > 0 && (
          <>
            <div
              className="bb-bag"
              style={{ width: bagW, height: bagH, left: w / 2 - bagW / 2, top: h / 2 + by - bagH / 2 }}
            >
              <div className="bb-mouth" />
              <motion.div className="bb-body" style={{ clipPath: CLIP_BODY, y: bodyY, scale: bodyS }}>
                <BagArt id="b" />
                <div className="bb-logo">
                  {logo ? (
                    <img src={logo} alt="Logo bungkus" draggable={false} />
                  ) : (
                    <div className="bb-logo-def">
                      <span className="bb-logo-script">Stikerin</span>
                      <b>BLIND BAG</b>
                    </div>
                  )}
                </div>
                <span className="bb-brand">✦ {n} stiker misteri ✦</span>
              </motion.div>
              <motion.div
                className={`bb-lid ${stage === 'sealed' ? 'can-tear' : ''}`}
                style={{ clipPath: CLIP_TOP, x: topX, y: topY, rotate: topR, opacity: topO, zIndex: lidFront ? 6 : 4 }}
                onPointerDown={onTopDown}
                aria-label={lidAlt}
              >
                <BagArt id="t" />
              </motion.div>
            </div>

            {items.map((st, i) => {
              const { sh } = dims(st);
              return (
                <motion.div
                  key={st.id}
                  className={`bb-st ${stage === 'open' ? 'can-drag' : ''}`}
                  style={{ width: sw, height: sh, left: w / 2 - sw / 2, top: h / 2 - sh / 2, zIndex: behind ? 2 : 10 + (z[st.id] || 0) }}
                  initial={stage === 'pack' ? { ...fan(i, st), y: fan(i, st).y + 60, opacity: 0 } : false}
                  animate={target(i, st)}
                  transition={transition(i)}
                >
                  {/* lapisan dalam khusus digeser; offsetnya direset (remount) tiap dibungkus lagi */}
                  <motion.div
                    key={round}
                    className="bb-drag"
                    drag={stage === 'open'}
                    dragConstraints={stageRef}
                    dragElastic={0.18}
                    dragTransition={{ power: 0.25, timeConstant: 220 }}
                    whileDrag={{ scale: 1.12 }}
                    onPointerDown={() => stage === 'open' && setZ((m) => ({ ...m, [st.id]: Math.max(0, ...Object.values(m)) + 1 }))}
                  >
                    <img src={st.url} alt={st.name} draggable={false} />
                  </motion.div>
                </motion.div>
              );
            })}

            {stage === 'sealed' && (
              <div className="bb-hint" style={{ left: w / 2, top: h / 2 + by - bagH / 2 + bagH * TEAR }}>
              <motion.div
                className="bb-hint-in"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <motion.span
                  className="bb-hand"
                  aria-hidden="true"
                  animate={{ x: [-bagW * 0.35, bagW * 0.35], opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 0.4, ease: 'easeInOut' }}
                >
                  ☝
                </motion.span>
                <span className="bb-hint-text">✂ geser di garis atas buat nyobek!</span>
              </motion.div>
              </div>
            )}
          </>
        )}
      </div>

      <footer className="bb-panel">
        {stage === 'pack' && (
          <>
            <div className="bb-logo-row">
              <span className="bb-label">Logo bungkus</span>
              <button type="button" className="bb-chip" onClick={() => fileRef.current.click()} disabled={logoBusy}>
                <Icon name="photo" size={16} strokeWidth={2.3} /> {logoBusy ? 'Nyiapin…' : logo ? 'Ganti foto' : 'Upload foto'}
              </button>
              <button type="button" className={`bb-chip ${cutLogo ? 'on' : ''}`} onClick={() => setCutLogo((v) => !v)} aria-pressed={cutLogo} title="Potong latar foto pakai AI">
                AI {cutLogo ? 'ON' : 'OFF'}
              </button>
              {logo && (
                <button type="button" className="bb-chip" onClick={() => setLogo(null)}>
                  Hapus
                </button>
              )}
            </div>
            <button type="button" className="btn-3d pink bb-main" onClick={pack} disabled={!n}>
              {n ? 'Masukin ke bungkus ✦' : 'Belum ada stiker'}
            </button>
          </>
        )}
        {(stage === 'packing' || stage === 'sealing') && <p className="bb-note">lagi dibungkus… 🤫</p>}
        {stage === 'sealed' && (
          <button type="button" className="btn-3d pink bb-main" onClick={() => tear(1)}>
            ✂ Sobek bungkusnya
          </button>
        )}
        {stage === 'rise' && <p className="bb-note">✦ taraaa ✦</p>}
        {stage === 'open' && (
          <div className="bb-actions">
            <p className="bb-note small">geser-geser stikernya sesukamu ♡</p>
            <button type="button" className="btn-3d blue" onClick={repack}>
              Bungkus lagi
            </button>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) onLogo(f);
          }}
        />
      </footer>
    </div>
  );
}
