/**
 * The calls the invitations page makes, and the sharing around the read.
 *
 * They are their own unit because the behaviour worth pinning is not the slot
 * registration: one in-flight read shared by every caller, a deployment that
 * issues no invitations told apart from a caller who may not issue them and
 * from a read that broke, and a refusal reported with the fields the server
 * named so the form can mark them.
 *
 * @module @deepseek-ai/dsh-client-ui-admin-invitations/client/operations
 */

import type { Context } from '@deepseek-ai/cordis'
import { createSharedRead, messageOf } from '@deepseek-ai/dsh-client-store'
import type { RemoteFailure } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-invitations-controller/remote'
import type { InvitationInput, InvitationRowView } from '@deepseek-ai/dsh-api-invitations-controller/types'

/** What one Remote call answers: the value, or the failure it refused with. */
export type CallOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RemoteFailure }

/** The calls the page performs, bound to one client context. */
export interface InvitationsCalls {
  /** The invitations the caller administers. */
  list: () => Promise<CallOutcome<readonly InvitationRowView[]>>
  /** Issue one, and answer its code once. */
  issue: (input: InvitationInput) => Promise<CallOutcome<InvitationRowView>>
  /** Withdraw one, so a code already sent stops working. */
  revoke: (id: string) => Promise<CallOutcome<void>>
}

/** Where an outcome is published. */
export interface InvitationsSink {
  /** A read has started. */
  begin: () => void
  /** A read returned the invitations. */
  succeed: (invitations: readonly InvitationRowView[]) => void
  /** A read did not return them. */
  fail: (status: 'failed' | 'unavailable' | 'forbidden') => void
  /** Drop the previous outcome before another attempt. */
  reset: () => void
  /** A change has started. */
  work: () => void
  /** One was issued, and this is it, with its code. */
  issued: (invitation: InvitationRowView) => void
  /** One was withdrawn. */
  revoked: (id: string) => void
  /** A change was refused, with the reason and the fields to mark. */
  refused: (refusal: { reason: string; fields: readonly string[] }) => void
}

/** What the page's injected face hands over. */
export interface InvitationsOperations {
  /** Read the invitations, or join the read already running. */
  load: () => Promise<void>
  /** Read again after a failure, or join the read already running. */
  retry: () => Promise<void>
  /** Issue one invitation. */
  issue: (input: InvitationInput) => Promise<void>
  /** Withdraw one invitation. */
  revoke: (id: string) => Promise<void>
}

/**
 * The deployment calls, bound to one client context.
 *
 * Named rather than written inline where the operations are built, so each
 * call is reachable on its own: a test can drive them against a Remote double
 * without standing up a slot registration.
 * @param ctx - the client context whose Remote reaches the deployment.
 * @returns the calls the page performs.
 */
export function invitationCallsOf(ctx: Context): InvitationsCalls {
  return {
    list: () => ctx.remote.invitations.list(),
    issue: input => ctx.remote.invitations.issue(input),
    revoke: id => ctx.remote.invitations.revoke(id),
  }
}

/**
 * Why one read did not answer.
 *
 * Three answers rather than one failure, because only one of them is worth a
 * retry button: a deployment that issues no invitations will not start, and a
 * caller without the standing will not gain it by asking again.
 * @param error - what the refused call reported.
 * @returns the state the page renders.
 */
export function statusOf(error: RemoteFailure): 'failed' | 'unavailable' | 'forbidden' {
  if (error.code === 'gateway/internal') return 'unavailable'
  if (error.code === 'gateway/forbidden' || error.code === 'invitations/no-standing') return 'forbidden'
  return 'failed'
}

/**
 * What a refusal is published as, with the fields a form marks.
 *
 * Only an incomplete submission names fields, and reading them from its own
 * code is what keeps the form from marking a field on a refusal that was
 * about something else.
 * @param error - what the refused call reported.
 * @returns the reason to show, and the fields to mark.
 */
function refusalOf(error: RemoteFailure): { reason: string; fields: readonly string[] } {
  return {
    reason: error.message,
    fields: error.code === 'invitations/incomplete' ? error.details.fields : [],
  }
}

/**
 * Build the operations.
 * @param calls - performs each Remote call.
 * @param sink - where each outcome is published.
 * @returns the operations the page's injected face hands over.
 */
export function createInvitationsOperations(
  calls: InvitationsCalls,
  sink: InvitationsSink,
): InvitationsOperations {
  const shared = createSharedRead(async () => {
    sink.begin()
    try {
      const answered = await calls.list()
      if (!answered.ok) { sink.fail(statusOf(answered.error)); return }
      sink.succeed(answered.value)
    } catch {
      // The reason belongs to the transport, and a reader can only retry.
      sink.fail('failed')
    }
  }, () => { sink.reset() })

  return {
    load: shared.load,
    retry: shared.retry,
    issue: async (input): Promise<void> => {
      sink.work()
      try {
        const result = await calls.issue(input)
        if (!result.ok) { sink.refused(refusalOf(result.error)); return }
        sink.issued(result.value)
      } catch (error: unknown) {
        sink.refused({ reason: messageOf(error), fields: [] })
      }
    },
    revoke: async (id): Promise<void> => {
      sink.work()
      try {
        const result = await calls.revoke(id)
        if (!result.ok) { sink.refused(refusalOf(result.error)); return }
        sink.revoked(id)
      } catch (error: unknown) {
        sink.refused({ reason: messageOf(error), fields: [] })
      }
    },
  }
}
