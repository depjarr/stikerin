// Penyedia gambar buat fitur "stiker dari prompt".
// Default: Cloudflare Workers AI (gratis harian).
// Bisa diubah lewat env IMAGE_PROVIDERS, contoh: "cloudflare,pollinations" atau "gemini,cloudflare".
import { getClient, withModels, IMAGE_MODELS, firstImage } from './_gemini.js';

const CF_MODEL = process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell';

export function hasCloudflare() {
  return !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
}

export function providerOrder() {
  // Default cuma Cloudflare (gratis ±130 gambar/hari). Pollinations & Gemini bisa dinyalain lewat env.
  const raw = (process.env.IMAGE_PROVIDERS || 'cloudflare').split(',').map((s) => s.trim().toLowerCase());
  return raw.filter((p) => {
    if (p === 'cloudflare') return hasCloudflare();
    if (p === 'gemini') return !!process.env.GEMINI_API_KEY;
    return p === 'pollinations' && process.env.POLLINATIONS_DISABLED !== '1';
  });
}

async function viaCloudflare(prompt) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${CF_MODEL}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: prompt.slice(0, 2000), steps: 6 }), // flux-1-schnell ga nerima "seed"
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.success === false) {
    const msg = data?.errors?.[0]?.message || `HTTP ${r.status}`;
    const e = new Error(`Cloudflare: ${msg}`);
    e.status = r.status;
    throw e;
  }
  const b64 = data?.result?.image || data?.image;
  if (!b64) throw new Error('Cloudflare ga ngasih gambar');
  return `data:image/jpeg;base64,${b64}`;
}

async function viaPollinations(prompt) {
  const seed = Math.floor(Math.random() * 1e9);
  // Tanpa key cuma model bawaan yang gratis (model=flux & nologo=true minta bayar / 402).
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 900))}?width=1024&height=1024&seed=${seed}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    const type = r.headers.get('content-type') || '';
    if (!r.ok || !type.startsWith('image/')) {
      const info = await r.json().catch(() => ({}));
      const e = new Error(`Pollinations: HTTP ${r.status} ${info?.error?.message || ''}`.trim());
      if (r.status === 402 || r.status === 429) e.rateLimited = true; // gratisan: 1 gambar / 45 detik per IP
      throw e;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    return `data:${type.split(';')[0]};base64,${buf.toString('base64')}`;
  } finally {
    clearTimeout(t);
  }
}

async function viaGemini(prompt) {
  const ai = getClient();
  const out = await withModels(IMAGE_MODELS, (model) =>
    ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } },
    })
  );
  const img = firstImage(out);
  if (!img) throw new Error('Gemini ga ngasih gambar');
  return img;
}

const RUN = { cloudflare: viaCloudflare, pollinations: viaPollinations, gemini: viaGemini };

/** Coba tiap penyedia berurutan. Balikin { image, provider } atau lempar error terakhir. */
export async function generateImage(prompt) {
  const order = providerOrder();
  if (!order.length) {
    const e = new Error('Belum ada penyedia gambar yang aktif');
    e.status = 503;
    throw e;
  }
  const errors = [];
  for (const p of order) {
    try {
      return { image: await RUN[p](prompt), provider: p };
    } catch (e) {
      console.error(`[gambar] ${p} gagal:`, String(e?.message || e).slice(0, 300));
      errors.push(e);
    }
  }
  const last = errors[errors.length - 1];
  last.allFailed = true;
  last.rateLimited = errors.some((e) => e.rateLimited);
  throw last;
}
