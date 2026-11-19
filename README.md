# Stikerin

Web bikin sticker pack: upload/scan foto → AI hapus latar → jadi stiker berpinggiran → susun di kertas → download / kirim.

Fitur: stiker dari foto, stiker teks, stiker kartu (photocard), stiker dari prompt (Gemini), paper doll + versi realistis (Gemini), header pack, animasi cabut stiker.

## Jalankan di laptop

```
npm install
npm run dev
```

Buka http://localhost:5173

## Pasang Gemini (Google AI Studio)

Tanpa API key web tetap jalan: hapus latar pakai AI yang jalan di browser. Dengan API key, ada tambahan:

- **Hapus latar pakai Gemini** (otomatis, kalau gagal balik ke AI browser)
- **Tab ✦ Prompt**: bikin stiker dari tulisan
- **Paper doll → "Bikin versi realistis (AI)"**: virtual try-on

Caranya:

1. Buka https://aistudio.google.com → **Get API key** → bikin key.
2. Bikin file `.env.local` di folder project (file ini ga ikut ke GitHub):

   ```
   GEMINI_API_KEY=isi_key_kamu_di_sini
   ```

3. Matikan lalu jalankan lagi `npm run dev`.

Opsional, buat ganti model:

```
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
GEMINI_TEXT_MODEL=gemini-3.5-flash-lite
```

**Jangan pernah** taruh API key di kode `src/` atau kirim ke orang lain. Key cuma dibaca fungsi server di folder `api/`.

Catatan biaya: AI Studio punya kuota gratis, tapi model gambar (prompt & try-on) bisa butuh billing aktif di Google Cloud.

## Stiker dari prompt (gratis)

Fitur **✦ Prompt** pakai **Cloudflare Workers AI** (model FLUX schnell): gratis 10.000 Neurons/hari, ±77 Neurons per gambar 1024×1024, jadi kira-kira **130 gambar/hari**. Reset tiap 00:00 UTC (07:00 WIB).

Penyedia lain bisa dinyalain lewat `IMAGE_PROVIDERS` (lihat di bawah): **Pollinations** (gratis tanpa daftar, 1 gambar/±45 detik, kualitas biasa) dan **Gemini** (model gambarnya ga ada kuota gratis, butuh billing).

Cara bikin token Cloudflare:

1. Daftar/masuk di https://dash.cloudflare.com (gratis).
2. **Account ID**: buka menu **Workers & Pages** (atau halaman akun), salin **Account ID** di panel kanan.
3. **API token**: klik ikon profil → **My Profile → API Tokens → Create Token** → pilih template **Workers AI** → **Continue to summary → Create Token** → salin token-nya (cuma muncul sekali).
4. Tambahkan ke `.env.local` (dan ke Environment Variables di Vercel):

   ```
   CLOUDFLARE_ACCOUNT_ID=isi_account_id
   CLOUDFLARE_API_TOKEN=isi_token
   ```

Opsional:

```
CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-1-schnell
IMAGE_PROVIDERS=cloudflare            # contoh: cloudflare,pollinations
GEMINI_TRYON=1        # nyalain tombol paper doll realistis (butuh billing Gemini)
```

Kalau `GEMINI_API_KEY` diisi, model teks Gemini (gratis) dipakai buat nerjemahin prompt ke bahasa Inggris biar gambarnya lebih nurut.

## Online-kan di Vercel

1. Import repo ini di vercel.com (framework: Vite).
2. **Settings → Environment Variables** → tambah `GEMINI_API_KEY`.
3. Deploy. Folder `api/` otomatis jadi Vercel Functions.

## Struktur

- `src/App.jsx` — state utama
- `src/components/` — papan, kamera scan, panel (kartu pos, sticky note, ponsel), share sheet
- `src/lib/sticker.js` — potong latar (Gemini → cadangan AI browser) + pinggiran stiker
- `src/lib/cloud.js` — pemanggil fungsi server Gemini
- `src/lib/card.js` — stiker kartu
- `src/lib/dressup.js` — paper doll (MediaPipe Pose)
- `api/` — fungsi server Gemini: `remove-bg`, `generate`, `try-on`, `status`
