import test from 'node:test'
import assert from 'node:assert/strict'
import { hasCatatTrigger, parseExpenseText } from '../src/features/household/expenseText.ts'

const context = {
  categoryKeys: ['makan', 'belanja', 'kencan', 'transport', 'hobi', 'tagihan'],
  walletNames: ['BCA', 'SeaBank', 'Tunai'],
}
const parse = text => parseExpenseText(text, context)

test('kalimat Ketua: "Catat gue tadi isi bensin 40rb" menjadi draf Isi bensin 40000', () => {
  const result = parse('Catat gue tadi isi bensin 40rb')
  assert.equal(result.title, 'Isi bensin')
  assert.equal(result.amount, 40000)
  assert.equal(result.categoryKey, 'transport')
  assert.equal(result.walletHint, null)
})

test('"catat makan siang 35rb" terurai dengan kategori makan', () => {
  const result = parse('catat makan siang 35rb')
  assert.equal(result.title, 'Makan siang')
  assert.equal(result.amount, 35000)
  assert.equal(result.categoryKey, 'makan')
})

test('nominal eksplisit "Rp50.000 parkir" terurai tanpa kata pemicu', () => {
  const result = parse('Rp50.000 parkir')
  assert.equal(result.title, 'Parkir')
  assert.equal(result.amount, 50000)
  assert.equal(result.categoryKey, 'transport')
})

test('"isi bensin 1,5jt" tidak salah urai: 1,5jt adalah 1500000', () => {
  const result = parse('isi bensin 1,5jt')
  assert.equal(result.amount, 1500000)
  assert.equal(result.title, 'Isi bensin')
})

test('"bayar kontrakan 1,5jt" terurai 1500000 dengan kategori tagihan', () => {
  const result = parse('bayar kontrakan 1,5jt')
  assert.equal(result.amount, 1500000)
  assert.equal(result.title, 'Bayar kontrakan')
  assert.equal(result.categoryKey, 'tagihan')
})

test('akhiran ribu lain: "40 ribu", "40k", "2jt", dan titik ribuan', () => {
  assert.equal(parse('catat parkir 40 ribu').amount, 40000)
  assert.equal(parse('ngopi 18k').amount, 18000)
  assert.equal(parse('bayar servis motor 2jt').amount, 2000000)
  assert.equal(parse('beli beras 52.500').amount, 52500)
  assert.equal(parse('keluar 40000 buat parkir').amount, 40000)
})

test('"beli pulsa 25rb" masuk kategori tagihan', () => {
  const result = parse('beli pulsa 25rb')
  assert.equal(result.amount, 25000)
  assert.equal(result.categoryKey, 'tagihan')
  assert.equal(result.title, 'Beli pulsa')
})

test('sebutan dompet di teks menjadi walletHint dan dibersihkan dari judul', () => {
  const result = parse('catat isi bensin 40rb pakai bca')
  assert.equal(result.walletHint, 'BCA')
  assert.equal(result.title, 'Isi bensin')
})

test('teks tanpa nominal menghasilkan null', () => {
  assert.equal(parse('catat jajan di warung'), null)
  assert.equal(parse('isi bensin dulu ya'), null)
  assert.equal(parse(''), null)
})

test('pertanyaan biasa menghasilkan null walau mengandung nominal', () => {
  assert.equal(parse('Sisa cicilan berapa?'), null)
  assert.equal(parse('Ringkasan hari ini'), null)
  assert.equal(parse('Tagihan internet 233rb kapan jatuh tempo?'), null)
  assert.equal(parse('Saldo dompet berapa?'), null)
})

test('hasCatatTrigger mengenali perintah catat untuk balasan minta nominal', () => {
  assert.equal(hasCatatTrigger('Catat pengeluaran ini'), true)
  assert.equal(hasCatatTrigger('tolong catatkan ya'), true)
  assert.equal(hasCatatTrigger('Sisa cicilan berapa?'), false)
})
