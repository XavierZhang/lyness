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
 * @module @lyness/lyn-sign-in/admission
 */

import { Service } from '@lyness/cordis'
import type { Context } from '@lyness/cordis'
import type { PersonId } from '@lyness/lyn-people'
import type { ExternalSubject } from './types.ts'

/**
 * What one sign-in presents besides the subject its channel verified.
 *
 * A rule that admits only a written roster ignores it; a rule that also
 * honours something the person carried — an invitation code — reads it from
 * here. It is the sign-in's own parameter rather than request-scoped state,
 * so the one decision about who may use this deployment is made from values
 * its caller passed in, and a test drives it without a transport.
 */
export interface AdmissionOffer {
  /**
   * An invitation code the person presented.
   *
   * It is a secret, so a rule that does not redeem codes must not log it, and
   * the rule that does answers the same undefined for a wrong one as for a
   * subject nobody invited.
   */
  readonly invitation?: string | undefined
}

declare module '@lyness/cordis' {
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
   * @param offer - what the sign-in presented besides the subject; a rule that
   * admits only its roster ignores it.
   * @returns the person they are here, or undefined when this deployment admits them as nobody.
   */
  abstract admit(subject: ExternalSubject, offer?: AdmissionOffer): Promise<PersonId | undefined>
}

export default SignInAdmission
