import type { UserProfile } from '../../types'

export const shortName = (name: string) => name.trim().split(/\s+/)[0]

export function householdShortNames(members: readonly Pick<UserProfile, 'name' | 'role'>[]) {
  return [...members]
    .sort((a, b) => a.role === b.role ? 0 : a.role === 'istri' ? -1 : 1)
    .map(member => shortName(member.name))
    .filter(Boolean)
    .join(' & ')
}
