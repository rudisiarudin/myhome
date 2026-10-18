import { test } from 'node:test'
import assert from 'node:assert/strict'
import { householdShortNames, shortName } from '../src/features/account/display.ts'

test('greeting uses a short name without changing the stored profile name', () => {
  const name = 'Rudi Siarudin'
  assert.equal(shortName(name), 'Rudi')
  assert.equal(shortName(' Ayu   Dewi Saputri '), 'Ayu')
  assert.equal(shortName('Rudi'), 'Rudi')
  assert.equal(name, 'Rudi Siarudin')
})

test('couple signature reads Ayu & Rudi regardless of the active account order', () => {
  const rudi = { name: 'Rudi Siarudin', role: 'suami' }
  const ayu = { name: 'Ayu Dewi Saputri', role: 'istri' }
  const members = [rudi, ayu]
  assert.equal(householdShortNames(members), 'Ayu & Rudi')
  assert.equal(householdShortNames([ayu, rudi]), 'Ayu & Rudi')
  assert.deepEqual(members, [rudi, ayu])
  assert.equal(rudi.name, 'Rudi Siarudin')
  assert.equal(ayu.name, 'Ayu Dewi Saputri')
})

test('single-member and empty households do not invent a partner', () => {
  assert.equal(householdShortNames([{ name: 'Rudi Siarudin', role: 'suami' }]), 'Rudi')
  assert.equal(householdShortNames([]), '')
})
