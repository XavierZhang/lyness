/**
 * Service Definition for who an authenticated directory subject is here.
 *
 * Authentication and admission are two decisions, and a deployment that
 * conflates them admits the whole directory. Microsoft confirming that someone
 * works at a company says nothing about whether this installation is for them;
 * the customer's administrator decides that, and this is where their decision
 * is asked.
 *
 * The sign-in flow injects it, so a deployment that mounts no admission rule
 * signs nobody in. That is the fail-closed direction: an unanswered question
 * about who may use the system must keep people out, not let them all in.
 *
 * @module @deepseek-ai/dsh-sign-in/admission
 */

import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import type { PersonId } from '@deepseek-ai/dsh-people'
import type { ExternalSubject } from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Who an authenticated directory subject is here; absent on a deployment that admits nobody. */
    signInAdmission: SignInAdmission
  }
}

/**
 * Abstract admission rule. Subclass and implement the one decision; a
 * deployment mounts exactly one.
 */
export abstract class SignInAdmission extends Service {
  /**
   * @param ctx - the context this rule serves.
   */
  constructor(ctx: Context) {
    super(ctx, 'signInAdmission')
  }

  /**
   * The person an authenticated subject is, if this deployment admits them.
   *
   * Undefined refuses the sign-in. It is deliberately the same answer for
   * "this directory is not one we accept" and "this person is not on the
   * roster": a sign-in page that distinguished them would report, to whoever
   * asked, which addresses exist here.
   * @param subject - the subject a channel verified.
   * @returns the person they are here, or undefined when this deployment admits them as nobody.
   */
  abstract admit(subject: ExternalSubject): Promise<PersonId | undefined>
}

export default SignInAdmission
