// Helper bersama buat fungsi server Gemini (Google AI Studio).
// API key cuma dibaca di server (env GEMINI_API_KEY), ga pernah dikirim ke browser.
import { GoogleGenAI } from '@google/genai';

const unique = (list) => [...new Set(list.filter(Boolean))];

// Model bisa diganti lewat env. Kalau satu model ga ada / ga boleh, coba model berikutnya.
// Urutan: model gambar paling murah dulu (Flash Lite Image), baru yang lebih mahal.
export const IMAGE_MODELS = unique([process.env.GEMINI_IMAGE_MODEL, 'gemini-3.1-flash-lite-image', 'gemini-3.1-flash-image', 'gemini-2.5-flash-image']);
export const TEXT_MODELS = unique([process.env.GEMINI_TEXT_MODEL, 'gemini-3.5-flash-lite', 'gemini-2.5-flash']);

let client;
export function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY belum diisi');
    err.status = 503;
    throw err;
  }
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

function isModelProblem(e) {
  const msg = String(e?.message || '');
  return e?.status === 404 || /not found|not supported|unsupported|does not exist|is not available/i.test(msg);
}

export function isQuota(e) {
  return e?.status === 429 || /quota|RESOURCE_EXHAUSTED|rate limit/i.test(String(e?.message || ''));
}

/** Jalankan fn(model) dengan model pertama yang berhasil. Kuota tiap model terpisah, jadi kuota habis juga lanjut ke model berikutnya. */
export async function withModels(models, fn) {
  let last;
  const tried = [];
  for (const model of models) {
    try {
      return await fn(model);
    } catch (e) {
      last = e;
      tried.push(model);
      if (!isModelProblem(e) && !isQuota(e)) throw e;
    }
  }
  if (last) last.triedModels = tried;
  throw last;
}

export function stripDataUrl(s) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(s || '');
  return m ? { mimeType: m[1], data: m[2] } : { mimeType: 'image/png', data: s };
}

export function imagePart(dataUrl) {
  const { mimeType, data } = stripDataUrl(dataUrl);
  return { inlineData: { mimeType, data } };
}

/** Ambil gambar pertama dari respons generateContent. */
export function firstImage(resp) {
  for (const cand of resp?.candidates || []) {
    for (const part of cand?.content?.parts || []) {
      if (part.inlineData?.data) return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
    }
  }
  return null;
}

export function sendError(res, e) {
  const status = e?.status && e.status >= 400 && e.status < 600 ? e.status : 500;
  const msg = String(e?.message || 'Error');
  console.error('[gemini]', e?.triedModels || '', msg.slice(0, 800));
  if (isQuota(e)) {
    // "limit: 0" / free_tier = model ini memang ga dapet kuota gratis di akun ini
    const noFree = /limit:\s*0\b|free_tier/i.test(msg);
    return res.status(429).json({
      code: noFree ? 'no_free_quota' : 'quota',
      error: noFree
        ? 'Model gambar Gemini ga termasuk kuota gratis akunmu. Aktifin billing di Google AI Studio dulu ya.'
        : 'Kuota Gemini lagi habis (batas per menit/hari). Coba lagi beberapa saat lagi.',
    });
  }
  res.status(status).json({ error: msg });
}

export function requirePost(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Pakai POST' });
    return false;
  }
  return true;
}
