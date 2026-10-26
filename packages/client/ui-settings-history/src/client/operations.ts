/**
 * The calls the history section makes, and the sharing around the read.
 *
 * They are their own unit because the behaviour worth pinning is not the slot
 * registration: one in-flight read shared by every caller, and a deployment
 * that keeps no trail told apart from a caller who may not read it and from a
 * read that broke.
 *
 * @module @lyness/lyn-client-ui-settings-history/client/operations
 */

import type { Context } from '@lyness/cordis'
import { createSharedRead } from '@lyness/lyn-client-store'
import type { RemoteFailure } from '@lyness/lyn-typert-protocol'
import type {} from '@lyness/lyn-api-remotes/client'
import type {} from '@lyness/lyn-api-admin-audit-controller/remote'
import type { AuditEntryView, AuditQueryInput } from '@lyness/lyn-api-admin-audit-controller/types'

/** What one Remote call answers: the value, or the failure it refused with. */
export type CallOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RemoteFailure }

/** The calls the section performs, bound to one client context. */
export interface HistoryCalls {
  /** The recorded changes the caller may read. */
  read: (query: AuditQueryInput) => Promise<CallOutcome<readonly AuditEntryView[]>>
}

/** Where an outcome is published. */
export interface HistorySink {
  /** A read has started. */
  begin: () => void
  /** A read returned the entries. */
  succeed: (entries: readonly AuditEntryView[]) => void
  /** A read did not return them. */
  fail: (status: 'failed' | 'unavailable' | 'forbidden') => void
  /** Drop the previous outcome before another attempt. */
  reset: () => void
}

/** What the section's injected face hands over. */
export interface HistoryOperations {
  /** Read the trail, or join the read already running. */
  load: () => Promise<void>
  /** Read again after a failure, or join the read already running. */
  retry: () => Promise<void>
}

/**
 * The deployment call, bound to one client context.
 *
 * Named rather than written inline where the operations are built, so it is
 * reachable on its own: a test can drive it against a Remote double without
 * standing up a slot registration.
 * @param ctx - the client context whose Remote reaches the deployment.
 * @returns the call the section performs.
 */
export function historyCallsOf(ctx: Context): HistoryCalls {
  return { read: query => ctx.remote.audit.read(query) }
}

/**
 * Why one read did not answer.
 *
 * Three answers rather than one failure, because only one of them is worth a
 * retry button: a deployment that keeps no trail will not grow one, and a
 * caller without the standing will not gain it by asking again.
 * @param error - what the refused call reported.
 * @returns the state the section renders.
 */
export function statusOf(error: RemoteFailure): 'failed' | 'unavailable' | 'forbidden' {
  if (error.code === 'gateway/internal') return 'unavailable'
  if (error.code === 'gateway/forbidden' || error.code === 'audit/no-standing') return 'forbidden'
  if (error.code === 'audit/not-permitted') return 'forbidden'
  return 'failed'
}

/**
 * Build the operations.
 * @param calls - performs the Remote call.
 * @param sink - where each outcome is published.
 * @returns the operations the section's injected face hands over.
 */
export function createHistoryOperations(calls: HistoryCalls, sink: HistorySink): HistoryOperations {
  const shared = createSharedRead(async () => {
    sink.begin()
    try {
      // No organization: the surface reads the one the caller's standing
      // administers, which the namespace resolves rather than the form.
      const read = await calls.read({})
      if (!read.ok) { sink.fail(statusOf(read.error)); return }
      sink.succeed(read.value)
    } catch {
      // The reason belongs to the transport, and a reader can only retry.
      sink.fail('failed')
    }
  }, () => { sink.reset() })

  return { load: shared.load, retry: shared.retry }
}
