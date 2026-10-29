-- TAMBAHAN MYHOME: MONITORING INVESTASI (SAHAM IDX & CRYPTO).
-- Jalankan sebagai postgres di Supabase SQL Editor SETELAH myhome.sql.
-- Tidak menghapus data. Dapat diulang untuk versi script ini sendiri.
-- Jika investments sudah dibuat oleh script lain, berhenti tanpa menimpanya.
begin;

do $$
declare v_name text; v_relation regclass;
begin
  if to_regclass('myhome.households') is null
    or to_regprocedure('myhome_private.my_household_id()') is null
    or to_regprocedure('myhome_private.stamp_shared_row()') is null then
    raise exception 'Schema dasar MyHome belum lengkap. Jalankan supabase/myhome.sql dahulu.';
  end if;
  foreach v_name in array array['myhome.investments'] loop
    v_relation := to_regclass(v_name);
    if v_relation is not null and obj_description(v_relation, 'pg_class') is distinct from 'myhome:investments:v1' then
      raise exception '% sudah ada dari sumber lain. Periksa strukturnya sebelum membuat migration; data tidak diubah.', v_name;
    end if;
  end loop;
end;
$$;

create table if not exists myhome.investments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references myhome.households(id) on delete cascade,
  kind text not null check (kind in ('saham', 'crypto')),
  symbol text not null check (length(btrim(symbol)) between 1 and 20),
  name text not null default '' check (length(name) <= 150),
  quantity numeric(28, 10) not null check (quantity > 0),
  avg_price myhome.rupiah not null check (avg_price >= 0),
  created_by uuid references myhome.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table myhome.investments is 'myhome:investments:v1';

create index if not exists investments_household_kind_idx on myhome.investments (household_id, kind);

-- Identitas pembuat, created_at, updated_at diatur server; bukan input klien.
-- Trigger juga melarang perubahan id/household_id untuk memindahkan catatan.
drop trigger if exists stamp_shared_row on myhome.investments;
create trigger stamp_shared_row before insert or update on myhome.investments
  for each row execute function myhome_private.stamp_shared_row();

alter table myhome.investments enable row level security;
drop policy if exists member_read on myhome.investments;
drop policy if exists member_insert on myhome.investments;
drop policy if exists member_update on myhome.investments;
drop policy if exists member_delete on myhome.investments;
create policy member_read on myhome.investments for select to authenticated
  using (household_id = (select myhome_private.my_household_id()));
create policy member_insert on myhome.investments for insert to authenticated
  with check (household_id = (select myhome_private.my_household_id()));
create policy member_update on myhome.investments for update to authenticated
  using (household_id = (select myhome_private.my_household_id()))
  with check (household_id = (select myhome_private.my_household_id()));
create policy member_delete on myhome.investments for delete to authenticated
  using (household_id = (select myhome_private.my_household_id()));

revoke all on myhome.investments from public, anon, authenticated;
grant select, insert, update, delete on myhome.investments to authenticated;
grant all on myhome.investments to service_role;

-- Realtime opsional; tidak bergantung pada publication pada lingkungan lokal.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'myhome' and tablename = 'investments') then
    alter publication supabase_realtime add table myhome.investments;
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
