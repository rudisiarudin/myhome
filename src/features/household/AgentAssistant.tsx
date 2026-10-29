import { Fragment, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Bot, Send, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { useHousehold } from './context'
import { useAccount } from '../account/context'
import { supabase } from '../../lib/supabase'
import { daysUntil, formatDate, goalBalance, makeId, money, spentIn, TODAY, walletBalance } from './model'
import type { HouseholdState } from './model'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
}

interface AgentSettings {
  baseUrl: string
  model: string
  apiKey: string
}

const LEGACY_DEFAULT_MODEL = 'deepseek-ai/deepseek-v4.1-flash'
const SETTINGS_KEY = 'myhome.agent.settings'
const MESSAGES_KEY = 'myhome.agent.messages'
const DEFAULT_SETTINGS: AgentSettings = {
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  model: 'z-ai/glm-5.3-flash',
  apiKey: '',
}

const QUICK_QUESTIONS = ['Ringkasan hari ini', 'Tagihan terdekat apa?', 'Sisa cicilan berapa?', 'Belanja apa yang belum dibeli?'] as const

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Halo! Saya Asisten Myhome. Saya bisa menjawab dari data rumah kalian — misalnya tagihan terdekat, sisa cicilan dan piutang, saldo dompet, agenda hari ini, target tabungan, dan daftar belanja.\n\nTap salah satu pertanyaan cepat di bawah, atau tulis pertanyaanmu sendiri.',
}

const FALLBACK_NO_KEY = 'Maaf, pertanyaan itu belum bisa saya jawab dari data dasar Myhome. Untuk pertanyaan bebas, aktifkan mode AI dulu: tap ikon pengaturan di atas panel ini, lalu isi API key dari penyedia model (misalnya NVIDIA). API key hanya tersimpan di perangkat ini.\n\nSementara itu, saya bisa menjawab soal: ringkasan hari ini, tagihan, cicilan/utang/piutang, saldo dompet, agenda, impian, dan belanja.'

const FALLBACK_TIMEOUT = 'Mode AI terlalu lama menjawab (lebih dari 150 detik) sehingga permintaan dihentikan. Endpoint gratis memang bisa lambat — coba lagi sebentar, atau pilih model yang lebih ringan di Pengaturan Asisten.\n\nSaya tetap bisa menjawab pertanyaan dasar soal tagihan, cicilan, saldo, agenda, dan belanja tanpa mode AI.'

const FALLBACK_ERROR = 'Maaf, mode AI sedang tidak bisa dihubungi. Periksa lagi Base URL, nama model, dan API key di Pengaturan Asisten, lalu coba lagi — beberapa endpoint juga tidak mengizinkan akses langsung dari browser (CORS).\n\nSaya tetap bisa menjawab pertanyaan dasar soal tagihan, cicilan, saldo, agenda, dan belanja tanpa mode AI.'

function loadSettings(): AgentSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<AgentSettings>
    const savedModel = typeof parsed.model === 'string' ? parsed.model.trim() : ''
    return {
      baseUrl: typeof parsed.baseUrl === 'string' && parsed.baseUrl.trim() ? parsed.baseUrl.trim() : DEFAULT_SETTINGS.baseUrl,
      // Model bawaan lama (DeepSeek) dimigrasikan ke GLM yang lebih ringan; model kustom lain tidak diubah.
      model: savedModel && savedModel !== LEGACY_DEFAULT_MODEL ? savedModel : DEFAULT_SETTINGS.model,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : '',
    }
  } catch { return DEFAULT_SETTINGS }
}

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(MESSAGES_KEY)
    if (!raw) return [WELCOME]
    const parsed = JSON.parse(raw) as ChatMessage[]
    const valid = Array.isArray(parsed) ? parsed.filter(item => item && typeof item.text === 'string' && (item.role === 'user' || item.role === 'assistant')) : []
    return valid.length ? valid : [WELCOME]
  } catch { return [WELCOME] }
}

const longDate = (date: string) => formatDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

function relativeDay(date: string): string {
  const days = daysUntil(date)
  if (days < 0) return `sudah lewat ${-days} hari`
  if (days === 0) return 'hari ini'
  if (days === 1) return 'besok'
  return `${days} hari lagi`
}

function unpaidBills(state: HouseholdState) {
  return state.bills.filter(bill => !bill.isPaid).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

function totalWallet(state: HouseholdState): number {
  return state.wallets.reduce((sum, wallet) => sum + walletBalance(wallet, state.transactions), 0)
}

function billsAnswer(state: HouseholdState): string {
  const bills = unpaidBills(state)
  if (!bills.length) return 'Semua tagihan sudah lunas. Tidak ada tagihan yang menunggu dibayar.'
  const lines = bills.slice(0, 6).map(bill => `• ${bill.title} — ${money(bill.amount)} · jatuh tempo ${formatDate(bill.dueDate)} (${relativeDay(bill.dueDate)})`)
  const total = bills.reduce((sum, bill) => sum + bill.amount, 0)
  return `Tagihan yang belum dibayar, dari yang paling dekat:\n\n${lines.join('\n')}${bills.length > 6 ? `\n• …dan ${bills.length - 6} tagihan lain` : ''}\n\nTotal ${bills.length} tagihan belum lunas: ${money(total)}.`
}

function debtsAnswer(state: HouseholdState, question: string): string {
  const wantsPiutang = question.includes('piutang')
  const wantsUtang = ['utang', 'hutang', 'cicilan', 'kpr', 'pinjaman', 'kredit'].some(word => question.includes(word))
  const sections: string[] = []
  const describe = (debt: HouseholdState['debts'][number]) => {
    const percent = debt.totalAmount > 0 ? Math.min(100, Math.max(0, Math.round((debt.totalAmount - debt.remainingAmount) / debt.totalAmount * 100))) : 100
    return `• ${debt.title} (${debt.lenderOrBorrower}) — sisa ${money(debt.remainingAmount)} dari ${money(debt.totalAmount)} (${percent}% lunas)${debt.monthlyPayment ? ` · cicilan ${money(debt.monthlyPayment)}/bulan` : ''}${debt.dueDay ? ` · tiap tanggal ${debt.dueDay}` : ''}`
  }
  if (wantsUtang || !wantsPiutang) {
    const debts = state.debts.filter(debt => debt.type !== 'piutang')
    if (debts.length) sections.push(`Utang & cicilan:\n${debts.map(describe).join('\n')}\nTotal sisa utang: ${money(debts.reduce((sum, debt) => sum + debt.remainingAmount, 0))}`)
  }
  if (wantsPiutang || !wantsUtang) {
    const receivables = state.debts.filter(debt => debt.type === 'piutang')
    if (receivables.length) {
      const total = receivables.reduce((sum, debt) => sum + debt.remainingAmount, 0)
      const section = `Piutang (uang yang dipinjam orang lain):\n${receivables.map(describe).join('\n')}\nTotal piutang belum kembali: ${money(total)}\nPiutang tidak dihitung dalam kekayaan bersih — kekayaan bersih hanya dari dompet + tabungan.`
      sections.push(section)
    }
  }
  if (!sections.length) return 'Belum ada catatan utang, cicilan, atau piutang di KPR & Neraca.'
  return sections.join('\n\n')
}

function walletsAnswer(state: HouseholdState): string {
  if (!state.wallets.length) return 'Belum ada dompet yang dicatat. Tambahkan dompet dulu di menu Keuangan.'
  const lines = state.wallets.map(wallet => `• ${wallet.name} — ${money(walletBalance(wallet, state.transactions))}`)
  return `Saldo dompet saat ini:\n\n${lines.join('\n')}\n\nTotal semua dompet: ${money(totalWallet(state))}.`
}

function shoppingAnswer(state: HouseholdState): string {
  const pending = state.shopping.filter(item => !item.isBought)
  if (!pending.length) return 'Semua belanja sudah dibeli. Daftar belanja lagi kosong, waktunya santai.'
  const shown = pending.slice(0, 12)
  return `Yang belum dibeli (${pending.length} barang):\n\n${shown.map(item => `• ${item.title}`).join('\n')}${pending.length > shown.length ? `\n• …dan ${pending.length - shown.length} barang lain` : ''}`
}

function agendaAnswer(state: HouseholdState, personName: (person: string) => string): string {
  const label = (event: HouseholdState['events'][number]) => `• ${event.time} — ${event.title}${event.assignee === 'berdua' ? ' (berdua)' : ` (${personName(event.assignee)})`}`
  const today = state.events.filter(event => event.date === TODAY && !event.isDone).sort((a, b) => a.time.localeCompare(b.time))
  if (today.length) return `Agenda hari ini (${formatDate(TODAY, { day: 'numeric', month: 'long' })}):\n\n${today.map(label).join('\n')}`
  const upcoming = state.events.filter(event => !event.isDone && daysUntil(event.date) > 0 && daysUntil(event.date) <= 7).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  if (!upcoming.length) return 'Hari ini tidak ada agenda yang belum selesai, dan seminggu ke depan juga masih kosong.'
  const nearest = upcoming[0].date
  const nearestItems = upcoming.filter(event => event.date === nearest)
  return `Hari ini tidak ada agenda yang belum selesai.\n\nAgenda terdekat ${longDate(nearest)} (${relativeDay(nearest)}):\n${nearestItems.map(label).join('\n')}`
}

function goalsAnswer(state: HouseholdState): string {
  if (!state.goals.length) return 'Belum ada impian/target tabungan yang dicatat. Tambahkan lewat menu Berdua, bagian Impian.'
  const lines = state.goals.map(goal => {
    const balance = goalBalance(goal, state.transactions)
    const percent = goal.targetAmount > 0 ? Math.min(100, Math.round(balance / goal.targetAmount * 100)) : 0
    return `• ${goal.title} — terkumpul ${money(balance)} dari ${money(goal.targetAmount)} (${percent}%) · target ${formatDate(goal.targetDate)}`
  })
  return `Target tabungan kalian:\n\n${lines.join('\n')}`
}

function summaryAnswer(state: HouseholdState, personName: (person: string) => string): string {
  const spent = spentIn(state.transactions, TODAY, 'household')
  const remaining = state.budget.daily - spent
  const agenda = state.events.filter(event => event.date === TODAY && !event.isDone).sort((a, b) => a.time.localeCompare(b.time))
  const bills = unpaidBills(state)
  const pendingShopping = state.shopping.filter(item => !item.isBought).length
  const lines = [
    `Ringkasan ${longDate(TODAY)}:`,
    '',
    `Saldo dompet: ${money(totalWallet(state))} dari ${state.wallets.length} dompet.`,
    `Belanja rumah hari ini: ${money(spent)} — sisa anggaran harian ${money(remaining)} dari ${money(state.budget.daily)}.`,
    agenda.length ? `Agenda hari ini (${agenda.length}):\n${agenda.map(event => `• ${event.time} — ${event.title}${event.assignee === 'berdua' ? ' (berdua)' : ` (${personName(event.assignee)})`}`).join('\n')}` : 'Agenda hari ini: tidak ada yang belum selesai.',
    bills.length ? `Tagihan terdekat: ${bills[0].title} — ${money(bills[0].amount)}, jatuh tempo ${formatDate(bills[0].dueDate)} (${relativeDay(bills[0].dueDate)}).` : 'Tagihan: semua sudah lunas.',
    pendingShopping ? `Belanja: ${pendingShopping} barang belum dibeli.` : 'Belanja: semua sudah dibeli.',
  ]
  return lines.join('\n')
}

/** Mesin jawab lokal: deterministik dari state, tanpa API key. Mengembalikan null bila intent tidak dikenal. */
function answerLocally(state: HouseholdState, rawQuestion: string, personName: (person: string) => string): string | null {
  const question = rawQuestion.toLowerCase()
  if (question.includes('belanja')) return shoppingAnswer(state)
  if (question.includes('tagihan') || question.includes('jatuh tempo')) return billsAnswer(state)
  if (['cicilan', 'utang', 'hutang', 'piutang', 'kpr', 'pinjaman', 'kredit'].some(word => question.includes(word))) return debtsAnswer(state, question)
  if (question.includes('saldo') || question.includes('dompet') || question.includes('uang')) return walletsAnswer(state)
  if (question.includes('impian') || question.includes('tabungan') || question.includes('nabung') || question.includes('target')) return goalsAnswer(state)
  if (question.includes('agenda') || question.includes('jadwal') || question.includes('acara')) return agendaAnswer(state, personName)
  if (question.includes('ringkasan') || question.includes('rekap') || question.includes('hari ini')) return summaryAnswer(state, personName)
  if (/^(halo|hai|hei|pagi|siang|sore|malam|assalamualaikum)\b/.test(question.trim()) && question.length < 30) {
    return 'Halo juga! Mau cek apa hari ini? Saya bisa bantu soal ringkasan hari ini, tagihan terdekat, sisa cicilan dan piutang, saldo dompet, agenda, impian, dan daftar belanja.'
  }
  return null
}

function buildContext(state: HouseholdState): string {
  const bills = unpaidBills(state).slice(0, 8).map(bill => `${bill.title} ${money(bill.amount)} (jatuh tempo ${bill.dueDate})`)
  const debts = state.debts.filter(debt => debt.type !== 'piutang').map(debt => `${debt.title}: sisa ${money(debt.remainingAmount)}${debt.monthlyPayment ? `, cicilan ${money(debt.monthlyPayment)}/bulan` : ''}`)
  const receivables = state.debts.filter(debt => debt.type === 'piutang').map(debt => `${debt.title} (${debt.lenderOrBorrower}): belum kembali ${money(debt.remainingAmount)}`)
  const agenda = state.events.filter(event => !event.isDone && daysUntil(event.date) >= 0 && daysUntil(event.date) <= 7)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).slice(0, 10)
    .map(event => `${event.date} ${event.time} ${event.title}`)
  const shopping = state.shopping.filter(item => !item.isBought).slice(0, 15).map(item => item.title)
  const goals = state.goals.map(goal => `${goal.title}: terkumpul ${money(goalBalance(goal, state.transactions))} dari ${money(goal.targetAmount)}`)
  return [
    `Tanggal hari ini: ${TODAY} (${longDate(TODAY)})`,
    `Dompet: ${state.wallets.map(wallet => `${wallet.name} ${money(walletBalance(wallet, state.transactions))}`).join('; ') || 'belum ada'} (total ${money(totalWallet(state))})`,
    `Pengeluaran belanja rumah hari ini: ${money(spentIn(state.transactions, TODAY, 'household'))}; anggaran harian ${money(state.budget.daily)}`,
    `Tagihan belum lunas: ${bills.join('; ') || 'tidak ada'}`,
    `Utang/cicilan: ${debts.join('; ') || 'tidak ada'}`,
    `Piutang: ${receivables.join('; ') || 'tidak ada'}`,
    `Agenda 7 hari ke depan: ${agenda.join('; ') || 'tidak ada'}`,
    `Belanja belum dibeli: ${shopping.join(', ') || 'tidak ada'}`,
    `Impian/tabungan: ${goals.join('; ') || 'tidak ada'}`,
  ].join('\n')
}

class LlmHttpError extends Error {
  status: number
  detail: string
  constructor(status: number, detail: string) {
    super(`HTTP ${status}`)
    this.status = status
    this.detail = detail
  }
}

function extractErrorDetail(raw: string): string {
  const text = raw.trim()
  if (!text) return ''
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } | string; message?: string; detail?: string }
    const found = (typeof parsed.error === 'string' ? parsed.error : parsed.error?.message) ?? parsed.message ?? parsed.detail ?? ''
    if (found) return found.length > 220 ? `${found.slice(0, 220)}…` : found
  } catch { /* Bukan JSON — pakai potongan teks apa adanya di bawah. */ }
  return text.length > 220 ? `${text.slice(0, 220)}…` : text
}

// Endpoint yang tidak lolos pemeriksaan CORS browser dirutekan lewat relai
// server Myhome (/api/chat dan /api/models). Daftar host di sini harus sama
// dengan daftar izin di api/_relay.js.
const RELAY_HOSTS = new Set(['router.udi.web.id', 'integrate.api.nvidia.com'])

function usesRelay(baseUrl: string): boolean {
  try {
    return RELAY_HOSTS.has(new URL(baseUrl).hostname)
  } catch {
    return false
  }
}

// Header untuk memanggil relai: token sesi Supabase pemanggil (divalidasi
// server), plus Base URL & API key dari pengaturan — key hanya diteruskan
// server ke endpoint tujuan, tidak disimpan di server. Mengembalikan null
// bila tidak ada sesi, supaya pemanggil jatuh ke panggilan langsung.
async function relayHeaders(settings: AgentSettings): Promise<Record<string, string> | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return null
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Upstream-Base': settings.baseUrl.trim().replace(/\/+$/, ''),
    'X-Upstream-Key': settings.apiKey.trim(),
  }
}

function llmErrorMessage(status: number, detail: string): string {
  const head = `Mode AI menjawab error ${status}${detail ? `: ${detail}` : ''}.`
  if (status === 401 || status === 403) return `${head}\n\nPeriksa lagi API key di Pengaturan Asisten — kemungkinan key-nya salah, kosong, atau sudah tidak berlaku.`
  if (status === 404) return `${head}\n\nPeriksa lagi Base URL dan nama model di Pengaturan Asisten — endpoint atau modelnya tidak ditemukan.`
  if (status === 429) return `${head}\n\nBatas pemakaian gratis endpoint sedang tercapai. Tunggu sebentar, lalu coba lagi.`
  return `${head}\n\nPeriksa lagi Base URL, nama model, dan API key di Pengaturan Asisten, lalu coba lagi.`
}

async function askLLM(settings: AgentSettings, state: HouseholdState, history: ChatMessage[], question: string, onToken: (text: string) => void): Promise<string> {
  const baseUrl = settings.baseUrl.trim().replace(/\/+$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 150000)
  try {
    const relay = usesRelay(baseUrl) ? await relayHeaders(settings) : null
    const response = await fetch(relay ? '/api/chat' : `${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: relay ?? { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey.trim()}` },
      body: JSON.stringify({
        model: settings.model.trim(),
        stream: true,
        messages: [
          {
            role: 'system',
            content: `Kamu adalah Asisten Myhome, asisten rumah tangga berbahasa Indonesia di aplikasi Myhome. Jawab singkat, ramah, dan hanya berdasarkan data rumah di bawah ini. Jika datanya tidak ada, katakan terus terang — jangan mengarang angka. Kamu hanya bisa membaca data, tidak bisa mengubah atau menghapus data apa pun.\n\nData rumah saat ini:\n${buildContext(state)}`,
          },
          ...history.slice(-6).map(message => ({ role: message.role, content: message.text })),
          { role: 'user', content: question },
        ],
      }),
    })
    if (!response.ok) {
      const detail = extractErrorDetail(await response.text().catch(() => ''))
      throw new LlmHttpError(response.status, detail)
    }
    const reader = response.body?.getReader()
    if (!reader) {
      // Endpoint tidak mendukung streaming — baca jawaban JSON utuh seperti biasa.
      const data = await response.json() as { choices?: { message?: { content?: string } }[] }
      const text = data.choices?.[0]?.message?.content?.trim()
      if (!text) throw new Error('Jawaban kosong')
      onToken(text)
      return text
    }
    const decoder = new TextDecoder()
    let buffer = ''
    let full = ''
    let done = false
    const consumeLine = (line: string) => {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) return
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') { done = true; return }
      try {
        const parsed = JSON.parse(payload) as { choices?: { delta?: { content?: string }; message?: { content?: string } }[] }
        const chunk = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content ?? ''
        if (chunk) { full += chunk; onToken(full) }
      } catch { /* Potongan SSE tidak lengkap/invalid — lewati dengan aman. */ }
    }
    while (!done) {
      const { value, done: streamDone } = await reader.read()
      if (streamDone) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        consumeLine(line)
        if (done) break
      }
    }
    if (!done && buffer.trim()) consumeLine(buffer)
    const text = full.trim()
    if (!text) throw new Error('Jawaban kosong')
    return text
  } finally {
    clearTimeout(timer)
  }
}

// Perender teks kaya ringan untuk jawaban Asisten: paragraf, daftar,
// **tebal**, dan `kode`. Sengaja dibuat tangan tanpa menyuntik HTML, supaya
// jawaban model tampil rapi tapi tetap aman — semua dirender sebagai node
// React yang dibangun dari string biasa.
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let last = 0
  let idx = 0
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0
    if (at > last) parts.push(text.slice(last, at))
    const token = match[0]
    if (token.startsWith('**')) parts.push(<strong key={`${keyPrefix}-${idx}`}>{token.slice(2, -2)}</strong>)
    else parts.push(<code key={`${keyPrefix}-${idx}`}>{token.slice(1, -1)}</code>)
    idx += 1
    last = at + token.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function renderRichText(text: string): ReactNode {
  const blocks = text.split(/\n{2,}/).map(block => block.trim()).filter(Boolean)
  return blocks.map((block, bi) => {
    const lines = block.split('\n')
    const isList = lines.every(line => /^\s*(?:[-*•]|\d+[.)])\s+/.test(line))
    if (isList) {
      return <ul key={bi}>{lines.map((line, li) => <li key={li}>{renderInline(line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ''), `b${bi}l${li}`)}</li>)}</ul>
    }
    return <p key={bi}>{lines.map((line, li) => <Fragment key={li}>{li > 0 && <br />}{renderInline(line, `b${bi}l${li}`)}</Fragment>)}</p>
  })
}

export function AgentAssistant({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const store = useHousehold()
  const { nameForPerson } = useAccount()
  const [view, setView] = useState<'chat' | 'settings'>('chat')
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [settings, setSettings] = useState<AgentSettings>(loadSettings)
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl)
  const [model, setModel] = useState(settings.model)
  const [apiKey, setApiKey] = useState(settings.apiKey)
  const [streamText, setStreamText] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const titleId = 'agent-dialog-title'

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [open ])

  useEffect(() => {
    try { localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages.slice(-50))) } catch { /* Riwayat tetap jalan tanpa penyimpanan. */ }
  }, [messages])

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages, sending, open, view, streamText])

  const close = () => { onOpenChange(false); setView('chat') }

  const openSettings = () => {
    setBaseUrl(settings.baseUrl)
    setModel(settings.model)
    setApiKey(settings.apiKey)
    setTestResult('')
    setView('settings')
  }

  const send = async (raw: string) => {
    const question = raw.trim()
    if (!question || sending) return
    const userMessage: ChatMessage = { id: makeId(), role: 'user', text: question }
    const history = [...messages, userMessage]
    setMessages(history)
    setInput('')
    const local = answerLocally(store.state, question, nameForPerson)
    if (local) {
      setMessages([...history, { id: makeId(), role: 'assistant', text: local }])
      return
    }
    if (!settings.apiKey.trim()) {
      setMessages([...history, { id: makeId(), role: 'assistant', text: FALLBACK_NO_KEY }])
      return
    }
    setSending(true)
    setStreamText('')
    try {
      const reply = await askLLM(settings, store.state, history, question, partial => setStreamText(partial))
      setMessages([...history, { id: makeId(), role: 'assistant', text: reply }])
    } catch (error) {
      const isAbort = typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError'
      const text = error instanceof LlmHttpError
        ? llmErrorMessage(error.status, error.detail)
        : isAbort ? FALLBACK_TIMEOUT : FALLBACK_ERROR
      setMessages([...history, { id: makeId(), role: 'assistant', text }])
    } finally {
      setSending(false)
      setStreamText('')
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void send(input)
  }

  const testConnection = async () => {
    const url = baseUrl.trim().replace(/\/+$/, '')
    const key = apiKey.trim()
    if (!url || !model.trim() || !key || testing) return
    setTesting(true)
    setTestResult('')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30000)
    try {
      const relay = usesRelay(url) ? await relayHeaders({ baseUrl: url, model: model.trim(), apiKey: key }) : null
      const response = relay
        ? await fetch('/api/models', { method: 'POST', headers: relay, signal: controller.signal })
        : await fetch(`${url}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: controller.signal })
      if (!response.ok) {
        const detail = extractErrorDetail(await response.text().catch(() => ''))
        setTestResult(`Koneksi gagal — error ${response.status}${detail ? `: ${detail}` : ''}.`)
        return
      }
      const data = await response.json() as { data?: unknown[] }
      const count = Array.isArray(data.data) ? data.data.length : 0
      setTestResult(count ? `Koneksi berhasil — ${count} model tersedia.` : 'Koneksi berhasil.')
    } catch {
      setTestResult('Koneksi gagal — endpoint tidak terjangkau. Periksa Base URL dan koneksi internet.')
    } finally {
      clearTimeout(timer)
      setTesting(false)
    }
  }

  const saveSettings = (event: FormEvent) => {
    event.preventDefault()
    const next: AgentSettings = {
      baseUrl: baseUrl.trim() || DEFAULT_SETTINGS.baseUrl,
      model: model.trim() || DEFAULT_SETTINGS.model,
      apiKey: apiKey.trim(),
    }
    setSettings(next)
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)) } catch { /* Pengaturan tetap berlaku selama sesi ini. */ }
    setView('chat')
    setMessages(current => [...current, {
      id: makeId(),
      role: 'assistant',
      text: next.apiKey
        ? 'Pengaturan Asisten tersimpan di perangkat ini. Mode AI aktif — pertanyaan bebas akan diteruskan ke model. Pertanyaan dasar soal tagihan, cicilan, saldo, agenda, dan belanja tetap dijawab langsung dari data rumah.'
        : 'Pengaturan Asisten tersimpan di perangkat ini. API key masih kosong, jadi saya menjawab dengan mode lokal dari data rumah.',
    }])
  }

  const clearMessages = () => {
    setMessages([WELCOME])
    try { localStorage.removeItem(MESSAGES_KEY) } catch { /* Abaikan kegagalan penyimpanan. */ }
  }

  return <>
    {open && <dialog ref={dialogRef} className="expense-dialog workspace-dialog agent-dialog" aria-labelledby={titleId} onCancel={close} onClick={event => { if (event.target === event.currentTarget) close() }}>
      <div className="dialog-content agent-content">
        <span className="sheet-handle" aria-hidden="true" />
        <div className="row-between dialog-heading agent-heading">
          <div className="agent-title">
            <span className="agent-title-icon"><Bot size={20} /></span>
            <div>
              <h2 id={titleId}>Asisten Myhome</h2>
              <p className="muted small">{view === 'settings' ? 'Pengaturan mode AI' : 'Tanya soal data rumah kalian'}</p>
            </div>
          </div>
          <div className="agent-heading-actions">
            <button type="button" className="icon-button" aria-label="Pengaturan Asisten" aria-pressed={view === 'settings'} onClick={() => view === 'settings' ? setView('chat') : openSettings()}><SlidersHorizontal size={19} /></button>
            <button type="button" className="icon-button dialog-close" aria-label="Tutup Asisten" onClick={close}><X size={21} /></button>
          </div>
        </div>

        {view === 'settings' ? <form className="workspace-form agent-settings" onSubmit={saveSettings}>
          <div className="form-field">
            <label htmlFor="agent-base-url">Base URL endpoint</label>
            <input id="agent-base-url" type="url" inputMode="url" autoComplete="off" placeholder="https://integrate.api.nvidia.com/v1" value={baseUrl} onChange={event => setBaseUrl(event.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="agent-model">Nama model</label>
            <input id="agent-model" type="text" autoComplete="off" placeholder="z-ai/glm-5.3-flash" value={model} onChange={event => setModel(event.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="agent-api-key">API key</label>
            <input id="agent-api-key" type="password" autoComplete="off" placeholder="Tempel API key penyedia model" value={apiKey} onChange={event => setApiKey(event.target.value)} />
            <small>API key hanya tersimpan di perangkat ini (localStorage). Untuk endpoint yang tidak mengizinkan panggilan langsung dari browser (misalnya router.udi.web.id dan NVIDIA), panggilan diteruskan lewat relai server Myhome — key hanya diteruskan ke endpoint tujuan, tidak disimpan atau dicatat di server. Contoh penyedia: NVIDIA (build.nvidia.com) dengan Base URL & model bawaan di atas.</small>
          </div>
          <div>
            <button type="button" className="secondary-button" disabled={testing || !baseUrl.trim() || !model.trim() || !apiKey.trim()} onClick={() => void testConnection()}>{testing ? 'Menghubungi endpoint…' : 'Tes koneksi'}</button>
            {testResult && <p className="form-hint" role="status" style={{ marginTop: '8px' }}>{testResult}</p>}
          </div>
          <p className="form-hint">Tanpa API key, Asisten tetap bisa menjawab pertanyaan dasar dari data rumah: ringkasan hari ini, tagihan, cicilan & piutang, saldo dompet, agenda, impian, dan belanja.</p>
          <button type="submit" className="primary-button" style={{ width: '100%' }}>Simpan pengaturan</button>
          <button type="button" className="danger-text" onClick={clearMessages}><Trash2 size={14} /> Hapus riwayat obrolan</button>
        </form> : <>
          <div className="agent-messages" ref={listRef} aria-live="polite">
            {messages.map(message => message.role === 'assistant'
              ? <div key={message.id} className="agent-row">
                  <span className="agent-avatar" aria-hidden="true"><Bot size={15} /></span>
                  <div className="agent-msg assistant">{renderRichText(message.text)}</div>
                </div>
              : <div key={message.id} className="agent-msg user">{message.text}</div>)}
            {streamText && <div className="agent-row">
              <span className="agent-avatar" aria-hidden="true"><Bot size={15} /></span>
              <div className="agent-msg assistant">{renderRichText(streamText)}<span className="agent-caret" aria-hidden="true" /></div>
            </div>}
            {sending && !streamText && <div className="agent-row">
              <span className="agent-avatar" aria-hidden="true"><Bot size={15} /></span>
              <div className="agent-msg assistant"><span className="agent-dots" role="status" aria-label="Sedang menyusun jawaban"><span className="agent-dot" /><span className="agent-dot" /><span className="agent-dot" /></span></div>
            </div>}
          </div>
          <div className="agent-chips" role="group" aria-label="Pertanyaan cepat">
            {QUICK_QUESTIONS.map(question => <button key={question} type="button" className="agent-chip" disabled={sending} onClick={() => void send(question)}>{question}</button>)}
          </div>
          <form className="agent-composer" onSubmit={submit}>
            <label className="sr-only" htmlFor="agent-input">Tulis pertanyaan untuk Asisten</label>
            <input id="agent-input" type="text" autoComplete="off" maxLength={500} placeholder="Tanya tagihan, cicilan, saldo…" value={input} onChange={event => setInput(event.target.value)} />
            <button type="submit" className="agent-send" aria-label="Kirim pertanyaan" disabled={sending || !input.trim()}><Send size={19} /></button>
          </form>
        </>}
      </div>
    </dialog>}
  </>
}
