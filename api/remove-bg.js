// Hapus latar: Gemini kasih garis bentuk (poligon) objek utama, web yang motong.
import { getClient, withModels, TEXT_MODELS, imagePart, sendError, requirePost } from './_gemini.js';

const SCHEMA = {
  type: 'object',
  properties: {
    objects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          box_2d: { type: 'array', items: { type: 'integer' } },
          polygon: { type: 'array', items: { type: 'array', items: { type: 'integer' } } },
        },
        required: ['label', 'box_2d', 'polygon'],
      },
    },
  },
  required: ['objects'],
};

const PROMPT = `Segment the main subject(s) of this photo so it can be turned into a die-cut sticker.
Include everything that belongs to the subject (hair, clothes, held items, accessories). Exclude the background, floor and shadows.
Return JSON: "objects" is a list; each has "label", "box_2d" as [y0, x0, y1, x1] normalized 0-1000,
and "polygon": a detailed outline as a list of [x, y] points normalized 0-1000 (use 60-200 points, follow the edge closely).`;

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  try {
    const { image } = req.body || {};
    if (!image) return res.status(400).json({ error: 'image kosong' });
    const ai = getClient();
    const out = await withModels(TEXT_MODELS, (model) =>
      ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [imagePart(image), { text: PROMPT }] }],
        config: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0 },
      })
    );
    const data = JSON.parse(out.text || '{}');
    res.status(200).json({ objects: Array.isArray(data.objects) ? data.objects : [] });
  } catch (e) {
    sendError(res, e);
  }
}
