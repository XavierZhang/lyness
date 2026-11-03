/**
 * The Host's end of a desktop link: one channel per signed-in person, over
 * which the Host asks that person's own machine to do work.
 *
 * The direction is the point. Every other Remote surface runs Client to Host;
 * this one runs Host to Client, because the agent turn is on the server — it
 * has to be, or credits and the model policy have no place to hold — while
 * the files and processes it works on are on the person's laptop
 * ([decision](../../../../.agents/notes/proposed/architecture/2026-10-15-diverging-from-the-single-operator-host.md)).
 *
 * It needs no new transport. A Remote stream already carries Host items down
 * and Client items up on one logical stream, over the authenticated carrier
 * the desktop already opened, so a desktop behind NAT is reachable without
 * anything listening on it.
 *
 * @module @deepseek-ai/dsh-desktop-link
 */

import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { PersonId } from '@deepseek-ai/dsh-people'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { CallId, DesktopRefusal, DesktopReply, DesktopRequest } from './types.ts'

export type { CallId, DesktopRefusal, DesktopReply, DesktopRequest } from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Links to signed-in people's own machines; absent on a deployment that reaches none. */
    desktopLink: DesktopLink
  }
}

/** A call that did not reach a desktop, or did not finish there. */
export class DesktopUnavailable extends Error {
  /** Stable machine code for the refusal. */
  readonly code: DesktopRefusal

  /**
   * @param code - which of the three refusals this is.
   * @param detail - what the desktop reported, for `call-failed`.
   */
  constructor(code: DesktopRefusal, detail?: string) {
    super(detail ?? MESSAGES[code])
    this.name = 'DesktopUnavailable'
    this.code = code
  }
}

const MESSAGES: Record<DesktopRefusal, string> = {
  'no-desktop': 'this person has no desktop connected',
  'desktop-lost': 'the desktop disconnected while the call was running',
  'call-failed': 'the desktop could not complete the call',
}

/** One call in flight, and the queue its replies land in. */
interface Pending {
  /** Items delivered but not yet consumed by the caller. */
  readonly items: JsonValue[]
  /** Woken when an item, a terminal reply, or the link's loss arrives. */
  wake: (() => void) | undefined
  /** Set once the call is over; the caller stops after draining `items`. */
  outcome: { readonly kind: 'done'; readonly value: JsonValue } | { readonly kind: 'failed'; readonly error: DesktopUnavailable } | undefined
}

/** One connected desktop, as the Host holds it. */
interface Connected {
  /** Requests waiting to go down the stream. */
  readonly outbound: DesktopRequest[]
  /** Woken when a request is queued or the link closes. */
  wake: (() => void) | undefined
  /** Calls in flight on this link. */
  readonly pending: Map<CallId, Pending>
  /** Set when the stream ends; every pending call fails with it. */
  closed: boolean
}

/** Links to signed-in people's own machines. */
export class DesktopLink extends Service {
  private readonly links = new Map<PersonId, Connected>()

  private sequence = 0

  /**
   * @param ctx - the context this link serves.
   */
  constructor(ctx: Context) {
    super(ctx, 'desktopLink')
  }

  /**
   * Whether this person currently has a desktop connected.
   * @param person - whose machine to ask about.
   * @returns true while a desktop is attached for them.
   */
  reachable(person: PersonId): boolean {
    return this.links.has(person)
  }

  /**
   * Serve one desktop: yield the work asked of it until its stream ends.
   *
   * One link per person, and a second connection replaces the first rather
   * than joining it. Two machines answering for one person would make "run
   * this command on my laptop" ambiguous, and the newest connection is the
   * one the person is sitting at.
   * @param person - the signed-in person this desktop belongs to.
   * @param replies - the uplink the desktop answers on.
   * @param signal - ends the link when the carrier does.
   * @returns the requests this desktop should perform.
   */
  async *serve(
    person: PersonId,
    replies: AsyncIterable<DesktopReply>,
    signal: AbortSignal,
  ): AsyncIterable<DesktopRequest> {
    this.close(person)
    const link: Connected = { outbound: [], wake: undefined, pending: new Map(), closed: false }
    this.links.set(person, link)
    const onAbort = (): void => { this.release(person, link) }
    signal.addEventListener('abort', onAbort, { once: true })
    const reading = this.read(link, replies).finally(() => { this.release(person, link) })
    // The rejection is observed here; `read` records the loss on the link.
    void reading.catch(() => undefined)
    try {
      while (!link.closed) {
        const next = link.outbound.shift()
        if (next !== undefined) { yield next; continue }
        await new Promise<void>((resolve) => { link.wake = resolve })
      }
    } finally {
      signal.removeEventListener('abort', onAbort)
      this.release(person, link)
    }
  }

  /**
   * Ask one person's desktop to perform an operation.
   *
   * The result is an iterable because a call may produce many items before it
   * finishes — a command's output arrives as it is produced, not after. A
   * caller that wants only the final value iterates to the end.
   * @param person - whose machine to reach.
   * @param capability - the capability the call belongs to.
   * @param operation - the operation within it.
   * @param payload - the operation's arguments.
   * @param signal - cancels the call on the desktop.
   * @returns each item the desktop sent, then its final value.
   * @throws {DesktopUnavailable} when no desktop is connected, the desktop is lost, or the call fails there.
   */
  async *call(
    person: PersonId,
    capability: string,
    operation: string,
    payload: JsonValue,
    signal?: AbortSignal,
  ): AsyncIterable<JsonValue> {
    const link = this.links.get(person)
    if (link === undefined || link.closed) throw new DesktopUnavailable('no-desktop')
    this.sequence += 1
    const id = brandString<CallId>(`c${String(this.sequence)}`)
    const pending: Pending = { items: [], wake: undefined, outcome: undefined }
    link.pending.set(id, pending)
    this.send(link, { kind: 'call', id, capability, operation, payload })
    const onAbort = (): void => { this.send(link, { kind: 'cancel', id }) }
    signal?.addEventListener('abort', onAbort, { once: true })
    try {
      let outcome = pending.outcome
      for (;;) {
        // A queued item is never `undefined`: the wire carries JSON, where
        // the empty value is `null`, so an absent shift really is an empty
        // queue.
        const item = pending.items.shift()
        if (item !== undefined) { yield item; continue }
        outcome = pending.outcome
        if (outcome !== undefined) break
        await new Promise<void>((resolve) => { pending.wake = resolve })
      }
      if (outcome.kind === 'failed') throw outcome.error
      yield outcome.value
    } finally {
      signal?.removeEventListener('abort', onAbort)
      link.pending.delete(id)
    }
  }

  /** Queue one request and wake the serving loop. */
  private send(link: Connected, request: DesktopRequest): void {
    link.outbound.push(request)
    const wake = link.wake
    link.wake = undefined
    wake?.()
  }

  /** Route every reply to its call until the uplink ends. */
  private async read(link: Connected, replies: AsyncIterable<DesktopReply>): Promise<void> {
    for await (const reply of replies) {
      const pending = link.pending.get(reply.id)
      // A reply for a call the Host already abandoned is dropped: the caller
      // is gone, and the desktop learns through the cancel it was sent.
      if (pending === undefined) continue
      if (reply.kind === 'item') pending.items.push(reply.value)
      else if (reply.kind === 'done') pending.outcome = { kind: 'done', value: reply.value }
      else pending.outcome = { kind: 'failed', error: new DesktopUnavailable('call-failed', reply.reason) }
      const wake = pending.wake
      pending.wake = undefined
      wake?.()
    }
  }

  /** End this person's link, if it is still the one recorded. */
  private close(person: PersonId): void {
    const existing = this.links.get(person)
    if (existing !== undefined) this.release(person, existing)
  }

  /**
   * Mark one link closed, fail everything on it, and forget it.
   *
   * The recorded link is the only one that reaches the body: a replaced link
   * was closed by {@link close} before the replacement was recorded, and a
   * closed link returns here.
   */
  private release(person: PersonId, link: Connected): void {
    if (link.closed) return
    link.closed = true
    this.links.delete(person)
    for (const pending of link.pending.values()) {
      pending.outcome ??= { kind: 'failed', error: new DesktopUnavailable('desktop-lost') }
      const wake = pending.wake
      pending.wake = undefined
      wake?.()
    }
    const wake = link.wake
    link.wake = undefined
    wake?.()
  }
}

export default DesktopLink
