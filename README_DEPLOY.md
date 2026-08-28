# Mahjong Final v14 — GitHub Pages + Cloudflare Room

## Struktur GitHub
- `index.html` -> frontend/PWA di GitHub Pages
- `manifest.webmanifest`
- `sw.js`
- `icons/`
- `cloudflare-worker/worker.js`
- `cloudflare-worker/wrangler.toml`

## Cloudflare Worker
Worker URL yang sudah dikonfigurasi di `index.html`:
`https://mahjong-room.mahjongjong.workers.dev`

Deploy/update dari folder `cloudflare-worker`:
```bash
npx wrangler deploy
```

Tes:
`https://mahjong-room.mahjongjong.workers.dev/health`

## Cara main
1. Host buka GitHub Pages.
2. Play Game -> Vs Player -> Buat Room.
3. QR berisi URL GitHub Pages dengan `?room=XXXXX`.
4. Teman scan QR; game otomatis membuka room dan join.
5. Pemain yang masuk otomatis READY.
6. Saat 4 pemain READY, room otomatis memancarkan `startGame`.

## Catatan
GitHub Pages bukan server game. Cloudflare Worker + Durable Object menjadi coordinator room/WebSocket.
