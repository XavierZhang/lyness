/**
 * The join between the calls and the store the framework bakes for the section.
 *
 * The actions arrive later than the calls do: the plugin registers at load,
 * while the store instance is baked when the section first renders. A read
 * that settles before that publishes to nobody rather than failing, which is
 * what lets the plugin start a read without waiting for a render.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-credits/client/binding
 */

import type { AllowanceView, BudgetView, CreditAccountView } from '@deepseek-ai/dsh-api-credits-controller/types'
import type { CreditsOperations, CreditsSink } from './operations.ts'
import type { CreditsSectionInjected } from './CreditsSection.tsx'

/**
 * The store writes this section performs, as the framework hands them over.
 *
 * The same members the calls publish, because that is what they are: the
 * binding exists to hold them until the framework has baked a store, not to
 * translate between two vocabularies.
 */
export type CreditsActions = CreditsSink

/** Publishes outcomes to the baked store, once there is one. */
export class SectionBinding implements CreditsSink {
  private actions: CreditsActions | undefined

  /**
   * Take the store writes the framework baked for this section.
   * @param actions - the bound actions.
   */
  bind(actions: CreditsActions): void {
    this.actions = actions
  }

  /** Report that a read has started. */
  begin(): void { this.actions?.begin() }

  /**
   * Report the account a read returned.
   * @param account - the calling person's credits.
   */
  succeed(account: CreditAccountView): void { this.actions?.succeed(account) }

  /**
   * Report what the reader's own organization bought.
   * @param budget - that ceiling, or undefined when they hold standing in no organization.
   */
  budgeted(budget: BudgetView | undefined): void { this.actions?.budgeted(budget) }

  /**
   * Report that a read did not return an account.
   * @param status - whether the deployment meters nothing, or the read broke.
   */
  fail(status: 'failed' | 'unavailable'): void { this.actions?.fail(status) }

  /** Drop the previous outcome before another attempt. */
  reset(): void { this.actions?.reset() }

  /** Report that a change has started. */
  work(): void { this.actions?.work() }

  /**
   * Report a grant that landed.
   * @param outcome - the granted person's account, and what was added to it.
   */
  granted(outcome: { account: CreditAccountView; person: string; amount: number }): void {
    this.actions?.granted(outcome)
  }

  /**
   * Report an allowance that was saved.
   * @param allowance - what it now reads as.
   */
  allowed(allowance: AllowanceView): void { this.actions?.allowed(allowance) }

  /**
   * Report a change that was refused.
   * @param reason - what the server said.
   */
  refused(reason: string): void { this.actions?.refused(reason) }
}

/**
 * Build the inject factory the section is registered with.
 *
 * It is a named function rather than a closure in `apply` so the binding it
 * performs is reachable without going through the framework's type-erased
 * registration.
 * @param binding - the join that will receive the baked actions.
 * @param operations - the calls the section drives.
 * @returns the factory the framework calls with the baked actions.
 */
export function sectionFace(
  binding: SectionBinding,
  operations: CreditsOperations,
): (actions: CreditsActions) => CreditsSectionInjected {
  return (actions: CreditsActions): CreditsSectionInjected => {
    binding.bind(actions)
    return {
      load: operations.load,
      retry: operations.retry,
      grant: operations.grant,
      setAllowance: operations.setAllowance,
    }
  }
}
