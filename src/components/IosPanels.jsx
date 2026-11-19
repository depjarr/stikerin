// Panel studio gaya iOS: menu "Tambah", menu "Gaya kertas", dan panel "Kirim & simpan".
import React, { useRef } from 'react';
import Icon from './Icons.jsx';
import { BgTab, HeaderTab, TextTab, PromptTab, CardTab, DressTab, Toggle, Pills, Slider } from './Panels.jsx';

function Tabs({ value, onChange, options, label }) {
  return (
    <div className="ios-tabs" role="tablist" aria-label={label}>
      {options.map(([k, text, icon]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>
          {icon && <Icon name={icon} size={16} strokeWidth={2.1} />}
          {text}
        </button>
      ))}
    </div>
  );
}

function FotoTab({ onScan, onFiles, defaults, setDefaults, jobs }) {
  const ref = useRef(null);
  const pending = jobs.filter((j) => !j.error);
  const failed = jobs.find((j) => j.error);
  return (
    <div className="pc-content">
      <div className="ios-btn-row">
        <button type="button" className="ios-btn filled" onClick={onScan}>
          <Icon name="camera" size={18} strokeWidth={2.2} /> Kamera
        </button>
        <button type="button" className="ios-btn tinted" onClick={() => ref.current.click()}>
          <Icon name="photo" size={18} strokeWidth={2.2} /> Galeri
        </button>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = [...e.target.files].filter((f) => f.type.startsWith('image/'));
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
      {pending.length > 0 && (
        <div className="ai-progress" role="status">
          <div className="ai-skeleton" aria-hidden />
          <div className="ai-progress-text">
            <b>{pending[0].status}</b>
            <span>
              {pending.length} foto · {Math.round((pending[0].pct || 0) * 100)}%
            </span>
          </div>
        </div>
      )}
      {failed && <p className="scan-status err">{failed.status}</p>}
      <div className="ios-group">
        <Toggle label="AI hapus latar" sub="foto ga dikirim ke server" checked={defaults.useAI} onChange={(useAI) => setDefaults({ ...defaults, useAI })} />
        {!defaults.useAI && (
          <div className="ios-row">
            <Pills small label="Bentuk stiker" value={defaults.shape} onChange={(shape) => setDefaults({ ...defaults, shape })} options={[['rounded', 'Rounded'], ['circle', 'Bulat'], ['rect', 'Kotak']]} />
          </div>
        )}
        <div className="ios-row">
          <Slider label="Tebal pinggiran" unit="px" value={defaults.outline} min={0} max={40} onChange={(outline) => setDefaults({ ...defaults, outline })} />
        </div>
      </div>
    </div>
  );
}

/** Menu "Tambah": semua cara bikin stiker baru. */
export function AddPanel({ tab, setTab, packOn, onScan, onFiles, defaults, setDefaults, jobs, onAddText, onAddCard, onGenerate, onUploadKind }) {
  return (
    <section className="ios-card" aria-label="Tambah stiker">
      <h2 className="ios-card-title">Tambah stiker</h2>
      <Tabs
        label="Jenis stiker baru"
        value={tab}
        onChange={setTab}
        options={[
          ['foto', 'Foto', 'camera'],
          ['ai', 'Prompt', 'sparkle'],
          ['teks', 'Teks', 'text'],
          ['kartu', 'Kartu', 'grid'],
          ['dandan', 'Dandan', 'peel'],
        ]}
      />
      {tab === 'foto' && <FotoTab onScan={onScan} onFiles={onFiles} defaults={defaults} setDefaults={setDefaults} jobs={jobs} />}
      {tab === 'ai' && <PromptTab onGenerate={onGenerate} />}
      {tab === 'teks' && <TextTab onAdd={onAddText} packOn={packOn} />}
      {tab === 'kartu' && <CardTab onAdd={onAddCard} packOn={packOn} />}
      {tab === 'dandan' && <DressTab onUpload={onUploadKind} jobs={jobs} />}
    </section>
  );
}

/** Menu "Gaya kertas": latar & header pack. */
export function StylePanel({ tab, setTab, bg, setBg, pack, setPack, goText }) {
  return (
    <section className="ios-card" aria-label="Gaya kertas">
      <h2 className="ios-card-title">Gaya kertas</h2>
      <Tabs
        label="Bagian kertas"
        value={tab}
        onChange={setTab}
        options={[
          ['bg', 'Latar'],
          ['header', 'Header'],
        ]}
      />
      {tab === 'bg' && <BgTab bg={bg} setBg={setBg} />}
      {tab === 'header' && <HeaderTab pack={pack} setPack={setPack} goText={goText} />}
    </section>
  );
}

function Row({ icon, title, sub, onClick, disabled, danger }) {
  return (
    <button type="button" className={`ios-list-row ${danger ? 'danger' : ''}`} onClick={onClick} disabled={disabled}>
      <span className="ios-list-icon" aria-hidden>
        <Icon name={icon} size={18} strokeWidth={2.1} />
      </span>
      <span className="ios-list-text">
        <b>{title}</b>
        {sub && <small>{sub}</small>}
      </span>
      <Icon name="chevron" size={16} className="ios-chev" />
    </button>
  );
}

/** Panel "Kirim & simpan". */
export function SharePanel({ selected, placedCount, total, busy, onShareSticker, onShareSet, onDownload, onPrint, onWaPack, onClear }) {
  return (
    <section className="ios-card" aria-label="Kirim dan simpan">
      <h2 className="ios-card-title">Kirim & simpan</h2>
      <div className="ios-list">
        <Row icon="share" title="Kirim stiker ini" sub={selected ? selected.name : 'pilih stiker dulu'} disabled={!selected} onClick={() => onShareSticker(selected.id)} />
        <Row icon="share" title="Kirim 1 set" sub={`${placedCount} stiker di kertas`} disabled={!placedCount || busy} onClick={onShareSet} />
        <Row icon="download" title="Simpan PNG" sub="gambar kertas stiker" disabled={busy} onClick={onDownload} />
        <Row icon="grid" title="Cetak A4" sub="ada garis potong, siap print" disabled={!total || busy} onClick={onPrint} />
        <Row icon="sparkle" title="Paket stiker WhatsApp" sub={total < 3 ? 'butuh minimal 3 stiker' : `${Math.min(total, 30)} stiker · .zip`} disabled={total < 3 || busy} onClick={onWaPack} />
      </div>
      <div className="ios-list">
        <Row icon="trash" title="Kosongin kertas" sub="bisa dibatalin pakai ↶" danger disabled={!total} onClick={onClear} />
      </div>
    </section>
  );
}
