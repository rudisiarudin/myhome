// Relai AI Vercel untuk Asisten Myhome — endpoint daftar model.
// Dipakai tombol "Tes koneksi" di Pengaturan Asisten: klien mengirim
// header yang sama seperti /api/chat, fungsi meneruskan GET /models ke
// endpoint tujuan. Lihat api/_relay.js untuk gerbang keamanannya.

import { ensureRelay, pipeUpstream, sendJson } from './_relay.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method tidak diizinkan.', code: 'method_not_allowed' })
    return
  }
  const gate = await ensureRelay(req, res)
  if (!gate) return

  let upstream
  try {
    upstream = await fetch(`${gate.upstream.base}/models`, {
      headers: { Authorization: `Bearer ${gate.upstream.key}` },
    })
  } catch {
    sendJson(res, 502, { error: 'Endpoint AI tidak terjangkau dari server.', code: 'upstream_unreachable' })
    return
  }

  await pipeUpstream(res, upstream)
}
