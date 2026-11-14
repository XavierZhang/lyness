/**
 * The calls the memory section makes, and the sharing around the read.
 *
 * Their own unit because the behaviour worth pinning is not the slot
 * registration: one in-flight read shared by every caller, a call that speaks
 * for nobody told apart from a read that broke, and a removal whose remaining
 * list is read back from the answer rather than spliced locally.
 *
 * @module @lyness/lyn-client-ui-settings-memory/client/operations
 */

import type { Context } from '@lyness/cordis'
import { createOutcomeRead, messageOf } from '@lyness/lyn-client-store'
import type { RemoteFailure } from '@lyness/lyn-typert-protocol'
import type {} from '@lyness/lyn-api-remotes/client'
import type {} from '@lyness/lyn-api-memory-controller/remote'
import type { MemoriesView } from '@lyness/lyn-api-memory-controller/types'

/** What one Remote call answers: the value, or the failure it refused with. */
export type CallOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RemoteFailure }

/** The two calls the section performs, bound to one client context. */
export interface MemoryCalls {
  /** What is remembered about this caller. */
  list: () => Promise<CallOutcome<MemoriesView>>
  /** Remove one of their own entries. */
  forget: (id: string) => Promise<CallOutcome<MemoriesView>>
}

/** Where an outcome is published. */
export interface MemorySink {
  /** A read has started. */
  begin: () => void
  /** A read answered. */
  succeed: (view: MemoriesView) => void
  /** A read did not answer. */
  fail: () => void
  /** Drop the previous outcome before another attempt. */
  reset: () => void
  /** A removal has started for one entry. */
  work: (id: string) => void
  /** A removal was refused, with the reason to show. */
  refused: (reason: string) => void
}

/** What the section's injected face hands over. */
export interface MemoryOperations {
  /** Read what is remembered, or join the read already running. */
  load: () => Promise<void>
  /** Read again after a failure, or join the read already running. */
  retry: () => Promise<void>
  /** Remove one entry. */
  forget: (id: string) => Promise<void>
}

/**
 * The deployment calls, bound to one client context.
 *
 * Named rather than written inline where the operations are built, so each
 * call is reachable on its own: a test can drive them against a Remote double
 * without standing up a slot registration.
 * @param ctx - the client context whose Remote reaches the deployment.
 * @returns the calls the section performs.
 */
export function memoryCallsOf(ctx: Context): MemoryCalls {
  return {
    list: () => ctx.remote.memories.list(),
    forget: id => ctx.remote.memories.forget(id),
  }
}

/**
 * Build the operations.
 * @param calls - performs each Remote call.
 * @param sink - where each outcome is published.
 * @returns the operations the section's injected face hands over.
 */
export function createMemoryOperations(calls: MemoryCalls, sink: MemorySink): MemoryOperations {
  // The shared read's own helper: a refused call and a thrown one come out
  // the same, because a reader who can only retry has nothing to do with the
  // difference.
  const shared = createOutcomeRead(calls.list, sink)

  return {
    load: shared.load,
    retry: shared.retry,
    forget: async (id): Promise<void> => {
      sink.work(id)
      try {
        const result = await calls.forget(id)
        if (!result.ok) { sink.refused(result.error.message); return }
        // What remains is read back from the answer rather than spliced here,
        // so a row that was already gone disappears instead of lingering.
        sink.succeed(result.value)
      } catch (error: unknown) {
        sink.refused(messageOf(error))
      }
    },
  }
}
