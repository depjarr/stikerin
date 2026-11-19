// Helper bersama buat fungsi server Gemini (Google AI Studio).
// API key cuma dibaca di server (env GEMINI_API_KEY), ga pernah dikirim ke browser.
import { GoogleGenAI } from '@google/genai';

const unique = (list) => [...new Set(list.filter(Boolean))];

// Model bisa diganti lewat env. Kalau satu model ga ada / ga boleh, coba model berikutnya.
export const IMAGE_MODELS = unique([process.env.GEMINI_IMAGE_MODEL, 'gemini-3.1-flash-image', 'gemini-2.5-flash-image']);
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

/** Jalankan fn(model) dengan model pertama yang berhasil. */
export async function withModels(models, fn) {
  let last;
  for (const model of models) {
    try {
      return await fn(model);
    } catch (e) {
      last = e;
      if (!isModelProblem(e)) throw e;
    }
  }
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
  const quota = /quota|RESOURCE_EXHAUSTED|rate/i.test(msg);
  res.status(quota ? 429 : status).json({ error: quota ? 'Kuota Gemini habis atau kebanyakan permintaan. Coba lagi nanti.' : msg });
}

export function requirePost(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Pakai POST' });
    return false;
  }
  return true;
}
