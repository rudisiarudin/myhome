import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { errorMessage } from '../../lib/errors'
import { AppLogoIcon } from '../../components/AppLogo'
import { HouseholdContext } from './context'
import type { Editor, HouseholdStore } from './store'
import type { DebtLoan, HouseholdState, InvestmentHolding } from './model'
import { TODAY } from './model'
import { createHouseholdRepository } from './repository'

export function ConnectedHouseholdProvider({ client, householdId, children }: {
  client: SupabaseClient; householdId: string; children: ReactNode
}) {
  const repository = useMemo(() => createHouseholdRepository(client, householdId), [client, householdId])
  const [state, setState] = useState<HouseholdState | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const [refreshing, setRefreshing] = useState(true)
  const [refreshError, setRefreshError] = useState('')
  const busy = useRef(false)
  const alive = useRef(true)
  const epoch = useRef(0)
  const editorRef = useRef(editor)
  useEffect(() => { editorRef.current = editor }, [editor])
  const invalidate = useCallback(() => { alive.current = false; ++epoch.current }, [])

  const refresh = useCallback(async () => {
    if (busy.current) return
    const version = ++epoch.current
    setRefreshing(true)
    try {
      const data = await repository.load()
      if (alive.current && version === epoch.current) { setState(data); setRefreshError('') }
    } catch (error) {
      if (alive.current && version === epoch.current) setRefreshError(errorMessage(error))
    } finally {
      if (alive.current && version === epoch.current) setRefreshing(false)
    }
  }, [repository])

  useEffect(() => {
    alive.current = true
    queueMicrotask(() => { if (alive.current) void refresh() })
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    const timer = window.setInterval(onFocus, 30000)
    let debounce: ReturnType<typeof setTimeout>
    const channel = client.channel(`myhome-${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'myhome' }, () => {
        clearTimeout(debounce)
        debounce = setTimeout(onFocus, 300)
      }).subscribe()
    return () => {
      invalidate()
      clearTimeout(debounce)
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      void client.removeChannel(channel)
    }
  }, [client, householdId, refresh, invalidate])

  const run = async (action: () => Promise<void>, message = 'Perubahan tersimpan.') => {
    if (busy.current) return 'Tunggu sampai penyimpanan selesai.'
    if (refreshError) return 'Muat ulang data terlebih dahulu sebelum menyimpan perubahan.'
    busy.current = true
    ++epoch.current
    setPending(true)
    const currentEditor = editorRef.current
    try {
      await action()
      if (!alive.current) return null
      // Jangan laporkan gagal simpan jika write sukses namun refetch gagal:
      // pengguna bisa mengirim ulang dan membuat transaksi duplikat.
      try { const fresh = await repository.load(); if (alive.current) { setState(fresh); setRefreshError('') } }
      catch (error) { if (alive.current) setRefreshError(`Perubahan sudah tersimpan, tetapi data terbaru gagal dimuat. ${errorMessage(error)}`) }
      if (alive.current) {
        if (editorRef.current === currentEditor) setEditor(null)
        setNotice(message)
      }
      return null
    } catch (error) {
      const message = errorMessage(error)
      if (alive.current) setNotice(message)
      return message
    } finally {
      busy.current = false
      if (alive.current) { setPending(false); setRefreshing(false) }
    }
  }

  if (!state) {
    // Saat memuat normal: splash logo tanpa teks. Teks hanya muncul bila
    // benar-benar gagal, karena di situlah pengguna butuh penjelasan.
    if (!refreshError) return <div className="app-splash" role="status" aria-label="Memuat Myhome"><AppLogoIcon size={56} /></div>
    return <section className="connection-state" aria-busy={refreshing}>
      <h1>Data rumah belum bisa dimuat</h1>
      <p role="alert">{refreshError}</p>
      <button className="primary-button" disabled={refreshing} onClick={() => void refresh()}>Coba muat ulang</button>
    </section>
  }

  const debtData = (debt: DebtLoan) => ({ title: debt.title, type: debt.type, lender_or_borrower: debt.lenderOrBorrower, total_amount: debt.totalAmount, remaining_amount: debt.remainingAmount, monthly_payment: debt.monthlyPayment ?? null, due_day: debt.dueDay ?? null, tenor_months: debt.tenorMonths ?? null, remaining_months: debt.remainingMonths ?? null, credit_card_funded: debt.creditCardFunded ?? false, notes: debt.notes ?? '' })
  const investmentData = (holding: InvestmentHolding) => ({ kind: holding.kind, symbol: holding.symbol, name: holding.name, quantity: holding.quantity, avg_price: holding.avgPrice })
  const existing = (items: { id: string }[], id: string) => items.some(item => item.id === id) ? id : undefined
  const financialId = (items: { id: string }[], id: string) => ({ id: existing(items, id) })
  const remove = (table: string, id: string) => run(() => repository.remove(table, id), 'Catatan dihapus.')
  const removeFinancial = (table: string, id: string) => run(() => repository.removeFinancial(table, id), 'Catatan dihapus dan saldo dihitung ulang.')
  const value: HouseholdStore = {
    state, editor, setEditor, notice, setNotice, pending, isPreview: false, refreshing, refreshError, refresh,
    saveTransaction: entry => run(() => repository.saveFinancial('transaction', {
      ...financialId(state.transactions, entry.id), kind: entry.kind, title: entry.title, amount: entry.amount,
      wallet_id: entry.walletId, to_wallet_id: entry.toWalletId, goal_id: entry.goalId,
      category: entry.category, pocket: entry.pocket, date: entry.date,
    })),
    deleteTransaction: id => removeFinancial('transactions', id),
    saveWallet: wallet => run(() => repository.saveFinancial('wallet', { ...financialId(state.wallets, wallet.id), name: wallet.name, kind: wallet.kind, owner: wallet.owner, opening_balance: wallet.openingBalance })),
    deleteWallet: id => removeFinancial('wallets', id),
    saveGoal: goal => run(() => repository.saveFinancial('goal', { ...financialId(state.goals, goal.id), title: goal.title, target_amount: goal.targetAmount, opening_amount: goal.openingAmount, target_date: goal.targetDate })),
    deleteGoal: id => removeFinancial('saving_goals', id),
    saveBill: bill => run(() => repository.saveFinancial('bill', { ...financialId(state.bills, bill.id), title: bill.title, amount: bill.amount, due_date: bill.dueDate, customer_number: bill.customerNumber })),
    deleteBill: id => removeFinancial('bills', id),
    payBill: (id, walletId) => run(() => repository.pay(id, walletId, TODAY), 'Tagihan tercatat lunas. Tidak ada pembayaran bank otomatis.'),
    unpayBill: id => run(() => repository.unpay(id), 'Status lunas dibatalkan dan saldo catatan dikembalikan.'),
    saveBudget: budget => run(() => repository.budget({ daily_budget: budget.daily, monthly_budget: budget.monthly, suami_pocket_budget: budget.suami, istri_pocket_budget: budget.istri })),
    saveEvent: event => run(() => repository.save('events', { title: event.title, date: event.date, time: event.time, assignee: event.assignee, note: event.note, is_done: event.isDone }, existing(state.events, event.id))),
    deleteEvent: id => remove('events', id),
    toggleEvent: id => run(() => repository.save('events', { is_done: !state.events.find(item => item.id === id)?.isDone }, id)),
    saveDocument: document => run(() => repository.save('documents', { title: document.title, category: document.category, expiry_date: document.expiryDate, note: document.note }, existing(state.documents, document.id))),
    deleteDocument: id => remove('documents', id),
    saveContact: contact => run(() => repository.save('contacts', { name: contact.name, role: contact.role, phone: contact.phone, category: contact.category }, existing(state.contacts, contact.id))),
    deleteContact: id => remove('contacts', id),
    saveChore: chore => run(() => repository.save('chores', { title: chore.title, assignee: chore.assignee, frequency: chore.frequency }, existing(state.chores, chore.id))),
    toggleChore: id => run(() => repository.save('chores', { is_done: !state.chores.find(item => item.id === id)?.isDone }, id)),
    deleteChore: id => remove('chores', id),
    savePlace: place => run(() => repository.save('wishlist_places', { title: place.title, location: place.location, category: place.category, est_budget: place.estBudget ?? null, notes: place.notes ?? '' }, existing(state.places, place.id))),
    deletePlace: id => remove('wishlist_places', id),
    saveShopping: item => run(() => repository.save('shopping_items', { title: item.title, is_bought: item.isBought }, existing(state.shopping, item.id))),
    deleteShopping: id => remove('shopping_items', id),
    saveIdea: (kind, title) => run(() => repository.save(kind === 'food' ? 'food_ideas' : 'date_ideas', { title, ...(kind === 'food' ? { type: 'masak', tag: '' } : {}) })),
    deleteIdea: (kind, id) => remove(kind === 'food' ? 'food_ideas' : 'date_ideas', id),
    saveDebt: debt => run(() => repository.save('debts', debtData(debt), existing(state.debts, debt.id))),
    deleteDebt: id => remove('debts', id),
    saveDebtPayment: (debt, payment) => run(async () => {
      await repository.save('debt_payments', { debt_id: payment.debtId, amount: payment.amount, paid_date: payment.paidDate, note: payment.note }, existing(state.debtPayments, payment.id))
      await repository.save('debts', debtData({ ...debt, remainingAmount: debt.remainingAmount - payment.amount }), debt.id)
    }, debt.type === 'piutang' ? 'Pengembalian berhasil dicatat.' : 'Pembayaran berhasil dicatat.'),
    deleteDebtPayment: (debt, payment) => run(async () => {
      await repository.remove('debt_payments', payment.id)
      await repository.save('debts', debtData({ ...debt, remainingAmount: Math.min(debt.totalAmount, debt.remainingAmount + payment.amount) }), debt.id)
    }, 'Riwayat pembayaran dihapus. Sisa dikembalikan seperti semula.'),
    saveMemory: memory => run(() => repository.save('memories', { title: memory.title, date: memory.date, note: memory.note, category: memory.category, recorded_by: memory.recordedBy }, existing(state.memories, memory.id))),
    deleteMemory: id => remove('memories', id),
    saveInvestment: holding => run(() => repository.save('investments', investmentData(holding), existing(state.investments, holding.id)), 'Aset investasi tersimpan.'),
    deleteInvestment: id => remove('investments', id),
  }
  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}
