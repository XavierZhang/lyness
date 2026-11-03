/**
 * The calls the credits section makes, and the sharing around the read.
 *
 * They are their own unit because the behaviour worth pinning is not the slot
 * registration: one in-flight read shared by every caller, a deployment that
 * meters nothing told apart from a read that broke, a refusal reported with
 * the reason the server gave, and a retry that shows the attempt rather than
 * the failure it replaces.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-credits/client/operations
 */

import type { Context } from '@deepseek-ai/cordis'
import { createSharedRead } from '@deepseek-ai/dsh-client-store'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-credits-controller/remote'
import type {
  AllowanceInput, AllowanceView, BudgetView, CreditAccountView, CreditGrantInput,
} from '@deepseek-ai/dsh-api-credits-controller/types'

/** What one Remote call answers: the value, or the code it refused with. */
export type CallOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error?: { readonly code?: string; readonly message?: string } | undefined }

/** The three calls the section performs, bound to one client context. */
export interface CreditsCalls {
  /** Read the calling person's own account. */
  mine: () => Promise<CallOutcome<CreditAccountView>>
  /** Add credits to one person. */
  grant: (input: CreditGrantInput) => Promise<CallOutcome<CreditAccountView>>
  /** Set or replace one recurring-allowance override. */
  setAllowance: (input: AllowanceInput) => Promise<CallOutcome<AllowanceView>>
  /** Read what the calling person's own organization bought. */
  myBudget: () => Promise<CallOutcome<BudgetView | undefined>>
}

/** Where an outcome is published. */
export interface CreditsSink {
  /** A read has started. */
  begin: () => void
  /** A read returned this account. */
  succeed: (account: CreditAccountView) => void
  /** A read returned the reader's own organization's ceiling, or none. */
  budgeted: (budget: BudgetView | undefined) => void
  /** A read did not return an account. */
  fail: (status: 'failed' | 'unavailable') => void
  /** Drop the previous outcome before another attempt. */
  reset: () => void
  /** A change has started. */
  work: () => void
  /** A grant landed. */
  granted: (outcome: { account: CreditAccountView; person: string; amount: number }) => void
  /** An allowance was saved, and this is what it now reads as. */
  allowed: (allowance: AllowanceView) => void
  /** A change was refused, with the reason to show. */
  refused: (reason: string) => void
}

/** What the section's injected face hands over. */
export interface CreditsOperations {
  /** Read the account, or join the read already running. */
  load: () => Promise<void>
  /** Read again after a failure, or join the read already running. */
  retry: () => Promise<void>
  /** Grant credits to one person. */
  grant: (input: CreditGrantInput) => Promise<void>
  /** Save one recurring-allowance override. */
  setAllowance: (input: AllowanceInput) => Promise<void>
}

/**
 * The deployment calls, bound to one client context.
 *
 * Named rather than written inline where the operations are built, so each
 * call is reachable on its own: a test can drive them against a Remote double
 * without standing up a slot registration.
 * @param ctx - the client context whose Remote reaches the deployment.
 * @returns the three calls the section performs.
 */
export function creditsCallsOf(ctx: Context): CreditsCalls {
  return {
    mine: () => ctx.remote.credits.mine(),
    grant: input => ctx.remote.credits.grant(input),
    setAllowance: input => ctx.remote.credits.setAllowance(input),
    myBudget: () => ctx.remote.credits.myBudget(),
  }
}

/** The message a refusal shows: the server's own, or its code when it sent none. */
function reasonOf(outcome: { readonly error?: { readonly code?: string; readonly message?: string } | undefined }): string {
  return outcome.error?.message ?? outcome.error?.code ?? 'unknown'
}

/**
 * Read the reader's own organization's ceiling, beside the account.
 *
 * Its own try: the section is for the account, so a ceiling that could not be
 * read leaves the account on screen without one rather than turning the whole
 * read into a failure.
 * @param calls - performs the Remote calls.
 * @param sink - where the outcome is published.
 */
async function readBudget(calls: CreditsCalls, sink: CreditsSink): Promise<void> {
  try {
    const budget = await calls.myBudget()
    sink.budgeted(budget.ok ? budget.value : undefined)
  } catch {
    sink.budgeted(undefined)
  }
}

/**
 * Build the operations.
 * @param calls - performs each Remote call.
 * @param sink - where each outcome is published.
 * @returns the operations the section's injected face hands over.
 */
export function createCreditsOperations(calls: CreditsCalls, sink: CreditsSink): CreditsOperations {
  const shared = createSharedRead(async () => {
    sink.begin()
    try {
      const result = await calls.mine()
      if (result.ok) {
        sink.succeed(result.value)
        // Asked only of a standing that administers somebody: what an
        // organization bought and has spent is its administrators' to see, so
        // a member's read would be one refusal for nothing.
        if (result.value.administrable) await readBudget(calls, sink)
        return
      }
      // A deployment that meters nothing is not a failure a reader can retry
      // out of, so it is reported as its own state rather than as a breakage.
      sink.fail(result.error?.code === 'credits/unavailable' ? 'unavailable' : 'failed')
    } catch {
      // The reason belongs to the transport, and a reader can only retry.
      sink.fail('failed')
    }
  }, () => { sink.reset() })

  return {
    load: shared.load,
    retry: shared.retry,
    grant: async (input): Promise<void> => {
      sink.work()
      try {
        const result = await calls.grant(input)
        if (!result.ok) { sink.refused(reasonOf(result)); return }
        sink.granted({ account: result.value, person: input.person, amount: input.amount })
      } catch (error: unknown) {
        sink.refused(error instanceof Error ? error.message : String(error))
      }
    },
    setAllowance: async (input): Promise<void> => {
      sink.work()
      try {
        const result = await calls.setAllowance(input)
        if (!result.ok) { sink.refused(reasonOf(result)); return }
        sink.allowed(result.value)
      } catch (error: unknown) {
        sink.refused(error instanceof Error ? error.message : String(error))
      }
    },
  }
}
