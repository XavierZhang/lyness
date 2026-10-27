/**
 * Provider: charge the call in progress to the person it speaks for.
 *
 * This is the piece that makes metering real. Without it `credits/enforce`
 * injects a subject nobody provides and stays inactive, which a startup audit
 * reports — deliberately, because enforcement that quietly meters nothing is
 * worse than enforcement that is visibly absent.
 *
 * A call speaking for nobody is charged to nobody. A deployment's own
 * maintenance work, a replay in a test, and a seeded session all issue model
 * requests, and charging them to whoever happens to be signed in would be
 * worse than not charging them at all.
 *
 * @module @lyness/lyn-credits/subject-request
 */

import { callingStanding } from '@lyness/lyn-request-principal'
import type {} from '@lyness/lyn-request-principal'
import { CreditSubject } from './subject.ts'
import type { CreditSubjectIdentity } from './subject.ts'

/** Charges the call in progress to its signed-in person. */
export class RequestCreditSubject extends CreditSubject {
  static inject = ['requestPrincipal', 'people']

  /**
   * The person the call in progress speaks for, and the organization they act
   * for.
   *
   * The organization comes from the standing the call acts in, as the
   * directory holds it, rather than from anything the caller named: the
   * organization a spend counts against is an authorization fact, and a
   * caller that could name its own would be choosing whose budget to spend.
   * @returns that person and their organization, or undefined when the call speaks for nobody.
   */
  async current(): Promise<CreditSubjectIdentity | undefined> {
    const person = this.ctx.requestPrincipal.current()?.person
    if (person === undefined) return undefined
    const standing = await callingStanding(this.ctx)
    return {
      person,
      ...standing?.organization === undefined ? {} : { organization: standing.organization },
    }
  }
}

export default RequestCreditSubject
