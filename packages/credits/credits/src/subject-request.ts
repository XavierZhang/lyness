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

import type { PersonId } from '@lyness/lyn-people'
import type {} from '@lyness/lyn-request-principal'
import { CreditSubject } from './subject.ts'

/** Charges the call in progress to its signed-in person. */
export class RequestCreditSubject extends CreditSubject {
  static inject = ['requestPrincipal']

  /**
   * The person the call in progress speaks for.
   * @returns that person, or undefined when the call speaks for nobody.
   */
  current(): Promise<PersonId | undefined> {
    return Promise.resolve(this.ctx.requestPrincipal.current()?.person)
  }
}

export default RequestCreditSubject
