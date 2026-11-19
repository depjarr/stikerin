// Bikin gambar stiker dari prompt teks (latar putih polos, nanti dipotong jadi stiker di browser).
import { getClient, withModels, TEXT_MODELS, sendError, requirePost } from './_gemini.js';
import { generateImage } from './_images.js';

const STYLES = {
  cute: 'cute kawaii cartoon, thick clean outlines, flat pastel colors, soft shading',
  y2k: 'Y2K retro aesthetic, glossy bubbly shapes, chrome and pink accents, playful',
  pixel: 'pixel art, crisp 32-bit style, limited palette',
  watercolor: 'soft watercolor illustration, gentle paper texture, hand-painted look',
  clay: 'cute 3D clay render, soft lighting, rounded shapes',
  doodle: 'hand-drawn marker doodle, bold black lines, bright fill colors',
};

// Model gambar gratisan lebih ngerti bahasa Inggris. Kalau ada key Gemini,
// pakai model TEKS-nya (gratis) buat nerjemahin. Kalau gagal, pakai teks asli.
async function toEnglish(text) {
  if (!process.env.GEMINI_API_KEY) return text;
  try {
    const ai = getClient();
    const out = await withModels(TEXT_MODELS, (model) =>
      ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: `Translate this sticker idea into a short English image description. Keep any words in quotes exactly as written. Reply with the description only.\n\n${text}` }] }],
        config: { temperature: 0.2 },
      })
    );
    const t = (out.text || '').trim();
    return t && t.length < 500 ? t : text;
  } catch {
    return text;
  }
}

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  try {
    const { prompt, style = 'cute' } = req.body || {};
    const text = String(prompt || '').trim().slice(0, 400);
    if (!text) return res.status(400).json({ error: 'Prompt kosong' });
    const subject = await toEnglish(text);
    const full = `A single die-cut sticker design of ${subject}. Style: ${STYLES[style] || STYLES.cute}. One centered subject, fully visible, not cropped, empty margin around it, plain solid pure white background, no shadow, no border, no frame. Only include text if the description asks for words.`;
    const { image, provider } = await generateImage(full);
    res.status(200).json({ image, provider });
  } catch (e) {
    if (e?.allFailed) {
      return res.status(e.rateLimited ? 429 : 502).json({
        error: e.rateLimited
          ? 'Layanan gambar gratis lagi antre (jatahnya 1 gambar tiap ±45 detik). Tunggu sebentar terus coba lagi ya.'
          : 'Semua layanan gambar lagi penuh atau habis jatahnya. Coba lagi beberapa menit lagi.',
      });
    }
    sendError(res, e);
  }
}
