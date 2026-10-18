# SQL tambahan KPR, utang dan piutang

1. Pastikan instalasi dasar `supabase/myhome.sql` sudah dijalankan. **Jangan menjalankan ulang instalasi dasar** untuk menambah fitur ini.
2. Buka **Supabase → SQL Editor → New query**, salin seluruh [`debts.sql`](./debts.sql), lalu **Run** sebagai `postgres`.
3. Schema `myhome` tetap harus berada di **Exposed schemas**. Tidak perlu schema baru atau mengubah key.

Script menambah tabel `myhome.debts`, view `myhome.net_worth`, indeks, trigger audit, dan RLS. Kedua anggota dapat mengelola catatan rumahnya sendiri; rumah lain dan pengunjung tanpa sesi tidak diberi akses. Realtime untuk `debts` ditambahkan jika publication Supabase tersedia.

Tidak ada data contoh, pinjaman bank, atau transfer uang yang dibuat. Mengulang script versi ini mempertahankan data. Bila nama tabel/view yang sama sudah ada dari script lain, script berhenti agar tidak menimpa struktur atau policy yang belum diketahui.

## Field sesuai model aplikasi

| Frontend | Database | Isi |
| --- | --- | --- |
| `title` | `title` | Nama pinjaman atau catatan piutang |
| `type` | `type` | `kpr`, `kendaraan`, `personal`, `piutang` |
| `lenderOrBorrower` | `lender_or_borrower` | Bank/pemberi pinjaman atau nama peminjam |
| `totalAmount` | `total_amount` | Total pokok, rupiah utuh, lebih dari nol |
| `remainingAmount` | `remaining_amount` | Sisa pokok, nol sampai total pokok |
| `monthlyPayment` | `monthly_payment` | Angsuran bulanan opsional, lebih dari nol |
| `dueDay` | `due_day` | Tanggal jatuh tempo 1–31, opsional |
| `tenorMonths` | `tenor_months` | Tenor dalam bulan, opsional |
| `remainingMonths` | `remaining_months` | Sisa tenor, tidak melebihi tenor jika keduanya diisi |
| `notes` | `notes` | Catatan bunga/tenor, tidak menghitung bunga otomatis |

Nominal memakai domain `myhome.rupiah` yang sama dengan keuangan lain: maksimal `999999999999`, tanpa pecahan. Nilai nol pada `remaining_amount` berarti pokok sudah lunas. Untuk jadwal tanggal 29–31 pada bulan yang lebih pendek, aplikasi perlu menentukan aturan jatuh tempo; script ini tidak membuat jadwal atau notifikasi otomatis.

## Membaca dan menulis

```ts
const db = supabase.schema('myhome')

const { data: debts, error } = await db.from('debts').select('*')
  .eq('household_id', householdId)
if (error) throw error

await db.from('debts').insert({
  household_id: householdId,
  title: 'KPR rumah', type: 'kpr', lender_or_borrower: 'Nama bank',
  total_amount: 300000000, remaining_amount: 280000000,
  monthly_payment: 3500000, due_day: 10,
  tenor_months: 180, remaining_months: 160, notes: '',
})

const { data: balance, error: balanceError } = await db.from('net_worth')
  .select('*').eq('household_id', householdId).single()
if (balanceError) throw balanceError
```

Contoh nominal di atas hanya contoh kode; script tidak memasukkannya. Periksa `error` untuk setiap operasi dalam integrasi sebenarnya.

View menghasilkan `wallet_balance`, `saving_balance`, `receivables`, `liabilities`, `total_assets` dan `net_worth`:

**Aset = saldo dompet + saldo impian (termasuk setoran) + sisa piutang.**

**Kekayaan bersih = aset − sisa KPR/kredit/utang personal.**

Kekayaan bersih boleh negatif. View tidak memasukkan nilai pasar rumah/kendaraan karena belum ada input nilai aset tersebut pada model aplikasi. Ini ringkasan catatan aplikasi, bukan neraca akuntansi atau penilaian kekayaan menyeluruh.

Mencatat/mengubah sisa utang atau piutang **tidak otomatis mengubah saldo dompet** dan tidak membuat transaksi ganda. Pencairan pinjaman, pembayaran angsuran, atau pengembalian piutang tetap dicatat lewat transaksi keuangan sesuai arus kas sebenarnya. Perubahan sisa pokok dilakukan terpisah; belum ada workflow pembayaran pinjaman atomik. Bunga dan tenor hanya metadata, tanpa amortisasi otomatis. Ekspor CSV tetap dikerjakan frontend, bukan tabel SQL tambahan.

## Batas integrasi saat script dibuat

`ConnectedHouseholdProvider` sudah mempunyai adapter tulis/hapus `debts`, tetapi daftar tabel yang dimuat di `repository.ts` belum memasukkan `debts`. SQL saja tidak mengubah kode frontend tersebut. Loader harus membaca `debts` agar catatan muncul setelah refresh. Kartu neraca frontend juga masih menjumlahkan `openingAmount` impian saja; gunakan view ini atau saldo impian termasuk setoran agar konsisten. File frontend yang sedang diubah terpisah tidak ditimpa oleh pekerjaan SQL ini.
