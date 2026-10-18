import type { BillItem, DocumentExpiry, EmergencyContact, ExpenseItem, FoodIdea, ScheduleEvent, ShoppingItem, WishlistGoal } from '../types'

export const initialExpenses: ExpenseItem[] = [
  { id: '01', title: 'Dapur & Buah Segar', amount: 65000, category: 'makan', recordedBy: 'istri', date: '09:20' },
  { id: '02', title: 'Kopi & Roti Sarapan', amount: 25000, category: 'makan', recordedBy: 'suami', date: '07:45' },
  { id: '03', title: 'Tiket Bioskop XXI', amount: 130000, category: 'kencan', recordedBy: 'suami', date: '16/10' },
  { id: '04', title: 'Bensin Motor Honda', amount: 35000, category: 'transport', recordedBy: 'suami', date: '15/10' },
]

export const bills: BillItem[] = [
  { id: 'b1', title: 'Wi-Fi IndiHome', amount: 375000, dueDate: '20 OKT', isPaid: false, category: 'internet', customerNumber: '122409887165' },
  { id: 'b2', title: 'Listrik PLN', amount: 550000, dueDate: '25 OKT', isPaid: true, category: 'listrik', paidBy: 'suami', customerNumber: '547100889211' },
  { id: 'b3', title: 'PAM & Iuran RT', amount: 95000, dueDate: '28 OKT', isPaid: false, category: 'air', customerNumber: 'PAM-88291' },
  { id: 'b4', title: 'BPJS Berdua', amount: 200000, dueDate: '10 NOV', isPaid: true, category: 'bpjs', customerNumber: '0001889271632' },
]

export const documents: DocumentExpiry[] = [
  { id: 'd1', title: 'Pajak STNK Honda Beat', expiryDate: '14 DES 2026', category: 'kendaraan', daysLeft: 58 },
  { id: 'd2', title: 'SIM C Rudi Siarudin', expiryDate: '28 AGU 2028', category: 'lisensi', daysLeft: 680 },
  { id: 'd3', title: 'Garansi AC Daikin', expiryDate: '15 MEI 2027', category: 'garansi', daysLeft: 210 },
]

export const contacts: EmergencyContact[] = [
  { id: 'c1', name: 'Pak Joko (Satpam)', role: 'Pos Gerbang 24 Jam', phone: '081234567890', category: 'keamanan' },
  { id: 'c2', name: 'Mas Ari (Teknisi)', role: 'Servis Listrik & Pompa', phone: '085712345678', category: 'servis' },
  { id: 'c3', name: 'Pak Bambang (RT 04)', role: 'Ketua Lingkungan', phone: '081398765432', category: 'rt' },
]

export const schedule: ScheduleEvent[] = [
  { id: 's1', title: 'Workout / Gym', time: '17:00', date: 'TODAY', assignee: 'suami' },
  { id: 's2', title: 'Belanja Superindo', time: '19:30', date: 'TODAY', assignee: 'berdua' },
  { id: 's3', title: 'Dinner Malam Minggu', time: '19:00', date: 'BESOK', assignee: 'berdua' },
]

export const initialShopping: ShoppingItem[] = [
  { id: 'sh1', title: 'Minyak Goreng 2L', isBought: false, addedBy: 'istri' },
  { id: 'sh2', title: 'Biji Kopi Hitam', isBought: true, addedBy: 'suami' },
  { id: 'sh3', title: 'Telur Ayam 1 Tray', isBought: false, addedBy: 'istri' },
  { id: 'sh4', title: 'Deterjen Liquid', isBought: false, addedBy: 'suami' },
]

export const foodIdeas: FoodIdea[] = [
  { id: 'f1', title: 'Ayam Bakar Sambal Terasi', type: 'masak', tag: 'Dapur' },
  { id: 'f2', title: 'Sate Padang Pariaman', type: 'makan-luar', tag: 'Jajan' },
  { id: 'f3', title: 'Nasi Goreng Spesial', type: 'masak', tag: 'Dapur' },
  { id: 'f4', title: 'Ramen Bar Shoyu', type: 'makan-luar', tag: 'Kencan' },
  { id: 'f5', title: 'Ikan Bakar Jimbaran', type: 'makan-luar', tag: 'Santai' },
]

export const dateIdeas = [
  'Bioskop midnight + Popcorn karamel',
  'Morning coffee walk di Blok M',
  'Cook-off resep pasta bareng di rumah',
  'Car Free Day Sudirman hari Minggu',
  'Hunting kuliner malam kaki lima',
]

export const goals: WishlistGoal[] = [
  { id: 'g1', title: 'Liburan Santai Bali', targetAmount: 8000000, currentAmount: 4800000, targetDate: 'DES 2026' },
  { id: 'g2', title: 'Monitor 4K Studio', targetAmount: 5500000, currentAmount: 3200000, targetDate: 'NOV 2026' },
]
