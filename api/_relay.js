// Relai AI Vercel untuk Asisten Myhome — helper bersama (bukan rute:
// berkas berawalan "_" tidak dijadikan endpoint oleh Vercel).
//
// Kenapa relai ini ada: sebagian endpoint AI (NVIDIA, dan 9Router milik
// pengguna di router.udi.web.id) tidak lolos pemeriksaan CORS browser —
// panggilan langsung dari aplikasi web diblokir walaupun API key-nya benar.
// Fungsi server ini berjalan satu origin dengan aplikasi: klien memanggil
// /api/chat atau /api/models, fungsi memvalidasi sesi Supabase pemanggil,
// lalu meneruskan permintaan ke endpoint tujuan dengan API key milik
// pengguna sendiri.
//
// API key TIDAK disimpan di server: klien mengirimkannya per permintaan
// lewat header X-Upstream-Key (key tetap hanya tersimpan di localStorage
// perangkat pengguna), fungsi hanya meneruskannya ke endpoint tujuan —
// tidak dicatat, tidak disimpan, tidak dikembalikan.
//
// Endpoint tujuan dibatasi ke daftar izin di bawah supaya relai tidak bisa
// dipakai meneruskan ke alamat sembarangan.

export const ALLOWED_UPSTREAM_HOSTS = new Set([
  'router.udi.web.id',
  'integrate.api.nvidia.com',
])

export function serverConfig() {
  return {
    supabaseUrl: (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, ''),
    supabaseAnonKey:
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      '',
  }
}

export function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

function bearerToken(req) {
  const header = (req.headers && (req.headers.authorization || req.headers.Authorization)) || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match ? match[1].trim() : ''
}

function headerValue(req, name) {
  const value = req.headers && (req.headers[name] || req.headers[name.toLowerCase()])
  return typeof value === 'string' ? value.trim() : ''
}

// Token divalidasi langsung ke Supabase Auth: token sesi yang sah akan
// dijawab 200 beserta data user; token kosong/palsu/kedaluwarsa dijawab 401.
async function isValidSession(config, token) {
  try {
    const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${token}` },
    })
    return response.ok
  } catch {
    return false
  }
}

// Membaca & memvalidasi tujuan dari header klien. Mengembalikan
// { base, key } atau null bila respons error sudah dikirim.
function parseUpstream(req, res) {
  const rawBase = headerValue(req, 'x-upstream-base')
  const key = headerValue(req, 'x-upstream-key')
  if (!rawBase || !key) {
    sendJson(res, 400, {
      error: 'Header X-Upstream-Base dan X-Upstream-Key wajib dikirim.',
      code: 'upstream_headers_missing',
    })
    return null
  }
  let url
  try {
    url = new URL(rawBase)
  } catch {
    sendJson(res, 400, { error: 'Base URL endpoint tidak sah.', code: 'upstream_not_allowed' })
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password || !ALLOWED_UPSTREAM_HOSTS.has(url.hostname)) {
    sendJson(res, 400, {
      error: 'Endpoint ini tidak ada di daftar izin relai Myhome.',
      code: 'upstream_not_allowed',
    })
    return null
  }
  const base = `${url.origin}${url.pathname.replace(/\/+$/, '')}`
  return { base, key }
}

// Gerbang bersama kedua rute: konfigurasi server siap, sesi pemanggil sah,
// tujuan termasuk daftar izin. Mengembalikan { config, upstream } atau null
// bila respons error sudah dikirim dan pemanggil tinggal berhenti.
export async function ensureRelay(req, res) {
  const config = serverConfig()
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    sendJson(res, 503, {
      error: 'Relai AI belum dikonfigurasi di server (variabel Supabase belum lengkap di Vercel).',
      code: 'relay_not_configured',
    })
    return null
  }
  const token = bearerToken(req)
  if (!token) {
    sendJson(res, 401, { error: 'Sesi login tidak ditemukan.', code: 'unauthorized' })
    return null
  }
  if (!(await isValidSession(config, token))) {
    sendJson(res, 401, { error: 'Sesi login tidak sah atau sudah berakhir.', code: 'unauthorized' })
    return null
  }
  const upstream = parseUpstream(req, res)
  if (!upstream) return null
  return { config, upstream }
}

export async function readJsonBody(req) {
  if (req.body != null) {
    if (typeof req.body === 'object') return req.body
    if (typeof req.body === 'string' && req.body.trim()) {
      try { return JSON.parse(req.body) } catch { return null }
    }
    return null
  }
  try {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    if (!chunks.length) return null
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return null
  }
}

// Meneruskan respons upstream apa adanya: aliran SSE untuk jawaban chat,
// atau body error JSON untuk jawaban non-OK — supaya pesan informatif di
// klien tetap bekerja.
export async function pipeUpstream(res, upstream) {
  res.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('content-type') || 'application/json',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
  })
  if (!upstream.body) {
    res.end()
    return
  }
  const reader = upstream.body.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value && value.length) res.write(Buffer.from(value))
    }
  } catch {
    // Aliran terputus (pemanggil menutup koneksi atau upstream berhenti) — akhiri respons.
  }
  res.end()
}
