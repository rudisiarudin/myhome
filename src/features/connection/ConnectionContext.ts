import { createContext, useContext } from 'react'

export interface ConnectionActions {
  householdName: string
  isOwner: boolean
  signOut: () => Promise<void>
  updateProfile: (name: string, avatarUrl: string) => Promise<string | null>
  createInvite: () => Promise<string>
}
export const ConnectionContext = createContext<ConnectionActions | null>(null)
export const useConnection = () => useContext(ConnectionContext)
