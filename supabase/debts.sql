-- TAMBAHAN MYHOME: KPR, KREDIT, UTANG, PIUTANG, DAN NERACA.
-- Jalankan sebagai postgres di Supabase SQL Editor SETELAH myhome.sql.
-- Tidak menghapus data. Dapat diulang untuk versi script ini sendiri.
-- Jika debts/net_worth sudah dibuat oleh script lain, berhenti tanpa menimpanya.
begin;

do $$
declare v_name text; v_relation regclass;
begin
  if to_regclass('myhome.households') is null
    or to_regclass('myhome.wallet_balances') is null
    or to_regclass('myhome.goal_balances') is null
    or to_regprocedure('myhome_private.my_household_id()') is null
    or to_regprocedure('myhome_private.stamp_shared_row()') is null then
    raise exception 'Schema dasar MyHome belum lengkap. Jalankan supabase/myhome.sql dahulu.';
  end if;
  foreach v_name in array array['myhome.debts', 'myhome.net_worth'] loop
    v_relation := to_regclass(v_name);
    if v_relation is not null and obj_description(v_relation, 'pg_class') is distinct from 'myhome:debts:v1' then
      raise exception '% sudah ada dari sumber lain. Periksa strukturnya sebelum membuat migration; data tidak diubah.', v_name;
    end if;
  end loop;
end;
$$;

create table if not exists myhome.debts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references myhome.households(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 150),
  type text not null check (type in ('kpr', 'kendaraan', 'personal', 'piutang')),
  lender_or_borrower text not null check (length(btrim(lender_or_borrower)) between 1 and 150),
  total_amount myhome.rupiah not null check (total_amount > 0),
  remaining_amount myhome.rupiah not null,
  monthly_payment myhome.rupiah check (monthly_payment > 0),
  due_day smallint check (due_day between 1 and 31),
  tenor_months integer check (tenor_months > 0),
  remaining_months integer check (remaining_months >= 0),
  notes text not null default '' check (length(notes) <= 10000),
  created_by uuid references myhome.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (remaining_amount <= total_amount),
  check (tenor_months is null or remaining_months is null or remaining_months <= tenor_months)
);
comment on table myhome.debts is 'myhome:debts:v1';

create index if not exists debts_household_type_idx on myhome.debts (household_id, type);

-- Identitas pembuat, created_at, updated_at diatur server; bukan input klien.
-- Trigger juga melarang perubahan id/household_id untuk memindahkan catatan.
drop trigger if exists stamp_shared_row on myhome.debts;
create trigger stamp_shared_row before insert or update on myhome.debts
  for each row execute function myhome_private.stamp_shared_row();

alter table myhome.debts enable row level security;
drop policy if exists member_read on myhome.debts;
drop policy if exists member_insert on myhome.debts;
drop policy if exists member_update on myhome.debts;
drop policy if exists member_delete on myhome.debts;
create policy member_read on myhome.debts for select to authenticated
  using (household_id = (select myhome_private.my_household_id()));
create policy member_insert on myhome.debts for insert to authenticated
  with check (household_id = (select myhome_private.my_household_id()));
create policy member_update on myhome.debts for update to authenticated
  using (household_id = (select myhome_private.my_household_id()))
  with check (household_id = (select myhome_private.my_household_id()));
create policy member_delete on myhome.debts for delete to authenticated
  using (household_id = (select myhome_private.my_household_id()));

-- Neraca dihitung, tidak disimpan sebagai saldo terpisah yang mudah berbeda.
-- Aggregate terpisah mencegah perkalian baris dompet x tabungan x pinjaman.
-- Tabungan memakai current_amount, termasuk opening_amount dan setoran ledger.
create or replace view myhome.net_worth with (security_invoker = true) as
with wallet_totals as (
  select household_id, sum(balance) as wallet_balance
  from myhome.wallet_balances group by household_id
), saving_totals as (
  select household_id, sum(current_amount) as saving_balance
  from myhome.goal_balances group by household_id
), debt_totals as (
  select household_id,
    coalesce(sum(remaining_amount::numeric) filter (where type = 'piutang'), 0) as receivables,
    coalesce(sum(remaining_amount::numeric) filter (where type <> 'piutang'), 0) as liabilities
  from myhome.debts group by household_id
), totals as (
  select h.id as household_id,
    coalesce(w.wallet_balance, 0) as wallet_balance,
    coalesce(s.saving_balance, 0) as saving_balance,
    coalesce(d.receivables, 0) as receivables,
    coalesce(d.liabilities, 0) as liabilities
  from myhome.households h
  left join wallet_totals w on w.household_id = h.id
  left join saving_totals s on s.household_id = h.id
  left join debt_totals d on d.household_id = h.id
)
select *, wallet_balance + saving_balance + receivables as total_assets,
  wallet_balance + saving_balance + receivables - liabilities as net_worth
from totals;
comment on view myhome.net_worth is 'myhome:debts:v1';

revoke all on myhome.debts, myhome.net_worth from public, anon, authenticated;
grant select, insert, update, delete on myhome.debts to authenticated;
grant select on myhome.net_worth to authenticated;
grant all on myhome.debts, myhome.net_worth to service_role;

-- Realtime opsional; tidak bergantung pada publication pada lingkungan lokal.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'myhome' and tablename = 'debts') then
    alter publication supabase_realtime add table myhome.debts;
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
