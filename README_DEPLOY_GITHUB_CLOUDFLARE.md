# Deploy Multiplayer Room untuk GitHub Pages

## 1. Cloudflare Worker

Folder `cloudflare-worker/` berisi `worker.js` + `wrangler.toml` yang memakai Durable Objects untuk room dan WebSocket. `wrangler.toml` sudah mendeklarasikan binding `MAHJONG_ROOMS` ke class `MahjongRoom`.

### Cara termudah via terminal
1. Install Node.js.
2. Buka Terminal di folder `cloudflare-worker`.
3. Jalankan:

```bash
npx wrangler login
npx wrangler deploy
```

Cloudflare akan menampilkan URL Worker, misalnya:

```text
https://mahjong-room.<subdomain>.workers.dev
```

Cloudflare mendokumentasikan `npx wrangler deploy` untuk deployment Worker + Durable Object, dan namespace Durable Object akan diprovision saat deployment pertama.

### Alternatif GitHub integration
Di Cloudflare Dashboard → Workers & Pages → Create application → Import repository → pilih repository GitHub.
Pilih root directory `cloudflare-worker`. Deploy command: `npx wrangler deploy`. Pastikan nama Worker sama dengan `name` di wrangler.toml (`mahjong-room`).

## 2. Masukkan URL Worker ke index.html

Di `index.html`, cari:

```js
const MP_CFG = {
  signalingBase: 'https://YOUR-MAHJONG-ROOM-WORKER.workers.dev',
  roomParam: 'room'
};
```

Ganti hanya URL itu, contoh:

```js
signalingBase: 'https://mahjong-room.lipin-sudo.workers.dev'
```

Upload `index.html` yang sudah diubah ke GitHub Pages.

## 3. Cara bermain

Host membuka GitHub Pages → Vs Player → Buat Room.

Teman scan QR → URL `?room=12345` terbuka → otomatis join → otomatis READY.

Jika 4 pemain sudah ada dan semuanya READY, server otomatis mengirim `startGame`. Untuk kurang dari 4 pemain, host tetap dapat menekan MULAI GAME.

## 4. Cek Worker

Buka:

```text
https://mahjong-room.<subdomain>.workers.dev/health
```

Harus mengembalikan JSON dengan `ok: true`.

## 5. Catatan

GitHub Pages hanya menyajikan frontend. Room/WebSocket ditangani Worker + Durable Object. Semua pemain tetap menggunakan URL GitHub Pages yang sama.
