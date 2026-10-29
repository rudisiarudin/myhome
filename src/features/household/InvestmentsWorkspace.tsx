import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Activity, Plus, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import { useHousehold } from './context'
import { formatQuantity, makeId, money } from './model'
import type { InvestmentHolding } from './model'
import { Empty, Field, FormEnd, Modal, MoneyInput, RowActions, Section } from './ui'
import { supabase } from '../../lib/supabase'

// Pemetaan kode crypto populer ke id CoinGecko. Kode di luar daftar ini
// dipakai apa adanya sebagai id CoinGecko (huruf kecil), jadi koin lain
// tetap bisa dipantau dengan mengisi id-nya langsung.
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', USDT: 'tether', BNB: 'binancecoin',
  SOL: 'solana', XRP: 'ripple', USDC: 'usd-coin', ADA: 'cardano',
  DOGE: 'dogecoin', TRX: 'tron', DOT: 'polkadot', LTC: 'litecoin',
  BCH: 'bitcoin-cash', LINK: 'chainlink', UNI: 'uniswap', ATOM: 'cosmos',
  XLM: 'stellar', NEAR: 'near', APT: 'aptos', ARB: 'arbitrum',
  OP: 'optimism', INJ: 'injective-protocol', SUI: 'sui', PEPE: 'pepe',
  SHIB: 'shiba-inu', AVAX: 'avalanche-2', MATIC: 'matic-network', POL: 'polygon-ecosystem-token',
  // Wajib eksplisit: id CoinGecko 'allo' adalah token LAIN (harga jauh
  // berbeda); Allora yang benar id-nya 'allora'.
  ALLO: 'allora',
}

interface Quote { price: number; changePct: number }

const quoteKey = (holding: InvestmentHolding) => `${holding.kind}:${holding.symbol}`

// Harga satuan: saham selalu rupiah utuh; koin berharga sangat kecil
// (mis. PEPE < Rp1) butuh desimal agar tidak tampil Rp0.
function formatPrice(value: number): string {
  if (value >= 100) return money(Math.round(value))
  return `Rp${value.toLocaleString('id-ID', { maximumFractionDigits: value < 1 ? 6 : 2 })}`
}

function formatPct(value: number): string {
  const formatted = Math.abs(value).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatted}%`
}

const chipBase: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '5px', border: '1px solid var(--workspace-border)', borderRadius: '999px', padding: '4px 10px', fontSize: '11px', fontWeight: 600 }

// Rentang grafik per jenis aset. Untuk saham, label mengikuti rentang
// kalender terdekat yang disediakan Yahoo (5d = sepekan bursa, dst).
const CRYPTO_RANGES = [{ key: '1', label: '24J' }, { key: '7', label: '7H' }, { key: '30', label: '30H' }, { key: '365', label: '1Th' }] as const
const STOCK_RANGES = [{ key: '1d', label: '24J' }, { key: '5d', label: '7H' }, { key: '1mo', label: '30H' }, { key: '1y', label: '1Th' }] as const

// Jendela grafik harga satu aset: garis naik-turun dari riwayat harga
// (CoinGecko untuk crypto, /api/prices mode riwayat untuk saham), dengan
// pilihan rentang dan penyegaran otomatis selama jendela terbuka.
function PriceChartModal({ holding, onClose }: { holding: InvestmentHolding; onClose: () => void }) {
  const ranges = holding.kind === 'saham' ? STOCK_RANGES : CRYPTO_RANGES
  const [rangeIndex, setRangeIndex] = useState(1)
  const [points, setPoints] = useState<[number, number][]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (showLoading: boolean) => {
    if (showLoading) setLoading(true)
    try {
      let next: [number, number][] = []
      if (holding.kind === 'crypto') {
        const id = COINGECKO_IDS[holding.symbol] ?? holding.symbol.toLowerCase()
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=idr&days=${ranges[rangeIndex].key}`)
        if (!response.ok) throw new Error('chart failed')
        const payload = await response.json() as { prices?: [number, number][] }
        next = (payload.prices ?? []).map(([ms, price]) => [Math.round(ms / 1000), price] as [number, number]).filter(([, price]) => Number.isFinite(price) && price > 0)
      } else {
        if (!supabase) throw new Error('no supabase client')
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) throw new Error('no session')
        const response = await fetch(`/api/prices?history=${encodeURIComponent(holding.symbol)}&range=${ranges[rangeIndex].key}`, { headers: { Authorization: `Bearer ${token}` } })
        if (!response.ok) throw new Error('chart failed')
        const payload = await response.json() as { points?: [number, number][] }
        next = (payload.points ?? []).filter(([time, price]) => Number.isFinite(time) && Number.isFinite(price) && price > 0)
      }
      if (next.length < 2) throw new Error('chart empty')
      setPoints(next)
      setError('')
    } catch {
      setError('Data grafik belum bisa dimuat untuk periode ini. Coba rentang lain atau tutup lalu buka lagi.')
    } finally {
      setLoading(false)
    }
  }, [holding, rangeIndex, ranges])

  useEffect(() => {
    void load(true)
    const timer = window.setInterval(() => { void load(false) }, 60000)
    return () => window.clearInterval(timer)
  }, [load])

  const first = points[0]
  const last = points[points.length - 1]
  const changePct = first && last ? ((last[1] - first[1]) / first[1]) * 100 : 0
  const high = points.length ? Math.max(...points.map(point => point[1])) : 0
  const low = points.length ? Math.min(...points.map(point => point[1])) : 0
  const up = changePct >= 0
  const chartColor = up ? 'var(--workspace-positive)' : '#c0362c'

  // Turunkan jumlah titik agar jalur SVG tetap ringan di HP.
  const stride = Math.max(1, Math.ceil(points.length / 160))
  const sampled = points.filter((_, index) => index % stride === 0 || index === points.length - 1)
  const width = 320
  const height = 140
  const pad = 5
  const span = high - low || 1
  const xAt = (index: number) => pad + (index / Math.max(1, sampled.length - 1)) * (width - pad * 2)
  const yAt = (value: number) => height - pad - ((value - low) / span) * (height - pad * 2)
  const linePath = sampled.map((point, index) => `${index === 0 ? 'M' : 'L'}${xAt(index).toFixed(1)},${yAt(point[1]).toFixed(1)}`).join(' ')
  const areaPath = sampled.length ? `${linePath} L${xAt(sampled.length - 1).toFixed(1)},${height - pad} L${xAt(0).toFixed(1)},${height - pad} Z` : ''
  const timeLabel = (seconds: number) => new Date(seconds * 1000).toLocaleString('id-ID', rangeIndex === 0
    ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: '2-digit' })

  return <Modal title={`${holding.symbol}${holding.name ? ` · ${holding.name}` : ''}`} subtitle={holding.kind === 'saham' ? 'Grafik harga saham (IDX via Yahoo Finance).' : 'Grafik harga crypto (CoinGecko, rupiah).'} onClose={onClose}>
    <div className="inv-chart-stats">
      {last ? <strong>{formatPrice(last[1])}</strong> : <strong>—</strong>}
      {first && last && <span style={{ ...chipBase, color: chartColor }}>{up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{formatPct(changePct)} periode ini</span>}
      {points.length > 0 && <span className="muted small">Tertinggi {formatPrice(high)} · Terendah {formatPrice(low)}</span>}
    </div>
    <div className="transaction-kind inv-ranges" role="group" aria-label="Rentang grafik">
      {ranges.map((range, index) => <button key={range.key} type="button" aria-pressed={rangeIndex === index} onClick={() => setRangeIndex(index)}>{range.label}</button>)}
    </div>
    {loading && points.length === 0
      ? <p className="muted">Memuat grafik…</p>
      : error && points.length === 0
        ? <p role="alert" className="form-error">{error}</p>
        : <>
            <svg viewBox={`0 0 ${width} ${height}`} className="inv-chart" style={{ color: chartColor }} role="img" aria-label={`Grafik harga ${holding.symbol}`}>
              <path d={areaPath} fill="currentColor" opacity={0.08} stroke="none" />
              <path d={linePath} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {sampled.length > 0 && <circle cx={xAt(sampled.length - 1)} cy={yAt(sampled[sampled.length - 1][1])} r={3} fill="currentColor" />}
            </svg>
            {first && last && <div className="inv-chart-times"><span>{timeLabel(first[0])}</span><span>{timeLabel(last[0])}</span></div>}
          </>}
    <p className="workspace-note">{holding.kind === 'saham'
      ? 'Harga IDX dapat jeda ±15 menit dan rentang mengikuti hari bursa. Grafik menyegar otomatis tiap ±1 menit selama jendela ini terbuka.'
      : 'Grafik menyegar otomatis tiap ±1 menit selama jendela ini terbuka.'}</p>
  </Modal>
}

export function InvestmentsWorkspace() {
  const store = useHousehold()
  const { state } = store
  const holdings = state.investments

  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [detail, setDetail] = useState<InvestmentHolding | null>(null)
  const [loadingQuotes, setLoadingQuotes] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [quoteError, setQuoteError] = useState('')
  const fetching = useRef(false)

  const fetchQuotes = useCallback(async () => {
    if (fetching.current || !holdings.length) return
    fetching.current = true
    setLoadingQuotes(true)
    const next: Record<string, Quote> = {}
    let failures = 0
    try {
      const stockCodes = [...new Set(holdings.filter(item => item.kind === 'saham').map(item => item.symbol))]
      if (stockCodes.length) {
        try {
          if (!supabase) throw new Error('no supabase client')
          const { data } = await supabase.auth.getSession()
          const token = data.session?.access_token
          if (!token) throw new Error('no session')
          const response = await fetch(`/api/prices?symbols=${stockCodes.join(',')}`, { headers: { Authorization: `Bearer ${token}` } })
          if (!response.ok) throw new Error('prices failed')
          const payload = await response.json() as { quotes?: Record<string, { price: number; changePct: number }> }
          for (const [code, quote] of Object.entries(payload.quotes ?? {})) {
            next[`saham:${code}`] = { price: quote.price, changePct: quote.changePct }
          }
          if (!Object.keys(payload.quotes ?? {}).length) failures += 1
        } catch { failures += 1 }
      }
      const cryptoHoldings = holdings.filter(item => item.kind === 'crypto')
      if (cryptoHoldings.length) {
        try {
          const ids = [...new Set(cryptoHoldings.map(item => COINGECKO_IDS[item.symbol] ?? item.symbol.toLowerCase()))]
          const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=idr&include_24hr_change=true`)
          if (!response.ok) throw new Error('coingecko failed')
          const payload = await response.json() as Record<string, { idr?: number; idr_24h_change?: number }>
          for (const holding of cryptoHoldings) {
            const id = COINGECKO_IDS[holding.symbol] ?? holding.symbol.toLowerCase()
            const entry = payload[id]
            if (entry && typeof entry.idr === 'number') next[quoteKey(holding)] = { price: entry.idr, changePct: entry.idr_24h_change ?? 0 }
          }
          if (!cryptoHoldings.some(item => next[quoteKey(item)])) failures += 1
        } catch { failures += 1 }
      }
      setQuotes(next)
      setLastUpdated(new Date())
      setQuoteError(failures && !Object.keys(next).length ? 'Harga live belum bisa dimuat. Periksa koneksi lalu ketuk Perbarui harga.' : '')
    } finally {
      fetching.current = false
      setLoadingQuotes(false)
    }
  }, [holdings])

  const holdingsKey = holdings.map(item => quoteKey(item)).sort().join('|')
  useEffect(() => { void fetchQuotes() }, [holdingsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Formulir tambah/ubah pegangan (modal lokal seperti KPR & Neraca).
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<InvestmentHolding | null>(null)
  const [kind, setKind] = useState<InvestmentHolding['kind']>('saham')
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [avgPrice, setAvgPrice] = useState('')
  const [formError, setFormError] = useState('')

  const openForm = (holding?: InvestmentHolding) => {
    setEditing(holding ?? null)
    setKind(holding?.kind ?? 'saham')
    setSymbol(holding?.symbol ?? '')
    setName(holding?.name ?? '')
    setQuantity(holding ? String(holding.quantity).replace('.', ',') : '')
    setAvgPrice(holding ? String(holding.avgPrice) : '')
    setFormError('')
    setFormOpen(true)
  }

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault()
    const parsedQuantity = Number(quantity.replace(/\s/g, '').replace(',', '.'))
    const holding: InvestmentHolding = {
      id: editing?.id ?? makeId(),
      kind,
      symbol: symbol.trim().toUpperCase(),
      name: name.trim(),
      quantity: parsedQuantity,
      avgPrice: Number(avgPrice),
    }
    const error = await store.saveInvestment(holding)
    if (error) { setFormError(error); return }
    setFormOpen(false)
  }

  const quoted = holdings.filter(item => quotes[quoteKey(item)])
  const totalValue = quoted.reduce((sum, item) => sum + item.quantity * quotes[quoteKey(item)].price, 0)
  const totalCost = quoted.reduce((sum, item) => sum + item.quantity * item.avgPrice, 0)
  const totalGain = totalValue - totalCost
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0
  const allCost = holdings.reduce((sum, item) => sum + item.quantity * item.avgPrice, 0)

  return <div className="space-y-6">
    <section className="balance-card">
      <div className="row-between"><span>Nilai portofolio (harga live)</span><span>{lastUpdated ? `Diperbarui ${lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : 'Belum dimuat'}</span></div>
      <h2>{quoted.length ? money(Math.round(totalValue)) : '—'}</h2>
      <div className="inv-summary-row">
        <span>Modal tercatat <strong>{money(Math.round(allCost))}</strong></span>
        {quoted.length > 0 && <span style={{ ...chipBase, color: totalGain >= 0 ? 'var(--workspace-positive)' : '#c0362c' }}>{totalGain >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{money(Math.round(Math.abs(totalGain)))} ({formatPct(totalGainPct)})</span>}
        <button type="button" className="secondary-button" disabled={loadingQuotes || !holdings.length} onClick={() => void fetchQuotes()}><RefreshCw size={14} /> {loadingQuotes ? 'Memuat…' : 'Perbarui harga'}</button>
      </div>
      {quoteError && <p className="workspace-note" role="alert">{quoteError}</p>}
      {holdings.length > 0 && quoted.length < holdings.length && <p className="workspace-note">{holdings.length - quoted.length} aset belum ada harga live-nya, jadi belum masuk total nilai di atas.</p>}
    </section>

    <section>
      <Section title="Aset dipantau" action="Tambah aset" onAction={() => openForm()} />
      {holdings.length === 0
        ? <Empty title="Belum ada aset dipantau">Tambahkan saham IDX atau crypto yang kalian pegang — harga live dan untung/ruginya tampil di sini.</Empty>
        : <div className="house-records">{holdings.map(holding => {
            const quote = quotes[quoteKey(holding)]
            const value = quote ? holding.quantity * quote.price : null
            const gain = quote ? value! - holding.quantity * holding.avgPrice : null
            const gainPct = gain != null && holding.avgPrice > 0 ? ((quote!.price - holding.avgPrice) / holding.avgPrice) * 100 : null
            return <article className="house-record inv-record inv-clickable" key={holding.id} onClick={() => setDetail(holding)}>
              <div className="row-between">
                <div className="inv-title"><strong>{holding.symbol}</strong><span className="badge">{holding.kind === 'saham' ? 'Saham' : 'Crypto'}</span>{holding.name && <span className="muted small">{holding.name}</span>}</div>
                <span onClick={event => event.stopPropagation()}><RowActions name={holding.symbol} onEdit={() => openForm(holding)} onDelete={() => store.setEditor({ type: 'confirm', title: `Hapus aset "${holding.symbol}"?`, description: 'Catatan pegangan ini akan dihapus permanen dari pantauan.', confirm: () => store.deleteInvestment(holding.id) })} /></span>
              </div>
              <div className="inv-price-row">
                {quote
                  ? <><strong>{formatPrice(quote.price)}</strong><span style={{ ...chipBase, color: quote.changePct >= 0 ? 'var(--workspace-positive)' : '#c0362c' }}>{quote.changePct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{formatPct(quote.changePct)} hari ini</span></>
                  : <span className="muted small">{loadingQuotes ? 'Memuat harga…' : 'Harga live belum tersedia'}</span>}
                <button type="button" className="text-button inv-chart-hint" onClick={event => { event.stopPropagation(); setDetail(holding) }}><Activity size={13} /> Grafik</button>
              </div>
              <p className="muted small inv-detail">
                Pegangan {formatQuantity(holding.quantity)} {holding.kind === 'saham' ? 'lembar' : 'koin'} · beli rata-rata {formatPrice(holding.avgPrice)}
                {value != null && <> · nilai kini <strong>{money(Math.round(value))}</strong></>}
                {gain != null && <> · {gain >= 0 ? 'untung' : 'rugi'} <strong style={{ color: gain >= 0 ? 'var(--workspace-positive)' : '#c0362c' }}>{money(Math.round(Math.abs(gain)))}{gainPct != null ? ` (${formatPct(gainPct)})` : ''}</strong></>}
              </p>
            </article>
          })}</div>}
      {holdings.length > 0 && <button type="button" className="primary-button" onClick={() => openForm()}><Plus size={17} /> Tambah aset</button>}
    </section>

    <p className="workspace-note">Harga saham dari Yahoo Finance (IDX, dapat jeda ±15 menit), crypto dari CoinGecko dalam rupiah. Nilai investasi tidak dihitung dalam Kekayaan Bersih. Bagian ini hanya untuk memantau — jual/beli tetap di aplikasi sekuritas/exchange masing-masing, lalu perbarui jumlah pegangannya di sini.</p>

    {detail && <PriceChartModal holding={detail} onClose={() => setDetail(null)} />}

    {formOpen && <Modal title={editing ? 'Ubah aset' : 'Tambah aset'} subtitle="Catat peganganmu; harganya dipantau otomatis." onClose={() => setFormOpen(false)}>
      <form className="workspace-form" onSubmit={submitForm}>
        <div className="form-columns">
          <Field id="inv-kind" label="Jenis aset"><select id="inv-kind" value={kind} onChange={event => setKind(event.target.value as InvestmentHolding['kind'])}><option value="saham">Saham (IDX)</option><option value="crypto">Crypto</option></select></Field>
          <Field id="inv-symbol" label={kind === 'saham' ? 'Kode emiten' : 'Kode crypto'} hint={kind === 'saham' ? 'Mis. BBCA, TLKM, GOTO.' : 'Mis. BTC, ETH, SOL.'}><input id="inv-symbol" type="text" required maxLength={20} autoComplete="off" placeholder={kind === 'saham' ? 'BBCA' : 'BTC'} value={symbol} onChange={event => setSymbol(event.target.value.toUpperCase())} /></Field>
        </div>
        <Field id="inv-name" label="Nama aset (opsional)"><input id="inv-name" type="text" maxLength={150} autoComplete="off" placeholder={kind === 'saham' ? 'Bank Central Asia' : 'Bitcoin'} value={name} onChange={event => setName(event.target.value)} /></Field>
        <div className="form-columns">
          <Field id="inv-quantity" label={kind === 'saham' ? 'Jumlah (lembar)' : 'Jumlah (koin)'} hint={kind === 'saham' ? '1 lot = 100 lembar.' : 'Boleh desimal, mis. 0,005.'}><input id="inv-quantity" type="text" inputMode="decimal" required autoComplete="off" placeholder={kind === 'saham' ? '100' : '0,005'} value={quantity} onChange={event => setQuantity(event.target.value)} /></Field>
          <MoneyInput id="inv-avg" label="Harga beli rata-rata per unit" value={avgPrice} onChange={setAvgPrice} allowZero />
        </div>
        <FormEnd error={formError} label={editing ? 'Simpan perubahan' : 'Tambah aset'} />
      </form>
    </Modal>}
  </div>
}
