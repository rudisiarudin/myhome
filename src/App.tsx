import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { CalendarDays, Check, ChevronRight, Copy, Heart, Home, House, Moon, Plus, RefreshCw, ShoppingBag, Sparkles, Sun, Trash2, Utensils, Wallet } from 'lucide-react'
import { AppLogoIcon } from './components/AppLogo'
import type { FoodIdea, ShoppingItem, ScheduleEvent } from './types'
import { useHousehold } from './features/household/context'
import { formatDate, memoryCategories, spentIn, TODAY, makeId } from './features/household/model'
import type { JournalMemory } from './features/household/model'
import { useAccount } from './features/account/context'
import { AccountMenu, MemberAvatars as Avatars } from './features/account/ProfileAvatar'
import { householdShortNames, shortName } from './features/account/display'
import { BudgetWorkspace, CalendarWorkspace, GoalsWorkspace, TransactionList } from './features/household/Workspace'
import { HouseWorkspace } from './features/household/HouseWorkspace'
import { DebtReportsWorkspace } from './features/household/DebtReportsWorkspace'
import { HouseholdDialogs } from './features/household/Dialogs'
import { AgentAssistant } from './features/household/AgentAssistant'
import './App.css'
import './features/household/Workspace.css'
import { useTheme } from './theme'
import { useConnection } from './features/connection/ConnectionContext'

type Tab = 'today' | 'budget' | 'calendar' | 'house' | 'us'
const money = (value: number) => 'Rp' + value.toLocaleString('id-ID')

function Waves() {
  return <svg className="waves" viewBox="0 0 560 240" fill="none" preserveAspectRatio="none" aria-hidden="true">
    {Array.from({ length: 22 }, (_, i) => <path key={i} d={`M-60 ${160 + i * 5} C 80 ${210 + i * 2}, 130 ${-110 + i * 10}, 270 ${10 + i * 7} S 420 ${240 + i * 2}, 620 ${70 + i * 6}`} stroke="currentColor" strokeWidth="0.7" />)}
  </svg>
}

function SectionHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <div className="section-heading"><h2>{title}</h2>{action && <button className="text-button" onClick={onAction}>{action}<ChevronRight size={15} /></button>}</div>
}

function Progress({ value, label }: { value: number; label: string }) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div className={`progress ${value > 100 ? 'over-budget' : ''}`} role="progressbar" aria-label={label} aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ transform: `scaleX(${clamped / 100})` }} />
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="empty-state"><Check size={24} /><p>{children}</p></div>
}

function Agenda({ items, compact = false }: { items: ScheduleEvent[]; compact?: boolean }) {
  const { nameForPerson: person } = useAccount()
  return <div className={`agenda ${compact ? 'agenda-compact' : ''}`}>{items.length === 0 ? <Empty>Belum ada agenda pada tanggal ini.</Empty> : items.map((item, index) => <article className={`agenda-item ${index === 0 ? 'agenda-featured' : ''}`} key={item.id}>
    <span className="timeline-dot" aria-hidden="true" />
    <div className="agenda-card">
      {index === 0 && <Waves />}
      <div className="row-between"><h3>{item.title}</h3><time>{item.time}</time></div>
      <p>{item.assignee === 'berdua' ? 'Waktu untuk kalian berdua' : `Agenda ${person(item.assignee)}`}</p>
      <div className="agenda-footer"><Avatars person={item.assignee} /><span>{person(item.assignee)}</span></div>
    </div>
  </article>)}</div>
}

function IdeaList({ kind }: { kind: 'food' | 'date' }) {
  const store = useHousehold()
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const label = kind === 'food' ? 'Pilihan menu' : 'Ide kencan'
  const items = kind === 'food' ? store.state.foodIdeas : store.state.dateIdeas
  return <section><SectionHeading title={label} /><form className="workspace-form" onSubmit={async event => {
    event.preventDefault()
    const error = await store.saveIdea(kind, title.trim())
    setError(error ?? '')
    if (!error) setTitle('')
  }}><label className="form-field">{label} baru<input required maxLength={150} value={title} onChange={event => setTitle(event.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="secondary-button" disabled={store.pending} type="submit"><Plus size={16} />Tambah {label.toLowerCase()}</button></form>
    <div className="house-records">{items.map(item => <div className="row-between house-record" key={item.id}><span>{item.title}</span><button className="icon-button" aria-label={`Hapus ${item.title}`} onClick={() => store.setEditor({ type: 'confirm', title: 'Hapus pilihan?', description: `“${item.title}” dihapus dari daftar pilihan.`, confirm: () => store.deleteIdea(kind, item.id) })}><Trash2 size={16} /></button></div>)}</div>
  </section>
}

function CouplePlacesWorkspace() {
  const store = useHousehold()
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [category, setCategory] = useState<'kopi' | 'makan' | 'jalan' | 'liburan'>('kopi')
  const [budget, setBudget] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const msg = await store.savePlace({
      id: makeId(),
      title: title.trim(),
      location: location.trim(),
      category,
      estBudget: budget ? Number(budget) : undefined,
      notes: notes.trim()
    })
    setError(msg ?? '')
    if (!msg) {
      setTitle('')
      setLocation('')
      setBudget('')
      setNotes('')
    }
  }

  return (
    <section>
      <SectionHeading title="Wishlist Kencan & Tempat Impian" />
      <p className="muted small" style={{ marginTop: '-8px', marginBottom: '18px' }}>
        Simpan kafe, resto, atau tempat yang ingin dikunjungi berdua saat akhir pekan.
      </p>

      {/* Form Input Tempat Baru */}
      <form onSubmit={handleAdd} className="workspace-form house-entry-form" style={{ marginBottom: '24px' }}>
        <div className="form-field">
          <label htmlFor="place-title">Nama Tempat / Ide Kencan</label>
          <input
            id="place-title"
            required
            maxLength={100}
            placeholder="Misalnya, Kopi Toko Djawa, Museum Date..."
            value={title}
            onChange={e => { setTitle(e.target.value); setError('') }}
          />
        </div>

        <div className="form-columns">
          <div className="form-field">
            <label htmlFor="place-loc">Lokasi / Area</label>
            <input
              id="place-loc"
              maxLength={80}
              placeholder="Misalnya, Blok M, Senopati..."
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="place-cat">Kategori</label>
            <select
              id="place-cat"
              value={category}
              onChange={e => setCategory(e.target.value as typeof category)}
            >
              <option value="kopi">Ngopi Santai</option>
              <option value="makan">Kuliner / Resto</option>
              <option value="jalan">Jalan-jalan / Rekreasi</option>
              <option value="liburan">Staycation / Liburan</option>
            </select>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="place-budget">Estimasi Budget (Opsional)</label>
          <input
            id="place-budget"
             type="number"
             min="0"
             max="999999999999"
             step="1"
            placeholder="100000"
            value={budget}
            onChange={e => setBudget(e.target.value)}
          />
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" disabled={store.pending} className="primary-button" style={{ width: '100%' }}>
          <Plus size={16} /> Simpan ke Wishlist
        </button>
      </form>

      {/* List Tempat Tersimpan */}
      <div className="house-records">
        {store.state.places.length ? store.state.places.map(place => (
          <article className="house-record" key={place.id} style={{ padding: '16px 20px', borderRadius: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="badge" style={{ fontSize: '10px', textTransform: 'uppercase', marginBottom: '6px', display: 'inline-block' }}>
                  {place.category}
                </span>
                <h3 style={{ fontSize: '14px', fontWeight: 650, margin: '2px 0 4px' }}>{place.title}</h3>
                {place.location && <p className="small muted" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>📍 {place.location}</p>}
                {place.estBudget && <p className="small" style={{ fontWeight: 600, color: 'var(--ink)', marginTop: '4px' }}>Perkiraan: {money(place.estBudget)}</p>}
              </div>
              <button
                type="button"
                className="text-button"
                aria-label={`Hapus ${place.title}`}
                onClick={() => store.setEditor({ type: 'confirm', title: 'Hapus tempat?', description: `“${place.title}” dihapus dari wishlist.`, confirm: () => store.deletePlace(place.id) })}
                style={{ color: 'var(--muted)' }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </article>
        )) : <Empty>Belum ada tempat tersimpan.<br />Tulis kafe atau destinasi yang ingin kalian datangi.</Empty>}
      </div>
    </section>
  )
}

function CoupleJournalWorkspace() {
  const store = useHousehold()
  const { currentProfile, nameForPerson: personName } = useAccount()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(TODAY)
  const [category, setCategory] = useState<JournalMemory['category']>('kencan')
  const [recordedBy, setRecordedBy] = useState<JournalMemory['recordedBy']>(currentProfile.role)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const memories = [...store.state.memories].sort((a, b) => b.date.localeCompare(a.date))
  const categoryLabel = (value: JournalMemory['category']) => memoryCategories.find(([key]) => key === value)?.[1] ?? value

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const msg = await store.saveMemory({
      id: makeId(),
      title: title.trim(),
      date,
      note: note.trim(),
      category,
      recordedBy
    })
    setError(msg ?? '')
    if (!msg) {
      setTitle('')
      setNote('')
      setDate(TODAY)
    }
  }

  return (
    <section>
      <SectionHeading title="Jurnal Berdua" />
      <p className="muted small" style={{ marginTop: '-8px', marginBottom: '18px' }}>
        Catat momen-momen kecil dan besar yang sudah kalian lewati berdua, supaya cerita rumah ini tidak terlupa.
      </p>

      {/* Form Catat Momen Baru */}
      <form onSubmit={handleAdd} className="workspace-form house-entry-form" style={{ marginBottom: '24px' }}>
        <div className="form-field">
          <label htmlFor="journal-title">Judul momen</label>
          <input
            id="journal-title"
            required
            maxLength={150}
            placeholder="Misalnya, Dinner anniversary, Hari pertama di rumah baru..."
            value={title}
            onChange={e => { setTitle(e.target.value); setError('') }}
          />
        </div>

        <div className="form-columns">
          <div className="form-field">
            <label htmlFor="journal-date">Tanggal</label>
            <input
              id="journal-date"
              type="date"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="journal-category">Kategori</label>
            <select
              id="journal-category"
              value={category}
              onChange={e => setCategory(e.target.value as JournalMemory['category'])}
            >
              {memoryCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="journal-by">Dicatat oleh</label>
          <select
            id="journal-by"
            value={recordedBy}
            onChange={e => setRecordedBy(e.target.value as JournalMemory['recordedBy'])}
          >
            <option value="suami">{personName('suami')}</option>
            <option value="istri">{personName('istri')}</option>
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="journal-note">Cerita momen ini (opsional)</label>
          <textarea
            id="journal-note"
            rows={3}
            placeholder="Tulis sedikit ceritanya di sini..."
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" disabled={store.pending} className="primary-button" style={{ width: '100%' }}>
          <Plus size={16} /> Catat momen
        </button>
      </form>

      {/* Timeline Momen Tersimpan */}
      {memories.length ? <div className="journal-list">{memories.map(memory => (
        <article className="journal-item" key={memory.id}>
          <span className="journal-dot" aria-hidden="true" />
          <div className="journal-card">
            <div className="row-between">
              <h3>{memory.title}</h3>
              <button
                type="button"
                className="icon-button delete-button"
                aria-label={`Hapus ${memory.title}`}
                onClick={() => store.setEditor({ type: 'confirm', title: 'Hapus momen?', description: `“${memory.title}” dihapus dari Jurnal Berdua.`, confirm: () => store.deleteMemory(memory.id) })}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <p className="journal-meta">
              <time>{formatDate(memory.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</time>
              <span className="journal-category">{categoryLabel(memory.category)}</span>
            </p>
            {memory.note && <p className="journal-note">{memory.note}</p>}
            <p className="small muted journal-by">Dicatat oleh {personName(memory.recordedBy)}</p>
          </div>
        </article>
      ))}</div> : <Empty>Belum ada momen yang dicatat.<br />Tulis cerita pertama kalian di jurnal ini.</Empty>}
    </section>
  )
}

export default function App() {
  const store = useHousehold()
  const { state, setEditor, notice, setNotice } = store
  const connection = useConnection()
  const { currentProfile, members, nameForPerson: person } = useAccount()
  const personName = person
  const bills = state.bills
  const numberShortcuts = bills.filter(bill => bill.customerNumber.trim()).slice(0, 2)
  const schedule = state.events
  const [theme, setTheme] = useTheme()
  useEffect(() => { document.documentElement.dataset.persona = currentProfile.role }, [currentProfile.role])
  const [activeTab, setActiveTab] = useState<Tab>('today')
  const [budgetSubTab, setBudgetSubTab] = useState<'budget' | 'debts'>('budget')
  const [coupleSubTab, setCoupleSubTab] = useState<'decision' | 'shopping' | 'goals' | 'places' | 'journal'>('decision')
  const [houseSubTab, setHouseSubTab] = useState<'bills' | 'vault' | 'contacts' | 'chores'>('bills')
  const shoppingList = state.shopping
  const [newShoppingItem, setNewShoppingItem] = useState('')
  const [pickedFood, setPickedFood] = useState<FoodIdea | null>(null)
  const [pickedDate, setPickedDate] = useState<string | null>(null)
  const [spinning, setSpinning] = useState<'food' | 'date' | null>(null)
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const todaySpent = spentIn(state.transactions, TODAY, 'household')
  const dailyBudget = state.budget.daily
  const remaining = dailyBudget - todaySpent
  const pendingShopping = shoppingList.filter(item => !item.isBought)

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 4200)
    return () => clearTimeout(timer)
  }, [notice, setNotice])

  useEffect(() => () => { if (spinTimer.current) clearTimeout(spinTimer.current) }, [])

  const navigate = (tab: Tab) => {
    setActiveTab(tab)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const openCouple = (tab: typeof coupleSubTab) => {
    setCoupleSubTab(tab)
    navigate('us')
  }

  const toggleShopping = (id: string) => { const item = shoppingList.find(item => item.id === id); if (item) void store.saveShopping({ ...item, isBought: !item.isBought }) }

  const deleteShopping = (id: string) => {
    const item = shoppingList.find(item => item.id === id)
    setEditor({ type: 'confirm', title: 'Hapus barang belanja?', description: `“${item?.title ?? 'Barang'}” dihapus dari daftar.`, confirm: () => store.deleteShopping(id) })
  }

  const addShopping = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!newShoppingItem.trim()) return
    const item: ShoppingItem = { id: makeId(), title: newShoppingItem.trim(), isBought: false, addedBy: currentProfile.role }
    const error = await store.saveShopping(item)
    if (!error) setNewShoppingItem('')
    else setNotice(error)
  }

  const copyNumber = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setNotice('Nomor pelanggan berhasil disalin.')
    } catch {
      setNotice('Tidak bisa menyalin. Pilih dan salin nomor pelanggan secara manual.')
    }
  }

  const spin = (kind: 'food' | 'date') => {
    if (spinning) return
    if (!(kind === 'food' ? state.foodIdeas.length : state.dateIdeas.length)) { setNotice('Tambahkan pilihan terlebih dahulu di bawah.'); return }
    setSpinning(kind)
    spinTimer.current = setTimeout(() => {
      if (kind === 'food') setPickedFood(state.foodIdeas[Math.floor(Math.random() * state.foodIdeas.length)])
      else setPickedDate(state.dateIdeas[Math.floor(Math.random() * state.dateIdeas.length)].title)
      setSpinning(null)
    }, 700)
  }

  const shoppingRows = (items: ShoppingItem[], allowDelete = false) => <div className="shopping-list">{items.length === 0 ? <Empty>{allowDelete ? 'Daftar belanja masih kosong. Tambahkan barang di atas.' : 'Semua belanja sudah beres. Waktunya santai.'}</Empty> : items.map(item => <div className={`shopping-row ${item.isBought ? 'is-bought' : ''}`} key={item.id}>
    <label><input type="checkbox" checked={item.isBought} onChange={() => toggleShopping(item.id)} /><span className="checkbox-mark" aria-hidden="true">{item.isBought && <Check size={15} strokeWidth={3} />}</span><span className="shopping-copy">{item.title}{allowDelete && <small>Ditambahkan {person(item.addedBy)}</small>}</span></label>
    {allowDelete ? <button className="icon-button delete-button" aria-label={`Hapus ${item.title}`} onClick={() => deleteShopping(item.id)}><Trash2 size={17} /></button> : <span className="item-dot" aria-hidden="true" />}
  </div>)}</div>

  const tabs: { key: Tab; label: string; icon: typeof Home }[] = [
    { key: 'today', label: 'Hari ini', icon: Home },
    { key: 'budget', label: 'Keuangan', icon: Wallet },
    { key: 'calendar', label: 'Kalender', icon: CalendarDays },
    { key: 'house', label: 'Rumah', icon: House },
    { key: 'us', label: 'Berdua', icon: Heart },
  ]
  const titles: Record<Tab, string> = { today: 'Hari ini', budget: 'Keuangan', calendar: 'Kalender berdua', house: 'Urusan rumah', us: 'Ruang berdua' }
  const descriptions: Record<Tab, string> = { today: '', budget: 'Lebih tenang, kalau tahu ke mana uang pergi.', calendar: 'Selalu ada waktu untuk yang penting.', house: 'Hal-hal penting, tersimpan di satu tempat.', us: 'Rencana kecil untuk cerita berikutnya.' }

  return <div className="app-background">
    <a className="skip-link" href="#main-content">Langsung ke konten</a>
    <main className="app-shell" id="main-content">
      <header className="app-header">
        <a href="#main-content" className="wordmark" onClick={() => navigate('today')} aria-label="MyHome, kembali ke Hari ini">
          <AppLogoIcon size={22} className="logo-house" />
          myhome<span className="dot-green">.</span>
        </a>
        <div className="header-actions">
          {!store.isPreview && <button className="icon-button sync-refresh" aria-label="Muat ulang data" title="Refresh data" disabled={store.pending || store.refreshing} aria-busy={store.refreshing} onClick={() => void store.refresh()}><RefreshCw size={19} aria-hidden="true" /></button>}
          <button className="icon-button" aria-label="Buka Asisten" title="Asisten" onClick={() => setAssistantOpen(true)}><Sparkles size={20} aria-hidden="true" /></button>
          <button className="theme-toggle icon-button" aria-label={theme === 'light' ? 'Gunakan mode gelap' : 'Gunakan mode terang'} title={theme === 'light' ? 'Gunakan mode gelap' : 'Gunakan mode terang'} aria-pressed={theme === 'dark'} onClick={() => setTheme(value => value === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <AccountMenu />
        </div>
      </header>
      {store.isPreview ? <div className="workspace-preview"><span>Pratinjau interaktif · Data contoh</span><span>Tanpa database</span></div> : <><p className="workspace-household-name">{connection?.householdName ?? 'Rumah bersama'}</p><span className="sr-only" role="status">{store.pending ? 'Menyimpan perubahan…' : store.refreshing ? 'Memuat data…' : ''}</span></>}
      {store.refreshError && <div className="connection-warning" role="alert">{store.refreshError}<p>Muat ulang sebelum membuat perubahan berikutnya.</p></div>}

      {activeTab === 'today' ? <>
        <section className="greeting-card">
          <Waves />
          <div className="greeting-copy"><p>Hai, {shortName(currentProfile.name)}!</p><h1>Rumah kecil,<br />cerita kita.</h1><p className="greeting-date">{formatDate(TODAY, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
          <Avatars />
          <span className="greeting-signature"><Heart size={15} /> {householdShortNames(members)}</span>
        </section>

        <div className="home-layout">
          <div className="home-primary">
            <section className="allowance-summary" aria-label="Anggaran harian">
              <div className="row-between"><span className="muted">Sisa belanja hari ini</span><span className={`spend-status ${remaining < 0 ? 'over-budget' : ''}`}><span />{remaining < 0 ? 'Lewat anggaran' : 'Masih aman'}</span></div>
              <div className="allowance-number">{money(remaining)}<span> / {money(dailyBudget)}</span></div>
              <Progress value={todaySpent / dailyBudget * 100} label="Anggaran harian terpakai" />
              <div className="allowance-footer"><p className="small muted">Terpakai {money(todaySpent)} hari ini</p><button className="record-expense" onClick={() => setEditor({ type: 'transaction', kind: 'expense' })} aria-label="Catat pengeluaran"><Plus size={16} />Catat</button></div>
            </section>

            <section className="home-shortcuts">
              <SectionHeading title="Untuk berdua" action="Lihat semua" onAction={() => openCouple('decision')} />
              <div className="shortcut-grid">
                <button className="shortcut-card shortcut-dark" onClick={() => openCouple('decision')}>
                  <span className="shortcut-icon"><Utensils size={22} /></span><h3>Makan apa?</h3><p>{pickedFood?.title || 'Biar kami bantu pilih menu hari ini.'}</p><span className="round-arrow"><ChevronRight size={21} /></span>
                </button>
                <button className="shortcut-card shortcut-light" onClick={() => openCouple('shopping')}>
                  <span className="shortcut-icon"><ShoppingBag size={22} /></span><h3>Belanja rumah</h3><p>{pendingShopping.length ? `${pendingShopping.length} barang masih menunggu dibawa pulang.` : 'Semua barang sudah terbeli.'}</p><span className="round-arrow"><ChevronRight size={21} /></span>
                </button>
              </div>
            </section>

            <section className="shopping-preview">
              <SectionHeading title="Daftar belanja" action="Lihat semua" onAction={() => openCouple('shopping')} />
              {shoppingRows(shoppingList.slice(0, 3))}
            </section>
          </div>

          <div className="home-secondary">
            <section><SectionHeading title="Agenda hari ini" action="Kalender" onAction={() => navigate('calendar')} /><Agenda items={schedule.filter(item => item.date === TODAY && !item.isDone).sort((a, b) => a.time.localeCompare(b.time))} compact /></section>
            <section className="payment-preview"><SectionHeading title="Nomor penting" action="Lihat semua" onAction={() => { setHouseSubTab('bills'); navigate('house') }} />
              {numberShortcuts.length ? <div className="payment-grid">{numberShortcuts.map(bill => <button key={bill.id} className="payment-button" onClick={() => void copyNumber(bill.customerNumber.trim(), bill.id)} aria-label={`Salin nomor ${bill.title}`}><span><small>{bill.title}</small><strong>{bill.customerNumber.trim()}</strong></span>{copiedId === bill.id ? <Check size={18} /> : <Copy size={18} />}</button>)}</div> : <p className="workspace-note">Belum ada nomor pelanggan. Tambahkan nomor melalui Tagihan di menu Rumah.</p>}
            </section>
          </div>
          <section className="recent-expenses"><SectionHeading title="Transaksi terbaru" action="Lihat semua" onAction={() => navigate('budget')} /><TransactionList items={state.transactions.slice(0, 3)} editable={false} /></section>
        </div>
      </> : <div className="page-content">
        <div className="page-heading"><div><p className="page-date">{formatDate(TODAY, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h1>{titles[activeTab]}</h1><p className="muted page-description">{descriptions[activeTab]}</p></div><Avatars /></div>

        {activeTab === 'budget' && <>
          <div className="segmented-control" role="group" aria-label="Bagian keuangan">
            {([{ key: 'budget', label: 'Kas & Anggaran' }, { key: 'debts', label: 'KPR & Neraca' }] as const).map(tab => (
              <button key={tab.key} aria-pressed={budgetSubTab === tab.key} onClick={() => setBudgetSubTab(tab.key)}>{tab.label}</button>
            ))}
          </div>
          {budgetSubTab === 'budget' ? <BudgetWorkspace /> : <DebtReportsWorkspace />}
        </>}
        {activeTab === 'calendar' && <CalendarWorkspace />}

        {activeTab === 'house' && <>
          <div className="segmented-control" role="group" aria-label="Bagian rumah">{([{ key: 'bills', label: 'Tagihan' }, { key: 'vault', label: 'Dokumen' }, { key: 'contacts', label: 'Kontak' }, { key: 'chores', label: 'Tugas Rumah' }] as const).map(tab => <button key={tab.key} aria-pressed={houseSubTab === tab.key} onClick={() => setHouseSubTab(tab.key)}>{tab.label}</button>)}</div>
          <HouseWorkspace tab={houseSubTab} copiedId={copiedId} onCopy={(value, id) => void copyNumber(value, id)} role={currentProfile.role} />
        </>}

        {activeTab === 'us' && <>
          <div className="segmented-control" role="group" aria-label="Bagian ruang berdua">{([{ key: 'decision', label: 'Pilih ide' }, { key: 'shopping', label: `Belanja (${pendingShopping.length})` }, { key: 'goals', label: 'Impian' }, { key: 'places', label: 'Wishlist Kencan' }, { key: 'journal', label: 'Jurnal Berdua' }] as const).map(tab => <button key={tab.key} aria-pressed={coupleSubTab === tab.key} onClick={() => setCoupleSubTab(tab.key)}>{tab.label}</button>)}</div>
          {coupleSubTab === 'decision' && <><div className="decision-grid"><section className="decision-card decision-dark"><Waves /><span className="shortcut-icon"><Utensils size={25} /></span><h2>Makan apa hari ini?</h2><p>Tidak perlu debat panjang.<br />Serahkan satu pilihan pada kami.</p><div className="decision-result" aria-live="polite" aria-busy={spinning === 'food'}>{spinning === 'food' ? <p>Sebentar, lagi pilih menu...</p> : pickedFood ? <><h3>{pickedFood.title}</h3><span>{pickedFood.tag}</span></> : <p>{state.foodIdeas.length ? 'Pilihan menu harian kalian akan muncul di sini.' : 'Tambahkan pilihan menu di bawah untuk mulai mengacak.'}</p>}</div><button className="primary-button" disabled={!state.foodIdeas.length} onClick={() => spin('food')} aria-label="Acak menu makan hari ini"><Sparkles size={18} />Pilihkan untuk kami</button></section>
          <section className="decision-card decision-light"><span className="shortcut-icon"><Heart size={25} /></span><h2>Waktu untuk kita.</h2><p>Keluar sebentar atau di rumah,<br />yang penting bareng kamu.</p><div className="decision-result" aria-live="polite" aria-busy={spinning === 'date'}>{spinning === 'date' ? <p>Sebentar, lagi cari ide...</p> : pickedDate ? <h3>{pickedDate}</h3> : <p>{state.dateIdeas.length ? 'Ide kencan kalian akan muncul di sini.' : 'Tambahkan ide kencan di bawah untuk mulai mengacak.'}</p>}</div><button className="primary-button" disabled={!state.dateIdeas.length} onClick={() => spin('date')} aria-label="Acak ide kencan berdua"><Sparkles size={18} />Cari ide kencan</button></section></div><div className="decision-grid"><IdeaList kind="food" /><IdeaList kind="date" /></div></>}
          {coupleSubTab === 'shopping' && <section><SectionHeading title="Daftar belanja kita" /><form onSubmit={addShopping} className="shopping-form"><label className="sr-only" htmlFor="shopping-item">Nama barang belanja</label><input id="shopping-item" placeholder="Mau titip apa?" required maxLength={120} value={newShoppingItem} onChange={event => setNewShoppingItem(event.target.value)} /><button type="submit" disabled={store.pending} className="primary-button" aria-label="Tambah barang belanja"><Plus size={20} /><span>Tambah</span></button></form><div className="shopping-list">{shoppingList.length ? shoppingList.map(item => <div className={`shopping-row ${item.isBought ? 'is-bought' : ''}`} key={item.id}><label><input type="checkbox" disabled={store.pending} checked={item.isBought} onChange={() => toggleShopping(item.id)} /><span className="checkbox-mark" aria-hidden="true">{item.isBought && <Check size={14} />}</span><span className="shopping-copy">{item.title}<small>Dititip oleh {personName(item.addedBy)}</small></span></label><button className="delete-button icon-button" onClick={() => deleteShopping(item.id)} aria-label={`Hapus ${item.title}`}><Trash2 size={16} /></button></div>) : <Empty>Daftar belanja masih kosong.<br />Tulis apa saja yang perlu dibawa pulang.</Empty>}</div></section>}
          {coupleSubTab === 'goals' && <GoalsWorkspace />}
          {coupleSubTab === 'places' && <CouplePlacesWorkspace />}
          {coupleSubTab === 'journal' && <CoupleJournalWorkspace />}
        </>}
      </div>}

      <footer className="demo-note">{store.isPreview ? 'Pratinjau dengan data contoh · Semua perubahan data hilang saat halaman dimuat ulang. Tidak ada koneksi bank atau database.' : 'Catatan rumah disimpan di Supabase. Pencatatan ini tidak terhubung ke bank dan tidak memindahkan uang sungguhan.'}</footer>
      <nav className="bottom-nav" aria-label="Navigasi utama">{tabs.map(tab => <button key={tab.key} className={`nav-button ${activeTab === tab.key ? 'active' : ''}`} aria-current={activeTab === tab.key ? 'page' : undefined} onClick={() => navigate(tab.key)}><tab.icon size={21} strokeWidth={activeTab === tab.key ? 2.6 : 1.9} /><span>{tab.label}</span><i aria-hidden="true" /></button>)}</nav>

      <HouseholdDialogs role={currentProfile.role} />
      <AgentAssistant open={assistantOpen} onOpenChange={setAssistantOpen} />
      <div className={`notice ${notice ? 'notice-visible' : ''}`} role="status">{notice}</div>
    </main>
  </div>
}
