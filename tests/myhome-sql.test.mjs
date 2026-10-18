import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const { PGlite } = await import(process.env.MYHOME_PGLITE_PATH
  ? pathToFileURL(process.env.MYHOME_PGLITE_PATH).href : '@electric-sql/pglite')
const sql = await readFile(new URL('../supabase/myhome.sql', import.meta.url), 'utf8')
const realtimeSql = await readFile(new URL('../supabase/realtime.sql', import.meta.url), 'utf8')

test('MyHome Supabase schema, RPC, ledger and tenant isolation', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create table public.profiles (legacy_value text);
    insert into public.profiles values ('keep existing user data');
  `)
  await db.exec(sql)
  const q = (query, params = []) => db.query(query, params)
  const one = async (query, params = []) => (await q(query, params)).rows[0]
  const rpc = async (name, params) => {
    const placeholders = params.map((_, i) => `$${i + 1}`).join(', ')
    return (await one(`select to_jsonb(myhome.${name}(${placeholders})) as result`, params)).result
  }
  const actor = async (id, role = 'authenticated') => {
    await db.exec('reset role')
    await q("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ''])
    await db.exec(`set role ${role}`)
  }
  const alice = '11111111-1111-4111-8111-111111111111'
  const bob = '22222222-2222-4222-8222-222222222222'
  const eve = '33333333-3333-4333-8333-333333333333'
  const late = '44444444-4444-4444-8444-444444444444'
  await q('insert into auth.users values ($1), ($2), ($3), ($4)', [alice, bob, eve, late])
  let house, otherHouse, wallet, destination, foreignWallet, goal, bill, payment, invite

  await t.test('installs atomically, enables RLS on all 17 tables and preserves public data', async () => {
    const result = await one(`select count(*)::int as total, bool_and(c.relrowsecurity) as all_rls
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'myhome' and c.relkind = 'r'`)
    assert.deepEqual(result, { total: 17, all_rls: true })
    assert.equal((await one('select legacy_value from public.profiles')).legacy_value, 'keep existing user data')
    await assert.rejects(db.exec(sql), /already exists/)
    await db.exec('rollback')
    assert.equal((await one('select count(*)::int as count from myhome.profiles')).count, 0)
  })

  await t.test('signed-out callers cannot read tables, call RPC or use private helpers', async () => {
    await actor(null, 'anon')
    await assert.rejects(q('select * from myhome.profiles'), /permission denied/)
    await assert.rejects(rpc('create_household', ['Intrusion', 'suami']), /permission denied/)
    await actor(null)
    await assert.rejects(rpc('initialize_profile', ['No session']), /Silakan login/)
    await assert.rejects(q('select myhome_private.assert_balances(gen_random_uuid())'), /permission denied/)
    await assert.rejects(q('select myhome_private.lock_household(gen_random_uuid())'), /permission denied/)
  })

  await t.test('profile initialization is bound to Auth identity and validates photo URL', async () => {
    await actor(alice)
    const profile = await rpc('initialize_profile', ['Alice', 'https://example.com/avatar.jpg'])
    assert.equal(profile.id, alice)
    await assert.rejects(rpc('initialize_profile', ['Alice', 'javascript:alert(1)']), /check constraint/)
    assert.equal((await one('select full_name from myhome.profiles')).full_name, 'Alice')
    await assert.rejects(q('update myhome.profiles set id = $1', [bob]), /permission denied/)
  })

  await t.test('creates a household and budget, prevents duplicate membership', async () => {
    house = await rpc('create_household', ['Rumah Alice', 'suami'])
    assert.equal((await one('select count(*)::int as n from myhome.household_members')).n, 1)
    assert.equal((await one('select daily_budget from myhome.household_budgets')).daily_budget, 250000)
    await assert.rejects(rpc('create_household', ['Duplicate', 'istri']), /sudah memiliki rumah/)
    invite = await rpc('create_invite', [house])
    assert.match(invite, /^[a-f0-9]{32}$/)
    await assert.rejects(q('select * from myhome.household_invites'), /permission denied/)
    await assert.rejects(q('insert into myhome.household_members values ($1, $2, $3, now())', [house, bob, 'istri']), /permission denied/)
  })

  await t.test('rotated invite is invalid, joining assigns unused role, consumed invite cannot be reused', async () => {
    const oldInvite = invite
    invite = await rpc('create_invite', [house])
    await actor(bob)
    await rpc('initialize_profile', ['Bob'])
    await assert.rejects(rpc('join_household', [oldInvite]), /Undangan tidak valid/)
    assert.equal(await rpc('join_household', [invite]), house)
    assert.equal((await one('select role from myhome.household_members where user_id = $1', [bob])).role, 'istri')
    await assert.rejects(rpc('create_invite', [house]), /Hanya pemilik/)
    await actor(late)
    await rpc('initialize_profile', ['Late'])
    await assert.rejects(rpc('join_household', [invite]), /Undangan tidak valid/)
    await actor(alice)
    await assert.rejects(rpc('create_invite', [house]), /dua anggota/)
  })

  await t.test('unrelated household cannot see household rows or profiles; views obey RLS', async () => {
    await actor(eve)
    await rpc('initialize_profile', ['Eve'])
    otherHouse = await rpc('create_household', ['Rumah Eve', 'istri'])
    foreignWallet = await rpc('save_wallet', [otherHouse, { name: 'Private', kind: 'cash', owner: 'berdua', opening_balance: 10000 }])
    assert.equal((await one('select count(*)::int as n from myhome.households')).n, 1)
    assert.equal((await one('select count(*)::int as n from myhome.profiles')).n, 1)
    await actor(alice)
    assert.equal((await one('select count(*)::int as n from myhome.profiles')).n, 2)
    assert.equal((await one('select count(*)::int as n from myhome.wallet_balances')).n, 0)
    await assert.rejects(rpc('save_wallet', [otherHouse, { name: 'Attack', kind: 'cash', owner: 'berdua', opening_balance: 0 }]), /Bukan anggota/)
    const update = await q('update myhome.profiles set full_name = $1 where id = $2 returning id', ['Attack', eve])
    assert.equal(update.rows.length, 0)
  })

  await t.test('financial writes require RPC, wallet names are unique and amounts must be integer rupiah', async () => {
    await assert.rejects(q(`insert into myhome.wallets (household_id,name,kind,owner) values ($1,'Bypass','cash','berdua')`, [house]), /permission denied/)
    wallet = await rpc('save_wallet', [house, { name: 'Tunai', kind: 'cash', owner: 'berdua', opening_balance: 100000 }])
    destination = await rpc('save_wallet', [house, { name: 'Bank', kind: 'bank', owner: 'istri', opening_balance: 0 }])
    await assert.rejects(rpc('save_wallet', [house, { name: ' tunai ', kind: 'cash', owner: 'berdua', opening_balance: 0 }]), /unique constraint/)
    for (const amount of [-1, 0.5, 1000000000000]) {
      await assert.rejects(rpc('save_wallet', [house, { name: 'Invalid', kind: 'cash', owner: 'berdua', opening_balance: amount }]))
    }
    const balance = await one('select balance from myhome.wallet_balances where id = $1', [wallet.id])
    assert.equal(Number(balance.balance), 100000)
  })

  const expense = overrides => ({ kind: 'expense', title: 'Belanja', amount: 10000,
    wallet_id: wallet.id, category: 'makan', pocket: 'household', date: '2026-10-18', ...overrides })

  await t.test('expenses, incomes and transfer derive balances; caller cannot forge recorder', async () => {
    const entry = await rpc('save_transaction', [house, expense({ recorded_by: 'istri', recorded_by_user_id: bob })])
    assert.equal(entry.recorded_by_user_id, alice)
    assert.equal(entry.recorded_by, 'suami')
    await rpc('save_transaction', [house, expense({ kind: 'income', amount: 20000, category: 'pemasukan' })])
    await rpc('save_transaction', [house, expense({ kind: 'transfer', amount: 30000, to_wallet_id: destination.id, category: 'transfer' })])
    assert.equal(Number((await one('select balance from myhome.wallet_balances where id = $1', [wallet.id])).balance), 80000)
    assert.equal(Number((await one('select balance from myhome.wallet_balances where id = $1', [destination.id])).balance), 30000)
    assert.equal(Number((await one('select sum(amount) as total from myhome.spending_daily')).total), 10000)
    await actor(bob)
    const edited = await rpc('save_transaction', [house, expense({ id: entry.id, amount: 15000 })])
    assert.equal(edited.recorded_by_user_id, alice)
    assert.equal(Number((await one('select balance from myhome.wallet_balances where id = $1', [wallet.id])).balance), 75000)
    await actor(alice)
  })

  await t.test('rejects insufficient funds, malformed transactions and cross-household references', async () => {
    await assert.rejects(rpc('save_transaction', [house, expense({ amount: 999999 })]), /Saldo tidak cukup/)
    await assert.rejects(rpc('save_transaction', [house, expense({ amount: 0 })]), /check constraint/)
    await assert.rejects(rpc('save_transaction', [house, expense({ amount: 1.5 })]), /invalid input syntax/)
    await assert.rejects(rpc('save_transaction', [house, expense({ date: '2026-02-30' })]), /out of range/)
    await assert.rejects(rpc('save_transaction', [house, expense({ kind: 'transfer', to_wallet_id: wallet.id })]), /check constraint/)
    await assert.rejects(rpc('save_transaction', [house, expense({ kind: 'transfer', to_wallet_id: foreignWallet.id })]), /foreign key constraint/)
    await assert.rejects(rpc('save_transaction', [house, expense({ kind: 'saving' })]), /check constraint/)
    await assert.rejects(rpc('save_transaction', [house, expense({ wallet_id: foreignWallet.id })]), /foreign key constraint/)
    await assert.rejects(rpc('save_wallet', [house, { id: wallet.id, name: 'Tunai', kind: 'cash', owner: 'berdua', opening_balance: 0 }]), /Saldo tidak cukup/)
  })

  await t.test('funded goal progress is derived and referenced goals/wallets cannot be removed', async () => {
    goal = await rpc('save_goal', [house, { title: 'Liburan', target_amount: 500000, opening_amount: 10000, target_date: '2027-01-01' }])
    await rpc('save_transaction', [house, expense({ kind: 'saving', amount: 20000, goal_id: goal.id, category: 'tabungan' })])
    assert.equal(Number((await one('select current_amount from myhome.goal_balances where id = $1', [goal.id])).current_amount), 30000)
    assert.equal(Number((await one('select sum(amount) as total from myhome.spending_daily')).total), 15000)
    await assert.rejects(rpc('delete_financial_record', [house, 'saving_goals', goal.id]), /foreign key constraint/)
    await assert.rejects(rpc('delete_financial_record', [house, 'wallets', wallet.id]), /foreign key constraint/)
  })

  await t.test('income deletion/edit rolls back when money has already been consumed', async () => {
    const isolated = await rpc('save_wallet', [house, { name: 'Dependent', kind: 'cash', owner: 'berdua', opening_balance: 0 }])
    const income = await rpc('save_transaction', [house, expense({ kind: 'income', wallet_id: isolated.id, amount: 5000, category: 'pemasukan' })])
    const spent = await rpc('save_transaction', [house, expense({ wallet_id: isolated.id, amount: 5000 })])
    await assert.rejects(rpc('delete_financial_record', [house, 'transactions', income.id]), /Saldo tidak cukup/)
    await assert.rejects(rpc('save_transaction', [house, expense({ id: income.id, kind: 'income', wallet_id: isolated.id, amount: 1000, category: 'pemasukan' })]), /Saldo tidak cukup/)
    assert.equal((await one('select amount from myhome.transactions where id = $1', [income.id])).amount, 5000)
    await rpc('delete_financial_record', [house, 'transactions', spent.id])
    await rpc('delete_financial_record', [house, 'transactions', income.id])
    await rpc('delete_financial_record', [house, 'wallets', isolated.id])
  })

  await t.test('bill payment is atomic, cannot be doubled, and edits synchronize original bill', async () => {
    bill = await rpc('save_bill', [house, { title: 'Internet', amount: 10000, due_date: '2026-10-25' }])
    assert.equal((await one('select is_paid from myhome.bill_status where id = $1', [bill.id])).is_paid, false)
    payment = await rpc('pay_bill', [house, bill.id, wallet.id, '2026-10-18'])
    await assert.rejects(rpc('pay_bill', [house, bill.id, wallet.id]), /sudah lunas/)
    assert.equal((await one('select is_paid from myhome.bill_status where id = $1', [bill.id])).is_paid, true)
    await assert.rejects(rpc('save_bill', [house, { ...bill, title: 'Bypass' }]), /Batalkan lunas/)
    await actor(bob)
    const edited = await rpc('save_transaction', [house, expense({ id: payment.id, title: 'Internet baru', amount: 12000, category: 'tagihan' })])
    assert.equal(edited.recorded_by_user_id, alice)
    assert.equal((await one('select amount from myhome.bills where id = $1', [bill.id])).amount, 12000)
    assert.equal((await one('select title from myhome.bills where id = $1', [bill.id])).title, 'Internet baru')
    await assert.rejects(rpc('save_transaction', [house, expense({ id: payment.id, category: 'makan' })]), /check constraint/)
    await actor(alice)
    await rpc('unpay_bill', [house, bill.id])
    assert.equal((await one('select is_paid from myhome.bill_status where id = $1', [bill.id])).is_paid, false)
    payment = await rpc('pay_bill', [house, bill.id, wallet.id])
    await rpc('delete_financial_record', [house, 'bills', bill.id])
    assert.equal((await one('select bill_id from myhome.transactions where id = $1', [payment.id])).bill_id, null)
  })

  await t.test('failed payment leaves no payment/status, linked deletion returns to unpaid', async () => {
    const expensive = await rpc('save_bill', [house, { title: 'Too expensive', amount: 900000, due_date: '2026-10-25' }])
    await assert.rejects(rpc('pay_bill', [house, expensive.id, wallet.id]), /Saldo tidak cukup/)
    assert.equal((await one('select is_paid from myhome.bill_status where id = $1', [expensive.id])).is_paid, false)
    const small = await rpc('save_bill', [house, { title: 'Small', amount: 1000, due_date: '2026-10-25' }])
    const paid = await rpc('pay_bill', [house, small.id, wallet.id])
    await rpc('delete_financial_record', [house, 'transactions', paid.id])
    assert.equal((await one('select is_paid from myhome.bill_status where id = $1', [small.id])).is_paid, false)
    await assert.rejects(rpc('save_transaction', [house, expense({ bill_id: small.id })]), /Gunakan pay_bill/)
  })

  await t.test('both members can CRUD all eight collaborative sections; strangers cannot', async () => {
    const fixtures = {
      events: { title: 'Agenda', date: '2026-10-18', time: '09:00', assignee: 'berdua' },
      documents: { title: 'SIM', category: 'lisensi', expiry_date: '2027-01-01' },
      contacts: { name: 'Kontak', category: 'servis', phone: '+62 (812) 123-456' },
      shopping_items: { title: 'Sayur', added_by: 'istri' },
      chores: { title: 'Sapu', assignee: 'istri', frequency: 'harian' },
      wishlist_places: { title: 'Taman', category: 'jalan' },
      food_ideas: { title: 'Sup', type: 'masak' },
      date_ideas: { title: 'Jalan sore' },
    }
    for (const [table, fixture] of Object.entries(fixtures)) {
      await actor(alice)
      const data = { household_id: house, ...fixture, created_by: bob }
      const keys = Object.keys(data)
      const row = await one(`insert into myhome.${table} (${keys.join(',')})
        values (${keys.map((_, i) => `$${i + 1}`).join(',')}) returning *`, Object.values(data))
      assert.equal(row.created_by, alice, table)
      if (table === 'shopping_items') assert.equal(row.added_by, 'suami')
      if (table === 'contacts') assert.equal(row.phone, '+62812123456')
      await actor(bob)
      const result = await q(`update myhome.${table} set updated_at = '2000-01-01', created_by = $1 where id = $2 returning *`, [bob, row.id])
      assert.equal(result.rows.length, 1, table)
      assert.equal(result.rows[0].created_by, alice, table)
      assert.ok(new Date(result.rows[0].updated_at).getFullYear() > 2000)
      await assert.rejects(q(`update myhome.${table} set household_id = $1 where id = $2`, [otherHouse, row.id]), /Bukan anggota|Identitas dan rumah|row-level security/)
      await actor(eve)
      assert.equal((await q(`select * from myhome.${table} where id = $1`, [row.id])).rows.length, 0, table)
      assert.equal((await q(`update myhome.${table} set updated_at = now() where id = $1 returning id`, [row.id])).rows.length, 0, table)
      assert.equal((await q(`delete from myhome.${table} where id = $1 returning id`, [row.id])).rows.length, 0, table)
      await assert.rejects(q(`insert into myhome.${table} (${keys.join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(data)), /Bukan anggota|row-level security/)
      await actor(bob)
      assert.equal((await q(`delete from myhome.${table} where id = $1 returning id`, [row.id])).rows.length, 1, table)
    }
  })

  await t.test('chore completion uses session author and server time, preserves history on undo', async () => {
    await actor(alice)
    const chore = await one(`insert into myhome.chores (household_id,title,assignee,frequency)
      values ($1,'Cuci','berdua','harian') returning *`, [house])
    await actor(bob)
    const done = await one(`update myhome.chores set is_done = true, last_done_by = 'suami', last_done_by_user_id = $1
      where id = $2 returning *`, [alice, chore.id])
    assert.equal(done.last_done_by_user_id, bob)
    assert.equal(done.last_done_by, 'istri')
    const undone = await one('update myhome.chores set is_done = false, last_done_at = null where id = $1 returning *', [chore.id])
    assert.deepEqual(undone.last_done_at, done.last_done_at)
    assert.equal(undone.last_done_by_user_id, bob)
    await assert.rejects(q(`insert into myhome.contacts (household_id,name,category,phone) values ($1,'Invalid','servis','abc')`, [house]), /check constraint/)
    await assert.rejects(q(`insert into myhome.events (household_id,title,date,time,assignee) values ($1,'Invalid','2026-10-18','24:00','berdua')`, [house]), /check constraint/)
  })

  await t.test('only owner can rename home, members can set budgets, protected columns stay protected', async () => {
    await actor(bob)
    assert.equal((await q('update myhome.households set name = $1 where id = $2 returning id', ['Denied', house])).rows.length, 0)
    assert.equal((await q('update myhome.household_budgets set daily_budget = 123000 where household_id = $1 returning household_id', [house])).rows.length, 1)
    await assert.rejects(q('update myhome.household_budgets set household_id = $1 where household_id = $2', [otherHouse, house]), /permission denied/)
    await actor(alice)
    assert.equal((await q('update myhome.households set name = $1 where id = $2 returning name', ['Renamed', house])).rows[0].name, 'Renamed')
    await assert.rejects(q('update myhome.households set owner_user_id = $1 where id = $2', [bob, house]), /permission denied/)
  })

  await t.test('optional Realtime SQL adds each allowed table once, never invites', async () => {
    await db.exec('reset role')
    await db.exec('create publication supabase_realtime')
    await db.exec(realtimeSql)
    await db.exec(realtimeSql)
    const result = await one(`select count(*)::int as total from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'myhome'`)
    assert.equal(result.total, 16)
    assert.equal((await one(`select count(*)::int as n from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'household_invites'`)).n, 0)
  })
})
