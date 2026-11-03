/**
 * The calls the data section makes.
 *
 * Their own unit because the behaviour worth pinning is not the slot
 * registration: a deletion that succeeded refreshes the catalog so the row
 * leaves on the Host's own answer rather than being spliced out locally, and
 * a refusal is reported with the reason the deployment gave.
 *
 * @module @lyness/lyn-client-ui-settings-data/client/operations
 */

import type { Context } from '@lyness/cordis'
import { messageOf } from '@lyness/lyn-client-store'
import type { RemoteFailure } from '@lyness/lyn-typert-protocol'
import type {} from '@lyness/lyn-api-remotes/client'
import type {} from '@lyness/lyn-api-session-controller/client'
import type {} from '@lyness/lyn-api-session-data-controller/remote'
import type { SessionDeleteValue } from '@lyness/lyn-api-session-data-controller/types'

/** What one Remote call answers: the value, or the failure it refused with. */
export type CallOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RemoteFailure }

/** The calls the section performs, bound to one client context. */
export interface DataCalls {
  /** Delete one of this caller's own conversations. */
  delete: (sessionId: string) => Promise<CallOutcome<SessionDeleteValue>>
  /** Re-read the Host's conversation catalog. */
  refresh: () => Promise<void>
}

/** Where an outcome is published. */
export interface DataSink {
  /** A deletion has started for one conversation. */
  work: (id: string) => void
  /** A deletion removed this many stored sessions. */
  done: (removed: number) => void
  /** A deletion was refused, with the reason to show. */
  refused: (reason: string) => void
}

/** What the section's injected face hands over. */
export interface DataOperations {
  /** Delete one conversation, then let the catalog say what is left. */
  remove: (id: string) => Promise<void>
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
export function dataCallsOf(ctx: Context): DataCalls {
  return {
    delete: sessionId => ctx.remote.sessionData.delete(sessionId),
    refresh: () => ctx.sessions.refresh(),
  }
}

/**
 * Build the operations.
 * @param calls - performs each Remote call.
 * @param sink - where each outcome is published.
 * @returns the operations the section's injected face hands over.
 */
export function createDataOperations(calls: DataCalls, sink: DataSink): DataOperations {
  return {
    remove: async (id): Promise<void> => {
      sink.work(id)
      let removed: number
      try {
        const result = await calls.delete(id)
        if (!result.ok) { sink.refused(result.error.message); return }
        removed = result.value.removed.length
      } catch (error: unknown) {
        sink.refused(messageOf(error))
        return
      }
      // The row leaves because the Host no longer lists it.
      try {
        await calls.refresh()
      } catch (refreshFailure: unknown) {
        // A listing that did not answer leaves a row naming a conversation
        // that is already gone, and the next successful one corrects it.
        // Reporting the deletion as refused would be worse: it happened.
        void refreshFailure
      }
      sink.done(removed)
    },
  }
}
