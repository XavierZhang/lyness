/**
 * The calls the instructions section makes, and the sharing around the read.
 *
 * Their own unit because the behaviour worth pinning is not the slot
 * registration: one in-flight read shared by every caller, a call that speaks
 * for nobody told apart from a read that broke, and a save whose stored state
 * is read back from the answer rather than echoed from what was sent.
 *
 * @module @lyness/lyn-client-ui-settings-instructions/client/operations
 */

import type { Context } from '@lyness/cordis'
import { createOutcomeRead, messageOf } from '@lyness/lyn-client-store'
import type { RemoteFailure } from '@lyness/lyn-typert-protocol'
import type {} from '@lyness/lyn-api-remotes/client'
import type {} from '@lyness/lyn-api-personal-instructions-controller/remote'
import type { InstructionsView } from '@lyness/lyn-api-personal-instructions-controller/types'

/** What one Remote call answers: the value, or the failure it refused with. */
export type CallOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RemoteFailure }

/** The two calls the section performs, bound to one client context. */
export interface InstructionsCalls {
  /** What this caller has saved, and what the deployment accepts. */
  describe: () => Promise<CallOutcome<InstructionsView>>
  /** Replace what this caller has saved; blank clears it. */
  save: (text: string) => Promise<CallOutcome<InstructionsView>>
}

/** Where an outcome is published. */
export interface InstructionsSink {
  /** A read has started. */
  begin: () => void
  /** A read answered. */
  succeed: (view: InstructionsView) => void
  /** A read did not answer. */
  fail: () => void
  /** Drop the previous outcome before another attempt. */
  reset: () => void
  /** A save has started. */
  work: () => void
  /** A save landed, and this is what the deployment now holds. */
  saved: (view: InstructionsView) => void
  /** A save was refused, with the reason to show. */
  refused: (reason: string) => void
}

/** What the section's injected face hands over. */
export interface InstructionsOperations {
  /** Read what is saved, or join the read already running. */
  load: () => Promise<void>
  /** Read again after a failure, or join the read already running. */
  retry: () => Promise<void>
  /** Replace what is saved; blank clears it. */
  save: (text: string) => Promise<void>
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
export function instructionsCallsOf(ctx: Context): InstructionsCalls {
  return {
    describe: () => ctx.remote.personalInstructions.describe(),
    save: text => ctx.remote.personalInstructions.save(text),
  }
}

/**
 * Build the operations.
 * @param calls - performs each Remote call.
 * @param sink - where each outcome is published.
 * @returns the operations the section's injected face hands over.
 */
export function createInstructionsOperations(
  calls: InstructionsCalls,
  sink: InstructionsSink,
): InstructionsOperations {
  // The shared read's own helper: a refused call and a thrown one come out
  // the same, because a reader who can only retry has nothing to do with the
  // difference.
  const shared = createOutcomeRead(calls.describe, sink)

  return {
    load: shared.load,
    retry: shared.retry,
    save: async (text): Promise<void> => {
      sink.work()
      try {
        const result = await calls.save(text)
        if (!result.ok) { sink.refused(result.error.message); return }
        sink.saved(result.value)
      } catch (error: unknown) {
        sink.refused(messageOf(error))
      }
    },
  }
}
