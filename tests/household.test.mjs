import test from 'node:test'
import assert from 'node:assert/strict'
import { daysUntil, isDateKey, isPhoneNumber, normalizePhone, walletBalance, goalBalance, spentIn, validateTransaction, validateTransactionDeletion } from '../src/features/household/model.ts'

const wallets = [ { id: 'cash', name: 'Tunai', openingBalance: 500000, kind: 'cash', owner: 'berdua' }, { id: 'bank', name: 'Bank', openingBalance: 1000000, kind: 'bank', owner: 'berdua' } ]
const goals = [{ id: 'goal', title: 'Liburan', openingAmount: 200000, targetAmount: 1000000, targetDate: '2026-12-31' }]
const entry = overrides => ({ id: 'one', kind: 'expense', title: 'Belanja', walletId: 'cash', amount: 50000, category: 'makan', recordedBy: 'suami', pocket: 'household', date: '2026-10-18', ...overrides })
const state = transactions => ({ wallets, goals, transactions, bills: [], events: [], budget: { daily: 250000, monthly: 7500000, suami: 1000000, istri: 1000000 } })

test('income and expenses derive wallet balances without mutating opening balances', () => {
  const entries = [entry(), entry({ id: 'two', kind: 'income', amount: 100000 })]
  assert.equal(walletBalance(wallets[0], entries), 550000)
  assert.equal(wallets[0].openingBalance, 500000)
})
test('transfer changes both wallets without changing household total', () => {
  const entries = [entry({ kind: 'transfer', toWalletId: 'bank', amount: 150000 })]
  assert.equal(walletBalance(wallets[0], entries), 350000)
  assert.equal(walletBalance(wallets[1], entries), 1150000)
  assert.equal(wallets.reduce((sum, wallet) => sum + walletBalance(wallet, entries), 0), 1500000)
})
test('saving deducts a wallet and adds to the correct goal without counting as spending', () => {
  const entries = [entry({ kind: 'saving', goalId: 'goal', amount: 100000 })]
  assert.equal(walletBalance(wallets[0], entries), 400000)
  assert.equal(goalBalance(goals[0], entries), 300000)
  assert.equal(spentIn(entries, '2026-10'), 0)
})
test('daily, monthly and pocket budgets count only matching expenses', () => {
  const entries = [entry(), entry({ id: '2', pocket: 'suami', amount: 20000 }), entry({ id: '3', date: '2026-09-01', amount: 10000 }), entry({ id: '4', kind: 'transfer', toWalletId: 'bank' })]
  assert.equal(spentIn(entries, '2026-10-18', 'household'), 50000)
  assert.equal(spentIn(entries, '2026-10', 'suami'), 20000)
  assert.equal(spentIn(entries, '2026-10'), 70000)
})
test('editing replaces the old transaction rather than charging it twice', () => {
  assert.equal(validateTransaction(entry({ amount: 450000 }), state([entry({ amount: 100000 })])), null)
})
test('editing an incoming transfer cannot overdraw its recipient wallet', () => {
  const entries = [entry({ kind: 'transfer', toWalletId: 'bank', amount: 500000 }), entry({ id: 'spend', walletId: 'bank', amount: 1400000 })]
  assert.match(validateTransaction(entry({ kind: 'transfer', toWalletId: 'bank', amount: 100000 }), state(entries)), /tidak cukup/)
})
test('expense with insufficient funds is blocked', () => assert.match(validateTransaction(entry({ amount: 500001 }), state([])), /tidak cukup/))
test('zero, negative and fractional amounts are blocked', () => {
  for (const amount of [0, -1, 1.5, Infinity, NaN]) assert.match(validateTransaction(entry({ amount }), state([])), /Nominal/)
})
test('same-wallet transfer is blocked', () => assert.match(validateTransaction(entry({ kind: 'transfer', toWalletId: 'cash' }), state([])), /tidak boleh sama/))
test('missing source, destination and goal are blocked', () => {
  assert.match(validateTransaction(entry({ walletId: 'missing' }), state([])), /dompet/)
  assert.match(validateTransaction(entry({ kind: 'transfer', toWalletId: 'missing' }), state([])), /tujuan/)
  assert.match(validateTransaction(entry({ kind: 'saving', goalId: 'missing' }), state([])), /impian/)
})
test('impossible calendar dates are blocked', () => assert.match(validateTransaction(entry({ date: '2026-02-31' }), state([])), /tanggal/))
test('deleting income already consumed by expenses is blocked', () => {
  const entries = [entry({ id: 'income', kind: 'income', amount: 200000 }), entry({ id: 'spending', amount: 600000 })]
  assert.match(validateTransactionDeletion('income', state(entries)), /negatif/)
})
test('deleting outgoing transfer is blocked if recipient has spent its balance', () => {
  const entries = [entry({ id: 'transfer', kind: 'transfer', amount: 200000, toWalletId: 'bank' }), entry({ id: 'spend', walletId: 'bank', amount: 1100000 })]
  assert.match(validateTransactionDeletion('transfer', state(entries)), /negatif/)
})
test('deleting expense restores balance', () => assert.equal(validateTransactionDeletion('one', state([entry()])), null))

test('document expiry counts calendar days and handles expired or same-day dates', () => {
  assert.equal(daysUntil('2026-10-21', '2026-10-18'), 3)
  assert.equal(daysUntil('2026-10-17', '2026-10-18'), -1)
  assert.equal(daysUntil('2026-10-18', '2026-10-18'), 0)
})
test('document dates validate leap years and reject invalid calendar values', () => {
  assert.ok(isDateKey('2028-02-29'))
  assert.ok(!isDateKey('2026-02-29'))
  assert.ok(!isDateKey('2026-13-01'))
  assert.ok(!isDateKey(''))
})
test('contact numbers normalize punctuation while retaining an international prefix', () => {
  assert.equal(normalizePhone(' +62 (812) 3456-7890 '), '+6281234567890')
  assert.ok(isPhoneNumber(' +62 (812) 3456-7890 '))
  assert.ok(isPhoneNumber('112'))
})
test('contact number validation rejects letters, misplaced plus signs and invalid lengths', () => {
  for (const value of ['', 'ab123456', '12', '1234567890123456', '++628123456', '0812+3456']) assert.ok(!isPhoneNumber(value))
})
