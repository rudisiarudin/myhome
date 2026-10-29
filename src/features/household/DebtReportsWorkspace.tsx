import { useState } from 'react'
import { Plus, Trash2, Download, Wallet, Check, X, CreditCard } from 'lucide-react'
import { useHousehold } from './context'
import { money, makeId, walletBalance, formatDate } from './model'
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
  const [tenorMonths, setTenorMonths] = useState('')
  const [remainingMonths, setRemainingMonths] = useState('')
  const [notes, setNotes] = useState('')

  // Kartu utang pasangan: cermin utang dari piutang yang dibiayai kartu kredit/pinjaman,
  // agar Net Worth tidak tergelembung oleh piutang yang bukan uang tunai kita.
  const [mirrorId, setMirrorId] = useState<string | null>(null)
  const [mirrorLender, setMirrorLender] = useState('')
  // Checkbox + nama pemberi pinjaman pada form tambah piutang
  const [mirrorPair, setMirrorPair] = useState(false)
  const [mirrorLenderName, setMirrorLenderName] = useState('')

  const buildMirrorDebt = (source: DebtLoan, lenderName: string): DebtLoan => {
    // Tidak ada tipe generik 'utang' pada pilihan jenis; 'personal' (Utang Pinjaman Pribadi)
    // adalah wadah generiknya — bukan KPR dan bukan kredit kendaraan.
    const marker = `Utang pasangan piutang "${source.title}" — dibiayai kartu kredit/pinjaman.`
    const baseNotes = source.notes?.trim()
    return {
      id: makeId(),
      title: source.title,
      type: 'personal',
      lenderOrBorrower: lenderName.trim() || 'Kartu Kredit',
      totalAmount: source.totalAmount,
      remainingAmount: source.remainingAmount,
      monthlyPayment: source.monthlyPayment,
      dueDay: source.dueDay,
      tenorMonths: source.tenorMonths,
      remainingMonths: source.remainingMonths,
      notes: baseNotes ? `${baseNotes}${/[.!?]$/.test(baseNotes) ? ' ' : '. '}${marker}` : marker
    }
  }

  const openMirrorForm = (d: DebtLoan) => {
    setMirrorId(d.id)
    setMirrorLender('')
  }

  const closeMirrorForm = () => {
    setMirrorId(null)
    setMirrorLender('')
  }

  const handleCreateMirror = async (e: React.FormEvent, d: DebtLoan) => {
    e.preventDefault()
    await store.saveDebt(buildMirrorDebt(d, mirrorLender))
    closeMirrorForm()
  }

  // Perhitungan Neraca Kekayaan Bersih (Net Worth)
  const totalWallets = state.wallets.reduce((sum, w) => sum + walletBalance(w, state.transactions), 0)
  const totalSavings = state.goals.reduce((sum, g) => sum + g.openingAmount, 0)
  // Piutang = Uang kita yang dipinjam orang lain (merupakan ASET)
  const totalPiutang = state.debts.filter(d => d.type === 'piutang').reduce((sum, d) => sum + d.remainingAmount, 0)
  const totalAssets = totalWallets + totalSavings + totalPiutang

  // Utang / Liabilitas = Uang yang kita pinjam (KPR, motor, pinjaman)
  const totalDebts = state.debts.filter(d => d.type !== 'piutang').reduce((sum, d) => sum + d.remainingAmount, 0)
  const netWorth = totalAssets - totalDebts

  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    // Fleksibel: cukup isi salah satu dari Total / Sisa — yang kosong mengikuti angka yang diisi,
    // supaya catatan yang dimulai dari sisa berjalan (mis. cicilan yang sudah jalan beberapa kali) tetap bisa dicatat.
    const tot = Number(totalAmount) || Number(remainingAmount)
    if (!tot) return
    const rem = remainingAmount ? Number(remainingAmount) : tot
    const tenor = tenorMonths ? Number(tenorMonths) : undefined
    // Sisa tenor kosong = sama dengan tenor (cicilan baru); tidak boleh melebihi tenornya.
    const sisaTenor = tenor ? Math.min(remainingMonths ? Number(remainingMonths) : tenor, tenor) : undefined
    const item: DebtLoan = {
      id: makeId(),
      title: title.trim(),
      type,
      lenderOrBorrower: lender.trim() || 'Bank / Lembaga',
      totalAmount: tot,
      remainingAmount: rem,
      monthlyPayment: monthlyPayment ? Number(monthlyPayment) : undefined,
      dueDay: dueDay ? Number(dueDay) : undefined,
      tenorMonths: tenor,
      remainingMonths: sisaTenor,
      notes: notes.trim()
    }
    const message = await store.saveDebt(item)
    if (message) return // Simpan gagal: jangan buat kartu pasangan, jangan kosongkan form
    if (type === 'piutang' && mirrorPair) {
      await store.saveDebt(buildMirrorDebt(item, mirrorLenderName))
    }
    setTitle('')
    setLender('')
    setTotalAmount('')
    setRemainingAmount('')
    setMonthlyPayment('')
    setTenorMonths('')
    setRemainingMonths('')
    setNotes('')
    setMirrorPair(false)
    setMirrorLenderName('')
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
          <p className="small muted" style={{ margin: '-6px 0 0' }}>
            Cukup isi salah satu dari Total / Sisa — kolom yang kosong akan mengikuti angka yang diisi.
          </p>

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

          <div className="form-columns">
            <div className="form-field">
              <label htmlFor="debt-tenor">Tenor (bulan)</label>
              <input
                id="debt-tenor"
                type="number"
                min="1"
                placeholder="Contoh: 12"
                value={tenorMonths}
                onChange={e => setTenorMonths(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="debt-rem-months">Sisa Tenor (bulan)</label>
              <input
                id="debt-rem-months"
                type="number"
                min="0"
                placeholder="Kosongkan jika sama dengan tenor"
                value={remainingMonths}
                onChange={e => setRemainingMonths(e.target.value)}
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="debt-notes">Catatan (Bunga / Lainnya)</label>
            <input
              id="debt-notes"
              placeholder="Contoh: Bunga fixed 3 tahun pertama"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {type === 'piutang' && (
            <div className="form-field">
              <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontWeight: 500, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={mirrorPair}
                  onChange={e => setMirrorPair(e.target.checked)}
                  style={{ marginTop: '3px' }}
                />
                <span>Piutang ini dibiayai kartu kredit / pinjaman lain — buat kartu utang pasangan sekaligus</span>
              </label>
              {mirrorPair && (
                <div style={{ marginTop: '10px' }}>
                  <label htmlFor="debt-mirror-lender">Dibiayai dari (nama kartu / pemberi pinjaman)</label>
                  <input
                    id="debt-mirror-lender"
                    type="text"
                    placeholder="Contoh: Tokopedia Card"
                    value={mirrorLenderName}
                    onChange={e => setMirrorLenderName(e.target.value)}
                  />
                  <p className="small muted" style={{ margin: '6px 0 0' }}>
                    Kartu utang dengan total &amp; sisa yang sama akan dibuat, supaya Neraca Kekayaan Bersih tetap seimbang.
                  </p>
                </div>
              )}
            </div>
          )}

          <button type="submit" className="primary-button" style={{ width: '100%' }}>
            <Plus size={16} /> Simpan Pinjaman / KPR
          </button>
        </form>

        {/* List Cicilan & Piutang Aktif */}
        <div className="house-records">
          {state.debts.length ? state.debts.map(d => {
            const isPiutang = d.type === 'piutang'
            const pctPaid = Math.min(Math.round(((d.totalAmount - d.remainingAmount) / d.totalAmount) * 100), 100)
            const history = state.debtPayments
              .filter(p => p.debtId === d.id)
              .sort((a, b) => b.paidDate.localeCompare(a.paidDate))
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
                    {d.tenorMonths ? (
                      <p className="small" style={{ marginTop: '4px' }}>
                        Tenor: <strong>{d.tenorMonths} bulan</strong>{d.remainingMonths != null ? <> · Sisa tenor: <strong>{d.remainingMonths} bulan</strong></> : ''}
                      </p>
                    ) : null}
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
                {d.remainingAmount > 0 && mirrorId !== d.id && (
                  <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => store.setEditor({ type: 'debtPay', id: d.id })}
                    >
                      <Wallet size={15} /> {isPiutang ? 'Catat Pengembalian' : 'Catat Pembayaran'}
                    </button>
                    {isPiutang && (
                      <button
                        type="button"
                        className="secondary-button"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => openMirrorForm(d)}
                      >
                        <CreditCard size={15} /> Buat Utang Pasangan
                      </button>
                    )}
                  </div>
                )}
                {isPiutang && mirrorId === d.id && (
                  <form onSubmit={e => handleCreateMirror(e, d)} className="workspace-form" style={{ marginTop: '14px' }}>
                    <div className="form-field">
                      <label htmlFor={`debt-mirror-${d.id}`}>Dibiayai dari (nama kartu / pemberi pinjaman)</label>
                      <input
                        id={`debt-mirror-${d.id}`}
                        type="text"
                        placeholder="Contoh: Tokopedia Card"
                        autoFocus
                        value={mirrorLender}
                        onChange={e => setMirrorLender(e.target.value)}
                      />
                    </div>
                    <p className="small muted" style={{ margin: '0 0 12px' }}>
                      Kartu utang baru akan dibuat dengan total {money(d.totalAmount)} dan sisa {money(d.remainingAmount)} (mengikuti piutang ini), agar Neraca Kekayaan Bersih seimbang. Pembayaran kartu utang ini tetap dicatat terpisah.
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="submit" className="primary-button" disabled={store.pending} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Check size={15} /> Simpan
                      </button>
                      <button type="button" className="secondary-button" onClick={closeMirrorForm} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <X size={15} /> Batal
                      </button>
                    </div>
                  </form>
                )}
                {history.length > 0 && (
                  <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border, rgba(0,0,0,0.08))' }}>
                    <p className="small" style={{ fontWeight: 650, marginBottom: '8px' }}>
                      Riwayat {isPiutang ? 'Pengembalian' : 'Pembayaran'}
                    </p>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '8px' }}>
                      {history.map(p => (
                        <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                          <span className="small">
                            {formatDate(p.paidDate)} — <strong>{money(p.amount)}</strong>
                            {p.note && <span className="muted"> · {p.note}</span>}
                          </span>
                          <button
                            type="button"
                            className="text-button"
                            aria-label={`Hapus riwayat ${isPiutang ? 'pengembalian' : 'pembayaran'} ${money(p.amount)}`}
                            onClick={() => void store.deleteDebtPayment(d, p)}
                            style={{ color: 'var(--muted)', display: 'inline-flex' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            )
          }) : <p className="muted small">Belum ada cicilan atau piutang yang dicatat.</p>}
        </div>
      </section>
    </div>
  )
}
