import React, { useEffect, useState } from 'react';
import { makeSamples } from '../lib/samples.js';
import { renderSticker } from '../lib/sticker.js';
import { Star, Marquee, Lace } from './Deco.jsx';

const STEPS = [
  ['1', 'Foto', 'Jepret barang, makanan, temen, atau ambil dari galeri.'],
  ['2', 'AI potong', 'Latar fotonya dibuang otomatis, langsung ada pinggiran putih.'],
  ['3', 'Tempel & kirim', 'Susun di kertas stiker, terus kirim ke WA, X, atau simpan.'],
];

export default function Home({ onStart, onDemo, onContinue, hasWork }) {
  const [demo, setDemo] = useState([]);

  useEffect(() => {
    let alive = true;
    makeSamples().then((list) => {
      if (!alive) return;
      setDemo(
        list.map((s) => ({
          name: s.name,
          raw: s.cut.toDataURL(),
          sticker: renderSticker(s.cut, 16, '#ffffff').url,
        }))
      );
    });
    return () => {
      alive = false;
    };
  }, []);

  const [heart, pill, starS, tag] = demo;

  return (
    <div className="home">
      <Marquee items={['bikin stiker dari fotomu sendiri', 'gratis, langsung jadi', 'cabut, tempel, kirim ke temen', 'tanpa daftar akun']} />
      <Lace />

      <main className="home-stage">
        <Star className="hs s1" />
        <Star className="hs s2" />
        <Star className="hs s3" />
        <Star className="hs s4" />

        <section className="home-copy">
          <h1 className="title-stack" aria-label="Pause dulu, ayo bikin stiker sendiri">
            <span className="t-script t-pink">Pause</span>
            <span className="t-pause" aria-hidden>
              <i />
              <i />
            </span>
            <span className="t-tag t-tag-a">dulu,</span>
            <span className="t-round t-teal">ayo bikin</span>
            <span className="t-big" data-text="STIKER">
              STIKER
            </span>
            <span className="t-tag t-tag-b">dari</span>
            <span className="t-script t-purple">fotomu!</span>
          </h1>

          <div className="home-cta">
            <button type="button" className="play-btn" onClick={onStart}>
              MULAI
              <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden>
                <path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z" fill="currentColor" />
              </svg>
            </button>
            {hasWork ? (
              <button type="button" className="home-link" onClick={onContinue}>
                lanjutin kertas stikerku →
              </button>
            ) : (
              <button type="button" className="home-link" onClick={onDemo}>
                liat contohnya dulu →
              </button>
            )}
          </div>
        </section>

        <section className="home-art" aria-hidden>
          <div className="frame frame-before">
            {heart && <img src={heart.raw} alt="" />}
            <span className="frame-label">foto</span>
          </div>
          <svg className="art-arrow" viewBox="0 0 120 60">
            <path d="M6 40 C 40 4, 80 4, 108 30" fill="none" stroke="#1b1840" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 9" />
            <path d="M96 22 L110 31 L95 38" fill="none" stroke="#1b1840" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="frame frame-after">
            {heart && <img src={heart.sticker} alt="" />}
            <span className="frame-label">stiker!</span>
          </div>
          {pill && <img className="float-sticker fs1" src={pill.sticker} alt="" />}
          {starS && <img className="float-sticker fs2" src={starS.sticker} alt="" />}
          {tag && <img className="float-sticker fs3" src={tag.sticker} alt="" />}
        </section>
      </main>

      <section className="home-bottom">
        <div className="clouds" aria-hidden />
        <div className="how">
          <h2 className="how-title" data-text="Cara mainnya">
            Cara mainnya
          </h2>
          <ol className="how-steps">
            {STEPS.map(([n, t, d]) => (
              <li key={n}>
                <span className="how-num">{n}</span>
                <span>
                  <b>{t}</b>
                  {d}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
