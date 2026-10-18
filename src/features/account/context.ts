import { createContext, useContext } from 'react'
import type { UserProfile } from '../../types'

export interface AccountState {
  currentProfile: UserProfile
  members: readonly UserProfile[]
  isPreview: boolean
  selectPreviewAccount: (id: string) => void
  profileForPerson: (person: string) => UserProfile | undefined
  nameForPerson: (person: string) => string
}

export const AccountContext = createContext<AccountState | null>(null)

export function useAccount() {
  const account = useContext(AccountContext)
  if (!account) throw new Error('useAccount requires AccountProvider')
  return account
}
