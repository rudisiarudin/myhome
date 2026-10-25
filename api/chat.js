// Relai AI Vercel untuk Asisten Myhome — endpoint chat.
//
// Kenapa relai ini ada: endpoint NVIDIA (integrate.api.nvidia.com) tidak
// mengirim header Access-Control-Allow-Origin, jadi browser memblokir
// panggilan langsung dari aplikasi web (CORS) walaupun API key-nya benar.
// Fungsi server ini berjalan satu origin dengan aplikasi: klien memanggil
// /api/chat, fungsi memvalidasi sesi Supabase pemanggil, lalu meneruskan
// permintaan ke NVIDIA dengan API key yang HANYA tersimpan di environment
// variable server (NVIDIA_API_KEY). Key tidak pernah ada di repo, tidak
// masuk bundle klien, tidak dicatat, dan tidak dikembalikan ke pemanggil.
//
// Format handler: gaya Node Vercel (req, res) karena paling andal untuk
// meneruskan aliran streaming SSE potongan demi potongan lewat res.write()
// tanpa buffering tambahan.

const NVIDIA_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
const DEFAULT_MODEL = 'z-ai/glm-5.3-flash'

function serverConfig() {
  return {
    nvidiaApiKey: process.env.NVIDIA_API_KEY || '',
    supabaseUrl: (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, ''),
    supabaseAnonKey:
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      '',
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

function bearerToken(req) {
  const header = (req.headers && (req.headers.authorization || req.headers.Authorization)) || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match ? match[1].trim() : ''
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

async function readJsonBody(req) {
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

// Mengembalikan true bila relai siap dipakai; bila belum, respons error
// yang sesuai sudah dikirim dan pemanggil tinggal berhenti.
async function ensureReady(req, res) {
  const config = serverConfig()
  if (!config.nvidiaApiKey || !config.supabaseUrl || !config.supabaseAnonKey) {
    sendJson(res, 503, {
      error: 'Relai AI belum dikonfigurasi di server (NVIDIA_API_KEY belum dipasang di Vercel).',
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
  return config
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method tidak diizinkan.', code: 'method_not_allowed' })
    return
  }
  const config = await ensureReady(req, res)
  if (!config) return

  const body = await readJsonBody(req)
  const messages = Array.isArray(body?.messages) ? body.messages : null
  if (!messages || !messages.length) {
    sendJson(res, 400, { error: 'Isi pesan (messages) wajib dikirim.', code: 'bad_request' })
    return
  }
  const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : DEFAULT_MODEL

  const controller = new AbortController()
  if (typeof res.on === 'function') res.on('close', () => controller.abort())

  let upstream
  try {
    upstream = await fetch(NVIDIA_CHAT_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.nvidiaApiKey}`,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ model, messages, stream: true }),
    })
  } catch {
    sendJson(res, 502, { error: 'Endpoint AI tidak terjangkau dari server.', code: 'upstream_unreachable' })
    return
  }

  // Teruskan status & body apa adanya: aliran SSE untuk jawaban sukses,
  // atau body error NVIDIA (JSON) untuk jawaban non-OK — supaya pesan
  // informatif di klien tetap bekerja.
  res.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('content-type') || 'text/event-stream',
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
