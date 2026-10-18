import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserProfile } from '../../types'
import type { HouseholdState, Person, Transaction, HouseholdWallet, HouseholdDocument, HouseholdContact, WishlistPlace } from './model'

export type Row = Record<string, unknown>
const text = (row: Row, key: string) => String(row[key] ?? '')
const optional = (row: Row, key: string) => row[key] == null ? undefined : text(row, key)
const number = (row: Row, key: string) => {
  const value = Number(row[key])
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Nominal database tidak dapat dibaca sebagai rupiah utuh yang aman.')
  return value
}

export function decodeHousehold(rows: Record<string, Row[]>): HouseholdState {
  const budget = rows.household_budgets[0]
  if (!budget) throw new Error('Anggaran rumah tidak ditemukan. Hubungi pengelola database.')
  return {
    budget: { daily: number(budget, 'daily_budget'), monthly: number(budget, 'monthly_budget'), suami: number(budget, 'suami_pocket_budget'), istri: number(budget, 'istri_pocket_budget') },
    wallets: rows.wallets.map(r => ({ id: text(r, 'id'), name: text(r, 'name'), kind: text(r, 'kind') as HouseholdWallet['kind'], owner: text(r, 'owner') as HouseholdWallet['owner'], openingBalance: number(r, 'opening_balance') })),
    transactions: rows.transactions.sort((a, b) => text(b, 'date').localeCompare(text(a, 'date')) || text(b, 'created_at').localeCompare(text(a, 'created_at'))).map(r => ({ id: text(r, 'id'), kind: text(r, 'kind') as Transaction['kind'], title: text(r, 'title'), amount: number(r, 'amount'), walletId: text(r, 'wallet_id'), toWalletId: optional(r, 'to_wallet_id'), goalId: optional(r, 'goal_id'), billId: optional(r, 'bill_id'), category: text(r, 'category'), pocket: text(r, 'pocket') as Transaction['pocket'], recordedBy: text(r, 'recorded_by') as Person, recordedByUserId: optional(r, 'recorded_by_user_id'), date: text(r, 'date') })),
    goals: rows.saving_goals.map(r => ({ id: text(r, 'id'), title: text(r, 'title'), targetAmount: number(r, 'target_amount'), openingAmount: number(r, 'opening_amount'), targetDate: text(r, 'target_date') })),
    bills: rows.bill_status.map(r => ({ id: text(r, 'id'), title: text(r, 'title'), amount: number(r, 'amount'), dueDate: text(r, 'due_date'), customerNumber: text(r, 'customer_number'), isPaid: r.is_paid === true, paidBy: optional(r, 'paid_by') as Person | undefined, paidByUserId: optional(r, 'paid_by_user_id') })),
    events: rows.events.map(r => ({ id: text(r, 'id'), title: text(r, 'title'), date: text(r, 'date'), time: text(r, 'time').slice(0, 5), assignee: text(r, 'assignee') as 'berdua' | Person, note: text(r, 'note'), isDone: r.is_done === true })),
    documents: rows.documents.map(r => ({ id: text(r, 'id'), title: text(r, 'title'), category: text(r, 'category') as HouseholdDocument['category'], expiryDate: text(r, 'expiry_date'), note: text(r, 'note') })),
    contacts: rows.contacts.map(r => ({ id: text(r, 'id'), name: text(r, 'name'), role: text(r, 'role'), phone: text(r, 'phone'), category: text(r, 'category') as HouseholdContact['category'] })),
    chores: rows.chores.map(r => ({ id: text(r, 'id'), title: text(r, 'title'), assignee: text(r, 'assignee') as 'berdua' | Person, frequency: text(r, 'frequency') as 'harian' | 'mingguan', isDone: r.is_done === true, lastDoneBy: optional(r, 'last_done_by') as Person | undefined, lastDoneAt: optional(r, 'last_done_at') })),
    places: rows.wishlist_places.map(r => ({ id: text(r, 'id'), title: text(r, 'title'), location: text(r, 'location'), category: text(r, 'category') as WishlistPlace['category'], estBudget: r.est_budget == null ? undefined : number(r, 'est_budget'), notes: text(r, 'notes') })),
    shopping: rows.shopping_items.map(r => ({ id: text(r, 'id'), title: text(r, 'title'), isBought: r.is_bought === true, addedBy: text(r, 'added_by') as Person })),
    foodIdeas: rows.food_ideas.map(r => ({ id: text(r, 'id'), title: text(r, 'title'), type: text(r, 'type') as 'masak' | 'makan-luar', tag: text(r, 'tag') })),
    dateIdeas: rows.date_ideas.map(r => ({ id: text(r, 'id'), title: text(r, 'title') })),
    debts: (rows.debts ?? []).map(r => ({
      id: text(r, 'id'),
      title: text(r, 'title'),
      type: text(r, 'type') as any,
      lenderOrBorrower: text(r, 'lender_or_borrower'),
      totalAmount: number(r, 'total_amount'),
      remainingAmount: number(r, 'remaining_amount'),
      monthlyPayment: r.monthly_payment == null ? undefined : number(r, 'monthly_payment'),
      dueDay: r.due_day == null ? undefined : Number(r.due_day),
      tenorMonths: r.tenor_months == null ? undefined : Number(r.tenor_months),
      remainingMonths: r.remaining_months == null ? undefined : Number(r.remaining_months),
      notes: optional(r, 'notes')
    })),
    memories: (rows.memories ?? []).map(r => ({
      id: text(r, 'id'),
      title: text(r, 'title'),
      date: text(r, 'date'),
      note: text(r, 'note'),
      category: text(r, 'category') as any,
      recordedBy: text(r, 'recorded_by') as Person
    }))
  }
}

export function createHouseholdRepository(client: SupabaseClient, householdId: string) {
  const db = client.schema('myhome')
  const tables = ['wallets', 'transactions', 'saving_goals', 'bill_status', 'events', 'documents', 'contacts', 'chores', 'wishlist_places', 'shopping_items', 'food_ideas', 'date_ideas']
  const readAll = async (table: string): Promise<Row[]> => {
    const rows: Row[] = []
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from(table).select('*').eq('household_id', householdId).order('id').range(offset, offset + 499)
      if (error) throw error
      rows.push(...data)
      if (data.length < 500) return rows
    }
  }
  return {
    async load() {
      const entries = await Promise.all(tables.map(async table => [table, await readAll(table)] as const))
      const { data, error } = await db.from('household_budgets').select('*').eq('household_id', householdId).single()
      if (error) throw error
      return decodeHousehold({ ...Object.fromEntries(entries), household_budgets: [data] })
    },
    async saveFinancial(entity: string, data: Row) {
      const { error } = await db.rpc(`save_${entity}`, { p_household_id: householdId, p_data: data })
      if (error) throw error
    },
    async removeFinancial(entity: string, id: string) {
      const { error } = await db.rpc('delete_financial_record', { p_household_id: householdId, p_entity: entity, p_id: id })
      if (error) throw error
    },
    async save(table: string, data: Row, id?: string) {
      const query = id ? db.from(table).update(data).eq('household_id', householdId).eq('id', id)
        : db.from(table).insert({ ...data, household_id: householdId })
      const { data: result, error } = await query.select('id').single()
      if (error) throw error
      if (!result) throw new Error('Catatan tidak ditemukan. Muat ulang data.')
    },
    async remove(table: string, id: string) {
      const { error } = await db.from(table).delete().eq('household_id', householdId).eq('id', id).select('id').single()
      if (error) throw error
    },
    async budget(data: Row) {
      const { error } = await db.from('household_budgets').update(data).eq('household_id', householdId).select('household_id').single()
      if (error) throw error
    },
    async pay(billId: string, walletId: string, date: string) {
      const { error } = await db.rpc('pay_bill', { p_household_id: householdId, p_bill_id: billId, p_wallet_id: walletId, p_date: date })
      if (error) throw error
    },
    async unpay(billId: string) {
      const { error } = await db.rpc('unpay_bill', { p_household_id: householdId, p_bill_id: billId })
      if (error) throw error
    },
  }
}

export async function loadIdentity(client: SupabaseClient, userId: string) {
  const db = client.schema('myhome')
  const [profile, member] = await Promise.all([
    db.from('profiles').select('*').eq('id', userId).maybeSingle(),
    db.from('household_members').select('*').eq('user_id', userId).maybeSingle(),
  ])
  if (profile.error) throw profile.error
  if (member.error) throw member.error
  if (!member.data) return { profile: profile.data as Row | null, household: null, members: [] as UserProfile[] }
  const [household, members, profiles] = await Promise.all([
    db.from('households').select('*').eq('id', member.data.household_id).single(),
    db.from('household_members').select('*').eq('household_id', member.data.household_id),
    db.from('profiles').select('*'),
  ])
  if (household.error) throw household.error
  if (members.error) throw members.error
  if (profiles.error) throw profiles.error
  return { profile: profile.data as Row | null, household: household.data as Row,
    members: members.data.map(m => {
      const p = profiles.data.find(p => p.id === m.user_id)
      if (!p) throw new Error('Profil anggota tidak dapat dimuat.')
      return { id: p.id, name: p.full_name, avatarUrl: p.avatar_url ?? undefined, role: m.role } as UserProfile
    }) }
}
