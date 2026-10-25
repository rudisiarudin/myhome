-- TAMBAHAN MYHOME: MEMORIES (JURNAL BERDUA).
-- Jalankan sebagai postgres di Supabase SQL Editor SETELAH supabase/myhome.sql
-- (dan idealnya setelah supabase/debts.sql). Tidak menghapus data.
-- Dapat diulang untuk versi script ini sendiri.
-- Latar belakang: klien (repository.ts) dan provider sudah membaca/menulis
-- tabel myhome.memories, tetapi tabelnya belum pernah dibuat di schema aktif
-- (yang ada hanya public.memories di skema lama schema_debts_memories.sql).
begin;

do $$
declare v_relation regclass;
begin
  if to_regclass('myhome.households') is null
    or to_regprocedure('myhome_private.my_household_id()') is null
    or to_regprocedure('myhome_private.stamp_shared_row()') is null then
    raise exception 'Schema dasar MyHome belum lengkap. Jalankan supabase/myhome.sql dahulu.';
  end if;
  v_relation := to_regclass('myhome.memories');
  if v_relation is not null
    and obj_description(v_relation, 'pg_class') is distinct from 'myhome:memories:v1' then
    raise exception 'myhome.memories sudah ada dari sumber lain. Periksa strukturnya sebelum membuat migration; data tidak diubah.';
  end if;
end;
$$;

create table if not exists myhome.memories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references myhome.households(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 150),
  date date not null default current_date,
  note text not null default '' check (length(note) <= 10000),
  category text not null check (category in ('kencan', 'milestone', 'liburan', 'rumah')),
  recorded_by text not null check (recorded_by in ('suami', 'istri')),
  created_by uuid references myhome.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table myhome.memories is 'myhome:memories:v1';

create index if not exists memories_household_date_idx on myhome.memories (household_id, date desc);

-- Identitas pembuat, created_at, updated_at diatur server; bukan input klien.
drop trigger if exists stamp_shared_row on myhome.memories;
create trigger stamp_shared_row before insert or update on myhome.memories
  for each row execute function myhome_private.stamp_shared_row();

alter table myhome.memories enable row level security;
drop policy if exists member_read on myhome.memories;
drop policy if exists member_insert on myhome.memories;
drop policy if exists member_update on myhome.memories;
drop policy if exists member_delete on myhome.memories;
create policy member_read on myhome.memories for select to authenticated
  using (household_id = (select myhome_private.my_household_id()));
create policy member_insert on myhome.memories for insert to authenticated
  with check (household_id = (select myhome_private.my_household_id()));
create policy member_update on myhome.memories for update to authenticated
  using (household_id = (select myhome_private.my_household_id()))
  with check (household_id = (select myhome_private.my_household_id()));
create policy member_delete on myhome.memories for delete to authenticated
  using (household_id = (select myhome_private.my_household_id()));

grant select, insert, update, delete on myhome.memories to authenticated;
grant all on myhome.memories to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'myhome' and tablename = 'memories') then
    alter publication supabase_realtime add table myhome.memories;
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
