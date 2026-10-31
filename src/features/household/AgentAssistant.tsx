import { Fragment, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Bot, ImagePlus, Send, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { useHousehold } from './context'
import { useAccount } from '../account/context'
import { supabase } from '../../lib/supabase'
import { daysUntil, formatDate, goalBalance, makeId, money, spentIn, TODAY, walletBalance } from './model'
import type { HouseholdState, Transaction } from './model'
import { hasCatatTrigger, parseExpenseText } from './expenseText'

// Kartu konfirmasi penyamaan saldo: dibuat setelah Asisten membaca saldo
// dari screenshot m-banking. Tidak ada data yang berubah sebelum pengguna
// menekan tombol Samakan di kartu ini.
interface BalanceCard {
  walletId: string
  bankLabel: string
  readBalance: number
  status: 'pending' | 'applied' | 'cancelled'
  appliedBalance?: number
}

// Kartu konfirmasi pengeluaran: dibuat setelah Asisten membaca bukti QRIS
// atau foto struk. Semua kolom masih bisa diubah pengguna sebelum menekan
// Catat pengeluaran; tidak ada data yang berubah sebelum itu.
interface ExpenseCard {
  merchant: string
  total: number
  walletId: string
  category: string
  status: 'pending' | 'applied' | 'cancelled'
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  image?: string
  balanceCard?: BalanceCard
  expenseCard?: ExpenseCard
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
  text: 'Halo! Saya Asisten Myhome. Saya bisa menjawab dari data rumah kalian — misalnya tagihan terdekat, sisa cicilan dan piutang, saldo dompet, agenda hari ini, target tabungan, dan daftar belanja.\n\nKamu juga bisa mengirim gambar lewat tombol gambar: screenshot m-banking untuk menyamakan saldo dompet, atau bukti QRIS / foto struk untuk mencatat pengeluaran. Isinya saya baca otomatis, lalu kamu konfirmasi dulu lewat kartunya sebelum diterapkan.\n\nTap salah satu pertanyaan cepat di bawah, atau tulis pertanyaanmu sendiri.',
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
const RELAY_HOSTS = new Set(['router.udi.web.id', 'api.udi.web.id', 'integrate.api.nvidia.com'])

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
            content: `Kamu adalah Asisten Myhome, asisten rumah tangga berbahasa Indonesia di aplikasi Myhome. Jawab singkat, ramah, dan hanya berdasarkan data rumah di bawah ini. Jika datanya tidak ada, katakan terus terang — jangan mengarang angka. Kamu tidak bisa mengubah atau menghapus data apa pun secara langsung; satu-satunya pengecualian adalah penyamaan saldo dompet dan pencatatan pengeluaran dari pesan teks, screenshot m-banking, bukti QRIS, atau foto struk, yang berjalan lewat kartu konfirmasi khusus dan selalu menunggu persetujuan pengguna.\n\nData rumah saat ini:\n${buildContext(state)}`,
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

// Hasil baca satu kiriman gambar: layar saldo m-banking ATAU bukti
// pengeluaran (bukti QRIS berhasil / foto struk). Jenisnya ditentukan model
// dari isi gambarnya, lalu pengguna mengonfirmasi lewat kartu yang sesuai.
type ScreenshotReading =
  | { type: 'balance'; bank: string; balance: number }
  | { type: 'expense'; merchant: string; total: number; bank: string; category: string }

// Kategori pengeluaran yang sama dengan formulir transaksi manual.
const EXPENSE_CATEGORY_KEYS = ['makan', 'belanja', 'kencan', 'transport', 'hobi', 'tagihan']
const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  makan: 'Makan & dapur',
  belanja: 'Belanja rumah',
  kencan: 'Kencan berdua',
  transport: 'Bensin & kendaraan',
  hobi: 'Hobi & personal',
  tagihan: 'Tagihan',
}

// Mengirim satu gambar ke model vision (jalur yang sama dengan mode AI,
// lewat relai bila host-nya terdaftar) dan mengembalikan teks jawabannya.
// Sebagian model membalas sebagai aliran SSE walau stream tidak diminta —
// potongannya disatukan di sini.
async function visionTextContent(settings: AgentSettings, dataUrl: string, instruction: string): Promise<string> {
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
        stream: false,
        messages: [
          { role: 'system', content: 'Kamu adalah pembaca gambar untuk aplikasi rumah tangga Myhome. Tugasmu hanya mengekstrak data dari gambar — jangan memberi penjelasan apa pun.' },
          {
            role: 'user',
            content: [
              { type: 'text', text: instruction },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    })
    const raw = await response.text().catch(() => '')
    if (!response.ok) throw new LlmHttpError(response.status, extractErrorDetail(raw))
    let content = ''
    if (raw.trimStart().startsWith('data:')) {
      for (const line of raw.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        try {
          const parsed = JSON.parse(payload) as { choices?: { delta?: { content?: string }; message?: { content?: string } }[] }
          content += parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content ?? ''
        } catch { /* Potongan tidak lengkap — lewati. */ }
      }
    } else {
      const data = JSON.parse(raw) as { choices?: { message?: { content?: string | { type?: string; text?: string }[] } }[] }
      const messageContent = data.choices?.[0]?.message?.content
      if (typeof messageContent === 'string') content = messageContent
      else if (Array.isArray(messageContent)) content = messageContent.map(part => part.text ?? '').join('')
    }
    return content
  } finally {
    clearTimeout(timer)
  }
}

function parseMoneyField(value: unknown): number {
  return typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d]/g, ''))
}

function isValidMoneyAmount(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 999999999999
}

// Membaca gambar dalam SATU panggilan: model mengklasifikasikan isinya
// (saldo vs pengeluaran) dan mengekstrak datanya sebagai JSON. Penguraian
// di sisi klien longgar (fence ```json, teks pengantar) tapi semua nominal
// divalidasi ketat; gagal baca melempar Error('unreadable').
async function analyzeScreenshot(settings: AgentSettings, dataUrl: string): Promise<ScreenshotReading> {
  const instruction = 'Periksa gambar ini untuk aplikasi rumah tangga Myhome. Ada dua kemungkinan isi:\n'
    + '1) Layar m-banking/e-wallet yang menampilkan SALDO utama → balas: {"jenis":"saldo","bank":"SeaBank","nominal":4278245}\n'
    + '2) Bukti pembayaran QRIS berhasil atau foto struk belanja → balas: {"jenis":"pengeluaran","merchant":"Indomaret","nominal":52000,"bank":"SeaBank","kategori":"belanja"}\n'
    + 'Aturan: "nominal" adalah saldo utama (untuk jenis saldo) atau total bayar (untuk jenis pengeluaran), angka rupiah utuh tanpa titik, koma, atau simbol. "bank" adalah nama bank/e-wallet yang terlihat (pada bukti QRIS biasanya tertulis sebagai sumber dana); kosongkan "" bila tidak ada. "kategori" pilih SATU dari: makan, belanja, kencan, transport, hobi, tagihan — tebak dari merchantnya (warung/restoran/kopi → makan; minimarket/supermarket/toko → belanja; bensin/parkir/ojek → transport; listrik/internet/pulsa → tagihan). "merchant" adalah nama toko/merchant penerima pembayaran.\n'
    + 'Balas HANYA JSON-nya. Jika gambar bukan keduanya atau nominalnya tidak terbaca jelas, balas {"jenis":""}.'
  const content = await visionTextContent(settings, dataUrl, instruction)
  const jsonMatch = content.match(/\{[\s\S]*?\}/)
  if (!jsonMatch) throw new Error('unreadable')
  const parsed = JSON.parse(jsonMatch[0]) as { jenis?: unknown; bank?: unknown; nominal?: unknown; merchant?: unknown; kategori?: unknown }
  const amount = parseMoneyField(parsed.nominal)
  const bank = typeof parsed.bank === 'string' ? parsed.bank.trim() : ''
  if (parsed.jenis === 'saldo') {
    if (!isValidMoneyAmount(amount)) throw new Error('unreadable')
    return { type: 'balance', bank, balance: amount }
  }
  if (parsed.jenis === 'pengeluaran') {
    if (!isValidMoneyAmount(amount)) throw new Error('unreadable')
    const merchant = typeof parsed.merchant === 'string' ? parsed.merchant.trim().slice(0, 100) : ''
    const category = typeof parsed.kategori === 'string' && EXPENSE_CATEGORY_KEYS.includes(parsed.kategori.trim()) ? parsed.kategori.trim() : 'belanja'
    return { type: 'expense', merchant, total: amount, bank, category }
  }
  throw new Error('unreadable')
}

// Alias nama bank/e-wallet untuk mencocokkan teks terbaca dari screenshot
// dengan nama dompet di aplikasi (mis. "Bank Central Asia" → dompet "BCA").
const BANK_ALIASES: Record<string, string[]> = {
  seabank: ['seabank', 'bankseabank'],
  bca: ['bca', 'bankcentralasia', 'centralasia', 'bcadigital', 'blu'],
  bni: ['bni', 'banknegara'],
  bri: ['bri', 'bankrakyat', 'brimo'],
  mandiri: ['mandiri', 'bankmandiri', 'livin'],
  jago: ['jago', 'bankjago'],
  gopay: ['gopay'],
  ovo: ['ovo'],
  dana: ['dana'],
  shopeepay: ['shopeepay'],
}

function normalizeBankText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function matchWallet(state: HouseholdState, bankLabel: string): HouseholdState['wallets'][number] | undefined {
  const label = normalizeBankText(bankLabel)
  if (!label) return undefined
  for (const wallet of state.wallets) {
    const name = normalizeBankText(wallet.name)
    if (!name) continue
    if (label.includes(name) || name.includes(label)) return wallet
    for (const [canonical, aliases] of Object.entries(BANK_ALIASES)) {
      const labelHit = label.includes(canonical) || aliases.some(alias => label.includes(alias))
      const nameHit = name.includes(canonical) || aliases.some(alias => name.includes(alias))
      if (labelHit && nameHit) return wallet
    }
  }
  return undefined
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
  const { nameForPerson, currentProfile } = useAccount()
  const [view, setView] = useState<'chat' | 'settings'>('chat')
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages)
  const [input, setInput] = useState('')
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [applyingId, setApplyingId] = useState<string | null>(null)
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
  const fileInputRef = useRef<HTMLInputElement>(null)
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
    // Jalur catat pengeluaran dari teks bebas: kalimat perintah mencatat
    // (mis. "Catat isi bensin 40rb") dibuatkan kartu konfirmasi yang sama
    // persis seperti hasil scan struk/QRIS — tidak ada data yang berubah
    // sebelum pengguna menekan Catat pengeluaran di kartu itu.
    const parsedExpense = parseExpenseText(question, { categoryKeys: EXPENSE_CATEGORY_KEYS, walletNames: store.state.wallets.map(wallet => wallet.name) })
    if (parsedExpense) {
      if (!store.state.wallets.length) {
        setMessages([...history, { id: makeId(), role: 'assistant', text: 'Kalimatnya terbaca sebagai pengeluaran, tapi belum ada dompet di aplikasi jadi belum bisa dicatat. Tambahkan dompet dulu di tab Keuangan.' }])
        return
      }
      const wallet = (parsedExpense.walletHint ? store.state.wallets.find(item => item.name === parsedExpense.walletHint) : undefined) ?? store.state.wallets[0]
      setMessages([...history, {
        id: makeId(),
        role: 'assistant',
        text: 'Siap, kubuatkan drafnya. Periksa kartunya — pengeluaran baru tercatat setelah kamu menekan Catat pengeluaran.',
        expenseCard: { merchant: parsedExpense.title, total: parsedExpense.amount, walletId: wallet.id, category: parsedExpense.categoryKey, status: 'pending' },
      }])
      return
    }
    // Ada kata "catat" tapi nominalnya tidak terurai — tangani lokal dan
    // minta nominalnya disebut; jangan diteruskan ke mode AI yang akan
    // menolak mencatat lewat teks.
    if (hasCatatTrigger(question)) {
      setMessages([...history, { id: makeId(), role: 'assistant', text: 'Siap mencatat — sebutkan juga nominalnya ya, contohnya: "Catat isi bensin 40rb" atau "Catat makan siang Rp35.000".' }])
      return
    }
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

  // Perkecil screenshot sebelum dikirim (maks 1280px, JPEG) supaya unggahan
  // ringan dan cukup terbaca model. Gagal memproses → pakai berkas apa adanya.
  const handleImageFile = async (file: File) => {
    try {
      const bitmap = await createImageBitmap(file)
      const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height))
      if (scale >= 1 && file.size < 900000) {
        setPendingImage(await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(new Error('read failed'))
          reader.readAsDataURL(file)
        }))
        return
      }
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('canvas unavailable')
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      setPendingImage(canvas.toDataURL('image/jpeg', 0.82))
    } catch {
      try {
        const raw = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(new Error('read failed'))
          reader.readAsDataURL(file)
        })
        setPendingImage(raw)
      } catch { /* Berkas tidak bisa dibaca — abaikan, pengguna bisa mencoba lagi. */ }
    }
  }

  const sendScreenshot = async () => {
    const image = pendingImage
    if (!image || sending) return
    setPendingImage(null)
    const caption = input.trim() || 'Screenshot'
    setInput('')
    const userMessage: ChatMessage = { id: makeId(), role: 'user', text: caption, image }
    const history = [...messages, userMessage]
    setMessages(history)
    if (!settings.apiKey.trim()) {
      setMessages([...history, { id: makeId(), role: 'assistant', text: 'Membaca screenshot butuh mode AI. Aktifkan dulu lewat ikon pengaturan di atas panel ini (isi Base URL, model, dan API key), lalu kirim lagi gambarnya.' }])
      return
    }
    setSending(true)
    try {
      const reading = await analyzeScreenshot(settings, image)
      if (!store.state.wallets.length) {
        setMessages([...history, { id: makeId(), role: 'assistant', text: 'Gambarnya terbaca, tapi belum ada dompet di aplikasi jadi belum bisa diterapkan. Tambahkan dompet dulu di tab Keuangan.' }])
        return
      }
      if (reading.type === 'balance') {
        const wallet = matchWallet(store.state, reading.bank) ?? store.state.wallets[0]
        const cardMessage: ChatMessage = {
          id: makeId(),
          role: 'assistant',
          text: 'Saldo dari screenshot terbaca. Periksa kartunya — saldo baru diterapkan setelah kamu menekan Samakan saldo.',
          balanceCard: { walletId: wallet.id, bankLabel: reading.bank, readBalance: reading.balance, status: 'pending' },
        }
        setMessages([...history, cardMessage])
        return
      }
      const wallet = matchWallet(store.state, reading.bank) ?? store.state.wallets[0]
      const cardMessage: ChatMessage = {
        id: makeId(),
        role: 'assistant',
        text: 'Pengeluaran dari gambar terbaca. Periksa kartunya — pengeluaran baru tercatat setelah kamu menekan Catat pengeluaran.',
        expenseCard: { merchant: reading.merchant || 'Pengeluaran', total: reading.total, walletId: wallet.id, category: reading.category, status: 'pending' },
      }
      setMessages([...history, cardMessage])
    } catch (error) {
      const isAbort = typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError'
      const text = error instanceof LlmHttpError
        ? llmErrorMessage(error.status, error.detail)
        : isAbort ? FALLBACK_TIMEOUT
        : error instanceof Error && error.message === 'unreadable'
          ? 'Maaf, gambar itu tidak terbaca jelas sebagai layar saldo maupun struk/bukti QRIS, jadi tidak ada data yang diubah. Coba gambar yang menampilkan saldo utama atau total bayar dengan jelas (tidak buram/terpotong), lalu kirim lagi.'
          : FALLBACK_ERROR
      setMessages([...history, { id: makeId(), role: 'assistant', text }])
    } finally {
      setSending(false)
    }
  }

  const updateCard = (messageId: string, patch: Partial<BalanceCard>) => {
    setMessages(current => current.map(message => message.balanceCard && message.id === messageId
      ? { ...message, balanceCard: { ...message.balanceCard, ...patch } }
      : message))
  }

  const applyBalanceCard = async (message: ChatMessage) => {
    const card = message.balanceCard
    if (!card || card.status !== 'pending' || applyingId) return
    const wallet = store.state.wallets.find(item => item.id === card.walletId)
    if (!wallet) return
    const current = walletBalance(wallet, store.state.transactions)
    const diff = card.readBalance - current
    if (diff === 0) {
      updateCard(message.id, { status: 'applied', appliedBalance: current })
      return
    }
    setApplyingId(message.id)
    const entry: Transaction = {
      id: makeId(),
      kind: diff > 0 ? 'income' : 'expense',
      title: 'Penyesuaian saldo',
      amount: Math.abs(diff),
      walletId: wallet.id,
      category: diff > 0 ? 'pemasukan' : 'penyesuaian',
      pocket: 'household',
      recordedBy: currentProfile.role,
      recordedByUserId: currentProfile.id,
      date: TODAY,
    }
    const error = await store.saveTransaction(entry)
    setApplyingId(null)
    if (error) {
      setMessages(current => [...current, { id: makeId(), role: 'assistant', text: `Penyamaan saldo belum berhasil: ${error}` }])
      return
    }
    updateCard(message.id, { status: 'applied', appliedBalance: card.readBalance })
    setMessages(current => [...current, {
      id: makeId(),
      role: 'assistant',
      text: `Saldo ${wallet.name} sudah disamakan ke ${money(card.readBalance)} (penyesuaian ${diff > 0 ? '+' : '−'}${money(Math.abs(diff))} tercatat sebagai "Penyesuaian saldo").`,
    }])
  }

  const updateExpenseCard = (messageId: string, patch: Partial<ExpenseCard>) => {
    setMessages(current => current.map(message => message.expenseCard && message.id === messageId
      ? { ...message, expenseCard: { ...message.expenseCard, ...patch } }
      : message))
  }

  const applyExpenseCard = async (message: ChatMessage) => {
    const card = message.expenseCard
    if (!card || card.status !== 'pending' || applyingId) return
    const wallet = store.state.wallets.find(item => item.id === card.walletId)
    if (!wallet || !isValidMoneyAmount(card.total)) return
    setApplyingId(message.id)
    const title = card.merchant.trim() || 'Pengeluaran'
    const entry: Transaction = {
      id: makeId(),
      kind: 'expense',
      title,
      amount: card.total,
      walletId: wallet.id,
      category: card.category,
      pocket: 'household',
      recordedBy: currentProfile.role,
      recordedByUserId: currentProfile.id,
      date: TODAY,
    }
    const error = await store.saveTransaction(entry)
    setApplyingId(null)
    if (error) {
      setMessages(current => [...current, { id: makeId(), role: 'assistant', text: `Pengeluaran belum berhasil dicatat: ${error}` }])
      return
    }
    updateExpenseCard(message.id, { status: 'applied', merchant: title })
    setMessages(current => [...current, {
      id: makeId(),
      role: 'assistant',
      text: `Pengeluaran tercatat: ${title} ${money(card.total)} dari dompet ${wallet.name}. Nominal ini ikut memotong anggaran belanja hari ini.`,
    }])
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (pendingImage) { void sendScreenshot(); return }
    void send(input)
  }

  const renderBalanceCard = (message: ChatMessage) => {
    const card = message.balanceCard
    if (!card) return null
    const wallet = store.state.wallets.find(item => item.id === card.walletId)
    const current = wallet ? walletBalance(wallet, store.state.transactions) : 0
    const diff = card.readBalance - current
    return <div className="agent-balance">
      <p className="agent-balance-head">Penyamaan saldo{card.bankLabel ? ` · terbaca: ${card.bankLabel}` : ''}</p>
      <div className="agent-balance-row"><span>Dompet</span>{card.status === 'pending'
        ? <select aria-label="Pilih dompet untuk disamakan" value={card.walletId} onChange={event => updateCard(message.id, { walletId: event.target.value })}>{store.state.wallets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        : <strong>{wallet?.name ?? '—'}</strong>}</div>
      <div className="agent-balance-row"><span>Saldo terbaca</span><strong>{money(card.readBalance)}</strong></div>
      <div className="agent-balance-row"><span>Saldo di aplikasi</span><strong>{money(current)}</strong></div>
      <div className="agent-balance-row"><span>Selisih</span><strong>{diff === 0 ? 'Rp0' : `${diff > 0 ? '+' : '−'}${money(Math.abs(diff))}`}</strong></div>
      {card.status === 'pending' && (diff === 0
        ? <>
            <p className="agent-balance-note">Saldo sudah sama persis — tidak ada yang perlu diubah.</p>
            <div className="agent-balance-actions"><button type="button" className="agent-balance-cancel" onClick={() => updateCard(message.id, { status: 'applied', appliedBalance: current })}>Tandai selesai</button></div>
          </>
        : <div className="agent-balance-actions">
            <button type="button" className="agent-balance-apply" disabled={applyingId === message.id} onClick={() => void applyBalanceCard(message)}>{applyingId === message.id ? 'Menerapkan…' : 'Samakan saldo'}</button>
            <button type="button" className="agent-balance-cancel" disabled={applyingId === message.id} onClick={() => updateCard(message.id, { status: 'cancelled' })}>Batal</button>
          </div>)}
      {card.status === 'applied' && <p className="agent-balance-note">Sudah diterapkan — saldo sekarang {money(card.appliedBalance ?? card.readBalance)}.</p>}
      {card.status === 'cancelled' && <p className="agent-balance-note">Dibatalkan — tidak ada perubahan data.</p>}
    </div>
  }

  const renderExpenseCard = (message: ChatMessage) => {
    const card = message.expenseCard
    if (!card) return null
    const wallet = store.state.wallets.find(item => item.id === card.walletId)
    return <div className="agent-balance">
      <p className="agent-balance-head">Catat pengeluaran dari gambar</p>
      <div className="agent-balance-row"><span>Judul</span>{card.status === 'pending'
        ? <input type="text" aria-label="Judul pengeluaran" maxLength={100} value={card.merchant} onChange={event => updateExpenseCard(message.id, { merchant: event.target.value })} />
        : <strong>{card.merchant}</strong>}</div>
      <div className="agent-balance-row"><span>Total (Rp)</span>{card.status === 'pending'
        ? <input type="text" inputMode="numeric" aria-label="Total pengeluaran dalam rupiah" value={card.total ? String(card.total) : ''} onChange={event => updateExpenseCard(message.id, { total: Number(event.target.value.replace(/[^\d]/g, '')) || 0 })} />
        : <strong>{money(card.total)}</strong>}</div>
      <div className="agent-balance-row"><span>Kategori</span>{card.status === 'pending'
        ? <select aria-label="Kategori pengeluaran" value={card.category} onChange={event => updateExpenseCard(message.id, { category: event.target.value })}>{EXPENSE_CATEGORY_KEYS.map(key => <option key={key} value={key}>{EXPENSE_CATEGORY_LABELS[key]}</option>)}</select>
        : <strong>{EXPENSE_CATEGORY_LABELS[card.category] ?? card.category}</strong>}</div>
      <div className="agent-balance-row"><span>Dompet</span>{card.status === 'pending'
        ? <select aria-label="Dompet sumber pengeluaran" value={card.walletId} onChange={event => updateExpenseCard(message.id, { walletId: event.target.value })}>{store.state.wallets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        : <strong>{wallet?.name ?? '—'}</strong>}</div>
      {card.status === 'pending' && <div className="agent-balance-actions">
        <button type="button" className="agent-balance-apply" disabled={applyingId === message.id || !isValidMoneyAmount(card.total)} onClick={() => void applyExpenseCard(message)}>{applyingId === message.id ? 'Mencatat…' : 'Catat pengeluaran'}</button>
        <button type="button" className="agent-balance-cancel" disabled={applyingId === message.id} onClick={() => updateExpenseCard(message.id, { status: 'cancelled' })}>Batal</button>
      </div>}
      {card.status === 'applied' && <p className="agent-balance-note">Sudah dicatat sebagai pengeluaran hari ini.</p>}
      {card.status === 'cancelled' && <p className="agent-balance-note">Dibatalkan — tidak ada perubahan data.</p>}
    </div>
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
                  <div className="agent-msg assistant">{renderRichText(message.text)}{message.balanceCard && renderBalanceCard(message)}{message.expenseCard && renderExpenseCard(message)}</div>
                </div>
              : <div key={message.id} className="agent-msg user">{message.image && <img className="agent-msg-image" src={message.image} alt="Gambar yang dikirim ke Asisten" />}{message.text}</div>)}
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
            <button type="button" className="agent-chip agent-chip-action" disabled={sending} onClick={() => fileInputRef.current?.click()}><ImagePlus size={14} /> Scan saldo / struk / QRIS</button>
            {QUICK_QUESTIONS.map(question => <button key={question} type="button" className="agent-chip" disabled={sending} onClick={() => void send(question)}>{question}</button>)}
          </div>
          {pendingImage && <div className="agent-pending-image">
            <img src={pendingImage} alt="Screenshot yang akan dikirim" />
            <span>Gambar akan dibaca otomatis (saldo / struk / QRIS) — tekan kirim.</span>
            <button type="button" aria-label="Hapus lampiran screenshot" onClick={() => setPendingImage(null)}><X size={15} /></button>
          </div>}
          <form className="agent-composer" onSubmit={submit}>
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void handleImageFile(file) }} />
            <button type="button" className="agent-attach" aria-label="Lampirkan screenshot, bukti QRIS, atau foto struk" disabled={sending} onClick={() => fileInputRef.current?.click()}><ImagePlus size={20} /></button>
            <label className="sr-only" htmlFor="agent-input">Tulis pertanyaan untuk Asisten</label>
            <input id="agent-input" type="text" autoComplete="off" maxLength={500} placeholder="Tanya tagihan, cicilan, saldo…" value={input} onChange={event => setInput(event.target.value)} />
            <button type="submit" className="agent-send" aria-label="Kirim pertanyaan" disabled={sending || (!input.trim() && !pendingImage)}><Send size={19} /></button>
          </form>
        </>}
      </div>
    </dialog>}
  </>
}
