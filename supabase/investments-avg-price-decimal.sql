-- TAMBAHAN MYHOME: harga beli rata-rata investasi boleh berdesimal.
-- Kolom avg_price semula memakai domain myhome.rupiah (bigint = rupiah utuh),
-- sehingga harga rata-rata seperti 462,13 tidak bisa disimpan persis.
-- Jalankan SETELAH investments.sql di Supabase SQL Editor. Aman diulang:
-- nilai lama (bilangan utuh) terbawa persis, hanya tipenya yang diperluas.
begin;

alter table myhome.investments
  alter column avg_price type numeric(19, 4);

notify pgrst, 'reload schema';
commit;
