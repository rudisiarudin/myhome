# MyHome

Aplikasi rumah tangga untuk dua akun: Hari Ini, Keuangan, Kalender, Rumah, dan Berdua. Dibuat dengan React, TypeScript, Vite, dan Supabase. Poppins lokal serta tema terang/gelap dipertahankan.

## Menjalankan

```sh
npm ci
```

Salin `.env.example` ke `.env`, kemudian isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` atau `VITE_SUPABASE_PUBLISHABLE_KEY` dari proyek yang sama. Jangan gunakan secret/service-role key di frontend. `.env` tidak masuk Git.

```sh
npm run dev -- --host 0.0.0.0 --port 3000
```

Setelah mengubah `.env`, mulai ulang Vite. Bila muncul `Invalid API key`, periksa kecocokan URL dan key di dashboard Supabase.

## Menyiapkan Supabase

Ikuti [`supabase/README.md`](supabase/README.md). Instalasi baru memakai `supabase/myhome.sql`, dengan schema `myhome` ditambahkan ke **Exposed schemas**. Jangan mengekspos `myhome_private`. Jangan jalankan ulang script instalasi jika schema sudah ada; script tidak menimpa data.

Aktifkan provider Email, serta atur **Authentication → URL Configuration**:
- Site URL: alamat aplikasi yang dipakai pengguna.
- Redirect URLs: alamat lokal/LAN saat pengembangan dan alamat deployment sebenarnya, agar konfirmasi email dan pemulihan kata sandi kembali ke aplikasi.

Masuk atau daftar melalui aplikasi. Konfirmasi email bila Supabase memintanya. Isi profil, lalu buat rumah atau gabung memakai kode pasangan. Pemilik rumah membuat kode 48 jam sekali pakai dari panel avatar. Tidak ada user admin, password bawaan, atau data contoh yang dimasukkan ke rumah nyata.

## Data dan batasan

- Semua fitur rumah membaca dan menulis schema `myhome`. Keuangan memakai RPC transaksional, tabel lain memakai RLS. Pencatat transaksi ditetapkan server dari sesi login.
- Dompet, transaksi, anggaran, tabungan, tagihan, kalender, dokumen, kontak, tugas rumah, wishlist, daftar belanja, serta pilihan menu/kencan tersimpan di database.
- Foto profil memakai URL HTTPS opsional. Avatar kosong/gagal dimuat memakai inisial. Tidak ada upload foto atau berkas dokumen.
- Pembayaran/transfer adalah pencatatan, bukan koneksi bank atau pengiriman uang sungguhan.
- Setelah penyimpanan berhasil, data dibaca ulang. Bila pembacaan ulang gagal, pesan membedakan kondisi ini dari gagal menyimpan dan meminta muat ulang sebelum menulis lagi.
- Pembaruan antar-akun memakai subscription Realtime bila diaktifkan, pemuatan ulang saat fokus, tombol Muat ulang, serta polling 30 detik. Tidak ada penyimpanan offline atau janji realtime bila layanan tersebut belum diaktifkan.
- Satu rumah maksimal dua anggota. Keluar akun bukan keluar dari keanggotaan rumah. Penghapusan akun/rumah dan perpindahan kepemilikan memerlukan prosedur administratif terpisah.
- Kode preview lama dipertahankan untuk fixture/pengembangan, tetapi entrypoint produksi tidak membuka household contoh atau beralih ke preview saat koneksi gagal.

## Pemeriksaan

```sh
npm run build
npm run lint
npm test
npx playwright install chromium
npm run test:browser
```

`npm test` menjalankan pengujian domain dan SQL/RLS pada PostgreSQL WASM (PGlite). `test:browser` memakai adapter Auth/PostgREST lokal yang menjalankan SQL asli pada PGlite, bukan akun/proyek Supabase Anda. Ini menguji frontend, persistensi setelah refresh, akses dua anggota, serta kondisi gagal tanpa membuat akun atau data pengujian di proyek nyata. Screenshot dan hasil lokal disimpan di `.impeccable/review/` (diabaikan Git).

Lakukan smoke test dua akun dengan Supabase terkelola sebelum produksi. Pengujian lokal bukan verifikasi layanan email Auth, PostgREST, Realtime, atau konkurensi multi-koneksi Supabase sebenarnya.
