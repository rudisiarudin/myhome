// Harga saham IDX untuk bagian Investasi Myhome.
//
// Kenapa lewat server: Yahoo Finance tidak mengirim header CORS yang bisa
// dipakai aplikasi web, jadi browser tidak boleh memanggilnya langsung.
// Fungsi ini memvalidasi sesi Supabase pemanggil (gerbang yang sama dengan
// relai AI di api/_relay.js), lalu membaca harga penutupan/terbaru emiten
// dari Yahoo Finance chart API (<KODE>.JK) dan mengembalikan ringkasannya.
//
// Pemakaian: GET /api/prices?symbols=BBCA,TLKM,GOTO
// Balasan:   { quotes: { BBCA: { price, prevClose, changePct, name } } }
// Simbol yang gagal dibaca tidak dimasukkan ke balasan (klien menampilkan
// tanda "belum ada harga"), bukan menggagalkan seluruh permintaan.
//
// Mode riwayat untuk grafik: GET /api/prices?history=BBCA&range=1mo
// Balasan:   { symbol: 'BBCA', points: [[unixDetik, harga], ...] }
// range yang didukung: 1d, 5d, 1mo, 6mo, 1y (interval dipilih server).

import { isValidSession, sendJson, serverConfig } from './_relay.js'

const CODE_PATTERN = /^[A-Z0-9]{1,10}$/
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
// Pasangan range -> interval Yahoo. Interval dipilih agar jumlah titik
// cukup halus untuk digambar (puluhan sampai ratusan titik per grafik).
const HISTORY_INTERVALS = { '1d': '15m', '5d': '30m', '1mo': '1d', '6mo': '1d', '1y': '1wk' }

async function fetchHistory(code, range) {
  const interval = HISTORY_INTERVALS[range] ?? '1d'
  const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${code}.JK?range=${range}&interval=${interval}`, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
  })
  if (!response.ok) return []
  const data = await response.json()
  const result = data?.chart?.result?.[0]
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : []
  const closes = Array.isArray(result?.indicators?.quote?.[0]?.close) ? result.indicators.quote[0].close : []
  const points = []
  for (let index = 0; index < timestamps.length; index += 1) {
    const close = Number(closes[index])
    const time = Number(timestamps[index])
    if (Number.isFinite(close) && close > 0 && Number.isFinite(time)) points.push([time, close])
  }
  return points
}

async function fetchQuote(code) {
  const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${code}.JK?range=1d&interval=1d`, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
  })
  if (!response.ok) return null
  const data = await response.json()
  const meta = data?.chart?.result?.[0]?.meta
  const price = Number(meta?.regularMarketPrice)
  if (!Number.isFinite(price) || price <= 0) return null
  let prevClose = Number(meta?.chartPreviousClose)
  if (!Number.isFinite(prevClose) || prevClose <= 0) {
    const dayChange = Number(meta?.fulldayChange)
    prevClose = Number.isFinite(dayChange) ? price - dayChange : price
  }
  return {
    price,
    prevClose,
    changePct: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
    name: typeof meta?.longName === 'string' ? meta.longName : '',
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method tidak diizinkan.', code: 'method_not_allowed' })
    return
  }
  const config = serverConfig()
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    sendJson(res, 503, { error: 'Fungsi harga belum dikonfigurasi di server (variabel Supabase belum lengkap di Vercel).', code: 'not_configured' })
    return
  }
  const header = (req.headers && (req.headers.authorization || req.headers.Authorization)) || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  const token = match ? match[1].trim() : ''
  if (!token || !(await isValidSession(config, token))) {
    sendJson(res, 401, { error: 'Sesi login tidak sah atau sudah berakhir.', code: 'unauthorized' })
    return
  }
  const url = new URL(req.url || '', 'http://localhost')
  const historyCode = (url.searchParams.get('history') || '').trim().toUpperCase()
  if (historyCode) {
    if (!CODE_PATTERN.test(historyCode)) {
      sendJson(res, 400, { error: 'Kode emiten tidak sah.', code: 'bad_symbol' })
      return
    }
    const range = HISTORY_INTERVALS[url.searchParams.get('range') || ''] ? (url.searchParams.get('range') || '') : '1mo'
    let points = []
    try { points = await fetchHistory(historyCode, range) } catch { points = [] }
    sendJson(res, 200, { symbol: historyCode, points })
    return
  }
  const codes = [...new Set((url.searchParams.get('symbols') || '')
    .split(',')
    .map(code => code.trim().toUpperCase())
    .filter(code => CODE_PATTERN.test(code)))].slice(0, 30)
  const quotes = {}
  await Promise.all(codes.map(async code => {
    try {
      const quote = await fetchQuote(code)
      if (quote) quotes[code] = quote
    } catch { /* Satu simbol gagal tidak menggagalkan simbol lain. */ }
  }))
  sendJson(res, 200, { quotes })
}
