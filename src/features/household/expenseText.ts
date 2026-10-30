// Pengurai kalimat pengeluaran berbahasa Indonesia menjadi draf kartu
// konfirmasi Asisten Myhome — pasangan jalur teks dari analyzeScreenshot.
//
// Modul ini MURNI (tanpa React/store) supaya bisa diuji sendiri: ia hanya
// mengubah kalimat seperti "Catat gue tadi isi bensin 40rb" menjadi
// { title: 'Isi bensin', amount: 40000, categoryKey: 'transport', ... }.
// Hasilnya TIDAK PERNAH langsung ditulis sebagai transaksi — pemanggil
// menampilkannya sebagai ExpenseCard berstatus 'pending' dan data baru
// berubah setelah pengguna menekan tombol Catat di kartu itu.

export interface ExpenseTextParse {
  title: string
  amount: number
  categoryKey: string
  /** Nama dompet (persis seperti di daftar walletNames) yang disebut di teks, bila ada. */
  walletHint: string | null
}

export interface ExpenseTextContext {
  /** Kunci kategori yang valid, mis. EXPENSE_CATEGORY_KEYS dari AgentAssistant. */
  categoryKeys: readonly string[]
  /** Nama dompet yang ada di aplikasi, untuk dicocokkan dengan teks. */
  walletNames: readonly string[]
}

// Kata kerja pengeluaran yang lazim mengawali kalimat catatan. Kalimat yang
// diawali kata ini (sesudah kata pengisi dibuang) dan memuat nominal dianggap
// perintah mencatat, bukan pertanyaan.
const EXPENSE_VERBS = ['isi', 'beli', 'bayar', 'makan', 'ngopi', 'jajan', 'keluar']

// Kata pengisi di awal kalimat yang dibuang dari judul.
const LEADING_FILLERS = ['gue', 'gua', 'saya', 'aku', 'tadi', 'tolong']

// Peta kata kunci → kunci kategori. Kuncinya harus ada di
// EXPENSE_CATEGORY_KEYS; kunci yang tidak dikenal pemanggil dilewati.
const CATEGORY_KEYWORDS: readonly (readonly [string, readonly string[]])[] = [
  ['transport', ['bensin', 'pertalite', 'pertamax', 'solar', 'parkir', 'tol', 'gojek', 'grab', 'ojek', 'ojol', 'taksi', 'angkot', 'kendaraan', 'servis']],
  ['tagihan', ['token', 'listrik', 'pulsa', 'internet', 'wifi', 'pdam', 'kontrakan', 'bpjs', 'indihome', 'pajak', 'iuran']],
  ['makan', ['makan', 'warung', 'warteg', 'restoran', 'resto', 'kopi', 'ngopi', 'jajan', 'bakso', 'nasi', 'mie', 'ayam', 'sate', 'bubur', 'sarapan']],
  ['belanja', ['belanja', 'alfamart', 'indomaret', 'minimarket', 'supermarket', 'pasar', 'toko', 'grosir', 'swalayan']],
  ['hobi', ['game', 'bioskop', 'film', 'netflix', 'spotify', 'buku', 'konser', 'gym', 'mainan', 'hobi']],
]

// Alias nama bank/e-wallet — cermin BANK_ALIASES di AgentAssistant, untuk
// mencocokkan sebutan di teks bebas ("bayar pakai livin") dengan nama
// dompet di aplikasi ("Mandiri").
const WALLET_ALIASES: Record<string, string[]> = {
  seabank: ['seabank', 'bankseabank'],
  bca: ['bca', 'bankcentralasia', 'centralasia', 'bcadigital', 'blu'],
  bni: ['bni', 'banknegara'],
  bri: ['bri', 'bankrakyat', 'brimo'],
  mandiri: ['mandiri', 'bankmandiri', 'livin'],
  jago: ['jago', 'bankjago'],
  gopay: ['gopay'],
  ovo: ['ovo'],
  dana: ['dana'],
  shopeepay: ['shopeepay'],
}

// Setara isValidMoneyAmount di AgentAssistant: nominal rupiah utuh yang
// masuk akal untuk satu transaksi.
function isValidAmount(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 999999999999
}

interface AmountHit {
  amount: number
  start: number
  end: number
  /** Penanda 'rp' berarti nominal ditulis eksplisit dengan awalan Rp. */
  kind: 'rp' | 'suffix' | 'plain'
}

// Mengurai nominal rupiah dari teks. Pola dicoba dari yang paling eksplisit:
// awalan Rp, akhiran jt/juta, akhiran rb/ribu/k, titik ribuan, lalu angka
// polos minimal 4 digit (angka kecil polos sengaja tidak dianggap nominal
// supaya tanggal/kuantitas tidak ikut terurai). Pola pertama yang cocok
// menentukan hasil; nominal yang tidak valid membuat penguraian gagal.
function parseAmount(text: string): AmountHit | null {
  const rp = /rp\.?\s*(\d[\d.]*(?:,\d+)?)/i.exec(text)
  if (rp) {
    const digits = rp[1].split(',')[0].replace(/\./g, '')
    const amount = Number(digits)
    return isValidAmount(amount) ? { amount, start: rp.index, end: rp.index + rp[0].length, kind: 'rp' } : null
  }
  const million = /(\d+(?:[.,]\d+)?)\s*(jt|juta)\b/i.exec(text)
  if (million) {
    const amount = Math.round(Number(million[1].replace(',', '.')) * 1000000)
    return isValidAmount(amount) ? { amount, start: million.index, end: million.index + million[0].length, kind: 'suffix' } : null
  }
  const thousand = /(\d+(?:[.,]\d+)?)\s*(rb|ribu|k)\b/i.exec(text)
  if (thousand) {
    const amount = Math.round(Number(thousand[1].replace(',', '.')) * 1000)
    return isValidAmount(amount) ? { amount, start: thousand.index, end: thousand.index + thousand[0].length, kind: 'suffix' } : null
  }
  const dotted = /\d{1,3}(?:\.\d{3})+\b/.exec(text)
  if (dotted) {
    const amount = Number(dotted[0].replace(/\./g, ''))
    return isValidAmount(amount) ? { amount, start: dotted.index, end: dotted.index + dotted[0].length, kind: 'plain' } : null
  }
  const plain = /\b\d{4,}\b/.exec(text)
  if (plain) {
    const amount = Number(plain[0])
    return isValidAmount(amount) ? { amount, start: plain.index, end: plain.index + plain[0].length, kind: 'plain' } : null
  }
  return null
}

/** true bila teks memuat perintah "catat" (termasuk "catatkan"). */
export function hasCatatTrigger(rawText: string): boolean {
  return /\bcatat(?:kan)?\b/i.test(rawText)
}

function normalizeLoose(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

interface WalletHit {
  name: string
  /** Kata/frasa persis yang cocok di teks ternormalisasi, untuk dibersihkan dari judul. */
  phrase: string
}

// Cermin pendekatan matchWallet di AgentAssistant: nama dompet dicocokkan
// secara longgar (tanpa spasi/simbol), lalu lewat tabel alias bank.
function matchWalletHint(text: string, walletNames: readonly string[]): WalletHit | null {
  const label = normalizeLoose(text)
  if (!label) return null
  for (const name of walletNames) {
    const normalizedName = normalizeLoose(name)
    if (!normalizedName) continue
    if (label.includes(normalizedName)) return { name, phrase: normalizedName }
    for (const [canonical, aliases] of Object.entries(WALLET_ALIASES)) {
      const candidates = [canonical, ...aliases]
      const textHit = candidates.find(candidate => label.includes(candidate))
      const nameHit = candidates.some(candidate => normalizedName.includes(candidate))
      if (textHit && nameHit) return { name, phrase: textHit }
    }
  }
  return null
}

function detectCategoryKey(text: string, categoryKeys: readonly string[]): string {
  const lower = text.toLowerCase()
  for (const [key, keywords] of CATEGORY_KEYWORDS) {
    if (!categoryKeys.includes(key)) continue
    if (keywords.some(keyword => new RegExp(`\\b${keyword}\\b`).test(lower))) return key
  }
  if (categoryKeys.includes('belanja')) return 'belanja'
  return categoryKeys[0] ?? ''
}

// Judul diambil dari kalimat asli: token nominal dan kata "catat" dibuang,
// sebutan dompet sesudah kata pakai/dari/dengan/via dibuang, kata pengisi
// di awal dibuang, lalu huruf pertama dikapitalkan.
function buildTitle(text: string, hit: AmountHit, wallet: WalletHit | null): string {
  let title = `${text.slice(0, hit.start)} ${text.slice(hit.end)}`
  title = title.replace(/\bcatat(?:kan)?\b/gi, ' ')
  if (wallet) {
    title = title.replace(/\b(?:pakai|pake|dari|dengan|via)\s+([a-z0-9]+)/gi, (whole, word: string) => {
      const normalized = normalizeLoose(word)
      const sameWallet = normalizeLoose(wallet.name) === normalized
        || Object.entries(WALLET_ALIASES).some(([canonical, aliases]) =>
          (canonical === normalized || aliases.includes(normalized))
          && (normalizeLoose(wallet.name).includes(canonical) || aliases.some(alias => normalizeLoose(wallet.name).includes(alias))))
      return sameWallet ? ' ' : whole
    })
  }
  const words = title.split(/\s+/).filter(Boolean)
  while (words.length && LEADING_FILLERS.includes(words[0].toLowerCase().replace(/[^a-z]/gi, ''))) words.shift()
  const cleaned = words.join(' ').replace(/\s+/g, ' ').replace(/^[\s.,!?;:'"“”]+|[\s.,!?;:'"“”]+$/g, '').trim()
  if (!cleaned) return 'Pengeluaran'
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

// Kata pertama yang bermakna (sesudah kata pengisi & kata "catat" dibuang)
// — dipakai untuk pemicu kata kerja pengeluaran.
function firstContentWord(text: string): string {
  const words = text.toLowerCase().split(/[^a-z]+/).filter(Boolean)
  const content = words.filter(word => !LEADING_FILLERS.includes(word) && word !== 'catat' && word !== 'catatkan')
  return content[0] ?? ''
}

/**
 * Mengurai satu kalimat menjadi draf pengeluaran, atau null bila kalimat
 * itu bukan perintah mencatat pengeluaran. Pemicunya: ada kata "catat",
 * ATAU kalimat diawali kata kerja pengeluaran, ATAU nominalnya ditulis
 * eksplisit dengan awalan Rp — dan selalu harus ada nominal yang terurai.
 * Pertanyaan biasa ("Sisa cicilan berapa?") menghasilkan null.
 */
export function parseExpenseText(rawText: string, context: ExpenseTextContext): ExpenseTextParse | null {
  const text = rawText.trim()
  if (!text) return null
  const hit = parseAmount(text)
  if (!hit) return null
  const triggered = hasCatatTrigger(text) || EXPENSE_VERBS.includes(firstContentWord(text)) || hit.kind === 'rp'
  if (!triggered) return null
  const wallet = matchWalletHint(text, context.walletNames)
  return {
    title: buildTitle(text, hit, wallet),
    amount: hit.amount,
    categoryKey: detectCategoryKey(text, context.categoryKeys),
    walletHint: wallet?.name ?? null,
  }
}
