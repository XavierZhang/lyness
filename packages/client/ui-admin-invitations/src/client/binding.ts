/**
 * The join between the calls and the store the framework bakes for the page.
 *
 * The actions arrive later than the calls do: the plugin registers at load,
 * while the store instance is baked when the page first renders. A read that
 * settles before that publishes to nobody rather than failing, which is what
 * lets the plugin start a read without waiting for a render.
 *
 * @module @deepseek-ai/dsh-client-ui-admin-invitations/client/binding
 */

import type { InvitationRowView } from '@deepseek-ai/dsh-api-invitations-controller/types'
import type { InvitationsOperations, InvitationsSink } from './operations.ts'
import type { InvitationsPageInjected } from './InvitationsPage.tsx'

/**
 * The store writes this page performs, as the framework hands them over.
 *
 * The same members the calls publish, because that is what they are: the
 * binding exists to hold them until the framework has baked a store, not to
 * translate between two vocabularies.
 */
export type InvitationsActions = InvitationsSink

/** Publishes outcomes to the baked store, once there is one. */
export class PageBinding implements InvitationsSink {
  private actions: InvitationsActions | undefined

  /**
   * Take the store writes the framework baked for this page.
   * @param actions - the bound actions.
   */
  bind(actions: InvitationsActions): void {
    this.actions = actions
  }

  /** Report that a read has started. */
  begin(): void { this.actions?.begin() }

  /**
   * Report what a read returned.
   * @param invitations - the invitations the caller administers.
   */
  succeed(invitations: readonly InvitationRowView[]): void { this.actions?.succeed(invitations) }

  /**
   * Report that a read did not return them.
   * @param status - whether the deployment issues none, the caller may not, or the read broke.
   */
  fail(status: 'failed' | 'unavailable' | 'forbidden'): void { this.actions?.fail(status) }

  /** Drop the previous outcome before another attempt. */
  reset(): void { this.actions?.reset() }

  /** Report that a change has started. */
  work(): void { this.actions?.work() }

  /**
   * Report one that was issued.
   * @param invitation - the invitation, with the code only this answer carries.
   */
  issued(invitation: InvitationRowView): void { this.actions?.issued(invitation) }

  /**
   * Report one that was withdrawn.
   * @param id - the invitation that stops admitting anybody.
   */
  revoked(id: string): void { this.actions?.revoked(id) }

  /**
   * Report a change that was refused.
   * @param refusal - what the server said, and the fields it named.
   */
  refused(refusal: { reason: string; fields: readonly string[] }): void { this.actions?.refused(refusal) }
}

/**
 * Build the inject factory the page is registered with.
 *
 * It is a named function rather than a closure in `apply` so the binding it
 * performs is reachable without going through the framework's type-erased
 * registration.
 * @param binding - the join that will receive the baked actions.
 * @param operations - the calls the page drives.
 * @param joinPath - the path the redemption link carries the code to.
 * @returns the factory the framework calls with the baked actions.
 */
export function pageFace(
  binding: PageBinding,
  operations: InvitationsOperations,
  joinPath: string,
): (actions: InvitationsActions) => InvitationsPageInjected {
  return (actions: InvitationsActions): InvitationsPageInjected => {
    binding.bind(actions)
    return {
      load: operations.load,
      retry: operations.retry,
      issue: operations.issue,
      revoke: operations.revoke,
      joinPath,
    }
  }
}
