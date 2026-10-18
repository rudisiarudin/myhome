import { useState } from 'react'
import type { ReactNode } from 'react'
import type { UserProfile } from '../../types'
import { AccountContext } from './context'

const previewMembers: readonly UserProfile[] = [
  { id: 'preview-rudi', name: 'Rudi', role: 'suami' },
  { id: 'preview-istri', name: 'Istri', role: 'istri' },
]

export function AccountProvider({ children, account, members }: {
  children: ReactNode
  account?: UserProfile
  members?: readonly UserProfile[]
}) {
  const [previewId, setPreviewId] = useState(previewMembers[0].id)
  const profiles = account
    ? [account, ...(members ?? []).filter(member => member.id !== account.id)]
    : members?.length ? members : previewMembers
  const currentProfile = account ?? profiles.find(profile => profile.id === previewId) ?? profiles[0]
  const profileForPerson = (person: string) => profiles.find(profile => profile.id === person || profile.role === person)

  return <AccountContext.Provider value={{
    currentProfile,
    members: profiles,
    isPreview: !account,
    selectPreviewAccount: id => { if (!account && profiles.some(profile => profile.id === id)) setPreviewId(id) },
    profileForPerson,
    nameForPerson: person => person === 'berdua' ? 'Berdua' : profileForPerson(person)?.name ?? 'Anggota rumah',
  }}>{children}</AccountContext.Provider>
}
