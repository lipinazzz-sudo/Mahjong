MAHJONG SOUL WEB — REAL LAN MULTIPLAYER

Isi folder:
- mahjong_soul_multiplayer.html : game client
- server.js                     : room + WebSocket server

CARA MENJALANKAN
1. Install Node.js 18+.
2. Buka Terminal di folder ini.
3. Jalankan: node server.js
4. Terminal akan menampilkan alamat LAN, contoh:
   LAN: http://192.168.1.10:3000
5. Di komputer host, buka alamat tersebut.
6. Pilih Vs Player -> masukkan nama -> Buat Room.
7. Bagikan alamat LAN yang sama kepada teman di HP/iPad yang berada pada Wi-Fi yang sama.
8. Teman membuka alamat tersebut -> Vs Player -> nama -> masukkan kode room 5 digit -> Join.
9. Semua pemain klik SIAP. Host klik MULAI GAME.

CATATAN
- Jangan membuka HTML dengan double-click file:// untuk multiplayer. Gunakan URL dari server.
- Semua perangkat harus dapat mengakses komputer host pada jaringan yang sama.
- Jika Windows/macOS meminta izin Firewall, izinkan Node.js untuk jaringan private/LAN.
- Server ini adalah model host-authoritative untuk permainan teman/LAN. State meja disinkronkan dari browser host.
