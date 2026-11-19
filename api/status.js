// Kasih tau web fitur AI mana yang aktif (tanpa membocorkan key apa pun).
import { providerOrder } from './_images.js';

export default function handler(req, res) {
  const gemini = !!process.env.GEMINI_API_KEY;
  res.status(200).json({
    gemini,
    image: providerOrder().length > 0, // stiker dari prompt
    providers: providerOrder(),
    // try-on butuh model gambar Gemini yang berbayar, jadi harus dinyalain manual
    tryOn: gemini && process.env.GEMINI_TRYON === '1',
  });
}
