import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icons.jsx';
import { Star } from './Deco.jsx';

/**
 * Layar kamera buat "scan" barang jadi stiker.
 * Yang diambil cuma isi kotak scan, terus dikirim ke AI.
 */
export default function CameraScanner({ onClose, onFiles, jobs, defaults, setDefaults }) {
  const videoRef = useRef(null);
  const frameRef = useRef(null);
  const galleryRef = useRef(null);
  const streamRef = useRef(null);
  const [facing, setFacing] = useState('environment');
  const [status, setStatus] = useState('loading'); // loading | live | error
  const [shots, setShots] = useState([]);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      setStatus('loading');
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        const v = videoRef.current;
        v.srcObject = stream;
        await v.play().catch(() => {});
        setStatus('live');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }
    start();
    return () => {
      cancelled = true;
    };
  }, [facing]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onClose]);

  const capture = () => {
    const v = videoRef.current;
    if (status !== 'live' || !v.videoWidth) return;
    const vr = v.getBoundingClientRect();
    const fr = frameRef.current.getBoundingClientRect();
    // video ditampilin object-fit: cover → hitung area kotak scan di piksel video
    const scale = Math.max(vr.width / v.videoWidth, vr.height / v.videoHeight);
    const offX = (vr.width - v.videoWidth * scale) / 2;
    const offY = (vr.height - v.videoHeight * scale) / 2;
    const mirrored = facing === 'user';
    let fx = fr.left - vr.left;
    if (mirrored) fx = vr.width - (fx + fr.width);
    const sx = Math.max(0, (fx - offX) / scale);
    const sy = Math.max(0, (fr.top - vr.top - offY) / scale);
    const sw = Math.min(v.videoWidth - sx, fr.width / scale);
    const sh = Math.min(v.videoHeight - sy, fr.height / scale);
    const c = document.createElement('canvas');
    c.width = Math.round(sw);
    c.height = Math.round(sh);
    const ctx = c.getContext('2d');
    if (mirrored) {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
    setFlash(true);
    setTimeout(() => setFlash(false), 280);
    const thumb = c.toDataURL('image/jpeg', 0.6);
    c.toBlob(
      (b) => {
        if (!b) return;
        const file = new File([b], `scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setShots((s) => [...s, thumb]);
        onFiles([file]);
      },
      'image/jpeg',
      0.92
    );
  };

  const pending = jobs.filter((j) => !j.error).length;

  return (
    <div className={`scanner ${flash ? 'flash' : ''}`} role="dialog" aria-modal="true" aria-label="Scan foto jadi stiker">
      <video ref={videoRef} className={`scan-video ${facing === 'user' ? 'mirror' : ''}`} playsInline muted />
      {status !== 'live' && (
        <div className="scan-fallback">
          {status === 'loading' ? (
            <p>Nyalain kamera…</p>
          ) : (
            <>
              <Star size={56} />
              <p>
                <b>Kamera ga bisa kebuka.</b>
                <br />
                Izinin akses kamera di browser, atau ambil foto dari galeri aja.
              </p>
              <button type="button" className="btn-3d pink" onClick={() => galleryRef.current.click()}>
                Pilih dari galeri
              </button>
            </>
          )}
        </div>
      )}

      <header className="scan-top">
        <button type="button" className="scan-round" onClick={onClose} aria-label="Tutup kamera">
          <Icon name="close" size={22} strokeWidth={2.4} />
        </button>
        <span className="scan-title">Scan stiker</span>
        <button
          type="button"
          className={`scan-ai ${defaults.useAI ? 'on' : ''}`}
          onClick={() => setDefaults({ ...defaults, useAI: !defaults.useAI })}
          aria-pressed={defaults.useAI}
          title="AI hapus latar foto"
        >
          AI {defaults.useAI ? 'ON' : 'OFF'}
        </button>
      </header>

      {status !== 'error' && (
      <div className="scan-frame" ref={frameRef}>
        <i className="c tl" />
        <i className="c tr" />
        <i className="c bl" />
        <i className="c br" />
        {status === 'live' && <span className="scan-line" />}
        <span className="scan-note">
          <Star size={22} className="sn-star a" />
          {shots.length ? `${shots.length} foto ke-scan!` : 'taruh barangnya di sini'}
          <Star size={18} className="sn-star b" />
        </span>
      </div>
      )}

      <div className="scan-tip">
        {defaults.useAI
          ? 'Taruh barang di dalam kotak, pastikan terang & latarnya polos biar AI gampang motong.'
          : 'AI mati: foto bakal dipotong jadi bentuk ' + ({ rounded: 'rounded', circle: 'bulat', rect: 'kotak' }[defaults.shape] || 'rounded') + '.'}
        {pending > 0 && <b> · {pending} lagi diproses AI…</b>}
      </div>

      <footer className="scan-bottom">
        <button type="button" className="scan-gallery" onClick={() => galleryRef.current.click()} aria-label="Ambil dari galeri">
          {shots.length ? <img src={shots[shots.length - 1]} alt="" /> : <Icon name="photo" size={26} />}
          {shots.length > 0 && <span className="scan-count">{shots.length}</span>}
        </button>
        <button type="button" className="shutter" onClick={capture} disabled={status !== 'live'} aria-label="Jepret">
          <span />
        </button>
        {shots.length > 0 ? (
          <button type="button" className="scan-done" onClick={onClose}>
            Selesai
          </button>
        ) : (
          <button type="button" className="scan-round" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} aria-label="Ganti kamera depan/belakang">
            <Icon name="flip" size={24} />
          </button>
        )}
        <button type="button" className="scan-alt" onClick={() => galleryRef.current.click()}>
          Kamera ga mau kebuka? Pilih dari galeri
        </button>
      </footer>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = [...e.target.files].filter((f) => f.type.startsWith('image/'));
          e.target.value = '';
          if (files.length) {
            onFiles(files);
            onClose();
          }
        }}
      />
    </div>
  );
}
