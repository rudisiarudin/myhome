import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const base = await readFile(new URL('../supabase/myhome.sql', import.meta.url), 'utf8')
const migration = await readFile(new URL('../supabase/debts.sql', import.meta.url), 'utf8')

test('KPR/debts migration, validation, RLS and derived net worth', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$; grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;`)
  await db.exec(base)
  await db.exec('create publication supabase_realtime')
  await db.exec(migration)
  const q = (sql, params = []) => db.query(sql, params)
  const one = async (sql, params = []) => (await q(sql, params)).rows[0]
  const rpc = async (name, params) => (await one(`select to_jsonb(myhome.${name}(${params.map((_, i) => `$${i + 1}`).join(',')})) as data`, params)).data
  const actor = async id => {
    await db.exec('reset role')
    await q("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ''])
    await db.exec(id ? 'set role authenticated' : 'set role anon')
  }
  const rudi = '11111111-1111-4111-8111-111111111111'
  const ayu = '22222222-2222-4222-8222-222222222222'
  const other = '33333333-3333-4333-8333-333333333333'
  await q('insert into auth.users values ($1), ($2), ($3)', [rudi, ayu, other])
  await actor(rudi); await rpc('initialize_profile', ['Rudi'])
  const house = await rpc('create_household', ['Rumah uji', 'suami'])
  const invite = await rpc('create_invite', [house])
  await actor(ayu); await rpc('initialize_profile', ['Ayu']); await rpc('join_household', [invite])
  await actor(other); await rpc('initialize_profile', ['Akun lain'])
  const otherHouse = await rpc('create_household', ['Rumah lain', 'istri'])
  await actor(rudi)
  const add = (overrides = {}) => {
    const data = { household_id: house, title: 'KPR uji', type: 'kpr', lender_or_borrower: 'Bank uji', total_amount: 100000, remaining_amount: 80000, ...overrides }
    const keys = Object.keys(data)
    return one(`insert into myhome.debts (${keys.join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')}) returning *`, Object.values(data))
  }
  let debt

  await t.test('empty household has zero net worth and view obeys RLS', async () => {
    const balance = await one('select * from myhome.net_worth')
    assert.equal(balance.household_id, house)
    for (const key of ['wallet_balance', 'saving_balance', 'receivables', 'liabilities', 'total_assets', 'net_worth']) assert.equal(Number(balance[key]), 0)
  })
  await t.test('records all form fields and stamps creator from session', async () => {
    debt = await add({ monthly_payment: 10000, due_day: 31, tenor_months: 180, remaining_months: 120, notes: 'Bunga fixed', created_by: ayu })
    assert.equal(debt.created_by, rudi)
    assert.equal(debt.due_day, 31)
    assert.equal(debt.remaining_months, 120)
    assert.equal(debt.notes, 'Bunga fixed')
  })
  await t.test('rejects invalid principal, installments, due day, tenor and type', async () => {
    for (const input of [{ title: ' ' }, { total_amount: 0 }, { remaining_amount: -1 }, { remaining_amount: 100001 },
      { monthly_payment: 0 }, { due_day: 0 }, { due_day: 32 }, { tenor_months: 0 },
      { remaining_months: -1 }, { tenor_months: 10, remaining_months: 11 }, { type: 'unknown' }]) {
      await assert.rejects(add(input), /check constraint/)
    }
    await assert.rejects(add({ total_amount: '10.5' }), /invalid input syntax/)
  })
  await t.test('same-household partner can edit while creator and household stay immutable', async () => {
    await actor(ayu)
    assert.equal((await one('select title from myhome.debts where id = $1', [debt.id])).title, debt.title)
    const updated = await one('update myhome.debts set remaining_amount = 75000, created_by = $1 where id = $2 returning *', [ayu, debt.id])
    assert.equal(updated.created_by, rudi)
    assert.equal(updated.remaining_amount, 75000)
    await assert.rejects(q('update myhome.debts set household_id = $1 where id = $2', [otherHouse, debt.id]), /Bukan anggota|tidak dapat dipindahkan|row-level security/)
  })
  await t.test('other households cannot read/edit/delete rows or create cross-tenant records', async () => {
    await actor(other)
    assert.equal((await q('select * from myhome.debts')).rows.length, 0)
    assert.equal((await q('update myhome.debts set remaining_amount = 0 where id = $1 returning id', [debt.id])).rows.length, 0)
    assert.equal((await q('delete from myhome.debts where id = $1 returning id', [debt.id])).rows.length, 0)
    await assert.rejects(add(), /Bukan anggota|row-level security/)
    assert.deepEqual((await q('select household_id from myhome.net_worth')).rows, [{ household_id: otherHouse }])
    await actor(rudi)
    assert.equal((await one('select remaining_amount from myhome.debts where id = $1', [debt.id])).remaining_amount, 75000)
  })
  await t.test('net worth includes funded savings and receivables without join multiplication', async () => {
    const wallet = await rpc('save_wallet', [house, { name: 'Tunai', kind: 'cash', owner: 'berdua', opening_balance: 50000 }])
    await rpc('save_wallet', [house, { name: 'Bank', kind: 'bank', owner: 'berdua', opening_balance: 10000 }])
    const goal = await rpc('save_goal', [house, { title: 'Impian', opening_amount: 10000, target_amount: 100000, target_date: '2027-01-01' }])
    await rpc('save_transaction', [house, { wallet_id: wallet.id, goal_id: goal.id, kind: 'saving', title: 'Setoran', amount: 5000, category: 'tabungan' }])
    await add({ title: 'Piutang uji', type: 'piutang', total_amount: 30000, remaining_amount: 20000 })
    await add({ title: 'Kredit uji', type: 'kendaraan', total_amount: 20000, remaining_amount: 10000 })
    const balance = await one('select * from myhome.net_worth')
    assert.equal(Number(balance.wallet_balance), 55000)
    assert.equal(Number(balance.saving_balance), 15000)
    assert.equal(Number(balance.receivables), 20000)
    assert.equal(Number(balance.liabilities), 85000)
    assert.equal(Number(balance.total_assets), 90000)
    assert.equal(Number(balance.net_worth), 5000)
    await q('update myhome.debts set remaining_amount = 100000 where id = $1', [debt.id])
    assert.equal(Number((await one('select net_worth from myhome.net_worth')).net_worth), -20000)
  })
  await t.test('unauthenticated callers have no table or view access', async () => {
    await actor(null)
    await assert.rejects(q('select * from myhome.debts'), /permission denied/)
    await assert.rejects(q('select * from myhome.net_worth'), /permission denied/)
  })
  await t.test('migration can be rerun without losing rows or duplicating Realtime membership', async () => {
    await db.exec('reset role')
    await db.exec(migration)
    assert.equal((await one('select count(*)::int as n from myhome.debts')).n, 3)
    assert.equal((await one("select count(*)::int as n from pg_publication_tables where pubname='supabase_realtime' and schemaname='myhome' and tablename='debts'")).n, 1)
    await actor(ayu)
    assert.equal((await q('delete from myhome.debts where id = $1 returning id', [debt.id])).rows.length, 1)
  })
  await t.test('migration refuses to overwrite objects created by another source', async () => {
    await db.exec('reset role')
    await db.exec("comment on table myhome.debts is 'another source'")
    await assert.rejects(db.exec(migration), /sudah ada dari sumber lain/)
    await db.exec('rollback')
    assert.equal((await one('select count(*)::int as n from myhome.debts')).n, 2)
  })
})
