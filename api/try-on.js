// Virtual try-on: foto orang + foto baju → foto orang itu pakai bajunya (realistis).
import { getClient, withModels, IMAGE_MODELS, imagePart, firstImage, sendError, requirePost } from './_gemini.js';

const SLOT_NAME = { top: 'top', bottom: 'bottom (pants/skirt)', dress: 'dress', outer: 'outerwear/jacket', shoes: 'shoes', hat: 'hat/headwear' };

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  try {
    const { person, garments } = req.body || {};
    const list = Array.isArray(garments) ? garments.filter((g) => g?.image).slice(0, 6) : [];
    if (!person || !list.length) return res.status(400).json({ error: 'Butuh foto orang dan minimal 1 baju' });
    const ai = getClient();
    const parts = [{ text: 'Image 1 is the PERSON.' }, imagePart(person)];
    list.forEach((g, i) => {
      parts.push({ text: `Image ${i + 2} is a ${SLOT_NAME[g.slot] || 'clothing item'} to wear.` });
      parts.push(imagePart(g.image));
    });
    parts.push({
      text: `Virtual try-on: show the exact same person from Image 1 wearing the clothing items from the other images.
Keep the person's face, hair, skin tone, body shape and pose identical. Replace only the matching clothing; keep other clothes as they are.
Make the garments fit naturally with realistic folds, lighting and shadows, keeping their colors, patterns and details.
Full body, standing, centered, on a plain solid pure white background (#FFFFFF). Photorealistic.`,
    });
    const out = await withModels(IMAGE_MODELS, (model) =>
      ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '3:4' } },
      })
    );
    const image = firstImage(out);
    if (!image) return res.status(502).json({ error: 'Gemini ga ngasih gambar. Coba lagi ya.' });
    res.status(200).json({ image });
  } catch (e) {
    sendError(res, e);
  }
}
