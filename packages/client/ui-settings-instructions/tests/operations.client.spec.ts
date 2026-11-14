/**
 * What the calls do: one in-flight read shared, a refusal reported with the
 * reason, and a save whose stored state is read back from the answer.
 */

import { describe, expect, it, vi } from 'vitest'
import { RemoteError } from '@lyness/lyn-typert-protocol'
import type { RemoteFailure } from '@lyness/lyn-typert-protocol'
import type { InstructionsView } from '@lyness/lyn-api-personal-instructions-controller/types'
import { createInstructionsOperations } from '../src/client/operations.ts'
import type { InstructionsCalls, InstructionsSink } from '../src/client/operations.ts'

const VIEW: InstructionsView = { owned: true, text: 'Call me Sam.', maxChars: 4_000 }

/** A failure as the Gateway reports one. */
const REFUSED: RemoteFailure = new RemoteError('gateway/internal', 'too long', {})

/** A sink that records what it was told, in order. */
function recorder() {
  const seen: string[] = []
  const sink: InstructionsSink = {
    begin: () => { seen.push('begin') },
    succeed: (view) => { seen.push(`succeed:${view.text}`) },
    fail: () => { seen.push('fail') },
    reset: () => { seen.push('reset') },
    work: () => { seen.push('work') },
    saved: (view) => { seen.push(`saved:${view.text}`) },
    refused: (reason) => { seen.push(`refused:${reason}`) },
  }
  return { seen, sink }
}

describe('the instructions operations', () => {
  it('shares one read between callers that ask at once', async () => {
    const describeCall = vi.fn(() => Promise.resolve({ ok: true as const, value: VIEW }))
    const { seen, sink } = recorder()
    const calls: InstructionsCalls = { describe: describeCall, save: () => { throw new Error('unused') } }
    const operations = createInstructionsOperations(calls, sink)
    await Promise.all([operations.load(), operations.load()])
    expect(describeCall).toHaveBeenCalledOnce()
    expect(seen).toEqual(['begin', 'succeed:Call me Sam.'])
  })

  it('shows the attempt rather than the failure it replaces', async () => {
    let answer: () => Promise<{ ok: boolean; value?: InstructionsView; error?: RemoteFailure }> =
      () => Promise.resolve({ ok: false, error: REFUSED })
    const { seen, sink } = recorder()
    const operations = createInstructionsOperations(
      { describe: () => answer(), save: () => { throw new Error('unused') } } as InstructionsCalls, sink)
    await operations.load()
    answer = () => Promise.resolve({ ok: true, value: VIEW })
    await operations.retry()
    expect(seen).toEqual(['begin', 'fail', 'reset', 'begin', 'succeed:Call me Sam.'])
  })

  it('reports a read that threw the same way as one that refused', async () => {
    const { seen, sink } = recorder()
    const operations = createInstructionsOperations({
      describe: () => Promise.reject(new Error('the carrier went away')),
      save: () => { throw new Error('unused') },
    }, sink)
    await operations.load()
    expect(seen).toEqual(['begin', 'fail'])
  })

  it('publishes what the deployment kept rather than what was sent', async () => {
    const { seen, sink } = recorder()
    const operations = createInstructionsOperations({
      describe: () => { throw new Error('unused') },
      save: () => Promise.resolve({ ok: true as const, value: { ...VIEW, text: 'Call me Sam.' } }),
    }, sink)
    await operations.save('  Call me Sam.  ')
    expect(seen).toEqual(['work', 'saved:Call me Sam.'])
  })

  it('reports a refused save with the reason the server gave', async () => {
    const { seen, sink } = recorder()
    const operations = createInstructionsOperations({
      describe: () => { throw new Error('unused') },
      save: () => Promise.resolve({ ok: false as const, error: REFUSED }),
    }, sink)
    await operations.save('x')
    expect(seen).toEqual(['work', 'refused:too long'])
  })

  it('reports a save that threw with what it threw', async () => {
    const { seen, sink } = recorder()
    const operations = createInstructionsOperations({
      describe: () => { throw new Error('unused') },
      save: () => Promise.reject(new Error('the carrier went away')),
    }, sink)
    await operations.save('x')
    expect(seen).toEqual(['work', 'refused:the carrier went away'])
  })
})
