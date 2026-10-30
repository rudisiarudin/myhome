import { useState } from 'react'
import type { ReactNode } from 'react'
import { bills as sampleBills, contacts as sampleContacts, documents as sampleDocuments, goals as sampleGoals, initialExpenses, schedule } from '../../data/demo'
import { dateKey, TODAY, isDateKey, isMoney, isPhoneNumber, makeId, money, normalizePhone, validateTransaction, validateTransactionDeletion, walletBalance } from './model'
import type { BudgetSettings, DebtLoan, DebtPayment, HouseholdBill, HouseholdContact, HouseholdDocument, HouseholdEvent, HouseholdState, HouseholdWallet, InvestmentHolding, JournalMemory, Person, SavingGoal, Transaction, TransactionKind } from './model'
import { HouseholdContext } from './context'
import { dateIdeas, foodIdeas, initialShopping } from '../../data/demo'
import type { ShoppingItem } from '../../types'

export type Editor =
  | { type: 'transaction'; kind: TransactionKind; id?: string; walletId?: string; goalId?: string }
  | { type: 'wallet'; id?: string }
  | { type: 'budget' }
  | { type: 'event'; id?: string; date?: string }
  | { type: 'bill'; id?: string }
  | { type: 'document'; id?: string }
  | { type: 'contact'; id?: string }
  | { type: 'pay'; id: string }
  | { type: 'debtPay'; id: string }
  | { type: 'goal'; id?: string }
  | { type: 'confirm'; title: string; description: string; confirm: () => string | null | Promise<string | null> }

function initialState(): HouseholdState {
  const relativeDate = (offset: number) => { const date = new Date(); date.setDate(date.getDate() + offset); return dateKey(date) }
  const month = TODAY.slice(0, 7)
  const monthNumbers: Record<string, string> = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MEI: '05', JUN: '06', JUL: '07', AGU: '08', SEP: '09', OKT: '10', NOV: '11', DES: '12' }
  return {
    shopping: initialShopping,
    foodIdeas,
    dateIdeas: dateIdeas.map((title, index) => ({ id: `date-${index}`, title })),
    wallets: [
      { id: 'cash', name: 'Tunai', kind: 'cash', openingBalance: 450000, owner: 'berdua' },
      { id: 'bca', name: 'BCA Rumah', kind: 'bank', openingBalance: 4230000, owner: 'berdua' },
      { id: 'gopay', name: 'GoPay', kind: 'ewallet', openingBalance: 1825000, owner: 'suami' },
    ],
    transactions: initialExpenses.map((entry, index) => ({ ...entry, kind: 'expense', walletId: index < 2 ? 'cash' : index === 2 ? 'bca' : 'gopay', pocket: 'household', date: relativeDate(index < 2 ? 0 : index === 2 ? -1 : -2) })),
    budget: { daily: 250000, monthly: 7500000, suami: 1000000, istri: 1000000 },
    events: schedule.map(entry => ({ ...entry, date: entry.date === 'TODAY' ? TODAY : relativeDate(1), note: '', isDone: false })),
    bills: sampleBills.map((entry, index) => ({ ...entry, dueDate: `${index === 3 ? relativeDate(30).slice(0, 7) : month}-${index === 0 ? '20' : index === 1 ? '25' : index === 2 ? '28' : '10'}`, customerNumber: entry.customerNumber ?? '' })),
    goals: sampleGoals.map((goal, index) => ({ id: goal.id, title: goal.title, targetAmount: goal.targetAmount, openingAmount: goal.currentAmount, targetDate: `${new Date().getFullYear()}-${index === 0 ? '12-15' : '11-15'}` })),
    documents: sampleDocuments.map(document => { const [day, monthName, year] = document.expiryDate.split(' '); return { id: document.id, title: document.title, category: document.category, expiryDate: `${year}-${monthNumbers[monthName]}-${day.padStart(2, '0')}`, note: '' } }),
    contacts: sampleContacts.map(contact => ({ ...contact })),
    chores: [
      { id: 'ch1', title: 'Buang Sampah Depan', assignee: 'suami', frequency: 'harian', isDone: true, lastDoneBy: 'suami' },
      { id: 'ch2', title: 'Sapu & Pel Lantai Rumah', assignee: 'istri', frequency: 'harian', isDone: false },
      { id: 'ch3', title: 'Ganti Seprai & Sarung Bantal', assignee: 'berdua', frequency: 'mingguan', isDone: false },
      { id: 'ch4', title: 'Bersihkan Kamar Mandi', assignee: 'suami', frequency: 'mingguan', isDone: true, lastDoneBy: 'suami' },
    ],
    places: [
      { id: 'p1', title: 'Kopi Tuku / Artisan Coffee', location: 'Blok M / Cipete', category: 'kopi', estBudget: 75000, notes: 'Tempat ngopi santai weekend pagi' },
      { id: 'p2', title: 'Osteria Gia Pasta', location: 'Plaza Indonesia', category: 'makan', estBudget: 350000, notes: 'Target dinner kencan perayaan' },
      { id: 'p3', title: 'Taman Literasi & Jalan Sore', location: 'Blok M', category: 'jalan', estBudget: 50000, notes: 'Jalan santai murah meriah' },
    ],
    debts: [
      { id: 'db1', title: 'Cicilan KPR Rumah', type: 'kpr', lenderOrBorrower: 'Bank Mandiri', totalAmount: 380000000, remainingAmount: 315000000, monthlyPayment: 3850000, dueDay: 10, tenorMonths: 180, remainingMonths: 142, notes: 'Bunga fixed 3 tahun pertama' },
      { id: 'db2', title: 'Cicilan Motor Beat', type: 'kendaraan', lenderOrBorrower: 'FIF Finance', totalAmount: 18500000, remainingAmount: 5200000, monthlyPayment: 780000, dueDay: 25, tenorMonths: 24, remainingMonths: 7, notes: 'Selesai Mei 2027' },
    ],
    debtPayments: [],
    memories: [
      { id: 'm1', title: 'Anniversary Pernikahan', date: '2026-09-12', note: 'Dinner romantis berdua & evaluasi perjalanan rumah tangga.', category: 'milestone', recordedBy: 'suami' },
      { id: 'm2', title: 'Weekend Getaway Puncak', date: '2026-10-04', note: 'Staycation dingin, masak mie instan bareng & ngopi santai.', category: 'liburan', recordedBy: 'istri' },
    ],
    investments: [
      { id: 'inv1', kind: 'saham', symbol: 'BBCA', name: 'Bank Central Asia', quantity: 100, avgPrice: 8500 },
      { id: 'inv2', kind: 'crypto', symbol: 'BTC', name: 'Bitcoin', quantity: 0.005, avgPrice: 1250000000 },
    ],
  }
}

function useStore() {
  const [state, setState] = useState<HouseholdState>(initialState)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [notice, setNotice] = useState('')
  const finish = (message: string) => { setEditor(null); setNotice(message) }

  const saveTransaction = async (entry: Transaction) => {
    const error = validateTransaction(entry, state)
    if (error) return error
    setState(current => ({ ...current, transactions: [entry, ...current.transactions.filter(item => item.id !== entry.id)], bills: entry.billId ? current.bills.map(bill => bill.id === entry.billId ? { ...bill, title: entry.title, amount: entry.amount, paidBy: entry.recordedBy, paidByUserId: entry.recordedByUserId } : bill) : current.bills }))
    finish('Transaksi berhasil dicatat dalam pratinjau.')
    return null
  }

  const deleteTransaction = async (id: string) => {
    const error = validateTransactionDeletion(id, state)
    if (error) return error
    const entry = state.transactions.find(item => item.id === id)
    setState(current => ({ ...current, transactions: current.transactions.filter(item => item.id !== id), bills: entry?.billId ? current.bills.map(bill => bill.id === entry.billId ? { ...bill, isPaid: false, paidBy: undefined, paidByUserId: undefined } : bill) : current.bills }))
    finish('Transaksi dihapus. Saldo sudah dihitung ulang.')
    return null
  }

  const saveWallet = async (wallet: HouseholdWallet) => {
    if (!wallet.name.trim()) return 'Tulis nama dompet terlebih dahulu.'
    if (!isMoney(wallet.openingBalance, true)) return 'Saldo awal harus berupa rupiah utuh, minimal Rp0.'
    if (state.wallets.some(item => item.id !== wallet.id && item.name.trim().toLowerCase() === wallet.name.trim().toLowerCase())) return 'Nama dompet ini sudah digunakan.'
    if (walletBalance(wallet, state.transactions) < 0) return 'Saldo awal terlalu kecil untuk transaksi yang sudah dicatat.'
    setState(current => ({ ...current, wallets: [...current.wallets.filter(item => item.id !== wallet.id), wallet] }))
    finish('Dompet berhasil disimpan dalam pratinjau.')
    return null
  }

  const deleteWallet = async (id: string) => {
    if (state.transactions.some(item => item.walletId === id || item.toWalletId === id)) return 'Dompet ini masih memiliki transaksi. Pindahkan atau hapus transaksinya terlebih dahulu.'
    setState(current => ({ ...current, wallets: current.wallets.filter(wallet => wallet.id !== id) }))
    finish('Dompet berhasil dihapus.')
    return null
  }

  const saveBudget = async (budget: BudgetSettings) => {
    if (Object.values(budget).some(value => !isMoney(value))) return 'Semua batas anggaran harus lebih dari Rp0 dan berupa rupiah utuh.'
    setState(current => ({ ...current, budget }))
    finish('Anggaran pratinjau berhasil diperbarui.')
    return null
  }

  const saveEvent = async (event: HouseholdEvent) => {
    if (!event.title.trim() || !event.date || !event.time) return 'Lengkapi nama, tanggal, dan waktu agenda.'
    setState(current => ({ ...current, events: [...current.events.filter(item => item.id !== event.id), event] }))
    finish('Agenda berhasil disimpan.')
    return null
  }

  const deleteEvent = async (id: string) => {
    setState(current => ({ ...current, events: current.events.filter(item => item.id !== id) }))
    finish('Agenda berhasil dihapus.')
    return null
  }

  const toggleEvent = async (id: string) => { setState(current => ({ ...current, events: current.events.map(item => item.id === id ? { ...item, isDone: !item.isDone } : item) })); return null }

  const saveBill = async (bill: HouseholdBill) => {
    if (!bill.title.trim() || !bill.dueDate || !isMoney(bill.amount)) return 'Lengkapi nama, jatuh tempo, dan nominal tagihan yang valid.'
    if (state.bills.find(item => item.id === bill.id)?.isPaid) return 'Batalkan status lunas terlebih dahulu sebelum mengubah tagihan.'
    setState(current => ({ ...current, bills: [...current.bills.filter(item => item.id !== bill.id), bill] }))
    finish('Tagihan berhasil disimpan.')
    return null
  }

  const deleteBill = async (id: string) => {
    setState(current => ({ ...current, bills: current.bills.filter(item => item.id !== id), transactions: current.transactions.map(item => item.billId === id ? { ...item, billId: undefined } : item) }))
    finish('Tagihan dihapus. Riwayat transaksi tetap tersimpan dalam sesi.')
    return null
  }

  const payBill = async (id: string, walletId: string, recordedBy: Transaction['recordedBy'], recordedByUserId?: string) => {
    const bill = state.bills.find(item => item.id === id)
    if (!bill || bill.isPaid) return 'Tagihan tidak tersedia atau sudah lunas.'
    const entry: Transaction = { id: makeId(), kind: 'expense', title: bill.title, amount: bill.amount, walletId, billId: id, category: 'tagihan', recordedBy, recordedByUserId, pocket: 'household', date: TODAY }
    const error = validateTransaction(entry, state)
    if (error) return error
    setState(current => ({ ...current, transactions: [entry, ...current.transactions], bills: current.bills.map(item => item.id === id ? { ...item, isPaid: true, paidBy: recordedBy, paidByUserId: recordedByUserId } : item) }))
    finish('Simulasi lunas dicatat. Tidak ada pembayaran bank sungguhan.')
    return null
  }

  const unpayBill = async (id: string) => {
    const hasPayment = state.transactions.some(item => item.billId === id)
    const remaining = state.transactions.filter(item => item.billId !== id)
    setState(current => ({ ...current, transactions: remaining, bills: current.bills.map(item => item.id === id ? { ...item, isPaid: false, paidBy: undefined, paidByUserId: undefined } : item) }))
    finish(hasPayment ? 'Status lunas dibatalkan dan saldo pratinjau dikembalikan.' : 'Status lunas contoh dibatalkan. Tidak ada transaksi pembayaran dalam sesi ini.')
    return null
  }

  const saveGoal = async (goal: SavingGoal) => {
    if (!goal.title.trim() || !goal.targetDate || !isMoney(goal.targetAmount) || !isMoney(goal.openingAmount, true)) return 'Lengkapi nama, target tanggal, dan nominal tabungan yang valid.'
    setState(current => ({ ...current, goals: [...current.goals.filter(item => item.id !== goal.id), goal] }))
    finish('Impian berhasil disimpan.')
    return null
  }

  const deleteGoal = async (id: string) => {
    if (state.transactions.some(item => item.goalId === id)) return 'Impian ini sudah memiliki setoran. Hapus catatan setorannya dahulu agar saldo tetap konsisten.'
    setState(current => ({ ...current, goals: current.goals.filter(item => item.id !== id) }))
    finish('Impian berhasil dihapus.')
    return null
  }

  const saveDocument = async (document: HouseholdDocument) => {
    if (!document.title.trim() || !isDateKey(document.expiryDate)) return 'Lengkapi nama dokumen dan tanggal masa berlaku yang valid.'
    setState(current => ({ ...current, documents: [...current.documents.filter(item => item.id !== document.id), document] }))
    finish('Catatan dokumen berhasil disimpan dalam pratinjau.')
    return null
  }

  const deleteDocument = async (id: string) => {
    setState(current => ({ ...current, documents: current.documents.filter(item => item.id !== id) }))
    finish('Catatan dokumen berhasil dihapus.')
    return null
  }

  const saveContact = async (contact: HouseholdContact) => {
    if (!contact.name.trim()) return 'Tulis nama kontak terlebih dahulu.'
    if (!isPhoneNumber(contact.phone)) return 'Gunakan nomor telepon 3 sampai 15 digit, boleh diawali +.'
    setState(current => ({ ...current, contacts: [...current.contacts.filter(item => item.id !== contact.id), { ...contact, phone: normalizePhone(contact.phone) }] }))
    finish('Kontak berhasil disimpan dalam pratinjau.')
    return null
  }

  const deleteContact = async (id: string) => {
    setState(current => ({ ...current, contacts: current.contacts.filter(item => item.id !== id) }))
    finish('Kontak berhasil dihapus.')
    return null
  }

  const toggleChore = async (id: string, by: Person) => {
    setState(current => ({
      ...current,
      chores: current.chores.map(c => c.id === id ? { ...c, isDone: !c.isDone, lastDoneBy: !c.isDone ? by : c.lastDoneBy } : c)
    }))
    finish('Status tugas rumah diperbarui.')
    return null
  }

  const saveChore = async (chore: { id: string; title: string; assignee: 'suami' | 'istri' | 'berdua'; frequency: 'harian' | 'mingguan' }) => {
    if (!chore.title.trim()) return 'Tulis nama tugas rumah terlebih dahulu.'
    setState(current => ({
      ...current,
      chores: [...current.chores.filter(c => c.id !== chore.id), { ...chore, isDone: false }]
    }))
    finish('Tugas rumah berhasil ditambahkan.')
    return null
  }

  const deleteChore = async (id: string) => {
    setState(current => ({ ...current, chores: current.chores.filter(c => c.id !== id) }))
    finish('Tugas rumah dihapus.')
    return null
  }

  const savePlace = async (place: { id: string; title: string; location: string; category: 'kopi' | 'makan' | 'jalan' | 'liburan'; estBudget?: number; notes?: string }) => {
    if (!place.title.trim()) return 'Tulis nama tempat terlebih dahulu.'
    setState(current => ({
      ...current,
      places: [...current.places.filter(p => p.id !== place.id), place]
    }))
    finish('Tempat kencan disimpan.')
    return null
  }

  const deletePlace = async (id: string) => {
    setState(current => ({ ...current, places: current.places.filter(p => p.id !== id) }))
    finish('Tempat kencan dihapus.')
    return null
  }

  const saveDebt = async (debt: DebtLoan) => {
    if (!debt.title.trim()) return 'Tulis nama pinjaman/utang.'
    if (debt.totalAmount <= 0) return 'Nominal harus lebih dari 0.'
    setState(current => ({
      ...current,
      debts: [...current.debts.filter(d => d.id !== debt.id), debt]
    }))
    finish('Data utang/KPR berhasil disimpan.')
    return null
  }

  const deleteDebt = async (id: string) => {
    setState(current => ({ ...current, debts: current.debts.filter(d => d.id !== id), debtPayments: current.debtPayments.filter(p => p.debtId !== id) }))
    finish('Data utang/KPR dihapus.')
    return null
  }

  const saveDebtPayment = async (debt: DebtLoan, payment: DebtPayment) => {
    if (!isMoney(payment.amount)) return 'Nominal harus berupa rupiah utuh dan lebih dari Rp0.'
    if (payment.amount > debt.remainingAmount) return `Nominal tidak boleh melebihi sisa saat ini (${money(debt.remainingAmount)}).`
    if (!isDateKey(payment.paidDate)) return 'Pilih tanggal pembayaran yang valid.'
    setState(current => ({
      ...current,
      debts: current.debts.map(d => d.id === debt.id ? { ...d, remainingAmount: d.remainingAmount - payment.amount } : d),
      debtPayments: [payment, ...current.debtPayments.filter(p => p.id !== payment.id)]
    }))
    finish(debt.type === 'piutang' ? 'Pengembalian berhasil dicatat.' : 'Pembayaran berhasil dicatat.')
    return null
  }

  const deleteDebtPayment = async (debt: DebtLoan, payment: DebtPayment) => {
    setState(current => ({
      ...current,
      debts: current.debts.map(d => d.id === debt.id ? { ...d, remainingAmount: Math.min(d.totalAmount, d.remainingAmount + payment.amount) } : d),
      debtPayments: current.debtPayments.filter(p => p.id !== payment.id)
    }))
    finish('Riwayat pembayaran dihapus. Sisa dikembalikan seperti semula.')
    return null
  }

  const saveMemory = async (memory: JournalMemory) => {
    if (!memory.title.trim()) return 'Tulis judul momen berdua.'
    setState(current => ({
      ...current,
      memories: [memory, ...current.memories.filter(m => m.id !== memory.id)]
    }))
    finish('Momen berdua berhasil dicatat.')
    return null
  }

  const deleteMemory = async (id: string) => {
    setState(current => ({ ...current, memories: current.memories.filter(m => m.id !== id) }))
    finish('Momen dihapus.')
    return null
  }

  const saveInvestment = async (holding: InvestmentHolding) => {
    if (!holding.symbol.trim()) return 'Tulis kode asetnya terlebih dahulu.'
    if (!Number.isFinite(holding.quantity) || holding.quantity <= 0) return 'Jumlah pegangan harus lebih dari 0.'
    if (!Number.isFinite(holding.avgPrice) || holding.avgPrice < 0) return 'Harga beli rata-rata tidak valid, minimal Rp0 (desimal boleh).'
    setState(current => ({ ...current, investments: [...current.investments.filter(item => item.id !== holding.id), { ...holding, symbol: holding.symbol.trim().toUpperCase() }] }))
    finish('Aset investasi berhasil disimpan dalam pratinjau.')
    return null
  }

  const deleteInvestment = async (id: string) => {
    setState(current => ({ ...current, investments: current.investments.filter(item => item.id !== id) }))
    finish('Aset investasi dihapus.')
    return null
  }

  const saveShopping = async (item: ShoppingItem) => { setState(current => ({ ...current, shopping: [item, ...current.shopping.filter(row => row.id !== item.id)] })); return null }
  const deleteShopping = async (id: string) => { setState(current => ({ ...current, shopping: current.shopping.filter(row => row.id !== id) })); return null }
  const saveIdea = async (kind: 'food' | 'date', title: string) => {
    setState(current => kind === 'food' ? { ...current, foodIdeas: [...current.foodIdeas, { id: makeId(), title, type: 'masak', tag: '' }] }
      : { ...current, dateIdeas: [...current.dateIdeas, { id: makeId(), title }] })
    return null
  }
  const deleteIdea = async (kind: 'food' | 'date', id: string) => { setState(current => kind === 'food' ? { ...current, foodIdeas: current.foodIdeas.filter(row => row.id !== id) } : { ...current, dateIdeas: current.dateIdeas.filter(row => row.id !== id) }); return null }
  return { state, editor, setEditor, notice, setNotice, pending: false, isPreview: true, refreshError: '', refreshing: false, refresh: async () => {}, saveTransaction, deleteTransaction, saveWallet, deleteWallet, saveBudget, saveEvent, deleteEvent, toggleEvent, saveBill, deleteBill, payBill, unpayBill, saveGoal, deleteGoal, saveDocument, deleteDocument, saveContact, deleteContact, toggleChore, saveChore, deleteChore, savePlace, deletePlace, saveShopping, deleteShopping, saveIdea, deleteIdea, saveDebt, deleteDebt, saveDebtPayment, deleteDebtPayment, saveMemory, deleteMemory, saveInvestment, deleteInvestment }
}

type MutationResult = Promise<string | null>
export interface HouseholdStore {
  state: HouseholdState
  editor: Editor | null
  setEditor: (editor: Editor | null) => void
  notice: string
  setNotice: (notice: string) => void
  pending: boolean
  isPreview: boolean
  refreshError: string
  refreshing: boolean
  refresh: () => Promise<void>
  saveTransaction: (entry: Transaction) => MutationResult
  deleteTransaction: (id: string) => MutationResult
  saveWallet: (wallet: HouseholdWallet) => MutationResult
  deleteWallet: (id: string) => MutationResult
  saveBudget: (budget: BudgetSettings) => MutationResult
  saveEvent: (event: HouseholdEvent) => MutationResult
  deleteEvent: (id: string) => MutationResult
  toggleEvent: (id: string) => MutationResult
  saveBill: (bill: HouseholdBill) => MutationResult
  deleteBill: (id: string) => MutationResult
  payBill: (id: string, walletId: string, role: Person, userId?: string) => MutationResult
  unpayBill: (id: string) => MutationResult
  saveGoal: (goal: SavingGoal) => MutationResult
  deleteGoal: (id: string) => MutationResult
  saveDocument: (document: HouseholdDocument) => MutationResult
  deleteDocument: (id: string) => MutationResult
  saveContact: (contact: HouseholdContact) => MutationResult
  deleteContact: (id: string) => MutationResult
  toggleChore: (id: string, by: Person) => MutationResult
  saveChore: (chore: { id: string; title: string; assignee: 'suami' | 'istri' | 'berdua'; frequency: 'harian' | 'mingguan' }) => MutationResult
  deleteChore: (id: string) => MutationResult
  savePlace: (place: { id: string; title: string; location: string; category: 'kopi' | 'makan' | 'jalan' | 'liburan'; estBudget?: number; notes?: string }) => MutationResult
  deletePlace: (id: string) => MutationResult
  saveShopping: (item: ShoppingItem) => MutationResult
  deleteShopping: (id: string) => MutationResult
  saveIdea: (kind: 'food' | 'date', title: string) => MutationResult
  deleteIdea: (kind: 'food' | 'date', id: string) => MutationResult
  saveDebt: (debt: DebtLoan) => MutationResult
  deleteDebt: (id: string) => MutationResult
  saveDebtPayment: (debt: DebtLoan, payment: DebtPayment) => MutationResult
  deleteDebtPayment: (debt: DebtLoan, payment: DebtPayment) => MutationResult
  saveMemory: (memory: JournalMemory) => MutationResult
  deleteMemory: (id: string) => MutationResult
  saveInvestment: (holding: InvestmentHolding) => MutationResult
  deleteInvestment: (id: string) => MutationResult
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  return <HouseholdContext.Provider value={useStore()}>{children}</HouseholdContext.Provider>
}
