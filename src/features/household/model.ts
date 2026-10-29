import type { FoodIdea, ShoppingItem } from '../../types'

export type Person = 'suami' | 'istri'
export type TransactionKind = 'expense' | 'income' | 'transfer' | 'saving'
export type WalletKind = 'cash' | 'bank' | 'ewallet'

export interface HouseholdWallet {
  id: string
  name: string
  kind: WalletKind
  openingBalance: number
  owner: 'berdua' | Person
}

export interface Transaction {
  id: string
  kind: TransactionKind
  title: string
  amount: number
  walletId: string
  toWalletId?: string
  goalId?: string
  billId?: string
  category: string
  recordedBy: Person
  recordedByUserId?: string
  pocket: 'household' | Person
  date: string
}

export interface BudgetSettings {
  daily: number
  monthly: number
  suami: number
  istri: number
}

export interface HouseholdEvent {
  id: string
  title: string
  date: string
  time: string
  assignee: 'berdua' | Person
  note: string
  isDone: boolean
}

export interface HouseholdBill {
  id: string
  title: string
  amount: number
  dueDate: string
  customerNumber: string
  isPaid: boolean
  paidBy?: Person
  paidByUserId?: string
}

export interface SavingGoal {
  id: string
  title: string
  targetAmount: number
  openingAmount: number
  targetDate: string
}

export interface HouseholdDocument {
  id: string
  title: string
  category: 'kendaraan' | 'lisensi' | 'garansi' | 'rumah' | 'lainnya'
  expiryDate: string
  note: string
}

export interface HouseholdContact {
  id: string
  name: string
  role: string
  phone: string
  category: 'keamanan' | 'servis' | 'medis' | 'rt' | 'lainnya'
}

export interface ChoreItem {
  id: string
  title: string
  assignee: 'suami' | 'istri' | 'berdua'
  frequency: 'harian' | 'mingguan'
  isDone: boolean
  lastDoneBy?: Person
  lastDoneAt?: string
}

export interface WishlistPlace {
  id: string
  title: string
  location: string
  category: 'kopi' | 'makan' | 'jalan' | 'liburan'
  estBudget?: number
  notes?: string
}

export const documentCategories = [
  ['rumah', 'Dokumen rumah'], ['kendaraan', 'Kendaraan'], ['lisensi', 'SIM / lisensi'], ['garansi', 'Garansi'], ['lainnya', 'Lainnya'],
] as const
export const contactCategories = [
  ['servis', 'Servis & perawatan'], ['keamanan', 'Keamanan'], ['medis', 'Kesehatan'], ['rt', 'Lingkungan / RT'], ['lainnya', 'Lainnya'],
] as const
export const memoryCategories = [
  ['kencan', 'Kencan'], ['milestone', 'Momen penting'], ['liburan', 'Liburan'], ['rumah', 'Rumah'],
] as const

export interface DebtLoan {
  id: string
  title: string
  type: 'kpr' | 'kendaraan' | 'personal' | 'piutang'
  lenderOrBorrower: string
  totalAmount: number
  remainingAmount: number
  monthlyPayment?: number
  dueDay?: number
  tenorMonths?: number
  remainingMonths?: number
  creditCardFunded?: boolean
  notes?: string
}

export interface DebtPayment {
  id: string
  debtId: string
  amount: number
  paidDate: string
  note: string
}

export interface JournalMemory {
  id: string
  title: string
  date: string
  note: string
  category: 'kencan' | 'milestone' | 'liburan' | 'rumah'
  recordedBy: Person
}

export interface HouseholdState {
  wallets: HouseholdWallet[]
  transactions: Transaction[]
  budget: BudgetSettings
  events: HouseholdEvent[]
  bills: HouseholdBill[]
  goals: SavingGoal[]
  documents: HouseholdDocument[]
  contacts: HouseholdContact[]
  chores: ChoreItem[]
  places: WishlistPlace[]
  shopping: ShoppingItem[]
  foodIdeas: FoodIdea[]
  dateIdeas: { id: string; title: string }[]
  debts: DebtLoan[]
  debtPayments: DebtPayment[]
  memories: JournalMemory[]
}

export const money = (value: number) => {
  if (value < 0) return `-Rp${Math.abs(value).toLocaleString('id-ID')}`
  return `Rp${value.toLocaleString('id-ID')}`
}
export const personName = (value: string) => value === 'suami' ? 'Rudi' : value === 'istri' ? 'Istri' : 'Berdua'
export const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
export const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export const TODAY = dateKey(new Date())
export const formatDate = (date: string, options?: Intl.DateTimeFormatOptions) => new Date(`${date}T12:00:00`).toLocaleDateString('id-ID', options ?? { day: 'numeric', month: 'short', year: 'numeric' })
export const isMoney = (amount: number, allowZero = false) => Number.isSafeInteger(amount) && amount >= (allowZero ? 0 : 1) && amount <= 999999999999
export const isDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(new Date(`${value}T12:00:00`)) === value
export const normalizePhone = (value: string) => value.replace(/[\s()-]/g, '')
export const isPhoneNumber = (value: string) => /^\+?\d{3,15}$/.test(normalizePhone(value))
export const daysUntil = (date: string, today = TODAY) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)

export function walletBalance(wallet: HouseholdWallet, transactions: Transaction[]): number {
  return transactions.reduce((balance, entry) => {
    if (entry.kind === 'income' && entry.walletId === wallet.id) return balance + entry.amount
    if (entry.kind === 'transfer' && entry.toWalletId === wallet.id) return balance + entry.amount
    if (entry.kind !== 'income' && entry.walletId === wallet.id) return balance - entry.amount
    return balance
  }, wallet.openingBalance)
}

export function goalBalance(goal: SavingGoal, transactions: Transaction[]): number {
  return goal.openingAmount + transactions.filter(entry => entry.kind === 'saving' && entry.goalId === goal.id).reduce((sum, entry) => sum + entry.amount, 0)
}

export function spentIn(transactions: Transaction[], period: string, pocket?: Transaction['pocket']): number {
  return transactions.filter(entry => entry.kind === 'expense' && entry.date.startsWith(period) && (!pocket || entry.pocket === pocket)).reduce((sum, entry) => sum + entry.amount, 0)
}

export function validateTransaction(entry: Transaction, state: HouseholdState): string | null {
  if (!entry.title.trim()) return 'Tulis nama transaksinya terlebih dahulu.'
  if (!isMoney(entry.amount)) return 'Nominal harus berupa rupiah utuh dan lebih dari Rp0.'
  if (!isDateKey(entry.date)) return 'Pilih tanggal transaksi yang valid.'
  if (!state.wallets.some(wallet => wallet.id === entry.walletId)) return 'Pilih dompet yang tersedia.'
  if (entry.kind === 'transfer') {
    if (!state.wallets.some(wallet => wallet.id === entry.toWalletId)) return 'Pilih dompet tujuan.'
    if (entry.walletId === entry.toWalletId) return 'Dompet asal dan tujuan tidak boleh sama.'
  }
  if (entry.kind === 'saving' && !state.goals.some(goal => goal.id === entry.goalId)) return 'Pilih impian yang ingin ditabung.'
  const nextEntries = [entry, ...state.transactions.filter(item => item.id !== entry.id)]
  const overdrawn = state.wallets.find(wallet => walletBalance(wallet, nextEntries) < 0)
  if (overdrawn) return `Saldo ${overdrawn.name} tidak cukup. Pilih dompet lain atau kurangi nominal.`
  return null
}

export function validateTransactionDeletion(id: string, state: HouseholdState): string | null {
  const remaining = state.transactions.filter(item => item.id !== id)
  const overdrawn = state.wallets.find(wallet => walletBalance(wallet, remaining) < 0)
  return overdrawn ? `Transaksi ini sudah dipakai oleh transaksi lain. Penghapusannya akan membuat saldo ${overdrawn.name} negatif.` : null
}
