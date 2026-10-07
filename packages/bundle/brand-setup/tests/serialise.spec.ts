/**
 * The order applies run in.
 *
 * Interleaving is what a concurrent apply would leave behind, so these assert
 * the ordering itself rather than a state that only sometimes goes wrong.
 */
import { describe, expect, it } from 'vitest'
import { createSerialiser } from '../src/serialise.ts'

/** A unit of work that finishes when the test says so, and records its turn. */
function unit(log: string[], name: string): { work: () => Promise<string>; finish: () => void } {
  let release = (): void => {}
  const started = new Promise<void>((resolve) => { release = resolve })
  return {
    work: async () => {
      log.push(`${name} started`)
      await started
      log.push(`${name} finished`)
      return name
    },
    finish: () => { release() },
  }
}

describe('one apply at a time', () => {
  it('starts a run only after the run before it finished', async () => {
    const log: string[] = []
    const serialise = createSerialiser()
    const first = unit(log, 'first')
    const second = unit(log, 'second')

    const running = Promise.all([serialise(first.work), serialise(second.work)])
    await Promise.resolve()
    // The second is handed over while the first still holds the writes.
    expect(log).toEqual(['first started'])

    first.finish()
    second.finish()
    expect(await running).toEqual(['first', 'second'])
    expect(log).toEqual(['first started', 'first finished', 'second started', 'second finished'])
  })

  it('runs the next unit after one fails, and hands each caller its own outcome', async () => {
    const serialise = createSerialiser()
    const failed = serialise(() => Promise.reject(new Error('the brand could not be written')))
    const after = serialise(() => Promise.resolve('applied'))

    await expect(failed).rejects.toThrow('the brand could not be written')
    expect(await after).toBe('applied')
  })
})
