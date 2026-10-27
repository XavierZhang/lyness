/**
 * Service Definition for whose credits a request spends.
 *
 * Enforcement needs this and the model runtime cannot supply it: a streaming
 * call carries a route and messages, not a person. The full chain is sign-in,
 * an authenticated session, the acting context that session holds, and then
 * this — so until a deployment mounts a provider, there is nobody to charge.
 *
 * It is a seam rather than an optional read for one reason: enforcement
 * injects it, so a deployment without it leaves enforcement **inactive**,
 * which a startup audit reports. The alternative — enforcement that quietly
 * meters nothing — is a metering system that silently bills no one.
 *
 * @module @lyness/lyn-credits/subject
 */

import { Service } from '@lyness/cordis'
import type { Context } from '@lyness/cordis'
import type { PersonId } from '@lyness/lyn-people'

declare module '@lyness/cordis' {
  interface Context {
    /** Whose credits the request being served spends; absent on a deployment that meters none. */
    creditSubject: CreditSubject
  }
}

/** Who one request is charged to: a person, and the organization they act for. */
export interface CreditSubjectIdentity {
  /** The person to charge. */
  readonly person: PersonId
  /**
   * The organization whose budget the spend also counts against.
   *
   * Absent for a person who holds no standing in one, whose spending counts
   * against their own balance and no ceiling above it.
   */
  readonly organization?: string | undefined
}

/** Resolves the person a request is charged to. */
export abstract class CreditSubject extends Service {
  /**
   * @param ctx - the context this resolver serves.
   */
  constructor(ctx: Context) {
    super(ctx, 'creditSubject')
  }

  /**
   * The person the request being served is charged to.
   *
   * Undefined is a real answer, not a failure: a deployment's own maintenance
   * work, a replay in a test, and a seeded session all issue requests that
   * belong to nobody. Charging them to whoever happens to be signed in would
   * be worse than not charging them.
   * @returns the person to charge and the organization they act for, or undefined when the request belongs to nobody.
   */
  abstract current(): Promise<CreditSubjectIdentity | undefined>
}

export default CreditSubject
