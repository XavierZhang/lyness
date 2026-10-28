/**
 * Resolve and check the context one call acts in.
 *
 * Signing in produces a session for a person, not for a standing. Which
 * standing is in force is therefore per call, and this is the one operation
 * that decides whether a declared context is permitted — a check in a
 * transport or a surface would be bypassed by the next caller, and a check
 * repeated in several places is a check that disagrees with itself.
 *
 * Three rules, each with a refusal a caller can act on: a call states its
 * context or is refused, the stated context belongs to the caller, and an
 * address that resolves to an organization admits only that organization's
 * standings.
 *
 * @module @deepseek-ai/dsh-acting-context
 */

import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import type { ActingContext, PersonId } from '@deepseek-ai/dsh-people'
import type { DeclaredContext, RefusalCode } from './types.ts'

export type { DeclaredContext, RefusalCode } from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Resolves the context one call acts in; absent on a deployment with no identities. */
    actingContext: ActingContextResolver
  }
}

/** A refused context, carrying the code a surface maps to its message. */
export class ActingContextRefused extends Error {
  /** Stable machine code for the refusal. */
  readonly code: RefusalCode

  /**
   * @param code - which rule refused the context.
   * @param message - human-readable explanation naming what to do next.
   */
  constructor(code: RefusalCode, message: string) {
    super(message)
    this.name = 'ActingContextRefused'
    this.code = code
  }
}

/** One call's claim about who it is and what it is acting as. */
export interface ActingContextClaim {
  /** The authenticated person making the call. */
  readonly person: PersonId
  /** What the call says it is acting as; absent is refused rather than defaulted. */
  readonly declared?: DeclaredContext | undefined
  /**
   * The organization the address resolved to, when it resolved to one.
   *
   * The address constrains the context; it never chooses it. An address
   * belonging to an organization admits only that organization's standings,
   * and any other context is refused rather than silently switched.
   */
  readonly organization?: string | undefined
}

/** Resolves a declared context against the directory, or refuses it. */
export class ActingContextResolver extends Service {
  static inject = ['people']

  /**
   * @param ctx - context providing the people directory.
   */
  constructor(ctx: Context) {
    super(ctx, 'actingContext')
  }

  /**
   * Check one call's claim and return the context it acts in.
   * @param claim - who the caller is, what they declared, and what the address resolved to.
   * @returns the permitted acting context.
   * @throws {ActingContextRefused} when any of the three rules refuses it.
   */
  async resolve(claim: ActingContextClaim): Promise<ActingContext> {
    const declared = claim.declared
    if (declared === undefined) {
      throw new ActingContextRefused(
        'context-absent',
        'this call states no acting context; state the personal context or one membership',
      )
    }
    if (declared.kind === 'personal') {
      if (claim.organization !== undefined) {
        throw new ActingContextRefused(
          'context-outside-address',
          `this address belongs to "${claim.organization}", which the personal context cannot act on`,
        )
      }
      return { person: claim.person }
    }
    const membership = await this.ctx.people.membership(declared.membership)
    if (membership === undefined) {
      throw new ActingContextRefused('membership-unknown', 'the stated membership does not exist')
    }
    if (membership.person !== claim.person) {
      // Reported as not held rather than as unknown: the caller may not learn
      // whether somebody else's standing exists.
      throw new ActingContextRefused('membership-not-held', 'the stated membership is not held by this person')
    }
    if (claim.organization !== undefined && membership.organization !== claim.organization) {
      throw new ActingContextRefused(
        'context-outside-address',
        `this address belongs to "${claim.organization}", which the stated membership does not`,
      )
    }
    return { person: claim.person, membership: membership.id }
  }
}

export default ActingContextResolver
