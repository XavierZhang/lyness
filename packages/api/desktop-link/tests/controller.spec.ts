/**
 * The Remote surface: who may attach, and that the link it opens belongs to
 * the person the call speaks for.
 *
 * The carrier itself is the Gateway's concern and its own suite covers it;
 * what is pinned here is the controller's own decision about whose link this
 * stream becomes.
 */

import { Context } from '@lyness/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { brandString } from '@lyness/lyn-brand'
import type { PersonId } from '@lyness/lyn-people'
import DesktopLink from '../src/index.ts'
import DesktopLinkController, { NOT_A_REMOTE_CALL, NOT_SIGNED_IN } from '../src/controller.ts'
import type { DesktopReply, DesktopRequest } from '../src/types.ts'

const ADA = brandString<PersonId>('ada')

const live: Context[] = []
afterEach(async () => { for (const ctx of live.splice(0)) await ctx.fiber.dispose() })

/** A context with the link, a principal, and optionally one Remote call in progress. */
async function bench(options: { person?: PersonId; inCall?: boolean } = {}) {
  const ctx = new Context()
  await ctx.plugin(DesktopLink).await()
  ctx.provide('requestPrincipal', {
    current: () => options.person === undefined ? undefined : { person: options.person },
  } as never)
  if (options.inCall !== false) {
    // The one member `attach` reads; the Gateway supplies the rest. The
    // uplink stays open: a desktop that half-closes it has stopped
    // answering, and the link ends with it.
    ctx.provide('invocation', { uplink: () => openUplink() } as never)
  }
  live.push(ctx)
  return { ctx, controller: new DesktopLinkController(ctx) }
}

/** An uplink that never ends on its own, as a connected desktop's does not. */
function openUplink(): AsyncIterable<DesktopReply> {
  return {
    async *[Symbol.asyncIterator]() {
      await new Promise<void>(() => { /* a connected desktop keeps it open */ })
    },
  }
}

describe('DesktopLinkController', () => {
  it('refuses an attach that speaks for nobody', async () => {
    const { controller } = await bench()
    const stream = controller.attach(new AbortController().signal)
    await expect(stream[Symbol.asyncIterator]().next()).rejects.toThrow(NOT_SIGNED_IN)
  })

  it('refuses an attach outside a Remote call', async () => {
    const { controller } = await bench({ person: ADA, inCall: false })
    const stream = controller.attach(new AbortController().signal)
    await expect(stream[Symbol.asyncIterator]().next()).rejects.toThrow(NOT_A_REMOTE_CALL)
  })

  it('opens the link for the person the call speaks for', async () => {
    const { ctx, controller } = await bench({ person: ADA })
    const aborting = new AbortController()
    const received: DesktopRequest[] = []
    const serving = (async () => {
      for await (const request of controller.attach(aborting.signal)) received.push(request)
    })()
    void serving.catch(() => undefined)
    await vi.waitFor(() => { expect(ctx.desktopLink.reachable(ADA)).toBe(true) })
    const call = ctx.desktopLink.call(ADA, 'probe', 'ping', {})
    void call[Symbol.asyncIterator]().next().catch(() => undefined)
    await vi.waitFor(() => { expect(received).toHaveLength(1) })
    expect(received[0]).toMatchObject({ kind: 'call', capability: 'probe', operation: 'ping' })
    aborting.abort()
    await serving
  })
})
