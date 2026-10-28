/**
 * The Host's end of a link: what reaches a connected desktop, what happens
 * when none is connected or one disappears, and how a second connection for
 * one person is resolved.
 */

import { Context } from '@lyness/cordis'
import { afterEach, describe, expect, it } from 'vitest'
import { brandString } from '@lyness/lyn-brand'
import type { PersonId } from '@lyness/lyn-people'
import DesktopLink from '../src/index.ts'
import type { CallId, DesktopReply, DesktopRequest } from '../src/types.ts'

const ADA = brandString<PersonId>('ada')

const live: Context[] = []
afterEach(async () => { for (const ctx of live.splice(0)) await ctx.fiber.dispose() })

/** A queue a test pushes replies into, standing in for a desktop's uplink. */
function uplink(): { send: (reply: DesktopReply) => void; end: () => void; items: AsyncIterable<DesktopReply> } {
  const queued: DesktopReply[] = []
  let wake: (() => void) | undefined
  let ended = false
  const nudge = (): void => { const w = wake; wake = undefined; w?.() }
  return {
    send: (reply) => { queued.push(reply); nudge() },
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

/** The link service, mounted. */
async function link(): Promise<DesktopLink> {
  const ctx = new Context()
  await ctx.plugin(DesktopLink).await()
  live.push(ctx)
  return ctx.desktopLink
}

/** Attach one desktop and collect the requests it receives. */
function attach(service: DesktopLink, person: PersonId) {
  const desktop = uplink()
  const controller = new AbortController()
  const received: DesktopRequest[] = []
  let wake: (() => void) | undefined
  const reading = (async () => {
    for await (const request of service.serve(person, desktop.items, controller.signal)) {
      received.push(request)
      const w = wake; wake = undefined; w?.()
    }
  })()
  void reading.catch(() => undefined)
  return {
    desktop,
    controller,
    received,
    reading,
    /** Resolve once the desktop has been handed at least `count` requests. */
    async awaitRequests(count: number): Promise<void> {
      while (received.length < count) await new Promise<void>((resolve) => { wake = resolve })
    },
  }
}

describe('DesktopLink', () => {
  it('reaches nobody before a desktop attaches', async () => {
    const service = await link()
    expect(service.reachable(ADA)).toBe(false)
    const call = service.call(ADA, 'subprocess', 'spawn', {})
    await expect(call[Symbol.asyncIterator]().next()).rejects.toMatchObject({ code: 'no-desktop' })
  })

  it('hands a call to the attached desktop and answers with its value', async () => {
    const service = await link()
    const session = attach(service, ADA)
    const call = service.call(ADA, 'subprocess', 'spawn', { command: 'true' })
    const started = call[Symbol.asyncIterator]()
    const first = started.next()
    await session.awaitRequests(1)
    const request = session.received[0]
    expect(request).toMatchObject({ kind: 'call', capability: 'subprocess', operation: 'spawn' })
    if (request?.kind !== 'call') throw new Error('expected a call request')
    session.desktop.send({ kind: 'done', id: request.id, value: { exitCode: 0 } })
    expect((await first).value).toEqual({ exitCode: 0 })
    expect((await started.next()).done).toBe(true)
  })

  it('delivers the items a call produced before its value', async () => {
    const service = await link()
    const session = attach(service, ADA)
    const call = service.call(ADA, 'subprocess', 'spawn', {})
    const started = call[Symbol.asyncIterator]()
    const first = started.next()
    await session.awaitRequests(1)
    const request = session.received[0]
    if (request?.kind !== 'call') throw new Error('expected a call request')
    session.desktop.send({ kind: 'item', id: request.id, value: 'out-1' })
    session.desktop.send({ kind: 'item', id: request.id, value: 'out-2' })
    session.desktop.send({ kind: 'done', id: request.id, value: { exitCode: 0 } })
    expect((await first).value).toBe('out-1')
    expect((await started.next()).value).toBe('out-2')
    expect((await started.next()).value).toEqual({ exitCode: 0 })
  })

  it('carries an item whose value is the wire empty value', async () => {
    const service = await link()
    const session = attach(service, ADA)
    const started = service.call(ADA, 'probe', 'ping', {})[Symbol.asyncIterator]()
    const first = started.next()
    await session.awaitRequests(1)
    const request = session.received[0]
    if (request?.kind !== 'call') throw new Error('expected a call request')
    session.desktop.send({ kind: 'item', id: request.id, value: null })
    session.desktop.send({ kind: 'done', id: request.id, value: 'end' })
    expect((await first).value).toBeNull()
    expect((await started.next()).value).toBe('end')
  })

  it('reports what the desktop said when a call fails there', async () => {
    const service = await link()
    const session = attach(service, ADA)
    const started = service.call(ADA, 'subprocess', 'spawn', {})[Symbol.asyncIterator]()
    const first = started.next()
    await session.awaitRequests(1)
    const request = session.received[0]
    if (request?.kind !== 'call') throw new Error('expected a call request')
    session.desktop.send({ kind: 'failed', id: request.id, reason: 'no such file' })
    await expect(first).rejects.toMatchObject({ code: 'call-failed', message: 'no such file' })
  })

  it('fails a call in flight when the desktop disappears', async () => {
    const service = await link()
    const session = attach(service, ADA)
    const started = service.call(ADA, 'subprocess', 'spawn', {})[Symbol.asyncIterator]()
    const first = started.next()
    await session.awaitRequests(1)
    session.desktop.end()
    await expect(first).rejects.toMatchObject({ code: 'desktop-lost' })
    expect(service.reachable(ADA)).toBe(false)
  })

  it('sends a cancel when the caller aborts', async () => {
    const service = await link()
    const session = attach(service, ADA)
    const aborting = new AbortController()
    const started = service.call(ADA, 'subprocess', 'spawn', {}, aborting.signal)[Symbol.asyncIterator]()
    void started.next().catch(() => undefined)
    await session.awaitRequests(1)
    aborting.abort()
    await session.awaitRequests(2)
    expect(session.received[1]).toMatchObject({ kind: 'cancel', id: (session.received[0] as { id: string }).id })
  })

  it('replaces an earlier connection rather than serving two machines', async () => {
    const service = await link()
    const first = attach(service, ADA)
    await Promise.resolve()
    const second = attach(service, ADA)
    const started = service.call(ADA, 'subprocess', 'spawn', {})[Symbol.asyncIterator]()
    void started.next().catch(() => undefined)
    await second.awaitRequests(1)
    // The newest connection is the machine the person is sitting at; the
    // first one is released rather than left holding half the calls.
    expect(first.received).toEqual([])
    await first.reading
  })

  it('fails the calls on a link whose uplink errors', async () => {
    const service = await link()
    const controller = new AbortController()
    const broken: AsyncIterable<DesktopReply> = {
      async *[Symbol.asyncIterator]() {
        yield* []
        throw new Error('carrier lost')
      },
    }
    const serving = (async () => {
      for await (const _request of service.serve(ADA, broken, controller.signal)) { /* none expected */ }
    })()
    void serving.catch(() => undefined)
    await serving
    // The link is gone, so the next call is refused rather than hanging on a
    // desktop that is no longer answering.
    const call = service.call(ADA, 'probe', 'ping', {})
    await expect(call[Symbol.asyncIterator]().next()).rejects.toMatchObject({ code: 'no-desktop' })
  })

  it('drops a reply for a call nobody is waiting on', async () => {
    const service = await link()
    const session = attach(service, ADA)
    expect(() => {
      session.desktop.send({ kind: 'done', id: brandString<CallId>('c99'), value: 'orphan' })
    }).not.toThrow()
    expect(service.reachable(ADA)).toBe(true)
  })
})
