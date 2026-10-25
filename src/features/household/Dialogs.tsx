import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Car, Check, Gamepad2, Heart, ReceiptText, ShoppingBag, Utensils, Wallet } from 'lucide-react'
import { useHousehold } from './context'
import type { Editor } from './store'
import { formatDate, goalBalance, isDateKey, makeId, money, TODAY, walletBalance } from './model'
import type { DebtPayment, HouseholdWallet, SavingGoal, Transaction } from './model'
import { Field, FormEnd, Modal, MoneyInput } from './ui'
import { AgendaForm } from './AgendaForm'
import { BillEntryForm, ContactEntryForm, DocumentEntryForm } from './HouseForms'
import { useAccount } from '../account/context'
import { ProfileAvatar } from '../account/ProfileAvatar'

const expenseCategories = [ ['makan', 'Makan & dapur', Utensils], ['belanja', 'Belanja rumah', ShoppingBag], ['kencan', 'Kencan berdua', Heart], ['transport', 'Bensin & kendaraan', Car], ['hobi', 'Hobi & personal', Gamepad2], ['tagihan', 'Tagihan', ReceiptText] ] as const

function TransactionForm({ editor, role }: { editor: Extract<Editor, { type: 'transaction' }>; role: Transaction['recordedBy'] }) {
  const store = useHousehold()
  const { currentProfile, profileForPerson, nameForPerson: personName } = useAccount()
  const existing = store.state.transactions.find(item => item.id === editor.id)
  const recorder = existing ? profileForPerson(existing.recordedByUserId ?? existing.recordedBy) : currentProfile
  const [kind, setKind] = useState(existing?.kind ?? editor.kind)
  const [title, setTitle] = useState(existing?.title ?? (editor.kind === 'saving' ? `Setoran ${store.state.goals.find(goal => goal.id === editor.goalId)?.title ?? 'impian'}` : ''))
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '')
  const [walletId, setWalletId] = useState(existing?.walletId ?? editor.walletId ?? store.state.wallets[0]?.id ?? '')
  const [toWalletId, setToWalletId] = useState(existing?.toWalletId ?? store.state.wallets.find(item => item.id !== walletId)?.id ?? '')
  const [goalId, setGoalId] = useState(existing?.goalId ?? editor.goalId ?? store.state.goals[0]?.id ?? '')
  const [category, setCategory] = useState(existing?.category ?? 'makan')
  const [pocket, setPocket] = useState<Transaction['pocket']>(existing?.pocket ?? 'household')
  const [date, setDate] = useState(existing?.date ?? TODAY)
  const [error, setError] = useState('')
  const labels = { expense: 'Catat pengeluaran', income: 'Catat pemasukan', transfer: 'Transfer antar dompet', saving: 'Catat setoran impian' }
  const wallet = store.state.wallets.find(item => item.id === walletId)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const entry: Transaction = { id: existing?.id ?? makeId(), kind, title: title.trim() || (kind === 'transfer' ? 'Transfer antar dompet' : ''), amount: Number(amount), walletId, toWalletId: kind === 'transfer' ? toWalletId : undefined, goalId: kind === 'saving' ? goalId : undefined, billId: existing?.billId, category: kind === 'expense' ? category : kind === 'saving' ? 'tabungan' : kind === 'income' ? 'pemasukan' : 'transfer', pocket: kind === 'expense' ? pocket : 'household', recordedBy: existing?.recordedBy ?? role, recordedByUserId: existing?.recordedByUserId ?? recorder?.id, date }
    setError(await store.saveTransaction(entry) ?? '')
  }
  return <Modal title={existing ? 'Ubah transaksi' : labels[kind]} subtitle="Pencatatan keuangan, tidak memindahkan uang bank sungguhan." onClose={() => store.setEditor(null)}>
    <form className="workspace-form" onSubmit={submit}>
      {!existing && kind !== 'saving' && <div className="transaction-kind" role="group" aria-label="Jenis transaksi">{([{ value: 'expense', label: 'Keluar', icon: ArrowUpRight }, { value: 'income', label: 'Masuk', icon: ArrowDownLeft }, { value: 'transfer', label: 'Transfer', icon: ArrowLeftRight }] as const).map(option => <button type="button" key={option.value} aria-pressed={kind === option.value} onClick={() => { setKind(option.value); setError('') }}><option.icon size={17} />{option.label}</button>)}</div>}
      <MoneyInput id="entry-amount" label={kind === 'income' ? 'Berapa yang masuk?' : kind === 'saving' ? 'Mau menabung berapa?' : kind === 'transfer' ? 'Berapa yang dipindahkan?' : 'Berapa yang keluar?'} value={amount} onChange={value => { setAmount(value); setError('') }} large />
      <Field id="entry-title" label={kind === 'income' ? 'Sumber pemasukan' : kind === 'transfer' ? 'Catatan transfer' : 'Untuk apa?'}><input id="entry-title" required={kind !== 'transfer'} maxLength={120} placeholder={kind === 'income' ? 'Gaji, bonus, atau hasil usaha' : 'Tulis nama transaksi'} value={title} onChange={event => setTitle(event.target.value)} /></Field>
      <div className="form-columns"><Field id="entry-wallet" label={kind === 'income' ? 'Masuk ke dompet' : 'Dari dompet'} hint={wallet ? `Saldo tersedia ${money(walletBalance(wallet, store.state.transactions))}` : 'Tambahkan dompet terlebih dahulu di Keuangan.'}><select id="entry-wallet" required value={walletId} onChange={event => { setWalletId(event.target.value); setError('') }}><option value="" disabled>Pilih dompet</option>{store.state.wallets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
      {kind === 'transfer' ? <Field id="entry-destination" label="Ke dompet"><select id="entry-destination" required value={toWalletId} onChange={event => setToWalletId(event.target.value)}><option value="" disabled>Pilih tujuan</option>{store.state.wallets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field> : <Field id="entry-date" label="Tanggal"><input id="entry-date" type="date" required value={date} onChange={event => setDate(event.target.value)} /></Field>}</div>
      {kind === 'transfer' && <Field id="entry-date" label="Tanggal"><input id="entry-date" type="date" required value={date} onChange={event => setDate(event.target.value)} /></Field>}
      {kind === 'saving' && <Field id="entry-goal" label="Untuk impian"><select id="entry-goal" required value={goalId} onChange={event => setGoalId(event.target.value)}><option value="" disabled>Pilih impian</option>{store.state.goals.map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></Field>}
      {kind === 'expense' && <><fieldset className="category-fieldset"><legend>Pilih kategori</legend><div className="category-picker">{expenseCategories.map(([value, label, Icon]) => <label key={value} className={`category-option ${category === value ? 'category-selected' : ''}`}><input type="radio" name="entry-category" value={value} checked={category === value} onChange={() => setCategory(value)} /><span><Icon size={18} /><span>{label}</span>{category === value && <Check size={13} className="category-check" />}</span></label>)}</div></fieldset>
      <Field id="entry-pocket" label="Dihitung dari anggaran"><select id="entry-pocket" value={pocket} onChange={event => setPocket(event.target.value as Transaction['pocket'])}><option value="household">Belanja rumah</option><option value="suami">Uang saku {personName('suami')}</option><option value="istri">Uang saku {personName('istri')}</option></select></Field></>}
      <div className="expense-recorder"><ProfileAvatar profile={recorder} className="recorder-avatar" /><span>Dicatat oleh <strong>{personName(existing?.recordedByUserId ?? existing?.recordedBy ?? currentProfile.id)}</strong></span><span className="recorder-date">{formatDate(date)}</span></div>
      <FormEnd error={error} label={existing ? 'Simpan perubahan' : kind === 'saving' ? 'Simpan setoran' : kind === 'transfer' ? 'Catat transfer' : kind === 'income' ? 'Simpan pemasukan' : 'Simpan pengeluaran'} />
    </form>
  </Modal>
}

function WalletForm({ id }: { id?: string }) {
  const store = useHousehold()
  const { nameForPerson } = useAccount()
  const existing = store.state.wallets.find(wallet => wallet.id === id)
  const [name, setName] = useState(existing?.name ?? '')
  const [kind, setKind] = useState<HouseholdWallet['kind']>(existing?.kind ?? 'cash')
  const [owner, setOwner] = useState<HouseholdWallet['owner']>(existing?.owner ?? 'berdua')
  const [opening, setOpening] = useState(String(existing?.openingBalance ?? 0))
  const [error, setError] = useState('')
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(await store.saveWallet({ id: existing?.id ?? makeId(), name: name.trim(), kind, owner, openingBalance: Number(opening) }) ?? '') }
  return <Modal title={existing ? 'Ubah dompet' : 'Tambah dompet'} subtitle="Satu tempat untuk setiap sumber uangmu." onClose={() => store.setEditor(null)}><form className="workspace-form" onSubmit={submit}>
    <Field id="wallet-name" label="Nama dompet"><input id="wallet-name" required maxLength={60} placeholder="Misalnya, BCA Rumah" value={name} onChange={event => setName(event.target.value)} /></Field>
    <div className="form-columns"><Field id="wallet-kind" label="Jenis dompet"><select id="wallet-kind" value={kind} onChange={event => setKind(event.target.value as HouseholdWallet['kind'])}><option value="cash">Tunai</option><option value="bank">Rekening bank</option><option value="ewallet">E-wallet</option></select></Field><Field id="wallet-owner" label="Pemilik"><select id="wallet-owner" value={owner} onChange={event => setOwner(event.target.value as HouseholdWallet['owner'])}><option value="berdua">Berdua</option><option value="suami">{nameForPerson('suami')}</option><option value="istri">{nameForPerson('istri')}</option></select></Field></div>
    <MoneyInput id="wallet-opening" label="Saldo awal" value={opening} onChange={setOpening} allowZero />
    <p className="form-hint">Saldo sekarang dihitung dari saldo awal ditambah seluruh transaksi. Ini bukan koneksi ke rekening bank.</p>
    <FormEnd error={error} label="Simpan dompet" />
    {existing && <button type="button" className="danger-text" onClick={() => store.setEditor({ type: 'confirm', title: `Hapus ${existing.name}?`, description: 'Dompet hanya bisa dihapus jika belum memiliki transaksi.', confirm: () => store.deleteWallet(existing.id) })}>Hapus dompet ini</button>}
  </form></Modal>
}

function BudgetForm() {
  const store = useHousehold()
  const { nameForPerson } = useAccount()
  const [daily, setDaily] = useState(String(store.state.budget.daily))
  const [monthly, setMonthly] = useState(String(store.state.budget.monthly))
  const [rudi, setRudi] = useState(String(store.state.budget.suami))
  const [istri, setIstri] = useState(String(store.state.budget.istri))
  const [error, setError] = useState('')
  return <Modal title="Atur anggaran" subtitle="Batas yang nyaman untuk rumah dan diri sendiri." onClose={() => store.setEditor(null)}><form className="workspace-form" onSubmit={async event => { event.preventDefault(); setError(await store.saveBudget({ daily: Number(daily), monthly: Number(monthly), suami: Number(rudi), istri: Number(istri) }) ?? '') }}><MoneyInput id="budget-daily" label="Belanja rumah per hari" value={daily} onChange={setDaily} /><MoneyInput id="budget-monthly" label="Belanja rumah per bulan" value={monthly} onChange={setMonthly} /><div className="form-columns"><MoneyInput id="budget-rudi" label={`Uang saku ${nameForPerson('suami')} / bulan`} value={rudi} onChange={setRudi} /><MoneyInput id="budget-istri" label={`Uang saku ${nameForPerson('istri')} / bulan`} value={istri} onChange={setIstri} /></div><p className="form-hint">Transfer dan setoran impian tidak dihitung sebagai belanja. Pilih anggaran saat mencatat pengeluaran.</p><FormEnd error={error} label="Simpan anggaran" /></form></Modal>
}

function EventForm({ id, date: initialDate }: { id?: string; date?: string }) {
  const store = useHousehold()
  const existing = store.state.events.find(event => event.id === id)
  return <Modal title={existing ? 'Ubah agenda' : 'Tambah agenda'} subtitle="Sisihkan waktu untuk yang penting." onClose={() => store.setEditor(null)}><AgendaForm existing={existing} initialDate={initialDate} /></Modal>
}

function BillForm({ id }: { id?: string }) {
  const store = useHousehold()
  const existing = store.state.bills.find(bill => bill.id === id)
  return <Modal title={existing ? 'Ubah tagihan' : 'Tambah tagihan'} subtitle="Catat jatuh temponya, kurangi yang terlupa." onClose={() => store.setEditor(null)}><BillEntryForm existing={existing} /></Modal>
}

function HouseRecordEditor({ type, id }: { type: 'document' | 'contact'; id?: string }) {
  const store = useHousehold()
  const title = type === 'document' ? 'dokumen' : 'kontak'
  return <Modal title={`${id ? 'Ubah' : 'Tambah'} ${title}`} subtitle={store.isPreview ? 'Perubahan hanya berlaku dalam sesi pratinjau.' : 'Catatan disimpan untuk rumah bersama.'} onClose={() => store.setEditor(null)}>
    {type === 'document' ? <DocumentEntryForm existing={store.state.documents.find(item => item.id === id)} /> : <ContactEntryForm existing={store.state.contacts.find(item => item.id === id)} />}
  </Modal>
}

function PaymentForm({ id, role }: { id: string; role: Transaction['recordedBy'] }) {
  const store = useHousehold()
  const { currentProfile } = useAccount()
  const bill = store.state.bills.find(item => item.id === id)
  const [walletId, setWalletId] = useState(store.state.wallets[0]?.id ?? '')
  const [error, setError] = useState('')
  if (!bill) return null
  return <Modal title="Catat tagihan lunas" subtitle="Pencatatan tagihan, bukan pembayaran bank sungguhan." onClose={() => store.setEditor(null)}><form className="workspace-form" onSubmit={async event => { event.preventDefault(); setError(await store.payBill(id, walletId, role, currentProfile.id) ?? '') }}><div className="payment-summary"><ReceiptText size={28} /><h3>{bill.title}</h3><strong>{money(bill.amount)}</strong><p>Jatuh tempo {formatDate(bill.dueDate)}</p></div><Field id="payment-wallet" label="Dibayar dari dompet"><select id="payment-wallet" required value={walletId} onChange={event => setWalletId(event.target.value)}><option value="" disabled>Pilih dompet</option>{store.state.wallets.map(wallet => <option key={wallet.id} value={wallet.id}>{wallet.name} · {money(walletBalance(wallet, store.state.transactions))}</option>)}</select></Field><p className="form-hint">Saldo catatan dompet akan berkurang dan satu pengeluaran dibuat otomatis. Tidak perlu mencatatnya dua kali.</p><FormEnd error={error} label="Tandai lunas & catat" /></form></Modal>
}

function DebtPaymentForm({ id }: { id: string }) {
  const store = useHousehold()
  const debt = store.state.debts.find(item => item.id === id)
  const isPiutang = debt?.type === 'piutang'
  const [amount, setAmount] = useState(debt ? String(debt.monthlyPayment ? Math.min(debt.monthlyPayment, debt.remainingAmount) : debt.remainingAmount) : '')
  const [date, setDate] = useState(TODAY)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  if (!debt) return null
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    // Validasi lokal lebih dulu (pesan sama dengan demo store): provider connected
    // tidak memvalidasi nominal terhadap sisa, dan dialog tidak boleh menutup bila tidak valid.
    const value = Number(amount)
    if (!amount || Number.isNaN(value) || value <= 0) { setError('Nominal harus berupa rupiah utuh dan lebih dari Rp0.'); return }
    if (value > debt.remainingAmount) { setError(`Nominal tidak boleh melebihi sisa saat ini (${money(debt.remainingAmount)}).`); return }
    if (!isDateKey(date)) { setError('Pilih tanggal pembayaran yang valid.'); return }
    const payment: DebtPayment = { id: makeId(), debtId: debt.id, amount: value, paidDate: date, note: note.trim() }
    setError(await store.saveDebtPayment(debt, payment) ?? '')
  }
  return <Modal title={isPiutang ? 'Catat Pengembalian' : 'Catat Pembayaran'} subtitle={isPiutang ? 'Uang yang dikembalikan peminjam, dicatat dari sisa piutang.' : 'Angsuran yang dibayar, dicatat dari sisa utang.'} onClose={() => store.setEditor(null)}><form className="workspace-form" onSubmit={submit}><div className="payment-summary"><Wallet size={28} /><h3>{debt.title}</h3><strong>{money(debt.remainingAmount)}</strong><p>{isPiutang ? 'Belum kembali' : 'Sisa utang'} · {debt.lenderOrBorrower}</p></div><MoneyInput id="debt-payment-amount" label={isPiutang ? 'Nominal pengembalian' : 'Nominal pembayaran'} value={amount} onChange={value => { setAmount(value); setError('') }} /><div className="form-columns"><Field id="debt-payment-date" label="Tanggal"><input id="debt-payment-date" type="date" required max={TODAY} value={date} onChange={event => setDate(event.target.value)} /></Field><Field id="debt-payment-note" label="Catatan (opsional)"><input id="debt-payment-note" type="text" maxLength={200} placeholder="Contoh: transfer BCA / cash" value={note} onChange={event => setNote(event.target.value)} /></Field></div><p className="form-hint">Sisa saat ini {money(debt.remainingAmount)}. Setelah dicatat, sisa menjadi {money(Math.max(debt.remainingAmount - (Number(amount) || 0), 0))}. Riwayatnya tersimpan di kartu dan bisa dihapus bila keliru.</p><FormEnd error={error} label={isPiutang ? 'Simpan pengembalian' : 'Simpan pembayaran'} /></form></Modal>
}

function GoalForm({ id }: { id?: string }) {
  const store = useHousehold()
  const existing = store.state.goals.find(goal => goal.id === id)
  const [title, setTitle] = useState(existing?.title ?? '')
  const [target, setTarget] = useState(existing ? String(existing.targetAmount) : '')
  const [opening, setOpening] = useState(String(existing?.openingAmount ?? 0))
  const [date, setDate] = useState(existing?.targetDate ?? TODAY)
  const [error, setError] = useState('')
  return <Modal title={existing ? 'Ubah impian' : 'Tambah impian'} subtitle="Mulai dari satu rencana yang ingin diwujudkan." onClose={() => store.setEditor(null)}><form className="workspace-form" onSubmit={async event => { event.preventDefault(); const goal: SavingGoal = { id: existing?.id ?? makeId(), title: title.trim(), targetAmount: Number(target), openingAmount: Number(opening), targetDate: date }; setError(await store.saveGoal(goal) ?? '') }}><Field id="goal-title" label="Nama impian"><input id="goal-title" required maxLength={100} placeholder="Misalnya, liburan berdua" value={title} onChange={event => setTitle(event.target.value)} /></Field><MoneyInput id="goal-target" label="Target tabungan" value={target} onChange={setTarget} /><MoneyInput id="goal-opening" label="Tabungan awal yang sudah ada" value={opening} onChange={setOpening} allowZero /><p className="form-hint">Tabungan awal tidak mengurangi dompet. Setoran baru dipilih dari dompet dan dicatat sebagai setoran, bukan belanja.</p><Field id="goal-date" label="Target tanggal"><input id="goal-date" required type="date" value={date} onChange={event => setDate(event.target.value)} /></Field>{existing && <p className="form-hint">Terkumpul saat ini: {money(goalBalance(existing, store.state.transactions))}.</p>}<FormEnd error={error} label="Simpan impian" /></form></Modal>
}

function ConfirmForm({ editor }: { editor: Extract<Editor, { type: 'confirm' }> }) {
  const store = useHousehold()
  const [error, setError] = useState('')
  return <Modal title={editor.title} onClose={() => store.setEditor(null)} narrow><p className="confirm-description">{editor.description}</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="confirm-actions"><button className="secondary-button" onClick={() => store.setEditor(null)}>Batal</button><button className="danger-button" disabled={store.pending} onClick={async () => setError(await editor.confirm() ?? '')}>{store.pending ? 'Memproses…' : 'Ya, lanjutkan'}</button></div></Modal>
}

export function HouseholdDialogs({ role }: { role: Transaction['recordedBy'] }) {
  const { editor } = useHousehold()
  if (!editor) return null
  const key = `${editor.type}-${'id' in editor ? editor.id ?? 'new' : 'new'}`
  switch (editor.type) {
    case 'transaction': return <TransactionForm key={key} editor={editor} role={role} />
    case 'wallet': return <WalletForm key={key} id={editor.id} />
    case 'budget': return <BudgetForm />
    case 'event': return <EventForm key={key} id={editor.id} date={editor.date} />
    case 'bill': return <BillForm key={key} id={editor.id} />
    case 'document': return <HouseRecordEditor key={key} type="document" id={editor.id} />
    case 'contact': return <HouseRecordEditor key={key} type="contact" id={editor.id} />
    case 'pay': return <PaymentForm key={key} id={editor.id} role={role} />
    case 'debtPay': return <DebtPaymentForm key={key} id={editor.id} />
    case 'goal': return <GoalForm key={key} id={editor.id} />
    case 'confirm': return <ConfirmForm editor={editor} />
  }
}
