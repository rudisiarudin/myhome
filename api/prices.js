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

import { isValidSession, sendJson, serverConfig } from './_relay.js'

const CODE_PATTERN = /^[A-Z0-9]{1,10}$/
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

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
