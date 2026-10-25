-- TAMBAHAN MYHOME: RIWAYAT PEMBAYARAN UTANG, KPR & PIUTANG.
-- Jalankan sebagai postgres di Supabase SQL Editor SETELAH supabase/myhome.sql
-- dan supabase/debts.sql. Tidak menghapus data.
-- Dapat diulang untuk versi script ini sendiri.
-- Latar belakang: tombol Catat Pembayaran/Pengembalian hanya mengurangi
-- remaining_amount di myhome.debts; tanggal dan catatan tiap pembayaran
-- tidak tersimpan. Tabel ini menyimpan satu baris per pembayaran agar
-- riwayatnya tampil di kartu dan dapat dihapus (sisa kembali seperti semula).
begin;

do $$
declare v_relation regclass;
begin
  if to_regclass('myhome.households') is null
    or to_regclass('myhome.debts') is null
    or to_regprocedure('myhome_private.my_household_id()') is null
    or to_regprocedure('myhome_private.stamp_shared_row()') is null then
    raise exception 'Schema dasar MyHome belum lengkap. Jalankan supabase/myhome.sql dan supabase/debts.sql dahulu.';
  end if;
  v_relation := to_regclass('myhome.debt_payments');
  if v_relation is not null
    and obj_description(v_relation, 'pg_class') is distinct from 'myhome:debt_payments:v1' then
    raise exception 'myhome.debt_payments sudah ada dari sumber lain. Periksa strukturnya sebelum membuat migration; data tidak diubah.';
  end if;
end;
$$;

create table if not exists myhome.debt_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references myhome.households(id) on delete cascade,
  debt_id uuid not null references myhome.debts(id) on delete cascade,
  amount myhome.rupiah not null check (amount > 0),
  paid_date date not null default current_date,
  note text not null default '' check (length(note) <= 10000),
  created_by uuid references myhome.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table myhome.debt_payments is 'myhome:debt_payments:v1';

create index if not exists debt_payments_household_debt_idx on myhome.debt_payments (household_id, debt_id, paid_date desc);

-- Identitas pembuat, created_at, updated_at diatur server; bukan input klien.
drop trigger if exists stamp_shared_row on myhome.debt_payments;
create trigger stamp_shared_row before insert or update on myhome.debt_payments
  for each row execute function myhome_private.stamp_shared_row();

alter table myhome.debt_payments enable row level security;
drop policy if exists member_read on myhome.debt_payments;
drop policy if exists member_insert on myhome.debt_payments;
drop policy if exists member_update on myhome.debt_payments;
drop policy if exists member_delete on myhome.debt_payments;
create policy member_read on myhome.debt_payments for select to authenticated
  using (household_id = (select myhome_private.my_household_id()));
create policy member_insert on myhome.debt_payments for insert to authenticated
  with check (household_id = (select myhome_private.my_household_id()));
create policy member_update on myhome.debt_payments for update to authenticated
  using (household_id = (select myhome_private.my_household_id()))
  with check (household_id = (select myhome_private.my_household_id()));
create policy member_delete on myhome.debt_payments for delete to authenticated
  using (household_id = (select myhome_private.my_household_id()));

grant select, insert, update, delete on myhome.debt_payments to authenticated;
grant all on myhome.debt_payments to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'myhome' and tablename = 'debt_payments') then
    alter publication supabase_realtime add table myhome.debt_payments;
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
