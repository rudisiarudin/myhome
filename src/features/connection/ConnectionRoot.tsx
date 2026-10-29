import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { Moon, Sun } from 'lucide-react'
import { AppLogoIcon } from '../../components/AppLogo'
import { supabase } from '../../lib/supabase'
import { errorMessage } from '../../lib/errors'
import { useTheme } from '../../theme'
import { AccountProvider } from '../account/AccountProvider'
import { ConnectedHouseholdProvider } from '../household/ConnectedHouseholdProvider'
import { HouseholdProvider } from '../household/store'
import { loadIdentity } from '../household/repository'
import { ConnectionContext } from './ConnectionContext'
import '../household/Workspace.css'
import './connection.css'
import '../../App.css'

const App = lazy(() => import('../../App'))

// Layar tunggu tanpa teks: cukup logo berdenyut pelan. Pengguna yang sudah
// masuk tidak perlu membaca "memeriksa sesi / memuat profil" setiap refresh.
function Splash() {
  return <div className="app-splash" role="status" aria-label="Memuat Myhome"><AppLogoIcon size={56} /></div>
}

function AccessShell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useTheme()
  return <main className="access-shell"><header className="access-header"><a className="wordmark" href="/" aria-label="MyHome"><AppLogoIcon size={22} className="logo-house" />myhome<span className="dot-green">.</span></a><button className="icon-button theme-toggle" aria-label={theme === 'light' ? 'Gunakan mode gelap' : 'Gunakan mode terang'} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}</button></header><div className="access-content">{children}</div><footer className="access-footer">Satu rumah, catatan bersama.</footer></main>
}

function AuthForm({ client, recovery }: { client: SupabaseClient; recovery: boolean }) {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      if (recovery) {
        const { error } = await client.auth.updateUser({ password })
        if (error) throw error
        window.location.assign(window.location.origin + window.location.pathname)
      } else if (mode === 'reset') {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + window.location.pathname })
        if (error) throw error
        setMessage('Jika email terdaftar, tautan penggantian kata sandi akan dikirim. Periksa kotak masuk dan spam.')
      } else if (mode === 'signup') {
        const { data, error } = await client.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin + window.location.pathname } })
        if (error) throw error
        if (!data.session) setMessage('Periksa email untuk mengonfirmasi akun, lalu masuk di sini. Jika email sudah terdaftar, gunakan halaman Masuk.')
      } else {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      }
    } catch (error) { setError(errorMessage(error)) }
    finally { setBusy(false); setPassword('') }
  }
  return <>
    <h1>{recovery ? 'Kata sandi baru' : mode === 'signup' ? 'Mulai cerita rumah kita.' : mode === 'reset' ? 'Lupa kata sandi?' : 'Selamat pulang.'}</h1>
    <p className="access-description">{recovery ? 'Buat kata sandi baru untuk akunmu.' : mode === 'signup' ? 'Buat akun pribadi. Setelah itu, ajak pasangan ke rumah yang sama.' : mode === 'reset' ? 'Kami kirim tautan untuk mengganti kata sandimu.' : 'Masuk untuk melanjutkan catatan dan rencana berdua.'}</p>
    {!recovery && <div className="segmented-control" role="group" aria-label="Akses akun">{(['login', 'signup'] as const).map(value => <button key={value} disabled={busy} aria-pressed={mode === value} onClick={() => { setMode(value); setError(''); setMessage('') }}>{value === 'login' ? 'Masuk' : 'Daftar akun'}</button>)}</div>}
    <form className="workspace-form access-form" onSubmit={submit}>
      <fieldset disabled={busy}>
        {!recovery && mode === 'signup' && <label>Nama panggilan<input required maxLength={100} autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label>}
        {!recovery && <label>Email<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>}
        {(recovery || mode !== 'reset') && <label>Kata sandi<input required type="password" minLength={mode === 'signup' || recovery ? 8 : 1} autoComplete={mode === 'signup' || recovery ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} /></label>}
        {mode === 'signup' && <p className="form-hint">Gunakan minimal 8 karakter.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="access-message" role="status">{message}</p>}
        <button className="primary-button" type="submit">{busy ? 'Memproses…' : recovery ? 'Simpan kata sandi' : mode === 'signup' ? 'Buat akun' : mode === 'reset' ? 'Kirim tautan pemulihan' : 'Masuk ke rumah'}</button>
      </fieldset>
    </form>
    {!recovery && mode === 'login' && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
        <button className="text-button access-link" style={{ margin: 0 }} onClick={() => { setMode('reset'); setError(''); setMessage('') }}>Lupa kata sandi?</button>
        <button
          type="button"
          className="text-button access-link"
          style={{ margin: 0, color: 'var(--muted)', fontSize: '11.5px' }}
          onClick={() => {
            window.location.search = '?preview=true'
          }}
        >
          Masuk mode demo →
        </button>
      </div>
    )}
  </>
}

type Identity = Awaited<ReturnType<typeof loadIdentity>>
function Onboarding({ client, identity, session, onReload }: { client: SupabaseClient; identity: Identity; session: Session; onReload: () => Promise<void> }) {
  const [step, setStep] = useState<'create' | 'join'>('create')
  const [name, setName] = useState(String(identity.profile?.full_name ?? session.user.user_metadata.full_name ?? ''))
  const [houseName, setHouseName] = useState('Rumah kita')
  const [role, setRole] = useState('suami')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const db = client.schema('myhome')
      const profile = await db.rpc('initialize_profile', { p_full_name: name.trim(), p_avatar_url: identity.profile?.avatar_url ?? null })
      if (profile.error) throw profile.error
      const result = step === 'create' ? await db.rpc('create_household', { p_name: houseName.trim(), p_role: role })
        : await db.rpc('join_household', { p_token: token.trim() })
      if (result.error) throw result.error
      await onReload()
    } catch (error) { setError(errorMessage(error)) }
    finally { setBusy(false) }
  }
  return <><h1>Rumah kita, mulai di sini.</h1><p className="access-description">Buat satu rumah untuk berdua, atau gabung memakai kode undangan pasangan.</p>
    <div className="segmented-control" role="group" aria-label="Pilihan rumah"><button disabled={busy} aria-pressed={step === 'create'} onClick={() => setStep('create')}>Buat rumah</button><button disabled={busy} aria-pressed={step === 'join'} onClick={() => setStep('join')}>Gabung rumah</button></div>
    <form className="workspace-form access-form" onSubmit={submit}><fieldset disabled={busy}>
      <label>Nama panggilan<input required maxLength={100} autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label>
      {step === 'create' ? <><label>Nama rumah<input required maxLength={100} value={houseName} onChange={e => setHouseName(e.target.value)} /></label><label>Peran di rumah<select value={role} onChange={e => setRole(e.target.value)}><option value="suami">Suami</option><option value="istri">Istri</option></select></label><p className="form-hint">Pasangan akan mendapat peran yang belum terisi. Data rumah dimulai kosong, tanpa transaksi contoh.</p></> : <label>Kode undangan<input required minLength={32} maxLength={32} autoCapitalize="none" autoComplete="off" spellCheck={false} value={token} onChange={e => setToken(e.target.value)} /><small>Kode 32 karakter dari profil pasangan, berlaku 48 jam.</small></label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="primary-button">{busy ? 'Menyiapkan…' : step === 'create' ? 'Buat rumah kita' : 'Gabung rumah pasangan'}</button>
    </fieldset></form></>
}

function SignedIn({ client, session, onSignOut }: { client: SupabaseClient; session: Session; onSignOut: () => Promise<void> }) {
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const invalidate = useCallback(() => { ++generation.current }, [])
  const reload = useCallback(async () => {
    const version = ++generation.current
    try {
      const data = await loadIdentity(client, session.user.id)
      if (version === generation.current) { setIdentity(data); setError('') }
    } catch (error) { if (version === generation.current) setError(errorMessage(error)) }
  }, [client, session.user.id])
  useEffect(() => {
    queueMicrotask(() => { void reload() })
    const focus = () => { void reload() }
    window.addEventListener('focus', focus)
    const timer = setInterval(focus, 30000)
    return () => { invalidate(); window.removeEventListener('focus', focus); clearInterval(timer) }
  }, [reload, invalidate])

  if (!identity || !identity.household) {
    if (error) return <AccessShell><h1>Koneksi belum siap</h1><p role="alert" className="form-error">{error}</p><button className="primary-button" onClick={() => void reload()}>Coba lagi</button><button className="text-button access-link" onClick={() => void onSignOut()}>Keluar akun</button></AccessShell>
    if (!identity) return <Splash />
    return <AccessShell><Onboarding client={client} identity={identity} session={session} onReload={reload} /><button className="text-button access-link" onClick={() => void onSignOut()}>Keluar akun</button></AccessShell>
  }
  const household = identity.household
  const currentProfile = identity.members.find(member => member.id === session.user.id)
  if (!currentProfile) return <AccessShell><p role="alert">Profil anggota tidak ditemukan.</p><button className="primary-button" onClick={() => void onSignOut()}>Keluar akun</button></AccessShell>
  return <ConnectionContext.Provider value={{
    householdName: String(household.name), isOwner: household.owner_user_id === session.user.id,
    signOut: onSignOut,
    updateProfile: async (name, avatarUrl) => {
      const { error } = await client.schema('myhome').rpc('initialize_profile', { p_full_name: name.trim(), p_avatar_url: avatarUrl.trim() || null })
      if (error) return errorMessage(error)
      await reload()
      return null
    },
    createInvite: async () => {
      const { data, error } = await client.schema('myhome').rpc('create_invite', { p_household_id: household.id })
      if (error) throw error
      return String(data)
    },
  }}>
    <AccountProvider account={currentProfile} members={identity.members}>
      {error && <p className="connection-warning" role="alert">{error}</p>}
      <ConnectedHouseholdProvider client={client} householdId={String(household.id)}><Suspense fallback={<Splash />}><App /></Suspense></ConnectedHouseholdProvider>
    </AccountProvider>
  </ConnectionContext.Provider>
}

export function ConnectionRoot() {
  const client = supabase
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!client)
  const [error, setError] = useState('')
  const [recovery, setRecovery] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery')
  useEffect(() => {
    if (!client) return
    let active = true
    let received = false
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return
      received = true
      setSession(session); setReady(true)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') setRecovery(false)
    })
    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setError(errorMessage(error))
      if (!received) setSession(data.session)
      setReady(true)
    }).catch(error => { if (active) { setError(errorMessage(error)); setReady(true) } })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [client])
  const signOut = async () => {
    if (!client) return
    const { error } = await client.auth.signOut()
    if (error) { setError(errorMessage(error)); return }
    setSession(null); setRecovery(false)
  }
  const isDemo = new URLSearchParams(window.location.search).get('preview') === 'true'
  if (isDemo || !client) {
    return (
      <AccountProvider>
        <HouseholdProvider>
          <Suspense fallback={<Splash />}>
            <App />
          </Suspense>
        </HouseholdProvider>
      </AccountProvider>
    )
  }

  if (!ready) return <Splash />
  return <>{error && <div className="connection-warning" role="alert">{error}<button className="text-button" onClick={() => setError('')}>Tutup pesan</button></div>}{!session || recovery ? <AccessShell><AuthForm client={client} recovery={recovery} /></AccessShell> : <SignedIn key={session.user.id} client={client} session={session} onSignOut={signOut} />}</>
}
