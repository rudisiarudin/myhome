# Database MyHome di Supabase

Tambahan untuk tab **KPR & Neraca**: jalankan [`debts.sql`](./debts.sql) setelah instalasi dasar. Petunjuk, field form, perhitungan neraca, dan batas integrasinya ada di [`DEBTS.md`](./DEBTS.md).

## Cara menjalankan

1. Buka proyek Supabase, **SQL Editor → New query**.
2. Salin seluruh isi [`myhome.sql`](./myhome.sql), lalu **Run** sebagai `postgres`.
3. Di **Project Settings → Data API / API → Exposed schemas**, tambahkan **`myhome`**. Jangan tambahkan `myhome_private`.
4. Jika ingin sinkronisasi melalui Realtime nanti, jalankan [`realtime.sql`](./realtime.sql).
5. Siapkan metode login di **Authentication → Providers**. Buat akun melalui Supabase Auth, bukan INSERT profil dengan ID acak.

Script membutuhkan PostgreSQL 15+ (view `security_invoker`). Script ini instalasi baru, bukan migrasi data. Schema `myhome` dan `myhome_private` sengaja harus belum ada: menjalankan ulang gagal tanpa menimpa data. Jangan menghapus schema untuk memperbarui database; perubahan berikutnya perlu migration tersendiri.

`schema.sql` dan `fix_cleanup.sql` di root adalah versi lama, **tidak diperlukan** untuk instalasi ini. File baru tidak mengubah tabel, policy, fungsi, maupun data `public` yang sudah ada. Khusus `fix_cleanup.sql`, jangan jalankan untuk instalasi baru ini karena menghapus policy lama di `public.profiles`.

Frontend sekarang menggunakan Supabase melalui konfigurasi `.env`, dengan login dan onboarding sebelum membuka rumah. Menjalankan SQL saja tidak mengisi konfigurasi tersebut. Tidak ada data contoh, password, service key, atau saldo fiktif yang dimasukkan script ini. Anggaran awal menggunakan nilai default formulir saat ini dan dapat diedit.

## Cakupan

| Bagian | Tabel / view |
| --- | --- |
| Akun dan avatar URL | `profiles` |
| Rumah, pasangan, undangan | `households`, `household_members`, `household_invites` |
| Anggaran dan uang saku | `household_budgets` |
| Dompet dan saldo | `wallets`, `wallet_balances` |
| Pengeluaran, pemasukan, transfer, setoran | `transactions`, `spending_daily` |
| Impian dan progres tabungan | `saving_goals`, `goal_balances` |
| Tagihan dan pencatatan lunas | `bills`, `bill_status` |
| Kalender | `events` |
| Masa berlaku dokumen, bukan file | `documents` |
| Kontak penting | `contacts` |
| Daftar belanja | `shopping_items` |
| Tugas rumah | `chores` |
| Wishlist tempat kencan | `wishlist_places` |
| Pilihan makanan dan ide kencan | `food_ideas`, `date_ideas` |

Hari Ini memakai gabungan view/tabel tersebut, bukan salinan data tersendiri. Acak makanan/kencan bisa dilakukan frontend dari tabel ide; hasil acak sementara tidak disimpan. Masa berlaku dokumen dihitung dari `expiry_date`, bukan kolom jumlah hari yang mudah kedaluwarsa. Tagihan bulanan berikutnya dibuat sebagai catatan baru, tanpa scheduler otomatis.

## Alur akun

Satu akun hanya dapat tergabung dalam satu rumah. Satu rumah memiliki satu `suami` dan satu `istri`, sesuai model frontend. Role ini tidak memberi hak admin: pemilik rumah adalah `households.owner_user_id`.

Sesudah login, panggil RPC dengan sesi user yang bersangkutan:

```ts
const db = supabase.schema('myhome')

// Akun pertama: isi profil, lalu buat rumah.
await db.rpc('initialize_profile', {
  p_full_name: 'Nama saya',
  p_avatar_url: null, // URL HTTPS foto akun jika ada, bukan upload/base64.
})
const { data: householdId, error } = await db.rpc('create_household', {
  p_name: 'Rumah kita', p_role: 'suami',
})
if (error) throw error

const { data: inviteToken } = await db.rpc('create_invite', {
  p_household_id: householdId,
})
// Bagikan token hanya kepada pasangan. Berlaku 48 jam, sekali pakai.
```

Akun pasangan login sendiri, panggil `initialize_profile`, kemudian:

```ts
await supabase.schema('myhome').rpc('join_household', { p_token: inviteToken })
```

Pasangan otomatis mendapat role yang belum terisi. Token baru membatalkan token sebelumnya. Tabel undangan tidak bisa dibaca klien. Tidak ada RPC keluar rumah, mengeluarkan pasangan, menghapus rumah, atau memindahkan kepemilikan dalam versi ini. Penghapusan akun pemilik diblokir oleh foreign key selama rumah masih dimilikinya, sehingga perlu prosedur administratif tersendiri. Batasi percobaan join/login di lapisan aplikasi bila dibuka untuk publik; SQL ini tidak menyediakan rate limiting.

`profiles.id` menggunakan ID Supabase Auth. Saat menghubungkan UI, gabungkan `profiles` dengan `household_members`: `full_name → name`, `avatar_url → avatarUrl`, dan `role` dari tabel anggota. Nama Rudi/Istri bukan identitas yang di-hardcode ke database. Profil dibuat eksplisit saat onboarding, tanpa memasang trigger yang berpotensi mengganggu signup proyek lama.

## Menulis data keuangan

Tabel keuangan **read-only untuk klien**. Semua perubahan melalui RPC agar perubahan saldo, pembayaran, dan rollback berada dalam satu transaksi dengan row lock per rumah. Jangan menggunakan service key di browser atau menulis keuangan langsung dari Table Editor: akses administrator dapat melewati aturan RPC.

Semua `save_*` menerima `p_household_id` dan `p_data` JSON dengan **seluruh field formulir**. Tanpa `id` membuat catatan baru; dengan `id` mengedit catatan yang sudah ada di rumah tersebut. Tidak boleh memilih UUID catatan baru sendiri melalui RPC ini. Nama field database memakai `snake_case`, berbeda dari `camelCase` frontend. UUID contoh frontend seperti `cash` / `ch1` bukan UUID database dan tidak boleh dikirim langsung.

| RPC | Field `p_data` |
| --- | --- |
| `save_wallet` | `id?`, `name`, `kind`, `owner`, `opening_balance` |
| `save_goal` | `id?`, `title`, `target_amount`, `opening_amount`, `target_date` |
| `save_bill` | `id?`, `title`, `amount`, `due_date`, `customer_number?` |
| `save_transaction` | `id?`, `kind`, `title`, `amount`, `wallet_id`, `to_wallet_id?`, `goal_id?`, `category`, `pocket?`, `date?` |

```ts
const db = supabase.schema('myhome')
const { data: wallet, error } = await db.rpc('save_wallet', {
  p_household_id: householdId,
  p_data: { name: 'Tunai', kind: 'cash', owner: 'berdua', opening_balance: 100000 },
}).single()
if (error) throw error

await db.rpc('save_transaction', {
  p_household_id: householdId,
  p_data: {
    kind: 'expense', title: 'Belanja dapur', amount: 25000,
    wallet_id: wallet.id, category: 'makan', pocket: 'household', date: '2026-10-18',
  },
})

// Untuk tagihan: hanya pencatatan, tidak mengirim uang ke bank.
await db.rpc('pay_bill', {
  p_household_id: householdId, p_bill_id: billId, p_wallet_id: wallet.id,
  p_date: '2026-10-18',
})
await db.rpc('unpay_bill', { p_household_id: householdId, p_bill_id: billId })

await db.rpc('delete_financial_record', {
  p_household_id: householdId, p_entity: 'transactions', p_id: transactionId,
})
```

Aturan ledger:
- Pemasukan menambah saldo; pengeluaran dan setoran tabungan mengurangi saldo.
- Transfer mengurangi dompet asal dan menambah dompet tujuan, tanpa menjadi belanja.
- Setoran menambah progres impian; tidak dihitung sebagai pengeluaran konsumsi.
- `recorded_by` dan `recorded_by_user_id` ditentukan server dari sesi login. Input identitas pencatat dari JSON tidak dipercaya. Mengedit tidak mengganti pencatat asli.
- Saldo dihitung dari saldo awal dan ledger, tidak ada kolom saldo yang harus di-update manual. Saldo akhir saat ini tidak boleh negatif; tidak ada validasi saldo historis per tanggal.
- Edit/hapus pemasukan atau transfer ditolak jika membuat dompet mana pun negatif. Saldo awal juga tidak boleh diturunkan di bawah kebutuhan transaksi yang sudah ada.
- UUID dompet/tujuan/impian/tagihan harus berasal dari rumah yang sama, ditegakkan composite foreign key.
- `pay_bill` membuat tepat satu pengeluaran. `bill_status.is_paid` berasal dari pengeluaran tersebut; melunasi dua kali ditolak. `unpay_bill` menghapus transaksi pembayaran dan mengembalikan saldo.
- Mengedit pembayaran lewat `save_transaction` menyelaraskan judul dan nominal tagihan. Pembayaran harus tetap pengeluaran kategori `tagihan`, pocket `household`. Status tagihan tidak bisa diubah dengan UPDATE boolean.
- `delete_financial_record`: `p_entity` hanya `wallets`, `saving_goals`, `bills`, atau `transactions`. Dompet/impian yang direferensikan tidak bisa dihapus. Hapus tagihan melepas tautan, tetapi mempertahankan riwayat pembayaran. Hapus transaksi pembayaran membuat tagihan belum lunas lagi.
- Nominal input berupa rupiah utuh sampai `999999999999`, tanpa pecahan. Jangan membulatkan nominal desimal sebelum mengirim. Total hasil agregasi menggunakan PostgreSQL `numeric`; bila data besar, jangan konversi melebihi batas integer aman JavaScript.

Semua contoh harus memeriksa `error` di integrasi sebenarnya. Tanggal harus `YYYY-MM-DD`; `p_date` default menggunakan tanggal database. Kirim tanggal lokal dari aplikasi untuk menghindari selisih zona waktu. Waktu kalender disimpan sebagai `HH:mm:ss` lokal, tanpa timezone; timestamp audit memakai `timestamptz`.

## Data lain dan pembacaan

`events`, `documents`, `contacts`, `shopping_items`, `chores`, `wishlist_places`, `food_ideas`, `date_ideas` mendukung `.select/.insert/.update/.delete` dengan RLS. Selalu isi `household_id` ketika membuat data. Trigger menetapkan identitas pembuat dan penyelesai tugas dari sesi; ID, rumah, dan pembuat tidak bisa dipindahkan lewat update. Nomor kontak dinormalisasi server dan harus 3–15 digit, boleh diawali `+`. Menandai tugas selesai mencatat akun dan waktu server; membatalkan selesai mempertahankan catatan penyelesaian sebelumnya.

```ts
await db.from('events').insert({
  household_id: householdId, title: 'Belanja mingguan',
  date: '2026-10-18', time: '09:00', assignee: 'berdua', note: '',
})
await db.from('household_budgets').update({ daily_budget: 200000 })
  .eq('household_id', householdId)
const { data: balances } = await db.from('wallet_balances').select('*')
const { data: bills } = await db.from('bill_status').select('*').order('due_date')
```

Kedua anggota boleh mengedit data bersama. Profil hanya boleh diubah pemilik akun; nama rumah hanya pemilik rumah. Tabel keanggotaan hanya diubah RPC onboarding, tidak lewat INSERT manual dari klien. Tidak ada akses data untuk pengunjung tanpa sesi. Gunakan publishable/anon key dengan sesi Supabase Auth di frontend, **jangan service-role/secret key**.

Realtime menerbitkan perubahan tabel, bukan view. Subscribe ke `myhome.transactions` lalu refetch view saldo/status yang terkait. Untuk DELETE, jangan mengandalkan isi payload atau filter RLS sebagai pembatas data sensitif: Supabase memiliki batasan event DELETE dan payload key. Refetch daftar melalui SELECT ber-RLS. SQL opsional tidak mengimplementasikan subscription frontend.

Foto profil hanya menyimpan URL HTTPS. Penyimpanan dokumen, upload foto, bucket Storage, transaksi bank asli, notifikasi terjadwal, dan pemindahan data demo belum dibuat, sesuai cakupan fitur saat ini.

## Verifikasi lokal

`tests/myhome-sql.test.mjs` menjalankan SQL pada PostgreSQL WASM (PGlite) dengan mock minimal Supabase Auth/role. Dependency tersedia sebagai dev dependency:

```sh
npm ci
npm test
```

Pengujian lokal bukan koneksi ke proyek Supabase Anda dan bukan uji konkurensi multi-koneksi atau layanan Auth/Realtime/Storage/PostgREST terkelola. Lakukan uji dua akun di proyek staging sebelum produksi.
