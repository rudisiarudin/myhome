import { useRef, useState } from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, Building2, Check, ChevronLeft, ChevronRight, Copy, CreditCard, Pencil, PiggyBank, Plus, Search, Settings2, Smartphone, Trash2, Wallet } from 'lucide-react'
import { useHousehold } from './context'
import { dateKey, formatDate, goalBalance, money, spentIn, TODAY, walletBalance } from './model'
import type { HouseholdWallet, Transaction } from './model'
import { Empty, Meter, RowActions, Section } from './ui'
import { AgendaForm } from './AgendaForm'
import { useAccount } from '../account/context'

const walletIcons = { cash: Banknote, bank: Building2, ewallet: Smartphone }
const transactionIcons = { expense: ArrowUpRight, income: ArrowDownLeft, transfer: ArrowLeftRight, saving: PiggyBank }
const transactionLabels = { expense: 'Pengeluaran', income: 'Pemasukan', transfer: 'Transfer', saving: 'Setoran impian' }
function ReceiptDelete() { return <Trash2 size={16} /> }

export function TransactionList({ items, editable = true }: { items: Transaction[]; editable?: boolean }) {
  const store = useHousehold()
  const { nameForPerson: personName } = useAccount()
  return <div className="transactions-list">{items.length === 0 ? <Empty title="Belum ada transaksi">Catat transaksi baru atau ubah filter pencarian.</Empty> : items.map(entry => {
    const Icon = transactionIcons[entry.kind]
    const wallet = store.state.wallets.find(item => item.id === entry.walletId)
    const destination = store.state.wallets.find(item => item.id === entry.toWalletId)
    return <article className={`transaction-row transaction-${entry.kind}`} key={entry.id}>
      <div className="transaction-main"><span className="list-icon"><Icon size={19} /></span><div className="row-copy"><h3>{entry.title}</h3><p>{entry.kind === 'transfer' ? `${wallet?.name} → ${destination?.name}` : `${wallet?.name} · ${personName(entry.recordedByUserId ?? entry.recordedBy)}`}<span className="transaction-date">{formatDate(entry.date)}</span></p></div><strong className="expense-amount">{entry.kind === 'income' ? '+' : entry.kind === 'transfer' ? '' : '−'}{money(entry.amount)}</strong></div>
      {editable && <div className="transaction-meta"><span>{transactionLabels[entry.kind]}{entry.kind === 'expense' ? ` · ${entry.pocket === 'household' ? 'Belanja rumah' : `Uang saku ${personName(entry.pocket)}`}` : ''}</span><RowActions name={entry.title} onEdit={() => store.setEditor({ type: 'transaction', kind: entry.kind, id: entry.id })} onDelete={() => store.setEditor({ type: 'confirm', title: 'Hapus transaksi?', description: `“${entry.title}” akan dihapus dan saldo dompet dihitung ulang.${entry.billId ? ' Tagihan terkait kembali berstatus belum dibayar.' : ''}`, confirm: () => store.deleteTransaction(entry.id) })} /></div>}
    </article>
  })}</div>
}

export function GoalsWorkspace({ compact = false }: { compact?: boolean }) {
  const store = useHousehold()
  return <section className="goals-workspace"><Section title={compact ? 'Tabungan impian' : 'Sedikit-sedikit, jadi nyata.'} action="Tambah impian" onAction={() => store.setEditor({ type: 'goal' })} />{!compact && <p className="muted goals-intro">Setiap setoran membawa kita sedikit lebih dekat.</p>}
    <div className="goal-list">{store.state.goals.length === 0 ? <Empty title="Impian pertama kita">Tambahkan tujuan, lalu coba catat setoran dari dompet.</Empty> : store.state.goals.map(goal => {
      const current = goalBalance(goal, store.state.transactions)
      return <article className="goal managed-goal" key={goal.id}><div className="row-between"><h3>{goal.title}</h3><span className="goal-percent">{Math.round(current / goal.targetAmount * 100)}%</span></div><p className="muted small">{current >= goal.targetAmount ? 'Target tercapai' : `Target ${formatDate(goal.targetDate)}`}</p><Meter value={current / goal.targetAmount * 100} label={`Tabungan ${goal.title}`} /><div className="row-between small"><strong>{money(current)}</strong><span className="muted">dari {money(goal.targetAmount)}</span></div><div className="goal-actions"><button className="secondary-button" onClick={() => store.setEditor({ type: 'transaction', kind: 'saving', goalId: goal.id })}><Plus size={15} />Catat setoran</button><RowActions name={goal.title} onEdit={() => store.setEditor({ type: 'goal', id: goal.id })} onDelete={() => store.setEditor({ type: 'confirm', title: 'Hapus impian?', description: `Hapus “${goal.title}” dari daftar. Impian dengan catatan setoran tidak dapat dihapus sebelum setorannya dibatalkan.`, confirm: () => store.deleteGoal(goal.id) })} /></div></article>
    })}</div>
  </section>
}

export function BudgetWorkspace() {
  const store = useHousehold()
  const { nameForPerson: personName } = useAccount()
  const { state } = store
  const [pane, setPane] = useState<'overview' | 'wallets' | 'history'>('overview')
  const [walletFilter, setWalletFilter] = useState('all')
  const [kindFilter, setKindFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [month, setMonth] = useState(TODAY.slice(0, 7))
  const monthKey = TODAY.slice(0, 7)
  const householdSpent = spentIn(state.transactions, monthKey, 'household')
  const dailySpent = spentIn(state.transactions, TODAY, 'household')
  const total = state.wallets.reduce((sum, wallet) => sum + walletBalance(wallet, state.transactions), 0)
  const income = state.transactions.filter(item => item.kind === 'income' && item.date.startsWith(monthKey)).reduce((sum, item) => sum + item.amount, 0)
  const filtered = state.transactions.filter(entry => (walletFilter === 'all' || entry.walletId === walletFilter || entry.toWalletId === walletFilter) && (kindFilter === 'all' || entry.kind === kindFilter) && (!month || entry.date.startsWith(month)) && entry.title.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date))

  const walletCard = (wallet: HouseholdWallet) => {
    const Icon = walletIcons[wallet.kind]
    return <article className="wallet-card" key={wallet.id}><div className="row-between"><span className="wallet-symbol"><Icon size={23} /></span><button className="icon-button" aria-label={`Ubah dompet ${wallet.name}`} onClick={() => store.setEditor({ type: 'wallet', id: wallet.id })}><Pencil size={16} /></button></div><h3>{wallet.name}</h3><strong className="wallet-balance">{money(walletBalance(wallet, state.transactions))}</strong><div className="wallet-footer"><span>{wallet.kind === 'cash' ? 'Tunai' : wallet.kind === 'bank' ? 'Rekening' : 'E-wallet'} · {personName(wallet.owner)}</span><button className="icon-button" aria-label={`Lihat transaksi ${wallet.name}`} onClick={() => { setWalletFilter(wallet.id); setPane('history') }}><ChevronRight size={19} /></button></div></article>
  }

  return <div className="budget-workspace">
    <section className="balance-card"><div className="row-between"><span>Total saldo dompet</span><Wallet size={23} /></div><h2>{money(total)}</h2><p className="balance-caption">{state.wallets.length} dompet · {new Date(`${TODAY}T12:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</p><div className="balance-footer"><span><ArrowDownLeft size={15} /> Masuk {money(income)}</span><span><ArrowUpRight size={15} /> Keluar {money(spentIn(state.transactions, monthKey))}</span></div></section>
    <div className="finance-actions"><button onClick={() => store.setEditor({ type: 'transaction', kind: 'income' })}><span><ArrowDownLeft size={20} /></span>Pemasukan</button><button onClick={() => store.setEditor({ type: 'transaction', kind: 'expense' })}><span><ArrowUpRight size={20} /></span>Pengeluaran</button><button onClick={() => store.setEditor({ type: 'transaction', kind: 'transfer' })}><span><ArrowLeftRight size={20} /></span>Transfer</button></div>
    <div className="segmented-control finance-tabs" role="group" aria-label="Bagian keuangan">{([{ key: 'overview', label: 'Ringkasan' }, { key: 'wallets', label: 'Dompet' }, { key: 'history', label: 'Riwayat' }] as const).map(tab => <button key={tab.key} aria-pressed={pane === tab.key} onClick={() => setPane(tab.key)}>{tab.label}</button>)}</div>
    {(pane === 'overview' || pane === 'wallets') && <section><Section title="Dompet kita" action="Tambah dompet" onAction={() => store.setEditor({ type: 'wallet' })} /><div className="wallet-grid">{state.wallets.length ? state.wallets.map(walletCard) : <Empty title="Belum ada dompet">Buat dompet pertama sebelum mencatat transaksi.</Empty>}</div></section>}
    {pane === 'overview' && <>
      <section><Section title="Anggaran rumah" action="Atur anggaran" onAction={() => store.setEditor({ type: 'budget' })} /><div className="budget-settings-grid">{[{ label: 'Hari ini', spent: dailySpent, limit: state.budget.daily }, { label: 'Bulan ini', spent: householdSpent, limit: state.budget.monthly }].map(item => <article className="budget-limit" key={item.label}><div className="row-between"><span>{item.label}</span><Settings2 size={16} /></div><strong className={item.limit < item.spent ? 'over-limit' : ''}>{money(item.limit - item.spent)}</strong><p className="small muted">tersisa dari {money(item.limit)}</p><Meter value={item.spent / item.limit * 100} label={`Anggaran ${item.label} terpakai`} /><p className="small muted">Terpakai {money(item.spent)}</p></article>)}</div></section>
      <section><Section title="Uang saku" action="Atur batas" onAction={() => store.setEditor({ type: 'budget' })} /><div className="pocket-grid">{(['suami', 'istri'] as const).map(owner => { const spent = spentIn(state.transactions, monthKey, owner); const limit = state.budget[owner]; return <article className="pocket-card" key={owner}><div className="row-between"><span className="pocket-avatar">{personName(owner)[0]}</span><span className="small muted">{Math.round(Math.max(0, (limit - spent) / limit * 100))}% tersisa</span></div><h3>{personName(owner)}</h3><strong>{money(limit - spent)}</strong><Meter value={spent / limit * 100} label={`Uang saku ${personName(owner)} terpakai`} /><p className="small muted">dari {money(limit)}</p></article> })}</div></section>
      <GoalsWorkspace compact /><Section title="Transaksi terbaru" action="Lihat riwayat" onAction={() => setPane('history')} /><TransactionList items={state.transactions.slice(0, 3)} />
    </>}
    {pane === 'wallets' && <p className="workspace-note">Saldo akan berubah ketika kamu mencatat pemasukan, pengeluaran, transfer, atau setoran impian. Tidak ada rekening bank yang terhubung.</p>}
    {pane === 'history' && <section>
      <Section title="Riwayat transaksi" action="Catat baru" onAction={() => store.setEditor({ type: 'transaction', kind: 'expense' })} />
      <div className="history-filters">
        <label className="search-field"><Search size={17} /><span className="sr-only">Cari transaksi</span><input placeholder="Cari transaksi..." value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className="filter-grid">
          <label><span>Dompet</span><select aria-label="Dompet" value={walletFilter} onChange={event => setWalletFilter(event.target.value)}><option value="all">Semua dompet</option>{state.wallets.map(wallet => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select></label>
          <label><span>Jenis</span><select aria-label="Jenis" value={kindFilter} onChange={event => setKindFilter(event.target.value)}><option value="all">Semua jenis</option><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option><option value="transfer">Transfer</option><option value="saving">Setoran impian</option></select></label>
          <label><span>Bulan</span><input aria-label="Bulan" type="month" value={month} onChange={event => setMonth(event.target.value)} /></label>
        </div>
        <div className="row-between"><span className="small muted">{filtered.length} transaksi ditemukan</span><button className="text-button" onClick={() => { setWalletFilter('all'); setKindFilter('all'); setMonth(''); setQuery('') }}>Reset filter</button></div>
      </div>
      <TransactionList items={filtered} />
    </section>}
  </div>
}

export function CalendarWorkspace() {
  const store = useHousehold()
  const { nameForPerson: personName } = useAccount()
  const [selected, setSelected] = useState(TODAY)
  const composerRef = useRef<HTMLElement>(null)
  const weekStart = new Date(`${selected}T12:00:00`)
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 6) % 7)
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(weekStart); date.setDate(date.getDate() + index); return date })
  const events = store.state.events.filter(item => item.date === selected).sort((a, b) => a.time.localeCompare(b.time))
  const changeWeek = (offset: number) => { const date = new Date(`${selected}T12:00:00`); date.setDate(date.getDate() + offset); setSelected(dateKey(date)) }
  return <div className="calendar-workspace"><div className="calendar-tools"><button className="icon-button" aria-label="Minggu sebelumnya" onClick={() => changeWeek(-7)}><ChevronLeft size={20} /></button><label><span className="sr-only">Pilih tanggal agenda</span><input type="date" value={selected} onChange={event => { if (event.target.value) setSelected(event.target.value) }} /></label><button className="icon-button" aria-label="Minggu berikutnya" onClick={() => changeWeek(7)}><ChevronRight size={20} /></button><button className="text-button" onClick={() => setSelected(TODAY)}>Hari ini</button></div>
    <div className="calendar-strip" role="group" aria-label="Pilih hari agenda">{days.map(date => { const key = dateKey(date); return <button key={key} className={selected === key ? 'selected' : ''} aria-pressed={selected === key} aria-label={formatDate(key, { weekday: 'long', day: 'numeric', month: 'long' })} onClick={() => setSelected(key)}><strong>{date.getDate()}</strong><span>{date.toLocaleDateString('id-ID', { weekday: 'short' })}</span><i aria-hidden="true" /></button> })}</div>
    <div className="calendar-work-area">
    <section className="agenda-composer" aria-label="Isi agenda baru" ref={composerRef}><AgendaForm selectedDate={selected} onDateChange={setSelected} inline /></section>
    <div className="calendar-content"><Section title={selected === TODAY ? 'Rencana hari ini' : formatDate(selected)} action="Tambah agenda" onAction={() => composerRef.current?.querySelector('input')?.focus()} /><p className="small muted agenda-count">{events.length} agenda · {events.filter(item => item.isDone).length} selesai</p>
      {!events.length ? <Empty title="Hari yang masih lapang">Tambahkan agenda untuk tanggal ini.</Empty> : <div className="agenda">{events.map((event, index) => <article className={`agenda-item ${index === 0 ? 'agenda-featured' : ''} ${event.isDone ? 'agenda-done' : ''}`} key={event.id}><span className="timeline-dot" aria-hidden="true" /><div className="agenda-card"><div className="row-between"><h3>{event.title}</h3><time>{event.time}</time></div><p>{personName(event.assignee)}{event.note ? ` · ${event.note}` : ''}</p><div className="managed-agenda-actions"><label className="agenda-complete"><input type="checkbox" disabled={store.pending} checked={event.isDone} onChange={() => store.toggleEvent(event.id)} /><span>{event.isDone ? 'Sudah selesai' : 'Tandai selesai'}</span></label><RowActions name={event.title} onEdit={() => store.setEditor({ type: 'event', id: event.id })} onDelete={() => store.setEditor({ type: 'confirm', title: 'Hapus agenda?', description: `“${event.title}” akan dihapus dari kalender.`, confirm: () => store.deleteEvent(event.id) })} /></div></div></article>)}</div>}
    </div>
    </div>
  </div>
}

export function BillsWorkspace({ copiedId, onCopy, onAdd }: { copiedId: string | null; onCopy: (value: string, id: string) => void; onAdd?: () => void }) {
  const store = useHousehold()
  const { nameForPerson: personName } = useAccount()
  const [filter, setFilter] = useState('all')
  const bills = store.state.bills.filter(item => filter === 'all' || (filter === 'paid' ? item.isPaid : !item.isPaid)).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const unpaid = store.state.bills.filter(item => !item.isPaid)
  return <section><Section title="Tagihan rumah" action="Tambah tagihan" onAction={onAdd ?? (() => store.setEditor({ type: 'bill' }))} /><div className="bills-summary"><div><span className="muted small">Belum dibayar</span><strong>{money(unpaid.reduce((sum, bill) => sum + bill.amount, 0))}</strong><span className="muted small">{unpaid.length} tagihan</span></div><label><span className="sr-only">Filter status tagihan</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Semua status</option><option value="unpaid">Belum dibayar</option><option value="paid">Lunas</option></select></label></div>
    <div className="bill-grid">{!bills.length ? <Empty title="Tidak ada tagihan di sini">Tambahkan tagihan atau pilih status lain.</Empty> : bills.map(bill => <article className="bill-card" key={bill.id}><div className="row-between"><span className="list-icon"><CreditCard size={21} /></span><span className={`bill-status ${bill.isPaid ? 'paid' : ''}`}>{bill.isPaid ? <><Check size={12} />Lunas</> : 'Belum dibayar'}</span></div><h3>{bill.title}</h3><strong className="bill-amount">{money(bill.amount)}</strong><p className="small muted">Jatuh tempo {formatDate(bill.dueDate)}{bill.paidBy && ` · ${personName(bill.paidByUserId ?? bill.paidBy)}`}</p>{bill.customerNumber && <div className="bill-number"><span><small>Nomor pelanggan</small><span className="selectable">{bill.customerNumber}</span></span><button className="icon-button" aria-label={`Salin nomor ${bill.title}`} onClick={() => onCopy(bill.customerNumber, bill.id)}>{copiedId === bill.id ? <Check size={18} /> : <Copy size={18} />}</button></div>}<div className="bill-actions"><button className={bill.isPaid ? 'secondary-button' : 'primary-button'} onClick={() => bill.isPaid ? store.setEditor({ type: 'confirm', title: 'Batalkan status lunas?', description: 'Catatan pembayaran terkait dihapus dan saldo catatan dompet dikembalikan. Tidak ada uang sungguhan yang berpindah.', confirm: () => store.unpayBill(bill.id) }) : store.setEditor({ type: 'pay', id: bill.id })}>{bill.isPaid ? 'Batalkan lunas' : 'Catat lunas'}</button><div className="row-actions">{!bill.isPaid && <button className="icon-button" aria-label={`Ubah ${bill.title}`} onClick={() => store.setEditor({ type: 'bill', id: bill.id })}><Pencil size={16} /></button>}<button className="icon-button delete-button" aria-label={`Hapus ${bill.title}`} onClick={() => store.setEditor({ type: 'confirm', title: 'Hapus tagihan?', description: `“${bill.title}” dihapus dari daftar. Riwayat pembayaran tetap ada sebagai pengeluaran biasa.`, confirm: () => store.deleteBill(bill.id) })}><ReceiptDelete /></button></div></div></article>)}</div>
  </section>
}
