import { useState } from 'react'
import { Plus, Trash2, Download } from 'lucide-react'
import { useHousehold } from './context'
import { money, makeId, walletBalance } from './model'
import type { DebtLoan } from './model'
import { Section } from './ui'

function SectionHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <Section title={title} action={action} onAction={onAction} />
}

export function DebtReportsWorkspace() {
  const store = useHousehold()
  const { state } = store

  const [title, setTitle] = useState('')
  const [type, setType] = useState<DebtLoan['type']>('kpr')
  const [lender, setLender] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [remainingAmount, setRemainingAmount] = useState('')
  const [monthlyPayment, setMonthlyPayment] = useState('')
  const [dueDay, setDueDay] = useState('10')
  const [notes, setNotes] = useState('')

  // Perhitungan Neraca Kekayaan Bersih (Net Worth)
  const totalWallets = state.wallets.reduce((sum, w) => sum + walletBalance(w, state.transactions), 0)
  const totalSavings = state.goals.reduce((sum, g) => sum + g.openingAmount, 0)
  // Piutang = Uang kita yang dipinjam orang lain (merupakan ASET)
  const totalPiutang = state.debts.filter(d => d.type === 'piutang').reduce((sum, d) => sum + d.remainingAmount, 0)
  const totalAssets = totalWallets + totalSavings + totalPiutang

  // Utang / Liabilitas = Uang yang kita pinjam (KPR, motor, pinjaman)
  const totalDebts = state.debts.filter(d => d.type !== 'piutang').reduce((sum, d) => sum + d.remainingAmount, 0)
  const netWorth = totalAssets - totalDebts

  const handleAddDebt = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !totalAmount) return
    const tot = Number(totalAmount)
    const rem = remainingAmount ? Number(remainingAmount) : tot
    const item: DebtLoan = {
      id: makeId(),
      title: title.trim(),
      type,
      lenderOrBorrower: lender.trim() || 'Bank / Lembaga',
      totalAmount: tot,
      remainingAmount: rem,
      monthlyPayment: monthlyPayment ? Number(monthlyPayment) : undefined,
      dueDay: dueDay ? Number(dueDay) : undefined,
      notes: notes.trim()
    }
    store.saveDebt(item)
    setTitle('')
    setLender('')
    setTotalAmount('')
    setRemainingAmount('')
    setMonthlyPayment('')
    setNotes('')
  }

  // Ekspor CSV / Excel
  const handleExportCSV = () => {
    const headers = ['Tanggal', 'Jenis', 'Judul', 'Kategori', 'Nominal', 'Pencatat', 'Dompet']
    const rows = state.transactions.map(t => [
      t.date,
      t.kind,
      `"${t.title.replace(/"/g, '""')}"`,
      t.category,
      t.amount,
      t.recordedBy,
      state.wallets.find(w => w.id === t.walletId)?.name || ''
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Laporan_Keuangan_MyHome_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6" style={{ paddingBottom: '30px' }}>
      {/* ─── 1. NERACA KEKAYAAN BERSIH (NET WORTH) ─── */}
      <section className="balance-card" style={{ padding: '24px 28px', borderRadius: '26px' }}>
        <div className="row-between">
          <span style={{ fontSize: '12px', color: '#d0d0ce', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Neraca Kekayaan Bersih (Net Worth)
          </span>
          <button
            type="button"
            onClick={handleExportCSV}
            className="text-button"
            style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '12px' }}
          >
            <Download size={14} /> Ekspor Excel (CSV)
          </button>
        </div>

        <h2 style={{ fontSize: '32px', margin: '14px 0 10px', fontWeight: 750, letterSpacing: '-0.8px' }}>
          {money(netWorth)}
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.15)', fontSize: '12px' }}>
          <div>
            <span style={{ color: '#a8bfce', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Total Aset & Piutang</span>
            <strong style={{ color: '#22c55e', fontSize: '14px' }}>+{money(totalAssets)}</strong>
          </div>
          <div>
            <span style={{ color: '#a8bfce', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Total Utang / KPR</span>
            <strong style={{ color: '#ef4444', fontSize: '14px' }}>-{money(totalDebts)}</strong>
          </div>
        </div>
      </section>

      {/* ─── 2. DAFTAR CICILAN, KPR & PIUTANG ─── */}
      <section>
        <SectionHeading title="Utang, KPR & Piutang" />
        <p className="muted small" style={{ marginTop: '-8px', marginBottom: '18px' }}>
          Pantau sisa cicilan yang harus dibayar, serta uang yang sedang dipinjam orang lain.
        </p>

        {/* Form Tambah Cicilan/KPR/Piutang */}
        <form onSubmit={handleAddDebt} className="workspace-form house-entry-form" style={{ marginBottom: '24px' }}>
          <div className="form-field">
            <label htmlFor="debt-title">Nama Catatan</label>
            <input
              id="debt-title"
              required
              placeholder="Misalnya, KPR Mandiri, Piutang Teman Kantor..."
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div className="form-columns">
            <div className="form-field">
              <label htmlFor="debt-type">Jenis Catatan</label>
              <select id="debt-type" value={type} onChange={e => setType(e.target.value as any)}>
                <option value="kpr">Utang KPR Rumah</option>
                <option value="kendaraan">Utang Kredit Kendaraan</option>
                <option value="personal">Utang Pinjaman Pribadi</option>
                <option value="piutang">Piutang (Uang Kita Dipinjam Orang)</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="debt-lender">{type === 'piutang' ? 'Nama Peminjam' : 'Pemberi Pinjaman'}</label>
              <input
                id="debt-lender"
                placeholder={type === 'piutang' ? 'Nama teman / keluarga' : 'Bank / Lembaga'}
                value={lender}
                onChange={e => setLender(e.target.value)}
              />
            </div>
          </div>

          <div className="form-columns">
            <div className="form-field">
              <label htmlFor="debt-total">{type === 'piutang' ? 'Total Uang yang Dipinjamkan' : 'Total Pokok Pinjaman (Rp)'}</label>
              <input
                id="debt-total"
                type="number"
                required
                placeholder="Contoh: 5000000"
                value={totalAmount}
                onChange={e => setTotalAmount(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="debt-rem">{type === 'piutang' ? 'Sisa yang Belum Dikembalikan' : 'Sisa Pokok Saat Ini (Rp)'}</label>
              <input
                id="debt-rem"
                type="number"
                placeholder="Kosongkan jika masih utuh"
                value={remainingAmount}
                onChange={e => setRemainingAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="form-columns">
            <div className="form-field">
              <label htmlFor="debt-monthly">Angsuran per Bulan (Rp)</label>
              <input
                id="debt-monthly"
                type="number"
                placeholder="Contoh: 3500000"
                value={monthlyPayment}
                onChange={e => setMonthlyPayment(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="debt-due">Tanggal Jatuh Tempo</label>
              <input
                id="debt-due"
                type="number"
                min="1"
                max="31"
                placeholder="10"
                value={dueDay}
                onChange={e => setDueDay(e.target.value)}
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="debt-notes">Catatan (Bunga / Tenor)</label>
            <input
              id="debt-notes"
              placeholder="Contoh: Bunga fixed 3 tahun, tenor 15 tahun"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <button type="submit" className="primary-button" style={{ width: '100%' }}>
            <Plus size={16} /> Simpan Pinjaman / KPR
          </button>
        </form>

        {/* List Cicilan & Piutang Aktif */}
        <div className="house-records">
          {state.debts.length ? state.debts.map(d => {
            const isPiutang = d.type === 'piutang'
            const pctPaid = Math.min(Math.round(((d.totalAmount - d.remainingAmount) / d.totalAmount) * 100), 100)
            return (
              <article className="house-record" key={d.id} style={{ padding: '18px 20px', borderRadius: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="badge" style={{ fontSize: '10px', textTransform: 'uppercase', marginBottom: '6px', display: 'inline-block', color: isPiutang ? '#22c55e' : undefined, borderColor: isPiutang ? 'rgba(34,197,94,0.3)' : undefined }}>
                      {isPiutang ? 'PIUTANG (ASET KITA)' : d.type.toUpperCase()} · {d.lenderOrBorrower}
                    </span>
                    <h3 style={{ fontSize: '15px', fontWeight: 650, margin: '2px 0 4px' }}>{d.title}</h3>
                    <p className="small muted">
                      {isPiutang ? 'Belum kembali: ' : 'Sisa utang: '}
                      <strong style={{ color: isPiutang ? '#22c55e' : '#ef4444' }}>{money(d.remainingAmount)}</strong> / {money(d.totalAmount)} ({pctPaid}% {isPiutang ? 'sudah dikembalikan' : 'lunas'})
                    </p>
                    {d.monthlyPayment && (
                      <p className="small" style={{ marginTop: '4px' }}>
                        {isPiutang ? 'Cicilan pengembalian: ' : 'Angsuran: '}<strong>{money(d.monthlyPayment)}/bulan</strong> {d.dueDay ? `(Tiap tgl ${d.dueDay})` : ''}
                      </p>
                    )}
                    {d.notes && <p className="small muted" style={{ marginTop: '4px', fontStyle: 'italic' }}>"{d.notes}"</p>}
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => store.deleteDebt(d.id)}
                    style={{ color: 'var(--muted)' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            )
          }) : <p className="muted small">Belum ada cicilan atau piutang yang dicatat.</p>}
        </div>
      </section>
    </div>
  )
}
