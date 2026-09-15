// @vitest-environment jsdom
import { Context } from '@lyness/cordis'
import { describe, expect, it } from 'vitest'
import { SlotRegistry } from '@lyness/lyn-client-ui-renderer/client'
import { apply, inject } from '../src/client/index.ts'
import { apply as hostApply } from '../src/index.ts'

const HOLES = [
  'sidebar.brand.mark',
  'sidebar.brand.name',
  'conversation.hero.brand.mark',
] as const

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  const declare = (holes: readonly string[]) => slots.register({
    name: 'root',
    children: Object.fromEntries(holes.map(name => [name, { kind: 'single', scope: 'root' }])),
  } as never, () => null)
  const counts = () => HOLES.map(hole => slots.entries(hole).length)
  return { ctx, declare, counts }
}

describe('lyness browser-brand plugin', () => {
  it('keeps the host Loader entry inert', () => {
    expect(hostApply).not.toThrow()
  })

  it('declares only the slot service it uses', () => {
    expect(inject).toEqual(['slots'])
  })

  it('fills declarations made before or after apply and removes every occupant on teardown', async () => {
    const before = await bench()
    const disposeHoles = before.declare(HOLES)
    const fiber = before.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(before.counts()).toEqual([1, 1, 1])

    disposeHoles()
    expect(before.counts()).toEqual([0, 0, 0])
    before.declare(HOLES)
    await Promise.resolve()
    expect(before.counts()).toEqual([1, 1, 1])

    await fiber.dispose()
    expect(before.counts()).toEqual([0, 0, 0])

    const after = await bench()
    await after.ctx.plugin({ inject: [...inject], apply }).await()
    expect(after.counts()).toEqual([0, 0, 0])
    after.declare(HOLES)
    await Promise.resolve()
    expect(after.counts()).toEqual([1, 1, 1])
  })

  it('fills the hero mark without waiting for the sidebar declarations', async () => {
    const subject = await bench()
    subject.declare(['conversation.hero.brand.mark'])
    await subject.ctx.plugin({ inject: [...inject], apply }).await()
    expect(subject.counts()).toEqual([0, 0, 1])
  })
})
