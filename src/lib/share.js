export const SHARE_TEXT = 'Liat stiker buatanku ✨ (dibikin pake Stikerin)';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function blobToFile(blob, filename) {
  return new File([blob], filename, { type: blob.type || 'image/png' });
}

export function canShareFiles(file) {
  try {
    return !!(navigator.canShare && navigator.canShare({ files: [file] }));
  } catch {
    return false;
  }
}

/** Share sheet bawaan HP (WA, X, IG, Telegram, dll muncul di sini). */
export async function nativeShare(file, text = SHARE_TEXT) {
  await navigator.share({ files: [file], title: 'Stikerin', text });
}

export async function copyImage(blob) {
  // Clipboard cuma nerima PNG
  let png = blob;
  if (blob.type !== 'image/png') {
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    png = await new Promise((r) => c.toBlob(r, 'image/png'));
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}

export const TARGETS = {
  whatsapp: { label: 'WhatsApp', url: (t) => `https://wa.me/?text=${encodeURIComponent(t)}` },
  x: { label: 'X', url: (t) => `https://x.com/intent/post?text=${encodeURIComponent(t)}` },
  telegram: { label: 'Telegram', url: (t) => `https://t.me/share/url?url=${encodeURIComponent(location.origin)}&text=${encodeURIComponent(t)}` },
  facebook: { label: 'Facebook', url: () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(location.origin)}` },
};
