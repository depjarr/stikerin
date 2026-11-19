import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TARGETS, SHARE_TEXT, blobToFile, canShareFiles, copyImage, downloadBlob, nativeShare } from '../lib/share.js';
import Icon, { AppGlyph } from './Icons.jsx';

/**
 * Share sheet gaya iOS.
 * item = { title, blob, filename, extra?: [{ label, share, make: () => Promise<{blob, filename}> }] }
 */
export default function ShareSheet({ item, onClose, toast }) {
  // URL dibuat & dihapus di efek yang sama, biar aman walau efek jalan dua kali (StrictMode)
  const [url, setUrl] = useState(null);
  useEffect(() => {
    const u = URL.createObjectURL(item.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [item.blob]);
  const file = useMemo(() => blobToFile(item.blob, item.filename), [item]);
  const canNative = canShareFiles(file);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef(null);

  const close = () => {
    setClosing(true);
    setTimeout(onClose, 220);
  };

  useEffect(() => {
    sheetRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doNative = async () => {
    try {
      await nativeShare(file);
    } catch (e) {
      if (e.name !== 'AbortError') toast('Gagal bagikan. Coba simpan gambarnya dulu ya.');
    }
  };

  const via = async (key) => {
    // HP: share sheet bawaan bisa kirim gambarnya langsung ke WA/X/dll.
    if (canNative) return doNative();
    // Laptop: web ga bisa nempelin gambar langsung, jadi download + salin, lalu buka aplikasinya.
    downloadBlob(item.blob, item.filename);
    let copied = false;
    try {
      await copyImage(item.blob);
      copied = true;
    } catch {}
    window.open(TARGETS[key].url(SHARE_TEXT), '_blank', 'noopener');
    toast(copied ? `Gambar disalin. Tinggal Ctrl+V di ${TARGETS[key].label}.` : `Gambar tersimpan. Lampirkan di ${TARGETS[key].label}.`);
  };

  const copy = async () => {
    try {
      await copyImage(item.blob);
      toast('Gambar disalin');
    } catch {
      toast('Browser ini ga bisa salin gambar');
    }
  };

  const runExtra = async (ex) => {
    setBusy(true);
    try {
      const { blob, filename } = await ex.make();
      const f = blobToFile(blob, filename);
      if (ex.share && canShareFiles(f)) await nativeShare(f).catch(() => {});
      else {
        downloadBlob(blob, filename);
        toast('Stiker WhatsApp tersimpan');
      }
    } finally {
      setBusy(false);
    }
  };

  const kb = Math.max(1, Math.round(item.blob.size / 1024));

  return (
    <div className={`sheet-back ${closing ? 'closing' : ''}`} onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabIndex={-1} ref={sheetRef}>
        <span className="grabber" aria-hidden />
        <header className="sheet-head">
          <span className="sheet-thumb">
            {url && <img src={url} alt="" />}
          </span>
          <span className="sheet-meta">
            <strong id="sheet-title">{item.title}</strong>
            <small>
              {item.filename} · {kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`}
            </small>
          </span>
          <button type="button" className="sheet-close" onClick={close} aria-label="Tutup">
            <Icon name="close" size={16} strokeWidth={2.6} />
          </button>
        </header>

        <div className="sheet-preview">
          {url && <img src={url} alt="Pratinjau" />}
        </div>

        <div className="app-row">
          {Object.entries(TARGETS).map(([key, t]) => (
            <button key={key} type="button" className="app-item" onClick={() => via(key)}>
              <span className={`app-icon ai-${key}`}>
                <AppGlyph app={key} />
              </span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="group sheet-group">
          {canNative && (
            <button type="button" className="group-row group-action" onClick={doNative}>
              Aplikasi lainnya… <Icon name="share" />
            </button>
          )}
          <button type="button" className="group-row group-action" onClick={copy}>
            Salin gambar <Icon name="copy" />
          </button>
          <button type="button" className="group-row group-action" onClick={() => downloadBlob(item.blob, item.filename)}>
            Simpan PNG <Icon name="download" />
          </button>
          {item.extra?.map((ex) => (
            <button key={ex.label} type="button" className="group-row group-action" disabled={busy} onClick={() => runExtra(ex)}>
              {ex.label} <Icon name="sparkle" />
            </button>
          ))}
        </div>

        <p className="sheet-foot">
          {canNative
            ? 'Pilih WhatsApp, X, Instagram, atau Telegram dari menu bagikan HP kamu.'
            : 'Di laptop, gambar otomatis disimpan & disalin — tinggal paste di WhatsApp Web atau X.'}
        </p>
      </div>
    </div>
  );
}
