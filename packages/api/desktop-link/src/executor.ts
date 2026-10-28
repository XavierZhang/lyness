/**
 * The desktop's end of a link: answer the work its server asks for.
 *
 * It holds no capability of its own. A handler registers per capability, so
 * the desktop that mounts `subprocess` serves subprocess calls and refuses
 * the rest — the link stays the same channel either way.
 *
 * A call the desktop cannot serve is refused rather than dropped: a Host
 * waiting on a reply that never comes is indistinguishable from a slow
 * machine, and the turn would hang instead of saying what is missing.
 *
 * @module @deepseek-ai/dsh-desktop-link/executor
 */

import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { CallId, DesktopReply, DesktopRequest } from './types.ts'

/** What one capability's handler does with a call. */
export interface DesktopHandler {
  /**
   * Perform one operation on this machine.
   * @param operation - the operation within this capability.
   * @param payload - its arguments, as the Host's provider encoded them.
   * @param signal - aborted when the Host cancels the call.
   * @returns each item to send as it is produced, then the final value last.
   */
  perform: (operation: string, payload: JsonValue, signal: AbortSignal) => AsyncIterable<JsonValue>
}

/**
 * Message a call naming an unmounted capability is refused with.
 * @param capability - the capability the Host asked for.
 * @returns the reason this desktop sends back.
 */
export function unknownCapability(capability: string): string {
  return `this desktop serves no "${capability}" capability`
}

/**
 * The reason text a thrown handler failure is reported with.
 * @param error - whatever the handler threw.
 * @returns its message, or the value rendered as text.
 */
export function failureReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Serves one link's requests from the capabilities this machine mounts. */
export class DesktopExecutor {
  private readonly handlers = new Map<string, DesktopHandler>()

  private readonly running = new Map<CallId, AbortController>()

  /**
   * Offer one capability on this machine.
   *
   * Two handlers for one capability is a composition mistake rather than a
   * runtime condition — the Host would reach whichever won, and a person
   * reading their own config could not tell which — so it fails here.
   * @param capability - the capability name the Host's provider sends.
   * @param handler - what performs its operations.
   * @returns the disposer; the registering plugin owns it.
   * @throws {Error} when that capability is already served.
   */
  register(capability: string, handler: DesktopHandler): () => void {
    if (this.handlers.has(capability)) {
      throw new Error(`desktop-executor: capability "${capability}" is already served`)
    }
    this.handlers.set(capability, handler)
    return () => { this.handlers.delete(capability) }
  }

  /**
   * Serve one link until its requests end.
   * @param requests - the work the Host sends.
   * @param reply - sends one reply up the same logical stream.
   * @returns after the request stream ends and every call it started settles.
   */
  async serve(
    requests: AsyncIterable<DesktopRequest>,
    reply: (value: DesktopReply) => void,
  ): Promise<void> {
    const calls: Promise<void>[] = []
    for await (const request of requests) {
      if (request.kind === 'cancel') { this.running.get(request.id)?.abort(); continue }
      calls.push(this.run(request, reply))
    }
    await Promise.all(calls)
  }

  /** Perform one call and report every item, then its outcome. */
  private async run(
    request: Extract<DesktopRequest, { kind: 'call' }>,
    reply: (value: DesktopReply) => void,
  ): Promise<void> {
    const handler = this.handlers.get(request.capability)
    if (handler === undefined) {
      reply({ kind: 'failed', id: request.id, reason: unknownCapability(request.capability) })
      return
    }
    const controller = new AbortController()
    this.running.set(request.id, controller)
    let last: JsonValue = null
    let produced = false
    try {
      for await (const item of handler.perform(request.operation, request.payload, controller.signal)) {
        // The last item is the call's value; the ones before it are its
        // progress, so the handler needs no separate "this one is final".
        if (produced) reply({ kind: 'item', id: request.id, value: last })
        last = item
        produced = true
      }
      reply({ kind: 'done', id: request.id, value: last })
    } catch (error) {
      reply({ kind: 'failed', id: request.id, reason: failureReason(error) })
    } finally {
      this.running.delete(request.id)
    }
  }
}
