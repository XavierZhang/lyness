/**
 * Provider: admit the roster, and admit an invitation.
 *
 * It is the managed rule plus one more door. The roster answers first — a
 * person already admitted signs in as themselves, and a code they happen to
 * still hold changes nothing — and only a subject nobody has heard of reaches
 * the invitation. That order is what keeps a forwarded link from adding a
 * second entry for somebody who is already here.
 *
 * It replaces `lyn-managed-people/admission` rather than sitting beside it: a
 * deployment mounts exactly one admission rule, and which doors exist is the
 * composition's statement. A deployment that mounts the managed rule admits
 * nobody new; this one admits whoever an administrator invited.
 *
 * @module @lyness/lyn-invitations/admission
 */

import type { Context } from '@lyness/cordis'
import type { PersonId } from '@lyness/lyn-people'
import { SignInAdmission } from '@lyness/lyn-sign-in/admission'
import { Config as rosterConfig } from '@lyness/lyn-sign-in/admission-roster'
import type { Config } from '@lyness/lyn-sign-in/admission-roster'
import type { AdmissionOffer, ExternalSubject } from '@lyness/lyn-sign-in'
import { bindingKey } from '@lyness/lyn-managed-people'
import { declaredBindings } from '@lyness/lyn-managed-people/admission'
import type {} from '@lyness/lyn-invitations'

export type { Config } from '@lyness/lyn-sign-in/admission-roster'

/** Admits the written bindings, the stored ones, and a valid invitation. */
export class InvitingAdmission extends SignInAdmission {
  static inject = ['managedPeople', 'invitations']

  static readonly Config = rosterConfig

  /**
   * @param ctx - context carrying the managed directory and the invitations.
   * @param config - validated operator-written bindings.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx)
    for (const entry of declaredBindings(config)) ctx.effect(() => ctx.managedPeople.declareBinding(entry))
  }

  /**
   * The person this subject is here: the one a binding names, else the one an
   * invitation makes them.
   * @param subject - the subject a channel verified.
   * @param offer - what the sign-in presented besides the subject.
   * @returns that person, or undefined when no binding and no invitation admits them.
   */
  async admit(subject: ExternalSubject, offer?: AdmissionOffer): Promise<PersonId | undefined> {
    const bound = await this.ctx.managedPeople.admit(bindingKey(subject.channel, subject.issuer, subject.subject))
    if (bound !== undefined) return bound
    const code = offer?.invitation
    if (code === undefined) return undefined
    return this.ctx.invitations.redeem(code, subject)
  }
}

export default InvitingAdmission
