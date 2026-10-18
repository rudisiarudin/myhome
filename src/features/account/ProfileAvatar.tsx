import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import type { UserProfile } from '../../types'
import { useAccount } from './context'
import './account.css'
import { useConnection } from '../connection/ConnectionContext'
import { errorMessage } from '../../lib/errors'

function ProfileSettings() {
  const connection = useConnection()
  const { currentProfile, members } = useAccount()
  const [name, setName] = useState(currentProfile.name)
  const [photo, setPhoto] = useState(currentProfile.avatarUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [invite, setInvite] = useState('')
  if (!connection) return null
  return <div className="profile-settings">
    <details><summary>Ubah profil</summary><form className="workspace-form access-form" onSubmit={async event => {
      event.preventDefault()
      if (busy) return
      setBusy(true); setError(''); setMessage('')
      try { const error = await connection.updateProfile(name, photo); if (error) setError(error); else setMessage('Profil tersimpan.') }
      catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
    }}><fieldset disabled={busy}><label>Nama panggilan<input required maxLength={100} value={name} onChange={event => setName(event.target.value)} /></label><label>URL foto profil (opsional)<input type="url" pattern="https://.*" maxLength={2048} placeholder="https://…" value={photo} onChange={event => setPhoto(event.target.value)} /></label><small>Gunakan URL HTTPS dari foto akun. Upload file belum tersedia.</small><button className="primary-button" type="submit">{busy ? 'Menyimpan…' : 'Simpan profil'}</button></fieldset></form></details>
    {connection.isOwner && members.length < 2 && <><button className="secondary-button" disabled={busy} onClick={async () => {
      setBusy(true); setError(''); setMessage('')
      try { setInvite(await connection.createInvite()) } catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
    }}>{invite ? 'Buat ulang kode undangan' : 'Undang pasangan'}</button>{invite && <><code className="invite-code">{invite}</code><p className="account-photo-hint">Sekali pakai, berlaku 48 jam. Kode baru membatalkan kode lama.</p><button className="text-button" onClick={async () => { try { await navigator.clipboard.writeText(invite); setMessage('Kode undangan disalin.') } catch { setMessage('Pilih dan salin kode undangan secara manual.') } }}>Salin kode</button></>}</>}
    {error && <p role="alert" className="form-error">{error}</p>}{message && <p role="status" className="account-photo-hint">{message}</p>}
    <button className="secondary-button" disabled={busy} onClick={() => void connection.signOut()}>Keluar akun</button>
  </div>
}

export function ProfileAvatar({ profile, className = '' }: { profile?: UserProfile; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | undefined>()
  const name = profile?.name.trim() || 'Profil belum tersedia'
  const initials = profile?.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?'
  const photo = profile?.avatarUrl && failedUrl !== profile.avatarUrl ? profile.avatarUrl : undefined
  return <span className={`profile-avatar ${className}`} role="img" aria-label={profile ? `Profil ${name}` : name} data-avatar-source={photo ? 'image' : 'initials'}>
    {photo ? <img src={photo} alt="" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedUrl(photo)} /> : <span aria-hidden="true">{initials}</span>}
  </span>
}

export function MemberAvatars({ person }: { person?: string }) {
  const { members, profileForPerson } = useAccount()
  const profiles = person && person !== 'berdua' ? [profileForPerson(person)] : members
  return <div className="avatars" aria-label={profiles.map(profile => profile?.name ?? 'Profil belum tersedia').join(' dan ')}>
    {profiles.map((profile, index) => <ProfileAvatar key={profile?.id ?? 'missing'} profile={profile} className={`avatar ${index ? 'avatar-partner' : ''}`} />)}
  </div>
}

export function AccountMenu() {
  const { currentProfile, members, isPreview, selectPreviewAccount } = useAccount()
  const [open, setOpen] = useState(false)
  const control = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    panel.current?.querySelector('button')?.focus()
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !control.current?.contains(event.target)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus() }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const close = () => { setOpen(false); trigger.current?.focus() }
  return <div ref={control} className="account-control" onBlurCapture={event => {
    if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }}>
    <button ref={trigger} className="account-trigger" aria-label={`Buka profil ${currentProfile.name}`} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
      <ProfileAvatar profile={currentProfile} className="account-avatar" /><ChevronDown size={13} />
    </button>
    {open && <div ref={panel} id={panelId} className="account-panel" role="dialog" aria-label="Profil akun">
      <button className="icon-button account-close" aria-label="Tutup profil" onClick={close}><X size={18} /></button>
      <div className="account-summary"><ProfileAvatar profile={currentProfile} /><div><strong>{currentProfile.name}</strong><p>{isPreview ? 'Akun contoh · pratinjau' : 'Akun aktif'}</p></div></div>
      <p className="account-photo-hint">{currentProfile.avatarUrl ? 'Foto mengikuti profil akun.' : 'Foto profil belum tersedia, sementara memakai inisial.'}</p>
      {isPreview && <><div className="account-options" role="group" aria-label="Pilih akun contoh">{members.map(member => <button key={member.id} className="account-option" aria-label={`Pratinjau sebagai ${member.name}`} aria-pressed={currentProfile.id === member.id} onClick={() => { selectPreviewAccount(member.id); close() }}><ProfileAvatar profile={member} /><span>{member.name}</span>{currentProfile.id === member.id && <Check size={16} />}</button>)}</div><p className="account-preview-note">Pergantian ini hanya simulasi, bukan login.</p></>}
      {!isPreview && <ProfileSettings />}
    </div>}
  </div>
}
