# Stikerin

Web bikin sticker pack: upload foto → AI hapus latar → jadi stiker berpinggiran → susun di papan → download / share.

## Jalankan

```
npm install
npm run dev
```

Buka http://localhost:5173

## Struktur

- `src/App.jsx` — state utama (stiker, latar, header pack, share)
- `src/components/Board.jsx` — papan: geser, putar, resize
- `src/components/StickerOnBoard.jsx` — animasi peel (cabut stiker)
- `src/components/Panels.jsx` — panel upload, latar, header pack, stiker terpilih, koleksi
- `src/components/ShareSheet.jsx` — share ke WA / X / Telegram / FB, salin, download
- `src/lib/sticker.js` — AI hapus latar (@imgly/background-removal) + bikin pinggiran
- `src/lib/exporter.js` — render PNG (dipakai juga buat tampilan papan)
