export interface UserProfile {
  id: string
  name: string
  role: 'suami' | 'istri'
  avatarUrl?: string
}

export interface Household {
  id: string
  name: string
  inviteCode: string
  members: UserProfile[]
}

export interface ExpenseItem {
  id: string
  title: string
  amount: number
  category: 'makan' | 'belanja' | 'tagihan' | 'kencan' | 'transport' | 'hobi' | 'lainnya'
  recordedBy: 'suami' | 'istri'
  date: string
  note?: string
}

export interface BillItem {
  id: string
  title: string
  amount: number
  dueDate: string
  isPaid: boolean
  category: 'listrik' | 'internet' | 'air' | 'bpjs' | 'sewa' | 'lainnya'
  paidBy?: 'suami' | 'istri'
  customerNumber?: string
}

export interface EmergencyContact {
  id: string
  name: string
  role: string
  phone: string
  category: 'keamanan' | 'servis' | 'medis' | 'rt'
}

export interface DocumentExpiry {
  id: string
  title: string
  expiryDate: string
  category: 'kendaraan' | 'lisensi' | 'garansi' | 'rumah'
  daysLeft?: number
}


export interface ScheduleEvent {
  id: string
  title: string
  time: string
  date: string
  assignee: 'suami' | 'istri' | 'berdua'
  icon?: string
}

export interface MaintenanceItem {
  id: string
  title: string
  targetDate: string
  category: 'mobil' | 'motor' | 'ac' | 'rumah'
  status: 'pending' | 'selesai'
  pic: 'suami' | 'istri'
}

export interface WishlistGoal {
  id: string
  title: string
  targetAmount: number
  currentAmount: number
  targetDate: string
  icon?: string
}

export interface ConversationCard {
  id: string
  question: string
  category: 'ringan' | 'kenangan' | 'impian' | 'apresiasi'
}

export interface ShoppingItem {
  id: string
  title: string
  isBought: boolean
  addedBy: 'suami' | 'istri'
  category?: string
}

export interface FoodIdea {
  id: string
  title: string
  type: 'masak' | 'makan-luar'
  tag: string
}

