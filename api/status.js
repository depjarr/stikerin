// Kasih tau web apakah fitur Gemini aktif (tanpa membocorkan key-nya).
export default function handler(req, res) {
  res.status(200).json({ gemini: !!process.env.GEMINI_API_KEY });
}
