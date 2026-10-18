import type { BillItem, ConversationCard, ExpenseItem, MaintenanceItem, ScheduleEvent } from '../types'

export const INITIAL_BILLS: BillItem[] = [
  { id: '1', title: 'Wi-Fi Rumah IndiHome', amount: 375000, dueDate: '2026-10-20', isPaid: false, category: 'internet' },
  { id: '2', title: 'Token Listrik PLN', amount: 500000, dueDate: '2026-10-25', isPaid: true, category: 'listrik', paidBy: 'suami' },
  { id: '3', title: 'Iuran Air PAM', amount: 85000, dueDate: '2026-10-22', isPaid: false, category: 'air' },
]

export const INITIAL_EXPENSES: ExpenseItem[] = [
  { id: 'e1', title: 'Belanja Dapur & Sayur Segar', amount: 65000, category: 'makan', recordedBy: 'istri', date: '2026-10-17' },
  { id: 'e2', title: 'Kencan Makan & Nonton Film', amount: 145000, category: 'kencan', recordedBy: 'suami', date: '2026-10-17' },
  { id: 'e3', title: 'Bensin Motor Honda Beat', amount: 35000, category: 'transport', recordedBy: 'suami', date: '2026-10-16' },
]

export const INITIAL_SCHEDULE: ScheduleEvent[] = [
  { id: 's1', title: 'Nge-gym / Olahraga Sore', time: '17:00', date: '2026-10-17', assignee: 'suami' },
  { id: 's2', title: 'Belanja Mingguan Berdua', time: '19:30', date: '2026-10-17', assignee: 'berdua' },
  { id: 's3', title: 'Dinner Kencan Malam Minggu', time: '19:00', date: '2026-10-18', assignee: 'berdua' },
]

export const INITIAL_MAINTENANCE: MaintenanceItem[] = [
  { id: 'm1', title: 'Ganti Oli Motor (3.000 KM)', targetDate: '2026-10-24', category: 'motor', status: 'pending', pic: 'suami' },
  { id: 'm2', title: 'Cuci & Service AC Kamar', targetDate: '2026-10-28', category: 'ac', status: 'pending', pic: 'suami' },
  { id: 'm3', title: 'Ganti Filter Air Dispenser', targetDate: '2026-11-05', category: 'rumah', status: 'pending', pic: 'istri' },
]

export const CONVERSATION_PROMPTS: ConversationCard[] = [
  { id: 'c1', question: 'Momen kecil apa minggu ini yang bikin kamu bersyukur banget punya pasangan kaya aku?', category: 'apresiasi' },
  { id: 'c2', question: 'Kalau besok kita punya libur 2 hari cuma berdua tanpa mikirin kerjaan, kita mau ke mana?', category: 'impian' },
  { id: 'c3', question: 'Apa hal paling lucu yang pernah kita lewatin bareng pas awal-awal pacaran/nikah?', category: 'kenangan' },
  { id: 'c4', question: 'Ada hal yang lagi bikin kamu capek atau overthinking minggu ini yang bisa aku bantu dengerin?', category: 'ringan' },
]
