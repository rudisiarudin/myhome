# SQL tambahan monitoring investasi (saham & crypto)

1. Pastikan instalasi dasar `supabase/myhome.sql` sudah dijalankan. **Jangan menjalankan ulang instalasi dasar** untuk menambah fitur ini.
2. Buka **Supabase → SQL Editor → New query**, salin seluruh [`investments.sql`](./investments.sql), lalu **Run** sebagai `postgres`.
3. Schema `myhome` tetap harus berada di **Exposed schemas**. Tidak perlu schema baru atau mengubah key.

Script menambah tabel `myhome.investments`, indeks, trigger audit, dan RLS. Kedua anggota dapat mengelola catatan rumahnya sendiri; rumah lain dan pengunjung tanpa sesi tidak diberi akses. Realtime untuk `investments` ditambahkan jika publication Supabase tersedia.

Tidak ada data contoh yang dibuat. Mengulang script versi ini mempertahankan data. Bila tabel yang sama sudah ada dari script lain, script berhenti agar tidak menimpa struktur atau policy yang belum diketahui.

Aplikasi memuat tabel ini secara lunak: selama script belum dijalankan, bagian Investasi tampil kosong dan bagian lain aplikasi tetap berjalan normal.

## Field sesuai model aplikasi

| Frontend | Database | Isi |
| --- | --- | --- |
| `kind` | `kind` | `saham` (IDX) atau `crypto` |
| `symbol` | `symbol` | Kode emiten (mis. `BBCA`) atau kode crypto (mis. `BTC`) |
| `name` | `name` | Nama tampilan aset, boleh kosong |
| `quantity` | `quantity` | Jumlah pegangan: lembar untuk saham, satuan koin (boleh desimal) untuk crypto |
| `avgPrice` | `avg_price` | Harga beli rata-rata per lembar/koin, rupiah utuh |

## Harga live (bukan dari tabel ini)

- Saham IDX: fungsi server `api/prices.js` meneruskan Yahoo Finance (`<KODE>.JK`) — wajib sesi login yang sah, kode divalidasi ketat.
- Crypto: klien membaca CoinGecko (`simple/price`, mata uang IDR) langsung dari browser.
- Harga tidak disimpan di database; nilai portofolio selalu dihitung dari harga terbaru saat bagian Investasi dibuka/di-refresh.
- Nilai investasi **tidak** masuk perhitungan Kekayaan Bersih di aplikasi (aturan rumah: kekayaan bersih = dompet + tabungan − utang).
