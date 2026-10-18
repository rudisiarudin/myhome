import { chromium } from 'playwright'
import { PGlite } from '@electric-sql/pglite'
import { createServer } from 'vite'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

// Auth/PostgREST are local test adapters. Every record operation runs the real
// installation SQL with RLS on PGlite, never against the user's Supabase project.
const output = new URL('../.impeccable/review/', import.meta.url)
await mkdir(output, { recursive: true })
const pg = new PGlite()
await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$; grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`)
await pg.exec(await readFile(new URL('../supabase/myhome.sql', import.meta.url), 'utf8'))
const users = new Map()
const passwords = new Map()
const fixtures = [
  ['alice@example.test', '11111111-1111-4111-8111-111111111111', 'Alice'],
  ['bob@example.test', '22222222-2222-4222-8222-222222222222', 'Bob'],
]
for (const [email, id, name] of fixtures) {
  const user = { id, email, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: { full_name: name }, identities: [], created_at: new Date().toISOString() }
  users.set(email, user); passwords.set(email, 'fixture-password')
  await pg.query('insert into auth.users values ($1)', [id])
}
const tokenFor = user => `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.fixture`
const sessionFor = user => ({ access_token: tokenFor(user), token_type: 'bearer', refresh_token: `refresh-${user.id}`, expires_in: 3600, user })
const fixtureUrl = 'http://127.0.0.1:3033/test-supabase'
const server = await createServer({
  server: { host: '127.0.0.1', port: 3033, strictPort: true },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(fixtureUrl),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_fixture'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(''),
  },
})
await server.listen()
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', colorScheme: 'light' })
const page = await context.newPage()
const checks = [], errors = [], captures = [], measurements = []
let queue = Promise.resolve(), failRead = false, failWrite = false, failAfterWrite = false, delayedWrite = false, delayedRead = false
page.on('pageerror', error => errors.push(error.message))
const check = (label, condition) => { assert.ok(condition, label); checks.push(label) }
const ident = value => { assert.match(value, /^[a-z_]+$/); return `"${value}"` }
const asJsonRows = async (sql, params) => (await pg.query(`select coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb) as data from (${sql}) result`, params)).rows[0].data
await context.routeWebSocket('**/test-supabase/realtime/**', socket => {
  socket.onMessage(data => {
    const message = JSON.parse(String(data))
    if (message.event === 'phx_join' || message.event === 'heartbeat') socket.send(JSON.stringify({ topic: message.topic, event: 'phx_reply', payload: { status: 'ok', response: {} }, ref: message.ref }))
  })
})
await context.route('**/test-supabase/**', route => {
  const work = async () => {
    const request = route.request(), url = new URL(request.url()), method = request.method()
    const body = request.postDataJSON()
    const send = (data, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers })
    if (url.pathname.includes('/auth/v1/')) {
      if (url.pathname.endsWith('/token')) {
        const user = users.get(body.email)
        if (!user || passwords.get(body.email) !== body.password) return send({ error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' }, 400)
        return send(sessionFor(user))
      }
      if (url.pathname.endsWith('/logout')) return send({})
      if (url.pathname.endsWith('/recover')) return send({})
      if (url.pathname.endsWith('/signup')) return send({ user: users.get('alice@example.test'), session: null })
      if (url.pathname.endsWith('/user')) {
        const jwt = request.headers().authorization?.replace('Bearer ', '')
        const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url'))
        return send([...users.values()].find(user => user.id === payload.sub))
      }
      return send({ message: 'Unknown test Auth route' }, 500)
    }
    if (!url.pathname.includes('/rest/v1/')) return send({})
    if (delayedRead && method === 'GET') { delayedRead = false; await new Promise(resolve => setTimeout(resolve, 350)) }
    const identityRead = /\/(profiles|households|household_members)$/.test(url.pathname)
    if (failRead && method === 'GET' && !identityRead) return send({ code: 'PGRST000', message: 'fixture read failure' }, 503)
    if (failWrite && method !== 'GET') return send({ code: 'P0001', message: 'fixture write rejected' }, 400)
    if (delayedWrite && method !== 'GET') await new Promise(resolve => setTimeout(resolve, 350))
    try {
      const jwt = request.headers().authorization?.replace('Bearer ', '')
      const uid = jwt && !jwt.startsWith('sb_') ? JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url')).sub : ''
      await pg.exec('reset role')
      await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [uid])
      await pg.exec(uid ? 'set role authenticated' : 'set role anon')
      const resource = url.pathname.split('/rest/v1/')[1]
      if (resource.startsWith('rpc/')) {
        const name = resource.slice(4), keys = Object.keys(body ?? {})
        const result = await pg.query(`select to_jsonb(myhome.${ident(name)}(${keys.map((key, i) => `${ident(key)} => $${i + 1}`).join(',')})) as data`, Object.values(body ?? {}))
        const data = result.rows[0].data
        if (failAfterWrite) { failRead = true; failAfterWrite = false }
        return send(data && typeof data === 'object' ? [data] : data)
      }
      const table = ident(resource), params = [], filters = []
      for (const [key, value] of url.searchParams) {
        if (['select', 'order', 'limit', 'offset'].includes(key)) continue
        assert.ok(value.startsWith('eq.'))
        params.push(value.slice(3)); filters.push(`${ident(key)} = $${params.length}`)
      }
      const where = filters.length ? ` where ${filters.join(' and ')}` : ''
      let rows
      if (method === 'GET') {
        const order = url.searchParams.get('order')?.split(',').map(entry => { const [col, dir] = entry.split('.'); return `${ident(col)} ${dir === 'desc' ? 'desc' : 'asc'}` }).join(',')
        const limit = Math.min(Number(url.searchParams.get('limit') ?? 1000), 1000)
        const offset = Number(url.searchParams.get('offset') ?? 0)
        rows = await asJsonRows(`select * from myhome.${table}${where}${order ? ` order by ${order}` : ''} limit ${limit} offset ${offset}`, params)
      } else {
        const data = Array.isArray(body) ? body[0] : body
        let query
        if (method === 'POST') {
          const keys = Object.keys(data)
          params.length = 0; params.push(...Object.values(data))
          query = `insert into myhome.${table} (${keys.map(ident).join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')}) returning *`
        } else if (method === 'PATCH') {
          const updates = Object.entries(data).map(([key, value]) => { params.push(value); return `${ident(key)} = $${params.length}` })
          query = `update myhome.${table} set ${updates.join(',')}${where} returning *`
        } else query = `delete from myhome.${table}${where} returning *`
        rows = (await pg.query(`with changed as (${query}) select coalesce(jsonb_agg(to_jsonb(changed)), '[]'::jsonb) as data from changed`, params)).rows[0].data
      }
      if (request.headers().accept?.includes('vnd.pgrst.object')) {
        if (rows.length !== 1) return send({ code: 'PGRST116', details: `${rows.length} rows`, message: 'JSON object requested, multiple (or no) rows returned' }, 406)
        return send(rows[0])
      }
      return send(rows)
    } catch (error) {
      return send({ code: error.code ?? 'P0001', message: error.message, details: null, hint: null }, error.code === '42501' ? 403 : 400)
    }
  }
  const result = queue.then(work)
  queue = result.catch(() => {})
  return result
})

const nav = name => page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
const account = () => page.locator('.account-trigger').click()
const settle = () => page.waitForFunction(() => !document.querySelector('[aria-busy="true"]') && !document.body.innerText.includes('Menyimpan…'))
const dialog = () => page.getByRole('dialog').filter({ has: page.locator('form') })
const save = async name => { await page.locator('dialog[open]').getByRole('button', { name, exact: true }).click(); await page.locator('dialog[open]').waitFor({ state: 'hidden' }) }
const login = async email => {
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Kata sandi', { exact: true }).fill('fixture-password')
  await page.getByRole('button', { name: 'Masuk ke rumah', exact: true }).click()
}
const sqlRow = async sql => {
  await queue; await pg.exec('reset role')
  return (await pg.query(sql)).rows[0]
}
const captureSurface = async label => {
  for (const theme of ['light', 'dark']) {
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: theme === 'dark' ? 'Gunakan mode gelap' : 'Gunakan mode terang' }).click()
    await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme)
    for (const [size, width, height] of [['mobile', 390, 844], ['desktop', 1440, 1000]]) {
      await page.setViewportSize({ width, height })
      if (label === 'profile') {
        if (!await page.locator('.account-panel').count()) await account()
        if (!await page.locator('.profile-settings details').evaluate(details => details.open)) await page.getByText('Ubah profil', { exact: true }).click()
      }
      await page.evaluate(() => document.fonts.ready)
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const file = `${label}-${theme}-${size}.png`
      await page.screenshot({ path: fileURLToPath(new URL(file, output)), fullPage: true }); captures.push(file)
      check(`${label}/${theme}/${size}: layout stays in viewport`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
  if (await page.locator('html').getAttribute('data-theme') !== 'light') await page.getByRole('button', { name: 'Gunakan mode terang' }).click()
}

try {
  await page.goto('http://127.0.0.1:3033', { waitUntil: 'networkidle' })
  check('signed-out screen presents login, not sample household', await page.getByRole('heading', { name: 'Selamat pulang.' }).isVisible() && !await page.getByRole('navigation').count())
  await page.getByRole('button', { name: 'Daftar akun', exact: true }).click()
  await page.getByLabel('Nama panggilan').fill('Akun contoh uji')
  await page.getByLabel('Email', { exact: true }).fill('signup@example.test')
  await page.getByLabel('Kata sandi', { exact: true }).fill('fixture-password')
  await page.getByRole('button', { name: 'Buat akun', exact: true }).click()
  await page.getByText(/Periksa email untuk mengonfirmasi/).waitFor()
  check('signup without session explains email confirmation', true)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.getByRole('button', { name: 'Lupa kata sandi?', exact: true }).click()
  await page.getByRole('button', { name: 'Kirim tautan pemulihan', exact: true }).click()
  await page.getByText(/Jika email terdaftar/).waitFor()
  check('password reset returns neutral email status', true)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill('alice@example.test')
  await page.getByLabel('Kata sandi', { exact: true }).fill('wrong')
  await page.getByRole('button', { name: 'Masuk ke rumah', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'Email atau kata sandi tidak cocok.' }).waitFor()
  check('invalid login remains on login and shows actionable error', true)
  await login('alice@example.test')
  await page.getByRole('heading', { name: 'Rumah kita, mulai di sini.' }).waitFor()
  check('authenticated user without household sees onboarding', true)
  await page.getByLabel('Nama rumah', { exact: true }).fill('Rumah Uji')
  await captureSurface('onboarding')
  await page.getByRole('button', { name: 'Buat rumah kita', exact: true }).click()
  await page.getByRole('navigation').waitFor()
  check('household creation opens empty connected workspace', await page.getByText('Rumah Uji', { exact: true }).isVisible() && !await page.getByText('Data contoh', { exact: false }).count())
  check('new household has no wallets or transactions seeded', (await sqlRow('select count(*)::int as n from myhome.wallets')).n === 0 && (await sqlRow('select count(*)::int as n from myhome.transactions')).n === 0)

  await account()
  await page.getByRole('button', { name: 'Undang pasangan', exact: true }).click()
  await page.locator('.invite-code').waitFor()
  const invite = await page.locator('.invite-code').innerText()
  check('owner can issue a private single-use invite', /^[a-f0-9]{32}$/.test(invite))
  await page.getByText('Ubah profil', { exact: true }).click()
  await page.getByLabel('Nama panggilan').fill('Alice Rumah')
  await page.getByRole('button', { name: 'Simpan profil', exact: true }).click()
  await page.getByText('Hai, Alice!', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Tutup profil', exact: true }).click()
  check('profile update changes greeting and account avatar', await page.getByRole('button', { name: 'Buka profil Alice Rumah', exact: true }).isVisible())
  check('greeting abbreviates the name without changing full profile identity', await page.locator('.greeting-signature').innerText().then(text => text.trim() === 'Alice'))
  await account()
  await page.getByText('Ubah profil', { exact: true }).click()
  await captureSurface('profile')
  if (await page.locator('.account-panel').count()) await page.getByRole('button', { name: 'Tutup profil', exact: true }).click()

  await nav('Keuangan')
  await page.getByRole('button', { name: 'Tambah dompet', exact: true }).click()
  await page.getByLabel('Nama dompet').fill('Tunai uji')
  await page.getByLabel('Saldo awal', { exact: true }).fill('100000')
  await save('Simpan dompet')
  check('wallet RPC persists opening balance', Number((await sqlRow('select opening_balance from myhome.wallets')).opening_balance) === 100000)
  await page.getByRole('button', { name: 'Pengeluaran', exact: true }).click()
  await page.getByLabel('Berapa yang keluar?').fill('10000')
  await page.getByLabel('Untuk apa?', { exact: true }).fill('Belanja uji')
  check('mobile amount entry uses compact 32px type', await page.getByLabel('Berapa yang keluar?').evaluate(input => getComputedStyle(input).fontSize) === '32px')
  delayedWrite = true
  await page.getByRole('button', { name: 'Simpan pengeluaran', exact: true }).click()
  await page.getByRole('button', { name: 'Menyimpan…', exact: true }).waitFor()
  check('save exposes pending state and disables repeated submission', await page.getByRole('button', { name: 'Menyimpan…', exact: true }).isDisabled())
  await page.locator('dialog[open]').waitFor({ state: 'hidden' }); delayedWrite = false
  check('expense RPC sets author from Auth session', (await sqlRow('select recorded_by_user_id from myhome.transactions')).recorded_by_user_id === fixtures[0][1])
  await page.reload({ waitUntil: 'networkidle' }); await page.getByRole('navigation').waitFor()
  await page.getByRole('heading', { name: 'Belanja uji', exact: true }).waitFor()
  check('browser reload restores session and saved household transaction', true)

  await nav('Keuangan')
  await page.getByRole('button', { name: 'Pemasukan', exact: true }).click()
  await page.getByLabel('Berapa yang masuk?').fill('20000')
  await page.getByLabel('Sumber pemasukan').fill('Gaji uji')
  await save('Simpan pemasukan')
  await page.getByRole('button', { name: 'Tambah dompet', exact: true }).click()
  await page.getByLabel('Nama dompet').fill('Bank uji')
  await page.getByLabel('Jenis dompet').selectOption('bank')
  await save('Simpan dompet')
  await page.getByRole('button', { name: 'Transfer', exact: true }).click()
  await page.getByLabel('Berapa yang dipindahkan?').fill('1000')
  const wallets = await sqlRow("select jsonb_object_agg(name,id) as ids from myhome.wallets")
  await page.getByLabel('Dari dompet', { exact: true }).selectOption(wallets.ids['Tunai uji'])
  await page.getByLabel('Ke dompet', { exact: true }).selectOption(wallets.ids['Bank uji'])
  await save('Catat transfer')
  check('income and transfer adapters preserve derived wallet balances', Number((await sqlRow("select balance from myhome.wallet_balances where name = 'Bank uji'")).balance) === 1000)
  await page.getByRole('button', { name: 'Tambah impian', exact: true }).click()
  await page.getByLabel('Nama impian').fill('Liburan uji')
  await page.getByLabel('Target tabungan').fill('500000')
  await page.getByLabel('Target tanggal').fill('2027-01-01')
  await save('Simpan impian')
  await page.getByRole('button', { name: 'Catat setoran', exact: true }).click()
  await page.getByLabel('Mau menabung berapa?').fill('1000')
  await page.getByLabel('Dari dompet', { exact: true }).selectOption(wallets.ids['Tunai uji'])
  await save('Simpan setoran')
  check('savings contribution uses RPC and updates goal balance', Number((await sqlRow('select current_amount from myhome.goal_balances')).current_amount) === 1000)
  await page.getByRole('button', { name: 'Atur anggaran', exact: true }).click()
  await page.getByLabel('Belanja rumah per hari').fill('300000')
  await save('Simpan anggaran')
  check('budget form uses protected budget update', (await sqlRow('select daily_budget from myhome.household_budgets')).daily_budget === 300000)

  await nav('Rumah')
  const billForm = page.getByRole('form', { name: 'Form tambah tagihan' })
  await billForm.getByLabel('Nama tagihan').fill('Internet uji')
  await billForm.getByLabel('Nominal tagihan').fill('5000')
  await billForm.getByRole('button', { name: 'Simpan tagihan', exact: true }).click()
  const billCard = page.locator('.bill-card').filter({ hasText: 'Internet uji' })
  await billCard.waitFor()
  await billCard.getByRole('button', { name: 'Catat lunas', exact: true }).click()
  await page.getByLabel('Dibayar dari dompet', { exact: true }).selectOption(wallets.ids['Tunai uji'])
  await save('Tandai lunas & catat')
  check('bill payment creates linked ledger expense', (await sqlRow('select count(*)::int as n from myhome.transactions where bill_id is not null')).n === 1)
  await billCard.getByRole('button', { name: 'Batalkan lunas', exact: true }).click()
  await save('Ya, lanjutkan')
  check('unpay removes linked payment and returns status to unpaid', (await sqlRow('select is_paid from myhome.bill_status')).is_paid === false)

  await page.getByRole('button', { name: 'Dokumen', exact: true }).click()
  await page.getByLabel('Nama dokumen').fill('Garansi uji')
  await page.getByLabel('Berlaku sampai').fill('2027-12-31')
  await page.getByRole('button', { name: 'Simpan dokumen', exact: true }).click()
  await page.getByRole('heading', { name: 'Garansi uji', exact: true }).waitFor()
  check('document form persists expiry metadata', (await sqlRow('select title from myhome.documents')).title === 'Garansi uji')
  await page.getByRole('button', { name: 'Ubah Garansi uji', exact: true }).click()
  await dialog().getByLabel('Nama dokumen').fill('Garansi diubah')
  await save('Simpan dokumen')
  check('document editing awaits database success and closes dialog', (await sqlRow('select title from myhome.documents')).title === 'Garansi diubah')
  await page.getByRole('button', { name: 'Kontak', exact: true }).click()
  await page.getByLabel('Nama kontak').fill('Teknisi uji')
  await page.getByLabel('Nomor telepon').fill('+62 (812) 123456')
  await page.getByRole('button', { name: 'Simpan kontak', exact: true }).click()
  await page.getByRole('heading', { name: 'Teknisi uji', exact: true }).waitFor()
  check('contact phone normalization is enforced on database', (await sqlRow('select phone from myhome.contacts')).phone === '+62812123456')
  await page.getByRole('button', { name: 'Hapus Teknisi uji', exact: true }).click()
  await save('Ya, lanjutkan')
  check('confirmed contact deletion persists and keeps inline form available', (await sqlRow('select count(*)::int as n from myhome.contacts')).n === 0 && await page.getByLabel('Nama kontak').isVisible())
  await page.getByRole('button', { name: 'Tugas Rumah', exact: true }).click()
  await page.getByLabel('Nama tugas').fill('Sapu uji')
  await page.getByRole('button', { name: 'Simpan tugas', exact: true }).click()
  await page.getByRole('heading', { name: 'Sapu uji', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Tandai selesai', exact: true }).click()
  await page.getByRole('button', { name: 'Tandai belum selesai', exact: true }).waitFor()
  check('chore completion records active account in database', (await sqlRow('select last_done_by_user_id from myhome.chores')).last_done_by_user_id === fixtures[0][1])

  await nav('Kalender')
  await page.getByLabel('Nama agenda').fill('Agenda uji')
  await page.getByRole('button', { name: 'Simpan agenda', exact: true }).click()
  await page.getByRole('heading', { name: 'Agenda uji', exact: true }).waitFor()
  await page.getByLabel('Tandai selesai', { exact: true }).click()
  await page.getByLabel('Sudah selesai', { exact: true }).waitFor()
  check('calendar create and completion persist', (await sqlRow('select is_done from myhome.events')).is_done === true)

  await nav('Berdua')
  check('live randomizer starts empty, not demo menu', await page.getByRole('button', { name: 'Acak menu makan hari ini' }).isDisabled())
  await page.getByLabel('Pilihan menu baru', { exact: true }).fill('Sup uji')
  await page.getByRole('button', { name: 'Tambah pilihan menu', exact: true }).click()
  await page.getByRole('button', { name: 'Acak menu makan hari ini' }).waitFor({ state: 'visible' }); await settle()
  await page.getByRole('button', { name: 'Acak menu makan hari ini' }).click()
  await page.locator('.decision-result h3').filter({ hasText: 'Sup uji' }).waitFor()
  check('food idea saved to household feeds randomizer', (await sqlRow('select title from myhome.food_ideas')).title === 'Sup uji')
  await page.getByLabel('Ide kencan baru', { exact: true }).fill('Jalan sore uji')
  await page.getByRole('button', { name: 'Tambah ide kencan', exact: true }).click(); await settle()
  await page.getByRole('button', { name: 'Acak ide kencan berdua' }).click()
  await page.locator('.decision-result h3').filter({ hasText: 'Jalan sore uji' }).waitFor()
  check('date ideas are household records, not demo choices', (await sqlRow('select title from myhome.date_ideas')).title === 'Jalan sore uji')
  await page.getByRole('group', { name: 'Bagian ruang berdua' }).getByRole('button', { name: 'Wishlist Kencan', exact: true }).click()
  await page.getByLabel('Nama Tempat / Ide Kencan', { exact: true }).fill('Taman uji')
  await page.getByLabel('Estimasi Budget (Opsional)').fill('25000')
  await page.getByRole('button', { name: 'Simpan ke Wishlist', exact: true }).click()
  await page.getByRole('heading', { name: 'Taman uji', exact: true }).waitFor()
  check('wishlist places persist optional budget', (await sqlRow('select est_budget from myhome.wishlist_places')).est_budget === 25000)
  await page.getByRole('group', { name: 'Bagian ruang berdua' }).getByRole('button', { name: /Belanja/ }).click()
  await page.getByLabel('Nama barang belanja').fill('Sayur uji')
  await page.getByRole('button', { name: 'Tambah barang belanja' }).click()
  await page.locator('.shopping-copy').filter({ hasText: 'Sayur uji' }).waitFor()
  check('shopping list uses shared database rather than App local state', (await sqlRow('select title from myhome.shopping_items')).title === 'Sayur uji')
  await page.locator('.shopping-row input').click()
  await page.locator('.shopping-row.is-bought').waitFor()
  check('shopping completion persists instead of optimistic local-only toggle', (await sqlRow('select is_bought from myhome.shopping_items')).is_bought === true)

  // Inject a rejected write and ensure the draft remains open.
  await nav('Keuangan')
  await page.getByRole('button', { name: 'Pengeluaran', exact: true }).click()
  await page.getByLabel('Berapa yang keluar?').fill('1000')
  await page.getByLabel('Untuk apa?', { exact: true }).fill('Draft gagal')
  await page.getByLabel('Dari dompet', { exact: true }).selectOption(wallets.ids['Tunai uji'])
  failWrite = true
  await page.getByRole('button', { name: 'Simpan pengeluaran', exact: true }).click()
  await dialog().getByRole('alert').waitFor()
  check('rejected write preserves open form and draft', await page.getByLabel('Untuk apa?', { exact: true }).inputValue() === 'Draft gagal')
  failWrite = false; failAfterWrite = true
  await page.getByRole('button', { name: 'Simpan pengeluaran', exact: true }).click()
  await page.locator('dialog[open]').waitFor({ state: 'hidden' })
  await page.getByRole('alert').filter({ hasText: 'Perubahan sudah tersimpan' }).waitFor()
  check('successful write with failed refetch does not offer duplicate resubmission', (await sqlRow("select count(*)::int as n from myhome.transactions where title = 'Draft gagal'")).n === 1)
  failRead = false
  delayedRead = true
  await page.getByRole('button', { name: 'Muat ulang data', exact: true }).click()
  await page.locator('.sync-refresh[aria-busy="true"]').waitFor()
  check('icon refresh exposes loading state and prevents duplicate refresh', await page.getByRole('button', { name: 'Muat ulang data', exact: true }).isDisabled())
  await page.getByRole('alert').filter({ hasText: 'Perubahan sudah tersimpan' }).waitFor({ state: 'hidden' })

  await account(); await page.getByRole('button', { name: 'Keluar akun', exact: true }).click()
  await page.getByRole('heading', { name: 'Selamat pulang.' }).waitFor()
  check('signout removes household UI immediately', !await page.getByRole('navigation').count())
  await login('bob@example.test')
  await page.getByRole('button', { name: 'Gabung rumah', exact: true }).click()
  await page.getByLabel(/Kode undangan/).fill(invite)
  await page.getByRole('button', { name: 'Gabung rumah pasangan', exact: true }).click()
  await page.getByRole('navigation').waitFor()
  await page.getByText('Hai, Bob!', { exact: true }).waitFor()
  check('couple signature uses short names in a stable order after partner login', await page.locator('.greeting-signature').innerText().then(text => text.trim() === 'Bob & Alice'))
  check('partner joins same real household and receives existing records', (await sqlRow('select count(*)::int as n from myhome.household_members')).n === 2)
  await account()
  check('partner cannot switch identities or issue owner invite', !await page.getByRole('button', { name: 'Undang pasangan', exact: true }).count() && !await page.getByRole('group', { name: 'Pilih akun contoh' }).count())
  await page.keyboard.press('Escape')
  await nav('Keuangan')
  await page.getByRole('button', { name: 'Riwayat', exact: true }).click()
  await page.getByRole('button', { name: 'Ubah Belanja uji', exact: true }).click()
  await page.getByLabel('Berapa yang keluar?').fill('12000')
  await save('Simpan perubahan')
  check('partner can edit shared transaction without taking original authorship', (await sqlRow("select recorded_by_user_id from myhome.transactions where title = 'Belanja uji'")).recorded_by_user_id === fixtures[0][1])

  // One batched visual inspection across device classes and both themes.
  for (const theme of ['light', 'dark']) {
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: theme === 'dark' ? 'Gunakan mode gelap' : 'Gunakan mode terang' }).click()
    for (const [label, width, height] of [['small', 320, 740], ['mobile', 390, 844], ['desktop', 1440, 1000]]) {
      await page.setViewportSize({ width, height }); await nav('Hari ini')
      await page.evaluate(() => document.fonts.ready)
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const file = `connected-${theme}-${label}.png`
      await page.screenshot({ path: fileURLToPath(new URL(file, output)), fullPage: true }); captures.push(file)
      check(`${theme}/${label}: connected layout has no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      check(`${theme}/${label}: greeting uses compact responsive type`, await page.locator('.greeting-copy h1').evaluate(heading => parseFloat(getComputedStyle(heading).fontSize)) === (width < 360 ? 20 : width < 760 ? 22 : 24))
      check(`${theme}/${label}: daily allowance does not enlarge on narrow screens`, await page.locator('.allowance-number').evaluate(amount => parseFloat(getComputedStyle(amount).fontSize)) === (width < 360 ? 20 : width < 760 ? 21 : 22))
      const chrome = await page.evaluate(() => {
        const header = document.querySelector('.app-header'), nav = document.querySelector('.bottom-nav')
        const content = document.querySelector('.workspace-household-name')
        const filter = element => getComputedStyle(element).backdropFilter || getComputedStyle(element).webkitBackdropFilter
        const rgb = value => value.match(/[\d.]+/g).map(Number)
        const lum = values => values.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
        const dark = document.documentElement.dataset.theme === 'dark'
        const contrast = (element, surface) => {
          const color = rgb(getComputedStyle(element).color), bg = rgb(getComputedStyle(surface).backgroundColor)
          const alpha = bg[3] ?? 1
          const worstBackground = bg.slice(0, 3).map(channel => channel * alpha + (dark ? 255 : 0) * (1 - alpha))
          const a = lum(color), b = lum(worstBackground)
          return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
        }
        return { headerFixed: getComputedStyle(header).position === 'fixed', top: header.getBoundingClientRect().top,
          headerBottom: header.getBoundingClientRect().bottom, contentTop: content.getBoundingClientRect().top,
          headerFilter: filter(header), navFilter: filter(nav), headerBackground: getComputedStyle(header).backgroundColor,
          navBackground: getComputedStyle(nav).backgroundColor, refreshText: document.querySelector('.sync-refresh').innerText.trim(),
          minContrast: Math.min(contrast(header.querySelector('.wordmark'), header), ...[...nav.querySelectorAll('.nav-button')].map(button => contrast(button, nav))) }
      })
      measurements.push({ scope: 'glass-navigation', theme, viewport: width, ...chrome })
      check(`${theme}/${label}: fixed header reserves content space`, chrome.headerFixed && chrome.top === 0 && chrome.contentTop >= chrome.headerBottom)
      check(`${theme}/${label}: both navigation surfaces use translucent blur`, chrome.headerFilter.includes('blur(22px)') && chrome.navFilter.includes('blur(22px)') && chrome.headerBackground.includes('0.86') && chrome.navBackground.includes('0.86'))
      check(`${theme}/${label}: glass navigation text meets AA even over contrasting content`, chrome.minContrast >= 4.5)
      check(`${theme}/${label}: sync controls are icon-only without Supabase status label`, chrome.refreshText === '' && !await page.getByText('Tersimpan di Supabase', { exact: true }).count() && !await page.getByRole('button', { name: 'Muat ulang', exact: true }).count())
      await page.evaluate(() => window.scrollTo(0, 400))
      check(`${theme}/${label}: header stays at viewport top while scrolling`, await page.locator('.app-header').evaluate(header => header.getBoundingClientRect().top === 0))
      if (label === 'mobile') {
        const scrollFile = `glass-${theme}-mobile-scroll.png`
        await page.screenshot({ path: fileURLToPath(new URL(scrollFile, output)), fullPage: false }); captures.push(scrollFile)
      }
      await page.evaluate(() => window.scrollTo(0, 0))
    }
  }
  await account(); await page.getByRole('button', { name: 'Keluar akun', exact: true }).click()
  await page.getByRole('heading', { name: 'Selamat pulang.' }).waitFor()
  for (const theme of ['light', 'dark']) {
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: theme === 'dark' ? 'Gunakan mode gelap' : 'Gunakan mode terang' }).click()
    for (const [label, width, height] of [['small', 320, 740], ['mobile', 390, 844], ['desktop', 1440, 1000]]) {
      await page.setViewportSize({ width, height }); await page.evaluate(() => document.fonts.ready)
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      measurements.push(await page.locator('.access-shell').evaluate(shell => ({ viewport: innerWidth, height: innerHeight, theme: document.documentElement.dataset.theme, foreground: getComputedStyle(shell).color, background: getComputedStyle(shell).backgroundColor, font: getComputedStyle(shell).fontFamily })))
      check(`${theme}/${label}: access heading is reduced to 22–24px`, await page.locator('.access-content h1').evaluate(heading => parseFloat(getComputedStyle(heading).fontSize)) === (width < 360 ? 22 : 24))
      if (width < 760) check(`${theme}/${label}: form input stays 16px to avoid mobile focus zoom`, await page.getByLabel('Email', { exact: true }).evaluate(input => getComputedStyle(input).fontSize) === '16px')
      const contrastIssues = await page.locator('.access-shell').evaluate(shell => {
        const rgb = value => value.match(/[\d.]+/g).map(Number)
        const lum = values => values.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
        const issues = []
        for (const element of shell.querySelectorAll('*')) {
          if (!element.checkVisibility() || element.closest('svg') || ![...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim())) continue
          const style = getComputedStyle(element)
          let node = element, background = [255, 255, 255]
          while (node) { const color = rgb(getComputedStyle(node).backgroundColor); if (color.length < 4 || color[3] > .95) { background = color; break } node = node.parentElement }
          const a = lum(rgb(style.color)), b = lum(background), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
          const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700)
          if (ratio < (large ? 3 : 4.5)) issues.push({ text: element.textContent.trim().slice(0, 40), ratio: +ratio.toFixed(2) })
        }
        return issues
      })
      check(`${theme}/${label}: login text meets AA contrast`, contrastIssues.length === 0)
      const file = `login-${theme}-${label}.png`
      await page.screenshot({ path: fileURLToPath(new URL(file, output)), fullPage: true }); captures.push(file)
      check(`${theme}/${label}: login form has no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    }
  }
  check('no uncaught browser errors', errors.length === 0)
  await writeFile(new URL('connected-results.json', output), JSON.stringify({ passed: checks.length, checks, errors, captures, measurements, scope: 'Local mocked Auth/PostgREST + actual PostgreSQL SQL/RLS; not managed Supabase integration' }, null, 2))
  console.log(JSON.stringify({ passed: checks.length, errors, captures: captures.length }, null, 2))
} catch (error) {
  await page.screenshot({ path: fileURLToPath(new URL('connected-failure.png', output)), fullPage: true })
  throw error
} finally {
  await browser.close(); await server.close(); await pg.close()
}
