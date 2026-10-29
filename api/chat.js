// Relai AI Vercel untuk Asisten Myhome — endpoint chat (streaming).
// Lihat api/_relay.js untuk penjelasan & gerbang keamanannya.

import { ensureRelay, pipeUpstream, readJsonBody, sendJson } from './_relay.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method tidak diizinkan.', code: 'method_not_allowed' })
    return
  }
  const gate = await ensureRelay(req, res)
  if (!gate) return

  const body = await readJsonBody(req)
  const messages = Array.isArray(body?.messages) ? body.messages : null
  if (!messages || !messages.length) {
    sendJson(res, 400, { error: 'Isi pesan (messages) wajib dikirim.', code: 'bad_request' })
    return
  }
  const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : ''

  const controller = new AbortController()
  if (typeof res.on === 'function') res.on('close', () => controller.abort())

  let upstream
  try {
    upstream = await fetch(`${gate.upstream.base}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gate.upstream.key}`,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ model, messages, stream: true }),
    })
  } catch {
    sendJson(res, 502, { error: 'Endpoint AI tidak terjangkau dari server.', code: 'upstream_unreachable' })
    return
  }

  await pipeUpstream(res, upstream)
}
