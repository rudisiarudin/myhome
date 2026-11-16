# Myhome

**Rumah kecil, cerita kita.**

Myhome adalah aplikasi web rumah tangga (PWA) untuk dua orang: mengelola keuangan, agenda, dan urusan rumah dalam satu tempat. Satu rumah diisi tepat dua akun yang datanya tersinkron, jadi suami dan istri selalu melihat angka dan jadwal yang sama.

Aplikasi live: [ayurudi.web.id](https://ayurudi.web.id)

## Fitur

### Hari Ini

Ringkasan harian dalam satu layar: saldo dompet, pengeluaran hari ini terhadap anggaran, agenda terdekat, dan tagihan yang akan jatuh tempo.

### Keuangan

- **Dompet & transaksi** — catat pemasukan dan pengeluaran per dompet. Pencatatan cepat bisa dari teks bebas, scan struk/QRIS, atau scan saldo, selalu lewat kartu konfirmasi sebelum tersimpan.
- **Anggaran** — anggaran harian Rp250.000 plus anggaran per kategori, terpantau dari rekap pengeluaran.
- **Tabungan** — kantong tabungan dan target, terpisah dari dompet harian.
- **Tagihan** — tagihan berulang dengan pengingat jatuh tempo.
- **Utang & piutang** — catatan utang dan piutang dengan angsuran, jatuh tempo, tenor, serta riwayat pembayaran per tanggal dan catatan. Catatan bisa diedit tanpa menghapus riwayat, dan piutang bisa dibuatkan utang pasangannya dalam satu ketukan.
- **Investasi** — pantau emas (ALLO) dan saham. Nilai investasi ditampilkan terpisah dan **tidak** masuk Kekayaan Bersih.
- **Kekayaan Bersih** — dihitung tetap sebagai **dompet + tabungan − utang**. Piutang tidak pernah dihitung.
- **KPR** — pelacakan cicilan rumah dan sisa tenor.
- **Asisten** — asisten AI untuk bertanya seputar keuangan rumah dan membantu pencatatan.

### Kalender

Agenda bersama dua akun: acara, pengingat, dan kalender keluarga yang selalu sinkron.

### Rumah

Dokumen rumah, kontak penting, tugas rumah, wishlist, daftar belanja, dan perencanaan menu (meal planning).

### Berdua

Ruang khusus berdua: pilihan menu dan ide kencan. Pasangan bergabung memakai kode undangan 48 jam sekali pakai yang dibuat pemilik rumah dari panel avatar.

### Lainnya

- PWA, bisa dipasang di layar utama HP.
- Tema terang/gelap dengan gaya Liquid Glass.
- Sinkron antar-akun lewat Supabase Realtime (bila diaktifkan), pemuatan ulang saat fokus, tombol Muat ulang, dan polling 30 detik.

## Teknologi

| Bagian | Teknologi |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| Gaya | Tailwind CSS 4, font Poppins (lokal), ikon Lucide |
| Backend | Supabase: PostgreSQL (schema `myhome`), Auth, RLS, RPC transaksional, Realtime |
| PWA | vite-plugin-pwa |
| Pengujian | Node test runner + PGlite (PostgreSQL WASM), Playwright |

## Menjalankan secara lokal

```sh
npm ci
```

Salin `.env.example` ke `.env`, lalu isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` (atau `VITE_SUPABASE_PUBLISHABLE_KEY`) dari proyek Supabase yang sama. Jangan pernah memakai secret/service-role key di frontend. Berkas `.env` tidak masuk Git.

```sh
npm run dev -- --host 0.0.0.0 --port 3000
```

Setelah mengubah `.env`, mulai ulang Vite. Bila muncul `Invalid API key`, periksa kecocokan URL dan key di dashboard Supabase.

## Menyiapkan Supabase

Ikuti [`supabase/README.md`](supabase/README.md). Instalasi baru memakai `supabase/myhome.sql`, dengan schema `myhome` ditambahkan ke **Exposed schemas**. Jangan mengekspos `myhome_private`. Jangan jalankan ulang script instalasi bila schema sudah ada; script tidak menimpa data.

Aktifkan provider Email, lalu atur **Authentication → URL Configuration**:

- **Site URL**: alamat aplikasi yang dipakai pengguna.
- **Redirect URLs**: alamat lokal/LAN saat pengembangan dan alamat deployment sebenarnya, agar konfirmasi email dan pemulihan kata sandi kembali ke aplikasi.

Masuk atau daftar melalui aplikasi, konfirmasi email bila Supabase memintanya, isi profil, lalu buat rumah atau gabung memakai kode pasangan. Tidak ada user admin, kata sandi bawaan, atau data contoh yang dimasukkan ke rumah nyata.

## Pemeriksaan

```sh
npm run build
npm run lint
npm test
npx playwright install chromium
npm run test:browser
```

`npm test` menjalankan pengujian domain dan SQL/RLS pada PostgreSQL WASM (PGlite). `test:browser` memakai adapter Auth/PostgREST lokal yang menjalankan SQL asli pada PGlite, bukan akun/proyek Supabase Anda: menguji frontend, persistensi setelah refresh, akses dua anggota, dan kondisi gagal tanpa membuat data pengujian di proyek nyata. Screenshot dan hasil lokal disimpan di `.impeccable/review/` (diabaikan Git).

Lakukan smoke test dua akun dengan Supabase terkelola sebelum produksi. Pengujian lokal bukan verifikasi layanan email Auth, PostgREST, Realtime, atau konkurensi multi-koneksi Supabase sebenarnya.

## Data dan batasan

- Semua fitur rumah membaca dan menulis schema `myhome`. Keuangan memakai RPC transaksional; tabel lain memakai RLS. Pencatat transaksi ditetapkan server dari sesi login.
- Dompet, transaksi, anggaran, tabungan, tagihan, kalender, dokumen, kontak, tugas rumah, wishlist, daftar belanja, serta pilihan menu/kencan tersimpan di database.
- Foto profil memakai URL HTTPS opsional; avatar kosong atau gagal dimuat memakai inisial. Tidak ada upload foto atau berkas dokumen.
- Pembayaran dan transfer di aplikasi adalah **pencatatan**, bukan koneksi bank atau pengiriman uang sungguhan.
- Setelah penyimpanan berhasil, data dibaca ulang. Bila pembacaan ulang gagal, pesan membedakan kondisi ini dari gagal menyimpan dan meminta muat ulang sebelum menulis lagi.
- Tidak ada penyimpanan offline dan tidak ada janji realtime bila layanan Realtime belum diaktifkan.
- Satu rumah maksimal dua anggota. Keluar akun bukan berarti keluar dari keanggotaan rumah. Penghapusan akun/rumah dan perpindahan kepemilikan memerlukan prosedur administratif terpisah.
- Kode preview lama dipertahankan untuk fixture/pengembangan, tetapi entrypoint produksi tidak membuka household contoh atau beralih ke preview saat koneksi gagal.

## Status

Proyek pribadi yang dipakai harian oleh pemiliknya. Pengembangan berjalan lewat branch dan pull request; branch `main` adalah versi yang ter-deploy.
