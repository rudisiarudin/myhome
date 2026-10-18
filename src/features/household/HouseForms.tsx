import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { useHousehold } from './context'
import { contactCategories, documentCategories, makeId, TODAY } from './model'
import type { HouseholdBill, HouseholdContact, HouseholdDocument } from './model'
import { Field, FormEnd, MoneyInput } from './ui'
import { useAccount } from '../account/context'

function EntryHeading({ title, description, onClear }: { title: string; description: string; onClear: () => void }) {
  return <><div className="agenda-form-heading"><h2>{title}</h2><button className="text-button" type="button" onClick={onClear}>Kosongkan</button></div><p className="agenda-form-description">{description}</p></>
}

export function BillEntryForm({ existing, inline = false }: { existing?: HouseholdBill; inline?: boolean }) {
  const store = useHousehold()
  const prefix = useId()
  const id = (field: string) => `${prefix}-${field}`
  const [title, setTitle] = useState(existing?.title ?? '')
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '')
  const [date, setDate] = useState(existing?.dueDate ?? TODAY)
  const [number, setNumber] = useState(existing?.customerNumber ?? '')
  const [error, setError] = useState('')
  const clear = () => { setTitle(''); setAmount(''); setDate(TODAY); setNumber(''); setError('') }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const message = await store.saveBill({ id: existing?.id ?? makeId(), title: title.trim(), amount: Number(amount), dueDate: date, customerNumber: number.trim(), isPaid: false })
    setError(message ?? '')
    if (!message && inline) clear()
  }
  return <form className="workspace-form house-entry-form" aria-label={existing ? 'Form ubah tagihan' : 'Form tambah tagihan'} onSubmit={submit}>
    {inline && <EntryHeading title="Tambah tagihan" description="Catat nominal dan jatuh temponya agar tidak terlupa." onClear={clear} />}
    <Field id={id('title')} label="Nama tagihan"><input id={id('title')} required maxLength={100} placeholder="Misalnya, internet rumah" value={title} onChange={event => { setTitle(event.target.value); setError('') }} /></Field>
    <MoneyInput id={id('amount')} label="Nominal tagihan" value={amount} onChange={value => { setAmount(value); setError('') }} />
    <Field id={id('date')} label="Jatuh tempo"><input id={id('date')} type="date" required value={date} onChange={event => setDate(event.target.value)} /></Field>
    <Field id={id('number')} label="Nomor pelanggan (opsional)"><input id={id('number')} maxLength={50} placeholder="Nomor untuk disalin saat membayar" value={number} onChange={event => setNumber(event.target.value)} /></Field>
    <FormEnd error={error} label="Simpan tagihan" />
  </form>
}

export function DocumentEntryForm({ existing, inline = false }: { existing?: HouseholdDocument; inline?: boolean }) {
  const store = useHousehold()
  const prefix = useId()
  const id = (field: string) => `${prefix}-${field}`
  const [title, setTitle] = useState(existing?.title ?? '')
  const [category, setCategory] = useState<HouseholdDocument['category']>(existing?.category ?? 'rumah')
  const [date, setDate] = useState(existing?.expiryDate ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [error, setError] = useState('')
  const clear = () => { setTitle(''); setCategory('rumah'); setDate(''); setNote(''); setError('') }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const message = await store.saveDocument({ id: existing?.id ?? makeId(), title: title.trim(), category, expiryDate: date, note: note.trim() })
    setError(message ?? '')
    if (!message && inline) clear()
  }
  return <form className="workspace-form house-entry-form" aria-label={existing ? 'Form ubah dokumen' : 'Form tambah dokumen'} onSubmit={submit}>
    {inline && <EntryHeading title="Tambah dokumen" description="Catat masa berlaku dokumen, SIM, atau garansi." onClear={clear} />}
    <Field id={id('title')} label="Nama dokumen"><input id={id('title')} required maxLength={120} placeholder="Misalnya, garansi mesin cuci" value={title} onChange={event => { setTitle(event.target.value); setError('') }} /></Field>
    <Field id={id('category')} label="Jenis dokumen"><select id={id('category')} value={category} onChange={event => setCategory(event.target.value as HouseholdDocument['category'])}>{documentCategories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>
    <Field id={id('date')} label="Berlaku sampai"><input id={id('date')} type="date" required value={date} onChange={event => { setDate(event.target.value); setError('') }} /></Field>
    <Field id={id('note')} label="Catatan dokumen (opsional)"><textarea id={id('note')} rows={3} maxLength={300} placeholder="Misalnya, berkas asli disimpan di laci meja" value={note} onChange={event => setNote(event.target.value)} /></Field>
    <p className="form-hint">Form ini menyimpan catatan masa berlaku, bukan unggahan berkas.</p>
    <FormEnd error={error} label="Simpan dokumen" />
  </form>
}

export function ContactEntryForm({ existing, inline = false }: { existing?: HouseholdContact; inline?: boolean }) {
  const store = useHousehold()
  const prefix = useId()
  const id = (field: string) => `${prefix}-${field}`
  const [name, setName] = useState(existing?.name ?? '')
  const [phone, setPhone] = useState(existing?.phone ?? '')
  const [category, setCategory] = useState<HouseholdContact['category']>(existing?.category ?? 'servis')
  const [role, setRole] = useState(existing?.role ?? '')
  const [error, setError] = useState('')
  const clear = () => { setName(''); setPhone(''); setCategory('servis'); setRole(''); setError('') }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const message = await store.saveContact({ id: existing?.id ?? makeId(), name: name.trim(), phone: phone.trim(), category, role: role.trim() })
    setError(message ?? '')
    if (!message && inline) clear()
  }
  return <form className="workspace-form house-entry-form" aria-label={existing ? 'Form ubah kontak' : 'Form tambah kontak'} onSubmit={submit}>
    {inline && <EntryHeading title="Tambah kontak" description="Simpan nomor yang perlu mudah ditemukan di rumah." onClear={clear} />}
    <Field id={id('name')} label="Nama kontak"><input id={id('name')} required maxLength={100} autoComplete="name" placeholder="Misalnya, teknisi langganan" value={name} onChange={event => { setName(event.target.value); setError('') }} /></Field>
    <Field id={id('phone')} label="Nomor telepon"><input id={id('phone')} type="tel" inputMode="tel" required maxLength={25} autoComplete="tel" placeholder="08... atau +62..." value={phone} onChange={event => { setPhone(event.target.value); setError('') }} /></Field>
    <Field id={id('category')} label="Kategori kontak"><select id={id('category')} value={category} onChange={event => setCategory(event.target.value as HouseholdContact['category'])}>{contactCategories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>
    <Field id={id('role')} label="Peran / keterangan (opsional)"><input id={id('role')} maxLength={100} placeholder="Misalnya, servis listrik dan pompa" value={role} onChange={event => setRole(event.target.value)} /></Field>
    <FormEnd error={error} label="Simpan kontak" />
  </form>
}

export function ChoreEntryForm({ inline = false }: { inline?: boolean }) {
  const store = useHousehold()
  const { nameForPerson } = useAccount()
  const prefix = useId()
  const id = (field: string) => `${prefix}-${field}`
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState<'suami' | 'istri' | 'berdua'>('berdua')
  const [frequency, setFrequency] = useState<'harian' | 'mingguan'>('harian')
  const [error, setError] = useState('')
  const clear = () => { setTitle(''); setAssignee('berdua'); setFrequency('harian'); setError('') }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const message = await store.saveChore({ id: makeId(), title: title.trim(), assignee, frequency })
    setError(message ?? '')
    if (!message && inline) clear()
  }
  return <form className="workspace-form house-entry-form" aria-label="Form tambah tugas rumah" onSubmit={submit}>
    {inline && <EntryHeading title="Tambah tugas rumah" description="Atur giliran tugas rutin agar seimbang." onClear={clear} />}
    <Field id={id('title')} label="Nama tugas"><input id={id('title')} required maxLength={100} placeholder="Misalnya, buang sampah, ganti seprai" value={title} onChange={event => { setTitle(event.target.value); setError('') }} /></Field>
    <div className="form-columns">
      <Field id={id('assignee')} label="Giliran tugas">
        <select id={id('assignee')} value={assignee} onChange={event => setAssignee(event.target.value as 'suami' | 'istri' | 'berdua')}>
          <option value="berdua">Berdua / Gantian</option>
          <option value="suami">{nameForPerson('suami')}</option>
          <option value="istri">{nameForPerson('istri')}</option>
        </select>
      </Field>
      <Field id={id('frequency')} label="Frekuensi">
        <select id={id('frequency')} value={frequency} onChange={event => setFrequency(event.target.value as 'harian' | 'mingguan')}>
          <option value="harian">Setiap Hari</option>
          <option value="mingguan">Mingguan</option>
        </select>
      </Field>
    </div>
    <FormEnd error={error} label="Simpan tugas" />
  </form>
}
