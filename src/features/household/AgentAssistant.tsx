import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Bot, Send, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react'
import { useHousehold } from './context'
import { useAccount } from '../account/context'
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

const SETTINGS_KEY = 'myhome.agent.settings'
const MESSAGES_KEY = 'myhome.agent.messages'
const DEFAULT_SETTINGS: AgentSettings = {
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  model: 'deepseek-ai/deepseek-v4.1-flash',
  apiKey: '',
}

const QUICK_QUESTIONS = ['Ringkasan hari ini', 'Tagihan terdekat apa?', 'Sisa cicilan berapa?', 'Belanja apa yang belum dibeli?'] as const

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Halo! Saya Asisten Myhome. Saya bisa menjawab dari data rumah kalian — misalnya tagihan terdekat, sisa cicilan dan piutang, saldo dompet, agenda hari ini, target tabungan, dan daftar belanja.\n\nTap salah satu pertanyaan cepat di bawah, atau tulis pertanyaanmu sendiri.',
}

const FALLBACK_NO_KEY = 'Maaf, pertanyaan itu belum bisa saya jawab dari data dasar Myhome. Untuk pertanyaan bebas, aktifkan mode AI dulu: tap ikon pengaturan di atas panel ini, lalu isi API key dari penyedia model (misalnya NVIDIA). API key hanya tersimpan di perangkat ini.\n\nSementara itu, saya bisa menjawab soal: ringkasan hari ini, tagihan, cicilan/utang/piutang, saldo dompet, agenda, impian, dan belanja.'

const FALLBACK_ERROR = 'Maaf, mode AI sedang tidak bisa dihubungi. Periksa lagi Base URL, nama model, dan API key di Pengaturan Asisten, lalu coba lagi — beberapa endpoint juga tidak mengizinkan akses langsung dari browser (CORS).\n\nSaya tetap bisa menjawab pertanyaan dasar soal tagihan, cicilan, saldo, agenda, dan belanja tanpa mode AI.'

function loadSettings(): AgentSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<AgentSettings>
    return {
      baseUrl: typeof parsed.baseUrl === 'string' && parsed.baseUrl.trim() ? parsed.baseUrl.trim() : DEFAULT_SETTINGS.baseUrl,
      model: typeof parsed.model === 'string' && parsed.model.trim() ? parsed.model.trim() : DEFAULT_SETTINGS.model,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
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
    if (receivables.length) sections.push(`Piutang (uang yang dipinjam orang lain):\n${receivables.map(describe).join('\n')}\nTotal piutang belum kembali: ${money(receivables.reduce((sum, debt) => sum + debt.remainingAmount, 0))}`)
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

async function askLLM(settings: AgentSettings, state: HouseholdState, history: ChatMessage[], question: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45000)
  try {
    const response = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({
        model: settings.model,
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
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json() as { choices?: { message?: { content?: string } }[] }
    const text = data.choices?.[0]?.message?.content?.trim()
    if (!text) throw new Error('Jawaban kosong')
    return text
  } finally {
    clearTimeout(timer)
  }
}

export function AgentAssistant() {
  const store = useHousehold()
  const { nameForPerson } = useAccount()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'chat' | 'settings'>('chat')
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [settings, setSettings] = useState<AgentSettings>(loadSettings)
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl)
  const [model, setModel] = useState(settings.model)
  const [apiKey, setApiKey] = useState(settings.apiKey)
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
  }, [messages, sending, open, view])

  const close = () => { setOpen(false); setView('chat') }

  const openSettings = () => {
    setBaseUrl(settings.baseUrl)
    setModel(settings.model)
    setApiKey(settings.apiKey)
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
    try {
      const reply = await askLLM(settings, store.state, history, question)
      setMessages([...history, { id: makeId(), role: 'assistant', text: reply }])
    } catch {
      setMessages([...history, { id: makeId(), role: 'assistant', text: FALLBACK_ERROR }])
    } finally {
      setSending(false)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void send(input)
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
    {!open && <button type="button" className="agent-fab" onClick={() => setOpen(true)} aria-label="Buka Asisten Myhome"><Sparkles size={21} /><span>Asisten</span></button>}
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
            <input id="agent-model" type="text" autoComplete="off" placeholder="deepseek-ai/deepseek-v4.1-flash" value={model} onChange={event => setModel(event.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="agent-api-key">API key</label>
            <input id="agent-api-key" type="password" autoComplete="off" placeholder="Tempel API key penyedia model" value={apiKey} onChange={event => setApiKey(event.target.value)} />
            <small>API key hanya tersimpan di perangkat ini (localStorage) — tidak dikirim ke Supabase atau server Myhome. Contoh penyedia: NVIDIA (build.nvidia.com) dengan Base URL & model bawaan di atas.</small>
          </div>
          <p className="form-hint">Tanpa API key, Asisten tetap bisa menjawab pertanyaan dasar dari data rumah: ringkasan hari ini, tagihan, cicilan & piutang, saldo dompet, agenda, impian, dan belanja.</p>
          <button type="submit" className="primary-button" style={{ width: '100%' }}>Simpan pengaturan</button>
          <button type="button" className="danger-text" onClick={clearMessages}><Trash2 size={14} /> Hapus riwayat obrolan</button>
        </form> : <>
          <div className="agent-messages" ref={listRef} aria-live="polite">
            {messages.map(message => <div key={message.id} className={`agent-msg ${message.role}`}>{message.text}</div>)}
            {sending && <div className="agent-msg assistant agent-typing">Sedang menyusun jawaban…</div>}
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
