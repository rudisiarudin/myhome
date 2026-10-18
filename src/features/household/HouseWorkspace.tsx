import { useRef } from 'react'
import { Check, Phone, ReceiptText } from 'lucide-react'
import { useHousehold } from './context'
import { contactCategories, daysUntil, documentCategories, formatDate, normalizePhone } from './model'
import { BillEntryForm, ContactEntryForm, DocumentEntryForm, ChoreEntryForm } from './HouseForms'
import { BillsWorkspace } from './Workspace'
import { Empty, RowActions, Section } from './ui'
import { useAccount } from '../account/context'

function DocumentsList({ onAdd }: { onAdd: () => void }) {
  const store = useHousehold()
  const documents = [...store.state.documents].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
  return <section><Section title="Dokumen & masa berlaku" action="Tambah dokumen" onAction={onAdd} /><div className="house-records">{documents.length ? documents.map(document => {
    const days = daysUntil(document.expiryDate)
    const category = documentCategories.find(([value]) => value === document.category)?.[1]
    return <article className="house-record document-record" key={document.id}>
      <div className="document-row"><span className="list-icon"><ReceiptText size={21} /></span><div className="row-copy"><h3>{document.title}</h3><p>{category}</p><p>Berlaku sampai {formatDate(document.expiryDate)}</p></div><span className={`document-days ${days < 0 ? 'record-expired' : ''}`}>{days === 0 ? 'Hari ini' : Math.abs(days)}<small>{days < 0 ? 'hari terlewat' : days === 0 ? 'masa berlaku akhir' : 'hari lagi'}</small></span></div>
      {document.note && <p className="house-record-note">{document.note}</p>}
      <div className="house-record-footer"><span className="small muted">{days < 0 ? 'Masa berlaku sudah lewat' : days === 0 ? 'Periksa masa berlaku hari ini' : 'Catatan dokumen'} </span><RowActions name={document.title} onEdit={() => store.setEditor({ type: 'document', id: document.id })} onDelete={() => store.setEditor({ type: 'confirm', title: 'Hapus catatan dokumen?', description: `Catatan “${document.title}” akan dihapus dari rumah bersama.`, confirm: () => store.deleteDocument(document.id) })} /></div>
    </article>
  }) : <Empty title="Belum ada dokumen">Isi form untuk mencatat dokumen pertama.</Empty>}</div></section>
}

function ContactsList({ onAdd }: { onAdd: () => void }) {
  const store = useHousehold()
  return <section><Section title="Kontak penting" action="Tambah kontak" onAction={onAdd} /><p className="muted small contact-warning">{store.isPreview ? 'Kontak bawaan adalah data contoh, bukan nomor darurat sungguhan.' : 'Pastikan nomor kontak benar sebelum menghubunginya.'}</p><div className="house-records">{store.state.contacts.length ? store.state.contacts.map(contact => <article className="house-record contact-record" key={contact.id}>
    <div className="contact-row"><span className="contact-avatar">{contact.name[0].toUpperCase()}</span><div className="row-copy"><h3>{contact.name}</h3>{contact.role && <p>{contact.role}</p>}<span className="small muted selectable">{contact.phone}</span></div><a className="icon-button call-button" href={`tel:${normalizePhone(contact.phone)}`} aria-label={`Telepon ${contact.name}`}><Phone size={19} /></a></div>
    <div className="house-record-footer"><span className="small muted">{contactCategories.find(([value]) => value === contact.category)?.[1]}</span><RowActions name={contact.name} onEdit={() => store.setEditor({ type: 'contact', id: contact.id })} onDelete={() => store.setEditor({ type: 'confirm', title: 'Hapus kontak?', description: `“${contact.name}” akan dihapus dari daftar kontak.`, confirm: () => store.deleteContact(contact.id) })} /></div>
  </article>) : <Empty title="Belum ada kontak">Isi form untuk menambahkan kontak rumah pertama.</Empty>}</div></section>
}

function ChoresList({ onAdd, role }: { onAdd: () => void; role: 'suami' | 'istri' }) {
  const store = useHousehold()
  const { nameForPerson } = useAccount()
  return <section>
    <Section title="Tugas & Rutinitas Rumah" action="Tambah tugas" onAction={onAdd} />
    <p className="muted small contact-warning">Bagi giliran pekerjaan rumah tangga agar adil dan tertata.</p>
    <div className="house-records">
      {store.state.chores.length ? store.state.chores.map(chore => (
        <article className="house-record" key={chore.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <button
              type="button"
              disabled={store.pending}
              onClick={() => store.toggleChore(chore.id, role)}
              style={{
                width: '44px', height: '44px', borderRadius: '12px',
                border: chore.isDone ? 'none' : '1.8px solid var(--muted)',
                background: chore.isDone ? 'var(--ink)' : 'transparent',
                color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer'
              }}
              aria-label={chore.isDone ? 'Tandai belum selesai' : 'Tandai selesai'}
            >
              {chore.isDone && <Check size={15} strokeWidth={3} />}
            </button>
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 600, textDecoration: chore.isDone ? 'line-through' : 'none', color: chore.isDone ? 'var(--muted)' : 'inherit' }}>
                {chore.title}
              </h3>
              <p className="small muted" style={{ marginTop: '2px' }}>
                Giliran: <strong style={{ textTransform: 'capitalize', color: 'inherit' }}>{nameForPerson(chore.assignee)}</strong> · {chore.frequency}
                {chore.isDone && chore.lastDoneBy && <span> (Selesai oleh {nameForPerson(chore.lastDoneBy)})</span>}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => store.setEditor({ type: 'confirm', title: 'Hapus tugas?', description: `“${chore.title}” dihapus dari tugas rumah.`, confirm: () => store.deleteChore(chore.id) })}
            style={{ color: 'var(--muted)', padding: '6px' }}
            title="Hapus tugas"
          >
            Hapus
          </button>
        </article>
      )) : <Empty title="Belum ada tugas rumah">Isi form untuk menambahkan tugas rutin pertama.</Empty>}
    </div>
  </section>
}

export function HouseWorkspace({ tab, copiedId, onCopy, role = 'suami' }: { tab: 'bills' | 'vault' | 'contacts' | 'chores'; copiedId: string | null; onCopy: (value: string, id: string) => void; role?: 'suami' | 'istri' }) {
  const composer = useRef<HTMLElement>(null)
  const focusForm = () => composer.current?.querySelector('input')?.focus()
  return <div className="house-work-area">
    <section ref={composer} className="house-composer" aria-label={tab === 'bills' ? 'Isi tagihan baru' : tab === 'vault' ? 'Isi dokumen baru' : tab === 'contacts' ? 'Isi kontak baru' : 'Isi tugas baru'}>
      {tab === 'bills' ? <BillEntryForm inline /> : tab === 'vault' ? <DocumentEntryForm inline /> : tab === 'contacts' ? <ContactEntryForm inline /> : <ChoreEntryForm inline />}
    </section>
    <div className="house-list-area">
      {tab === 'bills' ? <BillsWorkspace copiedId={copiedId} onCopy={onCopy} onAdd={focusForm} /> : tab === 'vault' ? <DocumentsList onAdd={focusForm} /> : tab === 'contacts' ? <ContactsList onAdd={focusForm} /> : <ChoresList onAdd={focusForm} role={role} />}
    </div>
  </div>
}
