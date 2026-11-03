/**
 * What the namespace answers: this caller's own instructions, a call that
 * speaks for nobody, and the refusal a write from such a call gets.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import { brandString } from '@lyness/lyn-brand'
import type { InstructionsEntry, InstructionsOwnerId } from '@lyness/lyn-personal-instructions/types'
import PersonalInstructionsController from '../src/index.ts'

const SAM = brandString<InstructionsOwnerId>('person:sam')

const live: Context[] = []
afterEach(async () => { for (const ctx of live.splice(0)) await ctx.fiber.dispose() })

/**
 * Mount the controller over a store double.
 *
 * A double rather than the real store because what this unit owns is the
 * translation to the wire, not durability: the store's own spec covers what
 * it keeps.
 * @param options - whose call it is, and what that owner has saved.
 * @returns the controller and the writes it performed.
 */
async function harness(options: { owner?: InstructionsOwnerId; entry?: InstructionsEntry } = {}) {
  const ctx = new Context()
  live.push(ctx)
  const saved: { owner: InstructionsOwnerId; text: string }[] = []
  let entry = options.entry
  ctx.provide('personalInstructions', {
    maxChars: 4_000,
    ownerOfCall: () => options.owner,
    get: (owner: InstructionsOwnerId) => owner === options.owner ? entry : undefined,
    save: (owner: InstructionsOwnerId, text: string) => {
      saved.push({ owner, text })
      entry = text.trim() === '' ? undefined : { text: text.trim(), writtenAt: '2026-10-29T00:00:00.000Z' }
      return Promise.resolve(entry)
    },
  })
  await ctx.plugin(PersonalInstructionsController)
  return { controller: ctx.personalInstructionsController, saved }
}

describe('personalInstructions.describe', () => {
  it('answers what this caller has saved', async () => {
    const { controller } = await harness({
      owner: SAM, entry: { text: 'Call me Sam.', writtenAt: '2026-10-28T00:00:00.000Z' },
    })
    expect(controller.describe()).toEqual({
      owned: true, text: 'Call me Sam.', writtenAt: '2026-10-28T00:00:00.000Z', maxChars: 4_000,
    })
  })

  it('answers an empty text for a caller who has saved none', async () => {
    const { controller } = await harness({ owner: SAM })
    expect(controller.describe()).toEqual({ owned: true, text: '', maxChars: 4_000 })
  })

  it('says it owns nothing for a call that speaks for nobody', async () => {
    const { controller } = await harness()
    expect(controller.describe()).toEqual({ owned: false, text: '', maxChars: 4_000 })
  })
})

describe('personalInstructions.save', () => {
  it('writes under the caller rather than under anything it was handed', async () => {
    const { controller, saved } = await harness({ owner: SAM })
    const view = await controller.save('Call me Sam.')
    expect(saved).toEqual([{ owner: SAM, text: 'Call me Sam.' }])
    // Read back from the store rather than echoed, so the page shows what was
    // kept rather than what was sent.
    expect(view).toEqual({
      owned: true, text: 'Call me Sam.', writtenAt: '2026-10-29T00:00:00.000Z', maxChars: 4_000,
    })
  })

  it('clears them when the text is blank', async () => {
    const { controller } = await harness({
      owner: SAM, entry: { text: 'Call me Sam.', writtenAt: '2026-10-28T00:00:00.000Z' },
    })
    expect(await controller.save('  ')).toEqual({ owned: true, text: '', maxChars: 4_000 })
  })

  it('refuses a write from a call that speaks for nobody', async () => {
    const { controller, saved } = await harness()
    await expect(controller.save('Call me Sam.')).rejects.toThrow(/speaks for nobody/u)
    expect(saved).toEqual([])
  })
})
