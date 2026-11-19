// Bikin gambar stiker dari prompt teks (latar putih polos, nanti dipotong jadi stiker).
import { getClient, withModels, IMAGE_MODELS, firstImage, sendError, requirePost } from './_gemini.js';

const STYLES = {
  cute: 'cute kawaii cartoon, thick clean outlines, flat pastel colors, soft shading',
  y2k: 'Y2K retro aesthetic, glossy bubbly shapes, chrome and pink accents, playful',
  pixel: 'pixel art, crisp 32-bit style, limited palette',
  watercolor: 'soft watercolor illustration, gentle paper texture, hand-painted look',
  clay: 'cute 3D clay render, soft lighting, rounded shapes',
  doodle: 'hand-drawn marker doodle, bold black lines, bright fill colors',
};

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  try {
    const { prompt, style = 'cute' } = req.body || {};
    const text = String(prompt || '').trim().slice(0, 400);
    if (!text) return res.status(400).json({ error: 'Prompt kosong' });
    const ai = getClient();
    const full = `Create a single sticker design of: ${text}.
Style: ${STYLES[style] || STYLES.cute}.
One centered subject, fully visible, not cropped, with some empty margin around it.
Plain solid pure white background (#FFFFFF), no shadow on the background, no border, no frame, no extra stickers.
Only include text if the prompt explicitly asks for words.`;
    const out = await withModels(IMAGE_MODELS, (model) =>
      ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: full }] }],
        config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } },
      })
    );
    const image = firstImage(out);
    if (!image) return res.status(502).json({ error: 'Gemini ga ngasih gambar. Coba ubah prompt-nya.' });
    res.status(200).json({ image });
  } catch (e) {
    sendError(res, e);
  }
}
