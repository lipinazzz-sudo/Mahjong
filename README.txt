MAHJONG SOUL WEB — LOCAL P2P v11
================================

Tujuan
------
Versi ini menggabungkan:
1) layout responsif desktop/HP/iPad, portrait & landscape;
2) multiplayer local P2P tanpa server.js menggunakan WebRTC.

Penting
-------
Tidak ada server game khusus. SATU perangkat pemain menjadi Room Host sementara.
Host tetap ikut bermain. Host bukan komputer khusus.

Semua perangkat sebaiknya membuka game dari GitHub Pages / HTTPS.
Koneksi game berjalan langsung melalui WebRTC DataChannel. STUN digunakan hanya
untuk membantu menemukan jalur koneksi. Untuk LAN, lalu lintas game tetap P2P.

CARA HOST
---------
1. Buka GitHub Pages di perangkat host.
2. Play Game -> Vs Player.
3. Masukkan nama -> Buat Room P2P.
4. Pilih kursi berikutnya -> Buat Kode Undangan.
5. Host akan mendapatkan Offer teks + QR.
6. Kirim/scankan QR atau salin Offer ke pemain.
7. Tempel Answer dari pemain ke kolom Answer -> Hubungkan Pemain.
8. Ulangi untuk kursi lain sampai maksimal 3 pemain tambahan.
9. Semua pemain tekan SIAP.
10. Host tekan MULAI GAME.

CARA PEMAIN BERGABUNG
----------------------
1. Buka URL GitHub Pages yang sama.
2. Play Game -> Vs Player -> Gabung dari Undangan.
3. Tempel Offer host.
4. Tekan Buat Answer.
5. Salin Answer dan kirim kembali ke host.
6. Setelah host menghubungkan, pemain masuk lobby room yang sama.

QR
--
Host menampilkan QR dari Offer. Pemain dapat memakai aplikasi kamera/QR di HP
untuk membaca teks QR lalu menempel hasilnya ke kotak Offer. Jika browser tidak
mendukung pembacaan QR langsung di dalam halaman, metode copy/paste tetap tersedia.

RESPONSIVE
----------
Viewport mengikuti ukuran nyata browser dan visualViewport. Ukuran tile memakai
sumbu layar yang lebih kecil; ada penyesuaian khusus HP portrait, HP landscape,
iPad, serta desktop. Safe-area notch/home-indicator juga diperhitungkan.

CATATAN
-------
WebRTC signaling di sini bersifat manual/copy-paste agar tidak membutuhkan
server signaling. Room code hanya label untuk manusia; koneksi sebenarnya terjadi
melalui Offer/Answer.

Jalankan hanya melalui HTTPS atau localhost. Jangan gunakan file:// untuk P2P.
