# 🎭 Pesta Topeng (3D)

Game deduksi identitas tersembunyi untuk 3–8 pemain, dimainkan di browser (HP/laptop) dengan **room code**. Tanpa akun dan tanpa install.

## Cara main
- Ada 20 tamu bertopeng yang tersebar di 5 pulau. Setiap pemain diam-diam menjadi salah satu tamu itu.
- Di giliranmu, lempar dadu:
  - **Pulau**: pindahkan tamu mana saja *masuk ke* atau *keluar dari* pulau itu, ke pulau yang bersebelahan.
  - **Hitam**: buka topeng satu tamu yang **satu pulau dengan karaktermu**, atau ambil kartu tamu biasa (maks 3) untuk menyuruhnya pulang. Setelah punya 3 kartu, kamu wajib membuka topeng.
  - Kalau dadu hitam dan karaktermu **sendirian** di pulaunya, topengmu sendiri yang terbuka.
- Pemain terakhir yang masih bertopeng menang.

Papan: `[Sumatera][Kalimantan] / [Jawa] / [Sulawesi][Papua]`.

| Pulau | Warna | Nuansa lantai & dekorasi | Bersebelahan dengan |
|---|---|---|---|
| Sumatera (kiri atas) | Merah | lapisan batu ngarai, kaktus saguaro, gedung pencakar langit | Kalimantan, Jawa |
| Kalimantan (kanan atas) | Putih | es retak, salju, jejak & patung penguin, gunung es | Sumatera, Jawa |
| Jawa (tengah) | Biru | alun-alun batu kipas, kincir angin, menara | semua pulau (pusat) |
| Sulawesi (kiri bawah) | Kuning | sabana, pohon akasia, piramida | Papua, Jawa |
| Papua (kanan bawah) | Hijau | sawah terasering, rumpun bambu, pagoda | Sulawesi, Jawa |

Dadu berbentuk **prisma segi lima dengan 7 sisi**: 5 sisi panjang PAPUA, SULAWESI, JAWA, SUMATERA, KALIMANTAN (masing-masing dengan warnanya) + 2 ujung HITAM. Peluangnya: HITAM 2/7 (±29%), tiap pulau 1/7 (±14%). Hasil diundi server secara adil, jadi bentuk prisma tidak memengaruhi peluang.

## Pengalaman bermain (polesan v2)
- **Musik latar generatif**, bergaya *masquerade lounge*: progresi jazz ii–V–I, bas, sikat drum, dan melodi acak, jadi tidak pernah berulang persis. Tempo dan perkusi naik saat tersisa 2 pemain. Dibuat dengan WebAudio, tanpa file. Musik berhenti saat tab disembunyikan.
- **17 efek suara**: klik, hover, ambil/lepas bidak, kocokan & pantulan dadu, *swoosh* terbang, lonceng "giliranmu", detik terakhir timer, dentuman buka topeng, *poof* tamu biasa, kartu dibalik, fanfare menang, nada kalah, pemain bergabung, dan error.
- **Tombol musik & efek suara** terpisah di HUD (disimpan di perangkat). Audio terbuka otomatis pada sentuhan pertama, termasuk di iPhone/Safari.
- **Momen dramatis**: banner "PESTA DIMULAI" dan "GILIRANMU" (dengan getaran HP), kartu pengungkapan yang membalik dari sisi topeng ke foto profil (topeng terbuka / tamu biasa / tamu pulang), ledakan konfeti 3D, dan gelombang cahaya di papan.
- **Layar kemenangan**: foto pemenang bermahkota, peran yang dipertahankan, daftar identitas semua pemain dengan foto, konfeti, dan fanfare.
- **Intro kamera** menyapu papan saat pesta dimulai. Dadu melompat-lompat saat giliranmu dan bisa diketuk langsung untuk dilempar. Kursor berubah jadi tangan di atas objek yang bisa diklik.
- **Timer cincin** yang berubah merah di 10 detik terakhir dan berdetak di 5 detik terakhir giliranmu.
- **Layar awal** menampilkan barisan 20 tamu (foto 3D) yang bergulir. **Lobby** menampilkan avatar inisial berwarna, lencana host, slot "menunggu pemain", dan animasi saat pemain masuk.
- Foto profil dirender sekali oleh `public/portraits.js`, lalu dipakai di semua layar.

## Tampilan 3D: "atlas antik di meja permainan"
- Papan berbingkai kayu walnut dengan lis kuningan, di atas meja felt hijau yang disorot satu lampu meja hangat.
- Lautan bergaya peta tua: biru tua, garis lintang/bujur emas, riak ombak yang bergerak pelan, dan mata angin.
- Pulau berupa pulau felt dengan pesisir pasir dan nama pulau bergaya kartu peta (Playfair Display). Setiap pulau punya miniatur landmark kuningan: menara (Jawa), pagoda (Papua), piramida (Sulawesi), gedung pencakar langit (Sumatera), dan gunung es (Kalimantan).
- Jembatan modern-minimalis, berbeda untuk setiap pasangan pulau: **es** (Sumatera–Kalimantan), **bilah jati** (Sulawesi–Papua), **gantung** (Sumatera–Jawa), **lengkung putih** (Kalimantan–Jawa), **terakota** (Sulawesi–Jawa), dan **jembatan bulan merah** (Papua–Jawa). Di kedua ujung ada pelat ambang berwarna pulau tujuan. Jembatan yang menjadi jalur sah menyala hijau.
- **Kartu identitas**: foto profil yang dirender dari model 3D karakter, nama profesi, dan bio satir (fiksi, untuk hiburan). Bio ada di `game.js` → `CHARACTERS`. Foto yang sama dipakai di layar akhir game.
- **20 karakter chibi profesi** bergaya vinyl toy: kepala besar, mata besar mengilap, alis, pipi merona, senyum, rambut, dan seragam lengkap (dasi, rompi reflektif, jas, celana kerja). Setiap tamu memegang topeng pesta bertangkai, sesuai tema *Pesta Topeng*.
  Koki, Polisi, Dokter, Pemadam, Petani (caping), Pilot, Astronot, Pelukis, Pesulap, Peternak, Tukang, Kapten Kapal, Detektif, Dalang (blangkon), Profesor, Atlet, DJ, Perawat, Ilmuwan, dan Kurir.
  Modelnya ada di `public/figures3d.js`. Setiap profesi = satu entri `PROFESSIONS` (warna seragam, gaya rambut, topi, atribut). Geometri dan material dipakai bersama agar hemat GPU.
- Dadu prisma gading: nama pulau ditulis memanjang di tiap sisi agar mudah terbaca, dan kedua ujung HITAM bergambar topeng emas.
- UI memakai palet tinta, kuningan, dan krem. Ikon berupa SVG (bukan emoji), font self-hosted (tanpa CDN), dan ada tombol **Kurangi animasi** di panel catatan (disimpan di perangkat). Animasi tidak lagi mengikuti setelan sistem, karena setelan itu sering menyala di laptop/iPhone sehingga animasi tidak jalan.

- Dibangun dengan **three.js** (di-serve dari `node_modules`, tanpa CDN dan tanpa game engine).
- Papan 3D di atas meja kayu: 5 pulau berdinding dengan jembatan pintu. Kamera bisa diputar (drag) dan di-zoom (pinch/scroll). Tombol 🎥 mengembalikan kamera ke posisi awal.
- Bidak 3D dengan wajah topeng (emoji). Setiap gerakan dianimasikan dengan bidak melompat ke pulau tujuan. Bidak yang topengnya dibuka akan roboh lalu tenggelam, sedangkan tamu yang pulang melayang ke atas.
- Dadu 3D dilempar ke meja: berputar, memantul, dan berhenti tepat di sisi hasil dari server, lengkap dengan bunyi "klak" (WebAudio, tanpa file audio). Semua pemain melihat animasi lemparan yang sama.
- **Border pulau.** Hijau menyala = tujuan yang sah, merah = pulau yang tidak terlibat (sekaligus digelapkan), emas = pulau asal bidak yang sedang dipegang.
- **Sinematik pindah bidak.** Saat pemain lain memindahkan bidak, kamera zoom mengikuti bidak itu (sekitar 1,5 detik). Bidak terangkat, melayang lewat jembatan dengan cincin biru dan label nama, lalu mendarat. Ada efek suara *swoosh* dan *pop* (WebAudio, tanpa file) serta toast "Budi memindahkan Koki: Sumatera → Jawa". Ambil dan lepas bidakmu sendiri juga berbunyi.
- **Sorotan aturan.** Setelah dadu dilempar, pulau yang tidak terlibat menggelap. Contoh: dadu PAPUA → Sumatera & Kalimantan gelap; hanya Papua dan tetangganya (Sulawesi, Jawa) yang terang. Saat bidak dipegang, hanya pulau asal dan pulau tujuan yang sah yang terang. Saat dadu HITAM, hanya pulaumu yang terang (hanya di layarmu).
- **Posisi bebas di dalam pulau.** Bidak berdiri tepat di titik kamu melepasnya, asal masih di dalam wilayah pulau tujuan. Server hanya menggeser sedikit bila bertabrakan dengan bidak lain atau dekorasi, dan posisinya sama di layar semua pemain. Di awal game, bidak disebar merata. Geometri papan ada di `layout.js` (dipakai server dan dikirim ke client lewat `/meta`).
- **Memindahkan bidak: tahan lalu geser.** Tahan bidak bercincin putih, lalu geser ke pulau yang menyala dan lepaskan. Jembatan yang menjadi jalurnya ikut menyala. Kalau dilepas di tempat yang salah, bidak kembali ke posisinya. Cara cadangan: ketuk bidak, lalu ketuk pulau tujuan.
- Jembatan kayu berpagar dengan gerbang emas menandai pulau mana saja yang terhubung.
- Sorotan: cincin putih = bidak yang bisa dipindah, pulau yang berdenyut = tujuan, cincin merah = target buka topeng, ⭐ = karaktermu (hanya terlihat saat identitas dibuka).
- Hemat baterai: canvas hanya di-render ulang saat ada animasi, sorotan, atau gerakan kamera. WebGL baru dibuat ketika game dimulai.

Kode 3D ada di `public/board3d.js`. Untuk mengganti model bidak dengan file `.glb` (misalnya dari Kenney.nl atau Blender), ubah `buildFigures()` agar memuat model dengan `GLTFLoader`.

## Akun Google, ID unik, poin & peringkat
- **Masuk dengan Google** (Supabase Auth), lalu pilih **username** (3–16 huruf/angka/_, unik tanpa membedakan huruf besar/kecil). Server membuat **ID unik 5 karakter** (A–Z & 2–9, tanpa 0/O/1/I agar tak tertukar), misalnya `#7ZGX8`.
- **Tamu** tetap bisa main tanpa login, tapi poinnya tidak disimpan.
- **Room publik / privat**: saat membuat room pilih *Publik* (muncul di daftar "Room publik" secara langsung, siapa pun bisa gabung) atau *Privat* (tidak tampil, hanya bisa dimasuki dengan kode). Host bisa mengubahnya dari lobby.
- **Papan peringkat**: diurutkan dari total poin (seri dipecah jumlah kemenangan), dengan podium 3 besar, baris "kamu" yang selalu terlihat, dan tingkat: Pendatang Baru → Perunggu (150) → Perak (500) → Emas (1.200) → Platina (2.500) → Berlian (5.000) → Legenda Topeng (10.000).
- **Profil**: ID (ketuk untuk salin), tingkat + progres, poin, peringkat, jumlah pesta, kemenangan, rasio menang, topeng dibongkar, dan 8 pesta terakhir.

### Keluar di tengah permainan
Tombol **keluar** (ikon pintu merah di kanan atas, juga di Menu) meminta konfirmasi dulu. Keluar saat pesta berjalan = **menyerah**: posisimu paling bawah, 0 poin, dan karaktermu tetap di papan sebagai tamu biasa (identitasnya tidak dibuka). Pemain lain mendapat notifikasi. Menutup tab tanpa menekan tombol keluar tidak dianggap menyerah: kamu bisa masuk lagi lewat link yang sama, dan selama offline giliranmu dimainkan otomatis.

### Sistem poin
Juara 1 = pemain terakhir yang masih bertopeng. Juara 2, 3, dan seterusnya ditentukan dari siapa yang **paling akhir tersingkir**.

| Komponen | Poin |
|---|---|
| Hadir & menyelesaikan pesta | +5 |
| Setiap pemain yang tersingkir lebih dulu darimu | +10 |
| Bonus juara 1 | +25 |
| Setiap lawan yang kamu bongkar topengnya | +10 |

| Pemain | #1 | #2 | #3 | #4 | #5 | #6 | #7 | #8 |
|---|---|---|---|---|---|---|---|---|
| 3 | 50 | 15 | 5 | | | | | |
| 4 | 60 | 25 | 15 | 5 | | | | |
| 5 | 70 | 35 | 25 | 15 | 5 | | | |
| 6 | 80 | 45 | 35 | 25 | 15 | 5 | | |
| 7 | 90 | 55 | 45 | 35 | 25 | 15 | 5 | |
| 8 | 100 | 65 | 55 | 45 | 35 | 25 | 15 | 5 |

(belum termasuk bonus bongkar topeng). Alasannya: room ramai lebih bernilai, posisi akhir selalu paling menentukan, dan bermain berani diberi hadiah tanpa mengalahkan nilai bertahan. Angka bisa diubah di `scoring.js`.

### Keamanan data
- Browser hanya memakai Supabase untuk **login**. Semua baca/tulis profil & poin dilakukan **server** dengan *secret key*, jadi poin tidak bisa dipalsukan dari browser.
- Tabel memakai RLS aktif tanpa policy untuk `anon`/`authenticated` (tertutup dari Data API publik), dan fungsi `create_profile` / `award_match` / `player_rank` hanya bisa dijalankan `service_role`.
- Token login diverifikasi server (`auth.getClaims`) setiap kali socket tersambung. Satu akun hanya bisa menjadi satu pemain per room (tab kedua = sambung ulang).
- Poin dicatat sekali per pertandingan secara atomik (`award_match`), dan "Main lagi" tidak menggandakan poin.

### Deploy cepat dengan Blueprint
Repo ini punya `render.yaml`. Di Render: **New → Blueprint →** pilih repo ini, lalu isi `SUPABASE_SECRET_KEY` saat diminta. URL & kunci publik Supabase sudah terisi.

### Setup Supabase + Google (±15 menit, gratis)
1. Buat project di [supabase.com](https://supabase.com) (free tier).
2. **SQL Editor → New query**: tempel isi `supabase/schema.sql`, lalu **Run**. Aman dijalankan ulang.
3. **Google Cloud Console → Google Auth Platform → Clients → Create client** (jenis *Web application*):
   - *Authorized JavaScript origins*: `https://<nama-app>.onrender.com` (dan `http://localhost:3000` untuk lokal).
   - *Authorized redirect URIs*: salin **Callback URL** dari halaman provider Google di Supabase, bentuknya `https://<project-ref>.supabase.co/auth/v1/callback`.
   - Simpan **Client ID** & **Client Secret**.
4. **Supabase → Authentication → Sign In / Providers → Google**: aktifkan, isi Client ID & Secret.
5. **Supabase → Authentication → URL Configuration**:
   - *Site URL*: `https://<nama-app>.onrender.com`
   - *Redirect URLs*: tambahkan `https://<nama-app>.onrender.com/**` dan `http://localhost:3000/**` (supaya link undangan `/?room=KODE` tetap kembali ke room setelah login).
6. **Supabase → Project Settings → API Keys**: salin *publishable key* (`sb_publishable_…`) dan *secret key* (`sb_secret_…`).
7. Isi env di Render (atau file `.env` lokal; lihat `.env.example`): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`. **Jangan pernah** menaruh secret key di kode client.

Tanpa env Supabase, server otomatis memakai **mode lokal**: tombol berubah menjadi "Buat akun (mode lokal)", akun dibuat per perangkat, dan data disimpan di `data/local-store.json`. Mode ini untuk pengembangan dan tes saja (data hilang saat server Render tidur / redeploy).

## Online dari laptop sendiri (gratis, tanpa kartu) — Windows
1. Ekstrak folder `pesta-topeng` ke mana saja, misalnya `Documents\pesta-topeng`.
2. Klik dua kali **`MAIN-ONLINE.bat`**.
   - Kalau Node.js belum ada, skrip memasangnya lewat winget. Setelah itu tutup jendela lalu klik lagi.
   - Pertama kali, kamu diminta menempel `SUPABASE_SECRET_KEY` (disimpan di file `.env`, hanya di laptopmu). Kosongkan kalau mau jalan tanpa akun/poin dulu.
   - Dependensi dan `cloudflared` (dari GitHub resmi Cloudflare) diunduh otomatis sekali saja.
3. Link publik `https://….trycloudflare.com` muncul di jendela, dibuka di browser, dan disimpan di `LINK-GAME.txt`. Bagikan ke teman.
4. Biarkan jendela tetap terbuka. Tutup jendela (atau Ctrl+C) untuk mematikan.

Catatan:
- Link **berubah** setiap kali dijalankan ulang. Server dan tunnel dinyalakan ulang otomatis kalau terputus.
- Agar menyala sendiri setiap Windows hidup: jalankan **`PASANG-OTOMATIS.bat`** (batalkan dengan `HAPUS-OTOMATIS.bat`).
- Atur Windows agar laptop **tidak sleep** saat dicolok: Settings → System → Power → Screen and sleep → "When plugged in, put my device to sleep after: Never".
- Quick Tunnel Cloudflare ditujukan untuk uji coba (maks. 200 request bersamaan, tanpa jaminan uptime). Untuk link tetap, pakai Cloudflare Tunnel bernama + domain sendiri.
- Supaya login Google kembali ke link tunnel, tambahkan `https://*.trycloudflare.com/**` di Supabase → Authentication → URL Configuration → Redirect URLs.

## Jalankan lokal
```bash
npm install
npm start            # http://localhost:3000
```
Untuk tes di HP: buka `http://<IP-laptop>:3000` dari Wi-Fi yang sama. Untuk mensimulasikan beberapa pemain di satu komputer, pakai jendela incognito atau profil browser berbeda.

Simulasi otomatis (bot memainkan 1 game penuh, termasuk disconnect/reconnect):
```bash
PORT=3999 TURN_MS=3000 OFFLINE_TURN_MS=300 npm start &
npm run test:sim
```
Tes akun, room publik/privat, poin & peringkat (menjalankan server sendiri, mode lokal):
```bash
npm test
```

## Konfigurasi (env)
| Variabel | Default | Fungsi |
|---|---|---|
| `PORT` | 3000 | Port server |
| `TURN_MS` | 45000 | Batas waktu per giliran. Kalau habis, server menjalankan aksi otomatis. |
| `OFFLINE_TURN_MS` | 8000 | Batas waktu giliran untuk pemain yang sedang offline |
| `MIN_PLAYERS` | 3 | Minimal pemain untuk mulai (isi 2 kalau mau tes berdua) |
| `SUPABASE_URL` | – | URL project Supabase, mis. `https://abcd.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | – | Kunci publik untuk login di browser (`sb_publishable_…`; kunci `anon` lama juga bisa) |
| `SUPABASE_SECRET_KEY` | – | Kunci rahasia, **hanya di server** (`sb_secret_…`; kunci `service_role` lama juga bisa) |
| `LOCAL_STORE_FILE` | `data/local-store.json` | Lokasi file data untuk mode lokal |

## Deploy gratis (Render)
1. Push folder ini ke repo GitHub.
2. Di Render: **New → Web Service**, lalu hubungkan repo.
3. Build command: `npm install`. Start command: `npm start`. Instance type: **Free**.
4. Tab **Environment**: isi `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (lihat setup Supabase di atas).
5. Bagikan URL `https://<nama>.onrender.com`. Room bisa diundang lewat link `/?room=KODE`.

Catatan free tier: server tidur setelah 15 menit tanpa trafik dan butuh ±1 menit untuk bangun (klien menampilkan pesan "Menghubungkan…"). Room tersimpan di memori, jadi akan hilang saat server tidur atau di-redeploy. Akun, poin, dan peringkat aman di Supabase.

## Struktur
```
layout.js      geometri papan & penempatan bidak (server + client)
game.js        logika murni (aturan, giliran, menang): mudah dites
server.js      Express + Socket.IO: room publik/privat, akun, poin, sinkronisasi, timer, reconnect
scoring.js     aturan poin & tingkat
store.js       penyimpanan akun/poin: Supabase (produksi) atau file JSON (mode lokal)
supabase/schema.sql  tabel, RLS, fungsi atomik untuk poin & peringkat
public/        client vanilla JS: index.html, home.js (akun, daftar room, peringkat, profil), auth.js (login Google), app.js (HUD, socket, momen dramatis), board3d.js (scene three.js),
               figures3d.js (karakter), themes3d.js (lantai & dekorasi), portraits.js (foto profil), audio.js (musik & SFX), style.css
test/sim.js    simulasi bot end-to-end
test/accounts.js  tes akun, ID unik, room publik/privat, poin & papan peringkat
```

## Yang sudah ditangani
- Server-authoritative: identitas hanya dikirim ke pemiliknya, dan semua aksi divalidasi (giliran, fase, legalitas langkah).
- Reconnect memakai `playerId` di localStorage. Peran rahasia dikirim ulang, dan tab lama otomatis diputus.
- Pemain offline atau AFK: giliran dijalankan otomatis setelah batas waktu.
- Host keluar: status host pindah ke pemain lain. Room kosong dihapus setelah 10 menit.
- Validasi nama ganda, room penuh, join saat game berjalan, dan aksi di luar giliran.
