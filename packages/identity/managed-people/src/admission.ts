/**
 * Provider: admit the directory identities composition wrote, and the ones
 * administrators have admitted since.
 *
 * It reads the same `bindings` configuration the roster rule does, so an
 * installation keeps what it wrote. A written binding wins, for the reason
 * the written roster does: the next boot restores it either way.
 *
 * @module @deepseek-ai/dsh-managed-people/admission
 */

import type { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { PersonId } from '@deepseek-ai/dsh-people'
import { SignInAdmission } from '@deepseek-ai/dsh-sign-in/admission'
import { Config as rosterConfig } from '@deepseek-ai/dsh-sign-in/admission-roster'
import type { Config } from '@deepseek-ai/dsh-sign-in/admission-roster'
import type { ExternalSubject } from '@deepseek-ai/dsh-sign-in'
import { bindingKey } from './index.ts'
import type { BindingSubmission } from './types.ts'

export type { Config } from '@deepseek-ai/dsh-sign-in/admission-roster'

/**
 * Resolve the written bindings, rejecting one identity written twice.
 *
 * Two rows for one identity is a composition mistake rather than a
 * precedence question: whichever won would decide who somebody signs in as,
 * and an operator reading their own file could not tell which.
 * @param config - the operator-written bindings.
 * @returns each written binding, in written order.
 * @throws {Error} when two rows name the same directory identity.
 */
export function declaredBindings(config: Config): readonly BindingSubmission[] {
  const declared: BindingSubmission[] = []
  const seen = new Set<string>()
  for (const entry of config.bindings) {
    const key = bindingKey(entry.channel, entry.issuer, entry.subject)
    if (seen.has(key)) {
      throw new Error(`managed-people: "${entry.subject}" at "${entry.issuer}" is bound twice`)
    }
    seen.add(key)
    declared.push({
      channel: entry.channel,
      issuer: entry.issuer,
      subject: entry.subject,
      person: brandString<PersonId>(entry.person),
    })
  }
  return declared
}

/** Admits what composition wrote and what administrators have admitted since. */
export class ManagedAdmission extends SignInAdmission {
  static inject = ['managedPeople']

  static readonly Config = rosterConfig

  /**
   * @param ctx - context carrying the managed directory.
   * @param config - validated operator-written bindings.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx)
    for (const entry of declaredBindings(config)) ctx.effect(() => ctx.managedPeople.declareBinding(entry))
  }

  /**
   * The person a binding names for this subject.
   * @param subject - the subject a channel verified.
   * @returns that person, or undefined when neither half admits this identity.
   */
  admit(subject: ExternalSubject): Promise<PersonId | undefined> {
    return this.ctx.managedPeople.admit(bindingKey(subject.channel, subject.issuer, subject.subject))
  }
}

export default ManagedAdmission
