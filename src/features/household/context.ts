import { createContext, useContext } from 'react'
import type { HouseholdStore } from './store'

export const HouseholdContext = createContext<HouseholdStore | null>(null)

export function useHousehold() {
  const store = useContext(HouseholdContext)
  if (!store) throw new Error('useHousehold requires HouseholdProvider')
  return store
}
