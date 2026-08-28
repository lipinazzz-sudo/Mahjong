# Mahjong Soul Web v13 — QR Room Auto Join

Versi ini dibuat untuk alur:

1. Host membuka GitHub Pages.
2. Host pilih **Vs Player → Buat Room**.
3. Game membuat QR berisi URL GitHub Pages `?room=12345`.
4. Teman scan QR.
5. Browser langsung membuka game + otomatis bergabung ke room.
6. Guest otomatis READY.
7. Host otomatis READY.
8. Saat 4 pemain READY, game mulai otomatis. Dengan 2–3 pemain, host tetap bisa menekan **MULAI GAME**.

## Arsitektur

- GitHub Pages: frontend/PWA.
- Cloudflare Worker + Durable Objects: room coordination, lobby, ready/start, dan relay state/action.
- Tidak perlu PC menjadi server.
- Semua pemain tetap dapat memakai HP/iPad/desktop.

Catatan: versi ini menggunakan WebSocket room service untuk koneksi multiplayer yang stabil. Jadi bukan direct WebRTC P2P murni; keuntungan utamanya adalah QR auto-join dapat berjalan tanpa copy/paste offer/answer dan tanpa perangkat pemain menjadi server.

## Deploy room server

Cloudflare saat ini mendukung Durable Objects sebagai koordinator state dan WebSocket untuk aplikasi multiplayer real-time. Pages Functions dapat memakai Durable Object binding, tetapi Durable Object Worker perlu dibuat/deploy sebagai Worker terpisah. Lihat dokumentasi resmi:
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://developers.cloudflare.com/pages/functions/bindings/

Di folder `cloudflare-worker`:

```bash
npm install -D wrangler
npx wrangler login
npx wrangler deploy
```

Setelah deploy, akan mendapat alamat seperti:

```text
https://mahjong-room.<subdomain>.workers.dev
```

## Hubungkan GitHub Pages

Buka `index.html` lalu cari:

```js
signalingBase: 'https://YOUR-MAHJONG-ROOM-WORKER.workers.dev'
```

ganti dengan URL Worker kamu, misalnya:

```js
signalingBase: 'https://mahjong-room.contoh.workers.dev'
```

Commit/push ke GitHub Pages.

## Penggunaan

Host buka:

```text
https://USERNAME.github.io/REPO/
```

Pilih:

```text
Play Game
→ Vs Player
→ Buat Room
```

QR otomatis akan berisi URL room.

Teman scan QR menggunakan kamera HP/iPad.

Contoh URL hasil scan:

```text
https://USERNAME.github.io/REPO/?room=48321
```

Guest otomatis join dan READY.

## Catatan keamanan

Room code hanya 5 digit dan dimaksudkan untuk friend room/private play. Untuk publik, sebaiknya tambah token acak yang lebih panjang, rate limiting, expiry room, dan autentikasi.
