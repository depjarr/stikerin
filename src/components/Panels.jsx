import React, { useEffect, useRef, useState } from 'react';
import { fileToDataURL, fileToCutout, loadImage } from '../lib/sticker.js';
import { renderCard, CARD_COLORS, CARD_FONTS } from '../lib/card.js';
import { aiStatus } from '../lib/cloud.js';
import { TEXT_STYLES } from '../lib/textSticker.js';
import { KINDS, SLOT_LABEL, SLOT_ORDER } from '../lib/dressup.js';
import { motion, useDragControls } from 'motion/react';
import Icon from './Icons.jsx';
import { Star, Tape } from './Deco.jsx';

const OUTLINE_SWATCHES = ['#ffffff', '#1b1840', '#ff4fa3', '#ffd60a', '#8be04e', '#3d8bff'];
const TEXT_SWATCHES = ['#ff4fa3', '#1b1840', '#8be04e', '#3d8bff', '#ffd60a', '#ffffff', '#ff7a1a', '#9b5cff'];

/* =================== kontrol dasar =================== */

export function Toggle({ checked, onChange, label, sub }) {
  return (
    <label className="toggle">
      <span className="toggle-text">
        <span className="ctl-label">{label}</span>
        {sub && <small>{sub}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-ui" aria-hidden>
        <b>{checked ? 'ON' : 'OFF'}</b>
      </span>
    </label>
  );
}

export function Pills({ value, options, onChange, label, small }) {
  return (
    <div className={`pills ${small ? 'small' : ''}`} role="radiogroup" aria-label={label}>
      {options.map(([v, text, style]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} style={style} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

export function Slider({ label, value, min, max, onChange, unit = '' }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="slider">
      <span className="slider-top">
        <span className="ctl-label">{label}</span>
        <output>
          {Math.round(value)}
          {unit}
        </output>
      </span>
      <input type="range" min={min} max={max} value={value} style={{ '--pct': `${pct}%` }} onChange={(e) => onChange(+e.target.value)} />
    </label>
  );
}

function Swatches({ colors, value, onChange, label }) {
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {colors.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} className={`swatch ${value === c ? 'on' : ''}`} style={{ background: c }} aria-label={c} onClick={() => onChange(c)} />
      ))}
      <label className="swatch rainbow" title="Warna lain">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Warna lain" />
      </label>
    </div>
  );
}

function ColorDot({ label, value, onChange }) {
  return (
    <label className="color-dot">
      <span className="color-dot-swatch" style={{ background: value }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      </span>
      {label}
    </label>
  );
}

function ImagePick({ label, onPick, image, onClear }) {
  const ref = useRef(null);
  return (
    <div className="image-pick">
      <button type="button" className="image-pick-tile" onClick={() => ref.current.click()} style={image ? { backgroundImage: `url(${image})` } : undefined}>
        {!image && (
          <>
            <Icon name="photo" size={24} />
            {label}
          </>
        )}
      </button>
      {image && (
        <div className="row-btns">
          <button type="button" className="chip-btn" onClick={() => ref.current.click()}>Ganti</button>
          <button type="button" className="chip-btn danger" onClick={onClear}>Hapus</button>
        </div>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onPick(await fileToDataURL(f));
        }}
      />
    </div>
  );
}

/* =================== tombol scan =================== */

export function ScanButton({ onScan, jobs }) {
  const pending = jobs.filter((j) => !j.error).length;
  const failed = jobs.find((j) => j.error);
  return (
    <div className="scan-cta">
      <button type="button" className="btn-3d pink big" onClick={onScan}>
        <Icon name="camera" size={26} strokeWidth={2.2} /> SCAN FOTO
      </button>
      {pending > 0 && (
        <p className="scan-status">
          <span className="spinner" aria-hidden /> AI lagi motong {pending} foto…
        </p>
      )}
      {failed && <p className="scan-status err">{failed.status}</p>}
    </div>
  );
}

/* =================== strip foto (koleksi) =================== */

export function PhotoStrip({ stickers, jobs, selectedId, onPlace, onSelect, onShare, onDelete, onArrange, horizontal }) {
  const pending = jobs.filter((j) => !j.error);
  return (
    <section className={`strip ${horizontal ? 'horizontal' : ''}`} aria-label="Koleksi stiker">
      <div className="strip-paper">
        <ul>
          {pending.map((j) => (
            <li key={j.id} className="strip-frame busy">
              <span className="spinner" aria-hidden />
              <small>{Math.round((j.pct || 0) * 100)}%</small>
            </li>
          ))}
          {stickers.map((s) => (
            <li key={s.id} className={`strip-frame ${s.placed || s.wornBy ? '' : 'pocket'} ${s.id === selectedId ? 'sel' : ''}`}>
              <button
                type="button"
                className="strip-pic"
                onClick={() => (s.placed ? onSelect(s.id) : s.wornBy ? onSelect(s.wornBy) : onPlace(s.id))}
                aria-label={s.placed ? `Pilih ${s.name}` : s.wornBy ? `${s.name} lagi dipakai` : `Tempel lagi ${s.name}`}
              >
                <img src={s.url} alt="" />
                {!s.placed && !s.wornBy && <span className="strip-tag">tempel</span>}
                {s.wornBy && <span className="strip-tag worn-tag">dipakai</span>}
                {s.kind === 'doll' && <span className="strip-tag doll-tag">orang</span>}
              </button>
              <span className="strip-actions">
                <button type="button" onClick={() => onShare(s.id)} aria-label={`Kirim ${s.name}`}>
                  <Icon name="share" size={13} strokeWidth={2.4} />
                </button>
                <button type="button" onClick={() => onDelete(s.id)} aria-label={`Hapus ${s.name}`}>
                  <Icon name="trash" size={13} strokeWidth={2.4} />
                </button>
              </span>
            </li>
          ))}
          {stickers.length === 0 && pending.length === 0 && (
            <li className="strip-frame empty">
              <span>kosong</span>
            </li>
          )}
        </ul>
        <span className="strip-label">koleksiku ♡</span>
      </div>
      {stickers.length > 1 && (
        <button type="button" className="chip-btn strip-arrange" onClick={onArrange}>
          <Icon name="grid" size={14} /> susun rapi
        </button>
      )}
    </section>
  );
}

/* =================== ponsel lipat (kirim) =================== */

export function RetroPhone({ selected, placedCount, total = 0, onShareSticker, onShareSet, onDownload, onPrint, onWaPack, onClear, exporting }) {
  return (
    <section className="phone" aria-label="Kirim stiker">
      <div className="phone-top">
        <span className="phone-antenna" aria-hidden />
        <span className="phone-speaker" aria-hidden />
        <div className="phone-screen">
          <div className="phone-status" aria-hidden>
            <span className="bars">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>Ponselku</span>
            <span className="batt" />
          </div>
          <div className="phone-view">
            {selected ? (
              <img src={selected.url} alt={selected.name} />
            ) : (
              <p>
                {placedCount ? `${placedCount} stiker di kertas` : 'belum ada stiker'}
                <br />
                <small>ketuk stiker buat kirim satuan</small>
              </p>
            )}
          </div>
          <div className="phone-soft" aria-hidden>
            <span>Kirim</span>
            <span>Menu</span>
          </div>
        </div>
      </div>
      <div className="phone-hinge" aria-hidden />
      <div className="phone-bottom">
        <button type="button" className="phone-key wide" onClick={() => onShareSticker(selected.id)} disabled={!selected}>
          <Icon name="share" size={17} strokeWidth={2.3} /> Kirim stiker ini
        </button>
        <div className="phone-keys2">
          <button type="button" className="phone-key" onClick={onShareSet} disabled={!placedCount || exporting}>
            Kirim 1 set
          </button>
          <button type="button" className="phone-key" onClick={onDownload} disabled={exporting}>
            {exporting ? 'Nyiapin…' : 'Simpan PNG'}
          </button>
        </div>
        <div className="phone-keys2">
          <button type="button" className="phone-key" onClick={onPrint} disabled={exporting} title="Lembar A4 penuh dengan garis potong">
            Cetak A4
          </button>
          <button type="button" className="phone-key" onClick={onWaPack} disabled={total < 3 || exporting} title={total < 3 ? 'Butuh minimal 3 stiker' : 'Paket stiker WhatsApp (.zip)'}>
            Paket WA
          </button>
        </div>
        <button type="button" className="phone-key clear" onClick={onClear} disabled={!total}>
          <Icon name="trash" size={15} strokeWidth={2.3} /> Kosongin kertas
        </button>
      </div>
    </section>
  );
}

/* =================== sticky note (atur stiker) =================== */

export function StickyNote({ st, defaults, setDefaults, onUpdate, onOutline, onApplyAll, onPeel, onDuplicate, onLayer, onToHeader, packOn, onKind, onTakeOff, onRealistic, stickers = [] }) {
  return (
    <section className="note" aria-label="Atur stiker">
      <Tape className="note-tape" />
      {st ? (
        <NoteInspector
          key={st.id}
          st={st}
          onUpdate={onUpdate}
          onOutline={onOutline}
          onApplyAll={onApplyAll}
          onPeel={onPeel}
          onDuplicate={onDuplicate}
          onLayer={onLayer}
          onToHeader={onToHeader}
          packOn={packOn}
          onKind={onKind}
          onTakeOff={onTakeOff}
          onRealistic={onRealistic}
          stickers={stickers}
        />
      ) : (
        <>
          <h2 className="note-title">catatan kecil ✎</h2>
          <p className="note-hand">Ketuk salah satu stiker di kertas buat ngatur pinggiran, ukuran, & posisinya ♡</p>
          <div className="note-sep" />
          <p className="note-sub">Buat stiker berikutnya:</p>
          <Toggle label="AI hapus latar" sub="foto ga di-upload ke server" checked={defaults.useAI} onChange={(useAI) => setDefaults({ ...defaults, useAI })} />
          {!defaults.useAI && (
            <Pills small label="Bentuk stiker" value={defaults.shape} onChange={(shape) => setDefaults({ ...defaults, shape })} options={[['rounded', 'Rounded'], ['circle', 'Bulat'], ['rect', 'Kotak']]} />
          )}
          <Slider label="Tebal pinggiran" unit="px" value={defaults.outline} min={0} max={40} onChange={(outline) => setDefaults({ ...defaults, outline })} />
        </>
      )}
    </section>
  );
}

function NoteInspector({ st, onUpdate, onOutline, onApplyAll, onPeel, onDuplicate, onLayer, onToHeader, packOn, onKind, onTakeOff, onRealistic, stickers }) {
  const [ow, setOw] = useState(st.outline);
  const [oc, setOc] = useState(st.outlineColor);
  useEffect(() => {
    if (ow === st.outline && oc === st.outlineColor) return;
    const t = setTimeout(() => onOutline(st.id, ow, oc), 140);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ow, oc]);

  return (
    <>
      <div className="note-head">
        <span className="note-thumb">
          <img src={st.url} alt="" />
        </span>
        <h2 className="note-title">{st.kind === 'doll' ? 'dandanin dia ✎' : 'atur stiker ✎'}</h2>
      </div>
      <div className="ctl">
        <span className="ctl-label">Jenis stiker</span>
        <Pills small label="Jenis stiker" value={st.kind || 'sticker'} onChange={(k) => onKind(st.id, k)} options={Object.entries(KINDS).map(([k, l]) => [k, l])} />
      </div>
      {st.kind === 'doll' && <Outfit doll={st} stickers={stickers} onTakeOff={onTakeOff} onRealistic={onRealistic} />}
      <Slider label="Tebal pinggiran" unit="px" value={ow} min={0} max={40} onChange={setOw} />
      <div className="ctl">
        <span className="ctl-label">Warna pinggiran</span>
        <Swatches label="Warna pinggiran" colors={OUTLINE_SWATCHES} value={oc} onChange={setOc} />
      </div>
      <button type="button" className="note-link" onClick={() => onApplyAll(ow, oc)}>
        samain ke semua stiker →
      </button>
      <Slider label="Ukuran" value={st.width} min={60} max={900} onChange={(width) => onUpdate(st.id, { width })} />
      <Slider label="Putar" unit="°" value={st.rot} min={-180} max={180} onChange={(rot) => onUpdate(st.id, { rot })} />
      <div className="row-btns">
        <button type="button" className="chip-btn" onClick={() => onLayer(st.id, 1)}>
          <Icon name="front" size={15} /> depan
        </button>
        <button type="button" className="chip-btn" onClick={() => onLayer(st.id, -1)}>
          <Icon name="back" size={15} /> belakang
        </button>
        <button type="button" className="chip-btn" onClick={() => onDuplicate(st.id)}>
          <Icon name="copy" size={15} /> duplikat
        </button>
        {packOn && (
          <button type="button" className="chip-btn" onClick={() => onToHeader(st.id)}>
            ↑ taruh di header
          </button>
        )}
      </div>
      <button type="button" className="btn-3d red" onClick={() => onPeel(st.id)}>
        <Icon name="peel" size={18} strokeWidth={2.2} /> Cabut dari kertas
      </button>
    </>
  );
}

/* =================== kartu pos (latar / header / teks) =================== */

const BG_PRESETS = [
  ['#fde4ef', '#fff7fb'],
  ['#4aa3f5', '#86c5ff'],
  ['#e5f3c9', '#fbfdf0'],
  ['#ffe2b8', '#fff6e8'],
  ['#141414', '#262626'],
];

export function Postcard({ tab, setTab, bg, setBg, pack, setPack, onAddText, onUploadKind, onAddCard, onGenerate, jobs = [] }) {
  return (
    <section className="postcard" aria-label="Gaya kertas stiker">
      <div className="pc-tabs" role="tablist">
        {[
          ['bg', 'Latar'],
          ['header', 'Header'],
          ['text', '+ Teks'],
          ['ai', '✦ Prompt'],
          ['card', 'Kartu'],
          ['dress', 'Dandan'],
        ].map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="pc-body">
        <span className="pc-stamp" aria-hidden>
          <Star size={30} />
          <small>POS</small>
        </span>
        <span className="pc-postmark" aria-hidden>
          STIKERIN · 2026
        </span>
        {tab === 'bg' && <BgTab bg={bg} setBg={setBg} />}
        {tab === 'header' && <HeaderTab pack={pack} setPack={setPack} goText={() => setTab('text')} />}
        {tab === 'text' && <TextTab onAdd={onAddText} packOn={pack.enabled} />}
        {tab === 'ai' && <PromptTab onGenerate={onGenerate} />}
        {tab === 'card' && <CardTab onAdd={onAddCard} packOn={pack.enabled} />}
        {tab === 'dress' && <DressTab onUpload={onUploadKind} jobs={jobs} />}
      </div>
    </section>
  );
}

export function BgTab({ bg, setBg }) {
  return (
    <div className="pc-content">
      <h3 className="pc-title">Latar kertas</h3>
      <Pills
        label="Jenis latar"
        value={bg.type}
        onChange={(type) => setBg({ ...bg, type })}
        options={[
          ['none', 'Kosong'],
          ['color', 'Warna'],
          ['stripes', 'Garis'],
          ['image', 'Foto'],
        ]}
      />
      {bg.type === 'none' && <p className="pc-hint">Transparan. Hasil download jadi PNG tanpa latar.</p>}
      {(bg.type === 'color' || bg.type === 'stripes') && (
        <>
          <div className="swatches" role="radiogroup" aria-label="Preset latar">
            {BG_PRESETS.map(([a, b]) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={bg.color === a}
                className={`swatch ${bg.color === a ? 'on' : ''}`}
                style={{ background: bg.type === 'stripes' ? `repeating-linear-gradient(90deg, ${a} 0 5px, ${b} 5px 10px)` : a }}
                aria-label={`Preset ${a}`}
                onClick={() => setBg({ ...bg, color: a, color2: b })}
              />
            ))}
          </div>
          <div className="row-btns">
            <ColorDot label="warna" value={bg.color} onChange={(color) => setBg({ ...bg, color })} />
            {bg.type === 'stripes' && <ColorDot label="warna 2" value={bg.color2} onChange={(color2) => setBg({ ...bg, color2 })} />}
          </div>
        </>
      )}
      {bg.type === 'image' && <ImagePick label="upload foto latar" image={bg.image} onPick={(image) => setBg({ ...bg, image })} onClear={() => setBg({ ...bg, image: null })} />}
    </div>
  );
}

export function HeaderTab({ pack, setPack, goText }) {
  const set = (patch) => setPack({ ...pack, ...patch });
  return (
    <div className="pc-content">
      <h3 className="pc-title">Header pack</h3>
      <Toggle label="Mode sticker pack" sub="header di atas + lubang gantungan" checked={pack.enabled} onChange={(enabled) => set({ enabled })} />
      {pack.enabled && (
        <>
          <Pills label="Desain header" value={pack.type} onChange={(type) => set({ type })} options={[['plain', 'Bikin di sini'], ['image', 'Upload desain']]} />
          {pack.type === 'plain' ? (
            <>
              <label className="field">
                <span className="ctl-label">Judul</span>
                <input className="text-in" value={pack.title} maxLength={32} onChange={(e) => set({ title: e.target.value })} />
              </label>
              <div className="field-2">
                <label className="field">
                  <span className="ctl-label">Akun / nama</span>
                  <input className="text-in" value={pack.handle} maxLength={24} placeholder="@akunmu" onChange={(e) => set({ handle: e.target.value })} />
                </label>
                <label className="field">
                  <span className="ctl-label">Subjudul</span>
                  <input className="text-in" value={pack.subtitle} maxLength={30} placeholder="opsional" onChange={(e) => set({ subtitle: e.target.value })} />
                </label>
              </div>
              <div className="ctl">
                <span className="ctl-label">Font judul</span>
                <Pills
                  small
                  label="Font judul"
                  value={pack.font}
                  onChange={(font) => set({ font })}
                  options={[
                    ['retro', 'Retro', { fontFamily: 'Caprasimo' }],
                    ['bubble', 'Bubble', { fontFamily: 'Titan One' }],
                    ['script', 'Script', { fontFamily: 'Pacifico' }],
                    ['round', 'Bulat', { fontFamily: 'Fredoka', fontWeight: 700 }],
                  ]}
                />
              </div>
              <div className="ctl">
                <span className="ctl-label">Posisi teks</span>
                <Pills small label="Posisi teks" value={pack.align} onChange={(align) => set({ align })} options={[['center', 'Tengah'], ['left', 'Kiri']]} />
              </div>
              <div className="row-btns">
                <ColorDot label="header" value={pack.color} onChange={(color) => set({ color })} />
                <ColorDot label="teks" value={pack.textColor} onChange={(textColor) => set({ textColor })} />
                {pack.pattern !== 'none' && <ColorDot label="motif" value={pack.patternColor} onChange={(patternColor) => set({ patternColor })} />}
              </div>
              <Pills small label="Motif header" value={pack.pattern} onChange={(pattern) => set({ pattern })} options={[['none', 'Polos'], ['stars', 'Bintang'], ['dots', 'Titik']]} />
            </>
          ) : (
            <>
              <ImagePick label="upload desain header" image={pack.image} onPick={(image) => set({ image })} onClear={() => set({ image: null })} />
              <p className="pc-hint">Ukuran ideal 2000 × 600 px (rasio 10:3).</p>
            </>
          )}
          <Toggle label="Lubang gantungan" checked={pack.hole} onChange={(hole) => set({ hole })} />
          <Toggle label="Kilau plastik" checked={pack.sheen} onChange={(sheen) => set({ sheen })} />
          <button type="button" className="note-link" onClick={goText}>
            mau tambah teks/stiker kecil di header? →
          </button>
        </>
      )}
    </div>
  );
}

export function TextTab({ onAdd, packOn }) {
  const [text, setText] = useState('13\n12');
  const [style, setStyle] = useState('bubble');
  const [fill, setFill] = useState('#8be04e');
  const [stroke, setStroke] = useState('#ff4fa3');
  const [busy, setBusy] = useState(false);
  const add = async (where) => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onAdd({ text, style, fill, stroke: stroke === 'none' ? null : stroke, where });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="pc-content">
      <h3 className="pc-title">Stiker teks</h3>
      <p className="pc-hint">Tulisan jadi stiker berpinggiran. Bisa ditaruh di header atau di mana aja.</p>
      <label className="field">
        <span className="ctl-label">Tulisan (Enter = baris baru)</span>
        <textarea className="text-in" rows={2} maxLength={60} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <Pills
        small
        label="Gaya tulisan"
        value={style}
        onChange={setStyle}
        options={Object.entries(TEXT_STYLES).map(([k, s]) => [k, s.label, { fontFamily: { bubble: 'Titan One', script: 'Pacifico', round: 'Fredoka', retro: 'Caprasimo' }[k] }])}
      />
      <div className="ctl">
        <span className="ctl-label">Warna huruf</span>
        <Swatches label="Warna huruf" colors={TEXT_SWATCHES} value={fill} onChange={setFill} />
      </div>
      <div className="ctl">
        <span className="ctl-label">Garis huruf</span>
        <Pills
          small
          label="Garis huruf"
          value={stroke}
          onChange={setStroke}
          options={[
            ['none', 'Tanpa'],
            ['#ff4fa3', 'Pink'],
            ['#1b1840', 'Gelap'],
            ['#ffffff', 'Putih'],
          ]}
        />
      </div>
      <div className="row-btns">
        {packOn && (
          <button type="button" className="btn-3d green" disabled={busy} onClick={() => add('header')}>
            Tempel di header
          </button>
        )}
        <button type="button" className="btn-3d blue" disabled={busy} onClick={() => add('body')}>
          Tempel di kertas
        </button>
      </div>
    </div>
  );
}

/* =================== prompt → stiker (Gemini) =================== */

const PROMPT_STYLES = [
  ['cute', 'Kartun lucu'],
  ['y2k', 'Y2K'],
  ['doodle', 'Doodle'],
  ['clay', '3D clay'],
  ['watercolor', 'Cat air'],
  ['pixel', 'Pixel'],
];
const PROMPT_IDEAS = ['kucing pakai topi stroberi', 'boba tea senyum', 'kelinci bawa bunga tulip', 'tulisan "yippi!" warna-warni'];

export function PromptTab({ onGenerate }) {
  const [enabled, setEnabled] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('cute');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [stage, setStage] = useState('');
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    aiStatus().then((st) => setEnabled(st.image));
  }, []);
  // hitung detik selama nunggu AI, biar ketauan masih jalan
  useEffect(() => {
    if (!busy) return;
    setSecs(0);
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [busy]);

  const go = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    setErr('');
    setStage('Ngirim ide ke AI…');
    try {
      await onGenerate({ prompt: prompt.trim(), style, onStage: setStage });
    } catch (e) {
      setErr(e.message || 'Gagal bikin stiker');
    } finally {
      setBusy(false);
      setStage('');
    }
  };

  return (
    <div className="pc-content">
      <h3 className="pc-title">Stiker dari prompt</h3>
      {enabled === false && (
        <p className="pc-hint warn">
          Fitur ini belum aktif: isi <code>CLOUDFLARE_ACCOUNT_ID</code> dan <code>CLOUDFLARE_API_TOKEN</code> di server dulu (caranya ada di README).
        </p>
      )}
      <label className="field">
        <span className="ctl-label">Mau stiker apa?</span>
        <textarea
          className="text-in"
          rows={3}
          maxLength={400}
          placeholder="contoh: kucing oren pakai topi stroberi lagi minum boba"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </label>
      <div className="row-btns">
        {PROMPT_IDEAS.map((idea) => (
          <button key={idea} type="button" className="chip-btn" onClick={() => setPrompt(idea)}>
            {idea}
          </button>
        ))}
      </div>
      <div className="ctl">
        <span className="ctl-label">Gaya gambar</span>
        <Pills small label="Gaya gambar" value={style} onChange={setStyle} options={PROMPT_STYLES} />
      </div>
      <button type="button" className="btn-3d pink" disabled={busy || !prompt.trim() || enabled === false} onClick={go}>
        {busy ? (
          <>
            <span className="spinner" aria-hidden /> Lagi digambar…
          </>
        ) : (
          '✦ Bikin stiker'
        )}
      </button>
      {busy && (
        <div className="ai-progress" role="status" aria-live="polite">
          <div className="ai-skeleton" aria-hidden />
          <div className="ai-progress-text">
            <b>{stage}</b>
            <span>{secs} detik · biasanya 10–40 detik</span>
          </div>
        </div>
      )}
      {err && <p className="scan-status err">{err}</p>}
      <p className="pc-hint">Gambarnya dibikin AI (gratis), terus otomatis dipotong & dikasih pinggiran putih.</p>
    </div>
  );
}

/* =================== kartu (photocard) =================== */

export function CardTab({ onAdd, packOn }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [photo, setPhoto] = useState(null); // { img, isCut }
  const [aiCut, setAiCut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [o, setO] = useState({
    size: 'portrait',
    pattern: 'gingham',
    color: 'pink',
    frame: 'rounded',
    text: 'my\nfavorite',
    font: 'script',
    textColor: '#d6246e',
    textPos: 'bottom',
    deco: 'stars',
    innerLine: false,
  });
  const set = (patch) => setO((p) => ({ ...p, ...patch }));

  // muat foto (dipotong AI kalau dipilih)
  useEffect(() => {
    if (!file) {
      setPhoto(null);
      return;
    }
    let alive = true;
    (async () => {
      setBusy(true);
      try {
        if (aiCut) {
          const cut = await fileToCutout(file, { useAI: true });
          if (alive) setPhoto({ img: cut, isCut: true });
        } else {
          const url = await fileToDataURL(file);
          const img = await loadImage(url);
          if (alive) setPhoto({ img, isCut: false });
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [file, aiCut]);

  // pratinjau langsung
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      const c = await renderCard(o, photo);
      if (alive) setPreview(c.toDataURL('image/png'));
    }, 120);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [o, photo]);

  const pickColor = (name) => {
    const c = CARD_COLORS.find((x) => x[0] === name);
    set({ color: name, textColor: c[3] });
  };

  const add = async (where) => {
    const c = await renderCard(o, photo);
    const name = (o.text || '').replace(/\n/g, ' ').trim().slice(0, 20) || 'kartu';
    onAdd({ canvas: c, name, where, size: o.size });
  };

  return (
    <div className="pc-content">
      <h3 className="pc-title">Stiker kartu</h3>
      <div className="card-preview">{preview ? <img src={preview} alt="Pratinjau kartu" /> : <span className="spinner" />}</div>

      <div className="row-btns">
        <button type="button" className="chip-btn" onClick={() => fileRef.current.click()}>
          <Icon name="photo" size={15} /> {file ? 'Ganti foto' : 'Tambah foto'}
        </button>
        {file && (
          <button type="button" className="chip-btn danger" onClick={() => setFile(null)}>
            Hapus foto
          </button>
        )}
        {busy && <span className="spinner" aria-label="Memproses foto" />}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) setFile(f);
        }}
      />
      {file && <Toggle label="Potong orangnya (AI)" sub="orangnya ditaruh langsung di atas motif" checked={aiCut} onChange={setAiCut} />}

      <div className="ctl">
        <span className="ctl-label">Bentuk kartu</span>
        <Pills small label="Bentuk kartu" value={o.size} onChange={(size) => set({ size })} options={[['portrait', 'Potret'], ['square', 'Kotak'], ['landscape', 'Lanskap'], ['banner', 'Banner']]} />
      </div>
      {file && !aiCut && (
        <div className="ctl">
          <span className="ctl-label">Bingkai foto</span>
          <Pills small label="Bingkai foto" value={o.frame} onChange={(frame) => set({ frame })} options={[['rounded', 'Rounded'], ['oval', 'Oval'], ['arch', 'Lengkung'], ['heart', 'Hati']]} />
        </div>
      )}
      <div className="ctl">
        <span className="ctl-label">Motif latar</span>
        <Pills small label="Motif latar" value={o.pattern} onChange={(pattern) => set({ pattern })} options={[['gingham', 'Gingham'], ['solid', 'Polos'], ['stripes', 'Garis'], ['dots', 'Polkadot'], ['gradient', 'Gradasi']]} />
      </div>
      <div className="ctl">
        <span className="ctl-label">Warna kartu</span>
        <div className="swatches" role="radiogroup" aria-label="Warna kartu">
          {CARD_COLORS.map(([name, main]) => (
            <button key={name} type="button" role="radio" aria-checked={o.color === name} className={`swatch ${o.color === name ? 'on' : ''}`} style={{ background: main }} aria-label={name} onClick={() => pickColor(name)} />
          ))}
        </div>
      </div>
      <label className="field">
        <span className="ctl-label">Tulisan (Enter = baris baru, kosongin kalau ga mau)</span>
        <textarea className="text-in" rows={2} maxLength={90} value={o.text} onChange={(e) => set({ text: e.target.value })} />
      </label>
      <Pills small label="Font tulisan" value={o.font} onChange={(font) => set({ font })} options={Object.entries(CARD_FONTS).map(([k, f]) => [k, f.label, { fontFamily: f.css }])} />
      <div className="ctl">
        <span className="ctl-label">Warna tulisan</span>
        <Swatches label="Warna tulisan" colors={['#d6246e', '#1f4fa8', '#c0392b', '#2e7d32', '#6a3fc7', '#ffffff', '#1b1840', '#ffd60a']} value={o.textColor} onChange={(textColor) => set({ textColor })} />
      </div>
      {file && o.size !== 'banner' && (
        <div className="ctl">
          <span className="ctl-label">Posisi tulisan</span>
          <Pills small label="Posisi tulisan" value={o.textPos} onChange={(textPos) => set({ textPos })} options={[['bottom', 'Bawah'], ['top', 'Atas'], ['overlay', 'Di atas foto']]} />
        </div>
      )}
      <div className="ctl">
        <span className="ctl-label">Hiasan</span>
        <Pills small label="Hiasan" value={o.deco} onChange={(deco) => set({ deco })} options={[['none', 'Tanpa'], ['stars', 'Bintang'], ['hearts', 'Hati'], ['sparkle', 'Kilau']]} />
      </div>
      <Toggle label="Garis putus-putus di dalam" checked={o.innerLine} onChange={(innerLine) => set({ innerLine })} />
      <div className="row-btns">
        <button type="button" className="btn-3d pink" disabled={busy || !preview} onClick={() => add('body')}>
          Tempel kartu
        </button>
        {packOn && o.size === 'banner' && (
          <button type="button" className="btn-3d blue" disabled={busy || !preview} onClick={() => add('header')}>
            Tempel di header
          </button>
        )}
      </div>
    </div>
  );
}

/* =================== paper doll =================== */

function Outfit({ doll, stickers, onTakeOff, onRealistic }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    aiStatus().then((st) => setEnabled(st.tryOn));
  }, []);
  const realistic = async () => {
    setBusy(true);
    setErr('');
    try {
      await onRealistic(doll.id);
    } catch (e) {
      setErr(e.message || 'Gagal');
    } finally {
      setBusy(false);
    }
  };
  const items = SLOT_ORDER.filter((s) => doll.outfit?.[s]).map((slot) => [slot, stickers.find((x) => x.id === doll.outfit[slot])]).filter(([, it]) => it);
  return (
    <div className="outfit">
      <span className="ctl-label">Lagi dipakai {doll.anchors?.source === 'guess' && <small className="muted">(pose perkiraan)</small>}</span>
      {items.length === 0 ? (
        <p className="note-hand small">Seret stiker baju ke badannya ♡</p>
      ) : (
        <ul>
          {items.map(([slot, it]) => (
            <li key={slot}>
              <img src={it.url} alt="" />
              <span>{SLOT_LABEL[slot]}</span>
              <button type="button" className="chip-btn" onClick={() => onTakeOff(doll.id, slot)}>
                lepas
              </button>
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 && enabled && (
        <button type="button" className="btn-3d blue" disabled={busy} onClick={realistic}>
          {busy ? (
            <>
              <span className="spinner" aria-hidden /> AI lagi dandanin…
            </>
          ) : (
            '✦ Bikin versi realistis (AI)'
          )}
        </button>
      )}
      {items.length > 0 && enabled && !busy && <p className="pc-hint">Hasilnya jadi stiker baru di sebelahnya, stiker paper doll-nya tetap aman.</p>}
      {err && <p className="scan-status err">{err}</p>}
    </div>
  );
}

export function DressTab({ onUpload, jobs }) {
  const dollRef = useRef(null);
  const clothRef = useRef(null);
  const [kind, setKind] = useState('auto');
  const pick = (e, k) => {
    const files = [...e.target.files].filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (files.length) onUpload(files, k);
  };
  const busy = jobs.filter((j) => !j.error).length;
  return (
    <div className="pc-content">
      <h3 className="pc-title">Paper doll</h3>
      <ol className="dress-steps">
        <li>Upload foto <b>orang</b> (seluruh badan, berdiri tegak).</li>
        <li>Upload foto <b>baju / celana / sepatu / topi</b>.</li>
        <li>Seret bajunya ke badan orangnya, langsung kepake! Tarik lagi buat lepas.</li>
      </ol>
      <button type="button" className="btn-3d pink" onClick={() => dollRef.current.click()}>
        Upload orang
      </button>
      <div className="ctl">
        <span className="ctl-label">Jenis baju</span>
        <Pills
          small
          label="Jenis baju"
          value={kind}
          onChange={setKind}
          options={[['auto', 'Otomatis'], ['top', 'Atasan'], ['bottom', 'Bawahan'], ['dress', 'Dress'], ['outer', 'Outer'], ['shoes', 'Sepatu'], ['hat', 'Topi']]}
        />
        {kind === 'auto' && <p className="pc-hint">Otomatis = dipasang sesuai bagian badan tempat kamu lepasin (kepala, badan, pinggang, kaki).</p>}
      </div>
      <button type="button" className="btn-3d blue" onClick={() => clothRef.current.click()}>
        Upload baju
      </button>
      {busy > 0 && (
        <p className="scan-status">
          <span className="spinner" aria-hidden /> AI lagi motong {busy} foto…
        </p>
      )}
      <input ref={dollRef} type="file" accept="image/*" hidden onChange={(e) => pick(e, 'doll')} />
      <input ref={clothRef} type="file" accept="image/*" multiple hidden onChange={(e) => pick(e, kind)} />
    </div>
  );
}

/* =================== bottom sheet (HP) =================== */

export function BottomSheet({ title, onClose, children }) {
  const drag = useDragControls();
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      className="bsheet-back"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="bsheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%', transition: { type: 'spring', stiffness: 420, damping: 40 } }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        // usap bagian atas ke bawah buat nutup: ngikutin jari, dilepas -> nutup atau mantul balik
        drag="y"
        dragListener={false}
        dragControls={drag}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 1 }}
        dragMomentum={false}
        onDragEnd={(e, info) => {
          const h = e.target?.closest?.('.bsheet')?.offsetHeight || 400;
          if (info.offset.y > h * 0.3 || info.velocity.y > 600) onClose();
        }}
      >
        <header
          className="bsheet-head"
          onPointerDown={(e) => {
            if (!e.target.closest('button')) drag.start(e);
          }}
        >
          <span className="bsheet-grab" aria-hidden />
          <h2>{title}</h2>
          <button type="button" className="win-x" onClick={onClose} aria-label="Tutup">
            <Icon name="close" size={16} strokeWidth={2.8} />
          </button>
        </header>
        <div className="bsheet-body">{children}</div>
      </motion.div>
    </motion.div>
  );
}
