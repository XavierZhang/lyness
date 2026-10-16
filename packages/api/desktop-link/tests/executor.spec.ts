/**
 * The desktop's end: which calls it serves, how a call's items and value are
 * separated, and what a call it cannot serve answers.
 */

import { describe, expect, it, vi } from 'vitest'
import { DesktopExecutor, failureReason, unknownCapability } from '../src/executor.ts'
import type { DesktopReply, DesktopRequest } from '../src/types.ts'
import { brandString } from '@lyness/lyn-brand'
import type { CallId } from '../src/types.ts'

const CALL = brandString<CallId>('c1')

/** One request stream a test closes when it is done feeding it. */
function requests(): { send: (r: DesktopRequest) => void; end: () => void; items: AsyncIterable<DesktopRequest> } {
  const queued: DesktopRequest[] = []
  let wake: (() => void) | undefined
  let ended = false
  const nudge = (): void => { const w = wake; wake = undefined; w?.() }
  return {
    send: (r) => { queued.push(r); nudge() },
    end: () => { ended = true; nudge() },
    items: {
      async *[Symbol.asyncIterator]() {
        for (;;) {
          const next = queued.shift()
          if (next !== undefined) { yield next; continue }
          if (ended) return
          await new Promise<void>((resolve) => { wake = resolve })
        }
      },
    },
  }
}

describe('unknownCapability and failureReason', () => {
  it('names the capability a call asked for', () => {
    expect(unknownCapability('subprocess')).toContain('"subprocess"')
  })

  it('carries an Error message, and stringifies anything else', () => {
    expect(failureReason(new Error('no such file'))).toBe('no such file')
    expect(failureReason('plain')).toBe('plain')
  })
})

describe('DesktopExecutor', () => {
  it('refuses a capability this machine does not serve', async () => {
    const executor = new DesktopExecutor()
    const stream = requests()
    const replies: DesktopReply[] = []
    const serving = executor.serve(stream.items, reply => replies.push(reply))
    stream.send({ kind: 'call', id: CALL, capability: 'subprocess', operation: 'spawn', payload: {} })
    stream.end()
    await serving
    expect(replies).toEqual([{ kind: 'failed', id: CALL, reason: unknownCapability('subprocess') }])
  })

  it('answers a single-value call with just its value', async () => {
    const executor = new DesktopExecutor()
    executor.register('probe', { perform: async function* () { yield 'pong' } })
    const stream = requests()
    const replies: DesktopReply[] = []
    const serving = executor.serve(stream.items, reply => replies.push(reply))
    stream.send({ kind: 'call', id: CALL, capability: 'probe', operation: 'ping', payload: {} })
    stream.end()
    await serving
    expect(replies).toEqual([{ kind: 'done', id: CALL, value: 'pong' }])
  })

  it('sends everything before the last item as progress', async () => {
    const executor = new DesktopExecutor()
    executor.register('shell', { perform: async function* () { yield 'a'; yield 'b'; yield 0 } })
    const stream = requests()
    const replies: DesktopReply[] = []
    const serving = executor.serve(stream.items, reply => replies.push(reply))
    stream.send({ kind: 'call', id: CALL, capability: 'shell', operation: 'run', payload: {} })
    stream.end()
    await serving
    expect(replies).toEqual([
      { kind: 'item', id: CALL, value: 'a' },
      { kind: 'item', id: CALL, value: 'b' },
      { kind: 'done', id: CALL, value: 0 },
    ])
  })

  it('passes the operation and payload through to the handler', async () => {
    const perform = vi.fn(async function* () { yield 'ok' })
    const executor = new DesktopExecutor()
    executor.register('shell', { perform })
    const stream = requests()
    const serving = executor.serve(stream.items, () => undefined)
    stream.send({ kind: 'call', id: CALL, capability: 'shell', operation: 'run', payload: { cmd: 'ls' } })
    stream.end()
    await serving
    expect(perform).toHaveBeenCalledWith('run', { cmd: 'ls' }, expect.any(AbortSignal))
  })

  it('reports a handler failure rather than leaving the Host waiting', async () => {
    const executor = new DesktopExecutor()
    executor.register('shell', { perform: async function* () { yield 'a'; throw new Error('died') } })
    const stream = requests()
    const replies: DesktopReply[] = []
    const serving = executor.serve(stream.items, reply => replies.push(reply))
    stream.send({ kind: 'call', id: CALL, capability: 'shell', operation: 'run', payload: {} })
    stream.end()
    await serving
    expect(replies.at(-1)).toEqual({ kind: 'failed', id: CALL, reason: 'died' })
  })

  it('aborts the handler when the Host cancels', async () => {
    let seen: AbortSignal | undefined
    const executor = new DesktopExecutor()
    executor.register('shell', {
      perform: async function* (_operation, _payload, signal) {
        seen = signal
        await new Promise<void>((resolve) => { signal.addEventListener('abort', () => { resolve() }, { once: true }) })
        yield 'stopped'
      },
    })
    const stream = requests()
    const replies: DesktopReply[] = []
    const serving = executor.serve(stream.items, reply => replies.push(reply))
    stream.send({ kind: 'call', id: CALL, capability: 'shell', operation: 'run', payload: {} })
    await vi.waitFor(() => { expect(seen).toBeDefined() })
    stream.send({ kind: 'cancel', id: CALL })
    stream.end()
    await serving
    expect(seen?.aborted).toBe(true)
    expect(replies.at(-1)).toEqual({ kind: 'done', id: CALL, value: 'stopped' })
  })

  it('ignores a cancel for a call that already finished', async () => {
    const executor = new DesktopExecutor()
    executor.register('probe', { perform: async function* () { yield 'pong' } })
    const stream = requests()
    const serving = executor.serve(stream.items, () => undefined)
    stream.send({ kind: 'cancel', id: CALL })
    stream.end()
    await expect(serving).resolves.toBeUndefined()
  })

  it('rejects two handlers claiming one capability', () => {
    const executor = new DesktopExecutor()
    const handler = { perform: async function* () { yield 1 } }
    executor.register('shell', handler)
    expect(() => executor.register('shell', handler)).toThrow(/already served/u)
  })

  it('stops serving a capability whose plugin withdrew it', async () => {
    const executor = new DesktopExecutor()
    const dispose = executor.register('shell', { perform: async function* () { yield 'ok' } })
    dispose()
    const stream = requests()
    const replies: DesktopReply[] = []
    const serving = executor.serve(stream.items, reply => replies.push(reply))
    stream.send({ kind: 'call', id: CALL, capability: 'shell', operation: 'run', payload: {} })
    stream.end()
    await serving
    expect(replies.at(-1)).toMatchObject({ kind: 'failed' })
  })
})
