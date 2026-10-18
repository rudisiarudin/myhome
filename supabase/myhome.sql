-- MyHome: instalasi baru, Supabase PostgreSQL 15+.
-- Jalankan seluruh file lewat SQL Editor sebagai postgres.
-- Tidak mengubah schema public, auth, storage, atau data versi lama.
-- Sengaja bukan migrasi dari schema.sql lama. Jika myhome sudah ada,
-- CREATE SCHEMA akan gagal dan seluruh instalasi dibatalkan, tanpa reset data.
begin;

create schema myhome;
create schema myhome_private;
revoke all on schema myhome, myhome_private from public, anon;
grant usage on schema myhome, myhome_private to authenticated;
grant usage on schema myhome to service_role;

-- Rupiah utuh, sesuai batas input frontend. Kolom positif menambahkan CHECK > 0.
create domain myhome.rupiah as bigint
  check (value between 0 and 999999999999);

create table myhome.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) between 1 and 100),
  avatar_url text check (avatar_url is null or
    (length(avatar_url) <= 2048 and avatar_url ~ '^https://[^[:space:]]+$')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table myhome.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 100),
  owner_user_id uuid not null references myhome.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Model aplikasi saat ini: satu akun dalam satu rumah, maksimal dua orang.
-- Role rumah bukan hak admin. Pemilik rumah ditentukan oleh owner_user_id.
create table myhome.household_members (
  household_id uuid not null references myhome.households(id) on delete cascade,
  user_id uuid not null unique references myhome.profiles(id) on delete cascade,
  role text not null check (role in ('suami', 'istri')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (household_id, role)
);

-- Token undangan tidak dapat dibaca lewat API; hanya hash yang disimpan.
create table myhome.household_invites (
  household_id uuid primary key references myhome.households(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table myhome.household_budgets (
  household_id uuid primary key references myhome.households(id) on delete cascade,
  daily_budget myhome.rupiah not null default 250000 check (daily_budget > 0),
  monthly_budget myhome.rupiah not null default 7500000 check (monthly_budget > 0),
  suami_pocket_budget myhome.rupiah not null default 1000000 check (suami_pocket_budget > 0),
  istri_pocket_budget myhome.rupiah not null default 1000000 check (istri_pocket_budget > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table myhome.wallets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references myhome.households(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  kind text not null check (kind in ('cash', 'bank', 'ewallet')),
  owner text not null check (owner in ('berdua', 'suami', 'istri')),
  opening_balance myhome.rupiah not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id)
);
create unique index wallets_name_unique on myhome.wallets (household_id, lower(btrim(name)));

create table myhome.saving_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references myhome.households(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  target_amount myhome.rupiah not null check (target_amount > 0),
  opening_amount myhome.rupiah not null default 0,
  target_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id)
);

create table myhome.bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references myhome.households(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  amount myhome.rupiah not null check (amount > 0),
  due_date date not null,
  customer_number text not null default '' check (length(customer_number) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id)
);

create table myhome.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references myhome.households(id) on delete cascade,
  wallet_id uuid not null,
  to_wallet_id uuid,
  goal_id uuid,
  bill_id uuid unique,
  kind text not null check (kind in ('expense', 'income', 'transfer', 'saving')),
  title text not null check (length(btrim(title)) between 1 and 120),
  amount myhome.rupiah not null check (amount > 0),
  category text not null check (length(btrim(category)) between 1 and 30),
  pocket text not null default 'household' check (pocket in ('household', 'suami', 'istri')),
  recorded_by text not null check (recorded_by in ('suami', 'istri')),
  recorded_by_user_id uuid references myhome.profiles(id) on delete set null,
  date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, wallet_id) references myhome.wallets(household_id, id) on delete restrict,
  foreign key (household_id, to_wallet_id) references myhome.wallets(household_id, id) on delete restrict,
  foreign key (household_id, goal_id) references myhome.saving_goals(household_id, id) on delete restrict,
  foreign key (household_id, bill_id) references myhome.bills(household_id, id) on delete restrict,
  check ((kind = 'transfer' and to_wallet_id is not null and to_wallet_id <> wallet_id)
    or (kind <> 'transfer' and to_wallet_id is null)),
  check ((kind = 'saving' and goal_id is not null) or (kind <> 'saving' and goal_id is null)),
  check (kind = 'expense' or pocket = 'household'),
  check (bill_id is null or (kind = 'expense' and category = 'tagihan' and pocket = 'household'))
);
create index transactions_household_date on myhome.transactions (household_id, date desc, created_at desc);
create index transactions_wallet on myhome.transactions (household_id, wallet_id);
create index transactions_destination on myhome.transactions (household_id, to_wallet_id) where to_wallet_id is not null;
create index transactions_goal on myhome.transactions (household_id, goal_id) where goal_id is not null;

create table myhome.events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references myhome.households(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 150),
  date date not null,
  time time(0) not null check (time < time '24:00'),
  assignee text not null check (assignee in ('suami', 'istri', 'berdua')),
  note text not null default '' check (length(note) <= 10000),
  is_done boolean not null default false,
  created_by uuid references myhome.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table myhome.documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references myhome.households(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 150),
  category text not null check (category in ('kendaraan', 'lisensi', 'garansi', 'rumah', 'lainnya')),
  expiry_date date not null,
  note text not null default '' check (length(note) <= 10000),
  created_by uuid references myhome.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table myhome.contacts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references myhome.households(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  role text not null default '' check (length(role) <= 100),
  phone text not null check (phone ~ '^\+?[0-9]{3,15}$'),
  category text not null check (category in ('keamanan', 'servis', 'medis', 'rt', 'lainnya')),
  created_by uuid references myhome.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table myhome.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references myhome.households(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 150),
  category text not null default '' check (length(category) <= 50),
  is_bought boolean not null default false,
  added_by text not null check (added_by in ('suami', 'istri')),
  created_by uuid references myhome.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table myhome.chores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references myhome.households(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 150),
  assignee text not null check (assignee in ('suami', 'istri', 'berdua')),
  frequency text not null check (frequency in ('harian', 'mingguan')),
  is_done boolean not null default false,
  last_done_by text check (last_done_by in ('suami', 'istri')),
  last_done_by_user_id uuid references myhome.profiles(id) on delete set null,
  last_done_at timestamptz,
  created_by uuid references myhome.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table myhome.wishlist_places (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references myhome.households(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 150),
  location text not null default '' check (length(location) <= 200),
  category text not null check (category in ('kopi', 'makan', 'jalan', 'liburan')),
  est_budget myhome.rupiah,
  notes text not null default '' check (length(notes) <= 10000),
  created_by uuid references myhome.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table myhome.food_ideas (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references myhome.households(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 150),
  type text not null check (type in ('masak', 'makan-luar')),
  tag text not null default '' check (length(tag) <= 50),
  created_by uuid references myhome.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table myhome.date_ideas (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references myhome.households(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  created_by uuid references myhome.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_household_date on myhome.events (household_id, date, time);
create index documents_household_expiry on myhome.documents (household_id, expiry_date);
create index bills_household_due on myhome.bills (household_id, due_date);

-- Definer terbatas, tidak menggunakan search_path milik pemanggil.
-- Tidak ada kebijakan keanggotaan yang membaca tabelnya sendiri secara rekursif.
create function myhome_private.my_household_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select household_id from myhome.household_members where user_id = (select auth.uid());
$$;

create function myhome_private.lock_household(p_household_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_role text;
begin
  if auth.uid() is null then raise exception 'Silakan login.' using errcode = '42501'; end if;
  -- Semua penulisan keuangan memakai lock yang sama. Validasi saldo dilakukan
  -- sesudah lock, pada statement berikutnya (isolasi default READ COMMITTED).
  perform 1 from myhome.households where id = p_household_id for update;
  select role into v_role from myhome.household_members
    where household_id = p_household_id and user_id = auth.uid();
  if v_role is null then raise exception 'Bukan anggota rumah ini.' using errcode = '42501'; end if;
  return v_role;
end;
$$;

-- View security_invoker mengikuti RLS tabel asal, bukan hak pemilik view.
create view myhome.wallet_balances with (security_invoker = true) as
select w.*, w.opening_balance::numeric + coalesce((
  select sum(case when t.wallet_id = w.id and t.kind = 'income' then t.amount::numeric
    when t.to_wallet_id = w.id and t.kind = 'transfer' then t.amount::numeric
    else -t.amount::numeric end)
  from myhome.transactions t where t.household_id = w.household_id
    and (t.wallet_id = w.id or t.to_wallet_id = w.id)
), 0) as balance from myhome.wallets w;

create view myhome.goal_balances with (security_invoker = true) as
select g.*, g.opening_amount::numeric + coalesce((
  select sum(t.amount::numeric) from myhome.transactions t
    where t.household_id = g.household_id and t.goal_id = g.id and t.kind = 'saving'
), 0) as current_amount from myhome.saving_goals g;

create view myhome.bill_status with (security_invoker = true) as
select b.*, t.id is not null as is_paid, t.id as payment_transaction_id,
  t.recorded_by as paid_by, t.recorded_by_user_id as paid_by_user_id, t.date as paid_date
from myhome.bills b left join myhome.transactions t
  on t.household_id = b.household_id and t.bill_id = b.id;

create view myhome.spending_daily with (security_invoker = true) as
select household_id, date, pocket, sum(amount::numeric) as amount
from myhome.transactions where kind = 'expense' group by household_id, date, pocket;

create function myhome_private.assert_balances(p_household_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from myhome.wallet_balances where household_id = p_household_id and balance < 0) then
    raise exception 'Saldo tidak cukup. Perubahan akan membuat saldo dompet negatif.' using errcode = '23514';
  end if;
end;
$$;

-- Onboarding eksplisit, tidak memasang trigger baru ke auth.users.
create function myhome.initialize_profile(p_full_name text, p_avatar_url text default null)
returns myhome.profiles language plpgsql security definer set search_path = '' as $$
declare v_result myhome.profiles;
begin
  if auth.uid() is null then raise exception 'Silakan login.' using errcode = '42501'; end if;
  insert into myhome.profiles (id, full_name, avatar_url)
    values (auth.uid(), btrim(p_full_name), nullif(btrim(p_avatar_url), ''))
    on conflict (id) do update set full_name = excluded.full_name, avatar_url = excluded.avatar_url
    returning * into v_result;
  return v_result;
end;
$$;

create function myhome.create_household(p_name text, p_role text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform 1 from myhome.profiles where id = auth.uid() for update;
  if not found then raise exception 'Login dan lengkapi profil terlebih dahulu.' using errcode = '42501'; end if;
  if exists (select 1 from myhome.household_members where user_id = auth.uid()) then
    raise exception 'Akun sudah memiliki rumah.';
  end if;
  insert into myhome.households (name, owner_user_id) values (btrim(p_name), auth.uid()) returning id into v_id;
  insert into myhome.household_members (household_id, user_id, role) values (v_id, auth.uid(), p_role);
  insert into myhome.household_budgets (household_id) values (v_id);
  return v_id;
end;
$$;

create function myhome.create_invite(p_household_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_token text;
begin
  perform myhome_private.lock_household(p_household_id);
  if not exists (select 1 from myhome.households where id = p_household_id and owner_user_id = auth.uid()) then
    raise exception 'Hanya pemilik rumah dapat mengundang.' using errcode = '42501';
  end if;
  if (select count(*) from myhome.household_members where household_id = p_household_id) >= 2 then
    raise exception 'Rumah sudah memiliki dua anggota.';
  end if;
  v_token := replace(gen_random_uuid()::text, '-', '');
  insert into myhome.household_invites (household_id, token_hash, expires_at)
    values (p_household_id, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), now() + interval '48 hours')
    on conflict (household_id) do update set token_hash = excluded.token_hash,
      expires_at = excluded.expires_at, created_at = now();
  return v_token;
end;
$$;

create function myhome.join_household(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_hash text; v_role text;
begin
  perform 1 from myhome.profiles where id = auth.uid() for update;
  if not found then raise exception 'Login dan lengkapi profil terlebih dahulu.' using errcode = '42501'; end if;
  if exists (select 1 from myhome.household_members where user_id = auth.uid()) then
    raise exception 'Akun sudah memiliki rumah.';
  end if;
  v_hash := encode(sha256(convert_to(lower(btrim(p_token)), 'UTF8')), 'hex');
  select household_id into v_id from myhome.household_invites where token_hash = v_hash and expires_at > now();
  if v_id is null then raise exception 'Undangan tidak valid atau kedaluwarsa.'; end if;
  -- Urutan lock sama dengan create_invite: rumah, kemudian undangan.
  perform 1 from myhome.households where id = v_id for update;
  perform 1 from myhome.household_invites where household_id = v_id
    and token_hash = v_hash and expires_at > now() for update;
  if not found then raise exception 'Undangan tidak valid atau kedaluwarsa.'; end if;
  if (select count(*) from myhome.household_members where household_id = v_id) <> 1 then
    raise exception 'Rumah tidak menerima anggota baru.';
  end if;
  select case role when 'suami' then 'istri' else 'suami' end into v_role
    from myhome.household_members where household_id = v_id;
  insert into myhome.household_members (household_id, user_id, role) values (v_id, auth.uid(), v_role);
  delete from myhome.household_invites where household_id = v_id;
  return v_id;
end;
$$;

-- JSON pada fungsi save adalah isi formulir lengkap, bukan PATCH.
-- id tidak dikirim untuk membuat baru, dikirim untuk mengedit yang sudah ada.
create function myhome.save_wallet(p_household_id uuid, p_data jsonb)
returns myhome.wallets language plpgsql security definer set search_path = '' as $$
declare v_result myhome.wallets; v_id uuid := (p_data->>'id')::uuid;
begin
  perform myhome_private.lock_household(p_household_id);
  if v_id is null then
    insert into myhome.wallets (household_id, name, kind, owner, opening_balance)
      values (p_household_id, btrim(p_data->>'name'), p_data->>'kind', p_data->>'owner', (p_data->>'opening_balance')::bigint)
      returning * into v_result;
  else
    update myhome.wallets set name = btrim(p_data->>'name'), kind = p_data->>'kind', owner = p_data->>'owner',
      opening_balance = (p_data->>'opening_balance')::bigint
      where household_id = p_household_id and id = v_id returning * into v_result;
    if not found then raise exception 'Dompet tidak ditemukan.'; end if;
  end if;
  perform myhome_private.assert_balances(p_household_id);
  return v_result;
end;
$$;

create function myhome.save_goal(p_household_id uuid, p_data jsonb)
returns myhome.saving_goals language plpgsql security definer set search_path = '' as $$
declare v_result myhome.saving_goals; v_id uuid := (p_data->>'id')::uuid;
begin
  perform myhome_private.lock_household(p_household_id);
  if v_id is null then
    insert into myhome.saving_goals (household_id, title, target_amount, opening_amount, target_date)
      values (p_household_id, btrim(p_data->>'title'), (p_data->>'target_amount')::bigint,
        (p_data->>'opening_amount')::bigint, (p_data->>'target_date')::date) returning * into v_result;
  else
    update myhome.saving_goals set title = btrim(p_data->>'title'), target_amount = (p_data->>'target_amount')::bigint,
      opening_amount = (p_data->>'opening_amount')::bigint, target_date = (p_data->>'target_date')::date
      where household_id = p_household_id and id = v_id returning * into v_result;
    if not found then raise exception 'Impian tidak ditemukan.'; end if;
  end if;
  return v_result;
end;
$$;

create function myhome.save_bill(p_household_id uuid, p_data jsonb)
returns myhome.bills language plpgsql security definer set search_path = '' as $$
declare v_result myhome.bills; v_id uuid := (p_data->>'id')::uuid;
begin
  perform myhome_private.lock_household(p_household_id);
  if v_id is null then
    insert into myhome.bills (household_id, title, amount, due_date, customer_number)
      values (p_household_id, btrim(p_data->>'title'), (p_data->>'amount')::bigint,
        (p_data->>'due_date')::date, coalesce(btrim(p_data->>'customer_number'), '')) returning * into v_result;
  else
    if exists (select 1 from myhome.transactions where household_id = p_household_id and bill_id = v_id) then
      raise exception 'Batalkan lunas sebelum mengubah tagihan, atau ubah transaksi pembayarannya.';
    end if;
    update myhome.bills set title = btrim(p_data->>'title'), amount = (p_data->>'amount')::bigint,
      due_date = (p_data->>'due_date')::date, customer_number = coalesce(btrim(p_data->>'customer_number'), '')
      where household_id = p_household_id and id = v_id returning * into v_result;
    if not found then raise exception 'Tagihan tidak ditemukan.'; end if;
  end if;
  return v_result;
end;
$$;

create function myhome.save_transaction(p_household_id uuid, p_data jsonb)
returns myhome.transactions language plpgsql security definer set search_path = '' as $$
declare v_result myhome.transactions; v_old myhome.transactions;
  v_role text; v_id uuid := (p_data->>'id')::uuid;
begin
  v_role := myhome_private.lock_household(p_household_id);
  if v_id is null then
    if p_data->>'bill_id' is not null then raise exception 'Gunakan pay_bill untuk melunasi tagihan.'; end if;
    insert into myhome.transactions (household_id, wallet_id, to_wallet_id, goal_id, kind, title,
      amount, category, pocket, recorded_by, recorded_by_user_id, date)
    values (p_household_id, (p_data->>'wallet_id')::uuid, (p_data->>'to_wallet_id')::uuid,
      (p_data->>'goal_id')::uuid, p_data->>'kind', btrim(p_data->>'title'), (p_data->>'amount')::bigint,
      p_data->>'category', coalesce(p_data->>'pocket', 'household'), v_role, auth.uid(),
      coalesce((p_data->>'date')::date, current_date)) returning * into v_result;
  else
    select * into v_old from myhome.transactions where household_id = p_household_id and id = v_id;
    if not found then raise exception 'Transaksi tidak ditemukan.'; end if;
    if p_data ? 'bill_id' and (p_data->>'bill_id')::uuid is distinct from v_old.bill_id then
      raise exception 'Tautan tagihan tidak dapat diganti lewat formulir transaksi.';
    end if;
    update myhome.transactions set wallet_id = (p_data->>'wallet_id')::uuid,
      to_wallet_id = (p_data->>'to_wallet_id')::uuid, goal_id = (p_data->>'goal_id')::uuid,
      kind = p_data->>'kind', title = btrim(p_data->>'title'), amount = (p_data->>'amount')::bigint,
      category = p_data->>'category', pocket = coalesce(p_data->>'pocket', 'household'),
      date = coalesce((p_data->>'date')::date, current_date)
      where household_id = p_household_id and id = v_id returning * into v_result;
    -- Pencatat asli tidak berubah walaupun diedit pasangan.
    if v_old.bill_id is not null then
      update myhome.bills set title = v_result.title, amount = v_result.amount
        where household_id = p_household_id and id = v_old.bill_id;
    end if;
  end if;
  perform myhome_private.assert_balances(p_household_id);
  return v_result;
end;
$$;

create function myhome.pay_bill(p_household_id uuid, p_bill_id uuid, p_wallet_id uuid, p_date date default current_date)
returns myhome.transactions language plpgsql security definer set search_path = '' as $$
declare v_bill myhome.bills; v_result myhome.transactions; v_role text;
begin
  v_role := myhome_private.lock_household(p_household_id);
  select * into v_bill from myhome.bills where household_id = p_household_id and id = p_bill_id;
  if not found then raise exception 'Tagihan tidak ditemukan.'; end if;
  if exists (select 1 from myhome.transactions where household_id = p_household_id and bill_id = p_bill_id) then
    raise exception 'Tagihan sudah lunas.';
  end if;
  insert into myhome.transactions (household_id, wallet_id, bill_id, kind, title, amount,
    category, pocket, recorded_by, recorded_by_user_id, date)
  values (p_household_id, p_wallet_id, p_bill_id, 'expense', v_bill.title, v_bill.amount,
    'tagihan', 'household', v_role, auth.uid(), p_date) returning * into v_result;
  perform myhome_private.assert_balances(p_household_id);
  return v_result;
end;
$$;

create function myhome.unpay_bill(p_household_id uuid, p_bill_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform myhome_private.lock_household(p_household_id);
  if not exists (select 1 from myhome.bills where household_id = p_household_id and id = p_bill_id) then
    raise exception 'Tagihan tidak ditemukan.';
  end if;
  delete from myhome.transactions where household_id = p_household_id and bill_id = p_bill_id;
  perform myhome_private.assert_balances(p_household_id);
end;
$$;

create function myhome.delete_financial_record(p_household_id uuid, p_entity text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform myhome_private.lock_household(p_household_id);
  case p_entity
    when 'wallets' then delete from myhome.wallets where household_id = p_household_id and id = p_id;
    when 'saving_goals' then delete from myhome.saving_goals where household_id = p_household_id and id = p_id;
    when 'transactions' then delete from myhome.transactions where household_id = p_household_id and id = p_id;
    when 'bills' then
      -- Hapus tagihan tidak menghapus riwayat pengeluaran yang sudah dibayar.
      update myhome.transactions set bill_id = null where household_id = p_household_id and bill_id = p_id;
      delete from myhome.bills where household_id = p_household_id and id = p_id;
    else raise exception 'Jenis data tidak didukung.';
  end case;
  if not found then raise exception 'Data tidak ditemukan.'; end if;
  perform myhome_private.assert_balances(p_household_id);
end;
$$;

-- Timestamp/identitas data kolaboratif tidak dapat dipalsukan atau dipindahkan.
create function myhome_private.touch_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create function myhome_private.stamp_shared_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_role text;
begin
  select role into v_role from myhome.household_members
    where household_id = new.household_id and user_id = auth.uid();
  if v_role is null then raise exception 'Bukan anggota rumah ini.' using errcode = '42501'; end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  else
    if new.id <> old.id or new.household_id <> old.household_id then
      raise exception 'Identitas dan rumah data tidak dapat dipindahkan.' using errcode = '42501';
    end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  if tg_table_name = 'shopping_items' then
    if tg_op = 'INSERT' then new.added_by := v_role; else new.added_by := old.added_by; end if;
  elsif tg_table_name = 'contacts' then
    new.phone := regexp_replace(new.phone, '[[:space:]()-]', '', 'g');
  elsif tg_table_name = 'chores' then
    if tg_op = 'INSERT' then
      if new.is_done then
        new.last_done_by := v_role; new.last_done_by_user_id := auth.uid(); new.last_done_at := now();
      else
        new.last_done_by := null; new.last_done_by_user_id := null; new.last_done_at := null;
      end if;
    elsif new.is_done and not old.is_done then
      new.last_done_by := v_role; new.last_done_by_user_id := auth.uid(); new.last_done_at := now();
    else
      new.last_done_by := old.last_done_by;
      new.last_done_by_user_id := old.last_done_by_user_id; new.last_done_at := old.last_done_at;
    end if;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

-- RLS untuk seluruh tabel, termasuk tabel undangan tanpa grant/policy klien.
do $$
declare v_table text;
begin
  foreach v_table in array array['profiles', 'households', 'household_members', 'household_invites',
    'household_budgets', 'wallets', 'saving_goals', 'bills', 'transactions', 'events', 'documents',
    'contacts', 'shopping_items', 'chores', 'wishlist_places', 'food_ideas', 'date_ideas'] loop
    execute format('alter table myhome.%I enable row level security', v_table);
  end loop;
  foreach v_table in array array['profiles', 'households', 'household_budgets', 'wallets', 'saving_goals', 'bills', 'transactions'] loop
    execute format('create trigger touch_row before update on myhome.%I for each row execute function myhome_private.touch_row()', v_table);
  end loop;
  foreach v_table in array array['household_members', 'household_budgets', 'wallets', 'saving_goals', 'bills', 'transactions',
    'events', 'documents', 'contacts', 'shopping_items', 'chores', 'wishlist_places', 'food_ideas', 'date_ideas'] loop
    execute format('create policy member_read on myhome.%I for select to authenticated using (household_id = (select myhome_private.my_household_id()))', v_table);
  end loop;
  foreach v_table in array array['events', 'documents', 'contacts', 'shopping_items', 'chores', 'wishlist_places', 'food_ideas', 'date_ideas'] loop
    execute format('create index %I on myhome.%I (household_id)', v_table || '_household_idx', v_table);
    execute format('create trigger stamp_shared_row before insert or update on myhome.%I for each row execute function myhome_private.stamp_shared_row()', v_table);
    execute format('create policy member_insert on myhome.%I for insert to authenticated with check (household_id = (select myhome_private.my_household_id()))', v_table);
    execute format('create policy member_update on myhome.%I for update to authenticated using (household_id = (select myhome_private.my_household_id())) with check (household_id = (select myhome_private.my_household_id()))', v_table);
    execute format('create policy member_delete on myhome.%I for delete to authenticated using (household_id = (select myhome_private.my_household_id()))', v_table);
  end loop;
end;
$$;

create policy household_read on myhome.households for select to authenticated
  using (id = (select myhome_private.my_household_id()));
create policy household_rename on myhome.households for update to authenticated
  using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy profile_read on myhome.profiles for select to authenticated using (
  id = (select auth.uid()) or id in (
    select user_id from myhome.household_members where household_id = (select myhome_private.my_household_id())
  )
);
create policy profile_update on myhome.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy budget_update on myhome.household_budgets for update to authenticated
  using (household_id = (select myhome_private.my_household_id()))
  with check (household_id = (select myhome_private.my_household_id()));

-- Supabase dapat memberi grant bawaan. Cabut dulu lalu berikan minimum.
revoke all on all tables in schema myhome from public, anon, authenticated;
revoke all on all functions in schema myhome from public, anon, authenticated;
revoke all on all functions in schema myhome_private from public, anon, authenticated;
grant select on myhome.profiles, myhome.households, myhome.household_members, myhome.household_budgets,
  myhome.wallets, myhome.saving_goals, myhome.bills, myhome.transactions,
  myhome.wallet_balances, myhome.goal_balances, myhome.bill_status, myhome.spending_daily to authenticated;
grant select, insert, update, delete on myhome.events, myhome.documents, myhome.contacts,
  myhome.shopping_items, myhome.chores, myhome.wishlist_places, myhome.food_ideas, myhome.date_ideas to authenticated;
grant update (full_name, avatar_url) on myhome.profiles to authenticated;
grant update (name) on myhome.households to authenticated;
grant update (daily_budget, monthly_budget, suami_pocket_budget, istri_pocket_budget)
  on myhome.household_budgets to authenticated;
grant execute on function myhome_private.my_household_id() to authenticated;
grant execute on all functions in schema myhome to authenticated;
grant all on all tables in schema myhome to service_role;
-- Fungsi internal lain tetap tidak dapat dipanggil klien, termasuk lock/validasi.
alter default privileges in schema myhome revoke execute on functions from public;
alter default privileges in schema myhome_private revoke execute on functions from public;

notify pgrst, 'reload schema';
commit;
