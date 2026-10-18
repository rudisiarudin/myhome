-- Opsional: jalankan SETELAH myhome.sql, sebagai postgres di Supabase.
-- Aman dijalankan ulang. RLS tetap menyaring event untuk pelanggan berizin.
begin;
do $$
declare v_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'Publication supabase_realtime tidak ditemukan; aktifkan Realtime terlebih dahulu.';
  end if;
  foreach v_table in array array['profiles', 'households', 'household_members', 'household_budgets',
    'wallets', 'saving_goals', 'bills', 'transactions', 'events', 'documents', 'contacts',
    'shopping_items', 'chores', 'wishlist_places', 'food_ideas', 'date_ideas'] loop
    if not exists (select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'myhome' and tablename = v_table) then
      execute format('alter publication supabase_realtime add table myhome.%I', v_table);
    end if;
  end loop;
end;
$$;
commit;
