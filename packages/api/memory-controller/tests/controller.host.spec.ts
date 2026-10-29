/**
 * What the namespace answers: this caller's own memories, a call that speaks
 * for nobody, and a removal that reaches only the caller's own records.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import { brandString } from '@lyness/lyn-brand'
import { memoryOwnerOfPerson } from '@lyness/lyn-memory'
import type { MemoryId, MemoryOwnerId, MemoryRecord } from '@lyness/lyn-memory'
import type { PersonId } from '@lyness/lyn-people'
import MemoryController from '../src/index.ts'

const ADA = brandString<PersonId>('ada')

const KEPT: MemoryRecord = {
  id: brandString<MemoryId>('one'),
  text: 'Ada prefers metric units.',
  scope: 'member',
  writtenAt: '2026-10-28T00:00:00.000Z',
  owner: memoryOwnerOfPerson(ADA),
}

const live: Context[] = []
afterEach(async () => { for (const ctx of live.splice(0)) await ctx.fiber.dispose() })

/**
 * Mount the controller over a store double.
 *
 * A double rather than the real store because what this unit owns is the
 * translation to the wire; the store's own spec covers which entries one
 * owner may reach.
 * @param options - whose call it is, and what that owner has kept.
 * @returns the controller and the removals it asked for.
 */
async function harness(options: { person?: PersonId; kept?: readonly MemoryRecord[] } = {}) {
  const ctx = new Context()
  live.push(ctx)
  const removals: { owner: MemoryOwnerId; id: MemoryId }[] = []
  let kept = options.kept ?? []
  if (options.person !== undefined) {
    ctx.provide('requestPrincipal', { current: () => ({ person: options.person, acting: {} }) })
  }
  ctx.provide('memory', {
    listOwnedBy: (owner: MemoryOwnerId) => Promise.resolve(kept.filter(one => one.owner === owner)),
    forgetOwnedBy: (owner: MemoryOwnerId, id: MemoryId) => {
      removals.push({ owner, id })
      const before = kept.length
      kept = kept.filter(one => !(one.owner === owner && one.id === id))
      return Promise.resolve(kept.length !== before)
    },
  })
  await ctx.plugin(MemoryController)
  return { controller: ctx.memoryController, removals }
}

describe('memories.list', () => {
  it('answers this caller their own entries', async () => {
    const { controller } = await harness({ person: ADA, kept: [KEPT] })
    expect(await controller.list()).toEqual({
      owned: true,
      entries: [{ id: 'one', text: 'Ada prefers metric units.', writtenAt: '2026-10-28T00:00:00.000Z' }],
    })
  })

  it('answers an empty list for a person with nothing remembered', async () => {
    const { controller } = await harness({ person: ADA })
    expect(await controller.list()).toEqual({ owned: true, entries: [] })
  })

  it('says it owns nothing for a call that speaks for nobody', async () => {
    const { controller } = await harness()
    expect(await controller.list()).toEqual({ owned: false, entries: [] })
  })
})

describe('memories.forget', () => {
  it('removes under the caller rather than under anything it was handed', async () => {
    const { controller, removals } = await harness({ person: ADA, kept: [KEPT] })
    const view = await controller.forget('one')
    expect(removals).toEqual([{ owner: memoryOwnerOfPerson(ADA), id: 'one' }])
    // What remains is read back from the store, so a row that was already
    // gone does not linger in the answer.
    expect(view).toEqual({ owned: true, entries: [] })
  })

  it('answers the unchanged list when the id is not the caller\'s', async () => {
    const { controller } = await harness({ person: ADA, kept: [KEPT] })
    expect(await controller.forget('somebody-else')).toEqual({
      owned: true,
      entries: [{ id: 'one', text: 'Ada prefers metric units.', writtenAt: '2026-10-28T00:00:00.000Z' }],
    })
  })

  it('refuses a removal from a call that speaks for nobody', async () => {
    const { controller, removals } = await harness()
    await expect(controller.forget('one')).rejects.toThrow(/speaks for nobody/u)
    expect(removals).toEqual([])
  })
})
