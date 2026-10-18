import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Check, ChevronRight, Pencil, Trash2, X } from 'lucide-react'
import { useHousehold } from './context'

export function Section({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <div className="section-heading"><h2>{title}</h2>{action && <button className="text-button" onClick={onAction}>{action}<ChevronRight size={15} /></button>}</div>
}

export function Meter({ value, label }: { value: number; label: string }) {
  const percent = Math.min(100, Math.max(0, value))
  return <div className="progress" role="progressbar" aria-label={label} aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}><span style={{ transform: `scaleX(${percent / 100})` }} /></div>
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty-state"><Check size={25} /><h3>{title}</h3>{children && <p>{children}</p>}</div>
}

export function RowActions({ name, onEdit, onDelete }: { name: string; onEdit: () => void; onDelete: () => void }) {
  return <div className="row-actions"><button className="icon-button" aria-label={`Ubah ${name}`} onClick={onEdit}><Pencil size={16} /></button><button className="icon-button delete-button" aria-label={`Hapus ${name}`} onClick={onDelete}><Trash2 size={16} /></button></div>
}

export function MoneyInput({ id, label, value, onChange, large = false, allowZero = false }: { id: string; label: string; value: string; onChange: (value: string) => void; large?: boolean; allowZero?: boolean }) {
  const input = <input id={id} inputMode="numeric" type="text" autoComplete="off" required={!allowZero} pattern="[0-9.]+" placeholder="0" className={value.length > 9 ? 'amount-long' : ''} value={value ? Number(value).toLocaleString('id-ID') : ''} onChange={event => { const raw = event.target.value.replace(/^Rp\s*/i, '').replace(/[.\s]/g, ''); if (/^\d{0,12}$/.test(raw)) onChange(raw) }} />
  return large ? <div className="amount-entry"><label htmlFor={id}>{label}</label><div className="amount-input-wrap"><span aria-hidden="true">Rp</span>{input}</div><p>Rupiah, tanpa desimal.</p></div> : <div className="form-field"><label htmlFor={id}>{label}</label><div className="compact-money"><span aria-hidden="true">Rp</span>{input}</div></div>
}

export function Field({ id, label, children, hint }: { id: string; label: string; children: ReactNode; hint?: string }) {
  return <div className="form-field"><label htmlFor={id}>{label}</label>{children}{hint && <small>{hint}</small>}</div>
}

export function Modal({ title, subtitle, onClose, children, narrow = false }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; narrow?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close() }, [])
  return <dialog ref={ref} className={`expense-dialog workspace-dialog ${narrow ? 'confirm-dialog' : ''}`} aria-labelledby={titleId} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="dialog-content"><span className="sheet-handle" aria-hidden="true" /><div className="row-between dialog-heading"><div><h2 id={titleId}>{title}</h2>{subtitle && <p className="muted small">{subtitle}</p>}</div><button className="icon-button dialog-close" aria-label="Tutup formulir" onClick={onClose}><X size={21} /></button></div>{children}</div>
  </dialog>
}

export function FormEnd({ error, label = 'Simpan', children }: { error: string; label?: string; children?: ReactNode }) {
  const { pending, isPreview } = useHousehold()
  return <>{error && <p role="alert" className="form-error">{error}</p>}<button className="primary-button save-expense" type="submit" disabled={pending} aria-busy={pending}>{pending ? 'Menyimpan…' : label}<Check size={19} /></button>{children}<p className="expense-session-note">{isPreview ? 'Pratinjau interaktif · Belum terhubung database' : 'Disimpan ke rumah bersama di Supabase'}</p></>
}
