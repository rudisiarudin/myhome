import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { useHousehold } from './context'
import { makeId, TODAY } from './model'
import type { HouseholdEvent } from './model'
import { Field, FormEnd } from './ui'
import { useAccount } from '../account/context'

export function AgendaForm({ existing, initialDate = TODAY, selectedDate, onDateChange, inline = false }: {
  existing?: HouseholdEvent
  initialDate?: string
  selectedDate?: string
  onDateChange?: (date: string) => void
  inline?: boolean
}) {
  const store = useHousehold()
  const { nameForPerson } = useAccount()
  const prefix = useId()
  const fieldId = (name: string) => `${prefix}-${name}`
  const [title, setTitle] = useState(existing?.title ?? '')
  const [localDate, setLocalDate] = useState(existing?.date ?? initialDate)
  const [time, setTime] = useState(existing?.time ?? '19:00')
  const [assignee, setAssignee] = useState<HouseholdEvent['assignee']>(existing?.assignee ?? 'berdua')
  const [note, setNote] = useState(existing?.note ?? '')
  const [error, setError] = useState('')
  const date = selectedDate ?? localDate

  const clear = () => {
    setTitle('')
    setTime('19:00')
    setAssignee('berdua')
    setNote('')
    setError('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const message = await store.saveEvent({
      id: existing?.id ?? makeId(),
      title: title.trim(),
      date,
      time,
      assignee,
      note: note.trim(),
      isDone: existing?.isDone ?? false,
    })
    setError(message ?? '')
    if (!message && inline) clear()
  }

  return <form className="workspace-form agenda-entry-form" aria-label={existing ? 'Form ubah agenda' : 'Form tambah agenda'} onSubmit={submit}>
    {inline && <>
      <div className="agenda-form-heading"><h2>Tambah agenda</h2><button className="text-button" type="button" onClick={clear}>Kosongkan</button></div>
      <p className="agenda-form-description">Tulis rencana kalian, lalu tentukan waktunya.</p>
    </>}
    <Field id={fieldId('title')} label="Nama agenda">
      <input id={fieldId('title')} required maxLength={120} placeholder="Misalnya, belanja mingguan" value={title} onChange={event => { setTitle(event.target.value); setError('') }} />
    </Field>
    <div className="form-columns">
      <Field id={fieldId('date')} label="Tanggal">
        <input id={fieldId('date')} type="date" required value={date} onChange={event => {
          const value = event.target.value
          if (onDateChange) { if (value) onDateChange(value) }
          else setLocalDate(value)
          setError('')
        }} />
      </Field>
      <Field id={fieldId('time')} label="Waktu">
        <input id={fieldId('time')} type="time" required value={time} onChange={event => { setTime(event.target.value); setError('') }} />
      </Field>
    </div>
    <Field id={fieldId('assignee')} label="Untuk siapa?">
      <select id={fieldId('assignee')} value={assignee} onChange={event => setAssignee(event.target.value as HouseholdEvent['assignee'])}>
        <option value="berdua">Berdua</option><option value="suami">{nameForPerson('suami')}</option><option value="istri">{nameForPerson('istri')}</option>
      </select>
    </Field>
    <Field id={fieldId('note')} label="Catatan (opsional)">
      <textarea id={fieldId('note')} rows={3} maxLength={300} placeholder="Lokasi atau hal yang perlu disiapkan" value={note} onChange={event => setNote(event.target.value)} />
    </Field>
    <FormEnd error={error} label="Simpan agenda" />
  </form>
}
